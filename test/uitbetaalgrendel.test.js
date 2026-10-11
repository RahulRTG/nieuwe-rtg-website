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
  // maakUitbetaling woont sinds de opsplitsing van betaal.js in betaal/uitbetaling.js
  assert.match(lees('server/betaal/uitbetaling.js'), /uitbetaalgrendel'\)\.eisOpen\('uitbetaling'\)/);
  assert.match(lees('server/betaal/naslag.js'), /uitbetaalgrendel'\)\.eisOpen\('terugbetaling'\)/);
});

test('terugbetaling via een echte provider wordt geweigerd voordat de provider wordt aangeroepen', async () => {
  let aangeroepen = 0;
  const mollie = { refunds: { create: async () => { aangeroepen++; return { id: 'x', status: 'queued' }; } } };
  const naslag = require('../server/betaal/naslag')({ crypto: require('node:crypto'), stripe: null, mollie, adyen: null,
    stripeGehost: null, weigerUit: () => {}, mollieBedrag: () => ({}) });
  /* Sinds de vrijgavepoort (server/kern/vrijgave/) staat die ervoor: zonder
     ingeschakelde, geverifieerde en geautoriseerde `geld.terugbetaling` komt de
     aanvraag niet eens bij de grendel. */
  await assert.rejects(naslag.maakTerugbetaling({ aanbieder: 'mollie', providerId: 'tr_1', bedrag: 100, idempotentieSleutel: 'k' }),
    (e) => e.code === 'VRIJGAVE_DICHT' && e.nietVerstuurd === true);
  assert.equal(aangeroepen, 0, 'de provider is toch aangeroepen');
});

test('ook met een open vrijgavepoort blijft de grendel de bewijsas: dicht zonder release-gebonden dossier', async () => {
  let aangeroepen = 0, gevraagd = null;
  const mollie = { refunds: { create: async () => { aangeroepen++; return { id: 'x', status: 'queued' }; } } };
  const open = { eis: (id, ctx) => { gevraagd = { id, ctx }; return { beschikbaar: true }; } };
  const naslag = require('../server/betaal/naslag')({ crypto: require('node:crypto'), stripe: null, mollie, adyen: null,
    stripeGehost: null, weigerUit: () => {}, mollieBedrag: () => ({}), vrijgave: open });
  await assert.rejects(naslag.maakTerugbetaling({ aanbieder: 'mollie', providerId: 'tr_1', bedrag: 100, idempotentieSleutel: 'k' }),
    (e) => e.code === 'UITBETAALGRENDEL_DICHT');
  assert.equal(aangeroepen, 0, 'de provider is toch aangeroepen');
  assert.equal(gevraagd.id, 'geld.terugbetaling', 'de poort is naar de juiste capability gevraagd');
  assert.equal(gevraagd.ctx.provider, 'mollie', 'met de provider van deze betaling');
});

test('open:true met een bestaand pad als bewijs opent de rail NIET zonder release-gebonden dossier', () => {
  /* De vorige grendel las `bewijs` als vrij veld: iedere niet-lege tekst opende
     de rail. Hier wijst hij naar een bestand dat bestaat (package.json) -- en
     toch blijft hij dicht, omdat er geen getekend dossier voor deze release is. */
  const orig = fs.readFileSync(grendel.PAD, 'utf8');
  try {
    fs.writeFileSync(grendel.PAD, JSON.stringify({ open: true, bewijs: 'package.json',
      voorwaarden: ['payoutProvider', 'refundPayoutSettlement', 'reconciliation'] }));
    const s = grendel.stand();
    assert.equal(s.open, false, 'een bestaand pad als bewijs opende de rail');
    assert.match(s.reden, /release-gebonden bewijs/);
    fs.writeFileSync(grendel.PAD, JSON.stringify({ open: true, bewijs: 'package.json', voorwaarden: [] }));
    assert.equal(grendel.stand().open, false, 'open zonder voorwaarden opende de rail');
  } finally { fs.writeFileSync(grendel.PAD, orig); }
});

test('uitbetaling via Stripe: eerst de vrijgavepoort, op de capability die de aanroeper noemt, dan de grendel', async () => {
  const maak = require('../server/betaal/uitbetaling');
  const deps = { betalenUit: false, haalOp: () => null, bewaar: () => {}, regie: {}, sandbox: {}, stripe: {},
    demoBetalen: false, aanbieder: () => 'stripe', eisBetaalrail: () => {}, crypto: require('node:crypto') };
  /* Zonder capability, met de echte poort: dicht, en niets verstuurd. */
  await assert.rejects(maak(deps)({ bedrag: 100, iban: 'NL91ABNA0417164300' }),
    (e) => e.code === 'VRIJGAVE_DICHT' && e.nietVerstuurd === true);
  /* Met een open poort is de grendel nog steeds de bewijsas. */
  let gevraagd = null;
  await assert.rejects(maak(Object.assign({}, deps, { vrijgave: { eis: (id) => { gevraagd = id; return { beschikbaar: true }; } } }))(
    { bedrag: 100, iban: 'NL91ABNA0417164300', vrijgave: 'geld.lid_iban_uitbetaling' }),
  (e) => e.code === 'UITBETAALGRENDEL_DICHT');
  assert.equal(gevraagd, 'geld.lid_iban_uitbetaling', 'de poort is naar de capability van de aanroeper gevraagd');
});
