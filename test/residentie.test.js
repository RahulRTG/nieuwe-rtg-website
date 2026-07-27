/* De Residence: het virtuele grandhotel. Toegang (leden wel, gasten niet),
   bewegen door de zaal (grid, meubels blokkeren, zitmeubels laten zitten),
   praten en emotes, de eigen suite met het RTG Maison-atelier (open/dicht
   voor bezoek) en de gids. Privacy: alles op codenaam, echte namen komen
   in geen enkel antwoord voor. Draai: npm test */
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
const ECHT = 'Reinout Testenaar';

let srv, base, a, b, gast;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-residentie-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-RES' } });
  base = srv.base;
  const reg = async (n) => {
    const u = (Date.now() + n).toString().slice(-8);
    const r = await api(base, '/api/auth/register', { name: ECHT + ' ' + n, email: 'res' + n + u + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    return { token: r.body.token, codenaam: r.body.member && r.body.member.codename };
  };
  a = await reg(1); b = await reg(2);
  gast = { token: (await api(base, '/api/login', { tier: 'guest' })).body.token };
});
test.after(() => stop(srv && srv.child));

test('toegang en privacy: leden op codenaam, gasten niet, echte namen nooit', async () => {
  assert.equal((await api(base, '/api/residentie/betreed', { kamer: 'lobby' }, gast.token)).status, 403);
  const inA = await api(base, '/api/residentie/betreed', { kamer: 'lobby' }, a.token);
  assert.equal(inA.status, 200);
  assert.ok(inA.body.ik && inA.body.ik === inA.body.leden[0].codenaam);
  const inB = await api(base, '/api/residentie/betreed', { kamer: 'lobby' }, b.token);
  assert.ok(inB.body.leden.some(l => l.codenaam === inA.body.ik));
  assert.equal((await api(base, '/api/residentie/betreed', { kamer: 'kelder' }, a.token)).status, 404);
  assert.ok(!JSON.stringify(inB.body).includes(ECHT), 'echte naam mag nergens verschijnen');
});

test('bewegen: binnen het grid, meubels blokkeren, zitmeubels laten zitten', async () => {
  assert.equal((await api(base, '/api/residentie/stap', { x: 99, y: 99 }, a.token)).status, 400);
  const vrij = await api(base, '/api/residentie/stap', { x: 7, y: 5 }, a.token);
  assert.equal(vrij.status, 200); assert.equal(vrij.body.zit, false);
  assert.equal((await api(base, '/api/residentie/stap', { x: 6, y: 3 }, a.token)).status, 409); // de fontein
  const zit = await api(base, '/api/residentie/stap', { x: 2, y: 2 }, a.token); // de bank
  assert.equal(zit.body.zit, true);
});

test('praten en emotes: chat op codenaam, alleen huisstijl-glyfen', async () => {
  assert.equal((await api(base, '/api/residentie/zeg', { tekst: '' }, a.token)).status, 400);
  assert.equal((await api(base, '/api/residentie/zeg', { tekst: 'Goedenavond allen' }, a.token)).status, 200);
  assert.equal((await api(base, '/api/residentie/emote', { glyf: '♥' }, b.token)).status, 200);
  const p = await api(base, '/api/residentie/pols', {}, b.token);
  const regel = p.body.chat.find(c => c.tekst === 'Goedenavond allen');
  assert.ok(regel && regel.codenaam && !regel.codenaam.includes(ECHT));
});

test('de suite: inrichten met het atelier, open of dicht voor bezoek', async () => {
  const su = await api(base, '/api/residentie/suite', {}, a.token);
  assert.equal(su.status, 200);
  assert.ok(su.body.suite.adres.startsWith('suite:') && su.body.catalogus.length >= 10);
  assert.equal((await api(base, '/api/residentie/suite/zet', { naam: 'Salon Prive' }, a.token)).body.suite.naam, 'Salon Prive');
  assert.equal((await api(base, '/api/residentie/meubel/zet', { soort: 'fauteuil', x: 1, y: 1 }, a.token)).status, 200);
  assert.equal((await api(base, '/api/residentie/meubel/zet', { soort: 'bank', x: 9, y: 7 }, a.token)).status, 400, 'buiten het raster');
  assert.equal((await api(base, '/api/residentie/meubel/zet', { soort: 'troon', x: 1, y: 4 }, a.token)).status, 400, 'onbekend meubel');
  const eigen = await api(base, '/api/residentie/betreed', { kamer: su.body.suite.adres }, a.token);
  assert.equal(eigen.body.kamer.eigen, true);
  const bezoek = await api(base, '/api/residentie/betreed', { kamer: su.body.suite.adres }, b.token);
  assert.equal(bezoek.status, 200); assert.equal(bezoek.body.kamer.eigen, false);
  await api(base, '/api/residentie/suite/zet', { open: false }, a.token);
  assert.equal((await api(base, '/api/residentie/betreed', { kamer: su.body.suite.adres }, b.token)).status, 403, 'dicht is dicht');
  assert.equal((await api(base, '/api/residentie/suite', {}, gast.token)).status, 403, 'gast heeft geen suite');
  assert.equal((await api(base, '/api/residentie/meubel/weg', { i: 0 }, a.token)).status, 200);
});

test('de gids: vier zalen met wie er is, en open suites op codenaam', async () => {
  await api(base, '/api/residentie/suite/zet', { open: true }, a.token);
  const ik = (await api(base, '/api/residentie/betreed', { kamer: 'lobby' }, a.token)).body.ik;
  await api(base, '/api/residentie/betreed', { kamer: 'bar' }, b.token);
  const g = await api(base, '/api/residentie/gids', {}, b.token);
  assert.equal(g.status, 200);
  assert.equal(g.body.zalen.length, 4);
  assert.ok(g.body.zalen.find(z => z.id === 'bar').aanwezig >= 1);
  const mijn = g.body.suites.find(s => s.adres === 'suite:' + ik);
  assert.ok(mijn && mijn.naam === 'Salon Prive');
  assert.ok(!JSON.stringify(g.body).includes(ECHT));
  assert.equal((await api(base, '/api/residentie/weg', {}, b.token)).status, 200);
});
