/* De bezorg-keten sluit: de inpakker vinkt alles af op de juiste tas en het
   juiste bonnummer, de bezorger vinkt af dat hij alles gepakt heeft, pas dan
   mag de rit vertrekken; de beste route kent voertuigkeuze en de terugmelding
   ruimt de bezorgerspositie op.
   Draai: node --test test/bezorgketen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bzk-'));
let child, lidToken, pdaToken, managerToken, prod, refs = [];

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const reg = await json(await api('/api/auth/register', { name: 'Keten Lid', email: 'keten@x.nl', phone: '0612345688',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' }));
  lidToken = reg.token;
  const roster = await json(await api('/api/supplier/roster', { code: 'KIKUNOI' }));
  const man = roster.staff.find(x => x.role === 'manager');
  const staff = roster.staff.find(x => x.role !== 'manager');
  managerToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' }))).token;
  pdaToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: staff.id, pin: '5678' }))).token;
  // assortiment + dienst aan, twee betaalde leveringen op twee adressen
  await api('/api/supplier/bezorg/product', { name: 'Paella', price: 24 }, managerToken);
  await api('/api/supplier/bezorg/product', { name: 'Sangria', price: 18 }, managerToken);
  await api('/api/supplier/bezorg/instellingen', { aan: true, ophalen: true, bezorgen: true }, managerToken);
  const partners = (await json(await api('/api/bezorg/partners', {}, lidToken))).partners;
  prod = partners.find(x => x.code === 'KIKUNOI').producten;
  for (const [i, adres] of [['a', 'Carrer de la Mar 12'], ['b', 'Passeig de Vara de Rey 3']].entries()) {
    const b = await json(await api('/api/bezorg/bestel', { supplierCode: 'KIKUNOI', levering: 'bezorgen',
      adres: adres[1], lat: 38.909 + i * 0.02, lng: 1.42 + i * 0.03,
      items: [{ id: prod[0].id, qty: 1 }, { id: prod[1].id, qty: 1 }] }, lidToken));
    await api('/api/order/pay', { ref: b.order.ref }, lidToken);
    refs.push(b.order.ref);
  }
  await api('/api/supplier/bezorg/neem', { refs }, pdaToken);
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de inpakker: fout bonnummer of een half afgevinkte lijst komt er niet door', async () => {
  // fout bonnummer
  const fout = await api('/api/supplier/bezorg/inpak', { ref: refs[0], bon: 'RTG-B-FOUT', tas: 'tas 1', items: [prod[0].id, prod[1].id] }, pdaToken);
  assert.equal(fout.status, 400);
  assert.match((await json(fout)).error, /bonnummer/i);
  // maar de helft afgevinkt
  const half = await api('/api/supplier/bezorg/inpak', { ref: refs[0], bon: refs[0], tas: 'tas 1', items: [prod[0].id] }, pdaToken);
  assert.equal(half.status, 400);
  assert.match((await json(half)).error, /Sangria/);
  // zonder tas
  assert.equal((await api('/api/supplier/bezorg/inpak', { ref: refs[0], bon: refs[0], tas: '', items: [prod[0].id, prod[1].id] }, pdaToken)).status, 400);
  // alles afgevinkt, juiste tas en bon: klaar
  const ok = await json(await api('/api/supplier/bezorg/inpak', { ref: refs[0], bon: refs[0], tas: 'tas 1', items: [prod[0].id, prod[1].id] }, pdaToken));
  assert.equal(ok.inpak.tas, 'tas 1');
});

test('de keten sluit: geen vertrek zonder inpak en pakcheck; daarna wel', async () => {
  // rit 2 is nog niet ingepakt: pakcheck ketst af, vertrek ook
  assert.equal((await api('/api/supplier/bezorg/pakcheck', { refs: [refs[1]] }, pdaToken)).status, 409);
  const dicht = await api('/api/supplier/bezorg/status', { refs, status: 'onderweg' }, pdaToken);
  assert.equal(dicht.status, 409);
  assert.match((await json(dicht)).error, /afvinken/i);
  // rit 2 inpakken + beide pakchecken
  await api('/api/supplier/bezorg/inpak', { ref: refs[1], bon: refs[1], tas: 'tas 2', items: [prod[0].id, prod[1].id] }, pdaToken);
  const pc = await json(await api('/api/supplier/bezorg/pakcheck', { refs }, pdaToken));
  assert.equal(pc.refs.length, 2);
  const weg = await json(await api('/api/supplier/bezorg/status', { refs, status: 'onderweg' }, pdaToken));
  assert.equal(weg.refs.length, 2);
});

test('de beste route: alle stops, en lopen duurt langer dan de auto', async () => {
  const auto = await json(await api('/api/supplier/bezorg/route', { refs, voertuig: 'auto' }, pdaToken));
  assert.equal(auto.stops.length, 2);
  assert.deepEqual(new Set(auto.stops.map(s => s.ref)), new Set(refs));
  assert.ok(auto.stops.every(s => /^geo:/.test(s.nav)), 'elke stop heeft een navigatielink');
  const lopen = await json(await api('/api/supplier/bezorg/route', { refs, voertuig: 'lopen' }, pdaToken));
  assert.ok(lopen.totaal.minuten > auto.totaal.minuten, 'lopen kost meer minuten dan de auto');
  // een onzinnig voertuig valt terug op de auto
  const gek = await json(await api('/api/supplier/bezorg/route', { refs, voertuig: 'raket' }, pdaToken));
  assert.equal(gek.voertuig, 'auto');
});

test('terug op de zaak: pas na het afronden, en dan is de positie weg', async () => {
  await api('/api/supplier/bezorg/gps', { lat: 38.918, lng: 1.451 }, pdaToken);
  // nog onderweg: terugmelden ketst af
  assert.equal((await api('/api/supplier/bezorg/terug', {}, pdaToken)).status, 409);
  await api('/api/supplier/bezorg/status', { refs, status: 'bezorgd' }, pdaToken);
  const terug = await json(await api('/api/supplier/bezorg/terug', {}, pdaToken));
  assert.equal(terug.ok, true);
  // de klant ziet geen positie meer bij een afgeronde levering
  const volg = await json(await api('/api/bezorg/volg', { ref: refs[0] }, lidToken));
  assert.equal(volg.positie, null);
});
