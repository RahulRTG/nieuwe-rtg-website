/* De gedekte tafel (kern/tafeldek.js): wijst de zaak een tafel toe aan een
   bevestigde reservering, dan staat het gedeelde zorgprofiel van de gast als
   stoel 1 op de tafellijst (kern/tafelwensen.js) -- codenaam, allergenen,
   wensen; wat niet in de vaste woorden past gaat leesbaar mee in de notitie.
   De toestemming wordt OP HET MOMENT ZELF gecontroleerd: wie het delen
   intrekt tussen reserveren en dekken, staat nergens. En het werk van de
   gastvrouw die de tafel al had gedekt blijft staan.
   Draai los: node --test test/tafeldek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tafeldek-'));
let srv, base, lid, codenaam, zaak;

const dagPlus = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function reserveerEnBevestig(datum) {
  const r = await api('/api/reserveer', { supplierCode: 'KIKUNOI', datum, tijd: '19:00', personen: 2 }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const id = r.body.reservering.id;
  const b = await api('/api/supplier/reservering/beslis', { id, action: 'bevestig' }, zaak);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  return id;
}
const tafelsOp = async datum => ((await api('/api/werkvloer/tafels', { wanneer: datum }, zaak)).body.tafels || []);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' } });
  base = srv.base;
  const reg = await api('/api/auth/register', { name: 'Tafel Lid', email: 'tafel@x.nl', phone: '0699887766',
    password: 'geheim123', geboortedatum: '1992-06-06', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  codenaam = (((await api('/api/state', {}, lid)).body.state || {}).user || {}).codename;
  const rooster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const manager = (rooster.body.staff || []).find(s => s.role === 'manager');
  zaak = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: manager && manager.id, pin: '1234' })).body.token;
  assert.ok(lid && codenaam && zaak, 'een lid (met codenaam) en de zaak zijn ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. tafel toewijzen dekt stoel 1 uit het gedeelde zorgprofiel', async () => {
  const z = await api('/api/zorgprofiel/zet', { allergenen: ['noten', 'pinda', 'paprika'],
    dieet: 'vegetarisch', medisch: 'insuline in de koelkast', delen: true }, lid);
  assert.equal(z.status, 200, JSON.stringify(z.body));
  const datum = dagPlus(1);
  const id = await reserveerEnBevestig(datum);
  const t = await api('/api/supplier/reservering/tafel', { id, tafel: 'Tafel 2' }, zaak);
  assert.equal(t.status, 200, JSON.stringify(t.body));
  assert.equal(t.body.gedekt, true, 'het antwoord zegt dat de tafel is gedekt');

  const tafel = (await tafelsOp(datum)).find(x => x.tafel === 'Tafel 2');
  assert.ok(tafel, 'Tafel 2 staat op de tafellijst van die dag');
  const gast = (tafel.gasten || []).find(g => g.stoel === 1);
  assert.ok(gast, 'stoel 1 is gedekt');
  // codenaam, nooit een echte naam
  assert.equal(gast.naam, codenaam);
  assert.notEqual(gast.naam, 'Tafel Lid');
  // de vaste woorden staan op hun plek ...
  assert.ok(gast.allergenen.includes('noten') && gast.allergenen.includes('pinda'), 'de wettelijke allergenen staan als allergeen');
  assert.ok(gast.wensen.includes('vegetarisch'), 'het dieet staat als wens');
  // ... en wat er niet in past, verdwijnt niet stil maar staat in de notitie
  assert.ok(!gast.allergenen.includes('paprika'), 'paprika is geen wettelijk allergeen');
  assert.match(gast.notitie, /paprika/);
  assert.match(gast.notitie, /medisch: insuline/);
});

test('2. de bedieningskaart waarschuwt op stoel 1', async () => {
  const tafel = (await tafelsOp(dagPlus(1))).find(x => x.tafel === 'Tafel 2');
  const k = await api('/api/werkvloer/bedieningskaart', { id: tafel.id }, zaak);
  assert.equal(k.status, 200, JSON.stringify(k.body));
  const stoel1 = (k.body.stoelen || []).find(s => s.stoel === 1);
  assert.ok(stoel1 && stoel1.let_op, 'stoel 1 draagt de waarschuwing');
  assert.match(stoel1.regel, /ALLERGIE: .*noten/);
});

test('3. wie het delen intrekt na het reserveren, staat nergens (live controle)', async () => {
  const datum = dagPlus(2);
  const id = await reserveerEnBevestig(datum);
  // het lid trekt het delen in NA het reserveren en VOOR het dekken
  const z = await api('/api/zorgprofiel/zet', { allergenen: ['noten'], dieet: 'vegetarisch',
    medisch: 'insuline in de koelkast', delen: false }, lid);
  assert.equal(z.status, 200);
  const t = await api('/api/supplier/reservering/tafel', { id, tafel: 'Tafel 3' }, zaak);
  assert.equal(t.status, 200, JSON.stringify(t.body));
  assert.equal(t.body.gedekt, false, 'zonder toestemming wordt er niets gedekt');
  assert.equal((await tafelsOp(datum)).length, 0, 'er staat niets over deze gast op de tafellijst');
});

test('4. het werk van de gastvrouw blijft staan: de gast schuift aan', async () => {
  // delen weer aan (de intrekking hierboven was per die avond al te laat)
  await api('/api/zorgprofiel/zet', { allergenen: ['noten'], dieet: '', medisch: '', delen: true }, lid);
  const datum = dagPlus(3);
  // de gastvrouw dekte Tafel 4 al voor haar event, met Anna op stoel 1
  const vooraf = await api('/api/werkvloer/tafel', { tafel: { tafel: 'Tafel 4', wanneer: datum,
    event: 'Avond aan zee', gasten: [{ stoel: 1, naam: 'Anna', allergenen: ['vis'] }] } }, zaak);
  assert.equal(vooraf.status, 200, JSON.stringify(vooraf.body));
  const id = await reserveerEnBevestig(datum);
  const t = await api('/api/supplier/reservering/tafel', { id, tafel: 'Tafel 4' }, zaak);
  assert.equal(t.body.gedekt, true);
  const tafels = await tafelsOp(datum);
  assert.equal(tafels.filter(x => x.tafel === 'Tafel 4').length, 1, 'een tafel, niet twee rijen');
  const tafel = tafels[0];
  assert.equal(tafel.event, 'Avond aan zee', 'het event van de gastvrouw is niet overschreven');
  const anna = tafel.gasten.find(g => g.naam === 'Anna');
  assert.ok(anna && anna.stoel === 1 && anna.allergenen.includes('vis'), 'Anna zit nog op stoel 1');
  const gast = tafel.gasten.find(g => g.naam === codenaam);
  assert.ok(gast && gast.stoel === 2, 'de gast schuift aan op de eerstvolgende vrije stoel');
});
