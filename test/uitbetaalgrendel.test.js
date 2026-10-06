'use strict';
/* A-P0-02: echt geld uit het huis is standaard dicht en opent alleen met bewijs. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const grendel = require('../server/betaal/uitbetaalgrendel');

test('het register staat dicht en noemt de voorwaarden', () => {
  const r = JSON.parse(fs.readFileSync(grendel.PAD, 'utf8'));
  assert.equal(r.open, false);
  for (const v of ['payoutProvider', 'refundPayoutSettlement', 'reconciliation']) assert.ok(r.voorwaarden.includes(v), v);
  assert.equal(grendel.stand().open, false);
});

test('eisOpen weigert met code, reden en nietVerstuurd', () => {
  assert.throws(() => grendel.eisOpen('uitbetaling'), (e) => e.code === 'UITBETAALGRENDEL_DICHT' && e.nietVerstuurd === true && /Er is niets verstuurd/.test(e.message));
});

test('open zonder bewijs telt als dicht; onleesbaar register is dicht', () => {
  const orig = fs.readFileSync(grendel.PAD, 'utf8');
  try {
    fs.writeFileSync(grendel.PAD, JSON.stringify({ open: true, bewijs: null }));
    assert.equal(grendel.stand().open, false, 'open:true zonder bewijs opende de rail');
    fs.writeFileSync(grendel.PAD, '{kapot');
    assert.equal(grendel.stand().open, false, 'onleesbaar register opende de rail');
  } finally { fs.writeFileSync(grendel.PAD, orig); }
});

test('als het register ooit open staat wijst bewijs naar een bestaand dossier', () => {
  const r = JSON.parse(fs.readFileSync(grendel.PAD, 'utf8'));
  if (r.open) assert.ok(typeof r.bewijs === 'string' && fs.existsSync(path.join(__dirname, '..', r.bewijs)), 'open zonder bestaand bewijsdossier');
});

test('elke echte providertak van terugbetaling en uitbetaling gaat langs de grendel (bron)', () => {
  const lees = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  assert.match(lees('server/betaal.js'), /uitbetaalgrendel'\)\.eisOpen\('uitbetaling'\)/);
  assert.match(lees('server/betaal/naslag.js'), /uitbetaalgrendel'\)\.eisOpen\('terugbetaling'\)/);
});

test('terugbetaling via een echte provider wordt geweigerd voordat de provider wordt aangeroepen', async () => {
  let aangeroepen = 0;
  const mollie = { refunds: { create: async () => { aangeroepen++; return { id: 'x', status: 'queued' }; } } };
  const naslag = require('../server/betaal/naslag')({ crypto: require('node:crypto'), stripe: null, mollie, adyen: null,
    stripeGehost: null, weigerUit: () => {}, mollieBedrag: () => ({}) });
  await assert.rejects(naslag.maakTerugbetaling({ aanbieder: 'mollie', providerId: 'tr_1', bedrag: 100, idempotentieSleutel: 'k' }),
    (e) => e.code === 'UITBETAALGRENDEL_DICHT');
  assert.equal(aangeroepen, 0, 'de provider is toch aangeroepen');
});
