/* Veiligheidsgrenzen rond echt geld. Deze toetsen sturen niets naar buiten:
   Stripe wijst naar een dichte lokale poort en de DirectPay-provider is nep. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const crypto = require('node:crypto');
const { maakDirectpay } = require('../server/kern/directpay');
const { maakSettlement } = require('../server/kern/settlement');

test('Stripe negeert een partnerbestemming nooit meer stil', () => {
  const code = `
    const b=require('./server/betaal');
    b.maakBetaling({bedrag:100,bestemming:'acct_partner'}).then(()=>process.exit(9)).catch(e=>{
      if(e.code!=='STRIPE_CONNECT_NIET_ACTIEF') { console.error(e); process.exit(8); }
    });`;
  const r = spawnSync(process.execPath, ['-e', code], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8',
    env: { ...process.env, RTG_DEMO: '', STRIPE_DEMO_BEWUST: '', STRIPE_SECRET_KEY: 'sk_test_veilig', STRIPE_BASE_URL: 'http://127.0.0.1:1' }
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('Stripe maakt geen schijn-payout met een IBAN in metadata', () => {
  const code = `
    const b=require('./server/betaal');
    b.maakUitbetaling({bedrag:100,iban:'NL00BANK0123456789'}).then(()=>process.exit(9)).catch(e=>{
      if(e.code!=='UITBETAALRAIL_NIET_ACTIEF') { console.error(e); process.exit(8); }
    });`;
  const r = spawnSync(process.execPath, ['-e', code], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8',
    env: { ...process.env, RTG_DEMO: '', STRIPE_DEMO_BEWUST: '', STRIPE_SECRET_KEY: 'sk_test_veilig', STRIPE_BASE_URL: 'http://127.0.0.1:1' }
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

function bouw(provider) {
  const data = { directBetalingen: [], betaalVerzoeken: [], directOntvangsten: {} };
  const opRef = (naam) => (ref) => data[naam].find(x => x.ref === ref);
  const opVeld = (naam, veld) => (v) => data[naam].filter(x => x[veld] === v);
  const voeg = (naam) => (x) => { data[naam].unshift(x); };
  const api = maakDirectpay({
    db: { data }, save() {}, crypto,
    findSupplier: c => c === 'ZAAK' ? { code: 'ZAAK', name: 'Veilige Zaak', stripeAccount: 'acct_partner' } : null,
    betaal: provider, notify() {}, notifySupplier() {}, sseToSupplier() {}, sseToCustomer() {}, sseToOffice() {}, logActivity() {},
    directBetalingMetRef: opRef('directBetalingen'), directBetalingenVanKlant: opVeld('directBetalingen', 'key'),
    directBetalingenVanZaak: opVeld('directBetalingen', 'supplierCode'), directBetalingenVoegToe: voeg('directBetalingen'),
    betaalVerzoekMetRef: opRef('betaalVerzoeken'), betaalVerzoekenVoorCodenaam: opVeld('betaalVerzoeken', 'naarCodename'),
    betaalVerzoekenVanZaak: opVeld('betaalVerzoeken', 'supplierCode'), betaalVerzoekenVoegToe: voeg('betaalVerzoeken')
  });
  return { api, data };
}

test('echte DirectPay staat dicht vóór er een PaymentIntent wordt gestart', async () => {
  let aangeroepen = 0;
  const x = bouw({ AANBIEDER: 'stripe', async maakBetaling() { aangeroepen++; return { status: 'succeeded' }; } });
  const r = await x.api.dpBetaalDirect({ key: 'lid', codename: 'Veilig', supplierCode: 'ZAAK', bedragCenten: 1000 });
  assert.equal(r.status, 503);
  assert.equal(aangeroepen, 0, 'de provider wordt niet eens aangeroepen');
  assert.equal(x.data.directBetalingen.length, 0);
});

test('processing telt niet als partneromzet; pas de bevestigde registrar boekt', async () => {
  const x = bouw({ AANBIEDER: 'proef', async maakBetaling() {
    return { id: 'pi_wacht', status: 'processing', clientSecret: 'pi_wacht_secret', aanbieder: 'proef' };
  } });
  const r = await x.api.dpBetaalDirect({ key: 'lid', codename: 'Veilig', supplierCode: 'ZAAK', bedragCenten: 1000, idem: 'een' });
  assert.equal(r.status, 402);
  assert.equal(r.pending, true);
  assert.equal(x.data.directBetalingen.length, 0);
  assert.equal(x.data.directOntvangsten.ZAAK, undefined);
  assert.equal(x.data.kaartWachtend.pi_wacht.centen, 1000);

  const b = x.api.dpRegistreerBevestigd({ key: 'lid', codename: 'Veilig', supplierCode: 'ZAAK', bedragCenten: 1000,
    providerId: 'pi_wacht', idem: 'provider:pi_wacht', aanbieder: 'stripe', betaalwijze: 'kaart' });
  assert.equal(b.ok, true);
  assert.equal(x.data.directOntvangsten.ZAAK.som, 1000);
  const weer = x.api.dpRegistreerBevestigd({ key: 'lid', codename: 'Veilig', supplierCode: 'ZAAK', bedragCenten: 1000,
    providerId: 'pi_wacht', idem: 'provider:pi_wacht', aanbieder: 'stripe', betaalwijze: 'kaart' });
  assert.equal(weer.herhaald, true);
  assert.equal(x.data.directOntvangsten.ZAAK.som, 1000, 'providerretry boekt niet dubbel');
});

test('directe settlement eist exact het verwachte bedrag', async () => {
  const geboekt = [];
  const fouten = [];
  const settle = maakSettlement({
    db: { data: {} }, save() {}, accounts: {}, fonds: {},
    log: { error: (m) => fouten.push(m), warn() {} }, dpRegistreerMunt() {},
    dpRegistreerBevestigd: a => { geboekt.push(a); return { ok: true, betaling: { ref: 'DP1' } }; }
  });
  const ctx = { soort: 'direct', betaalwijze: 'kaart', key: 'lid', supplierCode: 'ZAAK', centen: 2500, idem: 'provider:pi_1' };
  const fout = await settle(ctx, { id: 'pi_1', centen: 1 });
  assert.equal(fout.status, 409);
  assert.equal(geboekt.length, 0);
  const goed = await settle(ctx, { id: 'pi_1', centen: 2500 });
  assert.equal(goed.ok, true);
  assert.equal(geboekt.length, 1);
  assert.equal(geboekt[0].bedragCenten, 2500);
});
