/* Echte muziek in RTG Sound: rauwe upload, privé-opslag, eigen bibliotheek en
   afspelen met byte-ranges via een korte luisterkaart. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, wachtOpWaarde } = require('./helper');
const { soortVanBuffer } = require('../server/media/bestand');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-muziek-bestand-'));
const MP3 = Buffer.concat([Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00', 'latin1'), Buffer.alloc(256, 7)]);
let base, child, a, b, nummer, luister, opslagNaam;

test('de mediapoort herkent de ondersteunde muziekformaten aan hun bytes', () => {
  const riff = Buffer.alloc(12); riff.write('RIFF', 0, 'latin1'); riff.write('WAVE', 8, 'latin1');
  const ftyp = Buffer.alloc(12); ftyp.write('ftyp', 4, 'latin1'); ftyp.write('M4A ', 8, 'latin1');
  const gevallen = [
    [Buffer.from('ID3x'), 'audio/mpeg', 'mp3'], [riff, 'audio/wav', 'wav'],
    [Buffer.from('OggS'), 'audio/ogg', 'ogg'], [Buffer.from('fLaC'), 'audio/flac', 'flac'],
    [Buffer.from([0xff, 0xf1, 0, 0]), 'audio/aac', 'aac'], [ftyp, 'audio/mp4', 'm4a'],
    [Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), 'audio/webm', 'webm']
  ];
  for (const [bytes, mime, ext] of gevallen) {
    const soort = soortVanBuffer(bytes, mime);
    assert.equal(soort.kind, 'audio', ext);
    assert.equal(soort.ext, ext);
  }
});

async function post(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function lid(naam, n) {
  return (await post('/api/auth/register', { name: naam, email: 'muziekbestand' + n + '@x.test',
    phone: '0612345' + String(n).padStart(3, '0'), password: 'geheim123',
    geboortedatum: '1990-01-01', tier: 'rtg' })).body.token;
}

test.before(async () => {
  ({ base, child } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  a = await lid('Luisteraar A', 1); b = await lid('Luisteraar B', 2);
});
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een maker publiceert eigen muziek in de feed zonder een kale publieke media-URL', async () => {
  const r = await fetch(base + '/api/muziek/bestand', { method: 'POST', headers: {
    Authorization: 'Bearer ' + a, 'Content-Type': 'audio/mpeg',
    'X-RTG-Bestandsnaam': encodeURIComponent('Mijn avond.mp3'),
    'X-RTG-Titel': encodeURIComponent('Avond aan zee'),
    'X-RTG-Beschrijving': encodeURIComponent('Zelf gemaakt aan de kust.'),
    'X-RTG-Eigenwerk': 'ja', 'Idempotency-Key': 'muziek-publiceer-test-0001'
  }, body: MP3 });
  const j = await r.json();
  assert.equal(r.status, 200, j.error);
  nummer = j.nummer;
  assert.equal(nummer.naam, 'Avond aan zee');
  assert.equal(nummer.beschrijving, 'Zelf gemaakt aan de kust.');
  assert.equal(nummer.vanMij, true);
  assert.equal(nummer.mime, 'audio/mpeg');
  assert.equal(nummer.src, undefined, 'de opslagverwijzing verlaat de server niet');

  const dubbel = await fetch(base + '/api/muziek/bestand', { method: 'POST', headers: {
    Authorization: 'Bearer ' + a, 'Content-Type': 'audio/mpeg',
    'X-RTG-Bestandsnaam': encodeURIComponent('Mijn avond.mp3'),
    'X-RTG-Eigenwerk': 'ja', 'Idempotency-Key': 'muziek-publiceer-test-0001'
  }, body: MP3 });
  const dubbelBody = await dubbel.json();
  assert.equal(dubbel.status, 200);
  assert.equal(dubbelBody.herhaald, true);
  assert.equal(dubbelBody.nummer.id, nummer.id, 'een netwerretry publiceert geen tweede nummer');

  const eigen = await post('/api/muziek/bestanden', {}, a);
  const ander = await post('/api/muziek/bestanden', {}, b);
  assert.deepEqual(eigen.body.nummers.map(x => x.id), [nummer.id]);
  assert.ok(Array.isArray(ander.body.nummers));
  assert.equal(ander.body.nummers.length, 0);

  const feed = await post('/api/muziek/feed', {}, b);
  assert.equal(feed.body.nummers[0].id, nummer.id);
  assert.equal(feed.body.nummers[0].vanMij, false);
  assert.equal(feed.body.nummers[0].maker.length > 0, true);

  opslagNaam = fs.readdirSync(path.join(TMP, 'media')).find(x => x.endsWith('.mp3'));
  assert.match(opslagNaam, /^prive-[0-9a-f]{32}\.mp3$/);
  assert.equal((await fetch(base + '/media/' + opslagNaam)).status, 400,
    'de gewone publieke mediaroute weigert een privébestand');
});

test('een ander lid luistert via een tijdelijke kaart, volledig en met ranges', async () => {
  const t = await post('/api/muziek/bestand-ticket', { id: nummer.id }, b);
  assert.equal(t.status, 200, t.body.error);
  luister = t.body.src;
  assert.match(luister, /^\/api\/muziek\/luister\/[0-9a-f]{48}$/);
  assert.equal(Date.parse(t.body.verloopt) > Date.now(), true);

  let r = await fetch(base + luister);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'audio/mpeg');
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), MP3);

  r = await fetch(base + luister, { headers: { Range: 'bytes=3-12' } });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('content-range'), 'bytes 3-12/' + MP3.length);
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), MP3.subarray(3, 13));
  const onbekendeLuisterkaart = '/api/muziek/luister/:ticket'.replace(':ticket', '0'.repeat(48));
  assert.equal((await fetch(base + onbekendeLuisterkaart)).status, 404);
});

test('geen audio, geen rechtenbevestiging, geen inlog en andermans verwijdering worden geweigerd', async () => {
  let r = await fetch(base + '/api/muziek/bestand', { method: 'POST', headers: {
    Authorization: 'Bearer ' + a, 'Content-Type': 'text/plain', 'X-RTG-Bestandsnaam': 'tekst.txt',
    'Idempotency-Key': 'muziek-afkeur-test-0001'
  }, body: Buffer.from('geen muziek') });
  assert.equal(r.status, 400);
  r = await fetch(base + '/api/muziek/bestand', { method: 'POST', headers: {
    Authorization: 'Bearer ' + a, 'Content-Type': 'audio/mpeg', 'X-RTG-Bestandsnaam': 'zonder-toestemming.mp3',
    'Idempotency-Key': 'muziek-afkeur-test-0002'
  }, body: MP3 });
  assert.equal(r.status, 400);
  r = await fetch(base + '/api/muziek/bestand', { method: 'POST', headers: { 'Content-Type': 'audio/mpeg' }, body: MP3 });
  assert.equal(r.status, 401);
  assert.equal((await post('/api/muziek/bestand-weg', { id: nummer.id }, b)).status, 404);
});

test('een luisteraar kan waardering herhaalveilig geven en weer intrekken', async () => {
  let r = await post('/api/muziek/mooi', { id: nummer.id, aan: true }, b);
  assert.equal(r.status, 200); assert.equal(r.body.mooi, 1); assert.equal(r.body.mooiVanMij, true);
  r = await post('/api/muziek/mooi', { id: nummer.id, aan: true }, b);
  assert.equal(r.body.mooi, 1, 'een herhaalde like telt niet dubbel');
  let feed = await post('/api/muziek/feed', {}, b);
  assert.equal(feed.body.nummers[0].mooiVanMij, true);
  r = await post('/api/muziek/mooi', { id: nummer.id, aan: false }, b);
  assert.equal(r.body.mooi, 0); assert.equal(r.body.mooiVanMij, false);
});

test('verwijderen trekt bestaande luisterkaarten in en ruimt de bytes op', async () => {
  assert.equal((await post('/api/muziek/bestand-weg', { id: nummer.id }, a)).status, 200);
  assert.deepEqual((await post('/api/muziek/bestanden', {}, a)).body.nummers, []);
  assert.equal((await fetch(base + luister)).status, 404);
  await wachtOpWaarde(() => !fs.existsSync(path.join(TMP, 'media', opslagNaam)), {
    ms: 3000,
    wat: 'het verwijderde muziekbestand uit de privé-opslag'
  });
  assert.equal(fs.existsSync(path.join(TMP, 'media', opslagNaam)), false);
});
