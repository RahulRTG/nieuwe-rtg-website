/* EXTERN AFREKENEN TERWIJL RTG-BETALEN UIT STAAT.

   Besluit van de eigenaar (27 september 2026, RELEASEKANDIDAAT.md B2b): zonder
   kaartrail rekent een zaak af zoals elke zaak dat doet -- contant, met de pin
   van haar eigen terminal, of op rekening. Tot nu toe blokkeerde
   opzet/betaalstop.js ook DAT, op het laatste padstuk `/betaal`, en kon er op
   trede 3 dus geen enkele rekening sluiten -- terwijl LAUNCH.md belooft dat de
   vloer "op de rekening" draait.

   Twee helften, en de tweede is de belangrijkste: extern afrekenen komt door,
   en ELKE andere wijze (tegoed, bon, kamer, RTG Pay) blijft even dicht als
   voorheen. De stop staat vóór de body-parser, dus de route zelf moet weigeren
   -- en precies die helft is waar een vergeten regel stil een betaling zou
   simuleren.

   Draai los: node --test test/extern-afrekenen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { isBetaalactie, isExternAfrekenen } = require('../server/opzet/betaalstop');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-extern-'));

function api(pad, body, tk) {
  const h = { 'Content-Type': 'application/json' };
  if (tk) h.Authorization = 'Bearer ' + tk;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_BETALEN_UIT: '1' } });
  base = srv.base;
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const man = (roster.staff || []).find(x => x.role === 'manager');
  token = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  assert.ok(token, 'de manager van KIKUNOI kan inloggen');
});

test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function rekeningMet(centen) {
  const open = await api('/api/supplier/horeca/rekening/open', { tafel: 'T' + Math.random().toString(36).slice(2, 6), naam: 'Proef' }, token);
  assert.equal(open.status, 200, JSON.stringify(open.body).slice(0, 160));
  const id = (open.body.rekening && open.body.rekening.id) || open.body.id;
  const regel = await api('/api/supplier/horeca/rekening/regel', { rekeningId: id, naam: 'Proefgerecht', centen, aantal: 1 }, token);
  assert.equal(regel.status, 200, JSON.stringify(regel.body).slice(0, 160));
  return id;
}

test('1. een rekening sluit met contant en pin terwijl RTG-betalen uit staat', async () => {
  const id = await rekeningMet(2000);
  const a = await api('/api/supplier/horeca/betaal', { rekeningId: id, wijze: 'contant', centen: 1200 }, token);
  assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 200));
  assert.equal(a.body.gesloten, false);
  const b = await api('/api/supplier/horeca/betaal', { rekeningId: id, wijze: 'pin' }, token);
  assert.equal(b.status, 200, JSON.stringify(b.body).slice(0, 200));
  assert.equal(b.body.gesloten, true, 'de rekening is dicht: trede 3 kan afrekenen');
});

test('2. elke wijze die geld via RTG beweegt of simuleert blijft dicht, en laat de rekening open', async () => {
  const id = await rekeningMet(900);
  for (const wijze of ['tegoed', 'bon', 'kamer', 'online', 'munt']) {
    const r = await api('/api/supplier/horeca/betaal', { rekeningId: id, wijze, bonCode: 'X' }, token);
    assert.equal(r.status, 503, wijze + ': ' + JSON.stringify(r.body).slice(0, 160));
    assert.equal(r.body.code, 'betalingen-uit', wijze);
  }
  const zien = await api('/api/supplier/horeca/rekening', { rekeningId: id }, token);
  const rek = zien.body.rekening || zien.body;
  assert.equal(rek.status, 'open', 'geen enkele geweigerde poging heeft iets als betaald gemarkeerd');
  assert.equal((rek.betalingen || []).length, 0);
});

test('3. op rekening mag ook, en de gastrekening van een kamer sluit extern', async () => {
  const id = await rekeningMet(500);
  const r = await api('/api/supplier/horeca/betaal', { rekeningId: id, wijze: 'rekening' }, token);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.gesloten, true);
  const kamer = 'K' + Math.random().toString(36).slice(2, 5);
  const folio = await api('/api/supplier/horeca/folio/open', { kamer, naam: 'Proefgast' }, token);
  assert.equal(folio.status, 200, JSON.stringify(folio.body).slice(0, 200));
  const boek = await api('/api/supplier/horeca/folio/boek', { kamer, soort: 'restaurant', omschrijving: 'diner', centen: 3000 }, token);
  assert.equal(boek.status, 200, JSON.stringify(boek.body).slice(0, 200));
  const via = await api('/api/supplier/horeca/folio/afrekenen', { kamer, wijze: 'tegoed' }, token);
  assert.equal(via.status, 503, 'een folio kan niet via RTG-tegoed sluiten');
  const extern = await api('/api/supplier/horeca/folio/afrekenen', { kamer, wijze: 'pin' }, token);
  assert.equal(extern.status, 200, JSON.stringify(extern.body).slice(0, 200));
  assert.equal(extern.body.gesloten, true);
});

test('4. alleen deze drie routes zijn uitgezonderd; de rest van de betaalstop blijft staan', async () => {
  for (const pad of ['/api/supplier/horeca/betaal', '/api/supplier/horeca/folio/afrekenen', '/api/supplier/tafelticket/afrekenen'])
    assert.equal(isExternAfrekenen(pad), true, pad);
  for (const pad of ['/api/supplier/horeca/club/band/betaal', '/api/supplier/pos/redeem', '/api/supplier/facturen/betaald',
    '/api/pay/stuur', '/api/giftcard/buy', '/api/booking/pay']) {
    assert.equal(isExternAfrekenen(pad), false, pad);
    assert.equal(isBetaalactie('POST', pad), true, pad);
  }
  const band = await api('/api/supplier/horeca/club/band/betaal', { band: 'x' }, token);
  assert.equal(band.status, 503, 'een clubbandje afrekenen blijft dicht');
  const tafel = await api('/api/supplier/tafelticket/afrekenen', { table: 'T0', method: 'rtgpay' }, token);
  assert.notEqual(tafel.status, 200, 'RTG Pay op een tafelticket komt er niet door');
});
