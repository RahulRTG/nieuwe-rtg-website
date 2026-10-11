/* DE ENVELOP ZEGT NIET `bewezen` OVER EEN WACHTWOORDSESSIE (11 oktober 2026).

   Een opgegeven naam, een bestaande sessie en een bewezen identiteit zijn drie
   dingen (besluit van de eigenaar). De kantoordeur kent dat verschil al:
   kern/kantoor/identiteit.js zegt `bewezen` alleen bij een passkey (besluit
   3a). Toch zette officeAuth `identiteit: 'bewezen'` op de verzoekenvelop voor
   ELKE kantoorsessie met een lidKey -- ook zonder passkey.

   Wat deze toets vastlegt, met de ECHTE officeAuth en de echte boardroompoort
   (alleen de sessies zijn nagemaakt):
     1. passkey aan de deur        -> `bewezen`
     2. op naam, zonder passkey    -> `opNaam`
     3. de gedeelde code           -> `anoniem`
     4. het kale eigenaarstoken    -> `opNaam` (de deur zag geen sleutel)
     5. de boardroom neemt de hardheid OVER en zet geen eigen `bewezen`
     6. de envelop accepteert `opNaam` als waarde en valt niet terug op de
        afleiding uit het id (dat zou weer `bewezen` zijn).

   Draai los: node --test test/envelop-kantooridentiteit.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const envelop = require('../server/opzet/envelop');
const { maakKantoor } = require('../server/kern/kantoor');
const envelopIdentiteit = require('../server/kern/kantoor/envelopidentiteit');
const productiedeur = require('../server/kern/kantoor/productiedeur');

const PASSKEY = { type: 'passkey', methode: 'cryptografisch', actie: productiedeur.ACTIE, op: Date.now() };
const SESSIES = {
  'tok-passkey': { role: 'office', lidKey: 'user-1', kantoorBewijs: PASSKEY },
  'tok-opnaam': { role: 'office', lidKey: 'user-2' },
  'tok-gedeeld': { role: 'office' }
};

function bouw() {
  const db = { data: {} };
  return maakKantoor({
    db, save() {}, bewerkCollectie() {}, sessionFor: (t) => SESSIES[t] || null,
    eigenaar: { isEigenaar: (acc, u) => !!(u && u.id === 9) },
    accounts: { verifyToken: (t) => (t === 'tok-eigenaar' ? { id: 9 } : null), getUserById: (n) => (n === 9 ? { id: 9 } : null) },
    findSupplier() { return null; }, connectedSupplierCodes() { return []; }, publicSupplier: (s) => s,
    conciergeInbox() { return []; }, beveilig: {}, archief: {}, grootAantal: () => 0, ledenAantal: () => 0
  });
}

function verzoek(token) {
  return { id: 'v-1', method: 'POST', path: '/api/office/proef', body: {},
    get: (k) => (String(k).toLowerCase() === 'authorization' && token ? 'Bearer ' + token : '') };
}
const res = () => ({ statusCode: 200, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; },
  on() {}, once() {}, setHeader() {}, getHeader() {}, set() {}, locals: {} });

async function door(poort, token) {
  const req = verzoek(token);
  let verder = false;
  await new Promise((klaar) => {
    const r = res();
    r.json = function (b) { this.body = b; klaar(); return this; };
    try { poort(req, r, () => { verder = true; klaar(); }); } catch (e) { klaar(); }
    setTimeout(klaar, 200);
  });
  return { req, verder, env: envelop.van(req) };
}

test('0. de vertaling: alleen een passkey is bewezen', () => {
  assert.equal(envelopIdentiteit({ via: 'passkey' }), 'bewezen');
  assert.equal(envelopIdentiteit({ via: 'opNaam' }), 'opNaam', 'een sessie op naam is geen bewezen identiteit');
  assert.equal(envelopIdentiteit({ via: 'eigenaarToken' }), 'opNaam');
  assert.equal(envelopIdentiteit({ via: 'gedeeld' }), 'anoniem');
  assert.equal(envelopIdentiteit(null), 'onbekend');
});

test('1. de envelop neemt `opNaam` over en verandert hem niet stil in `bewezen`', () => {
  assert.ok(envelop.IDENTITEITEN.includes('opNaam'));
  const e = envelop.zet(verzoek(null), { soort: 'kantoor', id: 'user-2', identiteit: 'opNaam' });
  assert.equal(e.actor.identiteit, 'opNaam', 'de afleiding uit het id overschreef het oordeel');
});

test('2. officeAuth: passkey bewezen, op naam opNaam, gedeelde code anoniem, eigenaarstoken opNaam', async () => {
  const k = bouw();
  const p = await door(k.officeAuth, 'tok-passkey');
  assert.ok(p.verder, 'de passkeysessie komt door');
  assert.equal(p.env.actor.identiteit, 'bewezen');
  const n = await door(k.officeAuth, 'tok-opnaam');
  assert.ok(n.verder);
  assert.equal(n.env.actor.identiteit, 'opNaam', 'een wachtwoordsessie op naam stond als bewezen in de envelop');
  assert.equal(n.env.actor.id, 'user-2', 'wie het is blijft staan; alleen de hardheid is eerlijk');
  const g = await door(k.officeAuth, 'tok-gedeeld');
  assert.ok(g.verder);
  assert.equal(g.env.actor.identiteit, 'anoniem');
  const o = await door(k.officeAuth, 'tok-eigenaar');
  assert.ok(o.verder);
  assert.equal(o.env.actor.identiteit, 'opNaam', 'het kale eigenaarstoken is niet met een sleutel gezien');
});

test('3. de boardroom zet geen eigen `bewezen` over de envelop heen', async () => {
  const k = bouw();
  const o = await door(k.boardroomAuth, 'tok-eigenaar');
  assert.ok(o.verder, 'de eigenaar komt de boardroom in');
  assert.equal(o.env.actor.soort, 'eigenaar');
  assert.equal(o.env.actor.identiteit, 'opNaam', 'de boardroompoort maakte er weer bewezen van');
});
