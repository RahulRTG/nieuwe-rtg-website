/* EEN GEWEIGERDE DIRECTE BETALING IS AF, NIET ONDERWEG (19 oktober 2026).

   De voltooiproef van de stand Betalen (scripts/lib/voltooi-stand/betalen.js)
   liet de simulatiebank een directe betaling weigeren, en het lid kreeg te
   horen dat de kaartbetaling "nog niet definitief bevestigd" was -- alsof hij
   moest wachten. kern/pay/opladen.js maakte dat onderscheid al; kern/directpay/
   betalen.js nu ook. Een betaling die echt nog loopt, blijft wachten. Deze
   toets bouwt alleen de handeling, met een nagemaakte betaalwaarheid, en zakt
   zonder het onderscheid. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const maak = require('../server/kern/directpay/betalen');

function handeling(stand) {
  const rijen = {};
  const betaalWaarheid = {
    maak: (o) => { const id = 'BW-' + Object.keys(rijen).length; rijen[id] = { id, status: 'NIEUW' }; return { id }; },
    begin: async (id) => { rijen[id].status = stand; return { betaling: { status: stand.toLowerCase() } }; },
    van: (id) => rijen[id]
  };
  return maak({ save() {}, crypto, betaal: { AANBIEDER: 'synthetisch' }, betaalWaarheid, ensure() {},
    centenVan: (c) => Math.round(Number(c)), id: () => 'x', schoon: (v) => String(v || ''), nu: () => new Date().toISOString(),
    ledger: {}, publiek: (b) => b, idemZoek: () => null, idemBewaar() {}, tempoOk: () => true,
    findSupplier: () => ({ code: 'ZAAK', name: 'Zaak' }), notifySupplier() {}, logActivity() {},
    sseToSupplier() {}, sseToCustomer() {}, sseToOffice() {}, MIN_CENTEN: 50, MAX_CENTEN: 100000,
    directBetalingenVoegToe() {} }).betaalDirect;
}

test('een geweigerde betaling zegt dat ze niet gelukt is, en niet dat ze wacht', async () => {
  const r = await handeling('GEWEIGERD')({ key: 'k', codename: 'C', supplierCode: 'ZAAK', bedragCenten: 750, idem: 'a' });
  assert.equal(r.status, 402);
  assert.equal(r.pending, false);
  assert.match(r.error, /niet gelukt/);
  assert.doesNotMatch(r.error, /nog niet definitief|wacht/);
});

test('een betaling die nog loopt, blijft wachten', async () => {
  const r = await handeling('WACHT_OP_KLANT')({ key: 'k', codename: 'C', supplierCode: 'ZAAK', bedragCenten: 750, idem: 'b' });
  assert.equal(r.status, 402);
  assert.equal(r.pending, true);
  assert.match(r.error, /nog niet definitief/);
});

test('een lopende directe betaling bindt de herhaalsleutel aan bedrag en partner', async () => {
  let los, gestart = 0;
  const wacht = new Promise(resolve => { los = resolve; });
  const betalen = maak({ crypto, betaal: { AANBIEDER: 'synthetisch' }, ensure() {},
    centenVan: Number, schoon: String, idemZoek: () => null, tempoOk: () => true,
    findSupplier: code => ({ code, name: code }), MIN_CENTEN: 50, MAX_CENTEN: 100000,
    betaalWaarheid: {
      maak: () => ({ id: 'bw1' }),
      begin: async () => { gestart++; await wacht; return {}; },
      van: () => ({ status: 'WACHT_OP_KLANT' })
    }
  }).betaalDirect;
  const invoer = { key: 'lid', supplierCode: 'A', bedragCenten: 500, idem: 'zelfde' };
  const eerste = betalen(invoer);
  const bedrag = betalen({ ...invoer, bedragCenten: 600 });
  const partner = betalen({ ...invoer, supplierCode: 'B' });
  const herhaling = betalen(invoer);
  los();
  const [a, b, c, d] = await Promise.all([eerste, bedrag, partner, herhaling]);
  assert.equal(b.status, 409, 'ander bedrag tijdens een lopende betaling is een conflict');
  assert.equal(c.status, 409, 'andere partner tijdens een lopende betaling is een conflict');
  assert.equal(a.pending, true);
  assert.deepEqual(d, a);
  assert.equal(gestart, 1, 'de provider wordt maar eenmaal gestart');
});
