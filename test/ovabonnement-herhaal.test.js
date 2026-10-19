/* Het OV-abonnement en zijn herhaalsleutel na een crash TUSSEN de boeking en
   het abonnement (kern/mobiliteit/abonnement.js). Draai los:
   node --test test/ovabonnement-herhaal.test.js

   De idem-laag van de route is geheugen en na een crash leeg. Kreeg de
   aankoop dan een vers id, dan weigerde de geldlaag de herhaling (dezelfde
   economische sleutel, een andere referentie) -- en was er betaald zonder
   abonnement. Hier staat de geldlaag als nabootsing van de economische
   boeking: een sleutel, een referentie, en een andere referentie onder
   dezelfde sleutel is een 409. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function wereld() {
  const kaartjes = [];
  const geboekt = new Map();          // economische sleutel -> referentie
  const opslag = { bak: () => kaartjes };
  const zaak = { code: 'TRANSIT', name: 'Ibiza Transit', type: 'ov', city: 'Ibiza' };
  const overeenkomst = { id: 'ok1', producten: ['abonnement'], lijnen: ['L1'], abonnementPrijs: 4500, abonnementDagen: 30 };
  let crashNaBoeking = false;
  const pay = {
    saldoVan: () => 100000,
    laadOp: async () => ({ ok: true }),
    boekAsync: async (b) => {
      const oud = geboekt.get(b.economischeSleutel);
      if (oud && oud !== b.ref) return { status: 409, error: 'Deze economische sleutel hoort al bij een andere boeking.' };
      geboekt.set(b.economischeSleutel, b.ref);
      if (crashNaBoeking) { crashNaBoeking = false; throw new Error('stroomstoring na de boeking'); }
      return { ok: true, herhaald: !!oud };
    }
  };
  const ctx = { db: {}, save: () => {}, crypto, id: (p) => p + crypto.randomBytes(4).toString('hex'),
    schoon: (v, n) => String(v == null ? '' : v).slice(0, n), nu: () => new Date().toISOString(),
    codenaamVan: () => 'Zeearend 1A2B', pay, findSupplier: (c) => (c === 'TRANSIT' ? zaak : null),
    modAan: () => ({ aan: true }), overeenkomstVoor: () => ({ geldig: true, overeenkomst }),
    magVerkopen: () => ({ mag: true }), notify: () => {}, ensureKaartjes: () => {},
    kaartenVan: (key) => kaartjes.filter((k) => k.key === key), opslag };
  return { ctx, kaartjes, geboekt, crash: () => { crashNaBoeking = true; } };
}

test('een crash tussen boeking en abonnement: dezelfde sleutel geeft een abonnement en een betaling', async () => {
  const w = wereld();
  const sessie = { key: 'user-1', tier: 'rtg' };
  w.crash();
  await assert.rejects(require('../server/kern/mobiliteit/abonnement')(w.ctx).aboKoop(sessie, { vervoerder: 'TRANSIT', idem: 'abo-1' }));
  assert.equal(w.kaartjes.length, 0, 'de crash viel voor het abonnement');
  /* Na de herstart: een verse module, dezelfde opslag en hetzelfde grootboek. */
  const r = await require('../server/kern/mobiliteit/abonnement')(w.ctx).aboKoop(sessie, { vervoerder: 'TRANSIT', idem: 'abo-1' });
  assert.equal(r.ok, true, 'geen weigering: ' + (r.error || ''));
  assert.equal(w.kaartjes.length, 1, 'precies een abonnement');
  assert.equal(w.geboekt.size, 1, 'precies een betaling');
  const weer = await require('../server/kern/mobiliteit/abonnement')(w.ctx).aboKoop(sessie, { vervoerder: 'TRANSIT', idem: 'abo-1' });
  assert.equal(weer.herhaald, true, 'een tweede herhaling krijgt hetzelfde abonnement');
  assert.equal(weer.abonnement.id, r.abonnement.id);
  assert.equal(w.kaartjes.length, 1);
});
