/* De werkplek: RTG en RTF als twee aparte huizen. Het gaat hier vooral om de
   deur: de eigenaar mag in beide huizen, een medewerker alleen in het zijne, en
   wie geen sleutel heeft ziet niets. Draai los:
   node --experimental-sqlite --test test/werkplek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
function post(pad, body, token) {
  return fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let eigenaar, medewerker, medewerkerKey;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkplek-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  // de eigenaar staat er na het opstarten altijd (demostand)
  const e = await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran' });
  assert.equal(e.status, 200, 'het eigenaarsaccount bestaat en logt in');
  eigenaar = e.body.token;
  // een gewoon lid, dat straks alleen bij RTF mag
  const t = Date.now().toString().slice(-7);
  const m = await post('/api/auth/register', { name: 'Medewerker Test', email: 'wp' + t + '@rtg.test',
    phone: '+31612340000', password: 'Wachtwoord123', geboortedatum: '1990-05-20' });
  assert.equal(m.status, 200);
  medewerker = m.body.token;
  medewerkerKey = 'user-' + m.body.state.user.id;
});
test.after(() => stop(srv && srv.child));

test('1. de eigenaar ziet beide huizen, elk met eigen cijfers', async () => {
  const r = await post('/api/werkplek/mijn', {}, eigenaar);
  assert.equal(r.status, 200);
  assert.equal(r.body.baas, true, 'de eigenaar wordt als baas herkend');
  const codes = r.body.bedrijven.map(b => b.code).sort();
  assert.deepEqual(codes, ['rtf', 'rtg'], 'allebei de huizen staan er');
  for (const b of r.body.bedrijven) {
    assert.ok(b.naam && b.aard && b.kantoor, b.code + ' heeft een naam, een aard en een kantoor');
    assert.ok(b.icoon && !/[\u{1F300}-\u{1FAFF}]/u.test(b.icoon), b.code + ' draagt een huisstijl-glyf, geen emoji');
  }
});

test('2. een huis van binnen: cijfers, wat loopt er, bezetting en taken', async () => {
  const r = await post('/api/werkplek/overzicht', { bedrijf: 'rtg' }, eigenaar);
  assert.equal(r.status, 200);
  assert.equal(r.body.kort, 'RTG');
  assert.ok(r.body.cijfers.length >= 4, 'er staan echte cijfers');
  assert.ok(r.body.loopt.length >= 3, 'er staat wat er loopt');
  assert.ok(Array.isArray(r.body.mensen) && Array.isArray(r.body.taken));
  assert.equal((await post('/api/werkplek/overzicht', { bedrijf: 'bestaatniet' }, eigenaar)).status, 404);
});

test('3. de twee huizen delen hun bezetting en taken niet', async () => {
  await post('/api/werkplek/mens', { bedrijf: 'rtg', codenaam: 'Gouden Reiger 1A2B', functie: 'Inkoop' }, eigenaar);
  await post('/api/werkplek/taak', { bedrijf: 'rtg', tekst: 'Partnercontracten nalopen' }, eigenaar);
  const rtg = (await post('/api/werkplek/overzicht', { bedrijf: 'rtg' }, eigenaar)).body;
  const rtf = (await post('/api/werkplek/overzicht', { bedrijf: 'rtf' }, eigenaar)).body;
  assert.equal(rtg.mensen.length, 1);
  assert.equal(rtg.taken.length, 1);
  assert.equal(rtf.mensen.length, 0, 'RTF ziet de RTG-bezetting niet');
  assert.equal(rtf.taken.length, 0, 'RTF ziet de RTG-taken niet');
  // de bezetting draait op codenamen, niet op echte namen
  assert.equal(rtg.mensen[0].codenaam, 'Gouden Reiger 1A2B');
  assert.ok(!('naam' in rtg.mensen[0]), 'er staat geen echte naam in de bezetting');
});

test('4. zonder sleutel is een huis gewoon dicht', async () => {
  const zonder = await post('/api/werkplek/mijn', {}, medewerker);
  assert.equal(zonder.body.bedrijven.length, 0, 'een lid zonder sleutel ziet geen enkel huis');
  assert.equal((await post('/api/werkplek/overzicht', { bedrijf: 'rtg' }, medewerker)).status, 403);
  // en zonder enig token al helemaal niet
  assert.equal((await post('/api/werkplek/overzicht', { bedrijf: 'rtf' })).status, 403);
});

test('5. een medewerker komt alleen in het huis waarvoor hij een sleutel heeft', async () => {
  const geef = await post('/api/werkplek/toegang-geef', { bedrijf: 'rtf', key: medewerkerKey, naam: 'Medewerker Test' }, eigenaar);
  assert.equal(geef.status, 200);
  assert.ok(geef.body.toegang.some(t => t.key === medewerkerKey));

  const mijn = await post('/api/werkplek/mijn', {}, medewerker);
  assert.equal(mijn.body.baas, false);
  assert.deepEqual(mijn.body.bedrijven.map(b => b.code), ['rtf'], 'hij ziet alleen RTF');
  assert.equal((await post('/api/werkplek/overzicht', { bedrijf: 'rtf' }, medewerker)).status, 200);
  assert.equal((await post('/api/werkplek/overzicht', { bedrijf: 'rtg' }, medewerker)).status, 403, 'RTG blijft dicht');
});

test('6. sleutels uitdelen en intrekken doet alleen de eigenaar', async () => {
  assert.equal((await post('/api/werkplek/toegang-geef', { bedrijf: 'rtg', key: 'user-999' }, medewerker)).status, 403);
  assert.equal((await post('/api/werkplek/toegang', { bedrijf: 'rtf' }, medewerker)).status, 403);
  // de eigenaar trekt de sleutel weer in; daarna staat de medewerker buiten
  const weg = await post('/api/werkplek/toegang-weg', { bedrijf: 'rtf', key: medewerkerKey }, eigenaar);
  assert.equal(weg.status, 200);
  assert.equal((await post('/api/werkplek/overzicht', { bedrijf: 'rtf' }, medewerker)).status, 403);
  assert.equal((await post('/api/werkplek/mijn', {}, medewerker)).body.bedrijven.length, 0);
});

test('7. elk huis heeft een eigen kantoordrive met alle drie de soorten', async () => {
  // de eigenaar heeft nog steeds beide sleutels na test 6 (die trok alleen de
  // sleutel van de medewerker in)
  const drive = (pad, body) => post('/api/werkplek/kantoorpakket' + pad, body, eigenaar);
  const leeg = await drive('/mijn', { bedrijf: 'rtf' });
  assert.equal(leeg.status, 200);
  assert.equal(leeg.body.docs.length, 0, 'de RTF-drive begint leeg');
  assert.ok(leeg.body.sjablonen.length > 0, 'er staan sjablonen klaar');

  for (const soort of ['tekst', 'blad', 'presentatie']) {
    const r = await drive('/maak', { bedrijf: 'rtf', soort, titel: 'Stichting ' + soort });
    assert.equal(r.status, 200, soort + ' kan aangemaakt worden');
    assert.equal(r.body.soort, soort);
  }
  const vol = await drive('/mijn', { bedrijf: 'rtf' });
  assert.equal(vol.body.docs.length, 3, 'alle drie de soorten staan in de RTF-drive');

  // de twee drives zijn gescheiden
  assert.equal((await drive('/mijn', { bedrijf: 'rtg' })).body.docs.length, 0, 'RTG ziet de RTF-documenten niet');

  // en de deur geldt ook hier: zonder sleutel geen documenten
  assert.equal((await post('/api/werkplek/kantoorpakket/mijn', { bedrijf: 'rtf' }, medewerker)).status, 403);
  assert.equal((await post('/api/werkplek/kantoorpakket/mijn', { bedrijf: 'rtf' })).status, 403);
  assert.equal((await drive('/mijn', { bedrijf: 'bestaatniet' })).status, 404);
});

test('8. het RTF-kantoor draagt huisstijl-glyfen, geen emoji', () => {
  const data = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'rtfkantoor-data.js'), 'utf8');
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(data), 'geen emoji meer in de RTF-kamerdata');
  const glyfen = (data.match(/icoon: '[^']+'/g) || []).map(s => s.slice(8, -1));
  assert.ok(glyfen.length >= 16, 'elke kamer heeft een icoon (nu ' + glyfen.length + ')');
  // glyf.js schrijft de namen met en zonder aanhalingstekens; allebei tellen
  const bekend = fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'glyf.js'), 'utf8');
  for (const g of glyfen) {
    assert.match(bekend, new RegExp("(^|[\\s{,])'?" + g + "'?\\s*:", 'm'), 'de glyf ' + g + ' bestaat echt');
  }
});
