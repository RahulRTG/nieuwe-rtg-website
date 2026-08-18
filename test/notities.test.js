/* Notities & Taken: het bord, samen werken op codenaam, en de herinnering
   die een gekoppelde agenda-afspraak wordt (een wekkerlaag, niet drie).
   Draai los: node --test test/notities.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lidA, lidB, codeB;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-notities-'));

function api(pad, body, token) {
  return fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Bordlid ' + seq, email: 'nt' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, codenaam: st.body.state.user.codename };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const a = await lid(); const b = await lid();
  lidA = a.token; lidB = b.token; codeB = b.codenaam;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. notitie en lijst op het bord: bewaren, vastpinnen, archief is de la', async () => {
  const n = await api('/api/notities/bewaar', { soort: 'notitie', titel: 'Idee', tekst: 'Het strandhuis in mei.' }, lidA);
  assert.equal(n.status, 200);
  const l = await api('/api/notities/bewaar', { soort: 'lijst', titel: 'Inpakken',
    items: [{ t: 'Paspoort' }, { t: 'Lader' }, { t: '' }] }, lidA);
  assert.equal(l.status, 200);
  await api('/api/notities/bewaar', { id: n.body.id, vast: true }, lidA);
  let m = await api('/api/notities/mijn', {}, lidA);
  assert.equal(m.body.eigen[0].titel, 'Idee', 'vastgepind staat bovenaan');
  assert.equal(m.body.eigen[1].items.length, 2, 'lege punten worden geen punten');

  // archiveren haalt niets weg; het staat in de la
  await api('/api/notities/bewaar', { id: n.body.id, archief: true }, lidA);
  m = await api('/api/notities/mijn', {}, lidA);
  const idee = m.body.eigen.find(x => x.id === n.body.id);
  assert.equal(idee.archief, true);
  assert.equal(idee.tekst, 'Het strandhuis in mei.', 'de inhoud is er nog');
});

test('2. delen op codenaam is samen werken: B vinkt af en vult aan, A ziet het', async () => {
  const l = await api('/api/notities/bewaar', { soort: 'lijst', titel: 'Boodschappen',
    items: [{ t: 'Citroenen' }, { t: 'IJs' }] }, lidA);
  const id = l.body.id;
  const d = await api('/api/notities/deel', { id, codenaam: codeB }, lidA);
  assert.equal(d.status, 200);

  const mb = await api('/api/notities/mijn', {}, lidB);
  const gedeeld = mb.body.gedeeld.find(x => x.id === id);
  assert.ok(gedeeld, 'B ziet de lijst');
  assert.ok(!/Bordlid/.test(JSON.stringify(mb.body)), 'nergens een echte naam');

  assert.equal((await api('/api/notities/vink', { id, index: 0, af: true }, lidB)).status, 200);
  await api('/api/notities/bewaar', { id, titel: 'Boodschappen',
    items: [{ t: 'Citroenen', af: true }, { t: 'IJs' }, { t: 'Basilicum' }] }, lidB);
  const ma = await api('/api/notities/mijn', {}, lidA);
  const bijA = ma.body.eigen.find(x => x.id === id);
  assert.equal(bijA.items[0].af, true, 'het vinkje van B staat bij A');
  assert.equal(bijA.items.length, 3, 'het punt van B staat bij A');

  // vastpinnen blijft van de eigenaar: B mag dat niet zetten
  await api('/api/notities/bewaar', { id, vast: true }, lidB);
  const ma2 = await api('/api/notities/mijn', {}, lidA);
  assert.equal(ma2.body.eigen.find(x => x.id === id).vast, false, 'het bord blijft van de eigenaar');

  // B haalt zichzelf eraf; A houdt de lijst gewoon
  await api('/api/notities/weg', { id }, lidB);
  const mb2 = await api('/api/notities/mijn', {}, lidB);
  assert.ok(!mb2.body.gedeeld.find(x => x.id === id));
  assert.ok((await api('/api/notities/mijn', {}, lidA)).body.eigen.find(x => x.id === id));
});

test('3. een datum en tijd wordt een gekoppelde agenda-afspraak; weghalen ruimt hem op', async () => {
  const n = await api('/api/notities/bewaar', { soort: 'notitie', titel: 'Wijn ophalen',
    tekst: 'Bij de kelder.', herinnerOp: '2026-12-05', herinnerTijd: '11:00' }, lidA);
  let ag = await api('/api/agenda/bereik', { van: '2026-12-01', tot: '2026-12-31' }, lidA);
  const af = ag.body.items.find(x => x.titel === 'Wijn ophalen');
  assert.ok(af, 'de afspraak staat in de agenda');
  assert.equal(af.tijd, '11:00');
  assert.equal(af.herinner, 0, 'het seintje komt van de agenda-laag');

  // de datum verzetten verzet de afspraak (geen tweede exemplaar)
  await api('/api/notities/bewaar', { id: n.body.id, herinnerOp: '2026-12-06', herinnerTijd: '09:30' }, lidA);
  ag = await api('/api/agenda/bereik', { van: '2026-12-01', tot: '2026-12-31' }, lidA);
  const alle = ag.body.items.filter(x => x.titel === 'Wijn ophalen');
  assert.equal(alle.length, 1, 'verzetten is verzetten, niet verdubbelen');
  assert.equal(alle[0].datum, '2026-12-06');

  // de notitie weggooien neemt de afspraak mee
  await api('/api/notities/weg', { id: n.body.id }, lidA);
  ag = await api('/api/agenda/bereik', { van: '2026-12-01', tot: '2026-12-31' }, lidA);
  assert.ok(!ag.body.items.find(x => x.titel === 'Wijn ophalen'), 'geen wees-afspraak achtergelaten');
});
