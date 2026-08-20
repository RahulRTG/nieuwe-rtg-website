/* RTG Pay, deelbestand "kassa": de kassacode (contactloos afrekenen bij de partner,
   vooraf-akkoord tot een maximum zoals contactloos) en de partnerkant (saldo bekijken
   en uitbetalen naar de bank via de betaal-naad). Krijgt de gedeelde ctx van
   kern/pay/index.js. */
module.exports = (ctx) => {
  const { crypto, save, nu, kascodes, grootboek, rekLid, rekPartner, saldoVan,
    metIdem, boekAsync, zorgSaldo, seintje, betaaldienstKosten, opdrachten, db,
    MIN_CENTEN, MAX_CENTEN, KASCODE_MS, KASCODE_MAX } = ctx;

  /* De vergoedingenrij van de betaaldienst: wat is verschuldigd, en is het
     geboekt? Twee verschillende vragen, en tot 20 augustus 2026 was er maar een
     antwoord. Zie ../commercie/fee.js. */
  const fees = require('../commercie/fee').maakFees({ db, save, nu });

  /* De teruggang van de partneruitbetaling: alleen deze kant weet dat het
     pay-grootboek het is en dat de tegenrekening extern:uitbetaald heet. Zie
     ../betaalopdracht/ voor waarom dit een tabel per soort is en geen gedeelde
     functie. */
  opdrachten.registreerTeruggang('pay-uit', async (o) => {
    const terug = await boekAsync({ van: 'extern:uitbetaald', naar: o.bron, centen: o.centen,
      soort: 'terug', oms: 'Uitbetaling niet verstuurd, teruggeboekt', ref: o.ledgerRef });
    return terug;
  });

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
      save();
      seintje(k.codenaam);
      return { ok: true, centen: c, van: k.codenaam, kosten, kostenStatus };
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
      /* Wat er GEBOEKT is staat hierboven; wat er VERSCHULDIGD is en nog niet
         geboekt staat hier. Twee metingen, want ze kunnen uiteenlopen -- en
         precies dat uiteenlopen was vroeger onzichtbaar. */
      kostenOpen: fees.openstaand(supplierCode),
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
         uitbetaling lag al vast terwijl de boeking nog kon weigeren. */
      const b = await boekAsync({ van: rek, naar: 'extern:uitbetaald', centen: c, soort: 'uitbetaling', oms: 'Uitbetaald naar de bank' });
      if (b.error) return b;

      /* HIER STOND EEN COMPENSATIE, EN DIE WAS GEVAARLIJKER DAN HIJ LEEK. Bij een
         fout van de betaal-naad werd de afboeking teruggedraaid en kreeg de
         partner een 502. Dat klopt alleen als de uitbetaling zeker NIET is
         aangemaakt -- en dat weet je bij een timeout juist niet. Slaagde de
         payout bij de provider terwijl het antwoord verloren ging, dan kreeg de
         partner zijn saldo terug terwijl het geld al onderweg was: twee keer
         hetzelfde bedrag, en het grootboek sloot allebei de keren netjes.

         Daarom nu dezelfde rij als de bank: de opdracht wordt vastgelegd, de
         inzending wordt herhaald met DEZELFDE sleutel (dus een geslaagde eerste
         poging wordt bij de provider geen tweede betaling), en pas als de rail
         hem blijft weigeren komt het geld terug. De partner hoort daarom nu
         "in behandeling" en niet "gelukt" -- dat is wat we werkelijk weten. */
      const op = opdrachten.maak({
        soort: 'pay-uit', rail: 'betaalnaad', centen: c, bron: rek, begunstigde: supplierCode,
        oms: 'RTG Pay uitbetaling', ledgerRef: b.boeking.id,
        /* De sleutel hing aan nu(), dus elke poging kreeg er een andere en twee
           klikken waren twee uitbetalingen. Hij hangt nu aan de BOEKING: die is
           er precies een per uitbetaling. */
        idemSleutel: 'pay-uit:' + supplierCode + ':' + (idem || b.boeking.id)
      });
      const na = await opdrachten.dienIn(op);
      return { ok: true, uitbetaald: c, restant: saldoVan(rek), opdrachtId: op.id, opdrachtStatus: na.status };
    });
  }

  return { kasCode, kasInt, partnerOverzicht, partnerUitbetaal, fees };
};
