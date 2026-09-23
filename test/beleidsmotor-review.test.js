/* DE TOEGANGSREVIEW (AUTHORITY.md fase 8).

   Vijf dingen die niet mogen sneuvelen:
   1. de review is een lijst mensen: de gedeelde code komt er niet bij, en zonder
      reden gaat hij niet open;
   2. elke houder staat erin met zijn zetels en sinds wanneer, en met wat de
      deuren voor hem zouden besluiten -- een kantoorrol alleen opent de
      kantoordeur en niet de boardroom;
   3. een boardroomsleutel geven verandert het gesimuleerde besluit, intrekken
      zet het terug (de review LEEST de bron, hij houdt geen kopie);
   4. een baliezetel zonder kantoorrol wordt gemeld als zetel zonder deur, en
      niet verborgen;
   5. onder een liegende opslag komt er geen lijst: het spoor moet vaststaan
      voordat de review wordt samengesteld.

   Draai los: node --test test/beleidsmotor-review.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const CODE = 'REVIEW-KANTOOR';
const REDEN = 'Kwartaalreview van de kantoortoegang';
const mappen = [];
const verseMap = () => { const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-review-')); mappen.push(m); return m; };
function api(base, pad, body, token) {
  return fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let eerlijk, leugen, gedeeld, eig, eigLeugen;
let n = 0;
async function medewerker(base, kantoorrol) {
  n += 1;
  const reg = (await api(base, '/api/auth/register', { name: 'Review Toets ' + n, email: 'review' + n + Date.now() + '@voorbeeld.test',
    password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' })).body;
  assert.ok(reg.token, 'registreren lukt');
  if (kantoorrol) assert.equal((await api(base, '/api/account/koppel', { soort: 'kantoor', code: CODE }, reg.token)).status, 200);
  await api(base, '/api/auth/me', {}, reg.token);
  const u = (reg.state && reg.state.user) || {};
  return { key: 'user-' + u.id, codenaam: u.codename };
}
const review = (base, token, body) => api(base, '/api/office/beleidsmotor/review', body === undefined ? { reden: REDEN } : body, token);
const rij = (r, key) => (r.body.houders || []).find(h => h.key === key);

test.before(async () => {
  eerlijk = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap(), OFFICE_CODE: CODE } });
  leugen = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap(), OFFICE_CODE: CODE, RTG_VERRAAD: 'schrijf-verloren' } });
  gedeeld = (await api(eerlijk.base, '/api/office/login', { code: CODE })).body.token;
  eig = await kantoorAlsPersoon(eerlijk.base, CODE);
  eigLeugen = await kantoorAlsPersoon(leugen.base, CODE);
  assert.ok(gedeeld && eig && eigLeugen);
});
test.after(() => {
  stop(eerlijk && eerlijk.child);
  stop(leugen && leugen.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('1. de gedeelde code ziet geen review, en zonder reden gaat hij niet open', async () => {
  assert.equal((await review(eerlijk.base, gedeeld)).status, 403);
  const zonder = await review(eerlijk.base, eig, {});
  assert.equal(zonder.status, 400);
  assert.match(zonder.body.error, /reden/);
});

test('2-4. houders, zetels en de gesimuleerde deuren', async () => {
  const m = await medewerker(eerlijk.base, true);
  const balieZonderRol = await medewerker(eerlijk.base, false);
  assert.equal((await api(eerlijk.base, '/api/office/balie/zetel', { key: balieZonderRol.key }, eig)).status, 200);

  const r1 = await review(eerlijk.base, eig);
  assert.equal(r1.status, 200, JSON.stringify(r1.body).slice(0, 200));
  const h = rij(r1, m.key);
  assert.ok(h, 'de medewerker met de kantoorrol staat in de review');
  assert.equal(h.codenaam, m.codenaam, 'onder zijn codenaam, en nooit onder een naam');
  assert.deepEqual(h.zetels.map(z => z.soort), ['kantoorrol']);
  assert.ok(h.zetels[0].sinds, 'met sinds wanneer');
  assert.equal(h.deuren.kantoor, 'TOESTAAN');
  assert.equal(h.deuren['op-naam'], 'TOESTAAN');
  assert.equal(h.deuren.boardroom, 'WEIGEREN', 'een kantoorrol is nog geen boardroom');
  assert.equal(h.zetelZonderDeur, false);
  const eigenaar = r1.body.houders.find(x => x.eigenaar);
  assert.ok(eigenaar && eigenaar.deuren.boardroom === 'TOESTAAN', 'de eigenaar staat erin en komt overal in');

  const b = rij(r1, balieZonderRol.key);
  assert.ok(b, 'een baliezetel zonder kantoorrol wordt niet verborgen');
  assert.equal(b.zetelZonderDeur, true, 'en wordt gemeld als zetel zonder deur');
  assert.equal(b.deuren.kantoor, 'WEIGEREN');

  assert.equal((await api(eerlijk.base, '/api/office/boardroom/toegang/geef', { codenaam: m.codenaam }, eig)).status, 200);
  const r2 = await review(eerlijk.base, eig);
  assert.equal(rij(r2, m.key).deuren.boardroom, 'TOESTAAN', 'de review leest de bron, dus de sleutel telt meteen');
  assert.deepEqual(rij(r2, m.key).zetels.map(z => z.soort).sort(), ['boardroom', 'kantoorrol']);
  assert.equal((await api(eerlijk.base, '/api/office/boardroom/toegang/weg', { codenaam: m.codenaam }, eig)).status, 200);
  assert.equal(rij(await review(eerlijk.base, eig), m.key).deuren.boardroom, 'WEIGEREN', 'en intrekken zet hem terug');

  const codes = r2.body.houders.map(x => x.codenaam || x.key);
  assert.deepEqual(codes, codes.slice().sort((a, c) => String(a).localeCompare(String(c))), 'gesorteerd op codenaam en op niets anders');
});

test('5. onder een liegende opslag komt er geen lijst', async () => {
  const r = await review(leugen.base, eigLeugen);
  assert.ok(r.status >= 500, 'de review gaf ' + r.status + ' terwijl het spoor niet vaststaat');
  assert.ok(!r.body.houders, 'er is een lijst mensen meegestuurd zonder spoor');
  assert.equal(r.body.spoor, 'niet-bevestigd');
});
