/* ============================================================================
   DE MUTATIECONTRACTEN VAN DEMOCRATIEOS FASE B (kern/democratie/).

   EERST GEMETEN, DAN VERKLAARD. Elke route is in test/democratie.test.js (toets
   9) twee keer met hetzelfde lijf aangeroepen tegen een echte server, en de
   schrijvende routes zijn in test/democratie-verlies.test.js door een storm van
   crashes gehaald.

   Twee soorten herhaling, en ze staan met opzet apart:
   - ECHTE IDEMPOTENTIE: inbrengen (de duplicaatlaag maakt van een dubbeltik een
     kwestie), behandelen (dezelfde stand nog eens schrijft niets), gezien (een
     trede gaat nooit terug) en herbezorgen (een tweede ronde vindt niets);
   - een TOESTANDSCONTROLE: eindstand, heropenen en intrekken weigeren een
     herhaling met 409 en zeggen waarom. Die drie hebben met opzet GEEN
     duplicaatlaag (./idemsleutels-nooit-democratie.js): een afgespeeld succes
     zou verbergen dat een ander de ronde al had afgesloten.

   Alle kantoorwegen hangen aan `officeAuth` en weigeren in de route zonder
   een mens op naam (`boardroomWie`). Dat is een IDENTITEIT en geen bevoegdheid,
   dus de klasse is AUTHENTICATED -- een zwaardere klasse opschrijven dan er
   staat, maakt het register een verlanglijst. */
'use strict';

const OP = '2026-09-25';
const AFGETEKEND = {
  door: 'Claude (Opus 5.5), op grond van test/democratie.test.js en test/democratie-verlies.test.js; ' +
    'niet door een mens nagelezen',
  op: OP
};
const LID = { klasse: 'AUTHENTICATED', deur: 'auth' };
const KANTOOR = { klasse: 'AUTHENTICATED', deur: 'officeAuth' };

const leest = (route, mutatieId, toegang, hoe) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang,
  stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: 'test/democratie.test.js toets 9 (' + OP + '): twee keer 200 en niets veranderd. ' + hoe, op: OP },
  nagekeken: 'de handler roept alleen eigen.kijk() aan, dat een ontbrekende collectie niet aanmaakt',
  afgetekend: AFGETEKEND
}];

const schrijft = (route, mutatieId, toegang, bewijs) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang,
  stand: 'PROTECTED',
  bewijs: { gemeten: bewijs, op: OP },
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  leest('POST /api/member/democratie/kwestie/mijn', 'democratie.mijn', LID,
    'De eigen kwesties, op de sleutel uit de sessie; een ander lid ziet ze niet.'),
  leest('POST /api/office/democratie/kwestie/lijst', 'democratie.lijst', KANTOOR,
    'Alle kwesties zonder inbrengersnummer, voor een kantoormens op naam.'),
  leest('POST /api/office/democratie/meter', 'democratie.meter', KANTOOR,
    'NIEMAND KWIJT: tellingen per stand en de onverklaarde breuken, nooit een percentage.'),

  schrijft('POST /api/member/democratie/kwestie/inbreng', 'democratie.inbreng', LID,
    'Een dubbeltik geeft via de duplicaatlaag (zelfdeVerzoek) een kwestie en niet twee. Onder de ' +
    'crashstorm van test/democratie-verlies.test.js was elke kwestie die een 200 kreeg na herstart terug ' +
    'te vinden; een antwoord dat verloren ging telt niet als geaccepteerd.'),
  schrijft('POST /api/member/democratie/kwestie/gezien', 'democratie.gezien', LID,
    'Twee keer openen geeft twee keer 200 en de trede blijft op gezien: een trede gaat nooit terug.'),
  schrijft('POST /api/office/democratie/kwestie/behandel', 'democratie.behandel', KANTOOR,
    'Dezelfde stand nog eens zetten gaf 200 met herhaling en geen nieuwe tijdlijnregel.'),
  schrijft('POST /api/office/democratie/kwestie/herbezorg', 'democratie.herbezorg', KANTOOR,
    'Een tweede ronde vond geen wek meer om in te halen (toets 6: 1 en daarna 0).'),
  schrijft('POST /api/office/democratie/kwestie/eindstand', 'democratie.sluit', KANTOOR,
    'De tweede oproep met hetzelfde lijf gaf 409 en de eindstand van de eerste bleef byte voor byte ' +
    'gelijk (toets 3). Een toestandscontrole en geen duplicaatlaag: een eindstand verandert niet achteraf.'),
  schrijft('POST /api/office/democratie/kwestie/heropen', 'democratie.heropen', KANTOOR,
    'De tweede oproep gaf 409 zolang de nieuwe ronde loopt; er ontstond geen derde ronde. Een ' +
    'toestandscontrole.'),
  schrijft('POST /api/member/democratie/kwestie/intrek', 'democratie.intrek', LID,
    'Na een eindstand gaf intrekken 409 en bleef de eindstand staan; in een lopende ronde sloot hij de ' +
    'ronde een keer. Een toestandscontrole.')
]);

module.exports = { CONTRACTEN };
