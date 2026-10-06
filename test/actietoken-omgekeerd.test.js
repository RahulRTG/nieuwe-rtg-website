/* B-1, onafhankelijke aanval (derde ronde): de OMGEKEERDE richting en de zijdeuren.
   De eerdere toetsen bewijzen dat een actietoken geen sessie is. Hier: een
   sessietoken is geen actietoken (voor elk echt doel), en de lezers naast
   verifyToken (sessieVan, apparaatVanToken) lezen uit een actietoken geen
   sessie-id of toestel. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-omgekeerd-'));
process.env.RTG_DATA_DIR = TMP;
process.env.NODE_ENV = 'test';
process.env.RTG_MAGNAAT_TEST = '1';
const T = require('../server/accounts');
T.init();
test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
let UID;
test.before(async () => { UID = (await T.createUser({ email: 'omgekeerd@voorbeeld.test', password: 'geheim12', tier: 'rtg', realName: 'Omgekeerd Test' })).id; });
const DOELEN = ['inlog2', 'verify-email', 'mailwissel', 'sso-overdracht'];

test('een sessietoken is voor geen enkel doel een actietoken', () => {
  const sessie = T.issueToken(UID, 1, 'ab12');
  assert.ok(T.verifyToken(sessie), 'controle: het sessietoken zelf is geldig');
  for (const d of DOELEN) assert.equal(T.verifyActionToken(sessie, d), null, d);
});

test('een actietoken geeft geen sessie-id en geen apparaat', () => {
  for (const d of DOELEN) {
    const a = T.issueActionToken(UID, d, 60000);
    assert.equal(T.verifyActionToken(a, d)?.id, UID, 'controle: ' + d + ' werkt voor zijn eigen doel');
    assert.equal(T.verifyToken(a), null, d);
    assert.equal(T.sessieVan(a), null, d + ' sessieVan');
    assert.equal(T.apparaatVanToken(a), null, d + ' apparaat');
  }
});

test('een actietoken geldt niet voor een ander doel', () => {
  const a = T.issueActionToken(UID, 'verify-email', 60000);
  for (const d of DOELEN.filter((x) => x !== 'verify-email')) assert.equal(T.verifyActionToken(a, d), null, d);
});

test('een doel dat op een tijdveld lijkt wordt niet uitgegeven', () => {
  for (const d of ['1799999999999', 'a.b', '', 'A', '-x', 'x'.repeat(41)]) {
    assert.throws(() => T.issueActionToken(UID, d, 60000), /ongeldig doel/, JSON.stringify(d));
  }
});
