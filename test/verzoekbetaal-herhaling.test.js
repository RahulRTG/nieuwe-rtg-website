/* EEN HERHALING VAN EEN GESLAAGDE BETALING IS GEEN WEIGERING (server/kern/pay/verzoeken.js).

   verzoekBetaal() keek of het verzoek nog `open` stond VOORDAT het de
   idem-laag vroeg of deze sleutel al eens was gelukt. Na een geslaagde
   betaling staat het verzoek op `betaald`, dus kreeg de herhaling met DEZELFDE
   sleutel -- de dubbeltik, de retry na een haperend netwerk, precies waar de
   sleutel voor bestaat -- een 409 "al afgehandeld" in plaats van het antwoord
   van de eerste keer. De app toonde dan een fout voor een betaling die gelukt
   was. De controle op `open` staat ook binnen het werk, op het moment dat
   telt; daar hoort hij, en een ANDERE sleutel krijgt daar nog steeds de 409.

   Draai los: node --test test/verzoekbetaal-herhaling.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const keten = require('../server/kern/spellen/magnaat/rtg-keten')({ betaal: {},
  vrijgave: require('../scripts/lib/proefvrijgave').proefVrijgave() });

async function opzet() {
  const { db, pay } = keten.opstelling();
  const [vrager, betaler] = keten.SPELERS;
  const op = await pay.oplaadAfronden({ codenaam: betaler, centen: 100000, ref: 'proef' });
  assert.equal(op.ok, true, JSON.stringify(op));
  const mk = await pay.verzoekMaak({ van: vrager, aan: [betaler], totaalCenten: 2500, idem: 'v' });
  assert.equal(mk.ok, true, JSON.stringify(mk));
  return { db, pay, vrager, betaler, id: mk.verzoeken[0].id };
}

test('dezelfde sleutel na een geslaagde betaling geeft het antwoord van de eerste keer', async () => {
  const { db, pay, betaler, id } = await opzet();
  const eerst = await pay.verzoekBetaal({ codenaam: betaler, verzoekId: id, idem: 'tik-1' });
  assert.equal(eerst.ok, true, JSON.stringify(eerst));
  const weer = await pay.verzoekBetaal({ codenaam: betaler, verzoekId: id, idem: 'tik-1' });
  assert.equal(weer.ok, true, 'een herhaling is geen fout: ' + JSON.stringify(weer));
  assert.equal(weer.herhaald, true);
  assert.equal(db.data.payBoekingen.filter(r => r.soort === 'klompje' && r.ref === id).length, 1, 'een keer geboekt');
});

test('een andere sleutel op een betaald verzoek blijft een 409', async () => {
  const { pay, betaler, id } = await opzet();
  assert.equal((await pay.verzoekBetaal({ codenaam: betaler, verzoekId: id, idem: 'tik-1' })).ok, true);
  const ander = await pay.verzoekBetaal({ codenaam: betaler, verzoekId: id, idem: 'tik-2' });
  assert.equal(ander.status, 409, JSON.stringify(ander));
  assert.equal(pay.sluitcontrole().klopt, true);
});
