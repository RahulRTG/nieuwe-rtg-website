/* RTG Zuidas: het complete kantoorgebouw-systeem (demo Meridiaan Toren).
   Bewaakt de zalen zonder dubbele boekingen, de bezoekersstroom langs de
   receptie, badges, facilitaire meldingen, valet, de jetset-laag en de
   cap-poort. Draai los: node --experimental-sqlite --test test/gebouw.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, toren, resto;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geb-'));
const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

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
  toren = await supLogin('MERIDIAAN');
  resto = await supLogin('KIKUNOI');
  assert.ok(toren && resto, 'de gebouwmanager en het restaurant zijn binnen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het hele huis op een scherm: verdiepingen, huurders, zalen en KPI\'s', async () => {
  const r = await api('supplier/gebouw', {}, toren);
  assert.equal(r.status, 200);
  assert.equal(r.body.naam, 'Meridiaan Toren');
  assert.ok(r.body.vloeren >= 14 && r.body.huurders.length >= 5, 'een echte toren met huurders');
  assert.ok(r.body.zalen.length >= 4 && r.body.kpi.bezetting > 0);
  assert.ok(r.body.kpi.openMeldingen >= 2, 'de demo-meldingen staan open');
});

test('2. zalen boeken kan, dubbel boeken kan niet', async () => {
  const boek = await api('supplier/gebouw/zaal', { zaalId: 'z1', huurder: 'Vektor Capital', datum: morgen, van: '10:00', tot: '12:00', titel: 'Kwartaalcijfers' }, toren);
  assert.equal(boek.status, 200);
  assert.equal(boek.body.boeking.prijs, 240, 'twee uur maal de uurprijs van de boardroom');
  const botst = await api('supplier/gebouw/zaal', { zaalId: 'z1', huurder: 'Fjord Ventures', datum: morgen, van: '11:00', tot: '13:00' }, toren);
  assert.equal(botst.status, 409, 'overlappende tijden worden geweigerd');
  assert.match(botst.body.error, /al geboekt/);
  // een andere zaal op dezelfde tijd kan gewoon
  assert.equal((await api('supplier/gebouw/zaal', { zaalId: 'z2', huurder: 'Fjord Ventures', datum: morgen, van: '11:00', tot: '13:00' }, toren)).status, 200);
});

test('3. de receptie: aanmelden, binnen met badge, vertrokken zonder', async () => {
  const meld = await api('supplier/gebouw/bezoeker', { naam: 'Julia Berg', voorWie: 'Lex & Partners Advocaten' }, toren);
  assert.equal(meld.status, 200);
  const id = meld.body.bezoeker.id;
  assert.equal(meld.body.bezoeker.status, 'verwacht');
  const binnen = await api('supplier/gebouw/bezoeker/status', { id, status: 'binnen' }, toren);
  assert.equal(binnen.body.bezoeker.status, 'binnen');
  assert.match(binnen.body.bezoeker.badge, /^B-[0-9A-F]{4}$/, 'binnen betekent een bezoekersbadge');
  const weg = await api('supplier/gebouw/bezoeker/status', { id, status: 'vertrokken' }, toren);
  assert.equal(weg.body.bezoeker.badge, null, 'de badge gaat weer in bij vertrek');
});

test('4. facilitair en security: meldingen door het gebouw en passen blokkeren', async () => {
  const m = await api('supplier/gebouw/melding', { soort: 'catering', verdieping: 14, tekst: 'Lunch voor twaalf in de boardroom.' }, toren);
  assert.equal(m.status, 200);
  await api('supplier/gebouw/melding/status', { id: m.body.melding.id, status: 'bezig' }, toren);
  const klaar = await api('supplier/gebouw/melding/status', { id: m.body.melding.id, status: 'klaar' }, toren);
  assert.equal(klaar.body.melding.status, 'klaar');
  assert.equal((await api('supplier/gebouw/melding', { soort: 'onderhoud', verdieping: 99, tekst: 'x' }, toren)).status, 400, 'een verdieping die niet bestaat');
  const pas = await api('supplier/gebouw/badge', { naam: 'Nieuwe medewerker', huurder: 'Atlas Accountants' }, toren);
  assert.equal(pas.body.badge.actief, true);
  const blok = await api('supplier/gebouw/badge/zet', { id: pas.body.badge.id, actief: false }, toren);
  assert.equal(blok.body.badge.actief, false, 'security blokkeert een pas in een tik');
});

test('5. de jetset-laag: valet, concierge en een jet-transfer als dienstverzoek', async () => {
  const v = await api('supplier/gebouw/valet', { wie: 'Vektor Capital', wagen: 'S-klasse' }, toren);
  assert.equal((await api('supplier/gebouw/valet/status', { id: v.body.valet.id, status: 'voorgereden' }, toren)).body.valet.status, 'voorgereden');
  const j = await api('supplier/gebouw/jetset', { soort: 'jet-transfer', voorWie: 'Fjord Ventures', wens: 'Wagen en jet naar Ibiza, vrijdagmiddag.', moment: 'vrijdag 15:00' }, toren);
  assert.equal(j.status, 200);
  assert.equal(j.body.aanvraag.status, 'aangevraagd', 'een jet-transfer is een verzoek, nooit vanzelf een vlucht');
  const bev = await api('supplier/gebouw/jetset/status', { id: j.body.aanvraag.id, status: 'bevestigd', notitie: 'RTG Aviation bevestigt 15:20.' }, toren);
  assert.equal(bev.body.aanvraag.status, 'bevestigd');
  assert.equal((await api('supplier/gebouw/jetset', { soort: 'raket', voorWie: 'x', wens: 'y' }, toren)).status, 400);
});

test('6. de poorten: zonder gebouw-cap 403, zonder inlog 401', async () => {
  assert.equal((await api('supplier/gebouw', {}, resto)).status, 403, 'een restaurant is geen kantoorgebouw');
  assert.equal((await api('supplier/gebouw/jetset', { soort: 'lounge' }, resto)).status, 403);
  assert.equal((await api('supplier/gebouw')).status, 401);
});
