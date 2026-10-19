/* EEN VONK-BERICHT MET EEN HERHAALSLEUTEL STAAT ER EEN KEER (19 oktober 2026).

   De voltooiproef van Vonk (scripts/lib/voltooi/vonk.js) zag een dubbele tik
   en een nieuwe poging na een afgebroken verbinding een chatbericht twee keer
   bij de ander plaatsen. sendText in server/kern/connection-communication.js
   kent nu een optionele sleutel, zoals de media- en oproeproutes ernaast al
   hadden: dezelfde sleutel van dezelfde afzender in hetzelfde gesprek is
   hetzelfde bericht, ook in een nieuw proces. Zonder sleutel blijft elk bericht
   een nieuw bericht. Deze toets zakt zonder die herkenning. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const maakCommunication = require('../server/kern/connection-communication');

const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 200);
const maak = (db) => maakCommunication({ product: 'vonk', db, save: () => {}, crypto, media: {}, schoon,
  ticketSecret: 'herhaal-toets-ticket-geheim', isBlocked: () => false,
  resolveContext: (actor, input) => input.id === 'm1' ? { counterpart: actor === 'a' ? 'b' : 'a', scope: 'm1' } : null });
const teksten = (comm, wie) => comm.status(wie, { id: 'm1' }).messages.map((m) => m.text);

test('dezelfde sleutel is hetzelfde bericht; een nieuwe sleutel of geen sleutel niet', () => {
  const comm = maak({ data: {} });
  assert.equal(comm.sendText('a', { id: 'm1' }, 'hoi', 'k-1').status, 200);
  assert.equal(comm.sendText('a', { id: 'm1' }, 'hoi', 'k-1').status, 200);
  assert.deepEqual(teksten(comm, 'b'), ['hoi']);
  comm.sendText('a', { id: 'm1' }, 'hoi', 'k-2');
  comm.sendText('b', { id: 'm1' }, 'hoi', 'k-1');
  comm.sendText('a', { id: 'm1' }, 'zonder');
  comm.sendText('a', { id: 'm1' }, 'zonder');
  assert.deepEqual(teksten(comm, 'b'), ['hoi', 'hoi', 'hoi', 'zonder', 'zonder']);
});

test('de sleutel staat op het bericht: een nieuw proces herkent hem, de lezer ziet hem niet', () => {
  const db = { data: {} };
  maak(db).sendText('a', { id: 'm1' }, 'stroom', 'k-9');
  const na = maak({ data: JSON.parse(JSON.stringify(db.data)) });
  na.sendText('a', { id: 'm1' }, 'stroom', 'k-9');
  assert.deepEqual(teksten(na, 'b'), ['stroom']);
  assert.equal(JSON.stringify(na.status('b', { id: 'm1' })).includes('k-9'), false);
});
