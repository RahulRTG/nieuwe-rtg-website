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
const { blindIn, blindInHtml, blindInCss, stukken } = require('../scripts/lib/bronblind.js');
const { zonderCommentaar } = require('../scripts/lib/bron.js');

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

test('DE VALSTRIK IS DICHT: een commentaarteken in MARKUPTEKST blijft staan', () => {
  /* Dit stond hier als "de valstrik staat open maar niet onbewaakt":
     scripts/lib/bron.js kende geen HTML en haalde overal blokcommentaar weg,
     ook buiten een <script> -- waar het helemaal geen commentaar is maar tekst
     die een bezoeker leest. Geen enkele pagina deed dat, dus het was een
     latente blindheid, en de kruisproef zou hem betrappen.

     Op 3 september 2026 is hij DICHT (TAKEN.md 4.48): zonderCommentaar() kent
     nu een soort, en de standaard blijft JavaScript zodat geen enkele
     bestaande aanroeper iets anders leest dan eerst.

     Deze toets bewaakt nu beide kanten. De markuptekst blijft staan -- en de
     kruisproef ziet het nog steeds zodra een verwijderaar hem toch opeet, want
     dat is het vangnet dat op 17 augustus ontbrak. */
  const bron = '<p>slot A</p>\n<div>/* dit is tekst, geen commentaar */</div>\n<p>slot B</p>';
  assert.match(zonderCommentaar(bron, { soort: 'html' }), /dit is tekst, geen commentaar/,
    'markuptekst hoort onaangeraakt te blijven');
  assert.equal(blindInHtml(bron).kwijt, 0);

  /* En het vangnet: een verwijderaar die de soort NEGEERT -- precies wat de
     oude deed -- wordt nog altijd betrapt. */
  const blindeStrip = (b) => zonderCommentaar(b);
  assert.ok(blindInHtml(bron, blindeStrip).kwijt > 0,
    'de kruisproef merkt niet meer dat er markup verdwijnt; dan is het vangnet weg');
  assert.match(blindInHtml(bron, blindeStrip).eerste, /dit is tekst/);
});

test('CSS: `//` is daar geen commentaar, en de proef ziet het wanneer het toch weggaat', () => {
  /* De tweede helft van 4.48. `url(//static.example/x.png)` is een geldige
     verwijzing; de uitzondering voor `http://` dekt hem niet, want het teken
     ervoor is een haakje. Geen van de 72 stylesheets bevat hem vandaag -- dus
     dit is dezelfde soort latente blindheid als hierboven, en hij is nu op
     dezelfde manier dicht. */
  const css = '.a{background:url(//static.example/x.png);}\n/* echt commentaar */\n.b{color:red}\n';
  const uit = zonderCommentaar(css, { soort: 'css' });
  assert.match(uit, /url\(\/\/static\.example/, 'de verwijzing hoort te blijven staan');
  assert.doesNotMatch(uit, /echt commentaar/, 'een blokcommentaar in CSS mag wel weg');
  assert.equal(blindInCss(css).kwijt, 0);

  const blindeStrip = (b) => zonderCommentaar(b);
  const betrapt = blindInCss(css, blindeStrip);
  assert.equal(betrapt.kwijt, 1, 'de proef ziet niet dat de hele regel verdwijnt');
  assert.match(betrapt.eerste, /static\.example/);
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
