/* Een bevroren contractprijs wordt een eigen ledenfactuur. De bron is nooit
   de actuele catalogus. Credits zijn geen providerbetalingen. */
'use strict';
const { termijn } = require('../commercie/contract/abonnement');

function factuur(c, t) {
  return { id: t.invoiceId, desc: (t.frequentie === 'jaar' ? 'Jaarbijdrage' : 'Maandbijdrage') + ' lidmaatschap ' + c.pas,
    netto: 0, bijdrage: t.brutoCenten / 100, status: 'open',
    date: 'Vervalt ' + t.van.slice(0, 10), maand: t.van.slice(0, 7),
    btwProfiel: c.btwProfiel, btwOpbouw: t.opbouw,
    abonnement: { contractId: c.id, accountId: c.accountId, termijn: t.nr,
      van: t.van, tot: t.tot, brutoCenten: t.brutoCenten, valuta: 'eur',
      origineelBrutoCenten: t.origineelBrutoCenten, creditCenten: t.creditCenten, aanbodHash: c.aanbod.hash } };
}

module.exports = { termijn, factuur };
