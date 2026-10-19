/* EEN BERICHT MET EEN HERHAALSLEUTEL STAAT ER EEN KEER (19 oktober 2026).

   De voltooiproef van Berichten (scripts/lib/voltooi/berichten.js) zag een
   dubbele tik en een nieuwe poging na een afgebroken verbinding TWEE berichten
   bij de ontvanger plaatsen. Het scherm stuurt nu per opgesteld bericht een
   sleutel mee, en de kern (server/kern/comm/bericht.js) herkent hem -- ook na
   een herstart, want de sleutel staat op het bericht zelf en niet in een kas
   in het geheugen. Deze toets zakt zonder die herkenning.

   Wat er ook staat: een andere afzender met dezelfde sleutel, of dezelfde
   afzender met een nieuwe sleutel, is een echt tweede bericht. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakComm } = require('../server/kern/comm');

function opzet(data) {
  const db = { data: data || {} };
  const comm = maakComm({ db, save: () => {}, crypto, codenaamVan: (k) => k });
  return { db, comm };
}

test('dezelfde sleutel van dezelfde afzender is hetzelfde bericht', () => {
  const { comm } = opzet();
  const g = comm.tussen('a', 'b');
  const een = comm.bericht({ gesprekId: g.id, van: 'a', tekst: 'hallo', idem: 'st-1' });
  const twee = comm.bericht({ gesprekId: g.id, van: 'a', tekst: 'hallo', idem: 'st-1' });
  assert.equal(twee.id, een.id);
  assert.equal(comm.gesprek('b', g.id).berichten.filter((m) => m.tekst === 'hallo').length, 1);
});

test('een nieuwe sleutel of een andere afzender is een echt tweede bericht', () => {
  const { comm } = opzet();
  const g = comm.tussen('a', 'b');
  comm.bericht({ gesprekId: g.id, van: 'a', tekst: 'ja', idem: 'st-1' });
  comm.bericht({ gesprekId: g.id, van: 'a', tekst: 'ja', idem: 'st-2' });
  comm.bericht({ gesprekId: g.id, van: 'b', tekst: 'ja', idem: 'st-1' });
  comm.bericht({ gesprekId: g.id, van: 'a', tekst: 'ja' });
  comm.bericht({ gesprekId: g.id, van: 'a', tekst: 'ja' });
  assert.equal(comm.gesprek('a', g.id).berichten.length, 5);
});

test('de sleutel overleeft een herstart: hij staat op het bericht in de opslag', () => {
  const eerst = opzet();
  const g = eerst.comm.tussen('a', 'b');
  eerst.comm.bericht({ gesprekId: g.id, van: 'a', tekst: 'stroom', idem: 'st-9' });
  const na = opzet(JSON.parse(JSON.stringify(eerst.db.data)));
  na.comm.bericht({ gesprekId: g.id, van: 'a', tekst: 'stroom', idem: 'st-9' });
  assert.equal(na.comm.gesprek('b', g.id).berichten.length, 1);
  assert.equal(JSON.stringify(na.comm.gesprek('b', g.id)).includes('st-9'), false, 'de sleutel gaat niet naar de lezer');
});
