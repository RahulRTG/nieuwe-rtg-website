/* RTG Pay, deelbestand "kassa": de kascode waarmee een lid contactloos afrekent
   bij een partner -- een vooraf-akkoord tot een maximum, zoals contactloos.

   DE CODE is sinds 27 september 2026 een credential volgens het releasebeleid
   (CODECREDENTIALS.json, deur pay.kascode_en_vooraf): 128 bits, hash-only in
   `payKasToegang`, een keer getoond, vijf minuten geldig, een keer te gebruiken,
   door het lid in te trekken. De bak staat in ./kasbak.js, de claim-saga in
   ./kas-claim.js en de boekingen met een economische sleutel in ./kas-boek.js.

   DE PARTNERKANT staat in ./partner.js: het saldo van de zaak, het uitbetalen
   naar de bank, en het pad waarlangs een lid een zaak rechtstreeks betaalt. Dat
   is een andere beweging dan deze: hier geeft een lid een KASSA toestemming, en
   daar betaalt hij zelf. Krijgt de gedeelde ctx van kern/pay/index.js. */
'use strict';

module.exports = (ctx) => {
  const { crypto, save, nu, d, bewerkCollectie, rekPartner, boekAsync, seintje, betaaldienstKosten, db,
    stelSamen, zorgSaldo, waarde, schoon, KASCODE_MS, KASCODE_MAX } = ctx;

  /* De vergoedingenrij van de betaaldienst: wat is verschuldigd, en is het
     geboekt? Twee verschillende vragen, en tot 20 augustus 2026 was er maar een
     antwoord. Zie ../commercie/fee.js. */
  const fees = require('../commercie/fee').maakFees({ db, save, nu });

  const bak = require('./kasbak')({ d, save, crypto, nu, bewerkCollectie, COL: 'payKasToegang', oud: 'payCodes',
    namespace: 'pay.kascode', prefix: 'KC', issuer: 'rtg.lid.kassa', doel: 'pay-kassa',
    scope: ['kassa.afrekenen'], geldigMs: KASCODE_MS, maxGebruik: 1 });
  const kasBoek = require('./kas-boek')(ctx);
  const claim = require('./kas-claim')({ bak, crypto, nu, stelSamen, zorgSaldo, rekPartner,
    betaalDelen: kasBoek.betaalDelen, weigering: kasBoek.weigering, waarde, schoon, vrijgavePoort: ctx.vrijgavePoort });
  /* ./vooraf.js claimt dezelfde codes en boekt langs dezelfde sleutels: een
     bak, een saga, en niet een tweede exemplaar met een eigen wisvlag. */
  Object.assign(ctx, { kasClaim: claim, kasBoek, kasKosten: null });

  /* ---------- de kassacode: contactloos bij de partner ----------
     Uitgeven IS roteren: de vorige open code van dit lid wordt in dezelfde
     transactie ingetrokken, er is er altijd maar een actief. */
  async function kasCode({ codenaam, maxCenten, idem }) {
    const max = Math.min(KASCODE_MAX, Math.max(100, Math.round(Number(maxCenten) || 15000)));
    const r = await bak.uitgeven({ codenaam, idem, extra: { maxCenten: max } });
    return r.ok ? Object.assign({}, r, { maxCenten: max }) : r;
  }
  const kasIntrek = ({ codenaam }) => bak.intrekken({ codenaam });

  /* Leeft deze code nog? Kijken zonder te consumeren, voor de capability die er
     omheen zit (../link/cap.js). GEEN ROUTE, EN DAT IS EEN VOORWAARDE: een
     loket dat zegt of een code bestaat, is een orakel. Constant-time, net als
     elke andere zoektocht in de bak. */
  function kasStand(code) {
    const k = bak.zoek(bak.kijk(), code);
    if (!k || k.stand !== 'open' || bak.reden(k)) return null;
    return { maxCenten: k.maxCenten, geldigTot: Date.parse(k.toegang.expires_at) };
  }

  /* Kosten en oormerk. De kostenboeking draagt een eigen sleutel en mag bij
     een hervatting opnieuw lopen; de vergoedingenrij, het oormerk en het
     seintje alleen bij wie de claim afrondt. De vergoeding wordt nooit stil
     nul: mislukt de boeking, dan staat hij op HERKANSING (../commercie/fee.js). */
  async function kosten(r, u) {
    let k = 0;
    try { k = Math.max(0, Math.round(betaaldienstKosten(u.centen) || 0)); } catch (e) { k = 0; }
    if (!(k > 0)) return { uitkomst: { kosten: 0 } };
    const kb = await kasBoek.boekEenmaal({ van: rekPartner(r.claim.supplierCode), naar: 'rtg:betaaldienst',
      centen: k, soort: 'betaaldienstkosten', oms: 'Betaaldienstkosten, direct verrekend', ref: 'KC/' + r.claim.id + '/kosten' });
    return { uitkomst: { kosten: k }, kb };
  }
  function naAfronden(r, u, voor) {
    const supplierCode = r.claim.supplierCode;
    let kostenStatus = null;
    if (u.kosten > 0) {
      const f = fees.incasseer({ supplierCode, centen: u.kosten, transactieCenten: u.centen, ref: 'KC/' + r.claim.id });
      if (!voor.kb || voor.kb.error) fees.mislukt(f, voor.kb || { error: 'geen antwoord' });
      else fees.geboekt(f, (voor.kb.boeking || {}).id || null);
      kostenStatus = f ? f.status : null;
    }
    /* Meteen apart zetten wat de zaak zelf heeft ingesteld (btw, loonreserve).
       Een mislukte oormerking is een gemiste reservering en geen verloren cent. */
    let apart = 0;
    try { apart = (ctx.bijOntvangst(supplierCode, u.centen - u.kosten) || {}).apart || 0; } catch (e) { apart = 0; }
    save();
    seintje(r.codenaam);
    return { kostenStatus, apartGezet: apart };
  }

  ctx.kasKosten = { kosten, naAfronden };

  async function kasInt({ supplierCode, code, centen, oms, idem, genre }) {
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < ctx.MIN_CENTEN || c > ctx.MAX_CENTEN) return { status: 400, error: 'Vul het bedrag in.' };
    /* Geld verplaatsen vraagt een idem-sleutel (lib/idem.js, `geld`); de claim
       weigert zonder, maar pas NA de codetoets -- een onbekende code blijft 404. */
    return claim.neem({ code, soort: 'kas', supplierCode, centen: c, idem: idem ? String(idem) : null,
      idemVerplicht: 'rekent een tik af tegen een kascode', genre, oms: oms || 'Kassa' },
      { voor: kosten, na: naAfronden });
  }

  /* De partnerkant staat in ./partner.js en niet hier: dit bestand ging anders
     over de 10 kB-maat. `fees` gaat MEE in plaats van daar opnieuw te worden
     opgebouwd -- een vergoedingenrij hoort er een te zijn. */
  const partner = require('./partner')(Object.assign({}, ctx, { fees }));

  return Object.assign({ kasCode, kasIntrek, kasStand, kasInt }, partner);
};
