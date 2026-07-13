/* De ophaal/bezorgdienst, van assortiment tot bezorgd:
   de zaak zet producten en de dienst aan; het lid bestelt (ophalen of
   bezorgen) en betaalt vooraf; de bezorger neemt meerdere leveringen op
   eigen naam, deelt GPS (klant krijgt ETA) en meldt de rit af.
   Draai: node --experimental-sqlite --test test/bezorg.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 4520 + Math.floor(Math.random() * 60);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bez-'));
let child, lidToken, pdaToken, managerToken;

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
  // lid met business-pas
  const reg = await json(await api('/api/auth/register', { name: 'Bezorg Lid', email: 'bezorg@x.nl', phone: '0612345699',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' }));
  lidToken = reg.token;
  // manager en bezorger (PDA) bij Sal de Mar (KIKUNOI)
  const roster = await json(await api('/api/supplier/roster', { code: 'KIKUNOI' }));
  const man = roster.staff.find(x => x.role === 'manager');
  const staff = roster.staff.find(x => x.role !== 'manager');
  managerToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' }))).token;
  pdaToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: staff.id, pin: '5678' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('assortiment: manager zet producten en de dienst aan; leeg mag de dienst niet aan', async () => {
  // dienst aanzetten zonder producten wordt geweigerd
  assert.equal((await api('/api/supplier/bezorg/instellingen', { aan: true }, managerToken)).status, 400);
  // producten toevoegen (personeel mag dat niet, manager wel)
  assert.equal((await api('/api/supplier/bezorg/product', { name: 'Paella om mee te nemen', price: 24 }, pdaToken)).status, 403);
  const p1 = await json(await api('/api/supplier/bezorg/product', { name: 'Paella om mee te nemen', desc: 'Voor 2 personen', price: 24 }, managerToken));
  assert.equal(p1.producten.length, 1);
  await api('/api/supplier/bezorg/product', { name: 'Sangria-pakket', price: 18 }, managerToken);
  const zet = await json(await api('/api/supplier/bezorg/instellingen', { aan: true, ophalen: true, bezorgen: true }, managerToken));
  assert.equal(zet.bezorg.aan, true);
});

test('het lid ziet de partner en bestelt met bezorgen; betalen vooraf via de bestaande stroom', async () => {
  const p = await json(await api('/api/bezorg/partners', {}, lidToken));
  const zaak = p.partners.find(x => x.code === 'KIKUNOI');
  assert.ok(zaak, 'Sal de Mar staat in de bezorglijst');
  assert.equal(zaak.producten.length, 2);
  // bezorgen zonder adres wordt geweigerd
  assert.equal((await api('/api/bezorg/bestel', { supplierCode: 'KIKUNOI', levering: 'bezorgen', items: [{ id: zaak.producten[0].id, qty: 1 }] }, lidToken)).status, 400);
  const best = await json(await api('/api/bezorg/bestel', { supplierCode: 'KIKUNOI', levering: 'bezorgen',
    adres: 'Carrer de la Mar 12, Ibiza', lat: 38.909, lng: 1.42, items: [{ id: zaak.producten[0].id, qty: 2 }] }, lidToken));
  assert.equal(best.order.levering, 'bezorgen');
  assert.equal(best.order.total, 48);
  assert.equal(best.order.status, 'wacht-op-betaling');
  // de zaak ziet hem nog NIET (eerst betalen)
  const ov0 = await json(await api('/api/supplier/bezorg/overzicht', {}, managerToken));
  assert.ok(!ov0.lopend.some(o => o.ref === best.order.ref));
  // betalen via de bestaande betaalstroom
  const pay = await api('/api/order/pay', { ref: best.order.ref }, lidToken);
  assert.equal(pay.status, 200);
  const ov1 = await json(await api('/api/supplier/bezorg/overzicht', {}, managerToken));
  assert.ok(ov1.lopend.some(o => o.ref === best.order.ref), 'na betaling ziet de zaak de levering');
  global.__ref1 = best.order.ref;
});

test('meerdere ritten op naam: de bezorger bundelt twee leveringen, GPS geeft de klant een ETA', async () => {
  // tweede bestelling erbij
  const p = await json(await api('/api/bezorg/partners', {}, lidToken));
  const zaak = p.partners.find(x => x.code === 'KIKUNOI');
  const b2 = await json(await api('/api/bezorg/bestel', { supplierCode: 'KIKUNOI', levering: 'bezorgen',
    adres: 'Passeig de Vara de Rey 3, Ibiza', lat: 38.907, lng: 1.432, items: [{ id: zaak.producten[1].id, qty: 1 }] }, lidToken));
  await api('/api/order/pay', { ref: b2.order.ref }, lidToken);
  const refs = [global.__ref1, b2.order.ref];

  // de bezorger neemt BEIDE leveringen in een rit, op eigen naam
  const neem = await json(await api('/api/supplier/bezorg/neem', { refs }, pdaToken));
  assert.equal(neem.genomen.length, 2);
  // nog een keer nemen kan niet: ze staan al op naam
  assert.equal((await api('/api/supplier/bezorg/neem', { refs }, pdaToken)).status, 409);

  // de rit vertrekt (beide tegelijk) en de bezorger deelt GPS
  const weg = await json(await api('/api/supplier/bezorg/status', { refs, status: 'onderweg' }, pdaToken));
  assert.equal(weg.refs.length, 2);
  const gps = await json(await api('/api/supplier/bezorg/gps', { lat: 38.918, lng: 1.451 }, pdaToken));
  assert.equal(gps.eta.length, 2, 'beide leveringen krijgen een ETA');
  assert.ok(gps.eta.every(e => e.etaMin >= 1), 'de ETA is berekend uit de echte afstand');

  // het lid volgt live: bezorger op naam, positie en ETA
  const volg = await json(await api('/api/bezorg/volg', { ref: global.__ref1 }, lidToken));
  assert.equal(volg.order.status, 'onderweg');
  assert.ok(volg.bezorger && volg.bezorger.name, 'de rit staat op naam');
  assert.ok(volg.positie && Number.isFinite(volg.positie.lat), 'de klant ziet de bezorger rijden');
  assert.ok(volg.etaMin >= 1);

  // afleveren: beide bezorgd
  const af = await json(await api('/api/supplier/bezorg/status', { refs, status: 'bezorgd' }, pdaToken));
  assert.equal(af.refs.length, 2);
  const na = await json(await api('/api/bezorg/volg', { ref: global.__ref1 }, lidToken));
  assert.equal(na.order.status, 'bezorgd');
});

test('ophalen: bestelling met ophaalcode, de zaak meldt hem opgehaald', async () => {
  const p = await json(await api('/api/bezorg/partners', {}, lidToken));
  const zaak = p.partners.find(x => x.code === 'KIKUNOI');
  const best = await json(await api('/api/bezorg/bestel', { supplierCode: 'KIKUNOI', levering: 'ophalen',
    items: [{ id: zaak.producten[0].id, qty: 1 }] }, lidToken));
  assert.ok(best.order.pickup, 'de ophaalcode zit erop');
  await api('/api/order/pay', { ref: best.order.ref }, lidToken);
  // 'onderweg' hoort niet bij ophalen
  assert.equal((await api('/api/supplier/bezorg/status', { ref: best.order.ref, status: 'onderweg' }, managerToken)).status, 404);
  const klaar = await json(await api('/api/supplier/bezorg/status', { ref: best.order.ref, status: 'opgehaald' }, managerToken));
  assert.equal(klaar.refs.length, 1);
});

test('grenzen: een hotel heeft geen bezorgdienst en een vreemde bezorger meldt andermans rit niet af', async () => {
  const roster = await json(await api('/api/supplier/roster', { code: 'HOSHI' }));
  const man = roster.staff.find(x => x.role === 'manager');
  const hotelToken = (await json(await api('/api/supplier/login', { code: 'HOSHI', staffId: man.id, pin: '1234' }))).token;
  assert.equal((await api('/api/supplier/bezorg/product', { name: 'X', price: 5 }, hotelToken)).status, 409, 'hotels hebben eigen kanalen');
});
