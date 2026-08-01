/* RTG Pay, deelbestand "kassa": de kassacode (contactloos afrekenen bij de partner,
   vooraf-akkoord tot een maximum zoals contactloos) en de partnerkant (saldo bekijken
   en uitbetalen naar de bank via de betaal-naad). Krijgt de gedeelde ctx van
   kern/pay/index.js. */
module.exports = (ctx) => {
  const { crypto, save, betaal, nu, kascodes, grootboek, rekLid, rekPartner, saldoVan,
    metIdem, boekAsync, zorgSaldo, seintje, betaaldienstKosten, MIN_CENTEN, MAX_CENTEN, KASCODE_MS, KASCODE_MAX } = ctx;

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

  /* ---------- de partnerkant: saldo en uitbetalen ---------- */
  function partnerOverzicht(supplierCode) {
    const rek = rekPartner(supplierCode);
    const vandaag = new Date().toISOString().slice(0, 10);
    return {
      ok: true, saldo: saldoVan(rek),
      // de direct verrekende betaaldienstkosten van vandaag, transparant erbij
      kostenVandaag: grootboek().filter(r => r.van === rek && r.soort === 'betaaldienstkosten' && new Date(r.at || 0).toISOString().slice(0, 10) === vandaag)
        .reduce((s, r) => s + r.centen, 0),
      boekingen: grootboek().filter(r => r.van === rek || r.naar === rek).slice(0, 30)
    };
  }
  async function partnerUitbetaal({ supplierCode, idem }) {
    const rek = rekPartner(supplierCode);
    if (saldoVan(rek) <= 0) return { status: 400, error: 'Er staat niets om uit te betalen.' };
    /* Een uitbetaling heeft geen parameters buiten de partner zelf (het gaat
       altijd om het saldo), dus de afdruk is de partner. Het bedrag bewust NIET
       meenemen: dat verschilt legitiem per moment. */
    return metIdem(idem ? 'uit:' + supplierCode + ':' + idem : null, 'uit|' + supplierCode, async () => {
      /* Het saldo PAS hier lezen, en begrensd op de boekingsgrens van het
         grootboek. Twee dingen gingen hier mis en ze versterkten elkaar.

         Het saldo werd buiten metIdem gelezen, dus twee gelijktijdige verzoeken
         lazen allebei het volle bedrag -- de afboeking hieronder had toen nog
         niets gedaan.

         En er was geen bovengrens, terwijl het grootboek er wel een heeft
         (MAX_CENTEN). Bij een partnersaldo boven de EUR 5.000 werd de uitbetaling
         dus eerst bij de betaaldienst vastgelegd en daarna de boeking geweigerd
         met "Dat bedrag kan niet". Het saldo bleef staan, de partner kon NOOIT
         uitbetaald krijgen, en elke nieuwe poging legde er weer een vast. Boven
         de grens betalen we in delen uit; wat overblijft, blijft staan. */
      const c = Math.min(saldoVan(rek), MAX_CENTEN);
      if (c <= 0) return { status: 400, error: 'Er staat niets om uit te betalen.' };
      /* Eerst afboeken, dan pas uitbetalen -- het stond andersom, dus de
         uitbetaling lag al vast terwijl de boeking nog kon weigeren. Lukt de
         uitbetaling niet, dan draaien we de afboeking terug, dezelfde compensatie
         als bank/overboeken.js. */
      const b = await boekAsync({ van: rek, naar: 'extern:uitbetaald', centen: c, soort: 'uitbetaling', oms: 'Uitbetaald naar de bank' });
      if (b.error) return b;
      try {
        await betaal.maakUitbetaling({
          bedrag: c, referentie: 'pay-uit-' + supplierCode + '-' + nu(),
          idempotentieSleutel: idem ? 'pay-uit:' + supplierCode + ':' + idem : undefined,
          begunstigde: supplierCode, omschrijving: 'RTG Pay uitbetaling'
        });
      } catch (e) {
        await boekAsync({ van: 'extern:uitbetaald', naar: rek, centen: c, soort: 'terug', oms: 'Uitbetaling mislukt, teruggeboekt' });
        return { status: 502, error: 'De uitbetaling lukte niet: ' + e.message };
      }
      return { ok: true, uitbetaald: c, restant: saldoVan(rek) };
    });
  }

  return { kasCode, kasInt, partnerOverzicht, partnerUitbetaal };
};
