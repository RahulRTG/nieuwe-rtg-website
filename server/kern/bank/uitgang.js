/* RTG Bank, deel "uitgang": waar geld het huis ECHT verlaat. Dit is de plek waar
   de bank aan een rail hangt -- vandaag de kaart-naad van server/betaal.js -- en
   het is bewust een eigen bestand: de rest van de bank boekt, hier wordt er
   verstuurd, en dat zijn twee gebeurtenissen die los van elkaar mislukken.

   Wat hier woont is de bedrading van ../betaalopdracht.js: hoe je een opdracht
   bij de rail aanbiedt, en hoe je hem terugdraait als de rail hem blijft
   weigeren. De opdrachtmodule zelf kent geen enkele rail; dat moet zo blijven,
   want de volgende rail (een eigen SEPA-verbinding, een andere provider) hoort
   hier te landen en niet daar.

   De teruggang is met opzet PER SOORT. Een teruggeboeking moet naar dezelfde
   tegenrekening als waar het geld heen ging, en dat weet alleen wie de opdracht
   maakte. Een onbekend soort krijgt daarom een weigering en geen gok -- anders
   boekt een volgende rail zijn mislukking stil naar de verkeerde kant, en dat
   is precies het soort stilte waar deze hele naad voor is gebouwd. */
'use strict';

module.exports = (ctx) => {
  const { d, save, crypto, nu, betaal, boekAsync, rekMeta, seintje } = ctx;

  return require('../betaalopdracht')({
    d, save, crypto, nu,

    // aanbieden bij de rail: dezelfde sleutel bij elke poging, zodat een
    // herhaling bij de provider nooit een tweede betaling wordt
    railInzenden: (o) => betaal.maakUitbetaling({
      bedrag: o.centen, valuta: o.valuta, iban: o.bestemming, begunstigde: o.begunstigde,
      referentie: o.ledgerRef, idempotentieSleutel: o.idemSleutel, omschrijving: o.oms
    }),

    terugboeken: async (o) => {
      if (o.soort !== 'sepa-uit') return { error: 'Voor soort "' + o.soort + '" is hier geen teruggang ingesteld.' };
      const terug = await boekAsync({ van: 'extern:sepa', naar: o.bron, centen: o.centen, soort: 'sepa-terug', oms: 'SEPA niet verstuurd, teruggeboekt', ref: o.ledgerRef });
      if (terug.error) return terug;
      // het tarief hoort ook terug: er is geen dienst geleverd
      if (o.tariefCenten > 0) {
        const t = await boekAsync({ van: 'rtg:reserve', naar: o.bron, centen: o.tariefCenten, soort: 'tarief-terug', oms: 'SEPA-tarief teruggeboekt', ref: o.ledgerRef });
        if (t.error) return t;
      }
      const m = rekMeta(o.bron);
      if (m) seintje(m.codenaam);
      return terug;
    }
  });
};
