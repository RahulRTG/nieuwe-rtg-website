'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
function motor(data = {}) {
  const db = { data }, rail = [];
  let saves = 0;
  const save = () => saves++;
  const opdrachten = require('../server/kern/betaalopdracht')({ d: () => db.data,
    save, crypto, nu: () => 1, log: { warn() {} },
    railInzenden: async o => { rail.push(o.id); return { id: 'rail-1', status: 'ingepland' }; } });
  const bankregie = require('../server/kern/bankregie').maakBankregie({ db, save, bijeen: werk => werk() });
  const { bank } = require('../server/kern/bank')({ db, save, bijeen: werk => werk(), crypto,
    schoon: (s, n) => String(s || '').slice(0, n), betaal: {}, pay: {}, bankregie,
    keyVanCodenaam: async code => ({ key: code }), accounts: {}, sseToCustomer() {}, betaalOpdrachten: opdrachten });
  return { db, bank, opdrachten, rail, saves: () => saves };
}

test('het echte bankoverzicht leest lege opslag zonder de vier collecties aan te maken', async () => {
  const p = motor(), voor = JSON.stringify(p.db.data);
  const r = p.bank.overzicht();
  assert.equal(r.status, 200); assert.deepEqual(r.rekeningen, []);
  assert.equal(r.gezondheid.sluit.klopt, true);
  assert.equal(r.gezondheid.railOpen, 0); assert.equal(r.gezondheid.depositoCenten, 0);
  assert.equal(JSON.stringify(p.db.data), voor, 'geen bankSaldi/bankRekeningen/bankBoekingen/betaalOpdrachten zonder schrijfactie');
  assert.equal(p.saves(), 0); assert.deepEqual(p.rail, []);
  assert.equal(p.bank.afschrift({ iban: 'onbekend' }).status, 404);
  assert.equal(p.bank.saldoVan('onbekend'), 0);
  assert.equal(p.bank.sluitcontrole().klopt, true);
  await p.bank.motorStand.stand();
  assert.equal(JSON.stringify(p.db.data), voor);
});

test('opdrachtlijsten, zoeken en een lege ronde maken geen opdrachtenrij aan', async () => {
  const p = motor();
  assert.equal(p.opdrachten.openstaand().aantal, 0);
  assert.equal(p.opdrachten.lijst().aantal, 0);
  assert.equal(p.opdrachten.vind('onbekend'), null);
  assert.equal(p.opdrachten.vindOpSettlement('onbekend'), null);
  assert.equal(p.opdrachten.vindOpIdem('onbekend'), null);
  assert.equal((await p.opdrachten.ronde()).gedaan, 0);
  assert.deepEqual(p.db.data, {}); assert.equal(p.saves(), 0); assert.deepEqual(p.rail, []);
});

test('schrijvers initialiseren zelf na een leeg overzicht en gevonden opdrachten blijven levende rijen', async () => {
  const p = motor(); p.bank.overzicht();
  const geboekt = p.bank.boek({ van: 'extern:emissie', naar: 'rtg:reserve', centen: 1234, soort: 'proef' });
  assert.equal(geboekt.ok, true);
  assert.equal(p.db.data.bankSaldi['rtg:reserve'], 1234);
  assert.equal(p.db.data.bankSaldi['extern:emissie'], -1234);
  assert.equal(p.db.data.bankBoekingen.length, 1);
  const o = p.opdrachten.maak({ soort: 'sepa-uit', centen: 1234, bron: 'rtg:reserve',
    bestemming: 'ontvanger', ledgerRef: geboekt.boeking.id, idemSleutel: 'opdracht-1' });
  assert.equal(p.db.data.betaalOpdrachten.length, 1);
  assert.equal(p.opdrachten.vind(o.id), p.db.data.betaalOpdrachten[0]);
  assert.equal(p.opdrachten.vindOpIdem('opdracht-1'), p.db.data.betaalOpdrachten[0]);
  await p.opdrachten.dienIn(o.id);
  assert.equal(p.db.data.betaalOpdrachten[0].status, 'INGEDIEND');
  assert.equal(p.opdrachten.vindOpSettlement('rail-1'), p.db.data.betaalOpdrachten[0]);
  assert.ok(p.saves() > 0);
  const voor = JSON.stringify(p.db.data), saves = p.saves();
  assert.equal(p.bank.overzicht().gezondheid.reserveCenten, 1234);
  assert.equal(JSON.stringify(p.db.data), voor); assert.equal(p.saves(), saves);
});
