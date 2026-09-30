/* ============================================================================
   MUTATIECONTRACTEN -- DE VIER DIE `beschermd` MATEN EN HET NIET ALLEMAAL ZIJN.

   Deel van ./mutatiecontracten.js.

   Deze vier kwamen uit de kale ronde met twee keer `beschermd`, en de meter
   stelde voor ze alle vier op PROTECTED te zetten. Bij drie ervan stond in de
   grond zelf de waarschuwing die dat verhindert: "het verschil zat in wacht --
   NA TE KIJKEN: is dat werk van deze route, of een rem/meter die meebeweegt?"

   Het is dat laatste. De handlers zijn gelezen, en dat leverde een AFWIJKING van
   het voorstel op (besluit van de eigenaar, 30 augustus 2026: waar mijn lezing
   van het voorstel afwijkt, volgt de lezing en wordt de afwijking opgeschreven).

   PROTECTED beweert iets over GEDRAG: een herhaling doet het werk niet nog een
   keer. Bij een route die helemaal geen werk DOET is die bewering niet waar maar
   leeg -- en een leeg PROTECTED is precies de schijnzekerheid waar dit hele
   register tegen is aangelegd. Drie van de vier zijn lezers; die horen op
   NOT_APPLICABLE, met dezelfde grond als de zevenendertig in
   ./mutatiecontracten-leest.js.

   Wat de opslagmeter dan wel zag: `wacht` is de wachtrij van de AI-laag en de
   rem, en die groeit van het KIJKEN. Dat is geen werk van de route. Een meter
   die de rem meetelt, verklaart elke bevraagde lezer tot schrijver.

   De vierde (/api/foundation/les/maak) stond hier als PROTECTED, beschermd door
   de duplicaatregel `zelfdeVerzoek` -- die het antwoord HERHAALDE, lescode en
   leraarssleutel incluis. Sinds de lescredentials hash-only zijn (29 september
   2026, B17) mag dat niet meer; de route staat nu in ./mutatiecontracten-lesfamilie.js.
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van de gelezen handler; wijkt bewust af van het voorstel van de ' +
    'meter en zegt hieronder waarom; niet door een mens nagelezen',
  op: '2026-08-30'
};

/* Een lezer die de meter voor een schrijver aanzag. */
const lezer = (route, mutatieId, bestand, wat) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' },
  stand: 'NOT_APPLICABLE',
  bewijs: {
    gemeten: 'kale ronde: twee geslaagde oproepen, en het enige verschil in de opslag zat in `wacht` -- ' +
      'de wachtrij van de AI-laag en de rem, die van het KIJKEN groeit',
    op: '2026-08-30'
  },
  nagekeken: 'handler gelezen in ' + bestand + ': ' + wat + ' -- geen schrijfvorm naar eigen staat. Het ' +
    'voorstel van de meter (PROTECTED) is daarom NIET gevolgd: PROTECTED doet een uitspraak over gedrag ' +
    'bij een herhaling, en een route die geen werk doet heeft dat gedrag niet',
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  lezer('POST /api/supplier/accountant/adviezen', 'supplier.accountant.adviezen',
    'server/routes/supplier/financien.js',
    'leest de maandcijfers, rekent de adviezen deterministisch uit en vraagt de AI hooguit om een inleiding'),
  lezer('POST /api/supplier/horeca/arrivals', 'supplier.horeca.arrivals',
    'server/routes/supplier/horeca/invisible-arrival.js',
    'filtert en sorteert de aankomsten van de zaak en geeft ze terug'),
  lezer('POST /api/supplier/pay/graaf', 'supplier.pay.graaf',
    'server/routes/pay-zaak.js',
    'geeft pay.graafVanZaak() terug, en staat in ./idemsleutels-geld.js al als `leest` verklaard')
]);

module.exports = CONTRACTEN;
