/* RTG Pay, deelbestand "kassa": de kassacode (contactloos afrekenen bij de partner,
   vooraf-akkoord tot een maximum zoals contactloos) en de partnerkant (saldo bekijken
   en uitbetalen naar de bank via de betaal-naad). Krijgt de gedeelde ctx van
   kern/pay/index.js. */
module.exports = (ctx) => {
  const { crypto, save, betaal, nu, kascodes, grootboek, rekLid, rekPartner, saldoVan,
    metIdem, boek, zorgSaldo, seintje, betaaldienstKosten, MIN_CENTEN, KASCODE_MS, KASCODE_MAX } = ctx;

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
    return metIdem(idem ? 'kas:' + supplierCode + ':' + idem : null, async () => {
      const z = await zorgSaldo({ codenaam: k.codenaam, centen: c, idem });
      if (z.error) return z;
      const b = boek({ van: rekLid(k.codenaam), naar: rekPartner(supplierCode), centen: c, soort: 'kassa', oms: oms || 'Kassa', ref: k.code });
      if (b.error) return b;
      /* De kosten van de betaaldienst gaan DIRECT naar de ondernemer: per
         transactie meteen verrekend op de partnerrekening, als eigen regel in
         het grootboek naast de ontvangst -- geen verzamelfactuur achteraf.
         Het tarief komt uit de geld-regie; het lid merkt er niets van. */
      let kosten = 0;
      try { kosten = Math.max(0, Math.round(betaaldienstKosten(c) || 0)); } catch (e) { kosten = 0; }
      if (kosten > 0) {
        const kb = boek({ van: rekPartner(supplierCode), naar: 'rtg:betaaldienst', centen: kosten,
          soort: 'betaaldienstkosten', oms: 'Betaaldienstkosten, direct verrekend', ref: k.code });
        if (kb.error) kosten = 0;
      }
      k.gebruikt = true;
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
    const c = saldoVan(rek);
    if (c <= 0) return { status: 400, error: 'Er staat niets om uit te betalen.' };
    return metIdem(idem ? 'uit:' + supplierCode + ':' + idem : null, async () => {
      try {
        await betaal.maakUitbetaling({
          bedrag: c, referentie: 'pay-uit-' + supplierCode + '-' + nu(),
          idempotentieSleutel: idem ? 'pay-uit:' + supplierCode + ':' + idem : undefined,
          begunstigde: supplierCode, omschrijving: 'RTG Pay uitbetaling'
        });
      } catch (e) { return { status: 502, error: 'De uitbetaling lukte niet: ' + e.message }; }
      const b = boek({ van: rek, naar: 'extern:uitbetaald', centen: c, soort: 'uitbetaling', oms: 'Uitbetaald naar de bank' });
      if (b.error) return b;
      return { ok: true, uitbetaald: c };
    });
  }

  return { kasCode, kasInt, partnerOverzicht, partnerUitbetaal };
};
