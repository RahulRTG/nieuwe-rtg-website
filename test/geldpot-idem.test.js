/* Een reservering per tik (server/kern/geldbeleid/potten.js, potReserveer).

   Gevonden door de voltooiproef van het geldoverzicht
   (scripts/lib/voltooi/geldcommand.js): een reservering, een SIGKILL en
   dezelfde tik opnieuw zette het bedrag twee keer opzij -- de pot kende geen
   herhaalsleutel. Een pot is een oormerk en geen rekening, maar een dubbel
   oormerk maakt het vrij besteedbare bedrag in het overzicht net zo goed vals. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function potten() {
  const rec = { potten: [], regels: [] };
  let n = 0;
  const ctx = { pak: () => rec, kijk: () => rec, maakId: (s) => s + (++n), bedragVan: (v) => Math.round(Number(v)),
    zichtPot: (p) => ({ id: p.id, naam: p.naam, doelCenten: p.doelCenten, standCenten: p.standCenten }),
    logSchrijf: () => {}, MAX_CENTEN: 100000000 };
  return require('../server/kern/geldbeleid/potten')(ctx);
}

test('dezelfde sleutel zet het bedrag een keer opzij', () => {
  const p = potten();
  const pot = p.potZet('Codenaam', { naam: 'Vakantie', doelCenten: 50000 }).pot;
  assert.equal(p.potReserveer('Codenaam', pot.id, 900, undefined, 'k1').status, 200);
  const weer = p.potReserveer('Codenaam', pot.id, 900, undefined, 'k1');
  assert.equal(weer.herhaald, true);
  assert.equal(p.potten('Codenaam')[0].standCenten, 900);
});

test('dezelfde sleutel voor een ander bedrag is een conflict', () => {
  const p = potten();
  const pot = p.potZet('Codenaam', { naam: 'Vakantie', doelCenten: 50000 }).pot;
  p.potReserveer('Codenaam', pot.id, 900, undefined, 'k1');
  assert.equal(p.potReserveer('Codenaam', pot.id, -900, undefined, 'k1').status, 409);
  assert.equal(p.potten('Codenaam')[0].standCenten, 900);
});

test('zonder sleutel (Rahul, het oude scherm) telt elke reservering', () => {
  const p = potten();
  const pot = p.potZet('Codenaam', { naam: 'Vakantie', doelCenten: 50000 }).pot;
  p.potReserveer('Codenaam', pot.id, 100);
  p.potReserveer('Codenaam', pot.id, 100);
  assert.equal(p.potten('Codenaam')[0].standCenten, 200);
});
