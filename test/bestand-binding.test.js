/* Opgeslagen bestanden zijn aan hun NAAM gebonden (server/kluis.js).

   De versleuteling beschermde al de inhoud van een bestand, maar zei niets over
   welk bestand het was. Wie bij de opslag kan, kon een blob dus omwisselen: het
   identiteitsbewijs van de een op de plek van de ander. De AEAD merkt daar niets
   van -- het blob is ongeschonden -- en de backoffice ziet daarna het verkeerde
   document bij een goedkeuring. Voor de KYC-opslag is dat het ergste wat er kan
   gebeuren, en het is precies wat deze binding dichtzet.

   Draai los: RTG_ENC_KEY=<64 hex> node --test test/bestand-binding.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

// de sleutel moet staan VOOR de module wordt geladen (hij leest hem bij require)
process.env.RTG_ENC_KEY = crypto.randomBytes(32).toString('hex');
const kluis = require('../server/kluis');

const A = Buffer.from('dit is het paspoort van lid A');
const B = Buffer.from('dit is het paspoort van lid B');

test('rondrit: met de eigen naam gaat een bestand gewoon open', () => {
  assert.equal(kluis.AAN, true, 'met RTG_ENC_KEY hoort de kluis aan te staan');
  const blob = kluis.versleutelBestand(A, 'aaa111.jpg');
  assert.ok(!blob.equals(A), 'het moet echt versleuteld zijn');
  assert.ok(!blob.includes(Buffer.from('paspoort')), 'geen leesbare inhoud in het blob');
  assert.deepEqual(kluis.ontsleutelBestand(blob, 'aaa111.jpg'), A);
});

/* DE KERN: twee blobs omwisselen. Voor de binding lukte dit en las de backoffice
   het document van A terwijl hij dat van B dacht te zien. */
test('een blob onder een ANDERE naam gaat niet open', () => {
  const blobA = kluis.versleutelBestand(A, 'aaa111.jpg');
  const blobB = kluis.versleutelBestand(B, 'bbb222.jpg');

  // de aanvaller wisselt de bestanden om: blobA staat nu op de plek van bbb222
  assert.throws(() => kluis.ontsleutelBestand(blobA, 'bbb222.jpg'),
    'het document van A mag niet opengaan onder de naam van B');
  assert.throws(() => kluis.ontsleutelBestand(blobB, 'aaa111.jpg'),
    'en omgekeerd ook niet');

  // op hun eigen plek werkt alles nog
  assert.deepEqual(kluis.ontsleutelBestand(blobA, 'aaa111.jpg'), A);
  assert.deepEqual(kluis.ontsleutelBestand(blobB, 'bbb222.jpg'), B);
});

test('ook een lege of ontbrekende naam opent een gebonden blob niet', () => {
  const blob = kluis.versleutelBestand(A, 'aaa111.jpg');
  assert.throws(() => kluis.ontsleutelBestand(blob, ''));
  assert.throws(() => kluis.ontsleutelBestand(blob, undefined));
  // en schrijven zonder context is een programmeerfout, geen stille ongebonden write
  assert.throws(() => kluis.versleutelBestand(A, ''), /bestandsnaam/);
});

test('geknoei in een gebonden blob valt op', () => {
  const blob = kluis.versleutelBestand(A, 'aaa111.jpg');
  const kapot = Buffer.from(blob);
  kapot[kapot.length - 1] ^= 0xff;
  assert.throws(() => kluis.ontsleutelBestand(kapot, 'aaa111.jpg'));
});

/* Een bestaande installatie heeft RTGENC1-bestanden (versleuteld, ongebonden) en
   mogelijk nog onversleutelde bytes. Die moeten leesbaar blijven, anders is elk
   al geupload identiteitsbewijs na een upgrade onbruikbaar. */
test('bestaande RTGENC1-bestanden en platte bytes blijven leesbaar', () => {
  const oud = kluis.versleutelBuf(A);                 // de oude, ongebonden vorm
  assert.deepEqual(kluis.ontsleutelBestand(oud, 'aaa111.jpg'), A, 'RTGENC1 moet open');
  assert.deepEqual(kluis.ontsleutelBestand(oud, 'heel-andere-naam.jpg'), A,
    'een ongebonden blob heeft geen context: die opent onder elke naam (dat IS het oude gat)');

  const plat = Buffer.from('nooit versleuteld geweest');
  assert.deepEqual(kluis.ontsleutelBestand(plat, 'x.jpg'), plat, 'platte bytes gaan ongewijzigd door');
});

test('een gebonden blob is niet met de oude lezer te openen', () => {
  const blob = kluis.versleutelBestand(A, 'aaa111.jpg');
  // ontsleutelBuf kent RTGENC2 niet en ziet hem als "niet versleuteld": hij geeft
  // de bytes ongewijzigd terug in plaats van klaartekst. Zo weten we dat elke
  // lezer die nog niet is omgezet zichtbaar iets anders krijgt dan de inhoud.
  const uit = kluis.ontsleutelBuf(blob);
  assert.ok(uit.equals(blob), 'de oude lezer levert het blob, niet de inhoud');
  assert.ok(!uit.equals(A));
});
