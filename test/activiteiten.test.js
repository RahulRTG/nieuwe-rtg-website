/* Het activiteiten-genre (tours, musea, experiences): tickets met tijdsloten
   en capaciteit, betalen vooraf, en de entree-check aan de deur op naam van
   het personeelslid (security/gids/balie). Vol is vol, en een ticket kan
   maar een keer naar binnen.
   Draai: node --experimental-sqlite --test test/activiteiten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 4590 + Math.floor(Math.random() * 60);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-act-'));
const VANDAAG = new Date().toISOString().slice(0, 10);
let child, lidToken, deurToken, managerToken;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  const reg = await json(await api('/api/auth/register', { name: 'Ticket Lid', email: 'ticket@x.nl', phone: '0612345698',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'lifestyle', pasApp: 'lifestyle' }));
  lidToken = reg.token;
  const roster = await json(await api('/api/supplier/roster', { code: 'ESVEDRA' }));
  const man = roster.staff.find(x => x.role === 'manager');
  const deur = roster.staff.find(x => x.role !== 'manager');
  managerToken = (await json(await api('/api/supplier/login', { code: 'ESVEDRA', staffId: man.id, pin: '1234' }))).token;
  deurToken = (await json(await api('/api/supplier/login', { code: 'ESVEDRA', staffId: deur.id, pin: '5678' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('het genre staat klaar: demopartners met activiteiten, tijdsloten en capaciteit', async () => {
  const p = await json(await api('/api/tickets/aanbod', {}, lidToken));
  const boot = p.partners.find(x => x.code === 'ESVEDRA');
  const museum = p.partners.find(x => x.code === 'MACE');
  assert.ok(boot && museum, 'de tour en het museum staan in het aanbod');
  assert.ok(boot.activiteiten[0].tijden.length >= 2 && boot.activiteiten[0].capaciteit > 0);
});

test('manager beheert het aanbod; personeel niet', async () => {
  assert.equal((await api('/api/supplier/activiteit', { name: 'X', prijs: 5, capaciteit: 5, tijden: '09:00' }, deurToken)).status, 403);
  const r = await json(await api('/api/supplier/activiteit', { name: 'Nachtvaart vuurtoren', desc: 'Onder de sterren', prijs: 95, capaciteit: 12, duur: '2 uur', tijden: '21:30, 23:00' }, managerToken));
  assert.ok(r.activiteiten.some(a => a.name === 'Nachtvaart vuurtoren' && a.tijden.length === 2));
});

test('kopen met capaciteit: vol is vol, en betalen gaat via de bestaande stroom', async () => {
  // de snorkeltocht heeft capaciteit 10: koop 8, dan past 3 niet meer
  const k1 = await json(await api('/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: 'a2', datum: VANDAAG, tijd: '10:00', personen: 8 }, lidToken));
  assert.equal(k1.ticket.price, 55 * 8);
  assert.ok(/^[A-Z2-9]{6}$/.test(k1.ticket.code), 'de entreecode is zes leesbare tekens');
  const vol = await api('/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: 'a2', datum: VANDAAG, tijd: '10:00', personen: 3 }, lidToken);
  assert.equal(vol.status, 409, 'vol is vol');
  assert.match((await vol.json()).error, /2 plek/);
  // het andere tijdslot kan nog gewoon
  const k2 = await json(await api('/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: 'a2', datum: VANDAAG, tijd: '14:00', personen: 2 }, lidToken));
  assert.ok(k2.ticket);
  // betalen via de bestaande boekingstroom
  assert.equal((await api('/api/booking/pay', { ref: k1.ticket.ref }, lidToken)).status, 200);
  assert.equal((await api('/api/booking/pay', { ref: k2.ticket.ref }, lidToken)).status, 200);
  global.__t1 = k1.ticket; global.__t2 = k2.ticket;
});

test('het programma toont per tijdslot verkocht/binnen en de gastenlijst', async () => {
  const pr = await json(await api('/api/supplier/programma', { datum: VANDAAG }, deurToken));
  const slot = pr.slots.find(x => x.activiteitId === 'a2' && x.tijd === '10:00');
  assert.equal(slot.verkocht, 8);
  assert.equal(slot.binnen, 0);
  assert.equal(slot.gasten[0].personen, 8);
});

test('check-in aan de deur: op naam, een keer, en alleen betaald en vandaag', async () => {
  // onbetaald ticket komt niet binnen
  const los = await json(await api('/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: 'a1', datum: VANDAAG, tijd: '17:30', personen: 1 }, lidToken));
  assert.equal((await api('/api/supplier/ticket/checkin', { code: los.ticket.code }, deurToken)).status, 409);
  // de betaalde snorkelgroep komt binnen, afgevinkt door het deurpersoneel op naam
  const ok = await json(await api('/api/supplier/ticket/checkin', { code: global.__t1.code.toLowerCase() }, deurToken));
  assert.equal(ok.ticket.personen, 8);
  // nog een keer dezelfde code: geweigerd, met wie hem al afvinkte
  const dubbel = await api('/api/supplier/ticket/checkin', { code: global.__t1.code }, deurToken);
  assert.equal(dubbel.status, 409);
  assert.match((await dubbel.json()).error, /Joel Ferrer/);
  // een onbekende code hoort nergens bij
  assert.equal((await api('/api/supplier/ticket/checkin', { code: 'ZZZZZZ' }, deurToken)).status, 404);
  // het programma telt de groep nu als binnen
  const pr = await json(await api('/api/supplier/programma', { datum: VANDAAG }, deurToken));
  assert.equal(pr.slots.find(x => x.activiteitId === 'a2' && x.tijd === '10:00').binnen, 8);
});

test('het lid ziet zijn tickets met code en gebruikt-status', async () => {
  const mijn = await json(await api('/api/tickets/mijn', {}, lidToken));
  const t1 = mijn.tickets.find(t => t.ref === global.__t1.ref);
  assert.equal(t1.gebruikt, true);
  assert.equal(t1.checkin.door, 'Joel Ferrer');
  const t2 = mijn.tickets.find(t => t.ref === global.__t2.ref);
  assert.equal(t2.gebruikt, false);
  assert.ok(t2.code);
});
