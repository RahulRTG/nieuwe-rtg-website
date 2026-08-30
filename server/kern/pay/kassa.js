/* RTG Pay, deelbestand "kassa": de kascode waarmee een lid contactloos afrekent
   bij een partner -- een vooraf-akkoord tot een maximum, zoals contactloos.

   DE PARTNERKANT staat in ./partner.js: het saldo van de zaak, het uitbetalen
   naar de bank, en het pad waarlangs een lid een zaak rechtstreeks betaalt. Dat
   is een andere beweging dan deze: hier geeft een lid een KASSA toestemming, en
   daar betaalt hij zelf. Krijgt de gedeelde ctx van kern/pay/index.js. */
module.exports = (ctx) => {
  const { crypto, save, nu, kascodes, grootboek, rekLid, rekPartner, saldoVan,
    metIdem, boekAsync, betaalUit, seintje, betaaldienstKosten, opdrachten, db,
    MIN_CENTEN, MAX_CENTEN, KASCODE_MS, KASCODE_MAX } = ctx;

  /* De vergoedingenrij van de betaaldienst: wat is verschuldigd, en is het
     geboekt? Twee verschillende vragen, en tot 20 augustus 2026 was er maar een
     antwoord. Zie ../commercie/fee.js. */
  const fees = require('../commercie/fee').maakFees({ db, save, nu });

  /* De teruggang van de partneruitbetaling: alleen deze kant weet dat het
     pay-grootboek het is en dat de tegenrekening extern:uitbetaald heet. Zie
     ../betaalopdracht/ voor waarom dit een tabel per soort is en geen gedeelde
     functie. */
  /* De teruggang van de partneruitbetaling staat in ./partner.js, waar de
     uitbetaling zelf woont. Twee registraties voor hetzelfde soort weigert
     registreerTeruggang -- en terecht: dat zou geld twee keer terugboeken. */

  /* ---------- de kassacode: contactloos bij de partner ---------- */
  function kasCode({ codenaam, maxCenten }) {
    const max = Math.min(KASCODE_MAX, Math.max(100, Math.round(Number(maxCenten) || 15000)));
    // oude codes van dit lid vervallen: er is altijd maar een code actief
    for (const k of kascodes()) if (k.codenaam === codenaam && !k.gebruikt) k.gebruikt = true;
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    kascodes().unshift({ code, codenaam, maxCenten: max, geldigTot: nu() + KASCODE_MS, gebruikt: false, at: nu() });
    if (kascodes().length > 1000) kascodes().length = 1000;
    save();
    return { ok: true, code, maxCenten: max, geldigTot: nu() + KASCODE_MS };
  }
  /* Leeft deze code nog? Kijken zonder te consumeren, voor de capability die er
     sinds 20 augustus 2026 omheen zit (../link/cap.js): RTG Pay houdt per lid
     maar EEN code actief, dus wie een verse maakt, maakt zijn vorige waardeloos
     terwijl het token ervan nog prima ondertekend is. Zonder deze vraag ziet een
     kassa een keurige kaart, tikt het bedrag in, en hoort dan pas dat er niets is.

     GEEN ROUTE, EN DAT IS EEN VOORWAARDE. Een loket dat zegt of een code van zes
     tekens bestaat, is een orakel waarmee je ze kunt aftasten. Deze functie is
     alleen te bereiken met een geldig ondertekend capability-token, en dat token
     is aan EEN code gebonden. */
  function kasStand(code) {
    const k = kascodes().find(x => x.code === String(code || '').toUpperCase().trim());
    if (!k || k.gebruikt || k.geldigTot < nu()) return null;
    return { maxCenten: k.maxCenten, geldigTot: k.geldigTot };
  }
  async function kasInt({ supplierCode, code, centen, oms, idem, genre }) {
    const k = kascodes().find(x => x.code === String(code || '').toUpperCase().trim());
    if (!k || k.gebruikt || k.geldigTot < nu()) return { status: 404, error: 'Deze betaalcode is niet (meer) geldig.' };
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN) return { status: 400, error: 'Vul het bedrag in.' };
    if (c > k.maxCenten) return { status: 402, error: 'Boven het maximum van deze code (' + (k.maxCenten / 100).toFixed(2) + ' euro).' };
    // de code hoort in de afdruk: hergebruik met een ANDERE code is een ander verzoek
    return metIdem(idem ? 'kas:' + supplierCode + ':' + idem : null,
      'kas|' + supplierCode + '|' + k.code + '|' + c, async () => {
      /* De code HIER consumeren, voor de awaits. Hij stond onderaan, na het
         bijladen en de boeking, en daar zit echte I/O tussen. Twee inningen met
         verschillende idem-sleutels zijn voor metIdem legitiem twee verzoeken --
         alleen deze vlag houdt hergebruik van dezelfde eenmalige code tegen, en
         die hoorde dus aan deze kant van de awaits. Nog een keer kijken is nodig
         omdat de controle hierboven buiten metIdem staat; mislukt het daarna,
         dan geven we de code terug zodat het lid opnieuw kan afrekenen. */
      if (k.gebruikt || k.geldigTot < nu()) return { status: 404, error: 'Deze betaalcode is niet (meer) geldig.' };
      k.gebruikt = true; save();
      const terug = (r) => { k.gebruikt = false; save(); return r; };
      /* Betalen loopt sinds de waardelaag langs ./samen.js: heeft dit lid een
         maaltijdbudget of een gemeentetegoed dat hier geldt, dan gaat dat er
         eerst op en pas daarna zijn eigen geld. Het bijladen zit daarbinnen.
         Heeft hij alleen een wallet -- verreweg het meest -- dan is dit exact
         één boeking, precies zoals het was. */
      const b = await betaalUit({ codenaam: k.codenaam, naar: rekPartner(supplierCode), centen: c,
        genre: genre, oms: oms || 'Kassa', ref: k.code, idem, soort: 'kassa' });
      if (b.error) return terug(b);
      /* De kosten van de betaaldienst gaan DIRECT naar de ondernemer: per
         transactie meteen verrekend op de partnerrekening, als eigen regel in
         het grootboek naast de ontvangst -- geen verzamelfactuur achteraf.
         Het tarief komt uit de geld-regie; het lid merkt er niets van.

         HIER STOND `if (kb.error) kosten = 0;`. Mislukte de boeking, dan werden
         de kosten nul: niet uitgesteld, niet gemeld, niet in een rij. De
         vordering van RTG op de zaak verdween en niemand kon achteraf zien dat
         hij ooit bestond -- het grootboek sloot immers netjes, er was niets
         geboekt. Zie de kop van ../commercie/fee.js.

         Nu wordt de vergoeding VOOR de boekpoging vastgelegd. Lukt de boeking,
         dan is hij GEBOEKT; mislukt hij, dan staat hij op HERKANSING en blijft
         hij verschuldigd. Het bedrag in de teruggave is wat de zaak verschuldigd
         is -- dat verandert niet door een mislukte boeking -- met de stand
         ernaast, zodat de kassa het verschil kan zien. */
      let kosten = 0;
      try { kosten = Math.max(0, Math.round(betaaldienstKosten(c) || 0)); } catch (e) { kosten = 0; }
      let kostenStatus = null;
      if (kosten > 0) {
        const f = fees.incasseer({ supplierCode, centen: kosten, transactieCenten: c, ref: k.code });
        const kb = await boekAsync({ van: rekPartner(supplierCode), naar: 'rtg:betaaldienst', centen: kosten,
          soort: 'betaaldienstkosten', oms: 'Betaaldienstkosten, direct verrekend', ref: k.code });
        if (kb.error) fees.mislukt(f, kb); else fees.geboekt(f, (kb.boeking || {}).id || null);
        kostenStatus = f ? f.status : null;
      }
      /* Meteen apart zetten wat de zaak zelf heeft ingesteld (btw, loonreserve).
         Bewust NA de kosten en bewust zonder de uitkomst te toetsen: het geld is
         binnen, en een mislukte oormerking is een gemiste reservering en geen
         verloren cent. De ontvangst laten mislukken omdat een voornemen niet
         paste, zou de zaak een echte betaling kosten voor een administratief
         detail. */
      let apart = 0;
      try { apart = (ctx.bijOntvangst(supplierCode, c - kosten) || {}).apart || 0; } catch (e) { apart = 0; }
      save();
      seintje(k.codenaam);
      return { ok: true, centen: c, van: k.codenaam, kosten, kostenStatus, apartGezet: apart, delen: b.delen, bijgeladen: b.bijgeladen || 0 };
    }, { geld: 'rekent een tik af tegen een kascode' });
  }

  /* De partnerkant staat in ./partner.js en niet hier: dit bestand ging anders
     over de 10 kB-maat. `fees` gaat MEE in plaats van daar opnieuw te worden
     opgebouwd -- een vergoedingenrij hoort er een te zijn. */
  const partner = require('./partner')(Object.assign({}, ctx, { fees }));

  return Object.assign({ kasCode, kasStand, kasInt }, partner);
};
