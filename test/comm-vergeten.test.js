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
const { wisGesprekkenVan, wisSollicitatiechats } = require('../server/kern/vergeten/gesprekken');

function opzet() {
  const db = { data: {} };
  const comm = maakComm({ db, save() {}, crypto, codenaamVan: (k) => k });
  const samen = comm.tussen('weg', 'blijft');
  comm.bericht({ gesprekId: samen.id, van: 'weg', tekst: 'van de vertrekker' });
  comm.bericht({ gesprekId: samen.id, van: 'blijft', tekst: 'van de blijver' });
  const alleen = comm.gesprekMaak({ soort: 'personal', deelnemers: ['weg'], door: 'weg',
    meta: { sleutel: 'alleen' } });
  comm.bericht({ gesprekId: alleen.id, van: 'weg', tekst: 'alleen van mij' });
  /* Een gesprek dat de vertrekker BEGON en waar de ander in blijft. Dat scheelt
     een letter met `samen` en het is precies de letter die telt: een gesprek
     draagt in `door` wie het opende, en die sleutel wordt door geen enkele
     lus hierboven aangeraakt. In `samen` viel dat niet op omdat tussen() de
     twee sleutels alfabetisch zet en 'blijft' voor 'weg' komt -- de bewaking
     hing dus aan de toevalligheid dat de blijver vooraan in het alfabet staat. */
  const begonnen = comm.gesprekMaak({ soort: 'group', deelnemers: ['weg', 'blijft'],
    door: 'weg', titel: 'Een groep', meta: { sleutel: 'begonnen' } });
  comm.bericht({ gesprekId: begonnen.id, van: 'blijft', tekst: 'van de blijver' });
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
  assert.deepEqual(teksten, ['van de blijver', 'van de blijver'],
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

/* Sinds kern/comm/wie.js kan de andere kant van een gesprek een ZAAK zijn: een
   bestelling, een rit, een boeking. Dat maakt een geval bereikbaar dat er
   eerder niet was -- een lid vertrekt uit een gesprek waarin verder geen mens
   zit -- en juist daar mag het wisrecht niet stilvallen. Twee dingen moeten
   allebei waar zijn, en ze trekken tegen elkaar in:

     - van het LID blijft niets over. Zijn sleutel, zijn berichten, zijn
       leesstand: weg, net als in een gesprek tussen twee mensen. Dat de
       tegenpartij een bedrijf is, verandert daar niets aan.
     - de ZAAK houdt haar eigen kant. Een bedrijf heeft een eigen administratie
       en eigen bewaarplichten; het gesprek weggooien omdat de klant vertrekt
       zou die kant meesleuren, en dat is niet aan het lid.

   Vandaar deze toets: hij bewaakt de scheidslijn, niet een van beide helften. */
test('een lid verdwijnt ook uit een gesprek met een zaak -- en de zaak houdt haar eigen kant', () => {
  const db = { data: {} };
  const comm = maakComm({ db, save() {}, crypto, codenaamVan: (k) => k });
  const g = comm.gesprekMaak({ soort: 'order', deelnemers: ['weg', 'zaak:AB12'],
    meta: { sleutel: 'bestelling:1' } });
  comm.bericht({ gesprekId: g.id, van: 'weg', tekst: 'is de keuken nog open' });
  comm.bericht({ gesprekId: g.id, van: 'zaak:AB12', door: 'mens:AB12:7', tekst: 'tot elf uur' });
  comm.lees('weg', g.id);

  wisGesprekkenVan(db, 'weg');

  assert.ok(!JSON.stringify(db.data).includes('"weg"'),
    'de sleutel van het verwijderde lid staat nog in het gesprek met de zaak');
  const over = db.data.commGesprekken.find((x) => x.id === g.id);
  assert.ok(over, 'het gesprek is meegesleept terwijl de zaak er nog in zat');
  assert.deepEqual(over.deelnemers, ['zaak:AB12'], 'de zaak is uit haar eigen gesprek gezet');
  assert.deepEqual((db.data.commBerichten[g.id] || []).map((m) => m.tekst), ['tot elf uur'],
    'de zaak is haar eigen antwoord kwijt, of het bericht van het lid staat er nog');
});

/* De sollicitatiechat had dit gat al voor de verhuizing, en hij bleef staan
   omdat hij op een RECORD zit en niet op een bericht. vergeten/anoniem.js
   haalt de persoon netjes uit db.data.applications -- naam, contact, cv,
   codenaam, sleutel -- maar db.data.applyChats[id].applicant droeg diezelfde
   sleutel en naam nog een keer, en die tak kwam er niet in voor.

   Het gesprek zelf is sinds de verhuizing wel gedekt (het lid is deelnemer,
   dus wisGesprekkenVan haalt hem eruit). Wat overbleef was de SCHAKEL: het
   record dat zegt wie er solliciteerde. Een bedrijf dat zijn administratie
   houdt, hoort dat te doen zonder te weten wie het was. */
test('een sollicitatiechat draagt na vergetelheid geen sleutel en geen naam meer', () => {
  const db = { data: {
    applyChats: {
      'app-1': { id: 'app-1', supplierCode: 'KIKUNOI', func: 'Bediening', bedrijf: 'Sal de Mar',
        applicant: { kind: 'rtg', key: 'weg', naam: 'Amberen Vos' }, berichten: [] },
      'app-2': { id: 'app-2', supplierCode: 'KIKUNOI', func: 'Bar',
        applicant: { kind: 'rtg', key: 'blijft', naam: 'Noordelijke Ster' }, berichten: [] }
    }
  } };
  const comm = maakComm({ db, save() {}, crypto, codenaamVan: (k) => k });
  const g = comm.gesprekMaak({ soort: 'business', deelnemers: ['weg', 'zaak:KIKUNOI'],
    meta: { sleutel: 'werk:app-1' } });
  comm.bericht({ gesprekId: g.id, van: 'weg', tekst: 'ik wil graag solliciteren' });

  wisGesprekkenVan(db, 'weg');
  wisSollicitatiechats(db, 'weg');

  assert.ok(!JSON.stringify(db.data).includes('"weg"'),
    'de sleutel van het verwijderde lid staat nog in een sollicitatiechat');
  assert.equal(db.data.applyChats['app-1'].applicant.naam, '(op verzoek verwijderd)');
  /* De zaak houdt haar administratie: de sollicitatie zelf blijft, met vak en
     bedrijf. Alleen wie het was, is weg. */
  assert.equal(db.data.applyChats['app-1'].func, 'Bediening');
  assert.equal(db.data.applyChats['app-2'].applicant.naam, 'Noordelijke Ster',
    'de sollicitatie van een ander lid is meegewist');
});

test('een database zonder gesprekken laat niets omvallen', () => {
  for (const db of [null, {}, { data: null }, { data: {} }, { data: { commGesprekken: 'geen lijst' } }]) {
    assert.doesNotThrow(() => wisGesprekkenVan(db, 'weg'));
  }
});
