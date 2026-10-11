/* TWEE CLASS-ATTRIBUTEN OP EEN ELEMENT: DE DETECTOR.

   scripts/lib/dubbeleklasse.js beantwoordt voor keuringsregel 76 of een
   element meer dan een class-attribuut draagt -- het tweede leest de browser
   niet, en op 6 oktober 2026 verdween daardoor opmaak op 188 plekken.

   Deze toets houdt de goede EN de valse treffers vast. Een detector die alleen
   op de goede wordt getoetst, wordt op een dag een `grep class=` die alles
   aanwijst; een die alleen op de valse wordt getoetst, vindt niets meer. Beide
   kanten staan hier, elk met de vorm die in dit huis echt voorkomt: HTML die in
   JavaScript wordt samengesteld met `+`, met een `${}`, en met een regex in een
   attribuutwaarde.

   Draai los: node --test test/dubbeleklasse.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { dubbeleKlassen } = require('../scripts/lib/dubbeleklasse');

const js = (s) => dubbeleKlassen(s, { soort: 'js' });
const html = (s) => dubbeleKlassen(s, { soort: 'html' });

test('markup: twee class-attributen op een element is een treffer, met regel en kolom', () => {
  const t = html('<main>\n  <p class="a" id="x" class="b">tekst</p>\n</main>');
  assert.equal(t.length, 1);
  assert.equal(t[0].tag, 'p');
  assert.equal(t[0].aantal, 2);
  assert.equal(t[0].regel, 2);
  assert.equal(t[0].kolom, 3);
});

test('markup: de volgorde van de attributen doet er niet toe, en drie is ook een treffer', () => {
  assert.equal(html('<div id="x" class="a" hidden class="b"></div>').length, 1);
  assert.equal(html('<div class="a"\n     data-x="1"\n     class="b"></div>').length, 1, 'over regels heen');
  assert.equal(html('<div CLASS="a" class="b"></div>').length, 1, 'een attribuutnaam is hoofdletterongevoelig');
  assert.equal(html('<i class="a" class="b" class="c"></i>')[0].aantal, 3);
});

test('markup: geen treffer op wat geen tweede class-ATTRIBUUT is', () => {
  assert.deepEqual(html('<div class="a" data-class="b"></div>'), [], 'data-class is een ander attribuut');
  assert.deepEqual(html('<div data-class="a" aria-class="b" class="c"></div>'), []);
  assert.deepEqual(html('<p class="a">schrijf class="b" in je code</p>'), [], 'class= in de tekst is geen attribuut');
  assert.deepEqual(html('<p title="class=&quot;x&quot;" class="a">x</p>'), [], 'class= in een attribuutwaarde');
  assert.deepEqual(html('<p class="a"></p><p class="b"></p>'), [], 'twee elementen met elk een class');
  assert.deepEqual(html('<!-- <p class="a" class="b"> --><p class="c"></p>'), [], 'HTML-commentaar telt niet');
});

test('markup en script in een pagina: een <script> wordt als JavaScript gelezen', () => {
  const t = html('<p class="a"></p>\n<script>\n  el.innerHTML = \'<b class="x" class="y">\';\n</script>');
  assert.equal(t.length, 1);
  assert.equal(t[0].tag, 'b');
  assert.equal(t[0].regel, 3);
});

test('JavaScript: een element dat met + wordt samengesteld', () => {
  const t = js("h += '<input class=\"st-in\" id=\"' + esc(id) + '\" placeholder=\"' + T('x', 'Naam') + '\" class=\"h-flex1\">';");
  assert.equal(t.length, 1);
  assert.equal(t[0].tag, 'input');
  /* Over meerdere regels en meerdere strings: de vorm van appstore-uitgever. */
  assert.equal(js("h += '<input class=\"veld\" '+\n  'id=\"a\" class=\"vol\">';").length, 1);
});

test('JavaScript: een template literal, met ${} in en tussen de attributen', () => {
  assert.equal(js('const h = `<div class="a" data-id="${x.id}" class="b">`;').length, 1);
  assert.deepEqual(js('const h = `<div class="a ${open ? \'open\' : \'\'}" data-id="${x.id}">`;'), [],
    'een voorwaardelijke WAARDE in een class is een attribuut');
  assert.equal(js('const h = `<ul class="l">${xs.map(x => `<li class="a" class="b">${x}</li>`).join(\'\')}</ul>`;').length, 1,
    'een template binnen een template');
});

test('JavaScript: een regex met een quote in een attribuutwaarde opent geen string', () => {
  /* De vorm uit leverancier-19.js: zonder regexherkenning opende de " in /"/g
     een string die de rest van de regel opat, en verdween de treffer. */
  const bron = "h += '<input class=\"st-in\" value=\"' + q.replace(/\"/g, '&quot;') + '\" class=\"h-flex1\">';";
  assert.equal(js(bron).length, 1);
});

test('JavaScript: geen treffer op wat geen element met twee class-attributen is', () => {
  assert.deepEqual(js("h += '<input class=\"st-in h-flex1\" id=\"x\">';"), [], 'een samengevoegde class');
  assert.deepEqual(js("el.className = 'a'; el.setAttribute('class', 'b');"), [], 'class buiten een tag');
  assert.deepEqual(js("h += '<div class=\"a\" data-class=\"b\">';"), []);
  assert.deepEqual(js("// '<p class=\"a\" class=\"b\">'\nconst x = 1;"), [], 'commentaar telt niet');
  assert.deepEqual(js("/* '<p class=\"a\" class=\"b\">' */"), []);
  /* Twee strings in twee statements zijn geen element: een tag die bij een ;
     nog openstaat, wordt losgelaten in plaats van aan de volgende geplakt. */
  assert.deepEqual(js("const a = '<div class=\"a\"';\nconst b = 'class=\"b\">';"), []);
  assert.deepEqual(js("if (a < b) x = '<p class=\"a\">'; else y = '<p class=\"b\">';"), [],
    'een vergelijking met < is geen element');
});

test('de treffer draagt per class-attribuut zijn plek en waarde, zodat er samengevoegd kan worden', () => {
  const bron = 'x = \'<a class="k stil" href="/x" class="as-link">\';';
  const [t] = js(bron);
  assert.deepEqual(t.klassen.map(k => bron.slice(k.begin, k.eind)), ['class="k stil"', 'class="as-link"']);
  assert.deepEqual(t.klassen.map(k => k.waarde), ['k stil', 'as-link']);
  /* Code in de waarde: de waarde is dan niet vast te stellen en heet null. */
  const [d] = js("x = '<a class=\"' + c + '\" class=\"b\">';");
  assert.equal(d.klassen[0].waarde, null);
});
