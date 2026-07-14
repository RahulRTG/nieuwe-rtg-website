/* RTG Boardroom: de complete schakelkast. Elke functie heeft een stoplicht-status
   (aan/uit/storing), de eigenaar schakelt direct, kan een storing melden, alles
   resetten en de AI om een voorstel vragen. Een uitgezette functie wordt door de
   middleware echt geblokkeerd. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const OWNER = 'boardroom-owner@x.nl';

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, owner, lidToken;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-board-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: OWNER } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  // het eigenaar-account wordt in demo-modus geseed met e-mail = RTG_OWNER_EMAIL
  // en wachtwoord DEMO_PASS (standaard 'Imran'); daarmee loggen we in.
  const li = await api(base, '/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' });
  owner = li.body.token;
  // een gewoon lid (geen eigenaar) voor de toegangstest
  const reg = await api(base, '/api/auth/register', { name: 'Gewoon Lid', email: 'g' + u + '@x.nl',
    phone: '067' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  lidToken = reg.body.token;
});
test.after(() => stop(srv && srv.child));

test('1. de eigenaar logt in en ziet alle functies groen (standaard aan)', async () => {
  const st = await api(base, '/api/boardroom/status', {}, owner);
  assert.equal(st.status, 200);
  assert.equal(st.body.eigenaar, true);
  assert.ok(st.body.samenvatting.totaal >= 20, 'een flink aantal functies');
  assert.equal(st.body.samenvatting.uit, 0, 'standaard staat alles aan');
  assert.equal(st.body.samenvatting.storing, 0);
  // elke functie heeft een geldige stoplicht-status
  const alle = st.body.functies.flatMap(g => g.functies);
  assert.ok(alle.every(f => ['aan', 'uit', 'storing'].includes(f.status)));
  assert.ok(alle.some(f => f.id === 'charter') && alle.some(f => f.id === 'ontmoetingen'), 'nieuwe genres staan erin');
});

test('2. een functie uitzetten kleurt hem rood en blokkeert hem echt', async () => {
  const zet = await api(base, '/api/boardroom/zet', { id: 'charter', aan: false }, owner);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.status, 'uit');
  // de middleware blokkeert nu het charter-pad (503), ook zonder inlog
  const geblokt = await api(base, '/api/charter/aanbod', { city: 'Ibiza' });
  assert.equal(geblokt.status, 503, 'charter is uitgeschakeld');
  assert.equal(geblokt.body.functie, 'charter');
  const st = await api(base, '/api/boardroom/status', {}, owner);
  assert.equal(st.body.samenvatting.uit, 1);
});

test('3. een storing melden kleurt de functie oranje maar blokkeert niet', async () => {
  const s = await api(base, '/api/boardroom/storing', { id: 'retail', storing: true, reden: 'Catalogus laadt traag' }, owner);
  assert.equal(s.status, 200);
  assert.equal(s.body.status, 'storing');
  // retail blijft bereikbaar (storing is alleen een statusvlag)
  const cat = await api(base, '/api/retail/catalogus', {}, lidToken);
  assert.notEqual(cat.status, 503, 'een storing blokkeert het verkeer niet');
  const st = await api(base, '/api/boardroom/status', {}, owner);
  assert.ok(st.body.samenvatting.storing >= 1);
});

test('4. uit wint van storing (rood boven oranje)', async () => {
  await api(base, '/api/boardroom/storing', { id: 'tickets', storing: true, reden: 'x' }, owner);
  await api(base, '/api/boardroom/zet', { id: 'tickets', aan: false }, owner);
  const st = await api(base, '/api/boardroom/status', {}, owner);
  const tickets = st.body.functies.flatMap(g => g.functies).find(f => f.id === 'tickets');
  assert.equal(tickets.status, 'uit', 'een uitgezette functie is rood, ook met een storing');
});

test('5. reset zet alles terug naar de standaard (alles groen)', async () => {
  const r = await api(base, '/api/boardroom/reset', {}, owner);
  assert.equal(r.status, 200);
  assert.equal(r.body.samenvatting.uit, 0);
  assert.equal(r.body.samenvatting.storing, 0);
  // charter werkt weer (niet meer 503)
  const na = await api(base, '/api/charter/aanbod', { city: 'Ibiza' });
  assert.notEqual(na.status, 503, 'na reset is charter weer aan');
});

test('6. AI-hulp stelt een wijziging voor uit gewone taal', async () => {
  const ai = await api(base, '/api/boardroom/ai', { vraag: 'zet de charter uit' }, owner);
  assert.equal(ai.status, 200);
  assert.ok(Array.isArray(ai.body.voorstel));
  assert.ok(ai.body.voorstel.some(w => w.id === 'charter' && w.aan === false), 'stelt voor charter uit te zetten');
  // en toepassen voert het door
  const toe = await api(base, '/api/boardroom/toepassen', { voorstel: ai.body.voorstel }, owner);
  assert.equal(toe.status, 200);
  assert.ok(toe.body.toegepast >= 1);
  await api(base, '/api/boardroom/reset', {}, owner); // opruimen
});

test('7. een gewoon lid heeft geen toegang tot de schakelaars', async () => {
  const zet = await api(base, '/api/boardroom/zet', { id: 'charter', aan: false }, lidToken);
  assert.ok(zet.status === 403 || zet.status === 401, 'geen toegang zonder eigenaarsrecht');
});
