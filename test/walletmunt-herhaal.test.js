/* Een betaling geeft een keer feestmunten (server/kern/wallet.js, muntKoop).

   Gevonden door de voltooiproef van de wallet (scripts/lib/voltooi/wallet.js):
   een koop, een SIGKILL, en dezelfde tik opnieuw. RTG Pay antwoordde terecht met
   de bewaarde boeking en betaalde niet nog eens -- maar de wallet telde de munten
   dan toch opnieuw bij: tien munten voor een betaling van vijf. Hier met een
   betaalnaad die herhaalt zoals server/lib/idem.js dat doet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakWallet } = require('../server/kern/wallet');

function wereld() {
  const db = { data: {} };
  const betaald = new Map();
  let boekingen = 0;
  const pay = {
    async huisIn({ centen, idem }) {
      if (idem && betaald.has(idem)) return Object.assign({}, betaald.get(idem), { herhaald: true });
      const r = { ok: true, centen, bijgeladen: 0, boeking: 'B' + (++boekingen) };
      if (idem) betaald.set(idem, r);
      return r;
    }
  };
  const schoon = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200);
  const { wallet } = maakWallet({ db, save: () => {}, crypto, schoon, pay, codenaamVan: () => 'Codenaam' });
  return { wallet, boekingen: () => boekingen };
}

const saldo = (wallet, zaak) => wallet.lijst('user-1').items
  .filter((x) => x.soort === 'munt' && x.titel === 'Feestmunten · ' + zaak).reduce((n, x) => n + x.saldo, 0);

test('dezelfde koop opnieuw (zelfde sleutel) geeft de munten niet nog eens', async () => {
  const { wallet, boekingen } = wereld();
  const a = await wallet.muntKoop('user-1', { zaak: 'Feest', aantal: 5, idem: 'k1' });
  const b = await wallet.muntKoop('user-1', { zaak: 'Feest', aantal: 5, idem: 'k1' });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(b.herhaald, true, 'de herhaling zegt dat ze een herhaling is');
  assert.equal(boekingen(), 1, 'een betaling');
  assert.equal(saldo(wallet, 'Feest'), 5, 'vijf munten voor een betaling van vijf');
});

test('twee tikken tegelijk met dezelfde sleutel maken geen tweede muntregel', async () => {
  const { wallet } = wereld();
  await Promise.all([wallet.muntKoop('user-1', { zaak: 'Samen', aantal: 2, idem: 'k2' }),
    wallet.muntKoop('user-1', { zaak: 'Samen', aantal: 2, idem: 'k2' })]);
  assert.equal(saldo(wallet, 'Samen'), 2);
});

test('een nieuwe koop (andere sleutel) telt wel gewoon bij', async () => {
  const { wallet, boekingen } = wereld();
  await wallet.muntKoop('user-1', { zaak: 'Feest', aantal: 5, idem: 'k1' });
  await wallet.muntKoop('user-1', { zaak: 'Feest', aantal: 3, idem: 'k3' });
  assert.equal(boekingen(), 2);
  assert.equal(saldo(wallet, 'Feest'), 8);
});
