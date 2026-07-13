/* De eigen transferdienst van een activiteitenzaak: alleen met een geldig
   ticket, prijs 0 (inclusief) of het afgesproken bedrag, en iedereen ziet
   elkaar: de zaak de rit en de chauffeur, de chauffeur de klant, en de klant
   wie er komt rijden.
   Draai: node --experimental-sqlite --test test/transfer.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tr-'));
const VANDAAG = new Date().toISOString().slice(0, 10);
let child, lidToken, gidsToken, managerToken, ticket;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const reg = await json(await api('/api/auth/register', { name: 'Transfer Lid', email: 'transfer@x.nl', phone: '0612345697',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' }));
  lidToken = reg.token;
  const roster = await json(await api('/api/supplier/roster', { code: 'ESVEDRA' }));
  const man = roster.staff.find(x => x.role === 'manager');
  const gids = roster.staff.find(x => x.role !== 'manager');
  managerToken = (await json(await api('/api/supplier/login', { code: 'ESVEDRA', staffId: man.id, pin: '1234' }))).token;
  gidsToken = (await json(await api('/api/supplier/login', { code: 'ESVEDRA', staffId: gids.id, pin: '5678' }))).token;
  // een betaald ticket voor vandaag
  const k = await json(await api('/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: 'a1', datum: VANDAAG, tijd: '17:30', personen: 2 }, lidToken));
  await api('/api/booking/pay', { ref: k.ticket.ref }, lidToken);
  ticket = k.ticket;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de zaak zet de transferdienst aan (inclusief: prijs 0); personeel mag dat niet', async () => {
  assert.equal((await api('/api/supplier/transfer', { aan: true }, gidsToken)).status, 403);
  const r = await json(await api('/api/supplier/transfer', { aan: true, prijs: 0 }, managerToken));
  assert.equal(r.transfer.aan, true);
  assert.equal(r.transfer.prijs, 0);
});

test('gewone taxi-boeking bij de activiteitenzaak wordt doorverwezen naar het ticket', async () => {
  const r = await api('/api/ride/request', { supplierCode: 'ESVEDRA', from: 'Hotel' }, lidToken);
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /via je ticket/);
});

test('inclusieve transfer: met ticket aanvragen, prijs 0, meteen definitief', async () => {
  // zonder ticket-ref: niet
  assert.equal((await api('/api/transfer/aanvraag', { ticketRef: 'RTG-T-NEP' }, lidToken)).status, 404);
  const r = await json(await api('/api/transfer/aanvraag', { ticketRef: ticket.ref, van: 'Aguamarina Ibiza, lobby' }, lidToken));
  assert.equal(r.ride.quote, 0);
  assert.equal(r.ride.paid, true);
  assert.equal(r.ride.status, 'aangevraagd');
  assert.equal(r.ride.passengers, 2, 'het hele ticketgezelschap gaat mee');
  assert.match(r.ride.when, /17:30/);
  // een tweede transfer op hetzelfde ticket: niet
  assert.equal((await api('/api/transfer/aanvraag', { ticketRef: ticket.ref, van: 'Elders' }, lidToken)).status, 409);
  global.__rit = r.ride;
});

test('de chauffeur van de zaak neemt de rit op eigen naam en iedereen ziet elkaar', async () => {
  // de zaak ziet de rit in het eigen overzicht (state.rides)
  const st = await json(await api('/api/supplier/login', { code: 'ESVEDRA', staffId: (await json(await api('/api/supplier/roster', { code: 'ESVEDRA' }))).staff.find(x => x.role === 'manager').id, pin: '1234' }));
  assert.ok(st.state.rides.some(x => x.ref === global.__rit.ref), 'de zaak ziet de transferaanvraag');
  // de gids/chauffeur neemt hem aan (taxi-app-functionaliteit, zonder wagenpark)
  const sug = await json(await api('/api/supplier/ride/suggest', { ref: global.__rit.ref }, gidsToken));
  const toe = await json(await api('/api/supplier/ride/assign', { ref: global.__rit.ref, self: true, vehicleId: sug.vehicleId }, gidsToken));
  assert.equal(toe.ride.driver.name, 'Joel Ferrer', 'de rit staat op naam van de chauffeur');
  await api('/api/supplier/ride/status', { ref: global.__rit.ref, status: 'onderweg' }, gidsToken);
  // de klant ziet op zijn ticket wie er komt
  const mijn = await json(await api('/api/tickets/mijn', {}, lidToken));
  const t = mijn.tickets.find(x => x.ref === ticket.ref);
  assert.equal(t.transfer.chauffeur, 'Joel Ferrer');
  assert.equal(t.transfer.status, 'onderweg');
  assert.equal(t.transfer.prijs, 0);
});

test('afgesproken prijs: transfer kost het vaste bedrag en loopt via de betaalstroom', async () => {
  await api('/api/supplier/transfer', { prijs: 25 }, managerToken);
  const k = await json(await api('/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: 'a1', datum: VANDAAG, tijd: '19:30', personen: 1 }, lidToken));
  await api('/api/booking/pay', { ref: k.ticket.ref }, lidToken);
  const r = await json(await api('/api/transfer/aanvraag', { ticketRef: k.ticket.ref, van: 'Dalt Vila' }, lidToken));
  assert.equal(r.ride.quote, 25);
  assert.equal(r.ride.status, 'wacht-op-betaling');
  const pay = await api('/api/ride/pay', { ref: r.ride.ref }, lidToken);
  assert.equal(pay.status, 200);
  assert.equal((await pay.json()).ride.status, 'aangevraagd');
});
