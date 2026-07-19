/* De kantoren-uitbreiding: vijf nieuwe kamers (Support team, Ingenieurs,
   Consumenten- en Partner-abonnementen, Kantine), de kantine-kaart van
   vandaag, en de identiteitskluis-inzage: kamers met naamInzage (en de
   boardroom) vragen de echte naam bij een codenaam op, met een audit-regel
   bij ELKE opvraging. Draai los:
   node --experimental-sqlite --test test/kantoren-uitbreiding.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office, lidCodenaam;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoren2-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  const u = Date.now().toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Kluis Testlid', email: 'kluis' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1991-03-03', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' });
  const st = await api('/api/state', {}, reg.body.token);
  lidCodenaam = st.body.state.user.codename;
  assert.ok(office && lidCodenaam, 'kantoor ingelogd en lid met codenaam in de gids');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de vijf nieuwe kamers staan in het register, naast de eerste twaalf', async () => {
  const r = await api('/api/office/kamers', {}, office);
  assert.equal(r.status, 200);
  const ids = r.body.kamers.map(k => k.id);
  for (const id of ['support', 'ingenieurs', 'consumentenAbo', 'partnerAbo', 'kantine'])
    assert.ok(ids.includes(id), 'kamer ' + id + ' bestaat');
  assert.ok(ids.length >= 17, 'zeventien kamers of meer (nu: ' + ids.length + ')');
  for (const id of ['support', 'ingenieurs', 'consumentenAbo', 'partnerAbo', 'kantine']) {
    const k = await api('/api/office/kamer', { id }, office);
    assert.equal(k.status, 200, 'kamer ' + id + ' opent');
    assert.ok(k.body.kpis.length >= 3, 'met echte cijfers');
  }
});

test('2. de bestaande kamers kennen de jongere systemen', async () => {
  const fin = await api('/api/office/kamer', { id: 'financien' }, office);
  assert.ok(fin.body.kpis.some(k => /Synergie/.test(k.label)), 'financien ziet de Synergie-verkopen');
  assert.ok(fin.body.kpis.some(k => /Facturen/.test(k.label)), 'en de factuurmotor');
  const mkt = await api('/api/office/kamer', { id: 'marketing' }, office);
  assert.ok(mkt.body.kpis.some(k => /Clips/.test(k.label)), 'marketing ziet Clips');
  assert.ok(mkt.body.kpis.some(k => /Podium/.test(k.label)), 'en Podium');
  const vk = await api('/api/office/kamer', { id: 'verkoop' }, office);
  assert.ok(vk.body.kpis.some(k => /OV-ritten/.test(k.label)), 'verkoop ziet het OV');
  assert.ok(vk.body.kpis.some(k => /Care/.test(k.label)), 'en Care');
});

test('3. de kantine zet de kaart van vandaag en iedereen leest hem terug', async () => {
  const leeg = await api('/api/office/kantine/menu', {}, office);
  assert.equal(leeg.status, 200);
  const zet = await api('/api/office/kantine/menu-zet', { items: ['Dagsoep', 'Vega wrap', '  ', 'Roti van de chef'], naam: 'Amara' }, office);
  assert.equal(zet.status, 200);
  assert.deepEqual(zet.body.menu.items, ['Dagsoep', 'Vega wrap', 'Roti van de chef'], 'lege regels vallen weg');
  assert.equal(zet.body.menu.door, 'Amara');
  const terug = await api('/api/office/kantine/menu', {}, office);
  assert.equal(terug.body.menu.items.length, 3);
  const kamer = await api('/api/office/kamer', { id: 'kantine' }, office);
  const kpi = kamer.body.kpis.find(k => /Gerechten/.test(k.label));
  assert.equal(kpi.waarde, 3, 'de kamer telt de kaart mee');
  assert.equal((await api('/api/office/kantine/menu-zet', { items: [] }, office)).status, 400, 'een lege kaart wordt geweigerd');
});

test('4. de identiteitskluis: kamers met inzagerecht zien de naam, andere niet, en alles komt in het auditlog', async () => {
  // zonder kantoor-token: dicht
  assert.equal((await api('/api/office/inzage', { kamer: 'klantenservice', codenaam: lidCodenaam })).status, 401);
  // klantenservice mag (naamInzage), en krijgt de echte naam uit de kluis
  const ok = await api('/api/office/inzage', { kamer: 'klantenservice', codenaam: lidCodenaam, naam: 'Noor' }, office);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.inzage.naam, 'Kluis Testlid');
  assert.equal(ok.body.inzage.codenaam, lidCodenaam);
  assert.equal(ok.body.inzage.pas, 'rtg');
  // de boardroom mag ook
  const bd = await api('/api/office/inzage', { kamer: 'boardroom', codenaam: lidCodenaam }, office);
  assert.equal(bd.status, 200);
  assert.equal(bd.body.inzage.naam, 'Kluis Testlid');
  // marketing heeft geen inzagerecht
  assert.equal((await api('/api/office/inzage', { kamer: 'marketing', codenaam: lidCodenaam }, office)).status, 403);
  // een onbekende kamer of codenaam
  assert.equal((await api('/api/office/inzage', { kamer: 'nepkamer', codenaam: lidCodenaam }, office)).status, 404);
  const mis = await api('/api/office/inzage', { kamer: 'support', codenaam: 'bestaat-vast-niet-123' }, office);
  assert.equal(mis.status, 404);
  // ELKE opvraging staat in het auditlog, ook die zonder treffer
  const board = await api('/api/office/boardroom', {}, office);
  const kluisRegels = board.body.audit.filter(a => /Identiteitskluis/.test(a.wat));
  assert.ok(kluisRegels.length >= 3, 'de opvragingen staan in het auditlog (nu: ' + kluisRegels.length + ')');
  assert.ok(kluisRegels.some(a => /geen treffer/.test(a.wat)), 'ook de misgreep is gelogd');
  assert.ok(board.body.audit.some(a => a.wie === 'Noor'), 'met wie er keek');
});

test('5. de kamer vertelt de app of de kluis er hoort: wel bij support, niet bij marketing', async () => {
  assert.equal((await api('/api/office/kamer', { id: 'support' }, office)).body.naamInzage, true);
  assert.equal((await api('/api/office/kamer', { id: 'klantenservice' }, office)).body.naamInzage, true);
  assert.equal((await api('/api/office/kamer', { id: 'marketing' }, office)).body.naamInzage, false);
});
