/* Vakwerk Pro, laag 2: team-capaciteit (overlappende boekingen tot het aantal
   vaklieden), vaste afspraken (ritmes die de volgende afspraak inplannen, door
   beide kanten te stoppen), de wachtlijst met automatisch seintje bij een
   vrijgekomen plek, en beoordelingen na een afgeronde klus (een per klus, op
   codenaam, score op het Dienstenplein). Draai: npm test */
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
const dag = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);

let srv, base, lid, lid2, zaak;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vakpro2-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-PRO-2' } });
  base = srv.base;
  const reg = async (n) => {
    const u = (Date.now() + n).toString().slice(-8);
    const r = await api(base, '/api/auth/register', { name: 'Prolid' + n, email: 'q' + n + u + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    return { token: r.body.token };
  };
  lid = await reg(1); lid2 = await reg(2);
  const roster = await api(base, '/api/supplier/roster', { code: 'VERDIA' });
  const mgr = (roster.body.staff || []).find(x => x.role === 'manager');
  const login = await api(base, '/api/supplier/login', { code: 'VERDIA', staffId: mgr && mgr.id, pin: '1234' });
  zaak = { token: login.body.token };
});
test.after(() => stop(srv && srv.child));

async function boekBetaald(svc, tijd, wie) {
  const r = await api(base, '/api/booking/request', { supplierCode: 'VERDIA', serviceId: svc, date: dag, time: tijd }, wie.token);
  assert.equal(r.status, 200);
  await api(base, '/api/booking/pay', { ref: r.body.boeking.ref }, wie.token);
  return r.body.boeking.ref;
}

test('1. team-capaciteit: zoveel vaklieden, zoveel overlappende boekingen', async () => {
  assert.equal((await api(base, '/api/supplier/vak/capaciteit', { capaciteit: 1 }, zaak.token)).status, 200);
  let slots = await api(base, '/api/booking/slots', { supplierCode: 'VERDIA', serviceId: 'h1', date: dag }, lid.token);
  const t1 = slots.body.tijden[0];
  await boekBetaald('h1', t1, lid);
  slots = await api(base, '/api/booking/slots', { supplierCode: 'VERDIA', serviceId: 'h1', date: dag }, lid.token);
  assert.ok(!slots.body.tijden.includes(t1), 'bij capaciteit 1 is de tijd bezet');
  const cap = await api(base, '/api/supplier/vak/capaciteit', { capaciteit: 2 }, zaak.token);
  assert.equal(cap.body.uren.capaciteit, 2);
  slots = await api(base, '/api/booking/slots', { supplierCode: 'VERDIA', serviceId: 'h1', date: dag }, lid.token);
  assert.ok(slots.body.tijden.includes(t1), 'bij capaciteit 2 kan een tweede vakman dezelfde tijd aan');
});

test('2. vaste afspraak: de motor plant, beide kanten kunnen stoppen', async () => {
  const r = await api(base, '/api/vak/ritme/start',
    { supplierCode: 'VERDIA', serviceId: 'h1', intervalWeken: 2, tijd: '11:00', start: dag }, lid.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.boeking.status, 'aangevraagd', 'de eerste afspraak staat als aanvraag klaar');
  assert.ok(String(r.body.boeking.wanneer).startsWith(dag));
  const pro = await api(base, '/api/supplier/vak/pro', {}, zaak.token);
  assert.ok(pro.body.ritmes.some(x => x.id === r.body.ritme.id), 'de zaak ziet het ritme op codenaam');
  const stop2 = await api(base, '/api/vak/ritme/stop', { id: r.body.ritme.id }, lid.token);
  assert.equal(stop2.status, 200);
  const mijn = await api(base, '/api/vak/ritmes/mijn', {}, lid.token);
  assert.ok(!mijn.body.ritmes.some(x => x.id === r.body.ritme.id), 'gestopt is gestopt');
});

test('3. wachtlijst: bij een vrijgekomen plek krijgt de eerste vanzelf bericht', async () => {
  assert.equal((await api(base, '/api/vak/wachtlijst/zet',
    { supplierCode: 'VERDIA', serviceId: 'h1', datum: dag }, lid2.token)).status, 200);
  // dubbel op dezelfde dag kan niet
  assert.equal((await api(base, '/api/vak/wachtlijst/zet',
    { supplierCode: 'VERDIA', serviceId: 'h1', datum: dag }, lid2.token)).status, 409);
  const ref = await boekBetaald('h3', '15:00', lid);
  await api(base, '/api/supplier/booking/status', { ref, status: 'geweigerd' }, zaak.token);
  const pro = await api(base, '/api/supplier/vak/pro', {}, zaak.token);
  const w = pro.body.wachtlijst.find(x => x.datum === dag);
  assert.ok(w && w.uitgenodigd, 'de wachtende is automatisch uitgenodigd; boeken doet het lid zelf');
});

test('4. beoordelingen: na afronding, een per klus, score op het Dienstenplein', async () => {
  const ref = await boekBetaald('h1', '16:00', lid);
  await api(base, '/api/supplier/booking/status', { ref, status: 'bevestigd' }, zaak.token);
  await api(base, '/api/supplier/booking/status', { ref, status: 'afgerond' }, zaak.token);
  const open = await api(base, '/api/vak/reviews/open', {}, lid.token);
  assert.ok(open.body.open.some(o => o.ref === ref), 'de afgeronde klus vraagt om een beoordeling');
  const rev = await api(base, '/api/vak/review', { supplierCode: 'VERDIA', ref, sterren: 5, tekst: 'Prachtig werk' }, lid.token);
  assert.equal(rev.status, 200);
  assert.equal(rev.body.score.score, 5);
  assert.equal((await api(base, '/api/vak/review', { supplierCode: 'VERDIA', ref, sterren: 1 }, lid.token)).status, 409, 'een per klus');
  const mall = await api(base, '/api/mall', {}, lid.token);
  const kraam = (mall.body.diensten || []).flatMap(g => g.zaken).find(z => z.code === 'VERDIA');
  assert.ok(kraam.beoordeling && kraam.beoordeling.score === 5 && kraam.beoordeling.aantal === 1,
    'het Dienstenplein toont de score');
  assert.ok(!JSON.stringify(mall.body.diensten).includes('Prolid'), 'nergens echte namen');
});
