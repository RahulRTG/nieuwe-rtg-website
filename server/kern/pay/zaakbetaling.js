/* RTG Pay, deelbestand "zaakbetaling": een lid rekent af met een zaak.

   WAAROM DIT BESTAAT. Drie betaalpaden in dit huis -- een bestelling
   (kern/lidacties/betalen.js), een lopende rekening (./rekening.js) en een rit
   (./ritten.js) -- zetten `paid = true`, schreven een factuur en stuurden een
   bericht. Er kwam geen pay, geen betaal-naad en geen boeking aan te pas: er
   stond "betaald" op het scherm en er was nooit geld verplaatst. Zolang alles
   binnen dezelfde demo bleef viel dat niet op; zodra een zaak zijn RTG
   Pay-saldo wil uitbetalen, is het het verschil tussen omzet en niets.

   HET IS EEN DRIEHOEK EN GEEN OVERBOEKING, en dat is de reden dat het hier
   woont in plaats van drie keer bij de aanroeper:

     lid            -> zaak    het bedrag dat het lid werkelijk betaalt
     RTG (treasury) -> zaak    wat RTG bijlegt (punten-tegoed, ledenvoordeel)

   De belofte van het huis is dat de ZAAK ALTIJD HET VOLLE BEDRAG ONTVANGT: een
   korting van RTG is een korting van RTG en niet van de ondernemer. Die twee
   boekingen samen zijn dus precies de rekening. Zou de tweede ontbreken, dan
   betaalt de zaak stilletjes mee aan het ledenvoordeel -- en dat is precies de
   belofte die in kern/lidacties/betalen.js met zoveel woorden staat.

   ALLES OF NIETS. Twee boekingen die los kunnen slagen, zijn een manier om een
   zaak te kort te doen. Lukt de tweede niet, dan wordt de eerste met de hand
   teruggedraaid -- dezelfde regel als in kern/bank/walletbrug.js, en om dezelfde
   reden: er is geen transactie over twee boekingen heen.

   WAT DIT NIET DOET: de aanroeper vertellen wat er verder moet gebeuren. Deze
   laag verplaatst geld en niets anders; wie `paid` zet, een factuur schrijft of
   de zaak een bericht stuurt, blijft de aanroeper. Krijgt de gedeelde ctx van
   kern/pay/index.js. */
'use strict';

module.exports = (ctx) => {
  const { schoon, rekLid, rekPartner, saldoVan, metIdem, boekAsync, zorgSaldo, seintje,
    MIN_CENTEN, MAX_CENTEN } = ctx;

  const REK_HUIS = 'extern:treasury';

  /* `centen` is wat het LID betaalt, `bijlageCenten` wat RTG erbovenop legt.
     Allebei in centen, want de aanroepers rekenen in euro's en dat omrekenen
     hoort aan de rand te gebeuren -- niet hier, en niet twee keer. */
  async function betaalZaak({ codenaam, supplierCode, centen, bijlageCenten, soort, oms, ref, idem }) {
    const lid = schoon(codenaam, 40);
    const zaak = schoon(supplierCode, 40);
    if (!lid) return { status: 400, error: 'Van wie komt de betaling?' };
    if (!zaak) return { status: 400, error: 'Aan welke zaak?' };
    const c = Math.round(Number(centen));
    const bij = Math.max(0, Math.round(Number(bijlageCenten) || 0));
    if (!Number.isFinite(c) || c < 0) return { status: 400, error: 'Dat bedrag kan niet.' };
    if (c === 0 && bij === 0) return { ok: true, betaaldCenten: 0, bijgelegdCenten: 0, bijgeladen: 0 };
    /* HET PLAFOND PER BOEKING IS HIER EEN ECHTE GRENS, en hij verdient een
       eigen zin in plaats van "Dat bedrag kan niet" uit het grootboek. Een
       rekening boven de vijfduizend euro bestaat (een diner voor een groep, een
       charter), en dan hoort er te staan wat er aan de hand is in plaats van
       dat de knop het laat afweten. Dit is een bekende grens en geen bug: zie
       TOKEN.md. */
    if (c > MAX_CENTEN || bij > MAX_CENTEN)
      return { status: 400, code: 'boeking-te-groot',
        error: 'Dit bedrag is te groot voor RTG Pay (maximaal ' + Math.round(MAX_CENTEN / 100) + ' euro per betaling).' };

    return metIdem(idem ? 'zaakbetaling:' + lid + ':' + idem : null,
      'zaakbetaling|' + lid + '|' + zaak + '|' + c + '|' + bij, async () => {
        const naar = rekPartner(zaak);
        let bijgeladen = 0;
        let eerste = null;
        if (c > 0) {
          /* EEN knop: schiet het saldo tekort, dan laadt de wallet zelf bij en
             betaalt door -- exact zoals bij een Klompje of de kassa. */
          const z = await zorgSaldo({ codenaam: lid, centen: c, idem });
          if (z.error) return z;
          bijgeladen = z.bijgeladen || 0;
          eerste = await boekAsync({ van: rekLid(lid), naar, centen: c, soort: soort || 'zaak', oms, ref });
          if (eerste.error) return eerste;
        }
        if (bij > 0) {
          const tweede = await boekAsync({ van: REK_HUIS, naar, centen: bij, soort: soort || 'zaak',
            oms: (oms || 'Betaling') + ' (RTG legt bij)', ref });
          if (tweede.error) {
            /* Met de hand terug: er is geen transactie over twee boekingen
               heen. Lukt ook dat niet, dan is dat een storing die luid hoort te
               zijn -- de aanroeper krijgt de oorspronkelijke fout, en het
               grootboek houdt beide regels vast zodat het verschil vindbaar is. */
            if (eerste) await boekAsync({ van: naar, naar: rekLid(lid), centen: c, soort: 'terug',
              oms: 'Betaling teruggedraaid', ref });
            return tweede;
          }
        }
        seintje(lid);
        return { ok: true, betaaldCenten: c, bijgelegdCenten: bij, bijgeladen,
          boeking: eerste && eerste.boeking ? eerste.boeking.id : null, saldo: saldoVan(rekLid(lid)) };
      });
  }

  /* De terugweg. Alleen voor wat via betaalZaak is betaald -- de aanroeper weet
     dat, want die heeft het bedrag bewaard. Het geld gaat terug waar het
     vandaan kwam: het deel van het lid naar de wallet, het deel van RTG naar de
     huisrekening.

     DIT KAN WEIGEREN, en dat is eerlijk. Een partnerrekening kan nooit onder
     nul (de regel van het grootboek), dus een zaak die zijn saldo al heeft
     uitbetaald kan niet terugbetalen. In de praktijk zit daar weinig ruimte --
     annuleren mag alleen zolang de zaak nog niet begonnen is -- maar het kan,
     en dan hoort er te staan wat er aan de hand is in plaats van dat het geld
     stil verdwijnt. */
  async function terugZaak({ codenaam, supplierCode, centen, bijlageCenten, oms, ref, idem }) {
    const lid = schoon(codenaam, 40);
    const zaak = schoon(supplierCode, 40);
    const c = Math.max(0, Math.round(Number(centen) || 0));
    const bij = Math.max(0, Math.round(Number(bijlageCenten) || 0));
    if (!lid || !zaak) return { status: 400, error: 'Terugbetalen kan niet zonder lid en zaak.' };
    if (c === 0 && bij === 0) return { ok: true, terugCenten: 0 };
    const van = rekPartner(zaak);
    if (saldoVan(van) < c + bij)
      return { status: 402, code: 'zaak-te-weinig',
        error: 'De zaak heeft op dit moment te weinig saldo om terug te betalen. Neem contact op met de zaak.' };
    return metIdem(idem ? 'zaakterug:' + lid + ':' + idem : null,
      'zaakterug|' + lid + '|' + zaak + '|' + c + '|' + bij, async () => {
        if (c > 0) {
          const b = await boekAsync({ van, naar: rekLid(lid), centen: c, soort: 'terug', oms: oms || 'Terugbetaald', ref });
          if (b.error) return b;
        }
        if (bij > 0) {
          const t = await boekAsync({ van, naar: REK_HUIS, centen: bij, soort: 'terug',
            oms: (oms || 'Terugbetaald') + ' (bijlage retour)', ref });
          /* Slaagt het lid-deel wel en het RTG-deel niet, dan heeft het lid zijn
             geld terug en houdt de zaak het bijgelegde deel. Dat is een verschil
             in het voordeel van niemand en hoort gemeld te worden, niet stil
             hersteld: het lid is al betaald en dat draaien we niet terug. */
          if (t.error) return { ok: true, terugCenten: c, bijlageOpen: bij, waarschuwing: t.error };
        }
        seintje(lid);
        return { ok: true, terugCenten: c + bij, saldo: saldoVan(rekLid(lid)) };
      });
  }

  return { betaalZaak, terugZaak };
};
