/* DE ZEGEL HOORT BIJ ZIJN TICKET (server/kern/sessiestroom.js).

   Een stroomticket draagt de sessie verzegeld mee. Tot 12 oktober 2026 bond de
   zegel alleen soort en sessiehash: wie in de opslag het onderwerp van ticket
   B onder ticket A schoof, opende met A de sessie van B -- een ticket dat hij
   zelf had gekregen, met de sessie van een ander erachter. Nu zit de hash van
   het ticket zelf in de geassocieerde gegevens van de zegel: een verplaatst
   onderwerp opent niets, bij de claim niet en bij `kijk` ook niet. De gewone
   weg blijft open.

   Draai los: node --test test/sessiestroom-binding.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maak, COLLECTIE } = require('../server/kern/sessiestroom');

const A = 'SESSIE-A-' + 'x'.repeat(40);
const B = 'SESSIE-B-' + 'y'.repeat(40);

function wereld() {
  const nu = () => '2026-10-12T09:00:00.000Z';
  const opslag = {};
  const bewerkCollectie = (naam, werk) => {
    const k = JSON.parse(JSON.stringify(opslag[naam] || {}));
    const uit = werk(k); opslag[naam] = k; return uit;
  };
  const sleutel = crypto.randomBytes(32);
  const dienst = maak({ db: { data: {} }, crypto, bewerkCollectie, nu, zegelSleutel: () => sleutel, productie: false });
  dienst.soort('lid', { geldig: raw => raw === A || raw === B });
  return { dienst, rij: () => opslag[COLLECTIE].lid };
}

async function verwisseld() {
  const w = wereld();
  const tA = await w.dienst.geef('lid', A);
  const tB = await w.dienst.geef('lid', B);
  const [rA, rB] = w.rij();
  [rA.onderwerp, rB.onderwerp] = [rB.onderwerp, rA.onderwerp];
  return { w, tA, tB };
}

test('de gewone weg: elk ticket opent zijn eigen sessie', async () => {
  const w = wereld();
  const tA = await w.dienst.geef('lid', A);
  const tB = await w.dienst.geef('lid', B);
  assert.deepEqual(await w.dienst.kijk(tA.ticket), { soort: 'lid', token: A });
  assert.deepEqual(await w.dienst.open('lid', tA.ticket), { ok: true, token: A });
  assert.deepEqual(await w.dienst.open('lid', tB.ticket), { ok: true, token: B });
});

test('een onderwerp dat onder een ander ticket is geschoven, opent niets', async () => {
  const { w, tA, tB } = await verwisseld();
  assert.deepEqual(await w.dienst.open('lid', tA.ticket), { status: 401 }, 'ticket A opent de sessie van B niet');
  assert.deepEqual(await w.dienst.open('lid', tB.ticket), { status: 401 }, 'ticket B opent de sessie van A niet');
});

test('kijk leest een verschoven onderwerp ook niet', async () => {
  const { w, tA } = await verwisseld();
  assert.equal(await w.dienst.kijk(tA.ticket), null);
});
