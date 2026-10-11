/* RTG Pay, deelbestand "partner": alles aan de kant van de ZAAK. Het saldo en
   de bewegingen, het uitbetalen naar de bank (via ./partner-uitbetaal.js), en het pad
   waarlangs een lid een zaak rechtstreeks betaalt.

   Afgesplitst van ./kassa.js, dat over de maat uit keuringsregel 13 ging toen
   partnerIn erbij kwam. De naad is inhoudelijk en niet alleen praktisch: ./kassa
   gaat over de kascode -- de manier waarop een lid een KASSA vooraf toestemming
   geeft -- en dit bestand over wat de zaak zelf met dat geld doet.

   Krijgt de gedeelde ctx van kern/pay/index.js. */
'use strict';

module.exports = (ctx) => {
  const { save, rekLid, rekPartner, saldoVan, metIdem, boekAsync, betaalMetDekking,
    betaaldienstKosten, grootboek, MIN_CENTEN, MAX_CENTEN, fees } = ctx;

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
        const { z, b } = await betaalMetDekking({ codenaam, centen: c, idem, boeking: { van: rekLid(codenaam),
          naar: rekPartner(supplierCode), centen: c, soort: soort || 'verkoop', oms: oms || 'Betaling', ref: ref || null } });
        if (z.error) return z;
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
  /* Uitbetalen naar de bank van de zaak, met de teruggang als de rail hem
     weigert: ./partner-uitbetaal.js. */
  const { partnerUitbetaal } = require('./partner-uitbetaal')(ctx);

  return { partnerIn, partnerOverzicht, partnerUitbetaal };
};
