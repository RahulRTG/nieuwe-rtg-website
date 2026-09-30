/* De horecabon en de polsband tegen een ECHTE server
   (horeca.bon_en_polsbandsaldo): de code eenmaal en no-store, intrekken en
   roteren (roteren alleen de manager), de kassa die op code of op ID afboekt,
   de polsband, en de gast die ALLEEN afboekt wat aan zijn eigen tafelsessie
   hangt -- een code in /api/gast/betaal opent niets, en een tweede telefoon
   kan een gekoppelde bon niet overnemen. De controls zelf staan in
   test/horecabon-credential.test.js.

   Draai los: node --test test/horecabon-routes.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

let srv, base, MGR, MDW;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-horecabon-'));

async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  const tekst = await r.text();
  let json = {}; try { json = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: json, tekst, koppen: r.headers };
}
async function zaak(rol) {
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const s = (roster.staff || []).find(x => rol === 'manager' ? x.role === 'manager' : x.role !== 'manager');
  return (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: s.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token;
}
async function tafel(naam, centen) {
  const qr = await api('/api/supplier/horeca/gast/qr', { tafel: naam }, MGR);
  const aan = (await api('/api/gast/aanschuiven', { token: qr.body.token, naam: 'Gast ' + naam })).body;
  if (centen) await api('/api/supplier/horeca/rekening/regel', { rekeningId: aan.rekening.rekeningId, naam: 'Diner', centen, aantal: 1 }, MGR);
  return aan;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base;
  MGR = await zaak('manager'); MDW = await zaak('medewerker');
  assert.ok(MGR && MDW);
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de zaak: de code een keer (no-store), opzoeken zonder code, intrekken en roteren', async () => {
  const maak = await api('/api/supplier/horeca/bon/maak', { soort: 'cadeaubon', bedrag: 40, idem: 'hb-e2e-1' }, MDW);
  assert.equal(maak.status, 200, maak.tekst.slice(0, 200));
  assert.equal(maak.koppen.get('cache-control'), 'no-store');
  const code = maak.body.bon.code, id = maak.body.bon.id;
  assert.match(code, /^HB(-[0-9A-F]{4}){8}$/);
  const nog = await api('/api/supplier/horeca/bon/maak', { soort: 'cadeaubon', bedrag: 40, idem: 'hb-e2e-1' }, MDW);
  assert.equal(nog.body.herhaald, true); assert.equal(nog.tekst.includes(code.slice(3, 12)), false, 'geen tweede keer de code');
  const kijk = await api('/api/supplier/horeca/bon', { bonCode: code.toLowerCase() }, MDW);
  assert.equal(kijk.body.bon.saldo, 4000); assert.equal(kijk.body.bon.id, id);
  assert.equal(kijk.tekst.includes(code.slice(3, 12)), false, 'opzoeken geeft de code niet terug');
  assert.equal((await api('/api/supplier/horeca/bon/roteer', { id, idem: 'r-1' }, MDW)).status, 403, 'roteren is van de manager');
  const rot = await api('/api/supplier/horeca/bon/roteer', { id, idem: 'r-1' }, MGR);
  assert.equal(rot.status, 200, rot.tekst.slice(0, 200));
  assert.equal(rot.koppen.get('cache-control'), 'no-store');
  assert.equal((await api('/api/supplier/horeca/bon', { bonCode: code }, MDW)).body.code, 'bon-vervangen');
  const nogRot = await api('/api/supplier/horeca/bon/roteer', { id, idem: 'r-1' }, MGR);
  assert.equal(nogRot.status, 409); assert.equal(nogRot.tekst.includes('"code":"HB'), false);
  const inn = await api('/api/supplier/horeca/bon/intrek', { id, reden: 'kwijt' }, MDW);
  assert.equal(inn.status, 200); assert.ok(inn.body.bon.toegang.ingetrokken_at);
  const rek = (await api('/api/supplier/horeca/rekening/open', { tafel: 'K1', naam: 'Kassa' }, MGR)).body.rekening;
  await api('/api/supplier/horeca/rekening/regel', { rekeningId: rek.id, naam: 'Lunch', centen: 1000, aantal: 1 }, MGR);
  const dicht = await api('/api/supplier/horeca/betaal', { rekeningId: rek.id, wijze: 'bon', bonCode: rot.body.code }, MDW);
  assert.equal(dicht.status, 409); assert.equal(dicht.body.code, 'bon-ingetrokken');
});

test('de kassa boekt af op code of op ID, en dezelfde sleutel betaalt een keer', async () => {
  const b = (await api('/api/supplier/horeca/bon/maak', { soort: 'tegoed', centen: 3000 }, MDW)).body.bon;
  const rek = (await api('/api/supplier/horeca/rekening/open', { tafel: 'K2', naam: 'Kassa' }, MGR)).body.rekening;
  await api('/api/supplier/horeca/rekening/regel', { rekeningId: rek.id, naam: 'Diner', centen: 5000, aantal: 1 }, MGR);
  const p1 = await api('/api/supplier/horeca/betaal', { rekeningId: rek.id, wijze: 'tegoed', bonCode: b.code, centen: 1000, idem: 'kb-1' }, MDW);
  assert.equal(p1.status, 200, p1.tekst.slice(0, 200)); assert.equal(p1.body.bonSaldo, 2000);
  assert.equal(p1.body.betaling.bonId, b.id); assert.equal(p1.tekst.includes(b.code.slice(3, 12)), false);
  const p2 = await api('/api/supplier/horeca/betaal', { rekeningId: rek.id, wijze: 'tegoed', bonCode: b.code, centen: 1000, idem: 'kb-1' }, MDW);
  assert.equal(p2.body.herhaald, true); assert.equal(p2.body.openstaand, 4000, 'een betaling, niet twee');
  const p3 = await api('/api/supplier/horeca/betaal', { rekeningId: rek.id, wijze: 'bon', bonId: b.id, centen: 5000 }, MDW);
  assert.equal(p3.body.betaling.centen, 2000, 'hooguit het saldo'); assert.equal(p3.body.openstaand, 2000);
});

test('de polsband: de code bij de eerste opwaardering, daarna alleen geld', async () => {
  const eerst = await api('/api/supplier/horeca/club/band', { nummer: 'PB-1', bedrag: 50 }, MDW);
  assert.equal(eerst.status, 200); assert.equal(eerst.koppen.get('cache-control'), 'no-store');
  assert.match(eerst.body.band.bonCode, /^PB(-[0-9A-F]{4}){8}$/);
  const bij = await api('/api/supplier/horeca/club/band', { nummer: 'PB-1', bedrag: 25 }, MDW);
  assert.equal(bij.body.band.saldo, 7500); assert.equal(bij.body.band.bonCode, undefined);
  const drank = await api('/api/supplier/horeca/club/band/betaal', { nummer: 'PB-1', centen: 1250 }, MDW);
  assert.equal(drank.body.saldo, 6250);
});

test('de gast: een code in het betaalverzoek opent niets; koppelen bindt aan EEN sessie', async () => {
  const band = (await api('/api/supplier/horeca/club/band', { nummer: 'PB-2', bedrag: 50 }, MDW)).body.band;
  const a = await tafel('VIP A', 4000);
  const b = await tafel('VIP B', 1000);
  const los = await api('/api/gast/betaal', { sleutel: a.sleutel, wijze: 'tegoed', bonCode: band.bonCode });
  assert.equal(los.status, 409, 'een willekeurige code van de zaak laten afboeken kan niet meer');
  assert.equal(los.body.code, 'bon-niet-gekoppeld');
  const koppel = await api('/api/gast/band', { sleutel: a.sleutel, bonCode: band.bonCode });
  assert.equal(koppel.status, 200, koppel.tekst.slice(0, 200)); assert.equal(koppel.body.saldo, 5000);
  const kaper = await api('/api/gast/band', { sleutel: b.sleutel, bonCode: band.bonCode });
  assert.equal(kaper.status, 409); assert.equal(kaper.body.code, 'bon-elders-gekoppeld');
  assert.equal((await api('/api/gast/betaal', { sleutel: b.sleutel, wijze: 'tegoed' })).body.code, 'bon-niet-gekoppeld');
  const betaal = await api('/api/gast/betaal', { sleutel: a.sleutel, wijze: 'tegoed', idem: 'g-1' });
  assert.equal(betaal.status, 200, betaal.tekst.slice(0, 200));
  assert.equal(betaal.body.gesloten, true); assert.equal(betaal.body.bonSaldo, 1000);
  // de rekening van A is dicht: nu mag B hem koppelen
  assert.equal((await api('/api/gast/band', { sleutel: b.sleutel, bonCode: band.bonCode })).status, 200);
  assert.equal((await api('/api/gast/betaal', { sleutel: b.sleutel, wijze: 'tegoed' })).body.gesloten, true);
});

test('de gast: geraden codes lopen tegen de rem', async () => {
  const c = await tafel('VIP C', 1000);
  let laatste;
  for (let i = 0; i < 11; i++)
    laatste = await api('/api/gast/band', { sleutel: c.sleutel, bonCode: 'HB-' + String(i).padStart(32, '0') });
  assert.equal(laatste.status, 429, 'na tien mislukte pogingen gaat de deur vijf minuten dicht');
});
