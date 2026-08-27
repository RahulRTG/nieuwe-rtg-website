/* WAT IS ER AFLEIDBAAR UIT EEN CODENAAM -- en meet die meter dat werkelijk?

   MAGNAATLAB.md par. 4.6 noemt punt 22 het meest onderscheidende van de vijftig:
   kunnen twee capabilities die allebei mogen wat ze doen, samen iets opleveren
   dat geen van beide mag? CLAUDE.md schrijft het geval zelf uit -- een BIG-nummer
   naast een codenaam voert die codenaam terug naar een echte naam.

   scripts/afleidbaar.js beantwoordt dat als een pad door een graaf van velden die
   samen in één object staan. Dit bestand bewaakt twee dingen:

     DAT DE METER LEEST WAT ER STAAT. De eerste versie las ELKE accolade als een
     object -- ook een functielichaam en een if-blok -- en vond daardoor velden
     die `null` en `let` heten, mét een pad naar een BIG-nummer erachteraan. Een
     meter die een niet-bestaand privacylek meldt, is net zo schadelijk als een
     die een echt lek mist. Toets 1 tot en met 4 houden die reparatie vast.

     DAT DE UITKOMST NIET STIL VERSCHUIFT. Toets 7 pint welke harde
     identificatoren vandaag RECHTSTREEKS naast een codenaam staan. Komt er een
     bij, dan zakt deze toets -- en dat hoort, want dat is een besluit en geen
     detail. Toets 8 pint dat het burgerservicenummer nergens in de buurt van een
     codenaam komt.

   WAT DEZE TOETSEN NIET BEWEREN. De meter kent geen bevoegdheden. Twee van de
   zes treffers zijn de identiteitskluis zelf (die MOET beide kennen, met een
   auditregel), twee zijn te verklaren valse treffers, en twee verdienen een
   menselijk besluit. Dat handwerk staat in MAGNAATLAB.md par. 4.6; het is geen
   toets, want een toets kan het niet.

   Draai los: node --test test/afleidbaar.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../scripts/afleidbaar');

const O = (bestand, velden) => ({ bestand, velden });

test('1. een accolade die geen object is, levert geen velden op', () => {
  /* De fout die deze meter zelf maakte. Een functielichaam met een ternair
     leverde velden op die `null` heten, en een blok met `let x` een veld `let`. */
  assert.deepEqual(A.objectenIn('function f(a) { return a ? null : 1; }'), []);
  assert.deepEqual(A.objectenIn('if (x) { let iban = 1; codenaam = 2; }'), []);
  assert.deepEqual(A.objectenIn('switch (x) { case 1: break; default: break; }'), []);
});

test('2. een echt objectliteraal levert zijn velden op diepte 1', () => {
  assert.deepEqual(A.objectenIn('const r = { codenaam: c, iban: i };'), [['codenaam', 'iban']]);
  assert.deepEqual(A.objectenIn('f({ codenaam: c, iban: i })'), [['codenaam', 'iban']]);
  assert.deepEqual(A.objectenIn('return { codenaam: c, iban: i };'), [['codenaam', 'iban']]);
});

test('3. een geneste sleutel hoort bij zijn eigen object', () => {
  /* Precies het onderscheid waar scripts/capabilities.js ooit op is misgegaan.
     `iban` staat hier bij `bank` en niet bij `codenaam` -- ze reizen wel samen,
     maar via een tussenstap, en dat is het verschil tussen een lek van een stap
     en een van twee. */
  const uit = A.objectenIn('const r = { codenaam: c, bank: { iban: i, bic: b } };');
  assert.deepEqual(uit[0], ['codenaam', 'bank'], 'het buitenste object kent iban niet');
  assert.ok(uit.some(v => v.includes('iban') && !v.includes('codenaam')),
    'en het binnenste object staat er apart in');
});

test('4. een ternair binnen een object is geen veld', () => {
  const uit = A.objectenIn('const r = { codenaam: c, saldo: x ? null : 0, iban: i };');
  assert.deepEqual(uit[0], ['codenaam', 'saldo', 'iban']);
  assert.ok(!uit[0].includes('null'));
});

test('5. een rechtstreekse koppeling wordt gevonden', () => {
  const uit = A.analyse([O('a.js', ['codenaam', 'iban', 'saldoCenten'])]);
  assert.equal(uit.rechtstreeks.length, 1);
  assert.equal(uit.rechtstreeks[0].veld, 'iban');
  assert.deepEqual(uit.rechtstreeks[0].pad, ['codenaam', 'iban']);
  assert.deepEqual(uit.rechtstreeks[0].bestanden, [['a.js']], 'met het bestand erbij');
});

test('6. de vraag van punt 22: twee plekken die elk niets fout doen', () => {
  /* Geen van beide objecten toont iets ontoelaatbaars. Wie ze allebei ziet,
     koppelt een codenaam aan een kenteken. Dit is de hele bevinding die punt 22
     zoekt, en zonder deze toets kan de meter hem stil kwijtraken. */
  const uit = A.analyse([
    O('a.js', ['codenaam', 'huurRef']),
    O('b.js', ['huurRef', 'kenteken'])
  ]);
  assert.deepEqual(uit.rechtstreeks, [], 'rechtstreeks is er niets');
  assert.equal(uit.tweeStappen.length, 1);
  assert.deepEqual(uit.tweeStappen[0].pad, ['codenaam', 'huurRef', 'kenteken']);

  /* De tegenproef. Zonder gedeelde sleutel is er geen pad, en een meter die dan
     tóch iets meldt, meldt altijd iets. */
  const zonder = A.analyse([O('a.js', ['codenaam', 'huurRef']), O('b.js', ['anderRef', 'kenteken'])]);
  assert.deepEqual(zonder.tweeStappen, []);
  assert.ok(zonder.buitenBereik.some(b => b.veld === 'kenteken'), 'en zegt dat hij buiten bereik ligt');
});

test('7. een pad door een knooppunt heet een knooppunt en geen bevinding', () => {
  /* Een veld als `code` staat in honderden objecten en verbindt alles met alles.
     Dat `codenaam` en `paspoort` allebei ooit naast een `code` stonden, zegt
     niets over of het dezelfde code was. Zulke paden worden niet weggelaten en
     ook niet weggetuned -- ze staan apart, als kandidaat van de zwakste soort. */
  const objecten = [O('a.js', ['codenaam', 'code'])];
  for (let i = 0; i < 200; i++) objecten.push(O('vul' + i + '.js', ['code', 'veld' + i]));
  objecten.push(O('b.js', ['code', 'paspoort']));
  const uit = A.analyse(objecten);
  assert.equal(uit.tweeStappen.length, 0, 'niet als gewone tweestapsbevinding');
  assert.equal(uit.viaKnooppunt.length, 1);
  assert.equal(uit.viaKnooppunt[0].veld, 'paspoort');
  assert.ok(uit.viaKnooppunt[0].hoogsteGraad >= uit.knooppuntVanaf);
});

test('8. dit huis: precies deze zes staan rechtstreeks naast een codenaam', () => {
  /* DE BEWAKING. Komt er een harde identificator bij die rechtstreeks naast een
     codenaam staat, dan zakt deze toets. Dat hoort: dat is een besluit over de
     privacyopzet van dit huis en geen detail dat je onderweg neemt.

     De zes van vandaag zijn met de hand nagelopen (MAGNAATLAB.md par. 4.6):
     twee zijn de identiteitskluis zelf, twee zijn verklaarbare valse treffers,
     en twee verdienen een besluit. */
  const uit = A.meet();
  assert.deepEqual(uit.pseudoniemGevonden.sort(), ['codenaam', 'codename'],
    'allebei de schrijfwijzen zijn gevonden -- anders meet de rest niets');
  assert.ok(uit.objecten > 5000, 'de meter heeft de code werkelijk gelezen, nu: ' + uit.objecten);
  assert.deepEqual(uit.rechtstreeks.map(g => g.veld).sort(),
    ['adres', 'email', 'geboortedatum', 'iban', 'kenteken', 'phone']);
});

test('9. dit huis: een burgerservicenummer komt nergens bij een codenaam in de buurt', () => {
  /* De hardste van allemaal: het BSN is de sleutel van de overheid zelf. Hij
     staat niet in de graaf, in geen enkele stap. */
  const uit = A.meet();
  assert.ok(uit.buitenBereik.some(b => b.veld === 'bsn'),
    'bsn is vanuit een codenaam onbereikbaar');
  assert.ok(!uit.gevonden.some(g => g.veld === 'bsn'));
});
