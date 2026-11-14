/* Exacte cadeaukaart-eigenaars met echte idem- en kaartmotor; geen provider
   of HTTP-listener nodig. Betaald herstel moet vóór de nieuwe-dienstpoort. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

function wereld(accountId = 17) {
  const db = { data: { giftcards: [] }, writable: true };
  const save = () => {};
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'memory', db, save });
  const kaart = require('../server/kern/cadeaukaart')({ db, bewerkCollectie, crypto });
  // Alleen geheugenopslag: deze proef meet de dienstgrens/replay, geen fsync of commitbarrière.
  const metIdem = naam => require('../server/lib/idem')({ d: () => db.data, save, naam });
  let boekingen = 0, meldingen = 0, logs = 0;
  const stand = { lid: true, zaak: true }, vragen = [];
  const pay = require('../server/kern/pay/partner')({ save, rekLid: x => 'lid:' + x, rekPartner: x => 'zaak:' + x,
    metIdem: metIdem('payIdem'), MIN_CENTEN: 1, MAX_CENTEN: 1000000,
    betaalMetDekking: require('../server/kern/pay/dekking')({ reserveerSleutel: () => null,
      boekAsync: async b => { if (b.nieuweDienstFout) return b.nieuweDienstFout; boekingen++; return { ok: true }; },
      zorgSaldo: async () => { throw Error('Deze proef heeft voldoende saldo'); } }),
    betaaldienstKosten: () => 0, opdrachten: { registreerTeruggang() {} } });
  const routes = new Map();
  const kern = { app: { post: (p, ...h) => routes.set(p, h.at(-1)) }, auth() {}, supplierAuth() {},
    findSupplier: code => code === 'ZAAK' ? { code, name: 'De Zaak' } : null,
    schoon: (x, n) => String(x ?? '').slice(0, n), PERSONAS: {}, pay,
    cadeaukaart: { ...kaart }, notifySupplier: () => meldingen++, sseToSupplier() {},
    logActivity: () => logs++, managerOnly: () => true,
    aanmeldingen: { automatisch: { magDienst: (id, d) => { vragen.push(['lid', id, d]); return stand.lid; } } },
    zaakAbonnement: { magDienst: (code, d) => { vragen.push(['zaak', code, d]); return stand.zaak; } } };
  require('../server/routes/member/cadeaukaart')(kern);
  require('../server/routes/supplier/kassa/cadeaukaart')(kern, { metEigenAfdruk: metIdem('kassaIdem') });
  async function roep(pad, body = {}) {
    const res = { code: 200, status(n) { this.code = n; return this; }, json(x) { this.body = x; return this; } };
    await routes.get(pad)({ body, supplier: { code: 'ZAAK', name: 'De Zaak' }, actor: { name: 'Kassa' },
      session: { key: 'user-' + accountId, tier: 'rtg', account: { codename: 'Koper' } } }, res);
    return res;
  }
  return { db, kern, kaart, stand, vragen, roep, get boekingen() { return boekingen; },
    get meldingen() { return meldingen; }, get logs() { return logs; } };
}
const sell = '/api/supplier/giftcard/sell', buy = '/api/giftcard/buy';

test('kassa: alleen een nieuwe uitgifte is betaald werk, geen kaart of activiteit bij weigering', async () => {
  const w = wereld(); w.stand.zaak = false;
  const r = await w.roep(sell, { bedrag: 100, idem: 'nieuw', basisrecht: 'betalen', supplierCode: 'ANDER' });
  assert.equal(r.code, 402); assert.equal(w.db.data.giftcards.length, 0); assert.equal(w.logs, 0);
  assert.deepEqual(w.vragen, [['zaak', 'ZAAK', { nieuweBetaaldeDienst: true }]]);
  w.stand.zaak = true;
  assert.equal((await w.roep(sell, { bedrag: 100, idem: 'nieuw' })).body.ok, true, 'weigering verbruikt de sleutel niet');
});

test('kassa: cache-replay én herstel na kaartcommit blijven toegestaan zonder nieuwe uitgifte', async () => {
  const w = wereld(), body = { bedrag: 100, idem: 'kaart-1' };
  const eerste = await w.roep(sell, body); assert.equal(eerste.body.eenmalig, true);
  w.stand.zaak = false;
  assert.equal((await w.roep(sell, body)).body.herhaald, true);
  delete w.db.data.kassaIdem; delete w.db.data.kassaIdemAfdruk;
  const herstel = await w.roep(sell, body);
  assert.equal(herstel.body.herhaald, true); assert.equal(herstel.body.codeGetoond, false);
  assert.equal(herstel.body.kaart.id, eerste.body.kaart.id);
  assert.equal(w.db.data.giftcards.length, 1); assert.equal(w.vragen.length, 1);
  assert.equal((await w.roep(sell, { ...body, idem: 'nieuw' })).code, 402);
  const code = eerste.body.kaart.code;
  const afrekening = await w.roep('/api/supplier/giftcard/redeem', { code, bedrag: 10, idem: 'gebruik-1' });
  assert.equal(afrekening.body.saldo, 90, 'bestaande waarde blijft inwisselbaar');
  const rot = await w.roep('/api/supplier/giftcard/roteer', { id: eerste.body.kaart.id, idem: 'rot-1' });
  assert.equal(rot.body.ok, true, 'herstel van een bestaande code blijft bereikbaar');
  assert.equal((await w.roep('/api/supplier/giftcard/intrek', { id: eerste.body.kaart.id })).body.ok, true);
});

test('online koop: eigen lid én gekozen zaak beslissen vóór walletinning, nooit body-identiteit', async () => {
  const w = wereld(), body = { supplierCode: 'ZAAK', bedrag: 50, idem: 'online-1', accountId: 999, basisrecht: 'betalen' };
  w.stand.lid = false;
  assert.equal((await w.roep(buy, body)).code, 402);
  assert.equal(w.boekingen, 0); assert.equal(w.db.data.giftcards.length, 0);
  assert.deepEqual(w.vragen[0], ['lid', 17, { nieuweBetaaldeDienst: true }]);
  w.stand.lid = true; w.stand.zaak = false;
  assert.equal((await w.roep(buy, body)).code, 402); assert.equal(w.boekingen, 0);
  w.stand.zaak = true;
  const r = await w.roep(buy, body);
  assert.equal(r.body.ok, true); assert.equal(w.boekingen, 1); assert.equal(w.meldingen, 1);
});

test('online koop: al betaald maar kaart nog niet opgeslagen wordt na beperking afgemaakt', async () => {
  const w = wereld(), body = { supplierCode: 'ZAAK', bedrag: 50, idem: 'onzeker-1' };
  w.kern.cadeaukaart.uitgeef = async () => { throw Error('kaartopslag tijdelijk onbereikbaar'); };
  await assert.rejects(w.roep(buy, body), /kaartopslag/);
  assert.equal(w.boekingen, 1); assert.equal(w.db.data.giftcards.length, 0);
  w.kern.cadeaukaart.uitgeef = w.kaart.uitgeef;
  w.stand.lid = w.stand.zaak = false;
  const r = await w.roep(buy, body);
  assert.equal(r.body.ok, true); assert.equal(w.boekingen, 1); assert.equal(w.db.data.giftcards.length, 1);
  assert.equal((await w.roep(buy, body)).body.herhaald, true);
  assert.equal((await w.roep(buy, { ...body, bedrag: 51 })).code, 409);
  assert.equal((await w.roep(buy, { ...body, idem: 'nieuw-2' })).code, 402);
  assert.equal(w.boekingen, 1); assert.equal(w.db.data.giftcards.length, 1);
});

test('gewone partnerafrekening zonder nieuwe-dienstdescriptor blijft mogelijk', async () => {
  const w = wereld(); w.stand.lid = w.stand.zaak = false;
  const r = await w.kern.pay.partnerIn({ supplierCode: 'ZAAK', codenaam: 'Koper', centen: 1000, idem: 'bestaand' });
  assert.equal(r.ok, true); assert.equal(w.boekingen, 1); assert.deepEqual(w.vragen, []);
});

test('echte getekende zaakpolicy: uitgifte stopt pas na hersteltermijn en opent na betaalwaarheid', async () => {
  const f = await require('./abonnementsdiensten-fixture.cjs').fixture(), w = wereld();
  w.kern.zaakAbonnement = f.zaakAbonnement;
  assert.equal((await w.roep(sell, { bedrag: 30, idem: 'binnen-termijn' })).body.ok, true);
  f.beperk();
  assert.equal((await w.roep(sell, { bedrag: 30, idem: 'nieuw-na-termijn' })).code, 402);
  assert.equal((await w.roep(sell, { bedrag: 30, idem: 'binnen-termijn' })).body.herhaald, true);
  f.betaal();
  assert.equal((await w.roep(sell, { bedrag: 30, idem: 'nieuw-na-termijn' })).body.ok, true);
  assert.equal(w.db.data.giftcards.length, 2);
});

test('echte getekende persoonlijke policy blokkeert alleen nieuwe online koop vóór de inning', async () => {
  const f = await require('./abonnementsdiensten-fixture.cjs').fixture('rtg'), w = wereld(1);
  w.kern.aanmeldingen.automatisch = require('../server/kern/aanmeldingen/abonnementen')({ db: f.db, accounts: {}, nu: () => f.stand.at });
  const body = { supplierCode: 'ZAAK', bedrag: 30, idem: 'persoonlijke-koop' };
  f.beperk(); assert.equal((await w.roep(buy, body)).code, 402); assert.equal(w.boekingen, 0);
  f.betaal(); assert.equal((await w.roep(buy, body)).body.ok, true); assert.equal(w.boekingen, 1);
});
