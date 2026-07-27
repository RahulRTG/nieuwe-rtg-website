/* Het wereld-kernwoordenboek: ALLE talen uit het register werken ook zonder
   AI-sleutel. Geen volzin-vertaler (dat doet de AI), maar de 30
   school-kernwoorden zijn in elke taal aanwezig en compleet -- deze test is
   de bewaker: een nieuwe taal in het register MOET een kernregel krijgen.
   Draai los: node --experimental-sqlite --test test/wereldtaal.test.js */
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

test('2. woord-voor-woord zonder AI-sleutel: een greep uit alle windstreken', async () => {
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
  // en in een zin blijft de rest netjes staan (demo-kwaliteit, nooit kapot)
  const zin = await translate('Morgen is er school.', 'sw', 'nl');
  assert.match(zin.text, /Kesho/i, 'het kernwoord is herkend, de zin blijft leesbaar');
});

test('3. de tweetalige klasgenoot kan hiermee elke thuistaal kiezen', () => {
  // de talen uit de school-tests en nog wat verre: allemaal gedekt
  for (const code of ['en', 'uk', 'zh', 'ti', 'qu', 'to', 'dv', 'bo']) {
    assert.ok(dictVan(code), code + ' hoort erbij');
  }
});
