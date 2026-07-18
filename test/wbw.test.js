/* Wie betaalt wat: het gedeelde uitgavenlijstje van Salon-vrienden. Uitgaven
   worden sluitend verdeeld in centen; de balans klopt altijd op nul; wie rood
   staat betaalt het eigen deel in een tik via RTG Pay (idempotent); wie
   tegoed heeft stuurt Klompjes. Draai los:
   node --experimental-sqlite --test test/wbw.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, a, b, c, groepId;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wbw-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Lid ' + seq, email: 'w' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, codenaam: st.body.state.user.codename };
}
async function keyVan(x) {
  const zoek = await api('/api/member/find', { q: x.codenaam }, a.token);
  return (zoek.body.results || [])[0].key;
}
async function verbind(van, naar) {
  const zoek = await api('/api/member/find', { q: naar.codenaam }, van.token);
  const k = (zoek.body.results || [])[0].key;
  await api('/api/member/connect', { key: k }, van.token);
  const zoek2 = await api('/api/member/find', { q: van.codenaam }, naar.token);
  await api('/api/member/connect/respond', { key: (zoek2.body.results || [])[0].key, action: 'accept' }, naar.token);
  return k;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  a = await lid(); b = await lid(); c = await lid();
  b.key = await verbind(a, b);
  c.key = await verbind(a, c);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een lijstje bestaat uit Salon-vrienden; buitenstaanders zien niets', async () => {
  const vreemd = await api('/api/wbw/maak', { naam: 'Test', leden: ['user-999999'] }, a.token);
  assert.equal(vreemd.status, 403, 'alleen echte vrienden kunnen erin');
  const r = await api('/api/wbw/maak', { naam: 'Weekend Ibiza', leden: [b.key, c.key] }, a.token);
  assert.equal(r.status, 200);
  groepId = r.body.groep.id;
  assert.equal(r.body.groep.leden.length, 3);
  const d = await lid();
  const dicht = await api('/api/wbw/groep', { id: groepId }, d.token);
  assert.equal(dicht.status, 404, 'wie er niet in zit, ziet het lijstje niet');
});

test('2. uitgaven worden sluitend verdeeld en de balans telt altijd op naar nul', async () => {
  const r1 = await api('/api/wbw/uitgave', { id: groepId, oms: 'Diner strandclub', centen: 30000 }, a.token);
  assert.equal(r1.status, 200);
  // 100,01 voor drie personen: de centen moeten sluitend verdeeld worden
  await api('/api/wbw/uitgave', { id: groepId, oms: 'Taxi', centen: 10001 }, b.token);
  const g = (await api('/api/wbw/groep', { id: groepId }, a.token)).body.groep;
  const som = g.leden.reduce((n, l) => n + l.saldo, 0);
  assert.equal(som, 0, 'de balans telt altijd op naar nul, ook met scheve bedragen');
  const mijA = g.leden.find(l => l.ik);
  assert.equal(mijA.saldo, 30000 - 10000 - 3334, 'A betaalde 300, at voor 100 mee en reed voor 33,34 mee (eerste in het rijtje draagt de restcent)');
});

test('3. wie rood staat betaalt het eigen deel in een tik, en dubbeltikken boekt niet dubbel', async () => {
  const gC = (await api('/api/wbw/groep', { id: groepId }, c.token)).body.groep;
  const schuldC = -gC.mijnSaldo;
  assert.ok(schuldC > 0, 'C staat rood (heeft niets voorgeschoten)');
  const nietRood = await api('/api/wbw/verreken', { id: groepId, idem: 'x0' }, a.token);
  assert.equal(nietRood.status, 409, 'wie niet rood staat heeft niets te verrekenen');
  const v = await api('/api/wbw/verreken', { id: groepId, idem: 'x1' }, c.token);
  assert.equal(v.status, 200);
  assert.ok(v.body.betalingen.length >= 1, 'de schuld gaat in zo min mogelijk overboekingen naar wie tegoed had');
  assert.equal(v.body.groep.mijnSaldo, 0, 'na de tik staat C op nul');
  const opnieuw = await api('/api/wbw/verreken', { id: groepId, idem: 'x1' }, c.token);
  assert.equal(opnieuw.status, 409, 'nogmaals verrekenen kan niet: er is geen schuld meer');
  // het geld staat echt in de wallet van A (RTG Pay)
  const payA = await api('/api/pay/overzicht', {}, a.token);
  assert.ok(payA.body.saldo > 0, 'het verrekende bedrag staat echt bij A in RTG Pay');
});

test('4. wie tegoed heeft stuurt nette Klompjes naar wie rood staat', async () => {
  const gA = (await api('/api/wbw/groep', { id: groepId }, a.token)).body.groep;
  if (gA.mijnSaldo > 0) {
    const r = await api('/api/wbw/verzoek', { id: groepId }, a.token);
    assert.equal(r.status, 200);
    assert.ok(r.body.verzoeken >= 1, 'er gaan betaalverzoeken naar wie rood staat');
    const roodLid = gA.leden.find(l => !l.ik && l.saldo < 0);
    const wieB = roodLid.codenaam === b.codenaam ? b : c;
    const verz = await api('/api/pay/overzicht', {}, wieB.token);
    assert.ok((verz.body.aanMij || []).length >= 1, 'het Klompje staat klaar bij de schuldenaar');
  } else {
    const r = await api('/api/wbw/verzoek', { id: groepId }, a.token);
    assert.equal(r.status, 409);
  }
});
