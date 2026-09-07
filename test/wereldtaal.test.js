/* Het wereld-kernwoordenboek: ALLE talen uit het register werken ook zonder
   AI-sleutel. Geen volzin-vertaler (dat doet de AI), maar de 30
   school-kernwoorden zijn in elke taal aanwezig en compleet -- deze test is
   de bewaker: een nieuwe taal in het register MOET een kernregel krijgen.
   Draai los: node --test test/wereldtaal.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { TALEN } = require('../server/talen');
const { KERN, dictVan } = require('../server/translate/woordenboek/wereld');
const { translate } = require('../server/translate');

test('1. elke registertaal heeft een compleet kernwoordenboek (30 woorden, geen gaten)', () => {
  assert.equal(KERN.length, 30);
  for (const t of TALEN) {
    if (t.code === 'nl') continue; // Nederlands is de brontaal
    const d = dictVan(t.code);
    assert.ok(d, 'kernwoordenboek ontbreekt voor ' + t.code + ' (' + t.en + ')');
    for (const w of KERN) {
      assert.ok(d[w] && d[w].trim(), t.code + ': het kernwoord "' + w + '" ontbreekt');
    }
  }
});

test('2. een VOLLEDIGE boodschap zonder AI-sleutel: een greep uit alle windstreken', async () => {
  const gevallen = [
    ['huiswerk', 'de', 'Hausaufgaben'],
    ['school', 'sw', 'shule'],
    ['vandaag', 'uk', 'сьогодні'],
    ['leraar', 'tr', 'öğretmen'],
    ['boek', 'ar', 'كتاب'],
    ['welkom', 'ja', 'ようこそ'],
    ['bedankt', 'mi', 'ngā mihi'],
    ['huiswerk', 'hi', 'गृहकार्य']
  ];
  for (const [nl, taal, verwacht] of gevallen) {
    const r = await translate(nl, taal, 'nl');
    assert.equal(r.translated, true, nl + ' -> ' + taal + ' moet ook zonder AI vertalen');
    assert.equal(r.text.toLowerCase(), verwacht.toLowerCase(), nl + ' -> ' + taal);
  }
  // leestekens aan de rand horen niet bij de term: dit blijft een hele boodschap
  const uitroep = await translate('Welkom!', 'ja', 'nl');
  assert.equal(uitroep.translated, true, 'Welkom! is nog steeds een boodschap van een term');
  assert.match(uitroep.text, /ようこそ/, 'de term is vertaald, het leesteken blijft staan');
});

/* DE BEWAKER VAN DE NIEUWE GRENS.

   Hier stond: `translate('Morgen is er school.','sw')` moet /Kesho/ bevatten --
   "het kernwoord is herkend, de zin blijft leesbaar". Dat legde precies het
   gedrag vast dat eruit moest: een Nederlandse zin met een paar woorden
   omgewisseld, gemeld als `translated: true`. Gemeten gaf dat bijvoorbeeld
   "اليوم is de مدرسة gesloten" voor het Arabisch.

   De kleinste vertaalbare eenheid is de hele BOODSCHAP. Een zin die het
   woordenboek niet volledig dekt komt onvertaald terug, en zegt dat ook. Deze
   toets zakt zodra iemand het samenstellen uit losse woorden terugzet. */
test('4. een zin wordt NOOIT half vertaald, en meldt zichzelf niet als vertaald', async () => {
  const zin = 'Morgen is er school.';
  for (const taal of ['sw', 'ar', 'ja', 'zh', 'am', 'es', 'en']) {
    const r = await translate(zin, taal, 'nl');
    assert.equal(r.translated, false, taal + ': een half gedekte zin is geen vertaling');
    assert.equal(r.text, zin, taal + ': de brontaal blijft heel staan, nooit half omgewisseld');
  }
});

test('3. de tweetalige klasgenoot kan hiermee elke thuistaal kiezen', () => {
  // de talen uit de school-tests en nog wat verre: allemaal gedekt
  for (const code of ['en', 'uk', 'zh', 'ti', 'qu', 'to', 'dv', 'bo']) {
    assert.ok(dictVan(code), code + ' hoort erbij');
  }
});
