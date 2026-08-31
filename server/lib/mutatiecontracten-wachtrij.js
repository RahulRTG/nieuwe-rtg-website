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

   De vierde is echt beschermd, en om een reden die je in de handler niet ziet
   staan: /api/foundation/les/maak schrijft ELKE keer een verse les met een nieuwe
   code, en wordt tegengehouden door de duplicaatregel `zelfdeVerzoek` in
   ./idemsleutels-kaleronde.js (vak + docentnaam). De bescherming zit dus in de
   laag ervoor en niet in de handler -- en zij is gemeten en niet aangenomen.
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
    'geeft pay.graafVanZaak() terug, en staat in ./idemsleutels-geld.js al als `leest` verklaard'),

  ['POST /api/foundation/les/maak', {
    mutatieId: 'foundation.les.maak', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'PUBLIC',
      waarom: 'een les wordt gemaakt door een begeleider die op dat moment nog niets heeft -- de code en ' +
        'het docenttoken die hij terugkrijgt ZIJN de sleutel. Een inlog eisen zou betekenen dat een ' +
        'gastdocent eerst een account moet hebben; de rem staat op de route en niet op een pas' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: 'kale ronde ZONDER sleutel: de tweede oproep kwam terug met `herhaald: true` -- de ' +
        'duplicaatregel ving haar, terwijl de aanroeper niets deed om dat te vragen',
      op: '2026-08-30'
    },
    nagekeken: 'handler gelezen in server/foundation/onderwijs/les.js: hij maakt ELKE keer een verse les ' +
      'met een nieuwe code en schrijft die weg -- de bescherming zit dus niet in de handler maar in de ' +
      'duplicaatregel `zelfdeVerzoek` (vak + docentnaam) uit ./idemsleutels-kaleronde.js. Een tweede ' +
      'druk op "maak les" levert dezelfde les en geen tweede lokaal',
    afgetekend: AFGETEKEND
  }]
]);

module.exports = CONTRACTEN;
