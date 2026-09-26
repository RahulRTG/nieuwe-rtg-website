/* HET APP-CONTRACT EN DE BEWIJSBRON -- een app mag bewijs samenstellen uit een
   proef die al bestaat, en alleen als die proef het op deze code verdient.

   Wat dit bestand bewaakt, en elke regel kan zakken:

     1. Het contract is een VERKLARING en geen uitslag: er staat nergens een
        stand in (BEWEZEN, PASS). Wie PASS schrijft, maakt van een register
        administratie -- de machine verdient het, of het staat er niet.
     2. Alleen de acht bewijzen uit BETROUWBAARHEID.md, en alleen de bewijzen
        die een bronsoort mag leveren. Een ketenproef levert voltooibaar en
        niets anders; herstelbaar laten tellen op dubbele tikken zou het
        verkeerde experiment met een geldige uitslag zijn.
     3. Elke koppeling in het contract haalt de meting: de proef raakt routes
        die de ingang van de app werkelijk aanroept, en de app staat in MAPPEN.
     4. De vier uitkomsten van de bron, elk met een tegenproef: vers en dicht is
        BEWEZEN, vers en open is DEFECT, verouderd is NIET_GETEST (nooit DEFECT
        -- er is niets gemeten dat stuk was), en een kale datum is geen stempel.
     5. De telling kan de schakels niet overstemmen.
     6. Een voorvoegsel als `/api/` maakt geen koppeling (zo leken Stad en
        Betalen op alle zeven ketens te landen). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { BEWIJZEN, BRONSOORTEN, CONTRACT, ZONDER_APP } = require('../scripts/lib/appcontract');
const B = require('../scripts/lib/bewijsbron');
const reg = require('../scripts/lib/wereldregister');

const WORTEL = path.join(__dirname, '..');

const VERS = () => ({ vers: true, reden: 'gemeten op de huidige commit' });
const OUD = () => ({ vers: false, reden: 'sindsdien zijn 3 codebestand(en) gewijzigd' });
const STEMPEL = { op: '2026-09-24T10:00:00.000Z', commit: 'abc1234', boomVuil: false, instrument: 'scripts/x.js' };

function registerMet(inhoud) {
  const tekst = JSON.stringify(inhoud);
  return (rel) => (rel === 'X.json' ? tekst : null);
}
const dicht = { stempel: STEMPEL, sluit: true, telling: { stuk: 0, gebroken: 0 },
  schakels: [{ nr: 1, stand: 'gesloten', wat: 'a' }, { nr: 2, stand: 'gesloten', wat: 'b' }],
  storingen: [{ stand: 'gehouden', wat: 'dubbel' }] };

test('1. het contract draagt geen uitslag', () => {
  const tekst = fs.readFileSync(path.join(WORTEL, 'scripts', 'lib', 'appcontract.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const stand of ['BEWEZEN', 'PASS', 'GEBLOKKEERD_DOOR_DEFECT', 'NIET_GETEST']) {
    assert.ok(!tekst.includes(stand), 'het contract noemt "' + stand + '": een contract zegt welke bron mag, nooit wat hij opleverde');
  }
});

test('2. alleen de acht bewijzen, en alleen wat de bronsoort mag leveren', () => {
  const appwerkt = fs.readFileSync(path.join(WORTEL, 'scripts', 'appwerkt.js'), 'utf8');
  for (const b of BEWIJZEN) assert.ok(appwerkt.includes(b), b + ' staat niet in scripts/appwerkt.js');
  assert.equal(BEWIJZEN.length, 8, 'acht bewijzen, geen negende');
  assert.deepEqual(BRONSOORTEN.ketenproef, ['voltooibaar'], 'een ketenproef levert alleen voltooibaar');
  for (const [functie, c] of Object.entries(CONTRACT)) {
    assert.ok(typeof c.belofte === 'string' && c.belofte.length > 20, functie + ': de belofte in woorden ontbreekt');
    for (const [naam, bron] of Object.entries(c)) {
      if (naam === 'belofte') continue;
      assert.ok(BEWIJZEN.includes(naam), functie + ': "' + naam + '" is geen bewijs');
      assert.ok((BRONSOORTEN[bron.soort] || []).includes(naam), functie + ': een ' + bron.soort + ' mag geen ' + naam + ' leveren');
    }
  }
  /* Tegenproef: een ketenproef die herstelbaar wil leveren, wordt geweigerd. */
  const vals = { 'link:x': { belofte: 'een belofte die lang genoeg is om te tellen', herstelbaar: { soort: 'ketenproef', register: 'X.json', instrument: 'scripts/x.js' } } };
  assert.throws(() => B.bewijsVoor('link:x', 'herstelbaar', '/apps/x.html', { contract: vals }), /mag geen herstelbaar/);
});

test('3. elke koppeling haalt de meting: de app staat in MAPPEN en de proef raakt zijn ingang', () => {
  assert.ok(Object.keys(CONTRACT).length >= 1, 'een leeg contract bewijst niets over de koppeling');
  for (const [functie, c] of Object.entries(CONTRACT)) {
    const i = functie.indexOf(':');
    const bron = functie.slice(0, i) === 'link' ? reg.LINKS[functie.slice(i + 1)] : reg.OSAPPS[functie.slice(i + 1)];
    assert.ok(bron && bron.url, functie + ' staat niet (met een adres) in MAPPEN');
    for (const [naam, b] of Object.entries(c)) {
      if (naam === 'belofte') continue;
      assert.ok(fs.existsSync(path.join(WORTEL, b.instrument)), b.instrument + ' bestaat niet');
      const proef = B.proefRoutes(b.instrument);
      const ing = B.ingangRoutes(bron.url);
      const raak = B.gedeeld(proef, ing);
      assert.ok(raak.length > 0, functie + ': ' + b.instrument + ' raakt geen route van ' + bron.url);
    }
  }
  for (const z of ZONDER_APP) assert.ok(z.reden && z.nodig, 'een keten zonder app draagt zijn reden en wat er nodig is');
});

test('4a. vers en dicht is BEWEZEN', () => {
  const u = B.ketenUitslag('X.json', { lees: registerMet(dicht), versheid: VERS });
  assert.equal(u.status, 'BEWEZEN');
  assert.equal(u.bewijs.commit, 'abc1234');
});

test('4b. vers met een open schakel is DEFECT, en noemt de schakel', () => {
  const open = JSON.parse(JSON.stringify(dicht));
  open.schakels[1].stand = 'open';
  const u = B.ketenUitslag('X.json', { lees: registerMet(open), versheid: VERS });
  assert.equal(u.status, 'GEBLOKKEERD_DOOR_DEFECT');
  assert.match(u.reden, /schakel 2 staat open/);
  const gebroken = JSON.parse(JSON.stringify(dicht));
  gebroken.storingen[0].stand = 'gebroken';
  assert.equal(B.ketenUitslag('X.json', { lees: registerMet(gebroken), versheid: VERS }).status, 'GEBLOKKEERD_DOOR_DEFECT');
});

test('4c. verouderd is NIET_GETEST, ook als de keten toen open stond', () => {
  const open = JSON.parse(JSON.stringify(dicht));
  open.schakels[0].stand = 'stuk';
  for (const r of [dicht, open]) {
    const u = B.ketenUitslag('X.json', { lees: registerMet(r), versheid: OUD });
    assert.equal(u.status, 'NIET_GETEST', 'oud bewijs is geen bewijs, ook geen bewijs van een defect');
    assert.match(u.reden, /vervallen/);
  }
});

test('4d. een kale datum, geen stempel of geen register is NIET_GETEST', () => {
  let gevraagd = false;
  const spion = () => { gevraagd = true; return { vers: true, reden: '' }; };
  const datum = Object.assign({}, dicht, { stempel: '2026-09-19' });
  const u = B.ketenUitslag('X.json', { lees: registerMet(datum), versheid: spion });
  assert.equal(u.status, 'NIET_GETEST');
  assert.equal(gevraagd, false, 'een datum hoort versheid niet eens te bereiken: er is geen commit om te vergelijken');
  const zonder = Object.assign({}, dicht); delete zonder.stempel;
  assert.equal(B.ketenUitslag('X.json', { lees: registerMet(zonder), versheid: spion }).status, 'NIET_GETEST');
  assert.equal(B.ketenUitslag('Y.json', { lees: registerMet(dicht), versheid: VERS }).status, 'NIET_GETEST');
});

test('5. de telling kan de schakels niet overstemmen', () => {
  const liegt = JSON.parse(JSON.stringify(dicht));
  liegt.schakels[0].stand = 'open';
  liegt.telling = { schakels: 2, gesloten: 2, open: 0, stuk: 0, gebroken: 0 };
  assert.equal(B.ketenUitslag('X.json', { lees: registerMet(liegt), versheid: VERS }).status, 'GEBLOKKEERD_DOOR_DEFECT');
  const leeg = Object.assign({}, dicht, { schakels: [] });
  assert.equal(B.ketenUitslag('X.json', { lees: registerMet(leeg), versheid: VERS }).status, 'NIET_GETEST',
    'geen schakels is geen gesloten keten');
});

test('6. een breed voorvoegsel maakt geen koppeling', () => {
  assert.equal(B.smalVoorvoegsel('/api/'), false);
  assert.equal(B.smalVoorvoegsel('/api/rtf/'), false);
  assert.equal(B.smalVoorvoegsel('/api/supplier/horeca/'), true);
  const ing = { exact: new Set(), voor: new Set(['/api/supplier/horeca/']) };
  assert.deepEqual(B.gedeeld(new Set(['/api/supplier/horeca/gang/vrij', '/api/ride/pay']), ing), ['/api/supplier/horeca/gang/vrij']);
  /* En via de echte ingangslezer: een scherm dat alleen `/api/` draagt, raakt niets. */
  const sr = { perScherm: [{ bestand: 'public/apps/breed.html', exact: [], voorvoegsels: ['/api/'] }] };
  const lees = (rel) => (rel === 'public/apps/breed.html' ? '<html></html>' : null);
  const breed = B.ingangRoutes('/apps/breed.html', { lees, schermroutes: sr });
  assert.deepEqual(B.gedeeld(new Set(['/api/ride/pay']), breed), []);
});

test('7. een koppeling die de meting niet haalt, telt niet -- ook met een vers register', () => {
  const contract = { 'link:x': { belofte: 'een belofte die lang genoeg is om te tellen',
    voltooibaar: { soort: 'ketenproef', register: 'X.json', instrument: 'scripts/x.js' } } };
  const bestanden = { 'X.json': JSON.stringify(dicht), 'scripts/x.js': "roep('/api/ride/pay')", 'public/apps/x.html': '<html></html>' };
  const lees = (rel) => (rel in bestanden ? bestanden[rel] : null);
  const sr = { perScherm: [{ bestand: 'public/apps/x.html', exact: ['/api/iets/anders'], voorvoegsels: [] }] };
  const u = B.bewijsVoor('link:x', 'voltooibaar', '/apps/x.html', { contract, lees, schermroutes: sr, versheid: VERS });
  assert.equal(u.status, 'NIET_GETEST');
  assert.match(u.reden, /raakt geen enkele route/);
  /* Tegenproef: dezelfde opstelling met een gedeelde route is BEWEZEN. */
  sr.perScherm[0].exact.push('/api/ride/pay');
  assert.equal(B.bewijsVoor('link:x', 'voltooibaar', '/apps/x.html', { contract, lees, schermroutes: sr, versheid: VERS }).status, 'BEWEZEN');
});

test('8. stelSamen raakt alleen wat het contract noemt', () => {
  const r = { functie: 'link:bestaat-niet', ingang: '/apps/niets.html',
    bewijzen: { voltooibaar: { status: 'GEEN_FIXTURE', reden: 'x', bewijs: null } } };
  /* Met lege contract- en algemene lijsten: een algemene bron (ALGEMEEN) raakt
     elke rij, en die heeft zijn eigen toets in test/liegronde.test.js. */
  assert.deepEqual(B.stelSamen(r, { contract: {}, algemeen: {} }), []);
  assert.equal(r.bewijzen.voltooibaar.status, 'GEEN_FIXTURE');
});
