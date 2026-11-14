'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, body, tekenen, kopie, fabriek } = require('./abonnementsaanbod-fixture.cjs');
const { valideOndertekening } = fabriek;

test('specifieke versiegebonden ontvangst plus afzonderlijk mandaat geeft alleen GEACCEPTEERD', async () => {
  const f = fixture(), r = await f.motor.aanbod(1, body());
  const getekend = await f.motor.teken(1, tekenen(r));
  assert.equal(getekend.ok, true); assert.equal(getekend.contract.status, 'GEACCEPTEERD');
  const c = f.db.data.contracten[0], ob = f.db.data.onboarding;
  assert.equal(valideOndertekening(c, ob), true);
  assert.equal(ob.scopes, undefined); assert.deepEqual(f.db.data.lidmaatschapBetalingen || [], []);
  const ontvangst = ob.profielen['user-1'].ondertekend['abonnement:' + c.id];
  assert.equal(ontvangst.naam, 'Amber Ondertekenaar'); assert.equal(ontvangst.aanbodHash, c.aanbod.hash);
  assert.equal(ontvangst.doorlopendeBetaling.akkoord, true);
  assert.doesNotMatch(JSON.stringify(c), /Amber Ondertekenaar/);
  const voor = kopie(f.db.data); f.stand.at = '2026-11-14T10:00:00.000Z';
  const herhaald = await f.motor.teken(1, tekenen(r));
  assert.equal(herhaald.herhaald, true); assert.deepEqual(f.db.data, voor);
});

test('algemeen akkoord, mandatefalse, andermans overeenkomst, verkeerde hash of naam geeft geen ontvangst', async () => {
  const f = fixture(), r = await f.motor.aanbod(1, body()), voor = kopie(f.db.data);
  for (const extra of [{ akkoord: false }, { akkoord: 'true' }, { doorlopendeBetalingAkkoord: false },
    { doorlopendeBetalingAkkoord: undefined }, { naam: 'A' }, { naam: '<naam>' }]) {
    assert.equal((await f.motor.teken(1, tekenen(r, extra))).status, 400);
    assert.deepEqual(f.db.data, voor);
  }
  assert.equal((await f.motor.teken(2, tekenen(r))).status, 404);
  assert.equal((await f.motor.teken(1, tekenen(r, { aanbodHash: 'gewijzigd' }))).status, 409);
  assert.deepEqual(f.db.data, voor);
  await f.motor.teken(1, tekenen(r)); const getekend = kopie(f.db.data);
  const naam = await f.motor.teken(1, tekenen(r, { naam: 'Andere Ondertekenaar' }));
  assert.equal(naam.status, 409); assert.equal(naam.code, 'name_conflict'); assert.deepEqual(f.db.data, getekend);
});

test('savefout rolt aanbod en handtekening terug; retry schrijft dezelfde specifieke ontvangst eenmaal', async () => {
  const f = fixture(), b = body(); f.stand.saveFout = true;
  assert.equal((await f.motor.aanbod(1, b)).status, 503); assert.deepEqual(f.db.data, {});
  f.stand.saveFout = false; const r = await f.motor.aanbod(1, b), aangeboden = kopie(f.db.data);
  f.stand.saveFout = true;
  assert.equal((await f.motor.teken(1, tekenen(r))).status, 503); assert.deepEqual(f.db.data, aangeboden);
  f.stand.saveFout = false;
  assert.equal((await f.motor.teken(1, tekenen(r))).ok, true);
  const restart = fixture(f.db.data), c = restart.db.data.contracten[0];
  assert.equal((await restart.motor.teken(1, tekenen(r))).herhaald, true);
  assert.equal(valideOndertekening(c, restart.db.data.onboarding), true);
  assert.equal(Object.keys(restart.db.data.onboarding.profielen['user-1'].ondertekeningen['abonnement:' + c.id]).length, 1);
});

test('onzeker antwoord na commit herhaalt opgeslagen aanbod en ontvangst zonder tweede overgang', async () => {
  const f = fixture(), b = body(); f.stand.antwoordFout = true;
  assert.equal((await f.motor.aanbod(1, b)).status, 503);
  const r = await f.motor.aanbod(1, b); assert.equal(r.herhaald, true); assert.equal(f.db.data.contracten.length, 1);
  f.stand.antwoordFout = true;
  assert.equal((await f.motor.teken(1, tekenen(r))).status, 503);
  const voor = kopie(f.db.data);
  assert.equal((await f.motor.teken(1, tekenen(r))).herhaald, true); assert.deepEqual(f.db.data, voor);
  assert.equal(f.db.data.contracten[0].verloop.filter(v => v.naar === 'GEACCEPTEERD').length, 1);
});

test('gewijzigde snapshot, contractprijs of verplaatste ontvangst wordt niet geldig verklaard', async () => {
  for (const verander of [c => { c.aanbod.prijs.maand.brutoCenten++; }, c => { c.aanbod.tekst += ' gewijzigd'; },
    c => { c.afgesprokenCenten++; }]) {
    const f = fixture(), r = await f.motor.aanbod(1, body()); verander(f.db.data.contracten[0]);
    const voor = kopie(f.db.data), result = await f.motor.teken(1, tekenen(r));
    assert.ok([409, 503].includes(result.status)); assert.deepEqual(f.db.data, voor);
  }
  const f = fixture(), r = await f.motor.aanbod(1, body()); await f.motor.teken(1, tekenen(r));
  const c = f.db.data.contracten[0], ob = f.db.data.onboarding;
  assert.equal(valideOndertekening(c, ob), true);
  const naam = kopie(ob); naam.profielen['user-1'].ondertekeningen['abonnement:' + c.id][1].naam = 'Ander';
  assert.equal(valideOndertekening(c, naam), false);
  const mandaat = kopie(ob); delete mandaat.profielen['user-1'].ondertekeningen['abonnement:' + c.id][1].doorlopendeBetaling;
  assert.equal(valideOndertekening(c, mandaat), false);
  const ander = kopie(c); ander.accountId = 2; assert.equal(valideOndertekening(ander, ob), false);
  const ref = kopie(c); ref.ondertekening.at = '2026-11-14T00:00:00.000Z';
  assert.equal(valideOndertekening(ref, ob), false);
});

test('een geaccepteerde status alleen kan nooit ontbrekend ondertekenbewijs herstellen', async () => {
  const f = fixture(), r = await f.motor.aanbod(1, body());
  f.db.data.contracten[0].status = 'GEACCEPTEERD';
  const voor = kopie(f.db.data);
  assert.equal((await f.motor.teken(1, tekenen(r))).status, 409);
  assert.equal(valideOndertekening(f.db.data.contracten[0], f.db.data.onboarding), false);
  assert.deepEqual(f.db.data, voor);
});
