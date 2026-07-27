/* Het bouw-genre (timmerman, loodgieter, elektricien op de vakwerk-motor) en
   het Dienstenplein in de RTG Mall: elke dienstverlener biedt er zijn aanbod
   aan, elk leverancier-genre heeft een plek in de gids, en boeken loopt op
   codenaam via de gewone boekroute. Draai: npm test */
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
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

let srv, base, lid, zaak;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bouw-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-BOUW-1' } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Bouwtest', email: 'b' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = { token: reg.body.token };
  const roster = await api(base, '/api/supplier/roster', { code: 'CASTELL' });
  const mgr = (roster.body.staff || []).find(x => x.role === 'manager');
  const login = await api(base, '/api/supplier/login', { code: 'CASTELL', staffId: mgr && mgr.id, pin: '1234' });
  zaak = { token: login.body.token };
});
test.after(() => stop(srv && srv.child));

test('1. de demo-zaak Castell bestaat als bouw-genre met eigen personeel', async () => {
  const roster = await api(base, '/api/supplier/roster', { code: 'CASTELL' });
  assert.equal(roster.status, 200);
  const namen = (roster.body.staff || []).map(x => x.name);
  assert.ok(namen.includes('Ferran Castell'), 'de aannemer staat op het rooster');
  assert.equal(namen.length, new Set(namen).size, 'geen dubbel geseed personeel');
  assert.ok(zaak.token, 'de manager logt in op de zaak-app');
});

test('2. het Dienstenplein toont de bouw-zaak met haar diensten', async () => {
  const r = await api(base, '/api/mall', {}, lid.token);
  assert.equal(r.status, 200);
  const dp = r.body.diensten || [];
  assert.ok(dp.length >= 3, 'meerdere diensten-genres op het plein');
  const bouw = dp.find(g => g.type === 'bouw');
  assert.ok(bouw, 'het bouw-genre staat op het Dienstenplein');
  assert.equal(bouw.label, 'Bouw & installatie');
  const castell = bouw.zaken.find(z => z.code === 'CASTELL');
  assert.ok(castell, 'Castell staat op het plein');
  assert.ok(castell.diensten.length >= 4 && castell.diensten.every(d => d.id && d.naam && d.prijs >= 0),
    'de diensten staan compleet inline');
  assert.ok(castell.vanaf > 0, 'het plein toont een vanaf-prijs');
  for (const t of ['zzp', 'chef', 'wellness']) assert.ok(dp.some(g => g.type === t), 'genre ' + t + ' biedt aan op het plein');
});

test('3. de gids geeft ELK leverancier-genre een plek in de Mall', async () => {
  const r = await api(base, '/api/mall', {}, lid.token);
  const gids = r.body.gids || [];
  const types = new Set(gids.map(g => g.type));
  assert.ok(types.has('bouw'), 'bouw staat in de gids');
  // elk genre waar een zichtbare partner in zit, moet in de gids terugkomen
  const sup = await api(base, '/api/suppliers', {}, lid.token);
  const salonTypes = new Set((sup.body.suppliers || []).map(s => s.type).filter(Boolean));
  for (const t of salonTypes) assert.ok(types.has(t), 'genre ' + t + ' heeft een plek in de Mall-gids');
  const bouwGids = gids.find(g => g.type === 'bouw');
  assert.equal(bouwGids.pagina, '/apps/mall.html', 'bouw boekt op het Dienstenplein');
});

test('4. een lid boekt een klus op codenaam; de zaak ziet nooit de echte naam', async () => {
  const slots = await api(base, '/api/booking/slots', { supplierCode: 'CASTELL', serviceId: 'b1', date: morgen() }, lid.token);
  assert.equal(slots.status, 200);
  assert.ok((slots.body.tijden || []).length > 0, 'er zijn vrije tijdvakken');
  const r = await api(base, '/api/booking/request', { supplierCode: 'CASTELL', serviceId: 'b1',
    date: morgen(), time: slots.body.tijden[0], note: 'Kastdeur hangt scheef' }, lid.token);
  assert.equal(r.status, 200);
  const b = r.body.boeking;
  assert.ok(b.ref && b.supplierCode === 'CASTELL', 'de boeking landt bij Castell');
  assert.ok(b.customerCodename && b.customerCodename !== 'Bouwtest', 'de boeking draait op een codenaam');
  assert.ok(!JSON.stringify(b).includes('Bouwtest'), 'de echte naam verschijnt nergens in de boeking');
  // de zaak-kant: het vakwerk-bord kent het genre en toont alleen codenamen
  const bord = await api(base, '/api/supplier/vak/bord', {}, zaak.token);
  assert.equal(bord.status, 200);
  assert.equal(bord.body.label, 'Bouw & installatie');
  assert.ok(!JSON.stringify(bord.body).includes('Bouwtest'), 'ook het bord toont geen echte naam');
});
