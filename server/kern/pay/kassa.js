/* RTG Pay, deelbestand "kassa": de kascode waarmee een lid contactloos afrekent
   bij een partner -- een vooraf-akkoord tot een maximum, zoals contactloos.

   DE PARTNERKANT staat in ./partner.js: het saldo van de zaak, het uitbetalen
   naar de bank, en het pad waarlangs een lid een zaak rechtstreeks betaalt. Dat
   is een andere beweging dan deze: hier geeft een lid een KASSA toestemming, en
   daar betaalt hij zelf. Krijgt de gedeelde ctx van kern/pay/index.js. */
module.exports = (ctx) => {
  const { crypto, save, nu, kascodes, grootboek, rekLid, rekPartner, saldoVan,
    metIdem, boekAsync, zorgSaldo, seintje, betaaldienstKosten, opdrachten,
    MIN_CENTEN, MAX_CENTEN, KASCODE_MS, KASCODE_MAX } = ctx;


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
  async function kasInt({ supplierCode, code, centen, oms, idem }) {
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
      const z = await zorgSaldo({ codenaam: k.codenaam, centen: c, idem });
      if (z.error) return terug(z);
      const b = await boekAsync({ van: rekLid(k.codenaam), naar: rekPartner(supplierCode), centen: c, soort: 'kassa', oms: oms || 'Kassa', ref: k.code });
      if (b.error) return terug(b);
      /* De kosten van de betaaldienst gaan DIRECT naar de ondernemer: per
         transactie meteen verrekend op de partnerrekening, als eigen regel in
         het grootboek naast de ontvangst -- geen verzamelfactuur achteraf.
         Het tarief komt uit de geld-regie; het lid merkt er niets van. */
      let kosten = 0;
      try { kosten = Math.max(0, Math.round(betaaldienstKosten(c) || 0)); } catch (e) { kosten = 0; }
      if (kosten > 0) {
        const kb = await boekAsync({ van: rekPartner(supplierCode), naar: 'rtg:betaaldienst', centen: kosten,
          soort: 'betaaldienstkosten', oms: 'Betaaldienstkosten, direct verrekend', ref: k.code });
        if (kb.error) kosten = 0;
      }
      save();
      seintje(k.codenaam);
      return { ok: true, centen: c, van: k.codenaam, kosten };
    });
  }

  const partner = require('./partner')(ctx);

  return Object.assign({ kasCode, kasInt }, partner);
};
