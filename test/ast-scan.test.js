/* Test voor de zelfgebouwde AST-scanner (scripts/ast/* + scripts/ast-scan.js).
   Drie soorten borging:
   1. De parser bouwt de juiste boom voor lastige moderne constructies (zonder
      externe parser, puur vaste verwachtingen).
   2. Elke regel vuurt op foute code en zwijgt op goede code.
   3. Dekking: de parser leest ELK .js-bestand in server/ en scripts/ zonder fout.
      Onparseerbare code is een harde bevinding, geen stille overslag -- dat is
      de veiligheidsgarantie van de scanner. */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { parse } = require('../scripts/ast/parser');
const { loop } = require('../scripts/ast/walk');
const { scanBron, jsBestanden, scanBestand } = require('../scripts/ast-scan');

function eersteVan(bron, type) {
  let gevonden = null;
  loop(parse(bron), (n) => { if (!gevonden && n.type === type) gevonden = n; });
  return gevonden;
}
function tel(bron, type) { let n = 0; loop(parse(bron), (x) => { if (x.type === type) n++; }); return n; }
const regelsVan = (bron) => scanBron(bron).map(v => v.regel);

/* ---------- 1. parser bouwt de juiste boom ---------- */
test('pijl-functie met destructuring en default', () => {
  const arr = eersteVan('const f = ({a, b = 2}, ...rest) => a + b;', 'ArrowFunctionExpression');
  assert.ok(arr, 'arrow herkend');
  assert.strictEqual(arr.params.length, 2);
  assert.strictEqual(arr.params[0].type, 'ObjectPattern');
  assert.strictEqual(arr.params[1].type, 'RestElement');
  assert.strictEqual(arr.expression, true, 'expressielijf');
});

test('optional chaining en nullish zijn aparte knopen', () => {
  const mem = eersteVan('const x = a?.b?.c ?? d;', 'MemberExpression');
  assert.strictEqual(mem.optional, true, '?. markeert optional');
  const log = eersteVan('const x = a ?? b;', 'LogicalExpression');
  assert.strictEqual(log.operator, '??');
});

test('template-literal met ingebedde expressie parseert de expressie mee', () => {
  const t = eersteVan('const s = `hoi ${naam.slice(0, 3)} nr ${1 + 2}`;', 'TemplateLiteral');
  assert.strictEqual(t.expressions.length, 2);
  assert.strictEqual(t.expressions[0].type, 'CallExpression');
  assert.strictEqual(t.expressions[1].type, 'BinaryExpression');
  assert.strictEqual(t.quasis.length, 3);
});

test('async-methode, klasse met #prive-veld en get/set', () => {
  const bron = 'class A extends B { #x = 1; static s = 2; get y(){return this.#x;} async doe(){ await f(); } }';
  assert.strictEqual(tel(bron, 'PropertyDefinition'), 2);
  const m = eersteVan(bron, 'MethodDefinition');
  assert.ok(m);
  assert.strictEqual(tel(bron, 'AwaitExpression'), 1);
});

test('operator-voorrang: a + b * c wordt a + (b*c)', () => {
  const top = eersteVan('x = a + b * c;', 'BinaryExpression');
  assert.strictEqual(top.operator, '+');
  assert.strictEqual(top.right.type, 'BinaryExpression');
  assert.strictEqual(top.right.operator, '*');
});

test('regex vs. deling: /re/ is een literal, a/b is deling', () => {
  const re = eersteVan('const r = /ab+c/gi;', 'Literal');
  assert.strictEqual(re.kind, 'regex');
  const deel = eersteVan('const q = a / b / c;', 'BinaryExpression');
  assert.strictEqual(deel.operator, '/');
});

/* ---------- 2. regels vuren op fout, zwijgen op goed ---------- */
test('verboden-pakket: require van web-push/express-rate-limit wordt afgekeurd', () => {
  assert.ok(regelsVan("const w = require('web-push');").includes('verboden-pakket'));
  assert.ok(regelsVan("const r = require('express-rate-limit');").includes('verboden-pakket'));
  assert.ok(!regelsVan("const c = require('crypto');").includes('verboden-pakket'), 'gewone require is prima');
});

test('geen-eval: eval en new Function worden afgekeurd', () => {
  assert.ok(regelsVan('eval(x);').includes('geen-eval'));
  assert.ok(regelsVan('const f = new Function("a", "return a");').includes('geen-eval'));
  assert.ok(!regelsVan('const f = fn(x);').includes('geen-eval'));
});

test('math-random-geheim: alleen als het een geheim voedt', () => {
  assert.ok(regelsVan('const token = Math.random().toString(36);').includes('math-random-geheim'), 'token = geheim');
  assert.ok(regelsVan('const sessieSleutel = "" + Math.random();').includes('math-random-geheim'));
  assert.ok(!regelsVan('const tip = TIPS[Math.floor(Math.random() * TIPS.length)];').includes('math-random-geheim'), 'niet-geheim blijft schoon');
});

test('onbereikbare-code: statement na return in hetzelfde blok', () => {
  assert.ok(regelsVan('function f(){ return 1; doeIets(); }').includes('onbereikbare-code'));
  assert.ok(!regelsVan('function f(){ if (a) return 1; doeIets(); }').includes('onbereikbare-code'), 'na een if-return niet');
  assert.ok(!regelsVan('function f(){ return g(); function g(){return 1;} }').includes('onbereikbare-code'), 'gehoiste functie telt niet');
});

test('dubbele-objectsleutel: waarschuwing, get/set-paar niet', () => {
  assert.ok(regelsVan('const o = { a: 1, b: 2, a: 3 };').includes('dubbele-objectsleutel'));
  assert.ok(!regelsVan('const o = { get x(){return 1;}, set x(v){} };').includes('dubbele-objectsleutel'), 'get+set mag');
});

/* ---------- 3. fail-loud + dekking ---------- */
test('onparseerbare code geeft een harde bevinding (nooit stil overslaan)', () => {
  const bev = scanBron('const x = = ;');
  assert.strictEqual(bev.length, 1);
  assert.strictEqual(bev[0].ernst, 'fout');
  assert.strictEqual(bev[0].regel, 'niet-parseerbaar');
});

test('dekking: elk .js-bestand in server/ en scripts/ parseert zonder fout', () => {
  const cwd = process.cwd();
  const bestanden = [...jsBestanden(path.join(cwd, 'server')), ...jsBestanden(path.join(cwd, 'scripts'))];
  assert.ok(bestanden.length > 400, 'we scannen de echte boom (' + bestanden.length + ' bestanden)');
  const onparseerbaar = [];
  for (const b of bestanden) {
    for (const v of scanBestand(b)) if (v.regel === 'niet-parseerbaar') onparseerbaar.push(path.relative(cwd, b) + ': ' + v.bericht);
  }
  assert.deepStrictEqual(onparseerbaar, [], 'de parser hoort de hele codebase aan te kunnen');
});
