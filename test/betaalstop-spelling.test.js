/* ============================================================================
   DE BETAALSTOP LEEST HET PAD ZOALS DE ROUTER -- regressie voor N37 uit de
   V1-audit (ronde 7).

   DE FOUT: server/opzet/betaalstop.js vergeleek req.path met patronen die op
   een $ eindigen. De router brengt een pad met een slash erachter bij dezelfde
   handler, dus met RTG_BETALEN_UIT=1 gaf POST /api/supplier/giftcard/sell/ een
   cadeaukaart met saldo, en zette horeca/betaal/ een rekening op betaald.
   Dezelfde klasse als N18 (inlogpauze) en N26 (schorspoort).

   DE FIX: isBetaalactie en externRegel toetsen elke kandidaat van vastePaden()
   uit server/web/routeindex.js. Beide, anders wordt horeca/betaal/ een
   betaalactie zonder de uitzondering voor extern afrekenen.

   Draai los: node --test test/betaalstop-spelling.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { isBetaalactie, isExternAfrekenen } = require('../server/opzet/betaalstop');

let srv, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-betaalspelling-'));

async function api(pad, body, tk) {
  const h = { 'Content-Type': 'application/json' };
  if (tk) h.Authorization = 'Bearer ' + tk;
  const r = await fetch(srv.base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  const tekst = await r.text();
  let json = {};
  try { json = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: json, tekst };
}
const kort = r => r.status + ' ' + r.tekst.slice(0, 160);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_BETALEN_UIT: '1' } });
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const man = (roster.staff || []).find(x => x.role === 'manager');
  token = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  assert.ok(token, 'de manager van KIKUNOI logt in');
});
test.after(async () => {
  await stop(srv);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de functies zien elke spelling die de router bij de handler brengt', () => {
  for (const p of ['/api/supplier/giftcard/sell', '/api/supplier/giftcard/sell/', '/api/supplier/giftcard/sell/?x=1',
    '/api/bank/pas/betaal/', '/api/supplier/pos/redeem/']) {
    assert.equal(isBetaalactie('POST', p), true, p + ' is een betaalactie');
  }
  assert.equal(isExternAfrekenen('/api/supplier/horeca/betaal/'), true, 'ook met slash extern afrekenen');
  // TEGENPROEF: geen betaalactie blijft geen betaalactie, ook met een slash
  assert.equal(isBetaalactie('POST', '/api/state/'), false);
  assert.equal(isBetaalactie('GET', '/api/supplier/giftcard/sell/'), false, 'lezen is geen betaalactie');
});

test('2. op een echte server: met een slash erachter geen cadeaukaart', async () => {
  for (const p of ['/api/supplier/giftcard/sell', '/api/supplier/giftcard/sell/', '/api/supplier/giftcard/sell/?x=1']) {
    const r = await api(p, { bedrag: 50 }, token);
    assert.equal(r.status, 503, p + ' wordt gestopt: ' + kort(r));
    assert.equal(r.body.code, 'betalingen-uit', p);
  }
  // TEGENPROEF met de echte status: een gewone route komt gewoon bij zijn handler
  const st = await api('/api/state/', {});
  assert.equal(st.status, 401, 'een ledenroute zonder sessie: ' + kort(st));
  const rooster = await api('/api/supplier/roster/', { code: 'KIKUNOI' });
  assert.equal(rooster.status, 200, 'een niet-betaalroute met een slash: ' + kort(rooster));
});

test('3. horeca/betaal/ blijft extern afrekenen: online dicht, de wijze van de zaak wordt aan de route gelaten', async () => {
  const online = await api('/api/supplier/horeca/betaal/', { wijze: 'online', rekeningId: 'bestaat-niet' }, token);
  assert.equal(online.status, 503, 'online betalen blijft dicht, ook met een slash: ' + kort(online));
  const contant = await api('/api/supplier/horeca/betaal/', { wijze: 'contant', rekeningId: 'bestaat-niet' }, token);
  assert.notEqual(contant.body.code, 'betalingen-uit', 'contant komt langs de stop bij de route: ' + kort(contant));
});
