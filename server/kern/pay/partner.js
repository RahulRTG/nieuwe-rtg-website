/* RTG Pay, deelbestand "partner": alles aan de kant van de ZAAK. Het saldo en
   de bewegingen, het uitbetalen naar de bank via de betaal-naad, en het pad
   waarlangs een lid een zaak rechtstreeks betaalt.

   Afgesplitst van ./kassa.js, dat over de maat uit keuringsregel 13 ging toen
   partnerIn erbij kwam. De naad is inhoudelijk en niet alleen praktisch: ./kassa
   gaat over de kascode -- de manier waarop een lid een KASSA vooraf toestemming
   geeft -- en dit bestand over wat de zaak zelf met dat geld doet.

   Krijgt de gedeelde ctx van kern/pay/index.js. */
'use strict';

module.exports = (ctx) => {
  const { save, rekLid, rekPartner, saldoVan, metIdem, boekAsync, zorgSaldo,
    betaaldienstKosten, opdrachten, grootboek, MIN_CENTEN, MAX_CENTEN, fees } = ctx;

  /* De teruggang van de partneruitbetaling: alleen deze kant weet dat het
     pay-grootboek het is en dat de tegenrekening extern:uitbetaald heet. Zie
     ../betaalopdracht/ voor waarom dit een tabel per soort is en geen gedeelde
     functie. */
  opdrachten.registreerTeruggang('pay-uit', async (o) => {
    const terug = await boekAsync({ van: 'extern:uitbetaald', naar: o.bron, centen: o.centen,
      soort: 'terug', oms: 'Uitbetaling niet verstuurd, teruggeboekt', ref: o.ledgerRef });
    return terug;
  });

  /* ---------- een lid betaalt een zaak rechtstreeks ----------
     Zelfde beweging als aan de kassa (lid -> zaak, met de betaaldienstkosten
     direct verrekend), maar ZONDER kascode. Dat verschil is het hele punt: een
     kascode is de manier waarop een lid een kassa vooraf toestemming geeft tot
     een maximum. Doet het lid de betaling ZELF in zijn eigen app, dan is zijn
     sessie de toestemming en is er niets te autoriseren.

     Waarvoor dit bestaat: de cadeaukaart die een lid in de app koopt
     (routes/member/boeken.js) maakte een kaart met saldo aan en INDE NIETS. De
     zaak kreeg een melding dat er een kaart verkocht was, de fiscale laag zette
     het bedrag als verplichting op zijn balans, en de kaart was aan diezelfde
     kassa in te wisselen -- alleen had niemand ervoor betaald. Dezelfde fout als
     bij de feestmunten, maar met een derde partij erbij die er schade van heeft.

     Let op de kant van de kosten: die gaan van de PARTNER af, precies zoals bij
     kasInt. De zaak ontvangt de kaartwaarde en draagt de transactiekosten, net
     als bij elke andere ontvangst; hier een andere regel maken zou betekenen dat
     dezelfde euro verschillend kost afhankelijk van welke knop hem verstuurde. */
  async function partnerIn({ supplierCode, codenaam, centen, oms, ref, soort, idem }) {
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    if (!supplierCode || !codenaam) return { status: 400, error: 'Van wie, naar welke zaak?' };
    return metIdem(idem ? 'partnerin:' + codenaam + ':' + idem : null,
      'partnerin|' + codenaam + '|' + supplierCode + '|' + c, async () => {
        const z = await zorgSaldo({ codenaam, centen: c, idem });
        if (z.error) return z;
        const b = await boekAsync({ van: rekLid(codenaam), naar: rekPartner(supplierCode), centen: c,
          soort: soort || 'verkoop', oms: oms || 'Betaling', ref: ref || null });
        if (b.error) return b;
        let kosten = 0;
        try { kosten = Math.max(0, Math.round(betaaldienstKosten(c) || 0)); } catch (e) { kosten = 0; }
        if (kosten > 0) {
          const kb = await boekAsync({ van: rekPartner(supplierCode), naar: 'rtg:betaaldienst', centen: kosten,
            soort: 'betaaldienstkosten', oms: 'Betaaldienstkosten, direct verrekend', ref: ref || null });
          if (kb.error) kosten = 0;
        }
        save();
        return { ok: true, centen: c, kosten, bijgeladen: z.bijgeladen };
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
         precies dat uiteenlopen was vroeger onzichtbaar. Zie ../commercie/fee.js. */
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

  return { partnerIn, partnerOverzicht, partnerUitbetaal };
};
