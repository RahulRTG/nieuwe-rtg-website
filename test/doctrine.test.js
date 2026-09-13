/* ============================================================================
   DE DOCTRINECOMPILER ZELF -- kan hij zakken?

   scripts/doctrine.js telt harde uitspraken in de doctrine-documenten. Zo'n
   teller heeft een faalvorm die van buiten niet te zien is: hij vindt niets en
   staat groen, precies zoals een scanner die alles vindt. Deze toets is de
   ratel eronder (scripts/lib/metingen.js noemt hem als `eigenRatel`).

   ELKE BEWERING HIER IS EEN MUTATIE GEZIEN ZAKKEN, en die staat er per toets bij
   -- LAT.md regel 2: een toets die je niet hebt zien zakken is geen toets.

   Draai los: node --test test/doctrine.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const D = require('../scripts/doctrine.js');

/* MUTATIE GEZIEN ZAKKEN: in zelfijking() de tweede helft weggehaald (de zin
   zonder signaalwoord); toets 1 bleef groen -- daarom eist hij hieronder ook
   dat de ijking BEIDE kanten controleert, en niet alleen de vangst. */
test('1. de zelfijking van de compiler slaagt, en hij ijkt twee kanten', () => {
  const uitslag = D.zelfijking();
  assert.equal(uitslag.ok, true, 'de compiler vindt een geplante zin niet: ' + (uitslag.waarom || ''));

  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/doctrine.js'), 'utf8');
  assert.match(bron, /een zin zonder signaalwoord werd toch een kandidaat/,
    'de ijking hoort ook te controleren dat een gewone zin GEEN kandidaat wordt; ' +
    'zonder die kant is een scanner die alles vindt ook groen');
});

/* MUTATIE GEZIEN ZAKKEN: sluitAlinea() bij een lege regel weggehaald, zodat de
   alinea's aan elkaar plakken; deze toets zakte op de zinslengte. En andersom:
   de alinea-samenvoeging eruit (regel voor regel lezen) -> zakte op "eindigt op
   een leesteken", want de markdown breekt af op ongeveer 76 tekens. */
test('2. een kandidaat is een hele zin en geen afgebroken regel', () => {
  const { stukken } = D.leesDocument('FOUNDATION.md');
  const kandidaten = stukken.filter(s => {
    const sig = D.signaalVan(s.zin, s.inGrenssectie);
    return sig && sig.sterkte === 'sterk';
  });
  assert.ok(kandidaten.length >= 5, 'FOUNDATION.md draagt zeven grenzen; minder dan vijf kandidaten ' +
    'betekent dat de lezer stuk is, niet dat het document leeg is');

  for (const k of kandidaten) {
    assert.match(k.zin, /[.!?:]["'»)]?$/,
      'deze kandidaat eindigt midden in een zin, dus de alinea is niet samengevoegd: ' + JSON.stringify(k.zin.slice(-60)));
    assert.ok(k.zin.length < 700, 'deze kandidaat is zo lang dat er alinea\'s aan elkaar geplakt zijn: ' +
      JSON.stringify(k.zin.slice(0, 80)));
  }
});

/* MUTATIE GEZIEN ZAKKEN: `nooit` van STERK_IN_GRENSSECTIE naar STERK verplaatst;
   deze toets zakte op de tweede bewering, en het totaal sprong van 1088 naar
   1786 kandidaten -- de meting die de eerste versie onbruikbaar maakte. */
test('3. de context beslist mee: `nooit` is binnen een grenssectie sterk en daarbuiten niet', () => {
  const zin = 'De bijdrage-spiegel is nooit vergelijkend en toont geen enkel percentiel aan een ander lid.';
  const binnen = D.signaalVan('De eenheid van meting is de taak, nooit de persoon.', true);
  const buiten = D.signaalVan('Dat is nooit goed gegaan in de oude opzet.', false);

  assert.equal(binnen.sterkte, 'sterk', 'in een grenssectie kondigt `nooit` een grens aan');
  assert.equal(buiten.sterkte, 'zwak', 'buiten een grenssectie is `nooit` een bijwoord; telt hij daar ' +
    'als sterk, dan groeit deze lijst met gewoon schrijfwerk en leest niemand hem meer');
  assert.equal(D.signaalVan(zin, false).sterkte, 'sterk',
    '`geen enkel` is een verbodsvorm en telt overal, ook buiten een grenssectie');
});

/* MUTATIE GEZIEN ZAKKEN: in ankersPerKop() de kop-toewijzing vervangen door
   `kaart.set(0, ...)`; zakte op "LEVEN.md wijst zijn eigen wetten aan". */
test('4. een wet wordt herkend op de PLEK van zijn anker, niet op zijn woorden', () => {
  const { wetten } = require('../WETTEN.json');
  const leven = wetten.filter(w => w.bron && w.bron.bestand === 'LEVEN.md');
  assert.ok(leven.length >= 2, 'LEVEN.md hoort wetten in het register te hebben');

  const kaart = D.ankersPerKop('LEVEN.md', leven);
  const gevonden = [...kaart.values()].flat();
  assert.ok(gevonden.length >= 2,
    'geen van de LEVEN-wetten is aan een kop gekoppeld; dan heet elke kandidaat onbepaald ' +
    'en leest dat als "het register kent de doctrine niet" terwijl de koppeling stuk is');

  /* De ankers staan ALLEMAAL letterlijk in hun document (nagemeten op
     13 september 2026, 50 van 50). Valt er een weg, dan is dat een echte
     bevinding en niet een tekort van deze toets -- scripts/wetten.js --controle
     meldt hem apart. */
  for (const w of leven) {
    const tekst = fs.readFileSync(path.join(WORTEL, 'LEVEN.md'), 'utf8');
    assert.ok(tekst.includes(w.bron.anker),
      'het anker van wet ' + w.id + ' staat niet meer in LEVEN.md: ' + JSON.stringify(w.bron.anker));
  }
});

/* MUTATIE GEZIEN ZAKKEN: `graad` in de uitslag op 'gemeten' gezet; zakte hier.
   Een lexicale telling die zich gemeten noemt, is de schijnzekerheid waar
   BESTUUR.md voor is gebouwd. */
test('5. het register draagt zijn graad en zijn grens, en telt zichzelf niet als dekking', () => {
  const pad = path.join(WORTEL, 'DOCTRINE.json');
  if (!fs.existsSync(pad)) {
    assert.fail('DOCTRINE.json ontbreekt; draai `npm run doctrine`. Een ontbrekend register is ' +
      'geen groen: niet-gemeten mag nooit als in orde langskomen');
  }
  const j = JSON.parse(fs.readFileSync(pad, 'utf8'));
  assert.equal(j.graad, 'vermoed', 'deze meting leest woorden en geen betekenis; elke hardere graad is een bewering');
  assert.match(j.grens, /LEXICAAL/, 'de grens van de meting hoort in het register zelf te staan');
  assert.match(j.grens, /ONDERGRENS/, 'het getal is een ondergrens en dat hoort er te staan');

  /* Een kandidaat is geen wet. Zou dit register een stand `wet` kunnen zetten,
     dan promoveert een woordenlijst een besluit -- en dan is WETTEN.json niet
     langer de plek waar een mens de wet vaststelt. */
  const standen = new Set(j.kandidaten.map(k => k.stand));
  assert.deepEqual([...standen].sort(), ['gedekt', 'onbepaald'],
    'de enige twee standen zijn gedekt en onbepaald; "ongedekt" zou beweren dat iets niet ' +
    'gehandhaafd wordt, en dat weet een lexicale scan niet (CONTROLPLANE.md: ONBEKEND is geen WEIGEREN)');

  assert.equal(j.telling.wettenInRegister, require('../WETTEN.json').wetten.length,
    'het register loopt achter op WETTEN.json; draai `npm run doctrine` opnieuw');
});

/* MUTATIE GEZIEN ZAKKEN: de teller `overgeslagen` uit de uitslag gehaald; zakte
   hier. Een scanner die stil overslaat meldt een laag getal, en dat leest als
   goed nieuws in plaats van als een blinde vlek. */
test('6. wat is overgeslagen staat er met een reden bij', () => {
  const j = JSON.parse(fs.readFileSync(path.join(WORTEL, 'DOCTRINE.json'), 'utf8'));
  assert.ok(j.overgeslagen, 'de uitslag hoort te zeggen wat er niet is gelezen');
  assert.ok(String(j.overgeslagen.waarom || '').length > 20, 'zonder reden is een overslag een gat');
  assert.ok(j.overgeslagen.codeblokregels > 0 && j.overgeslagen.tabelregels > 0,
    'deze documenten bevatten aantoonbaar code en tabellen; nul overgeslagen regels betekent ' +
    'dat de filters niet draaien en dat er code als doctrine wordt geteld');
});
