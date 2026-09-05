/* Gerichte contractproef voor travelos.airport_boarding_pass. Geen HTTP-
   gemakspad: we kijken ook rechtstreeks in de duurzame collectie om te
   bewijzen dat een kale bearer daar nooit terechtkomt. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');

const NU = '2030-06-04T10:00:00.000Z';
function basis() {
  return { vluchten: [{ id: 'vl_open', nummer: 'RT205', soort: 'vertrek',
    bestemming: 'Ibiza', datum: '2030-06-04', tijd: '17:30', gate: 'A1',
    status: 'inchecken' }], boekingen: [], koffers: [], security: [],
    charters: [], vips: [], lounge: [] };
}
function maak(init = basis(), crypto = nodeCrypto) {
  const db = { writable: true, data: { luchthaven: init } };
  const bewerkCollectie = (sleutel, werk) => {
    assert.equal(sleutel, 'luchthaven');
    const kopie = JSON.parse(JSON.stringify(db.data[sleutel] || {}));
    const uit = werk(kopie);
    assert.equal(!!(uit && typeof uit.then === 'function'), false);
    db.data[sleutel] = kopie;
    return uit;
  };
  const kern = require('../server/kern/luchthaven/boarding-pass')({
    db, bewerkCollectie, crypto, nu: () => NU, vandaag: () => '2030-06-04'
  });
  return { db, kern };
}

test('check-in geeft 128 bits eenmaal uit en Mijn bewaart uitsluitend lifecyclemetadata', async () => {
  const { db, kern } = maak();
  const boek = await kern.boek({ key: 'lid-a', codenaam: 'Kobalt', vluchtId: 'vl_open' });
  assert.equal(boek.status, 200);
  assert.match(boek.boekingId, /^bk_[a-f0-9]{32}$/);
  assert.equal(boek.code, undefined);

  const incheck = await kern.incheck({ key: 'lid-a', boekingId: boek.boekingId, koffers: 2 });
  assert.equal(incheck.status, 200);
  assert.match(incheck.pass.code, /^BP\.[A-F0-9]{32}$/);
  assert.equal(Buffer.from(incheck.pass.code.split('.')[1], 'hex').length, 16);
  assert.match(incheck.pass.id, /^bp_[a-f0-9]{32}$/);
  assert.equal(incheck.eenmalig, true);

  const opslag = JSON.stringify(db.data.luchthaven);
  assert.equal(opslag.includes(incheck.pass.code), false, 'de kale code staat niet at rest');
  const rij = db.data.luchthaven.boekingen[0];
  assert.equal(rij.code, undefined);
  assert.match(rij.toegang.code_hash, /^[a-f0-9]{64}$/);
  assert.equal(rij.toegang.issuer, 'travelos.airport');
  assert.equal(rij.toegang.doel, 'airport-boarding-pass');
  assert.deepEqual(rij.toegang.scope.sort(), ['airport.lounge.entry', 'airport.partner.verify']);
  assert.equal(rij.toegang.issued_at, NU);
  assert.ok(Date.parse(rij.toegang.expires_at) > Date.parse(NU));
  assert.equal(rij.toegang.max_gebruik, 32);
  assert.equal(rij.toegang.gebruik, 0);
  assert.equal(rij.toegang.ingetrokken_at, null);
  assert.equal(rij.toegang.rotatie, 1);

  const mijn = await kern.mijnVeilig('lid-a');
  assert.equal(JSON.stringify(mijn).includes(incheck.pass.code), false);
  assert.equal(mijn.boekingen[0].id, boek.boekingId);
  assert.equal(mijn.boekingen[0].pass.id, incheck.pass.id);
  assert.equal(mijn.boekingen[0].pass.rotatie, 1);
  const retry = await kern.incheck({ key: 'lid-a', boekingId: boek.boekingId, koffers: 0 });
  assert.equal(retry.status, 409);
  assert.equal(retry.code, undefined);
  assert.equal(JSON.stringify(retry).includes(incheck.pass.code), false);
});

test('partner-, lounge-, rotatie-, intrek- en annuleerclaims zijn één collectietransactie', async () => {
  const { db, kern } = maak();
  const boek = await kern.boek({ key: 'lid-a', codenaam: 'Kobalt', vluchtId: 'vl_open' });
  const eerste = await kern.incheck({ key: 'lid-a', boekingId: boek.boekingId });
  const code1 = eerste.pass.code;

  const scan1 = await kern.controleerEnClaim({ code: code1, partnerCode: 'AIRSHOP', actor: 'balie-1' });
  const scanRetry = await kern.controleerEnClaim({ code: code1, partnerCode: 'AIRSHOP', actor: 'balie-2' });
  assert.equal(scan1.geldig, true);
  assert.equal(scanRetry.herhaald, true);
  assert.equal((await kern.controleerEnClaim({ code: code1, partnerCode: '' })).status, 403,
    'een consumer zonder expliciete luchthavenzaak faalt dicht');
  assert.equal(db.data.luchthaven.boekingen[0].toegang.gebruik, 1,
    'dezelfde luchthavenzaak claimt dezelfde rotatie eenmaal');

  const lounge = await kern.loungeIn({ actor: 'lounge-1', loungeId: 'salon', code: code1,
    lounges: { salon: { naam: 'Salon Lounge', capaciteit: 40 }, royal: { naam: 'Royal', capaciteit: 8 } } });
  assert.equal(lounge.status, 200);
  assert.equal(db.data.luchthaven.boekingen[0].toegang.gebruik, 2);
  assert.equal((await kern.loungeIn({ actor: 'lounge-2', loungeId: 'salon', code: code1,
    lounges: { salon: { naam: 'Salon Lounge', capaciteit: 40 } } })).status, 409);

  const rotatie = await kern.roteer({ key: 'lid-a', boekingId: boek.boekingId, verwachteRotatie: 1 });
  assert.equal(rotatie.status, 200);
  assert.match(rotatie.pass.code, /^BP\.[A-F0-9]{32}$/);
  assert.notEqual(rotatie.pass.code, code1);
  assert.equal(rotatie.pass.toegang.rotatie, 2);
  assert.equal((await kern.roteer({ key: 'lid-a', boekingId: boek.boekingId,
    verwachteRotatie: 1 })).status, 409, 'een gelijktijdige tweede rotatie heronthult niets');
  assert.equal((await kern.controleerEnClaim({ code: code1, partnerCode: 'AIRSHOP' })).geldig, false);
  assert.equal((await kern.controleerEnClaim({ code: rotatie.pass.code, partnerCode: 'AIRSHOP' })).geldig, true);

  const intrek = await kern.intrekken({ key: 'lid-a', boekingId: boek.boekingId, verwachteRotatie: 2 });
  assert.equal(intrek.status, 200);
  assert.ok(intrek.pass.ingetrokken_at);
  assert.equal((await kern.controleerEnClaim({ code: rotatie.pass.code, partnerCode: 'AIRSHOP' })).geldig, false);

  const code3 = (await kern.roteer({ key: 'lid-a', boekingId: boek.boekingId,
    verwachteRotatie: 2 })).pass.code;
  const annulering = await kern.annuleerVlucht({ vluchtId: 'vl_open', actor: 'operations' });
  assert.equal(annulering.status, 200);
  assert.equal(db.data.luchthaven.boekingen[0].status, 'geannuleerd');
  assert.ok(db.data.luchthaven.boekingen[0].toegang.ingetrokken_at);
  assert.equal((await kern.controleerEnClaim({ code: code3, partnerCode: 'AIRSHOP' })).geldig, false);
});

test('opzoeken vergelijkt alle huidige en historische hashes, ook na een treffer', async () => {
  let vergelijkingen = 0;
  const crypto = Object.assign({}, nodeCrypto, {
    timingSafeEqual(a, b) { vergelijkingen++; return nodeCrypto.timingSafeEqual(a, b); }
  });
  const { db, kern } = maak(basis(), crypto);
  const een = await kern.boek({ key: 'een', codenaam: 'Een', vluchtId: 'vl_open' });
  const code1 = (await kern.incheck({ key: 'een', boekingId: een.boekingId })).pass.code;
  await kern.roteer({ key: 'een', boekingId: een.boekingId, verwachteRotatie: 1 });
  const twee = await kern.boek({ key: 'twee', codenaam: 'Twee', vluchtId: 'vl_open' });
  const code2 = (await kern.incheck({ key: 'twee', boekingId: twee.boekingId })).pass.code;
  const aantal = db.data.luchthaven.boekingen.reduce((n, b) => n + (b.toegang ? 1 : 0) + (b.pass_historie || []).length, 0);

  vergelijkingen = 0; kern.toegang.vindOpCode(db.data.luchthaven, code1);
  assert.equal(vergelijkingen, aantal);
  vergelijkingen = 0; kern.toegang.vindOpCode(db.data.luchthaven, code2);
  assert.equal(vergelijkingen, aantal);
  vergelijkingen = 0; kern.toegang.vindOpCode(db.data.luchthaven, 'BP.' + '0'.repeat(32));
  assert.equal(vergelijkingen, aantal);
});

test('startupmigratie hasht en sluit legacycodes; een niet-duurzame commit blijft rood', async () => {
  const oud = basis();
  oud.boekingen.push({ id: 'bk-oud', code: 'VL-ABC123', vluchtId: 'vl_open',
    key: 'lid-oud', codenaam: 'Oud', status: 'ingecheckt', stoel: '1A', at: '2029-01-01T00:00:00.000Z' });
  const { db, kern } = maak(oud);
  const uit = await kern.migreerAlles();
  assert.equal(uit.gewijzigd, true);
  const json = JSON.stringify(db.data.luchthaven);
  assert.equal(json.includes('VL-ABC123'), false);
  const rij = db.data.luchthaven.boekingen[0];
  assert.equal(rij.code, undefined);
  assert.equal(rij.pass_historie.length, 1);
  assert.match(rij.pass_historie[0].code_hash, /^[a-f0-9]{64}$/);
  assert.ok(rij.pass_historie[0].ingetrokken_at);
  assert.equal((await kern.controleerEnClaim({ code: 'VL-ABC123', partnerCode: 'AIRSHOP' })).geldig, false);

  const falend = basis();
  falend.boekingen.push({ id: 'bk-stuk', code: 'VL-STUK01', vluchtId: 'vl_open', key: 'lid' });
  const dbStuk = { writable: true, data: { luchthaven: falend } };
  const kernStuk = require('../server/kern/luchthaven/boarding-pass')({
    db: dbStuk, bewerkCollectie() { throw new Error('schijf vol'); }, crypto: nodeCrypto,
    nu: () => NU, vandaag: () => '2030-06-04'
  });
  assert.throws(() => kernStuk.migreerAlles(), /schijf vol/);
  assert.equal(dbStuk.data.luchthaven.boekingen[0].code, 'VL-STUK01',
    'zonder duurzame commit wordt de levende toestand niet als gemigreerd verkocht');
});
