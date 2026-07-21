/* De luchtzijde-stand voor partners (boarding pass aan de deur, dubbele
   prijzen op de kassa, de vertaalknop) + de moedertaal van het account
   (iedereen praat de eigen taal, de ander leest de zijne in de vriendenchat).
   Draai los: node --experimental-sqlite --test test/luchtzijde-taal.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, lidA, lidB, keyA, keyB, zaak;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-luchtzijde-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const ra = await api(base, '/api/auth/register', { name: 'Taal Een', email: 'ta' + u + '@x.nl',
    phone: '065' + u.slice(1), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lidA = ra.body.token;
  const rb = await api(base, '/api/auth/register', { name: 'Taal Twee', email: 'tb' + u + '@x.nl',
    phone: '066' + u.slice(1), password: 'geheim123', geboortedatum: '1991-02-02', tier: 'rtg', pasApp: 'rtg' });
  lidB = rb.body.token;
  keyA = (await api(base, '/api/member/connections', {}, lidA)).body.me;
  keyB = (await api(base, '/api/member/connections', {}, lidB)).body.me;
  // de demo-zaak, ingelogd als manager (mag de instellingen zetten)
  zaak = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('1. de luchtzijde-stand: de manager zet hem aan met een toeslag, en de kassa rekent dubbele prijzen', async () => {
  assert.equal((await api(base, '/api/supplier/settings', { luchtzijde: true, luchtToeslagPct: 20 }, zaak)).status, 200);
  const s = await api(base, '/api/supplier/pos/sale', { method: 'contant', total: 10,
    items: [{ name: 'Cava', qty: 1, price: 10 }] }, zaak);
  assert.equal(s.status, 200);
  assert.equal(s.body.sale.total, 12, 'de gast betaalt de luchthavenprijs (+20%)');
  assert.equal(s.body.sale.items[0].price, 12);
  assert.equal(s.body.sale.items[0].prijsNormaal, 10, 'de bon draagt beide prijzen');
  assert.equal(s.body.sale.luchtzijde.pct, 20);
  assert.equal(s.body.sale.luchtzijde.totaalNormaal, 10);
  // stand uit: gewoon de normale prijs, zonder luchtzijde-blok op de bon
  await api(base, '/api/supplier/settings', { luchtzijde: false }, zaak);
  const s2 = await api(base, '/api/supplier/pos/sale', { method: 'contant', total: 10, items: [{ name: 'Cava', qty: 1, price: 10 }] }, zaak);
  assert.equal(s2.body.sale.total, 10);
  assert.equal(s2.body.sale.luchtzijde, null);
});

test('2. de boarding pass aan de deur: elke partner checkt de code van de gast', async () => {
  // de reiziger boekt de open vlucht (RT205, inchecken) en checkt in
  const bord = await api(base, '/api/member/vluchten/bord', {}, lidA);
  const open = bord.body.vluchten.find(v => v.nummer === 'RT205');
  const bk = await api(base, '/api/member/vluchten/boek', { id: open.id }, lidA);
  // voor het inchecken is de pass nog niet geldig
  const teVroeg = await api(base, '/api/supplier/lucht/pass', { code: bk.body.boeking.code }, zaak);
  assert.equal(teVroeg.body.geldig, false);
  assert.match(teVroeg.body.reden, /niet ingecheckt/i);
  const inc = await api(base, '/api/member/vluchten/incheck', { code: bk.body.boeking.code }, lidA);
  const r = await api(base, '/api/supplier/lucht/pass', { code: bk.body.boeking.code }, zaak);
  assert.equal(r.status, 200);
  assert.equal(r.body.geldig, true);
  assert.equal(r.body.pass.vlucht, 'RT205');
  assert.equal(r.body.pass.stoel, inc.body.pass.stoel);
  // onzin blijft buiten
  assert.equal((await api(base, '/api/supplier/lucht/pass', { code: 'VL-NIETS' }, zaak)).body.geldig, false);
  assert.equal((await api(base, '/api/supplier/lucht/pass', { code: 'x' }, null)).status, 401);
});

test('3. de vertaalknop: kaartteksten naar een andere taal (woordenboek, ook zonder AI-sleutel)', async () => {
  const r = await api(base, '/api/supplier/vertaal', { teksten: ['wijn', 'koffie'], naar: 'en' }, zaak);
  assert.equal(r.status, 200);
  assert.equal(r.body.naar, 'en');
  assert.match(r.body.teksten[0], /wine/i);
  assert.match(r.body.teksten[1], /coffee/i);
});

test('4. de moedertaal van het account: alleen actieve wereldtalen, netjes bewaard', async () => {
  const lijst = await api(base, '/api/member/taal', {}, lidA);
  assert.equal(lijst.status, 200);
  assert.ok(lijst.body.talen.some(t => t.code === 'en'), 'de basistalen staan altijd aan');
  assert.equal((await api(base, '/api/member/taal/zet', { code: 'xx' }, lidA)).status, 400, 'onbekende taal geweigerd');
  assert.equal((await api(base, '/api/member/taal/zet', { code: 'es' }, lidA)).status, 400, 'niet-actieve taal geweigerd (de Boardroom beslist)');
  assert.equal((await api(base, '/api/member/taal/zet', { code: 'en' }, lidA)).status, 200);
  assert.equal((await api(base, '/api/member/taal', {}, lidA)).body.taal, 'en');
});

test('5. de vriendenchat: B typt Nederlands, A (moedertaal Engels) leest Engels; B blijft zijn eigen taal zien', async () => {
  // vrienden worden
  await api(base, '/api/member/connect', { key: keyB }, lidA);
  await api(base, '/api/member/connect/respond', { key: keyA, action: 'accept' }, lidB);
  const stuur = await api(base, '/api/member/dm/send', { toKey: keyA, text: 'proost met wijn en koffie erbij' }, lidB);
  assert.equal(stuur.status, 200);
  // A heeft moedertaal Engels (test 4): het bericht komt vertaald binnen
  const bijA = await api(base, '/api/member/dm', { withKey: keyB }, lidA);
  assert.equal(bijA.status, 200);
  const m = bijA.body.messages.find(x => x.from === keyB);
  assert.ok(m, 'het bericht is er');
  assert.match(m.text, /wine/i, 'wijn is wine geworden');
  assert.match(m.text, /coffee/i, 'koffie is coffee geworden');
  assert.equal(m.vertaaldUit, 'nl', 'en het draagt zijn brontaal');
  // B (geen moedertaal gezet) leest zijn eigen woorden onvertaald
  const bijB = await api(base, '/api/member/dm', { withKey: keyA }, lidB);
  assert.match(bijB.body.messages.find(x => x.from === keyB).text, /wijn/, 'de schrijver ziet zijn eigen taal');
});
