/* INTREKKEN SLUIT WAT AL OPENSTAAT (AUTHORITY.md fase 3).

   Vijf dingen die niet mogen sneuvelen:
   1. wie de kantoorrol ontkoppelt, verliest ELKE open kantoorsessie meteen --
      ook een tweede, op een ander toestel -- en zijn open stroom valt dicht;
   2. boardroomtoegang intrekken sluit de open kantoorsessie van die mens, en
      niet die van de eigenaar die intrekt;
   3. een baliezetel weghalen doet hetzelfde;
   4. een medewerker die niets is ingetrokken, merkt niets;
   5. een stroom zwijgt vanaf het eerste bericht nadat zijn sessie niet meer
      geldt, ook als niemand hem expliciet sluit (kern/sse.js).

   Draai los: node --test test/kantoorintrekking.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const CODE = 'INTREK-KANTOOR';
const mappen = [];
let srv, eig;
function api(pad, body, token) {
  return fetch(srv.base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let n = 0;
async function medewerker() {
  n += 1;
  const reg = (await api('/api/auth/register', { name: 'Intrek Toets ' + n, email: 'intrek' + n + Date.now() + '@voorbeeld.test',
    password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' })).body;
  assert.ok(reg.token, 'registreren lukt');
  const k = await api('/api/account/koppel', { soort: 'kantoor', code: CODE }, reg.token);
  assert.equal(k.status, 200, 'de kantoorrol koppelen lukt: ' + JSON.stringify(k.body).slice(0, 120));
  const start = async () => (await api('/api/account/start', { rol: 'kantoor' }, reg.token)).body.token;
  // de gids leert een codenaam bij het eerste ingelogde verzoek (kern/gids.js)
  await api('/api/auth/me', {}, reg.token);
  const u = (reg.state && reg.state.user) || {};
  return { lid: reg.token, id: u.id, codenaam: u.codename, start };
}
/* Een open stroom, en een belofte die afloopt zodra de server hem sluit. */
async function stroom(token) {
  const ctrl = new AbortController();
  const r = await fetch(srv.base + '/api/office/stream?token=' + encodeURIComponent(token), { signal: ctrl.signal });
  assert.equal(r.status, 200, 'de stroom gaat open');
  const lezer = r.body.getReader();
  const dicht = (async () => { try { for (;;) { const { done } = await lezer.read(); if (done) return true; } } catch (e) { return true; } })();
  return { dicht, stop: () => ctrl.abort() };
}
const binnen = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(false), ms))]);

test.before(async () => {
  const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-intrek-')); mappen.push(m);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: m, OFFICE_CODE: CODE } });
  eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(eig, 'de eigenaar logt in');
});
test.after(() => {
  stop(srv && srv.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('1. ontkoppelen sluit elke open kantoorsessie en de stroom', async () => {
  const m = await medewerker();
  const a = await m.start(), b = await m.start();
  assert.equal((await api('/api/office/state', {}, a)).status, 200);
  assert.equal((await api('/api/office/state', {}, b)).status, 200);
  const s = await stroom(a);
  const r = await api('/api/account/ontkoppel', { rol: 'kantoor' }, m.lid);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.sessiesGesloten, 2, 'beide kantoorsessies horen dicht te gaan');
  assert.equal((await api('/api/office/state', {}, a)).status, 401, 'de eerste sessie is meteen dicht');
  assert.equal((await api('/api/office/state', {}, b)).status, 401, 'ook de tweede, op een ander toestel');
  assert.equal(await binnen(s.dicht, 3000), true, 'de open stroom valt dicht');
  s.stop();
  assert.equal((await api('/api/auth/me', {}, m.lid)).status !== 401, true, 'het lidaccount zelf blijft werken');
});

test('2. boardroomtoegang intrekken sluit de open kantoorsessie, niet die van de eigenaar', async () => {
  const m = await medewerker();
  assert.ok(m.codenaam, 'de codenaam is bekend');
  const a = await m.start();
  const geef = await api('/api/office/boardroom/toegang/geef', { codenaam: m.codenaam }, eig);
  assert.equal(geef.status, 200, JSON.stringify(geef.body));
  assert.equal((await api('/api/office/mensdeur', {}, a)).status, 200, 'met toegang komt hij de boardroom in');
  const weg = await api('/api/office/boardroom/toegang/weg', { codenaam: m.codenaam }, eig);
  assert.equal(weg.status, 200, JSON.stringify(weg.body));
  assert.equal(weg.body.sessiesGesloten, 1);
  assert.equal((await api('/api/office/state', {}, a)).status, 401, 'niet alleen de kamer, ook de deur is dicht');
  assert.equal((await api('/api/office/state', {}, eig)).status, 200, 'de eigenaar die intrekt blijft binnen');
  const opnieuw = await m.start();
  assert.equal((await api('/api/office/state', {}, opnieuw)).status, 200, 'met de kantoorrol kan hij gewoon opnieuw binnen');
  assert.equal((await api('/api/office/mensdeur', {}, opnieuw)).status, 403, 'maar de boardroom blijft dicht');
});

test('3. een baliezetel weghalen sluit de open kantoorsessie', async () => {
  const m = await medewerker();
  const key = 'user-' + m.id;
  const a = await m.start();
  assert.equal((await api('/api/office/balie/zetel', { key }, eig)).status, 200);
  assert.notEqual((await api('/api/office/balie/zoek', { codenaam: 'zz' }, a)).status, 403, 'met een zetel mag hij zoeken');
  const weg = await api('/api/office/balie/zetel', { key, weg: true }, eig);
  assert.equal(weg.status, 200, JSON.stringify(weg.body));
  assert.equal(weg.body.sessiesGesloten, 1);
  assert.equal((await api('/api/office/state', {}, a)).status, 401);
});

test('4. wie niets is ingetrokken, merkt niets', async () => {
  const blijft = await medewerker();
  const gaat = await medewerker();
  const a = await blijft.start();
  await gaat.start();
  await api('/api/account/ontkoppel', { rol: 'kantoor' }, gaat.lid);
  assert.equal((await api('/api/office/state', {}, a)).status, 200, 'de sessie van een collega blijft staan');
});

test('5. een stroom zwijgt zodra zijn sessie niet meer geldt, ook zonder expliciete sluiting', () => {
  const { EventEmitter } = require('events');
  const { maakSse } = require('../server/kern/sse');
  let lever = null;
  const sse = maakSse({ bus: { subscribe: (_k, f) => { lever = f; } } });
  const res = (naam) => { const r = new EventEmitter(); r.naam = naam; r.geschreven = []; r.dicht = false;
    r.write = (t) => { r.geschreven.push(t); return true; }; r.end = () => { r.dicht = true; }; return r; };
  let geldt = true;
  const a = res('a'), b = res('b');
  sse.sseClients.push({ office: true, res: a, geldig: () => geldt });
  sse.sseClients.push({ office: true, res: b });                // zonder geldig(): ongewijzigd gedrag
  lever({ doel: 'office', event: 'sync', data: { x: 1 } });
  assert.equal(a.geschreven.length, 1);
  geldt = false;
  lever({ doel: 'office', event: 'sync', data: { x: 2 } });
  assert.equal(a.geschreven.length, 1, 'na intrekking gaat er niets meer naar deze stroom');
  assert.equal(a.dicht, true, 'en hij wordt gesloten');
  assert.equal(sse.sseClients.some(c => c.res === a), false, 'en uit de lijst gehaald');
  assert.equal(b.geschreven.length, 2, 'een stroom zonder geldig() krijgt gewoon alles');
  const c = res('c');
  sse.sseClients.push({ office: true, res: c, geldig: () => { throw new Error('bron weg'); } });
  lever({ doel: 'office', event: 'sync', data: {} });
  assert.equal(c.geschreven.length, 0, 'een geldig() die gooit geldt als nee');
});
