/* DE KRUISPROEF OP DE COMMENTAAR-VERWIJDERAAR.

   scripts/lib/bronblind.js kruist scripts/lib/bron.js met een tweede mening:
   voor JavaScript de lexer van de AST-scanner, voor een pagina de eis dat
   markup helemaal niet aangeraakt wordt. De meter `bronBlindeBestanden` in
   NORM.json telt wat er misgaat en staat op 0.

   Waarom die tweede mening er is: op 17 augustus 2026 at bron.js 224.031 tekens
   broncode op zonder dat een enkele teller afweek. test/bron.test.js bewaakt
   sindsdien de vijf vormen die dat opleverden, maar dat is een lijst van BEKENDE
   gevallen. Deze proef kent de taal en vindt dus ook de zesde.

   Draai los: node --experimental-sqlite --test test/bronblind.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { blindIn, blindInHtml, stukken } = require('../scripts/lib/bronblind.js');

/* De verwijderaar zoals hij tot 17 augustus 2026 was: twee regexen die niet
   weten waar een string staat. Elke bewering hieronder gebruikt hem als
   bekend-foute invoer -- dat is wat een proef tot een proef maakt. */
const kapot = (b) => String(b)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

test('een MIME-joker in een string kost geen code meer, en kostte dat wel', () => {
  const bron = "const a = 'image/*';\n/* een gewoon commentaar */\nconst blijft = 2;\n";
  assert.equal(blindIn(bron).kwijt, 0, 'met de gerepareerde verwijderaar raakt er niets kwijt');
  const toen = blindIn(bron, kapot);
  assert.ok(toen.kwijt > 0, 'met die van voor de reparatie wel');
  assert.match(toen.eerste, /image/, 'en het eerste dat kwijtraakt is de joker zelf');
});

test('onleesbare bron is geen bevinding maar een lexfout, en telt apart', () => {
  const r = blindIn("const a = 'nooit gesloten\n");
  assert.equal(r.lexfout, true, 'een niet-afgesloten string breekt de lexer');
  assert.equal(r.kwijt, 0, 'en dan is er over de rest niets te zeggen');
});

test('een pagina: markup blijft, en CSS-commentaar in een <style> mag weg', () => {
  const bron = [
    '<input type="file" accept="image/*">',
    '<style>', '  /* rood, want waarschuwing */', '  .x{color:red}', '</style>',
    '<p>Alle pagina\'s van dit huis</p>',
    '<script>', 'const telefoon = 1;', '/* een gewoon commentaar */', 'const blijft = 2;', '</scr' + 'ipt>',
    '<footer>slot</footer>'
  ].join('\n');
  assert.equal(blindInHtml(bron).kwijt, 0, 'niets uit de markup en niets uit het script raakt kwijt');
});

test('EN DIT IS HET GEVAL VAN 17 AUGUSTUS: de joker eet vooruit, tot in het script', () => {
  const bron = [
    '<input type="file" accept="image/*">',
    '<p>tussenliggende markup</p>',
    '<script>', 'const telefoon = 1;', '/* een gewoon commentaar */', 'const blijft = 2;', '</scr' + 'ipt>'
  ].join('\n');
  const toen = blindInHtml(bron, kapot);
  assert.ok(toen.kwijt > 0, 'de kapotte verwijderaar raakt hier bron kwijt');
  assert.equal(blindInHtml(bron).kwijt, 0, 'en de gerepareerde niet');
});

test('een pagina ZONDER script of style wordt ook nagelopen', () => {
  /* Hier zat een gat in deze proef zelf: een vroege uitstap sloeg zo n pagina
     over, terwijl juist die geen tweede net heeft. */
  const bron = '<p>een pagina met alleen markup</p>\n<div>gewone tekst</div>\n<p>slot</p>';
  assert.equal(blindInHtml(bron).kwijt, 0, 'gewone markup blijft staan');
});

test('DE VALSTRIK DIE OPENSTAAT: een commentaarteken in MARKUPTEKST wordt wel opgegeten', () => {
  /* scripts/lib/bron.js kent geen HTML. Hij haalt overal blokcommentaar weg,
     ook buiten een <script> -- en daar is het helemaal geen commentaar maar
     tekst die een bezoeker leest.

     VANDAAG DOET GEEN ENKELE PAGINA DAT: over alle 259 pagina's raakt er nul
     markup kwijt, dus dit is een latente blindheid en geen actieve. Hem
     repareren zou betekenen dat zonderCommentaar() moet weten of hij HTML of
     JavaScript leest, en die functie krijgt alleen een string binnen -- dat
     raakt vijf keuringen tegelijk en hoort een eigen ronde te zijn.

     Wat deze toets vastlegt is dat de kruisproef hem WEL ziet. Schrijft iemand
     zo n tekst, dan gaat bronBlindeBestanden boven nul en zakt de ratel. De
     valstrik staat dus open, maar niet onbewaakt -- en dat is precies wat er
     op 17 augustus ontbrak. */
  const bron = '<p>slot A</p>\n<div>/* dit is tekst, geen commentaar */</div>\n<p>slot B</p>';
  assert.ok(blindInHtml(bron).kwijt > 0,
    'de kruisproef merkt dat er markup verdwijnt -- dat is het vangnet onder deze blindheid');
  assert.match(blindInHtml(bron).eerste, /dit is tekst/);
});

test('de verdeling knipt op script en style, en laat de rest markup', () => {
  const delen = stukken('<a>een</a><style>.x{}</style><b>twee</b><script>code()</scr' + 'ipt><i>drie</i>');
  assert.deepEqual(delen.map(d => d.soort), [null, 'style', null, 'script', null],
    'markup, style, markup, script, markup -- in documentvolgorde');
  assert.match(delen[1].tekst, /\.x\{\}/);
  assert.match(delen[3].tekst, /code\(\)/);
});

/* DE TEGENPROEF OP DE ZEEF ZELF. Zonder deze zou een blindIn() die altijd 0
   teruggeeft alle beweringen hierboven laten slagen die op 0 toetsen. */
test('DE TEGENPROEF: de zeef geeft niet overal nul terug', () => {
  const bron = "const a = 'image/*';\n/* sluiter */\nconst b = 2;\n";
  assert.notEqual(blindIn(bron, kapot).kwijt, 0, 'op bekend-foute invoer hoort hij uit te slaan');
  assert.equal(blindIn('const a = 1;\n').kwijt, 0, 'en op gewone code niet');
});
