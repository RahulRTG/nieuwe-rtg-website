'use strict';
/* ============================================================================
   DUBBELE CLASS-ATTRIBUTEN -- DE STROOM, DE LEZERRANDEN EN DE BESTANDSLIJST

   dubbeleklasse.test.js houdt de goede en valse treffers vast. Dit bestand
   toetst wat daaronder ligt: hoe stroom() een script terugbrengt tot tekst
   met DYN- en BREEK-merktekens (escapes, een quote die niet sluit, een regex
   met een tekenklasse, accolades in een ${}), de randen van de attribuutlezer
   (een waarde zonder quotes, spaties rond =, een quote die niet sluit), en
   welke bestanden bronbestanden() en meet() meetellen in een nagebouwde boom.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { dubbeleKlassen, bronbestanden, meet, stroom } = require('../scripts/lib/dubbeleklasse');

const DYN = '\u0000', BREEK = '\u0001';
const js = (s) => dubbeleKlassen(s, { soort: 'js' });

test('stroom: tekenreeksen achter elkaar, met code als DYN of BREEK', () => {
  assert.equal(stroom("'a' + x + 'b'", 0).tekst, 'a' + DYN + 'b');
  assert.equal(stroom("'a'; 'b'", 0).tekst, 'a' + BREEK + 'b', 'een ; is een statementgrens');
  assert.equal(stroom("f('a', { k: 1 }) + 'b'", 0).tekst, DYN + 'a' + BREEK + 'b', 'een { is ook een grens');
  const s = stroom("x + 'ab'", 10);
  assert.deepEqual(s.pos, [10, 15, 16], 'de posities schuiven op met de basis');
});

test('stroom: een escape in een string geeft het teken zelf, een losse quote is code', () => {
  assert.equal(stroom("'a\\'b'", 0).tekst, "a'b");
  assert.equal(stroom("'eind\\\\'", 0).tekst, 'eind\\');
  assert.equal(stroom("it's\n'x'", 0).tekst, DYN + 'x', 'een apostrof die niet op de regel sluit is geen string');
});

test('stroom: een regex met een tekenklasse of escape is code, een deling niet', () => {
  assert.equal(stroom("x = /[/\"]/g; 'a'", 0).tekst, BREEK + 'a', 'de / en " in de klasse openen niets');
  assert.equal(stroom("x = /\\//g + 'a'", 0).tekst, DYN + 'a');
  assert.equal(stroom("/a\"b/.test(s) + 'z'", 0).tekst, DYN + 'z', 'een regex aan het begin');
  assert.equal(stroom("a / 'b'", 0).tekst, DYN + 'b', 'na een naam is / een deling');
  assert.equal(stroom("x = /open\n'a'", 0).tekst, DYN + 'a', 'een regex die niet op de regel sluit is gewoon code');
});

test('stroom: een template met escapes, en een ${} met accolades erin', () => {
  assert.equal(stroom('`a\\`b`', 0).tekst, 'a`b');
  assert.equal(stroom('`<p ${ {a: 1}.a } x>`', 0).tekst, '<p ' + BREEK + ' x>',
    'de binnenste {} sluit de expressie niet, en code met een { erin is een grens');
  assert.equal(stroom('`${a}`', 0).tekst, DYN);
  assert.equal(stroom('`open', 0).tekst, 'open', 'een template zonder einde loopt tot het eind');
  assert.equal(stroom('}', 0).tekst, BREEK, 'een losse } buiten een expressie is code');
});

test('elementen: een waarde zonder quotes en spaties rond = zijn ook attributen', () => {
  const t = js("x = '<td class=a  class = \"b\">';");
  assert.equal(t.length, 1);
  assert.deepEqual(t[0].klassen.map((k) => k.waarde), [null, 'b'], 'een waarde zonder quotes heeft geen vaste waarde');
  assert.equal(js("x = '<td class=a class=b>';").length, 1);
});

test('elementen: geen treffer op wat geen tag is of nooit sluit', () => {
  assert.deepEqual(js("x = '<1 class=\"a\" class=\"b\">';"), [], 'een tag begint met een letter');
  assert.deepEqual(js("x = '<p class=\"a\" class=\"b\"';"), [], 'een tag zonder > is geen element');
  assert.deepEqual(js("x = '<p class=\"a\" <b class=\"c\">';"), [], 'een nieuwe < stopt het element');
  assert.deepEqual(js("x = '<p class=\"open class=\"b\">';"), [], 'een waarde die niet sluit, stopt het lezen');
  assert.deepEqual(js("x = '<p \"los\" = class=\"a\">';"), [], 'losse quote- en =-tekens worden overgeslagen');
  assert.equal(js("x = '<p \"los\" class=\"a\" class=\"b\">';").length, 1);
});

test('dubbeleKlassen zonder opties leest als JavaScript, en een treffer zonder newline krijgt het fragment tot het eind', () => {
  const t = dubbeleKlassen("x='<i class=\"a\" class=\"b\">'");
  assert.equal(t.length, 1);
  assert.equal(t[0].regel, 1);
  assert.equal(t[0].fragment, '<i class="a" class="b">\'');
  assert.deepEqual(dubbeleKlassen(Buffer.from("'<i class=\"a\" class=\"b\">'")).map((x) => x.tag), ['i'], 'de bron wordt tekst');
});

test('bronbestanden: public en server, plus de voordeur; geen dist, node_modules, data of bundels', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dubbel-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const zet = (rel, inhoud) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), inhoud); };
  const DUBBEL = '<p class="a" class="b"></p>';
  zet('public/apps/x.html', DUBBEL);
  zet('public/apps/y.js', "h = '<b class=\"a\" class=\"b\">';");
  zet('public/apps/z.mjs', "h = '<b class=\"a\">';");
  zet('public/apps/plaatje.svg', DUBBEL);
  zet('public/dist/bundel.js', "h = '<b class=\"a\" class=\"b\">';");
  zet('public/node_modules/p/i.js', "h = '<b class=\"a\" class=\"b\">';");
  zet('public/shared/rtg-schil.js', "h = '<b class=\"a\" class=\"b\">';");
  zet('server/data/x.js', "h = '<b class=\"a\" class=\"b\">';");
  zet('server/route.js', 'const x = 1;');
  const zonderVoordeur = bronbestanden(root).map((f) => path.relative(root, f));
  assert.deepEqual(zonderVoordeur, ['public/apps/x.html', 'public/apps/y.js', 'public/apps/z.mjs', 'server/route.js']);
  zet('index.html', DUBBEL);
  assert.ok(bronbestanden(root).includes(path.join(root, 'index.html')));

  const m = meet(root);
  assert.deepEqual(Object.keys(m).sort(), ['index.html', 'public/apps/x.html', 'public/apps/y.js']);
  assert.equal(m['public/apps/y.js'][0].tag, 'b');
  assert.equal(m['index.html'][0].tag, 'p');
});
