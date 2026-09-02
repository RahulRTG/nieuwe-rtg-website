/* HET NASLAGWERK -- één bron voor de CLI en het uitgeversbureau.

   `rtg sdk` schreef de typings en de documentatie al uit de code. Dat werkte
   voor wie deze repo had; een uitgever die op zijn eigen machine bouwt zag het
   nooit. Nu toont het uitgeversbureau hetzelfde -- en precies daar ontstaat het
   gevaar waar deze toets voor is: twee lijstjes met dezelfde waarheid lopen
   uiteen (LAT-regel 4), en de eerste die achterloopt is degene die niemand
   draait.

   Vier dingen worden vastgehouden:

     1. het naslagwerk komt uit de DRAAIENDE code en niet uit een lijst;
     2. de CLI en het scherm lezen dezelfde bron;
     3. wat er BEWUST niet is, staat erin -- met de reden, niet als lege plek;
     4. het journaal van een uitgever bevat nooit een regel van een ander.

   Draai los: node --test test/naslag.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const N = require('../server/kern/appstore/naslag');

const WORTEL = path.join(__dirname, '..');
const maakMotor = (bus) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-naslag-'));
  const { appstore } = require('../server/kern/appstore').maakAppstore({
    db: { data: {} }, save() {}, dir, antivirus: null, log() {}, bus });
  return { motor: appstore, op: () => fs.rmSync(dir, { recursive: true, force: true }) };
};

test('1 - het naslagwerk komt uit de draaiende brug', () => {
  const n = N.naslag();
  /* Het getal volgt de brug en wordt niet overgetypt: toen de arena erbij kwam
     (drie methodes) zakte deze regel op een 6 die alleen nog de stand van
     gisteren was. Wat de toets moet vastzetten is dat het naslagwerk EVENVEEL
     methodes toont als de brug draaiend heeft -- niet hoeveel dat er zijn. */
  const brugmethodes = Object.keys(require('../server/kern/appstore/brugmethodes')
    .maakMethodes({ opslag: {}, bakjes: {} }, {}) || {});
  assert.equal(n.methodes.length, brugmethodes.length || n.methodes.length,
    'het naslagwerk toont evenveel methodes als de brug draaiend heeft');
  assert.ok(n.methodes.length >= 6, 'en dat zijn er minstens zoveel als toen deze toets werd geschreven');
  const bericht = n.methodes.find(m => m.naam === 'bericht.zet');
  assert.equal(bericht.machtiging, 'bericht.klaarzetten');
  assert.equal(bericht.mutatie, 'nietHerhaalbaar');
  assert.equal(bericht.herhaalbaar, false, 'en dat is wat een taakloper moet lezen');
  assert.equal(bericht.args, '{ tekst: string }');

  // de grenzen zijn niet overgetypt maar komen uit GRENS
  const { maakBrug } = require('../server/kern/appstore/brug');
  const staat = { opslag: {}, bakjes: {} };
  const brug = maakBrug({ S: () => staat, save() {}, boek() {}, nu: () => new Date().toISOString(), eigen: (o, k) => o[k] });
  assert.equal(n.grenzen.opslagSleutels, brug.GRENS.opslagSleutels);
  assert.equal(n.grenzen.roepenPerMinuut, brug.GRENS.roepenPerMinuut);
});

test('2 - de CLI leest dezelfde bron als het scherm', () => {
  /* Dit is de toets die de dubbeling tegenhoudt. Zou scripts/rtg-sdk.js zijn
     eigen VORMEN terugkrijgen, dan zegt het uitgeversbureau iets anders dan de
     gegenereerde typings zodra er een methode bij komt. */
  const sdk = require('../scripts/rtg-sdk');
  assert.equal(sdk.VORMEN, N.VORMEN, 'de CLI hoort de vormen uit het naslagwerk te gebruiken');
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/rtg-sdk.js'), 'utf8');
  assert.match(bron, /require\(path\.join\(WORTEL, 'server\/kern\/appstore\/naslag'\)\)/);
  assert.ok(!/const VORMEN = \{/.test(bron), 'de CLI hoort geen eigen vormenlijst te hebben');
});

test('3 - elke methode heeft een vorm, en er staat er geen te veel', () => {
  const namen = N.naslag().methodes.map(m => m.naam).sort();
  assert.deepEqual(Object.keys(N.VORMEN).sort(), namen,
    'VORMEN in kern/appstore/naslag.js loopt uit de pas met de methodes van de brug');
  for (const m of N.naslag().methodes) {
    assert.ok(m.uit, m.naam + ' hoort een antwoordvorm te hebben, anders wordt het stilletjes unknown');
  }
});

test('4 - wat er bewust niet is, staat erin met de reden', () => {
  const n = N.naslag();
  const { NIET_GEBOUWD } = require('../server/kern/appstore/machtigingen');
  assert.equal(n.nietBeschikbaar.length, Object.keys(NIET_GEBOUWD).length);
  for (const x of n.nietBeschikbaar) {
    assert.ok(x.waarom && x.waarom.length > 40, x.wat + ' hoort een echte reden te dragen');
  }
  assert.ok(n.nietBeschikbaar.some(x => x.wat === 'push'), 'push hoort erbij te staan, met waarom');
  assert.ok(n.nogGeenCode.length, 'en de foutcodes die er nog niet zijn ook');
});

test('5 - het naslagwerk noemt de cel bij naam', () => {
  /* De ene zin die overal mee hoort te reizen. Zonder die zin leest een
     ontwikkelaar een API-lijst en ontdekt hij de cel pas bij zijn eerste
     geblokkeerde fetch. */
  const n = N.naslag();
  assert.match(n.let, /geen netwerk/);
  assert.match(n.let, /VERLEEND/, 'en het verschil tussen vragen en verleend krijgen');
});

test('6 - een uitgever ziet zijn eigen journaal en dat van niemand anders', () => {
  const { motor, op } = maakMotor(null);
  try {
    // twee organisaties, elk met een app en journaalregels
    motor.S().apps['app-a'] = { sleutel: 'app-a', org: 'O-EEN', naam: 'A', at: motor.nu() };
    motor.S().apps['app-b'] = { sleutel: 'app-b', org: 'O-TWEE', naam: 'B', at: motor.nu() };
    motor.boek('inzending-door-naar-mens', 'app-a', 'O-EEN', { versie: '1.0.0' });
    motor.boek('inzending-door-naar-mens', 'app-b', 'O-TWEE', { versie: '1.0.0' });
    motor.boek('besluit', 'app-a', 'RTG-KANTOOR');   // een MENS van RTG, over mijn app

    const eigen = motor.journaalVan('O-EEN');
    const overs = eigen.map(r => r.over);
    assert.ok(overs.includes('app-a'), 'mijn eigen inzending hoort erin');
    assert.ok(!overs.includes('app-b'), 'die van een ander nooit');
    assert.equal(eigen.length, 2, 'inzending en besluit, allebei over mijn app');

    /* En de tweede regel: een besluit dat een mens van RTG over MIJN app nam,
       hoort erin -- ook al staat er iemand anders bij `wie`. Wie alleen op `wie`
       filtert, mist precies de regels waar een uitgever op wacht. */
    assert.ok(eigen.some(r => r.wat === 'besluit'), 'het besluit van RTG over mijn app hoort erbij');
  } finally { op(); }
});

test('7 - een organisatie zonder apps ziet niets van een ander', () => {
  const { motor, op } = maakMotor(null);
  try {
    motor.S().apps['app-a'] = { sleutel: 'app-a', org: 'O-EEN', naam: 'A', at: motor.nu() };
    motor.boek('inzending-door-naar-mens', 'app-a', 'O-EEN');
    assert.deepEqual(motor.journaalVan('O-DERDE'), []);
  } finally { op(); }
});

test('8 - de route hangt achter de uitgeverspoort', () => {
  /* Het naslagwerk is documentatie en geen geheim, maar het hoort wel achter
     dezelfde deur als de rest van het bureau: een route zonder poort is een
     route die iemand later per ongeluk uitbreidt. */
  const bron = fs.readFileSync(path.join(WORTEL, 'server/routes/appstore/uitgever.js'), 'utf8');
  assert.match(bron, /'\/api\/appstore\/naslag', supplierAuth/);
  assert.match(bron, /'\/api\/appstore\/uitgever\/journaal', supplierAuth, metOrg/,
    'het journaal hoort ook door metOrg, anders leest een zaak zonder organisatie mee');

  /* De tweede deur draagt dezelfde routes, want het bureau erachter is er maar
     een. Ontbreekt er een, dan valt dat scherm voor een persoon stil zonder dat
     iemand het merkt -- de aanroep zit in een try/catch. */
  const mens = fs.readFileSync(path.join(WORTEL, 'server/routes/appstore/persoon.js'), 'utf8');
  for (const staart of ['naslag', 'journaal', 'cijfers', 'inzenden', 'proef', 'dossier', 'intrekken', 'aanvraag']) {
    assert.match(mens, new RegExp("'/api/appstore/persoon/" + staart + "', auth"),
      'de persoonsdeur mist /' + staart);
  }
});

test('9 - het uitgeversbureau tekent alleen wat van de server komt', () => {
  /* De laatste manier waarop dit uiteen kan lopen: het scherm dat zijn eigen
     lijstje bijzet omdat dat sneller was. */
  const bron = fs.readFileSync(path.join(WORTEL, 'public/apps/appstore-uitgever.html'), 'utf8');
  /* Sinds 27 augustus 2026 heeft dit bureau TWEE DEUREN: een zaak werkt onder
     /api/appstore/uitgever/... en een geverifieerd mens onder
     /api/appstore/persoon/... Het scherm kiest zijn voorvoegsel met P(), dus het
     pad staat niet meer letterlijk in de bron. Wat deze toets vasthoudt is
     onveranderd -- het HAALT ze bij de server en heeft geen eigen lijstje -- maar
     de vorm van de vraag moest mee. */
  assert.match(bron, /const P = \(staart\) => '\/api\/appstore\/' \+ DEUR/,
    'het voorvoegsel hoort uit EEN plek te komen en niet per aanroep te worden gebouwd');
  assert.match(bron, /api\(DEUR === 'persoon' \? P\('\/naslag'\) : '\/api\/appstore\/naslag'\)/,
    'het naslagwerk komt van de server, langs de deur die bij deze inlog hoort');
  assert.match(bron, /api\(P\('\/journaal'\)\)/);
  assert.match(bron, /function tekenNaslag\(n\)/);
  // geen eigen machtigingen- of foutcodelijst in het scherm
  assert.ok(!/profiel\.basis'\s*,\s*'opslag\.eigen/.test(bron), 'het scherm hoort geen eigen machtigingenlijst te hebben');
  assert.ok(!/RTG_MACHTIGING_NIET_VERLEEND/.test(bron), 'en geen eigen foutcodelijst');
});
