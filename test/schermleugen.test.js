/* DE DETECTOREN ACHTER DE LIEGENDE-BACKEND-SCHERMTOETS (scripts/lib/schermleugen.js).

   WAAROM DIT BESTAND BESTAAT, en het is geen formaliteit. test/liegend-scherm.e2e.js
   stond op zijn allereerste ronde meteen groen over zes schermen. Dat kan twee
   dingen betekenen: de schermen gedragen zich netjes op een leeg antwoord, of de
   meter is blind. Zonder deze toets is er geen manier om te weten welke van de
   twee -- en LAT.md regel 2 zegt dat een bewering die je niet hebt zien zakken
   geen bewering is.

   Hier slaan de drie detectoren aan op invoer waarvan ik weet dat hij fout is,
   en zwijgen ze over invoer waarvan ik weet dat hij goed is. Die tweede helft is
   even belangrijk: een detector die overal op aanslaat wordt binnen een week
   uitgezet, en dan is het gat groter dan ervoor.

   Puur, dus zonder browser en zonder server -- en daarmee bereikbaar voor de
   mutatiemotor, wat de schermtoets zelf nooit kan zijn.
   Draai los: node --test test/schermleugen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { vindKlachten, vergelijk, heelWoord, ZEKERHEID, ROMMEL } = require('../scripts/lib/schermleugen');

const klacht = (o) => vindKlachten({ statisch: '', fouten: [], ...o });

/* ---------- 1. rommel in beeld ---------- */

test('een bedrag van NaN wordt gezien', () => {
  const k = klacht({ tekst: 'Saldo · € NaN · Opladen' });
  assert.deepEqual(k, ['rommel in beeld: NaN']);
});

test('undefined en [object Object] worden gezien', () => {
  assert.ok(klacht({ tekst: 'Welkom, undefined' }).includes('rommel in beeld: undefined'));
  assert.ok(klacht({ tekst: 'Van: [object Object]' }).includes('rommel in beeld: [object Object]'));
});

test('een gewone pagina zonder rommel geeft geen enkele klacht', () => {
  assert.deepEqual(klacht({ tekst: 'Saldo · € 0,00 · Nog geen transacties · Opladen' }), []);
});

test('rommelwoorden binnenin een woord tellen niet mee', () => {
  /* "Nanocrediet" bevat NaN en "nulmeting" bevat null. Zou dit meetellen, dan
     stond de toets rood om taal in plaats van om een fout. */
  assert.deepEqual(klacht({ tekst: 'Nanocrediet · nulmeting · Fundamenteel' }), []);
});

/* ---------- 2. zekerheid zonder gegevens ---------- */

test('een scherm dat op een leeg antwoord "Betaald" gaat zeggen, wordt betrapt', () => {
  const k = klacht({ tekst: 'Factuur 12 · Betaald', statisch: '<h1>Facturen</h1>' });
  assert.deepEqual(k, ['zekerheid zonder gegevens: "Betaald"']);
});

test('een zekerheidswoord dat al in de statische bron staat, is geen leugen', () => {
  /* Vaste tekst, een legenda, een uitleg: dat mag. De vraag is of het scherm het
     ZELF is gaan zeggen terwijl er niets binnenkwam. */
  const k = klacht({ tekst: 'Uitleg: een factuur is Betaald zodra het geld binnen is',
    statisch: '<p>Uitleg: een factuur is Betaald zodra het geld binnen is</p>' });
  assert.deepEqual(k, []);
});

test('een voornemen is geen bewering: "Opslaan" mag, "Opgeslagen" niet', () => {
  assert.deepEqual(klacht({ tekst: 'Notitie · Opslaan · Annuleren' }), []);
  assert.deepEqual(klacht({ tekst: 'Notitie · Opgeslagen' }),
    ['zekerheid zonder gegevens: "Opgeslagen"']);
});

test('"onbetaald" is het tegenovergestelde van "Betaald" en mag niet meetellen', () => {
  assert.deepEqual(klacht({ tekst: 'Factuur 12 · onbetaald' }), []);
});

test('elk zekerheidswoord in de lijst wordt daadwerkelijk gevonden', () => {
  /* Zonder deze toets kan er een woord in de lijst staan dat door de
     woordgrenzen nooit matcht -- een regel die er is en niets doet. */
  for (const w of ZEKERHEID) {
    assert.deepEqual(klacht({ tekst: 'Status · ' + w }), ['zekerheid zonder gegevens: "' + w + '"'],
      w + ' staat in de lijst maar wordt niet gevonden');
  }
});

test('elk rommelpatroon in de lijst wordt daadwerkelijk gevonden', () => {
  const proef = { undefined: 'Naam: undefined', NaN: 'Bedrag: NaN',
    '[object Object]': 'Van: [object Object]', null: 'Datum: null' };
  for (const r of ROMMEL) {
    assert.ok(klacht({ tekst: proef[r.naam] }).includes('rommel in beeld: ' + r.naam),
      r.naam + ' staat in de lijst maar wordt niet gevonden');
  }
});

/* ---------- 3. JS-fouten ---------- */

test('een JS-fout op de pagina komt er als klacht uit, ingekort', () => {
  const k = klacht({ tekst: 'niets aan de hand', fouten: ['x'.repeat(300)] });
  assert.equal(k.length, 1);
  assert.match(k[0], /^JS-fout: x+$/);
  assert.equal(k[0].length, 'JS-fout: '.length + 120);
});

test('de drie soorten klacht stapelen en verdringen elkaar niet', () => {
  const k = klacht({ tekst: 'Bedrag € NaN · Betaald', fouten: ['stuk'] });
  assert.equal(k.length, 3);
});

/* ---------- heelWoord ---------- */

test('heelWoord kijkt naar letters en niet naar leestekens', () => {
  assert.equal(heelWoord('Betaald', 'is Betaald.'), true);
  assert.equal(heelWoord('Betaald', '(Betaald)'), true);
  assert.equal(heelWoord('Betaald', 'onbetaald'), false);
  assert.equal(heelWoord('Betaald', 'Betaaldatum'), false);
});

/* ---------- de ratel ---------- */

test('een klacht die niet in de schuld staat, is nieuw', () => {
  const { nieuw } = vergelijk({ '/a.html': ['rommel in beeld: NaN'] }, {});
  assert.deepEqual(nieuw, ['/a.html -> rommel in beeld: NaN']);
});

test('een klacht die al is opgeschreven, is geen nieuwe fout', () => {
  const zelfde = { '/a.html': ['rommel in beeld: NaN'] };
  assert.deepEqual(vergelijk(zelfde, zelfde), { nieuw: [], opgelost: [] });
});

test('een opgeschreven klacht die niet meer gebeurt, moet uit de lijst', () => {
  /* Anders dekt de schuldregel een gat af dat dicht is, en gaat de poort niet
     meer open als het scherm opnieuw kapotgaat. */
  const { nieuw, opgelost } = vergelijk({}, { '/a.html': ['rommel in beeld: NaN'] });
  assert.deepEqual(nieuw, []);
  assert.deepEqual(opgelost, ['/a.html -> rommel in beeld: NaN']);
});

test('de ratel verwart twee schermen met dezelfde klacht niet', () => {
  const { nieuw } = vergelijk(
    { '/a.html': ['rommel in beeld: NaN'], '/b.html': ['rommel in beeld: NaN'] },
    { '/a.html': ['rommel in beeld: NaN'] });
  assert.deepEqual(nieuw, ['/b.html -> rommel in beeld: NaN']);
});
