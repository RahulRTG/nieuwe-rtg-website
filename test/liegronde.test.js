/* DE LIEGRONDE -- bewijs 4 (waarheidsgetrouw) per onderdeel uit MAPPEN.

   scripts/liegronde.js draait de liegpoort van test/liegend-scherm.e2e.js over
   elke rij van APPWERKT.json, en scripts/lib/bewijsbron.js neemt de uitslag per
   rij over (ALGEMEEN in scripts/lib/appcontract.js). Dit bestand bewaakt het
   oordeel en de samenstelling, zonder browser.

     1. Alleen een verzonnen zekerheid is een defect. Een JS-fout of rommel op
        het kale antwoord {ok:true} maakt bewijs 4 NIET_GETEST: de eerste ronde
        vond 0 verzonnen zekerheden en 38 schermen die omvielen, en die als
        DEFECT tellen zou een nieuwe betekenis van DEFECT zijn.
     2. Wie niets vroeg, is niet beproefd: nul gelogen antwoorden is NIET_GETEST,
        nooit BEWEZEN. Ook een andere landing of een deur is NIET_GETEST.
     3. De samenstelling neemt de rij over en waardeert nooit op: vervallen,
        onbekende rij en onbekende stand zijn NIET_GETEST.
     4. Een liegronde levert waarheidsgetrouw en niets anders. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { oordeel } = require('../scripts/liegronde');
const B = require('../scripts/lib/bewijsbron');
const { BRONSOORTEN, ALGEMEEN } = require('../scripts/lib/appcontract');

const m = (o) => Object.assign({ pad: '/apps/x.html', landing: '/apps/x.html', deur: null, gelogen: ['POST /api/x'], klachten: [] }, o);

test('1. alleen een verzonnen zekerheid is een defect', () => {
  assert.equal(oordeel(m({ klachten: ['zekerheid zonder gegevens: "Betaald"'] })).status, 'GEBLOKKEERD_DOOR_DEFECT');
  const js = oordeel(m({ klachten: ["JS-fout: Cannot read properties of undefined (reading 'length')"] }));
  assert.equal(js.status, 'NIET_GETEST');
  assert.match(js.reden, /niet vast te stellen/);
  assert.equal(oordeel(m({ klachten: ['rommel in beeld: undefined'] })).status, 'NIET_GETEST');
  assert.equal(oordeel(m({ klachten: ['rommel in beeld: undefined', 'zekerheid zonder gegevens: "Bevestigd"'] })).status,
    'GEBLOKKEERD_DOOR_DEFECT', 'een verzonnen zekerheid naast rommel blijft een defect');
});

test('2. wie niets vroeg, of ergens anders landde, is niet beproefd', () => {
  assert.equal(oordeel(m({ gelogen: [] })).status, 'NIET_GETEST');
  assert.equal(oordeel(m({ landing: '/apps/ander.html' })).status, 'NIET_GETEST');
  assert.equal(oordeel(m({ deur: '#poort.zien' })).status, 'NIET_GETEST');
  assert.match(oordeel(m({ deur: 'html.rtf-school-dicht', klachten: ['JS-fout: geen schoolsessie'] })).reden, /achter een deur/,
    'een deur die zijn script met opzet stopt, is geen omvaller');
  const ok = oordeel(m({}));
  assert.equal(ok.status, 'BEWEZEN');
  assert.match(ok.reden, /LEEG antwoord/, 'de grens hoort in elke uitslag te staan');
});

const REG = (regels, stempel = { commit: 'abc', op: 'x' }) => JSON.stringify({ stempel, regels });
const vers = () => ({ vers: true, reden: 'vers' });

test('3. de samenstelling neemt de rij over en waardeert nooit op', () => {
  const lees = (tekst) => () => tekst;
  const regels = [{ functie: 'link:a', status: 'BEWEZEN', reden: 'r' }, { functie: 'link:b', status: 'GEBLOKKEERD_DOOR_DEFECT', reden: 'z' },
    { functie: 'link:c', status: 'PASS', reden: 'q' }];
  assert.equal(B.rondeUitslag('L.json', 'link:a', { lees: lees(REG(regels)), versheid: vers }).status, 'BEWEZEN');
  assert.equal(B.rondeUitslag('L.json', 'link:b', { lees: lees(REG(regels)), versheid: vers }).status, 'GEBLOKKEERD_DOOR_DEFECT');
  assert.equal(B.rondeUitslag('L.json', 'link:c', { lees: lees(REG(regels)), versheid: vers }).status, 'NIET_GETEST', 'een onbekende stand wordt geen uitslag');
  assert.equal(B.rondeUitslag('L.json', 'link:z', { lees: lees(REG(regels)), versheid: vers }).status, 'NIET_GETEST');
  assert.equal(B.rondeUitslag('L.json', 'link:a', { lees: lees(REG(regels)), versheid: () => ({ vers: false, reden: 'oud' }) }).status, 'NIET_GETEST');
  assert.equal(B.rondeUitslag('L.json', 'link:a', { lees: lees(REG(regels, '2026-09-24')), versheid: vers }).status, 'NIET_GETEST', 'een kale datum is geen stempel');
  assert.equal(B.rondeUitslag('L.json', 'link:a', { lees: () => null, versheid: vers }).status, 'NIET_GETEST');
});

test('4. een liegronde levert waarheidsgetrouw en niets anders', () => {
  assert.deepEqual(BRONSOORTEN.liegronde, ['waarheidsgetrouw']);
  assert.deepEqual(Object.keys(ALGEMEEN), ['waarheidsgetrouw']);
  assert.throws(() => B.bewijsVoor('link:a', 'menselijk', '/apps/a.html',
    { contract: {}, algemeen: { menselijk: { soort: 'liegronde', register: 'L.json', instrument: 'x' } }, versheid: vers }), /mag geen menselijk/);
  const r = { functie: 'link:a', ingang: '/apps/a.html', bewijzen: {} };
  const regels = [{ functie: 'link:a', status: 'BEWEZEN', reden: 'r' }];
  B.stelSamen(r, { contract: {}, lees: () => REG(regels), versheid: vers });
  assert.equal(r.bewijzen.waarheidsgetrouw.status, 'BEWEZEN');
  assert.deepEqual(Object.keys(r.bewijzen), ['waarheidsgetrouw'], 'de ronde raakt geen ander bewijs');
});

test('5. het echte register spreekt zichzelf niet tegen', () => {
  const reg = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'LIEGRONDE.json'), 'utf8'));
  assert.ok(reg.stempel && reg.stempel.commit, 'LIEGRONDE.json draagt geen stempel met commit');
  assert.ok(reg.regels.length >= 100, 'LIEGRONDE.json draagt te weinig rijen om over MAPPEN te gaan');
  for (const r of reg.regels) {
    if (r.status === 'BEWEZEN') assert.ok(r.gelogen > 0, r.functie + ': BEWEZEN zonder een gelogen antwoord');
    if (r.status === 'GEBLOKKEERD_DOOR_DEFECT') assert.ok((r.klachten || []).some((k) => /^zekerheid zonder gegevens/.test(k)), r.functie + ': DEFECT zonder verzonnen zekerheid');
  }
});
