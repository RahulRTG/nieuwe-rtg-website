/* De verhuizing van de priveberichten naar de communicatiekern
   (server/kern/comm/dm.js).

   WAAROM DIT EEN EIGEN TOETS HEEFT. Een verhuizing van gebruikersdata is het
   soort werk dat er goed uitziet zolang je naar nieuwe berichten kijkt. Wat
   stukgaat is het OUDE spul, en dat merk je pas als iemand iets terugzoekt --
   weken later, als niemand meer weet welke ronde het deed.

   Vier dingen kunnen hier misgaan, en alle vier zijn ze onzichtbaar op het
   scherm van de dag zelf:

   1. DE GESCHIEDENIS VERDWIJNT. Een gesprek van jaren begint ineens leeg.
   2. DE TIJDSTEMPELS SCHUIVEN. Als de import via de gewone verstuurweg loopt,
      krijgt elk oud bericht de datum van de verhuizing. Een gesprek van twee
      jaar dat er ineens uitziet alsof het vanmiddag gebeurde is geen migratie
      maar een vervalsing -- en hij is niet terug te draaien.
   3. DE LEESSTAND GAAT NIET MEE. Dan springt bij iedereen elk oud gesprek op
      ongelezen: een stapel rode bolletjes die niemand heeft veroorzaakt.
   4. DE IMPORT GEBEURT TWEE KEER. Elk bericht staat er dan dubbel in, en je
      ziet het pas als iemand omhoog scrollt.

   De toets draait op een nagemaakte database, zonder server: het gaat om het
   verhuizen zelf, niet om de routes eromheen (die staan in comm.e2e.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakComm } = require('../server/kern/comm');
const { maakCommDm } = require('../server/kern/comm/dm');

const NAMEN = { a: 'Amberen Vos', b: 'Noordelijke Ster' };

function opzet(oudeChat) {
  const db = { data: { memberChats: oudeChat ? { 'a|b': oudeChat } : {} } };
  let bewaard = 0;
  const save = () => { bewaard++; };
  const comm = maakComm({ db, save, crypto, codenaamVan: (k) => NAMEN[k] || k });
  const dm = maakCommDm({ db, save, comm, dmSleutel: (x, y) => [x, y].sort().join('|') });
  return { db, comm, dm, bewaard: () => bewaard };
}

const OUD = {
  messages: [
    { from: 'a', text: 'oud bericht een', at: '2024-01-01T10:00:00.000Z', lang: 'nl' },
    { from: 'b', text: 'oud antwoord', at: '2024-01-02T10:00:00.000Z' },
    { from: 'a', text: '', post: { id: 7, author: 'Katja', place: 'Ibiza', text: 'strand' },
      at: '2024-01-03T10:00:00.000Z' }
  ],
  read: { a: '2024-01-02T10:00:00.000Z' }
};

test('de oude geschiedenis verhuist mee, met haar eigen tijdstempels', () => {
  const { dm } = opzet(JSON.parse(JSON.stringify(OUD)));
  const uit = dm.berichten('a', 'b');
  assert.equal(uit.length, 3, 'niet alle oude berichten zijn meegekomen');
  assert.deepEqual(uit.map((m) => m.text), ['oud bericht een', 'oud antwoord', ''],
    'de teksten zijn niet ongewijzigd overgekomen');
  /* De datums, en dit is de belangrijkste regel van deze toets. Via de gewone
     verstuurweg zou hier drie keer vandaag staan. */
  assert.deepEqual(uit.map((m) => m.at.slice(0, 10)), ['2024-01-01', '2024-01-02', '2024-01-03'],
    'de tijdstempels zijn op de dag van de verhuizing gezet');
  assert.equal(uit[0].lang, 'nl', 'de brontaal van een bericht is verdwenen');
});

test('een gedeelde Salon-post overleeft de verhuizing als bijlage', () => {
  const { dm } = opzet(JSON.parse(JSON.stringify(OUD)));
  const post = dm.berichten('a', 'b')[2].post;
  assert.ok(post, 'de gedeelde post is weg');
  assert.equal(post.id, 7, 'de post wijst naar een ander bericht');
  assert.equal(post.author, 'Katja', 'de auteur is niet meegekomen');
});

test('de leesstand verhuist mee, dus niemand krijgt een stapel valse bolletjes', () => {
  const { dm } = opzet(JSON.parse(JSON.stringify(OUD)));
  /* a had tot en met 2 januari gelezen; het enige wat daarna komt is van a
     zelf, dus voor a staat er niets open. b had niets gelezen en heeft de twee
     berichten van a open staan. */
  assert.equal(dm.ongelezen('a', 'b'), 0, 'a krijgt oude, al gelezen berichten opnieuw als ongelezen');
  assert.equal(dm.ongelezen('b', 'a'), 2, 'b ziet niet wat er voor hem openstaat');
});

test('de import gebeurt precies een keer, hoe vaak je het gesprek ook opent', () => {
  const { dm } = opzet(JSON.parse(JSON.stringify(OUD)));
  const eerst = dm.berichten('a', 'b').length;
  dm.gesprek('a', 'b');
  dm.gesprek('b', 'a');          // ook van de andere kant
  dm.stuur('a', 'b', { tekst: 'nieuw' });
  dm.gesprek('a', 'b');
  const na = dm.berichten('a', 'b');
  assert.equal(na.length, eerst + 1, 'de geschiedenis is er meer dan een keer in gezet');
  assert.equal(na[na.length - 1].text, 'nieuw', 'het nieuwe bericht staat niet onderaan');
});

test('de oude voorraad blijft staan: er wordt verhuisd, niet weggegooid', () => {
  const { db, dm } = opzet(JSON.parse(JSON.stringify(OUD)));
  dm.berichten('a', 'b');
  dm.stuur('a', 'b', { tekst: 'nieuw' });
  /* Data van mensen weggooien omdat de code er klaar mee is, is precies de
     handeling die je niet terug kunt draaien als er iets aan de import blijkt
     te mankeren. Hij wordt niet meer gelezen en niet meer geschreven -- maar
     hij staat er nog. */
  assert.equal(db.data.memberChats['a|b'].messages.length, 3, 'de oude voorraad is aangetast');
  assert.ok(!db.data.memberChats['a|b'].messages.some((m) => m.text === 'nieuw'),
    'er wordt nog in de oude voorraad geschreven -- twee schrijvers, twee waarheden');
});

test('een paar zonder geschiedenis begint gewoon leeg', () => {
  const { dm } = opzet(null);
  assert.deepEqual(dm.berichten('a', 'b'), [], 'een leeg paar levert berichten op');
  dm.stuur('a', 'b', { tekst: 'eerste' });
  assert.deepEqual(dm.berichten('a', 'b').map((m) => m.text), ['eerste']);
  assert.equal(dm.laatste('b', 'a').text, 'eerste', 'de andere kant ziet het bericht niet');
});
