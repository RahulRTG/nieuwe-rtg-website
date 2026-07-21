/* RTG Marina: het jachthaven-systeem (demo Marina Portell). Bewaakt de
   toewijzing van ligplaatsen aan passanten (eerste passende plaats,
   vol is vol), de bescherming van vaste liggers, de brandstofsteiger,
   service met de hellingbaan, de marina-concierge waar een mens
   bevestigt, en de cap-poorten.
   Draai los: node --experimental-sqlite --test test/marina.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, haven, resto;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mar-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function supLogin(code) {
  const roster = await api('supplier/roster', { code });
  const manager = (roster.body.staff || []).find(x => x.role === 'manager');
  return (await api('supplier/login', { code, staffId: manager.id, pin: '1234' })).body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  haven = await supLogin('PORTELL');
  resto = await supLogin('KIKUNOI');
  assert.ok(haven && resto, 'de havenmeester en het restaurant zijn binnen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de haven op een scherm: ligplaatsen, vaste liggers en KPI\'s', async () => {
  const r = await api('supplier/marina', {}, haven);
  assert.equal(r.status, 200);
  assert.equal(r.body.naam, 'Marina Portell');
  assert.equal(r.body.ligplaatsen.length, 12);
  assert.ok(r.body.kpi.bezet >= 4 && r.body.kpi.vrij >= 6);
  assert.ok(r.body.ligplaatsen.filter(p => p.vast).length >= 3, 'de vaste liggers liggen er al');
});

test('2. een passant krijgt de eerste passende plaats, en de haven kan vol raken', async () => {
  const klein = await api('supplier/marina/passant', { naam: 'Blauwe Reiger', eigenaar: 'D. Kuipers', lengte: 7, nachten: 2 }, haven);
  assert.equal(klein.status, 200);
  assert.equal(klein.body.ligplaats.lengteMax, 12, 'een boot van 7 meter krijgt geen superjacht-plek');
  assert.equal(klein.body.prijs, 130, 'twee nachten maal de dagprijs');
  const groot = await api('supplier/marina/passant', { naam: 'Gran Sol', eigenaar: 'Fjord Ventures', lengte: 26, nachten: 1 }, haven);
  assert.equal(groot.body.ligplaats.lengteMax, 30, 'een jacht van 26 meter kan alleen op de grote steiger');
  assert.equal((await api('supplier/marina/passant', { naam: 'Nog Een', eigenaar: 'X', lengte: 26 }, haven)).status, 409, 'de grote plaatsen liggen nu vol');
});

test('3. vertrek: een passant vaart uit, een vaste ligger is beschermd', async () => {
  const o = await api('supplier/marina', {}, haven);
  const passant = o.body.ligplaatsen.find(p => p.boot && !p.vast);
  const vast = o.body.ligplaatsen.find(p => p.vast);
  assert.equal((await api('supplier/marina/vertrek', { id: passant.id }, haven)).status, 200);
  assert.equal((await api('supplier/marina/vertrek', { id: passant.id }, haven)).status, 409, 'de plaats ligt al leeg');
  assert.equal((await api('supplier/marina/vertrek', { id: vast.id }, haven)).status, 409, 'een vaste ligger meldt zich bij de havenmeester');
});

test('4. de brandstofsteiger: aanmelden en getankt melden', async () => {
  const o = await api('supplier/marina/brandstof', { boot: 'Levante', soort: 'diesel', liters: 400 }, haven);
  assert.equal(o.status, 200);
  assert.equal(o.body.order.status, 'gevraagd');
  assert.equal((await api('supplier/marina/brandstof', { boot: 'X', soort: 'lpg', liters: 10 }, haven)).status, 400, 'alleen diesel of benzine');
  assert.equal((await api('supplier/marina/brandstof/klaar', { id: o.body.order.id }, haven)).body.order.status, 'getankt');
});

test('5. service en de helling: open, bezig, klaar', async () => {
  const s = await api('supplier/marina/service', { boot: 'Alba Azul', soort: 'hijs', wens: 'Uit het water voor de wintercheck.' }, haven);
  assert.equal(s.status, 200);
  assert.equal((await api('supplier/marina/service/status', { id: s.body.verzoek.id, status: 'bezig' }, haven)).body.verzoek.status, 'bezig');
  assert.equal((await api('supplier/marina/service/status', { id: s.body.verzoek.id, status: 'klaar' }, haven)).body.verzoek.status, 'klaar');
  assert.equal((await api('supplier/marina/service', { boot: 'X', soort: 'duiken', wens: 'y' }, haven)).status, 400);
});

test('6. de marina-concierge: een aanvraag, en een mens bevestigt', async () => {
  const c = await api('supplier/marina/concierge', { soort: 'charter-transfer', voorWie: 'Fjord Ventures', wens: 'Morgen met een charter naar Formentera.' }, haven);
  assert.equal(c.status, 200);
  assert.equal(c.body.aanvraag.status, 'aangevraagd', 'nooit vanzelf bevestigd');
  const bev = await api('supplier/marina/concierge/status', { id: c.body.aanvraag.id, status: 'bevestigd', notitie: 'Azul bevestigt 10:00.' }, haven);
  assert.equal(bev.body.aanvraag.status, 'bevestigd');
  assert.equal(bev.body.aanvraag.notitie, 'Azul bevestigt 10:00.');
  assert.equal((await api('supplier/marina/concierge', { soort: 'onderzeeer', voorWie: 'x', wens: 'y' }, haven)).status, 400);
});

test('7. de poorten: zonder marina-cap 403, zonder inlog 401', async () => {
  assert.equal((await api('supplier/marina', {}, resto)).status, 403, 'een restaurant is geen jachthaven');
  assert.equal((await api('supplier/marina/passant', { naam: 'x', eigenaar: 'y', lengte: 8 }, resto)).status, 403);
  assert.equal((await api('supplier/marina')).status, 401);
});
