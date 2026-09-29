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


/* HET DOENETWERK (kern/democratie/doe.js, stap 4). Gemeten in
   test/democratie-doe.test.js toets 10: elke route twee keer met hetzelfde lijf
   tegen een echte server. Die meting vond twee fouten die er bij het lezen
   goed uitzagen -- hetzelfde plan nog eens wiste de antwoorden van anderen, en
   nog eens afgelasten schreef een nieuw tijdstip -- en beide zijn gerepareerd
   voordat dit contract werd geschreven. */
const DOE_OP = '2026-09-28';
const DOE_GETEKEND = { door: 'Claude, op grond van test/democratie-doe.test.js toets 10; niet door een mens nagelezen', op: DOE_OP };
const doeSchrijft = (route, mutatieId, bewijs) => [route, {
  mutatieId, herkomst: 'mens', semantiek: { klasse: 'idempotent' }, toegang: LID, stand: 'PROTECTED',
  bewijs: { gemeten: 'test/democratie-doe.test.js toets 10 (' + DOE_OP + '): ' + bewijs, op: DOE_OP },
  afgetekend: DOE_GETEKEND
}];
const DOE = [
  ['POST /api/member/democratie/actie/lijst', {
    mutatieId: 'democratie.actie.lijst', herkomst: 'mens', semantiek: { klasse: 'idempotent' }, toegang: LID,
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'test/democratie-doe.test.js toets 10 (' + DOE_OP + '): twee keer 200 met een byte voor byte gelijk antwoord.', op: DOE_OP },
    nagekeken: 'de handler roept alleen kijk() aan, dat een ontbrekende collectie niet aanmaakt',
    afgetekend: DOE_GETEKEND }],
  doeSchrijft('POST /api/member/democratie/actie/start', 'democratie.actie.start',
    'de tweede gaf 409 met de id van de actie die al loopt, en er bleef precies een actie. Een toestandscontrole: een kwestie heeft een lopende actie tegelijk.'),
  doeSchrijft('POST /api/member/democratie/actie/aansluit', 'democratie.actie.aansluit',
    'twee keer 200, de tweede met herhaling, en het aantal deelnemers telde niet dubbel.'),
  doeSchrijft('POST /api/member/democratie/actie/plan', 'democratie.actie.plan',
    'twee keer 200; hetzelfde plan nog eens liet de antwoorden staan. Een ANDER plan zet ze met opzet terug.'),
  doeSchrijft('POST /api/member/democratie/actie/antwoord', 'democratie.actie.antwoord',
    'twee keer 200 en een ja telde een keer.'),
  doeSchrijft('POST /api/member/democratie/actie/afgelast', 'democratie.actie.afgelast',
    'twee keer 200 en de afgelasting van de eerste bleef byte voor byte staan.'),
  doeSchrijft('POST /api/member/democratie/actie/verlaat', 'democratie.actie.verlaat',
    'de tweede gaf 403: wie al vertrok, doet niet meer mee. Een toestandscontrole.'),
  doeSchrijft('POST /api/member/democratie/actie/resultaat', 'democratie.actie.resultaat',
    'de tweede gaf 409 en het resultaat van de eerste bleef staan. Een toestandscontrole: een resultaat verandert niet achteraf.'),
  doeSchrijft('POST /api/member/democratie/actie/stop', 'democratie.actie.stop',
    'de tweede gaf 409 en er kwam geen tweede tijdlijnregel. Een toestandscontrole.')
];

const { CONNECTOR } = require('./mutatiecontracten-democratie-connector');

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
    'ronde een keer. Een toestandscontrole.'),
  ...DOE,
  ...CONNECTOR
]);

module.exports = { CONTRACTEN };
