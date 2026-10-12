/* De ankerontvanger (scripts/ankerontvanger.js), los van de ankerketen: elke
   weigering van neemAan (geen blok, niet of fout getekend, een andere sleutel
   dan de vastgepinde of ingestelde, een teruggang, een herzegeling die niets
   verklaart) en de HTTP-kant (bearer, 404 voor "nog niets", geen json). De
   blokken worden hier zelf getekend; de ontvanger luistert alleen op
   127.0.0.1 en schrijft in een tijdelijke map. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { maakOntvanger } = require('../scripts/ankerontvanger');

const MAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ankerontv-'));
test.after(() => fs.rmSync(MAP, { recursive: true, force: true }));
const nieuweMap = () => fs.mkdtempSync(path.join(MAP, 'o-'));

function kanoniek(v) {
  if (Array.isArray(v)) return '[' + v.map(kanoniek).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + kanoniek(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
function sleutelpaar() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publiek = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64');
  return { publiek, privateKey };
}
const A = sleutelpaar(), B = sleutelpaar();
function blok(punten, k = A, extra = {}) {
  const kern = { at: '2026-10-12T00:00:00.000Z', punten, zegel: 'z-' + JSON.stringify(punten).length };
  const waarde = crypto.sign(null, Buffer.from(kanoniek(kern), 'utf8'), k.privateKey).toString('base64');
  return Object.assign(kern, { handtekening: { alg: 'ed25519', publiek: k.publiek, waarde } }, extra);
}
function herzegeling(journaal, regels, k = A) {
  const kaal = { journaal, regels, reden: 'AVG art. 17' };
  const waarde = crypto.sign(null, Buffer.from('rtg-herzegeling-v1\n' + kanoniek(kaal), 'utf8'), k.privateKey).toString('base64');
  return Object.assign({}, kaal, { handtekening: { alg: 'ed25519', publiek: k.publiek, waarde } });
}

test('zonder map geen ontvanger, en een lege map heeft geen laatste', () => {
  assert.throws(() => maakOntvanger(), /RTG_ANKER_MAP ontbreekt/);
  const o = maakOntvanger({ map: nieuweMap() });
  assert.equal(o.laatste(), null);
});

test('neemAan weigert wat geen ankerblok is, of niet goed getekend', () => {
  const o = maakOntvanger({ map: nieuweMap() });
  assert.deepEqual(o.neemAan(null), { status: 400, error: 'geen ankerblok' });
  assert.equal(o.neemAan({ blok: {} }).status, 400);
  assert.equal(o.neemAan({ blok: { punten: 'x' } }).error, 'geen ankerblok');
  assert.equal(o.neemAan({ blok: { punten: {} } }).error, 'het blok is niet getekend');
  const ander = blok({ api: { nr: 1, hash: 'h1' } });
  ander.handtekening.alg = 'rsa';
  assert.equal(o.neemAan({ blok: ander }).error, 'het blok is niet getekend');
  const vervalst = blok({ api: { nr: 1, hash: 'h1' } });
  vervalst.punten.api.nr = 2;
  assert.equal(o.neemAan({ blok: vervalst }).error, 'de handtekening klopt niet');
  const kapot = blok({ api: { nr: 1, hash: 'h1' } });
  kapot.handtekening.publiek = 'AAAA';
  assert.equal(o.neemAan({ blok: kapot }).error, 'de handtekening is onleesbaar');
  assert.equal(o.laatste(), null, 'niets bewaard');
});

test('de eerste sleutel wordt vastgepind; een ingestelde sleutel gaat voor', () => {
  const o = maakOntvanger({ map: nieuweMap() });
  assert.deepEqual(o.neemAan({ blok: blok({ api: { nr: 1, hash: 'h1' } }) }), { status: 200, ok: true, nr: 1 });
  assert.match(o.neemAan({ blok: blok({ api: { nr: 2, hash: 'h2' } }, B) }).error, /andere sleutel dan de vastgepinde/);
  const vast = maakOntvanger({ map: nieuweMap(), publiek: A.publiek });
  assert.match(vast.neemAan({ blok: blok({ api: { nr: 1, hash: 'h1' } }, B) }).error, /RTG_ANKER_PUBLIEK/);
  assert.equal(vast.neemAan({ blok: blok({ api: { nr: 1, hash: 'h1' } }) }).status, 200);
});

test('geen teruggang: een ontbrekend journaal, een lager nummer, een andere hash', () => {
  const o = maakOntvanger({ map: nieuweMap() });
  assert.equal(o.neemAan({ blok: blok({ api: { nr: 5, hash: 'h5' }, leeg: null }) }).status, 200);
  const r1 = o.neemAan({ blok: blok({ ander: { nr: 1, hash: 'x' } }) });
  assert.equal(r1.status, 409);
  assert.match(r1.error, /api ontbreekt in het nieuwe blok/);
  assert.match(o.neemAan({ blok: blok({ api: { nr: 4, hash: 'h4' } }) }).error, /api gaat terug van 5 naar 4/);
  assert.match(o.neemAan({ blok: blok({ api: { nr: 5, hash: 'anders' } }) }).error, /andere hash, en geen getekende herzegeling/);
  assert.equal(o.neemAan({ blok: blok({ api: { nr: 5, hash: 'h5' } }) }).status, 200, 'hetzelfde blok mag nog eens');
  assert.equal(o.neemAan({ blok: blok({ api: { nr: 6, hash: 'h6' } }) }).nr, 3);
});

test('een herzegeling verklaart een andere hash alleen met de goede sleutel, het goede journaal en de goede regel', () => {
  const o = maakOntvanger({ map: nieuweMap() });
  o.neemAan({ blok: blok({ api: { nr: 3, hash: 'oud' } }) });
  const nieuw = blok({ api: { nr: 3, hash: 'nieuw' } });
  const verkeerd = [
    herzegeling('api', [{ nr: 3, oud: 'oud', nieuw: 'nieuw' }], B),             // andere sleutel
    herzegeling('ander', [{ nr: 3, oud: 'oud', nieuw: 'nieuw' }]),              // ander journaal
    herzegeling('api', [{ nr: 2, oud: 'oud', nieuw: 'nieuw' }]),                // andere regel
    herzegeling('api', [{ nr: 3, oud: 'oud', nieuw: 'iets-anders' }]),          // voert naar een andere hash
    Object.assign(herzegeling('api', [{ nr: 3, oud: 'oud', nieuw: 'nieuw' }]), { reden: 'vervalst' }), // klopt niet
    Object.assign(herzegeling('api', [{ nr: 3, oud: 'oud', nieuw: 'nieuw' }]), { handtekening: { alg: 'ed25519', publiek: A.publiek } }), // onleesbaar
    herzegeling('api', undefined),                                              // geen regels
    null,
  ];
  for (const h of verkeerd) assert.equal(o.neemAan({ blok: nieuw, herzegelingen: [h] }).status, 409, JSON.stringify(h));
  assert.equal(o.neemAan({ blok: nieuw, herzegelingen: 'geen lijst' }).status, 409);
  // twee herzegelingen achter elkaar: oud -> tussen -> nieuw
  const keten = [herzegeling('api', [{ nr: '3', oud: 'tussen', nieuw: 'nieuw' }]), herzegeling('api', [{ nr: 3, oud: 'oud', nieuw: 'tussen' }])];
  assert.equal(o.neemAan({ blok: nieuw, herzegelingen: keten }).status, 200);
  const laatste = JSON.parse(fs.readFileSync(o.bestand, 'utf8').trim().split('\n').pop());
  assert.equal(laatste.herzegelingen.length, 2, 'het waarom wordt mee bewaard');
  assert.equal(o.laatste().blok.punten.api.hash, 'nieuw');
});

test('een bestaand blok zonder handtekening pint niets vast', () => {
  const map = nieuweMap();
  fs.writeFileSync(path.join(map, 'ankers.jsonl'), JSON.stringify({ ontvangen: 'x', blok: { punten: {} } }) + '\n');
  const o = maakOntvanger({ map });
  assert.equal(o.neemAan({ blok: blok({ api: { nr: 1, hash: 'h' } }, B) }).status, 200);
});

async function luister(o) {
  await new Promise((ja, nee) => o.server.listen(0, '127.0.0.1', ja).on('error', nee));
  return 'http://127.0.0.1:' + o.server.address().port;
}

test('HTTP: bearer verplicht, 404 zolang er niets ligt, json verplicht, onbekend pad 404', async () => {
  const o = maakOntvanger({ map: nieuweMap(), sleutel: 'geheim-1' });
  const basis = await luister(o);
  try {
    const kop = { authorization: 'Bearer geheim-1', 'content-type': 'application/json' };
    assert.equal((await fetch(basis + '/anker/laatste')).status, 401);
    assert.equal((await fetch(basis + '/anker/laatste', { headers: { authorization: 'Bearer fout' } })).status, 401);
    const leeg = await fetch(basis + '/anker/laatste/', { headers: kop });
    assert.equal(leeg.status, 404);
    assert.match((await leeg.json()).error, /nog geen anker/);
    const geenJson = await fetch(basis + '/anker', { method: 'POST', headers: kop, body: '{kapot' });
    assert.equal(geenJson.status, 400);
    assert.deepEqual(await geenJson.json(), { error: 'geen json' });
    const b = blok({ api: { nr: 1, hash: 'h1' } });
    const goed = await fetch(basis + '/pre/anker', { method: 'POST', headers: kop, body: JSON.stringify({ blok: b }) });
    assert.equal(goed.status, 200);
    assert.deepEqual(await goed.json(), { status: 200, ok: true, nr: 1 });
    const terug = await fetch(basis + '/anker/laatste', { headers: kop });
    assert.equal(terug.status, 200);
    assert.deepEqual((await terug.json()).blok, b);
    const geweigerd = await fetch(basis + '/anker', { method: 'POST', headers: kop, body: JSON.stringify({ blok: { punten: {} } }) });
    assert.equal(geweigerd.status, 400);
    assert.equal((await fetch(basis + '/iets', { headers: kop })).status, 404);
    assert.equal((await fetch(basis + '/anker', { headers: kop })).status, 404, 'GET op /anker bestaat niet');
  } finally { await new Promise(r => o.server.close(r)); }
});

test('HTTP zonder ingestelde sleutel laat iedereen lezen', async () => {
  const o = maakOntvanger({ map: nieuweMap() });
  const basis = await luister(o);
  try {
    assert.equal((await fetch(basis + '/anker/laatste')).status, 404);
  } finally { await new Promise(r => o.server.close(r)); }
});
