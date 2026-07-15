/* Vastgoed: de makelaar biedt panden aan GERICHTE leden aan (of publiek),
   leden tonen interesse (bezichtiging) en doen een bod, de makelaar bevestigt
   met keyless toegang die alleen binnen het venster werkt, en behandelt het
   bod. Een niet-uitgenodigd lid ziet het gerichte aanbod niet.
   Draai: node --experimental-sqlite --test test/vastgoed.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vg-'));
let child, lidToken, lidCode, anderToken, managerToken, bezToken;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const reg = await json(await api('/api/auth/register', { name: 'Koper Lid', email: 'koper@x.nl', phone: '0612345690',
    password: 'geheim123', geboortedatum: '1980-01-01', tier: 'business', pasApp: 'business' }));
  lidToken = reg.token;
  lidCode = (await json(await api('/api/member/connections', {}, lidToken))).codename;
  const reg2 = await json(await api('/api/auth/register', { name: 'Ander Lid', email: 'ander@x.nl', phone: '0612345691',
    password: 'geheim123', geboortedatum: '1980-01-01', tier: 'business', pasApp: 'business' }));
  anderToken = reg2.token;
  const roster = await json(await api('/api/supplier/roster', { code: 'IBIZALIV' }));
  const man = roster.staff.find(x => x.role === 'manager');
  const bez = roster.staff.find(x => x.role !== 'manager');
  managerToken = (await json(await api('/api/supplier/login', { code: 'IBIZALIV', staffId: man.id, pin: '1234' }))).token;
  bezToken = (await json(await api('/api/supplier/login', { code: 'IBIZALIV', staffId: bez.id, pin: '5678' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('gericht aanbod: alleen het gekozen lid ziet het pand, een ander niet', async () => {
  // de villa (p1) gericht aan ons lid aanbieden
  const a = await json(await api('/api/supplier/aanbieding', { pandId: 'p1', codenamen: [lidCode] }, managerToken));
  assert.equal(a.aanbieding.aan, 1);
  const mijn = await json(await api('/api/vastgoed/aanbod', {}, lidToken));
  const villa = mijn.panden.find(p => p.id === 'p1');
  assert.ok(villa && villa.gericht, 'het gekozen lid ziet de villa als persoonlijk aanbod');
  assert.equal(villa.slaapkamers, 5);
  const ander = await json(await api('/api/vastgoed/aanbod', {}, anderToken));
  assert.ok(!ander.panden.some(p => p.id === 'p1'), 'een ander lid ziet het gerichte aanbod niet');
});

test('interesse (bezichtiging) kan alleen op een aan jou aangeboden pand', async () => {
  // een niet-aangeboden pand (p2) weigert interesse
  assert.equal((await api('/api/vastgoed/interesse', { supplierCode: 'IBIZALIV', pandId: 'p2', wens: 'zaterdag' }, lidToken)).status, 403);
  const r = await json(await api('/api/vastgoed/interesse', { supplierCode: 'IBIZALIV', pandId: 'p1', wens: 'zaterdagochtend' }, lidToken));
  assert.ok(r.ref);
  global.__bez = r.ref;
  // de makelaar ziet de open bezichtiging in de backoffice
  const ov = await json(await api('/api/supplier/vastgoed/overzicht', {}, bezToken));
  assert.equal(ov.stats.openBezichtigingen, 1);
  assert.ok(ov.bezichtigingen.some(b => b.ref === global.__bez && b.status === 'aangevraagd'));
});

test('bezichtiging bevestigen met keyless: toegang werkt alleen in het venster', async () => {
  // een moment in het verleden zodat het keyless-venster NU actief is (van = -30 min, tot = +120 min)
  const moment = new Date(Date.now() - 5 * 60000).toISOString().slice(0, 16);
  const bev = await api('/api/supplier/bezichtiging/beslis', { ref: global.__bez, actie: 'bevestigen', moment }, bezToken);
  assert.equal(bev.status, 200);
  // het lid ziet de bevestigde bezichtiging met actief keyless-venster
  const mijn = await json(await api('/api/vastgoed/aanbod', {}, lidToken));
  const b = mijn.bezichtigingen.find(x => x.ref === global.__bez);
  assert.equal(b.status, 'bevestigd');
  assert.ok(b.keyless && b.keyless.actiefNu, 'het keyless-venster is nu actief');
  // ontgrendelen lukt en geeft een code
  const open = await json(await api('/api/vastgoed/keyless', { ref: global.__bez }, lidToken));
  assert.ok(/^[A-Z2-9]{6}$/.test(open.code));
});

test('keyless buiten het venster wordt geweigerd', async () => {
  // nieuwe bezichtiging, bevestigd voor volgende week: venster nog niet open
  await api('/api/supplier/aanbieding', { pandId: 'p2', codenamen: [lidCode] }, managerToken);
  const r = await json(await api('/api/vastgoed/interesse', { supplierCode: 'IBIZALIV', pandId: 'p2' }, lidToken));
  const straks = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16);
  await api('/api/supplier/bezichtiging/beslis', { ref: r.ref, actie: 'bevestigen', moment: straks }, bezToken);
  const geweigerd = await api('/api/vastgoed/keyless', { ref: r.ref }, lidToken);
  assert.equal(geweigerd.status, 409, 'de toegang is nog niet open');
});

test('bod en tegenbod: makelaar behandelt het, pand gaat onder optie bij acceptatie', async () => {
  const bod = await json(await api('/api/vastgoed/bod', { supplierCode: 'IBIZALIV', pandId: 'p1', bedrag: 3200000 }, lidToken));
  assert.ok(bod.ref);
  // tegenbod
  const tb = await json(await api('/api/supplier/bod/beslis', { ref: bod.ref, actie: 'tegenbod', tegenbod: 3350000 }, managerToken));
  assert.equal(tb.status, 'tegenbod');
  // nieuw bod, nu accepteren
  const bod2 = await json(await api('/api/vastgoed/bod', { supplierCode: 'IBIZALIV', pandId: 'p1', bedrag: 3350000 }, lidToken));
  const acc = await json(await api('/api/supplier/bod/beslis', { ref: bod2.ref, actie: 'accepteren' }, managerToken));
  assert.equal(acc.status, 'geaccepteerd');
  const ov = await json(await api('/api/supplier/vastgoed/overzicht', {}, managerToken));
  assert.equal(ov.panden.find(p => p.id === 'p1').status, 'onder-optie', 'het pand staat onder optie');
  // een geaccepteerd bod maakt automatisch een (btw-vrije) koopfactuur voor beide partijen
  const supF = await json(await api('/api/supplier/facturen/mijn', {}, managerToken));
  const koop = supF.verkocht.find(f => f.totaal === 3350000);
  assert.ok(koop, 'de makelaar heeft een koopfactuur van de geaccepteerde koopsom');
  assert.equal(koop.btwBedrag, 0, 'vastgoed is btw-vrij op de koopsom');
  const lidF = await json(await api('/api/facturen/mijn', {}, lidToken));
  assert.ok(lidF.facturen.some(f => f.nummer === koop.nummer), 'de koper ontvangt dezelfde factuur');
});

test('publiek aanbod is voor iedereen zichtbaar; een nieuw pand kan de makelaar toevoegen', async () => {
  const p = await json(await api('/api/supplier/pand', { titel: 'Bouwgrond Es Cubells', soort: 'grond', transactie: 'koop',
    prijs: 750000, plaats: 'Es Cubells', oppervlakte: 0, perceel: 5000 }, managerToken));
  const nieuw = p.panden.find(x => x.titel === 'Bouwgrond Es Cubells');
  assert.ok(nieuw);
  await api('/api/supplier/aanbieding', { pandId: nieuw.id, publiek: true }, managerToken);
  const ander = await json(await api('/api/vastgoed/aanbod', {}, anderToken));
  assert.ok(ander.panden.some(x => x.id === nieuw.id && !x.gericht), 'het publieke aanbod is voor iedereen zichtbaar');
});
