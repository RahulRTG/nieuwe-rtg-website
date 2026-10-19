/* EEN LIJST MAKEN IS EEN KEER MAKEN, OOK NA EEN CRASH.

   De centrale idempotentielaag (server/middleware/idempotentie.js) onthoudt
   een eerste antwoord per proces; na een crash is die kas leeg. De voltooiproef
   van RTG Media (scripts/lib/voltooi/mediaos.js) zag daardoor twee lijsten
   ontstaan: "Maak lijst" lukte, de server viel om, en dezelfde tik met
   dezelfde sleutel maakte er nog een. De lijst draagt nu zijn sleutel zelf.
   Een nieuwe module-instantie op dezelfde data speelt hier de herstart. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const maakLijsten = require('../server/kern/mediaos/lijsten');

function kern(db) {
  return maakLijsten({ db, save() {}, crypto, schoon: (s, n) => String(s || '').trim().slice(0, n),
    catalogus: { deelId: () => ({ vorm: 'clip', id: 'x' }), alles: () => ({ rijen: [] }) },
    codenaamVan: (k) => k, keyVanCodenaam: async (c) => c, zijnVrienden: () => true });
}

test('dezelfde sleutel na een herstart geeft dezelfde lijst, geen tweede', () => {
  const db = { data: {} };
  const sess = { key: 'lid-a' };
  const a = kern(db).mediaLijstMaak(sess, { naam: 'Rit', idem: 'media-lijst-maak-0123456789abcdef' });
  const b = kern(db).mediaLijstMaak(sess, { naam: 'Rit', idem: 'media-lijst-maak-0123456789abcdef' });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(b.lijst.id, a.lijst.id);
  assert.equal(b.herhaald, true);
  assert.equal(kern(db).mediaLijsten(sess).lijsten.length, 1);
});

test('zonder sleutel, of met een andere sleutel, is het een nieuwe lijst; een sleutel van een ander lid telt niet', () => {
  const db = { data: {} };
  const k = kern(db);
  k.mediaLijstMaak({ key: 'lid-a' }, { naam: 'Een', idem: 'sleutel-een-0123456789' });
  k.mediaLijstMaak({ key: 'lid-a' }, { naam: 'Twee', idem: 'sleutel-twee-0123456789' });
  k.mediaLijstMaak({ key: 'lid-a' }, { naam: 'Drie' });
  const ander = k.mediaLijstMaak({ key: 'lid-b' }, { naam: 'Een', idem: 'sleutel-een-0123456789' });
  assert.equal(ander.herhaald, undefined);
  assert.equal(k.mediaLijsten({ key: 'lid-a' }).lijsten.length, 3);
  assert.equal(k.mediaLijsten({ key: 'lid-b' }).lijsten.length, 1);
});
