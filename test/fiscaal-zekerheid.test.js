/* DE VIER ZEKERHEIDSKLASSEN.

   Elke fiscale uitkomst droeg dezelfde zin: "voorlichting, geen bindend fiscaal
   advies". Die stond onder een btw-aangifte die tot op de cent uit het
   factuurregister is geteld en onder een zzp-schatting op een verwachte
   jaarwinst. Vijf beweringen over de vervanging:

   1. DE VIER KLASSEN BESTAAN, elk met de Engelse term waaronder ze zijn
      afgesproken.
   2. EEN NIET-INGEDEELDE UITKOMST VERKLAART ZICHZELF NIET TOT FEIT. Dit is de
      belangrijkste: wie later een uitkomst toevoegt en vergeet hem in te delen,
      krijgt de VOORZICHTIGE klasse en een melding dat hij niet is ingedeeld --
      niet stilzwijgend "vastgesteld".
   3. DE UITKOMSTEN DRAGEN HUN KLASSE: de aangifte en de maandboekhouding zijn
      vastgesteld, de zzp-som is advies.
   4. WAT RTG NIET ZELF MAG, staat als `voorbehouden` in het register -- en dat
      is geen tijdelijke stand maar een grens.
   5. DE VLAKKE ZIN IS ECHT WEG uit wat een gebruiker te zien krijgt.

   Draai los: node --experimental-sqlite --test test/fiscaal-zekerheid.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const zek = require('../server/kern/fiscaal/zekerheid');
const { maakFiscaal, zzpBerekening } = require('../server/kern/fiscaal');
const { centen } = require('../server/kern/util');
const { btwSplit } = require('../server/kern/afgeleid');

function stubDb() {
  const db = { data: { supplierTypes: { horeca: { caps: ['menu'] } },
    orders: [], posSales: {}, rides: [], boekingen: [], giftcards: [], klok: {} } };
  return require('../server/kern/werkvormen').haakAan(db);
}

test('de vier klassen bestaan, met de term waaronder ze zijn afgesproken', () => {
  assert.deepEqual(Object.keys(zek.KLASSEN), ['bepaald', 'uitlegbaar', 'advies', 'voorbehouden']);
  assert.equal(zek.KLASSEN.bepaald.term, 'DETERMINISTIC');
  assert.equal(zek.KLASSEN.uitlegbaar.term, 'INTERPRETIVE');
  assert.equal(zek.KLASSEN.advies.term, 'ADVISORY');
  assert.equal(zek.KLASSEN.voorbehouden.term, 'PROHIBITED_AUTOMATION');
  // elke ingedeelde uitkomst draagt een reden; een klasse zonder waarom is een label
  for (const u of zek.alles()) {
    assert.ok(zek.KLASSEN[u.klasse], u.sleutel + ' heeft een bestaande klasse');
    assert.ok(u.waarom && u.waarom.length > 20, u.sleutel + ' zegt waarom');
  }
});

test('een niet-ingedeelde uitkomst verklaart zichzelf niet tot feit', () => {
  const onbekend = zek.zekerheid('iets.nieuws');
  assert.equal(onbekend.ingedeeld, false);
  assert.equal(onbekend.klasse, 'advies', 'de voorzichtige kant, niet "bepaald"');
  assert.match(onbekend.waarom, /nog niet ingedeeld/i);
  // en de zin eronder belooft dus ook niets
  assert.match(zek.zin('iets.nieuws'), /fiscalist/i);
  assert.ok(!/vastgesteld/i.test(zek.zin('iets.nieuws')));
});

test('de uitkomsten dragen hun klasse', () => {
  const s = { code: 'KIKUNOI', type: 'horeca', menu: [], settings: { land: 'NL', uurloon: 20 } };
  const { financeVoor } = maakFiscaal({ db: stubDb(), centen, btwSplit });
  const fin = financeVoor(s);
  assert.equal(fin.zekerheid.klasse, 'bepaald');
  assert.equal(fin.zekerheid.term, 'DETERMINISTIC');
  assert.ok(fin.zekerheid.mits, 'met de rand erbij: de personeelskosten zijn geen loonrun');

  const z = zzpBerekening('NL', 60000, { urencriterium: true });
  assert.equal(z.zekerheid.klasse, 'advies', 'een schatting is geen vaststelling');

  // de twee die een keuze zijn, en niet een feit
  assert.equal(zek.zekerheid('btw.categorie').klasse, 'uitlegbaar');
  assert.ok(zek.zekerheid('btw.categorie').keuze, 'met de gemaakte keuze erbij');
  assert.equal(zek.zekerheid('btw.cadeaukaart').klasse, 'uitlegbaar');
});

test('wat RTG niet zelf mag, staat als voorbehouden in het register', () => {
  for (const sleutel of ['btw.indienen', 'naheffing.vaststellen', 'naheffing.boete', 'toegang.pas']) {
    const u = zek.zekerheid(sleutel);
    assert.equal(u.klasse, 'voorbehouden', sleutel);
    assert.equal(u.term, 'PROHIBITED_AUTOMATION');
  }
  /* De zin eronder mag geen advies-slotje krijgen: "raadpleeg een fiscalist"
     onder "RTG verzendt geen aangiften" leest als een aanbeveling in plaats van
     een grens. */
  assert.ok(!/fiscalist/i.test(zek.zin('btw.indienen')));
  assert.match(zek.zin('btw.indienen'), /buiten RTG om/i);
});

test('de vlakke zin is weg uit wat een gebruiker te zien krijgt', () => {
  const s = { code: 'KIKUNOI', type: 'horeca', menu: [], settings: { land: 'NL', uurloon: 20 } };
  const { financeVoor, cannedBoekhouder } = maakFiscaal({ db: stubDb(), centen, btwSplit });
  const fin = financeVoor(s);
  const L = require('../server/kern/fiscaal').LANDEN.NL;

  const alleRegels = fin.regels.join(' ');
  assert.ok(!/voorlichting, geen bindend fiscaal advies/i.test(alleRegels),
    'de vlakke zin staat niet meer onder de maandboekhouding');
  assert.match(alleRegels, /Vastgesteld:/, 'er staat nu wat er wél vaststaat');

  const antwoord = cannedBoekhouder('waar gaat dit over', fin, L);
  assert.ok(!/voorlichting, geen bindend fiscaal advies/i.test(antwoord));
  assert.match(antwoord, /fiscalist/i, 'een AI-antwoord blijft advies, en zegt dat zo');
});
