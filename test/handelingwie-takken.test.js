/* WIE HANDELT ER, EN WAT IS DE AFDRUK? -- server/lib/handelingwie.js tak voor tak.

   Toetst de afdruk van een verzoeklijf (gesorteerd, zonder idem-sleutel en
   vrije tekst, en leeg als het lijf niet te lezen is), de WIE-regel (de
   sessiesleutel, anders een eerlijke categorie en nooit een verzonnen naam),
   en de regelbouwer: een burgerpad krijgt alleen de dag, geen afdruk en geen
   verzoek-id; de release staat er alleen in als hij bekend is. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const hw = require('../server/lib/handelingwie');
const burger = require('../server/lib/burgerpad');
const releaseidentiteit = require('../server/lib/releaseidentiteit');

const LEEG = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-handelingwie-'));
test.after(() => {
  releaseidentiteit.release({ vers: true });   // de gedeelde cache terug naar de echte stand
  fs.rmSync(LEEG, { recursive: true, force: true });
});

const verwacht = obj => crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 16);

test('afdrukVan: geen object is geen afdruk', () => {
  for (const b of [null, undefined, '', 'tekst', 42, true]) assert.equal(hw.afdrukVan(b), '', String(b));
});

test('afdrukVan: gesorteerde sleutels, en idem-sleutel en vrije tekst tellen niet mee', () => {
  const a = hw.afdrukVan({ b: 2, a: 1, idem: 'k1', notitie: 'hoi', omschrijving: 'x', oms: 'y', toelichting: 'z', idempotentieSleutel: 'q' });
  assert.equal(a, verwacht({ a: 1, b: 2 }));
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(hw.afdrukVan({ a: 1, b: 2 }), a, 'dezelfde handeling, dezelfde afdruk');
  assert.notEqual(hw.afdrukVan({ a: 1, b: 3 }), a);
  assert.equal(hw.afdrukVan({}), verwacht({}));
  for (const k of ['idem', 'idempotentieSleutel', 'notitie', 'omschrijving', 'oms', 'toelichting'])
    assert.equal(hw.BUITEN_AFDRUK.has(k), true, k);
});

test('afdrukVan: een lijf dat niet te serialiseren is geeft een lege afdruk in plaats van een fout', () => {
  assert.equal(hw.afdrukVan({ bedrag: 10n }), '');
  const rond = {}; rond.zelf = rond;
  assert.equal(hw.afdrukVan(rond), '');
});

test('wieVan: de sessiesleutel, afgekapt op 60 tekens', () => {
  assert.equal(hw.wieVan({ session: { key: 'LID-001' } }), 'LID-001');
  assert.equal(hw.wieVan({ session: { key: 'K'.repeat(80) } }), 'K'.repeat(60));
  assert.equal(hw.wieVan({ session: { key: 12345 } }), '12345');
});

test('wieVan: zonder sleutel een categorie naar het pad, en anders anoniem', () => {
  assert.equal(hw.wieVan({ path: '/api/office/leden' }), 'kantoor (gedeelde code)');
  assert.equal(hw.wieVan({ url: '/api/command/besluit?x=1' }), 'kantoor (gedeelde code)');
  assert.equal(hw.wieVan({ session: {}, path: '/api/supplier/x' }), 'partner (niet herleid)');
  assert.equal(hw.wieVan({ path: '/api/partner/boeking' }), 'partner (niet herleid)');
  assert.equal(hw.wieVan({ path: '/api/member/profiel' }), 'anoniem');
  assert.equal(hw.wieVan({}), 'anoniem');
});

test('regelVan: velden worden begrensd en een ontbrekende waarde krijgt een eerlijke standaard', () => {
  releaseidentiteit.release({ env: {}, root: LEEG, vers: true });   // geen release bekend
  const { regelVan } = hw.maakRegel(() => Date.parse('2026-10-12T08:30:00.000Z'));
  const r = regelVan({});
  assert.deepEqual(r, { at: '2026-10-12T08:30:00.000Z', wie: 'anoniem', methode: '', pad: '', status: 0, afdruk: '' },
    'zonder release: geen verzonnen versie');
  const lang = regelVan({ wie: 'W'.repeat(70), methode: 'PROPFINDXYZ', pad: '/p'.repeat(150), status: '201', afdruk: 'ab',
    stand: 'toegestaan-en-nog-veel-meer', verzoek: 'V'.repeat(50), collecties: ['leden', 'boekingen'] });
  assert.equal(lang.wie.length, 60);
  assert.equal(lang.methode, 'PROPFINDXY');
  assert.equal(lang.pad.length, 200);
  assert.equal(lang.status, 201);
  assert.equal(lang.stand, 'toegestaan-en-nog-ve');
  assert.equal(lang.verzoek, 'V'.repeat(40));
  assert.equal(lang.collecties, 'leden,boekingen');
  assert.equal(regelVan({ status: 'onzin' }).status, 0);
  assert.equal('collecties' in regelVan({ collecties: [] }), false, 'een lege lijst laat geen veld achter');
  assert.equal(regelVan({ collecties: 'een' }).collecties, 'een');
});

test('regelVan: een grove regel draagt alleen de dag en nooit een verzoek-id', () => {
  const { regelVan } = hw.maakRegel(() => Date.parse('2026-10-12T23:59:59.000Z'));
  const r = regelVan({ grof: true, verzoek: 'req-1', wie: burger.PSEUDONIEM });
  assert.equal(r.at, '2026-10-12T00:00:00.000Z');
  assert.equal('verzoek' in r, false);
});

test('regelVan: een bekende release staat in de regel', () => {
  releaseidentiteit.release({ env: { RTG_RELEASE_COMMIT: 'ABCDEF1234567' }, root: LEEG, vers: true });
  const { regelVan } = hw.maakRegel(() => 0);
  assert.equal(regelVan({}).release, 'abcdef1234567');
  releaseidentiteit.release({ env: {}, root: LEEG, vers: true });
  assert.equal('release' in regelVan({}), false);
});

test('regelVoorVroegeCommit: een gewoon pad houdt wie, afdruk en verzoek', () => {
  const { regelVoorVroegeCommit } = hw.maakRegel(() => Date.parse('2026-10-12T10:00:00.000Z'));
  const r = regelVoorVroegeCommit({ session: { key: 'LID-9' }, method: 'POST', path: '/api/member/boek',
    body: { a: 1, notitie: 'weg' }, id: 'req-77' }, ['boekingen']);
  assert.equal(r.wie, 'LID-9');
  assert.equal(r.methode, 'POST');
  assert.equal(r.pad, '/api/member/boek');
  assert.equal(r.status, 0);
  assert.equal(r.stand, 'vastgelegd');
  assert.equal(r.afdruk, verwacht({ a: 1 }));
  assert.equal(r.verzoek, 'req-77');
  assert.equal(r.collecties, 'boekingen');
  assert.equal(r.at, '2026-10-12T10:00:00.000Z');
});

test('regelVoorVroegeCommit: een burgerpad is een pseudoniem, zonder afdruk, verzoek of tijd van de dag', () => {
  const { regelVoorVroegeCommit } = hw.maakRegel(() => Date.parse('2026-10-12T10:00:00.000Z'));
  const r = regelVoorVroegeCommit({ session: { key: 'LID-9' }, method: 'POST', url: '/api/member/democratie/stem',
    body: { kwestie: 'KW-1' }, id: 'req-78' });
  assert.equal(r.wie, burger.PSEUDONIEM);
  assert.equal(r.afdruk, '');
  assert.equal('verzoek' in r, false);
  assert.equal('collecties' in r, false);
  assert.equal(r.at, '2026-10-12T00:00:00.000Z');
  const kaal = regelVoorVroegeCommit({});
  assert.equal(kaal.wie, 'anoniem');
  assert.equal(kaal.pad, '');
});
