/* De kantooruitnodiging als credential (office.kantooruitnodiging), control voor
   control: 128 bit en eenmaal tonen, hash-only opslag, issuer/doel/scope en de
   binding aan EEN sleutel, vervaltijd, max_gebruik 1, intrekken door de eigenaar
   (en heruitgifte als rotatie), constant-time zoeken, en de claim in de
   collectietransactie. Toets 7 draait tegen een ECHTE server; de raceproef over
   twee instances staat in test/codedeuren-claim.pg.test.js.

   Draai los: node --test test/kantooruitnodiging-credential.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, kantoorAlsPersoon, kantoorKoppelBody } = require('./helper');
const { maakUitnodiging } = require('../server/kern/kantoor/uitnodiging');

function wereld() {
  let t = Date.parse('2026-09-27T09:00:00Z');
  let vergelijkingen = 0;
  const db = { data: {}, writable: true };
  const sleutels = [];
  const basis = require('../server/db/collectie-bewerken')({ store: 'json', db, save() {} });
  const telCrypto = Object.assign(Object.create(crypto), {
    timingSafeEqual: (a, b) => { vergelijkingen++; return crypto.timingSafeEqual(a, b); } });
  const u = maakUitnodiging({ db, save() {}, crypto: telCrypto, nu: () => t,
    bewerkCollectie: (s, w) => { sleutels.push(s); return basis(s, w); } });
  const rij = id => db.data.kantoorUitnodigingen.find(x => x.id === id);
  return { db, u, rij, sleutels, schuif: ms => { t += ms; }, tel: () => vergelijkingen, nul: () => { vergelijkingen = 0; } };
}

test('1. 128 bit, alleen als hash bewaard, en een keer getoond', async () => {
  const w = wereld();
  const r = await w.u.maak({ voorKey: 'user-5', codenaam: 'Toets', door: 'eigenaar' });
  assert.match(r.code, /^KU\.[0-9A-F]{32}$/);
  assert.equal(JSON.stringify(w.db.data).includes(r.code.slice(3)), false);
  assert.match(w.rij(r.id).toegang.code_hash, /^[a-f0-9]{64}$/);
  const codes = [r.code];
  for (let i = 0; i < 8; i++) codes.push((await w.u.maak({ voorKey: 'user-' + (10 + i) })).code);
  // elke positie van het geheim varieert: geen opgevuld of afgekapt geheim
  for (let i = 0; i < 32; i++) assert.ok(new Set(codes.map(c => c.slice(-32)[i])).size > 1, 'positie ' + i + ' van het geheim is vast');
  assert.equal(JSON.stringify(w.u.overzicht()).includes(r.code.slice(3)), false, 'het overzicht toont de code opnieuw');
  assert.equal(JSON.stringify(w.u.overzicht()).includes('code_hash'), false, 'het overzicht draagt de hash');
});

test('2. issuer, doel, scope en de binding aan EEN sleutel', async () => {
  const w = wereld();
  const r = await w.u.maak({ voorKey: 'user-5', codenaam: 'Toets', door: 'eigenaar' });
  const t = w.rij(r.id).toegang;
  assert.equal(t.issuer, 'rtg.kantoor.eigenaar');
  assert.equal(t.doel, 'kantoorrol-koppelen');
  assert.deepEqual(t.scope, ['kantoor.koppel']);
  assert.deepEqual(t.onderwerp, { soort: 'kantooruitnodiging', id: r.id, voorKey: 'user-5' });
  assert.equal((await w.u.verzilver('user-6', r.code)).status, 401, 'een andere sleutel verzilvert hem');
  assert.equal(w.rij(r.id).toegang.gebruik, 0, 'en die poging verbruikte hem niet');
  w.rij(r.id).voorKey = 'user-6';
  assert.equal((await w.u.verzilver('user-6', r.code)).status, 401, 'de sleutel in het onderwerp van de credential telt, niet alleen het veld op de rij');
  w.rij(r.id).voorKey = 'user-5';
  w.rij(r.id).toegang.scope = ['iets.anders'];
  assert.equal((await w.u.verzilver('user-5', r.code)).status, 401, 'zonder de scope opent hij niets');
});

test('3. issued_at, expires_at, max_gebruik en de proef die niets verbruikt', async () => {
  const w = wereld();
  const r = await w.u.maak({ voorKey: 'user-5' });
  const t = w.rij(r.id).toegang;
  assert.equal(Date.parse(t.expires_at) - Date.parse(t.issued_at), 7 * 86400000);
  assert.equal(t.max_gebruik, 1);
  assert.equal((await w.u.verzilver('user-5', r.code, { proef: true })).ok, true);
  assert.equal(w.rij(r.id).toegang.gebruik, 0, 'de proef verbruikte hem');
  assert.equal((await w.u.verzilver('user-5', r.code)).ok, true);
  assert.equal(w.rij(r.id).toegang.gebruik, 1);
  assert.equal((await w.u.verzilver('user-5', r.code)).status, 401, 'een tweede keer');
  assert.equal((await w.u.verzilver('user-5', r.code, { proef: true })).status, 401, 'ook de proef ziet dat hij op is');
  const r2 = await w.u.maak({ voorKey: 'user-7' });
  w.schuif(7 * 86400000 + 1);
  assert.equal((await w.u.verzilver('user-7', r2.code)).status, 401, 'verlopen');
});

test('4. intrekken en roteren: server-side, en een gebruikte uitnodiging trekt niet in', async () => {
  const w = wereld();
  const a = await w.u.maak({ voorKey: 'user-5' });
  const b = await w.u.maak({ voorKey: 'user-5' });
  assert.ok(w.rij(a.id).toegang.ingetrokken_at, 'een nieuwe uitgifte roteert: de oude is ingetrokken');
  assert.equal((await w.u.verzilver('user-5', a.code)).status, 401);
  assert.equal((await w.u.intrek(b.id, 'eigenaar')).ok, true);
  assert.equal((await w.u.verzilver('user-5', b.code)).status, 401, 'een ingetrokken uitnodiging werkt');
  assert.equal((await w.u.intrek('uitn_bestaatniet')).status, 404);
  const c = await w.u.maak({ voorKey: 'user-8' });
  await w.u.verzilver('user-8', c.code);
  assert.equal((await w.u.intrek(c.id)).status, 409, 'een gebruikte uitnodiging intrekken zegt niet dat hij dicht is');
  assert.ok(w.sleutels.length && w.sleutels.every(s => s === 'kantoorUitnodigingen'), 'alles in de collectietransactie');
});

test('5. constant-time: elke rij wordt vergeleken, en een oude vorm niet eens', async () => {
  const w = wereld();
  const codes = [];
  for (let i = 1; i <= 5; i++) codes.push(await w.u.maak({ voorKey: 'user-' + i }));
  const tellingen = [];
  for (const r of [codes[0], codes[4]]) { w.nul(); await w.u.verzilver('user-9', r.code); tellingen.push(w.tel()); }
  assert.deepEqual(tellingen, [5, 5], 'de positie van de treffer bepaalt het aantal vergelijkingen');
  w.nul();
  assert.equal((await w.u.verzilver('user-1', 'ABCDEFGH23')).status, 401, 'de oude vorm van tien tekens');
  assert.equal((await w.u.verzilver('user-1', 'KU.' + 'A'.repeat(16))).status, 401, 'een geheim van 64 bit');
  assert.equal(w.tel(), 0);
});

test('6. een uitnodiging van voor de migratie opent niets en staat als ongeldig in het overzicht', async () => {
  const w = wereld();
  w.db.data.kantoorUitnodigingen = [{ id: 'uitn_oud', voorKey: 'user-5', hash: 'a'.repeat(64),
    gemaakt: '2026-09-26T09:00:00Z', verloopt: '2026-10-03T09:00:00Z', gebruikt: null, ingetrokken: null }];
  assert.equal((await w.u.verzilver('user-5', 'ABCDEFGH23')).status, 401);
  assert.equal(w.u.overzicht().uitnodigingen[0].stand, 'ongeldig');
});

test('7. echte server: intrekken is van de eigenaar, en daarna koppelt de code niets', async () => {
  const CODE = 'UITNODIG-INTREK';
  const geheim = require('../server/lib/eenmalig-geheim-routes');
  for (const r of ['/api/office/kantoor/uitnodiging'])
    assert.equal(geheim.isEenmalig('POST', r), true, r + ': geen antwoordcache mag deze kale code heronthullen');
  const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kuintrek-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: m, OFFICE_CODE: CODE } });
  const api = (pad, body, tok) => fetch(srv.base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  try {
    const eig = await kantoorAlsPersoon(srv.base, CODE);
    const gedeeld = (await api('/api/office/login', { code: CODE })).body.token;
    const reg = (await api('/api/auth/register', { name: 'Intrek Toets', email: 'kuintrek' + Date.now() + '@x.nl',
      password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' })).body;
    const codenaam = ((await api('/api/auth/me', {}, reg.token)).body.user || {}).codename;
    const u = await api('/api/office/kantoor/uitnodiging', { codenaam }, eig);
    assert.equal(u.status, 200, JSON.stringify(u.body));
    assert.match(u.body.code, /^KU\.[0-9A-F]{32}$/);
    assert.equal((await api('/api/office/kantoor/uitnodiging/intrek', { id: u.body.id }, gedeeld)).status, 403,
      'de gedeelde kantoorcode trekt niets in');
    /* Ook wie boardroomtoegang KREEG, is de eigenaar niet. */
    const mede = (await api('/api/auth/register', { name: 'Mede Toets', email: 'kumede' + Date.now() + '@x.nl',
      password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' })).body;
    const medeNaam = ((await api('/api/auth/me', {}, mede.token)).body.user || {}).codename;
    assert.equal((await api('/api/account/koppel', await kantoorKoppelBody(srv.base, mede.token), mede.token)).status, 200);
    assert.equal((await api('/api/office/boardroom/toegang/geef', { codenaam: medeNaam }, eig)).status, 200);
    const medeKantoor = (await api('/api/account/start', { rol: 'kantoor' }, mede.token)).body.token;
    assert.equal((await api('/api/office/kantoor/uitnodigingen', {}, medeKantoor)).status, 200, 'hij komt de boardroom in');
    assert.equal((await api('/api/office/kantoor/uitnodiging/intrek', { id: u.body.id }, medeKantoor)).status, 403,
      'een medewerker met boardroomtoegang trekt de uitnodiging van de eigenaar in');
    const weg = await api('/api/office/kantoor/uitnodiging/intrek', { id: u.body.id }, eig);
    assert.equal(weg.status, 200, JSON.stringify(weg.body));
    assert.equal(weg.body.stand, 'ingetrokken');
    const k = await api('/api/account/koppel', { soort: 'kantoor', uitnodiging: u.body.code }, reg.token);
    assert.equal(k.status, 401, 'een ingetrokken uitnodiging koppelde toch: ' + JSON.stringify(k.body));
    assert.equal((await api('/api/office/kantoor/uitnodiging/intrek', { id: 'uitn_bestaatniet' }, eig)).status, 404);
    const o = await api('/api/office/kantoor/uitnodigingen', {}, eig);
    assert.equal(JSON.stringify(o.body).includes(u.body.code.slice(3)), false, 'het overzicht toont de code');
  } finally {
    await stop(srv);
    try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {}
  }
});
