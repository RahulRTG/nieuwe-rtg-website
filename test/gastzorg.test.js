/* De zorgvolle keten: het zorgprofiel reist alleen met toestemming mee met
   bestellingen en verblijven, en de live locatie is alleen zichtbaar voor
   zaken die de gast zelf aanwees, tot de zaak (of de gast) het stopt.
   Draai los: node --experimental-sqlite --test test/gastzorg.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
let lid, bar, hotel;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gastzorg-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const managerVan = async (code) => {
  const roster = await api('supplier/roster', { code });
  const m = (roster.body.staff || []).find(x => x.role === 'manager');
  return (await (await fetch(base + '/api/supplier/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, staffId: m.id, pin: '1234' })
  })).json()).token;
};
const dagPlus = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json()).token;
  bar = await managerVan('PONTO');
  hotel = await managerVan('HOSHI');
  assert.ok(lid && bar && hotel);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('het zorgprofiel reist alleen mee als de gast delen aanzet', async () => {
  // profiel invullen, delen nog uit: de bestelling blijft schoon
  const zet = await api('zorgprofiel/zet', { allergenen: 'noten, schaaldieren', dieet: 'vegetarisch', medisch: 'diabetes type 1', delen: false }, lid);
  assert.equal(zet.status, 200);
  assert.deepEqual(zet.body.zorg.allergenen, ['noten', 'schaaldieren']);
  const o1 = await api('order', { supplierCode: 'PONTO', items: [{ id: 'b3', qty: 1 }] }, lid);
  assert.equal(o1.status, 200);
  assert.ok(!o1.body.order.zorg, 'zonder toestemming reist er niets mee');
  // delen aan: de keuken ziet het op de bon, de receptie op het bord
  await api('zorgprofiel/zet', { allergenen: 'noten, schaaldieren', dieet: 'vegetarisch', medisch: 'diabetes type 1', delen: true }, lid);
  const o2 = await api('order', { supplierCode: 'PONTO', items: [{ id: 'b3', qty: 1 }] }, lid);
  assert.deepEqual(o2.body.order.zorg.allergenen, ['noten', 'schaaldieren']);
  assert.equal(o2.body.order.zorg.medisch, 'diabetes type 1');
  const kamer = ((await api('supplier/state', {}, hotel)).body.state.rooms || []).find(r => r.available);
  const vb = await api('verblijf', { supplierCode: 'HOSHI', roomId: kamer.id, aankomst: dagPlus(1), vertrek: dagPlus(3), personen: 2 }, lid);
  assert.equal(vb.status, 200);
  assert.deepEqual(vb.body.verblijf.zorg.allergenen, ['noten', 'schaaldieren']);
  const bord = (await api('supplier/receptie', {}, hotel)).body;
  const aanvraag = bord.aanvragen.find(v => v.id === vb.body.verblijf.id);
  assert.ok(aanvraag.zorg && aanvraag.zorg.dieet === 'vegetarisch', 'de receptie weet het meteen');
});

test('elke leverancier heeft de optie: het profiel reist ook mee met rit, reservering en ticket', async () => {
  // de taxi: de chauffeur weet het voor hij voorrijdt (delen staat aan uit de vorige test)
  const rit = await api('ride/request', { supplierCode: 'MKKX', from: 'Marina Botafoc', to: 'Sunset Ibiza', passengers: 2 }, lid);
  assert.equal(rit.status, 200);
  assert.deepEqual(rit.body.ride.zorg.allergenen, ['noten', 'schaaldieren']);
  assert.equal(rit.body.ride.zorg.medisch, 'diabetes type 1');
  // de tafelreservering: de zaak weet het al bij het dekken
  const res1 = await api('reserveer', { supplierCode: 'KIKUNOI', datum: dagPlus(1), tijd: '20:00', personen: 4 }, lid);
  assert.equal(res1.status, 200);
  assert.equal(res1.body.reservering.zorg.dieet, 'vegetarisch');
  // het ticket: de deur ziet het bij de check-in en op de gastenlijst
  await api('supplier/activiteit', { name: 'Proeverij', prijs: 10, capaciteit: 20, tijden: '21:00' }, bar);
  const actId = ((await api('supplier/programma', {}, bar)).body.slots.find(x => x.naam === 'Proeverij') || {}).activiteitId;
  const tk = await api('ticket/koop', { supplierCode: 'PONTO', activiteitId: actId, datum: new Date().toISOString().slice(0, 10), tijd: '21:00', personen: 2 }, lid);
  assert.equal(tk.status, 200);
  assert.deepEqual(tk.body.ticket.zorg.allergenen, ['noten', 'schaaldieren']);
  assert.equal((await api('booking/pay', { ref: tk.body.ticket.ref }, lid)).status, 200);
  const slot = (await api('supplier/programma', {}, bar)).body.slots.find(x => x.activiteitId === actId);
  assert.ok(slot.gasten.some(g => g.zorg && g.zorg.allergenen.includes('noten')), 'de deurlijst kent de allergenen');
  const inche = await api('supplier/ticket/checkin', { code: tk.body.ticket.code }, bar);
  assert.equal(inche.status, 200);
  assert.ok(inche.body.ticket.zorg && inche.body.ticket.zorg.medisch, 'de check-in toont het zorgprofiel');
});

test('live meekijken: alleen met toestemming, en het stopt als de zaak het niet meer nodig heeft', async () => {
  // zonder toestemming ziet niemand iets, ook al is het lid live onderweg
  await api('live/start', { destCode: 'PONTO', mode: 'driving', lat: 38.99, lng: 1.30 }, lid);
  await api('live/update', { lat: 38.99, lng: 1.30 }, lid);
  assert.equal((await api('supplier/gastlocaties', {}, hotel)).body.gasten.length, 0, 'het hotel kreeg geen toestemming');
  // de gast wijst de bar aan: die ziet de gps-positie, afstand en het zorgprofiel
  const deel = await api('locatie/deel', { supplierCode: 'PONTO' }, lid);
  assert.equal(deel.status, 200);
  const gasten = (await api('supplier/gastlocaties', {}, bar)).body.gasten;
  assert.equal(gasten.length, 1);
  assert.ok(gasten[0].loc && Number.isFinite(gasten[0].loc.lat), 'de bar ziet precies waar de gast is');
  assert.ok(gasten[0].km != null, 'met afstand in km');
  assert.deepEqual(gasten[0].zorg.allergenen, ['noten', 'schaaldieren'], 'en kent de allergenen');
  // dubbel delen maakt geen tweede toestemming
  await api('locatie/deel', { supplierCode: 'PONTO' }, lid);
  assert.equal((await api('supplier/gastlocaties', {}, bar)).body.gasten.length, 1);
  // de zaak heeft het niet meer nodig: meekijken stopt meteen
  const stop1 = await api('supplier/gastlocatie/stop', { id: gasten[0].id }, bar);
  assert.equal(stop1.status, 200);
  assert.equal((await api('supplier/gastlocaties', {}, bar)).body.gasten.length, 0, 'de zaak ziet niets meer');
  const mijn = (await api('locatie/mijn', {}, lid)).body;
  assert.equal(mijn.actief.length, 0);
  assert.ok(mijn.gestopt[0].gestoptDoor, 'de gast ziet wie het stopte');
  // opnieuw delen en zelf stoppen kan ook altijd
  const deel2 = await api('locatie/deel', { supplierCode: 'PONTO' }, lid);
  assert.equal((await api('locatie/stop', { id: deel2.body.deel.id }, lid)).status, 200);
  assert.equal((await api('supplier/gastlocaties', {}, bar)).body.gasten.length, 0);
  // zonder live gps-pings blijft het bij "toestemming, wacht op locatie"
  await api('live/stop', {}, lid);
  await api('locatie/deel', { supplierCode: 'PONTO' }, lid);
  const wacht = (await api('supplier/gastlocaties', {}, bar)).body.gasten[0];
  assert.ok(wacht.wachtOpLocatie, 'toestemming zonder gps toont geen positie');
  assert.equal(wacht.loc, null);
});
