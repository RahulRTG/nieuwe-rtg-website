/* De mutatiecontracten van de Rome-schakels (ronde 2 van het afbouwprogramma,
   11 oktober 2026): het venster in een genootschap, de budgettoets (besluit B2),
   boeken per deelnemer (besluit B3) en het samenstel-voorstel van Rahul.

   Gemeten in test/romeschakels.test.js tegen een echte server. Drie routes
   LEZEN alleen (de toestemmingen, de stand van de delen, het voorstel); de
   andere vijf zetten een stand die bij een tweede oproep gelijk blijft of door
   een standcontrole met de reden wordt geweigerd -- dezelfde afweging als in
   ./mutatiecontracten-reisnazorg.js (MUTATIECONTRACT.md par. 5). */
'use strict';
const OP = '2026-10-11';
const AF = (bron) => ({ door: 'Claude, op grond van ' + bron + '; niet door een mens nagelezen', op: OP });
const TOETS = 'test/romeschakels.test.js';

const leest = (mutatieId, toegang, bestand) => ({
  mutatieId, herkomst: 'mens', semantiek: { klasse: 'idempotent' }, toegang, stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: TOETS + ' (' + OP + '): de wereld voor en na de oproep byte voor byte gelijk ' +
    '(toets 5 voor het voorstel; de stand en de toestemmingen worden in toets 3 en 4 telkens herlezen zonder dat er iets verschuift).', op: OP },
  nagekeken: 'Claude, ' + OP + ': de handler in ' + bestand + ' en de kernfunctie erachter gelezen; geen save(), ' +
    'geen push en geen toewijzing op opgeslagen data',
  afgetekend: AF(TOETS)
});

const CONTRACTEN = {
  'POST /api/genootschap/venster': {
    mutatieId: 'genootschap.bijeenkomst.venster', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'groep' }, stand: 'PROTECTED',
    bewijs: { gemeten: TOETS + ' toets 2 (' + OP + '): twee keer hetzelfde venster gaf twee keer dezelfde bijeenkomst; ' +
      'het venster vervangt het eigen venster van het lid en telt niets op.', op: OP },
    afgetekend: AF(TOETS)
  },
  'POST /api/geld/budgettoets': leest('geld.budgettoets.lijst', { klasse: 'AUTHENTICATED' }, 'server/routes/geld.js'),
  'POST /api/geld/budgettoets/sta': {
    mutatieId: 'geld.budgettoets.toestemming', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'potId' }, stand: 'PROTECTED',
    bewijs: { gemeten: TOETS + ' toets 4 (' + OP + '): twee keer toestemming voor dezelfde pot gaf dezelfde toestemming met ' +
      'dezelfde einddatum, en een lijst van een.', op: OP },
    afgetekend: AF(TOETS)
  },
  'POST /api/reisbureau/deelnemers/klaarzetten': {
    mutatieId: 'reisbureau.deelnemers.klaarzetten', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'reis' }, stand: 'PROTECTED',
    bewijs: { gemeten: TOETS + ' toets 3 (' + OP + '): de eerste oproep boekte de eigen plaats en zette twee delen klaar; ' +
      'de tweede kreeg 409 van de bestaande dubbele-aanvraagrem en liet een deel per deelnemer staan.', op: OP },
    afgetekend: AF(TOETS)
  },
  'POST /api/reisbureau/deelnemers/antwoord': {
    mutatieId: 'reisbureau.deelnemers.antwoord', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'id' }, stand: 'PROTECTED',
    bewijs: { gemeten: TOETS + ' toets 3 (' + OP + '): de eerste ja gaf een eigen aanvraag voor een persoon; de tweede ' +
      'kreeg 409 "Dit deel is al bevestigd." en maakte geen tweede aanvraag. Een ander dan de deelnemer krijgt 404.', op: OP },
    afgetekend: AF(TOETS)
  },
  'POST /api/reisbureau/deelnemers/budget': {
    mutatieId: 'reisbureau.deelnemers.budget', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'id' }, stand: 'PROTECTED',
    bewijs: { gemeten: TOETS + ' toets 4 (' + OP + '): twee keer dezelfde uitkomst delen liet de stand bij de organisator ' +
      'byte voor byte gelijk; zonder toestemming 409 en niets gedeeld.', op: OP },
    afgetekend: AF(TOETS)
  },
  'POST /api/reisbureau/deelnemers/stand': leest('reisbureau.deelnemers.stand', { klasse: 'OBJECT_SCOPED', objectVeld: 'ref' },
    'server/routes/member/reisdeelnemers.js'),
  'POST /api/sociaal/samenstel': leest('sociaal.samenstel', { klasse: 'OBJECT_SCOPED', objectVeld: 'groep' }, 'server/routes/sociaal.js')
};

module.exports = { CONTRACTEN };
