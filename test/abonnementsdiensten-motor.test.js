/* De echte Rust-autoriteit bevestigt hoofd- én kostenboeking, waarna de
   JS-kant uitvalt. Een nieuwe-dienstbeperking mag dat betaalherstel niet blokkeren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startEchteMotor } = require('./lib/echte-motor');

function opbouw(motor) {
  const oud = { modus: process.env.RTG_MOTOR_GELD, url: process.env.RTG_MOTOR_GELD_URL,
    uit: process.env.RTG_BETALEN_UIT };
  process.env.RTG_MOTOR_GELD = 'motor'; process.env.RTG_MOTOR_GELD_URL = motor.url;
  delete process.env.RTG_BETALEN_UIT;
  try {
    const db = { data: {} }, haak = { crash: false }, save = () => {};
    let providerAanroepen = 0;
    const betaal = { AANBIEDER: 'simulatie', maakBetaling: async () => {
      providerAanroepen++; throw Error('Deze herhaling mag niet autoladen');
    } };
    const betaalWaarheid = require('../server/kern/betaalwaarheid')({ d: () => db.data, save, crypto, betaal, log: null });
    const voegToe = require('../server/kern/pay/loshistorie')(db);
    const { pay } = require('../server/kern/pay')({ db, save, bijeen: async werk => werk(), crypto, betaal,
      betaalWaarheid, vrijgave: require('../scripts/lib/proefvrijgave').proefVrijgave(),
      keyVanCodenaam: c => c === 'GC-HERSTEL' ? { key: 'proef:GC-HERSTEL' } : null,
      sseToCustomer() {}, schoon: x => String(x || ''), betaaldienstKosten: () => 50,
      betaalOpdrachten: { registreerTeruggang() {}, maak: () => ({ id: 'proef' }), dienIn: async () => ({}) },
      payBoekingenVoegToe: rij => {
        if (haak.crash && rij.soort === 'betaaldienstkosten') { haak.crash = false; throw Error('JS-commit na motorbevestiging mislukt'); }
        return voegToe(rij);
      } });
    return { db, pay, haak, get providerAanroepen() { return providerAanroepen; } };
  } finally {
    for (const [naam, v] of [['RTG_MOTOR_GELD', oud.modus], ['RTG_MOTOR_GELD_URL', oud.url], ['RTG_BETALEN_UIT', oud.uit]])
      if (v === undefined) delete process.env[naam]; else process.env[naam] = v;
  }
}

test('echte motor: beperkt na verloren JS-receipt herstelt dezelfde cadeaukaartbetaling en fee, zonder nieuwe inning', async () => {
  const motor = await startEchteMotor();
  try {
    const w = opbouw(motor);
    const sleutel = 'pay-tegoed:' + crypto.createHash('sha256').update('giftcard-herstel-start').digest('hex');
    const start = await motor.boekguard({ van: 'extern:oplaad', naar: 'lid:GC-HERSTEL', centen: 10000,
      soort: 'oplaad', oms: 'Teststartsaldo', ref: 'start', idem: sleutel });
    assert.equal(start.status, 200, JSON.stringify(start.body));
    await w.pay.reconcileVanMotor();
    const input = { supplierCode: 'GC-ZAAK', codenaam: 'GC-HERSTEL', centen: 2500,
      soort: 'cadeaukaart', idem: 'cadeaukaart-1', magNieuweDienst: () => true };
    w.haak.crash = true;
    await assert.rejects(w.pay.partnerIn(input), /JS-commit na motorbevestiging/);
    assert.equal(w.db.data.payIdem?.['partnerin:GC-HERSTEL:cadeaukaart-1'], undefined);
    assert.equal(await motor.saldo('lid:GC-HERSTEL'), 7500);
    assert.equal(await motor.saldo('partner:GC-ZAAK'), 2450);
    assert.equal(await motor.saldo('rtg:betaaldienst'), 50);
    const beperkt = { ...input, magNieuweDienst: () => false };
    const herstel = await w.pay.partnerIn(beperkt);
    assert.equal(herstel.ok, true, JSON.stringify(herstel));
    assert.equal((await w.pay.partnerIn(beperkt)).herhaald, true);
    assert.equal((await w.pay.partnerIn({ ...beperkt, idem: 'nieuwe-aankoop' })).code, 'ABONNEMENT_NIEUWE_DIENST');
    assert.equal(await motor.saldo('lid:GC-HERSTEL'), 7500, 'dezelfde hoofdboeking');
    assert.equal(await motor.saldo('partner:GC-ZAAK'), 2450, 'zelfde partnerontvangst minus dezelfde fee');
    assert.equal(await motor.saldo('rtg:betaaldienst'), 50, 'dezelfde kostenboeking');
    assert.equal(w.pay.saldoVan('lid:GC-HERSTEL'), 7500);
    assert.equal(w.pay.saldoVan('partner:GC-ZAAK'), 2450);
    assert.equal(w.providerAanroepen, 0, 'geen kaart/provider aangeroepen');
  } finally { motor.stop(); }
});
