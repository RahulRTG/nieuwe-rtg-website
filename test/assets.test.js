/* Toren 3, RTG Shared Assets: altijd 300 tickets per object, een ticket is
   24 uur per jaar, tien jaar lang. Access loopt af; Asset heeft een aandeel
   in de restwaarde (waarde / 300) en stapt uit via een Tik. Alleen voor
   betalende leden. Draai los:
   node --experimental-sqlite --test test/assets.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
let lid, zakelijk, gast;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-assets-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const login = tier => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }) }).then(r => r.json()).then(d => d.token);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = await login('rtg');
  zakelijk = await login('business');
  gast = await login('guest');
  assert.ok(lid && zakelijk && gast);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let villa; // het object waarop de keten wordt getest
let accessTicketId; // om te bewijzen dat Access geen restwaarde heeft

test('de pool: drie objecten, altijd 300 tickets, alleen betalende leden kopen', async () => {
  const d = (await api('assets', {}, lid)).body;
  assert.equal(d.assets.length, 3, 'jet, jacht en villa');
  assert.ok(d.assets.every(a => a.totaal === 300 && a.beschikbaar === 300));
  assert.equal(d.regels.urenPerJaar, 24);
  assert.equal(d.regels.jaren, 10);
  villa = d.assets.find(a => a.soort === 'villa');
  assert.equal(villa.ticketWaarde, Math.round(villa.waarde / 300), 'ticketwaarde is waarde gedeeld door 300');
  // de gratis gebruiker mag kijken maar niet kopen
  assert.equal((await api('asset/koop', { assetId: villa.id, smaak: 'access', aantal: 1 }, gast)).status, 403);
});

test('kopen: Access en Asset, tien jaar geldig, en vol is echt vol (300)', async () => {
  const k1 = await api('asset/koop', { assetId: villa.id, smaak: 'access', aantal: 2 }, lid);
  assert.equal(k1.status, 200);
  assert.equal(k1.body.totaalPrijs, villa.prijsAccess * 2);
  accessTicketId = k1.body.tickets[0].id;
  const k2 = await api('asset/koop', { assetId: villa.id, smaak: 'asset', aantal: 1 }, lid);
  assert.equal(k2.body.totaalPrijs, villa.prijsAsset);
  // tien jaar geldig
  const jaarNu = new Date().getFullYear();
  assert.ok(k2.body.tickets[0].vervaltOp.startsWith(String(jaarNu + 10)));
  // een zakelijk lid koopt mee in dezelfde pool
  assert.equal((await api('asset/koop', { assetId: villa.id, smaak: 'access', aantal: 1 }, zakelijk)).status, 200);
  // 296 over; meer dan beschikbaar ketst af, precies de rest mag
  assert.equal((await api('assets', {}, lid)).body.assets.find(a => a.id === villa.id).beschikbaar, 296);
  assert.equal((await api('asset/koop', { assetId: villa.id, smaak: 'access', aantal: 297 }, zakelijk)).status, 409);
  assert.equal((await api('asset/koop', { assetId: villa.id, smaak: 'access', aantal: 296 }, zakelijk)).status, 200);
  assert.equal((await api('assets', {}, lid)).body.assets.find(a => a.id === villa.id).beschikbaar, 0);
  assert.equal((await api('asset/koop', { assetId: villa.id, smaak: 'access', aantal: 1 }, lid)).status, 409, 'vol is vol');
});

test('gebruik: 24 uur per ticket per jaar, dubbel boeken kan niet', async () => {
  const dag = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  // drie tickets = drie dagen dit jaar (neem dagen in dit kalenderjaar)
  const eind = new Date(new Date().getFullYear(), 11, 20);
  const ditJaar = i => new Date(Math.min(Date.now() + i * 86400000, eind.getTime())).toISOString().slice(0, 10);
  const b1 = await api('asset/gebruik', { assetId: villa.id, datum: dag(7) }, lid);
  assert.equal(b1.status, 200);
  assert.equal((await api('asset/gebruik', { assetId: villa.id, datum: dag(7) }, lid)).status, 409, 'dezelfde dag niet twee keer');
  await api('asset/gebruik', { assetId: villa.id, datum: dag(8) }, lid);
  const b3 = await api('asset/gebruik', { assetId: villa.id, datum: dag(9) }, lid);
  // alleen als alle drie de dagen in dit kalenderjaar vielen, is de teller vol
  if ([dag(7), dag(8), dag(9)].every(x => x.slice(0, 4) === String(new Date().getFullYear()))) {
    assert.equal(b3.status, 200);
    assert.equal(b3.body.dagenTegoed, 0);
    assert.equal((await api('asset/gebruik', { assetId: villa.id, datum: ditJaar(10) }, lid)).status, 400, 'de teller is vol tot 1 januari');
  }
  const mijn = (await api('asset/mijn', {}, lid)).body.posities.find(p => p.assetId === villa.id);
  assert.equal(mijn.tickets, 3);
  assert.equal(mijn.access, 2);
  assert.equal(mijn.asset, 1);
});

test('uitstappen: alleen Asset, tegen de actuele ticketwaarde, via een Tik', async () => {
  const mijn = (await api('asset/mijn', {}, lid)).body.posities.find(p => p.assetId === villa.id);
  assert.equal(mijn.uitstapWaarde, mijn.ticketWaarde, 'een Asset-ticket = waarde / 300');
  const uit = await api('asset/uitstap', { ticketId: mijn.assetTicketIds[0] }, lid);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.waarde, mijn.ticketWaarde);
  // het ticket is terug in de pool en de positie is bijgewerkt
  assert.equal((await api('assets', {}, lid)).body.assets.find(a => a.id === villa.id).beschikbaar, 1);
  const na = (await api('asset/mijn', {}, lid)).body.posities.find(p => p.assetId === villa.id);
  assert.equal(na.tickets, 2);
  assert.equal(na.asset, 0);
  // de uitbetaling staat hard op het ticket
  assert.equal(uit.body.ticket.status, 'uitgestapt');
  assert.equal(uit.body.ticket.uitstap.waarde, mijn.ticketWaarde);
  // Access heeft geen restwaarde en een vreemd ticket bestaat niet
  assert.equal((await api('asset/uitstap', { ticketId: accessTicketId }, lid)).status, 400);
  assert.equal((await api('asset/uitstap', { ticketId: 'bestaat-niet' }, lid)).status, 404);
});
