/* Constitutionele tests voor Connection OS. Zij komen boven op de bestaande
   58 producttests en vervangen er geen. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const policy = require('../server/kern/connection-policy');
const maakBlocking = require('../server/kern/connection-blocking');
const projections = require('../server/kern/connection-projection');

const goed = { pass: 'lifestyle', verified: true, adult: true };

test('de eerste 58 producttests blijven de baseline', () => {
  const tel = naam => fs.readFileSync(path.join(__dirname, naam), 'utf8')
    .split(/\r?\n/).filter(r => /^test\(/.test(r)).length;
  assert.equal(tel('vonk.test.js'), 26);
  assert.equal(tel('rendezvous.test.js'), 32);
});

test('default deny: onbekende en niet-gebouwde capabilities blijven dicht', () => {
  assert.equal(policy.beslis({ actor: 'member', product: 'vonk', capability: 'connection.bestaat.niet', state: goed }).code,
    'CAPABILITY_UNKNOWN');
  for (const capability of ['connection.route', 'connection.concierge.reserve']) {
    assert.equal(policy.beslis({ actor: 'member', product: 'vonk', capability, state: goed }).code,
      'NOT_IMPLEMENTED', capability + ' is nergens geopend');
  }
});

test('capability is niet permission: product, pas en toestand beslissen afzonderlijk', () => {
  assert.equal(policy.beslis({ actor: 'member', product: 'vonk', capability: 'connection.message', state: goed }).allow, true);
  assert.equal(policy.beslis({ actor: 'member', product: 'rendezvous', capability: 'connection.message', state: goed }).allow,
    true, 'gedeelde techniek blijft per product expliciet geopend');
  assert.equal(policy.beslis({ actor: 'member', product: 'rendezvous', capability: 'connection.payment.confirm', state: goed }).code,
    'PRODUCT_DENY', 'een Vonk-geldcapability lekt niet naar Rendez-vous');
  assert.equal(policy.beslis({ actor: 'member', product: 'rendezvous', capability: 'connection.discover',
    state: { ...goed, pass: 'rtg' } }).code, 'PASS_REQUIRED');
  assert.equal(policy.beslis({ actor: 'member', product: 'vonk', capability: 'connection.discover',
    state: { ...goed, verified: false } }).code, 'IDENTITY_REQUIRED');
  assert.equal(policy.beslis({ actor: 'member', product: 'vonk', capability: 'connection.discover',
    state: { ...goed, adult: false } }).code, 'AGE_REQUIRED');
});

test('Rahul kan een ledenweigering niet omzeilen', () => {
  const open = policy.beslis({ actor: 'rahul', product: 'rendezvous', capability: 'connection.meet.plan', state: goed });
  assert.equal(open.allow, true);
  const geenPas = policy.beslis({ actor: 'rahul', product: 'rendezvous', capability: 'connection.meet.plan',
    state: { ...goed, pass: 'rtg' } });
  assert.equal(geenPas.allow, false);
  assert.ok(['PASS_REQUIRED', 'RAHUL_DENY'].includes(geenPas.code));
  assert.equal(policy.beslis({ actor: 'rahul', product: 'rendezvous', capability: 'connection.discover', state: goed }).code,
    'ACTOR_DENY', 'Rahul krijgt alleen expliciet geopende functies');
});

test('een blokkade sluit andere capabilities maar nooit de veiligheidsdeur zelf', () => {
  assert.equal(policy.beslis({ actor: 'member', product: 'vonk', capability: 'connection.message',
    state: { ...goed, blocked: true } }).code, 'BLOCKED');
  assert.equal(policy.beslis({ actor: 'member', product: 'vonk', capability: 'connection.safety.block',
    state: { ...goed, blocked: true } }).allow, true);
});

test('cross-product blocking is wederzijds en lezen schrijft niets', () => {
  let saves = 0;
  const db = { data: {} };
  const blokkades = maakBlocking({ db, save: () => { saves++; }, nu: () => '2026-09-22T00:00:00.000Z' });
  assert.equal(blokkades.isGeblokkeerd('a', 'b'), false);
  assert.equal(db.data.connectionBlocks, undefined, 'alleen kijken maakt geen opslag');
  blokkades.blokkeer('a', 'b', 'vonk');
  assert.equal(saves, 1);
  assert.equal(blokkades.isGeblokkeerd('a', 'b'), true);
  assert.equal(blokkades.isGeblokkeerd('b', 'a'), true, 'de veiligheidsgrens werkt in beide richtingen');
  assert.equal(db.data.connectionBlocks.a.b.product, 'vonk');
});

test('iedere geopende regel heeft een bestaande capability en projectie', () => {
  const matrix = policy.matrix();
  assert.ok(matrix.length > 0);
  for (const rij of matrix) {
    assert.equal(rij.implemented, true, rij.capability + ' mag alleen geopend zijn als hij bestaat');
    assert.ok(rij.projection, rij.capability + ' heeft een expliciete serverprojectie nodig');
    assert.ok(projections.CONTRACTS[rij.projection], rij.projection + ' moet een benoemd uitvoerbaar contract zijn');
  }
});
