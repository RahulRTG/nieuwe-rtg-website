/* Het wisrecht op de gesprekken van de communicatiekern
   (server/kern/vergeten/gesprekken.js).

   WAAROM DEZE TOETS ER IS, en waarom hij er niet was. Toen de gesprekken naar
   de kern verhuisden, verhuisde het wisrecht niet mee: wisLid() kende de nieuwe
   takken niet en liet alles staan. Een lid dat om vergetelheid vroeg, verdween
   uit zijn account en bleef in zijn gesprekken.

   Dat was groen. De bezem in test/vergeten.test.js loopt na het verwijderen
   door de HELE database op zoek naar de sleutel -- een goede toets -- maar de
   wandeling ervoor maakt geen gesprek, want daar heb je een tweede, verbonden
   lid voor nodig. Een tak die nooit is aangeraakt kan een bezem niet vinden.
   Dat is de les: dekking van een bezem is de dekking van de wandeling ervoor.

   Deze toets maakt de gesprekken WEL, met de echte kern, en roept dezelfde
   functie aan die wisLid() aanroept. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakComm } = require('../server/kern/comm');
const { wisGesprekkenVan } = require('../server/kern/vergeten/gesprekken');

function opzet() {
  const db = { data: {} };
  const comm = maakComm({ db, save() {}, crypto, codenaamVan: (k) => k });
  const samen = comm.tussen('weg', 'blijft');
  comm.bericht({ gesprekId: samen.id, van: 'weg', tekst: 'van de vertrekker' });
  comm.bericht({ gesprekId: samen.id, van: 'blijft', tekst: 'van de blijver' });
  const alleen = comm.gesprekMaak({ soort: 'personal', deelnemers: ['weg'], door: 'weg',
    meta: { sleutel: 'alleen' } });
  comm.bericht({ gesprekId: alleen.id, van: 'weg', tekst: 'alleen van mij' });
  comm.vlag('weg', samen.id, 'vast', true);
  comm.lees('blijft', samen.id);
  return { db, comm, samen, alleen };
}

test('wie vertrekt, laat geen woord achter -- en de ander houdt het zijne', () => {
  const { db, samen, alleen } = opzet();
  wisGesprekkenVan(db, 'weg');

  const over = db.data.commGesprekken.map((g) => g.id);
  assert.ok(!over.includes(alleen.id), 'een gesprek waar alleen de vertrekker in zat staat er nog');
  assert.ok(over.includes(samen.id), 'het gesprek met de blijver is meegesleept');

  const teksten = Object.values(db.data.commBerichten).flat().map((m) => m.tekst);
  assert.deepEqual(teksten, ['van de blijver'],
    'er staat nog inhoud van de vertrekker, of die van de blijver is weg: ' + teksten.join(' | '));
});

test('de sleutel van de vertrekker komt nergens meer voor', () => {
  const { db } = opzet();
  wisGesprekkenVan(db, 'weg');
  /* De bezem, maar dan op de tak die hij eerder niet kon vinden. Op de hele
     data en niet op een paar velden: een sleutel die ergens in een deelnemer-
     lijst of een stand blijft staan, is precies waarmee iemand terug te vinden
     zou zijn. */
  assert.ok(!JSON.stringify(db.data).includes('"weg"'),
    'de sleutel van het verwijderde lid staat nog in de database');
});

test('de leesstanden en vlaggen van de vertrekker gaan mee, die van de ander niet', () => {
  const { db } = opzet();
  assert.ok(db.data.commStand.weg, 'de opzet klopt niet: de vertrekker had geen stand');
  wisGesprekkenVan(db, 'weg');
  assert.equal(db.data.commStand.weg, undefined, 'de standen van de vertrekker staan er nog');
  assert.ok(db.data.commStand.blijft, 'de leesstand van de blijver is meegewist');
});

test('een database zonder gesprekken laat niets omvallen', () => {
  for (const db of [null, {}, { data: null }, { data: {} }, { data: { commGesprekken: 'geen lijst' } }]) {
    assert.doesNotThrow(() => wisGesprekkenVan(db, 'weg'));
  }
});
