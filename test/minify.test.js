/* Test voor de eigen minifier (scripts/ast/minify.js + print.js), die terser
   verving. Kern: de minifier levert NOOIT iets uit dat een andere boom oplevert
   dan de bron -- klopt de geprinte code niet exact, dan valt hij terug op de
   bron. En hij maakt de echte frontend meetbaar kleiner. */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { parse } = require('../scripts/ast/parser');
const { loop } = require('../scripts/ast/walk');
const { minify, minifyCode } = require('../scripts/ast/minify');
const { bundels } = require('../scripts/bundel');

function vorm(boom) { const h = {}; loop(boom, (n) => { h[n.type] = (h[n.type] || 0) + 1; }); return h; }
function zelfdeBoom(a, b) {
  const ha = vorm(parse(a)), hb = vorm(parse(b));
  const ks = new Set([...Object.keys(ha), ...Object.keys(hb)]);
  for (const k of ks) if ((ha[k] || 0) !== (hb[k] || 0)) return false;
  return true;
}

test('minify maakt kleiner en behoudt exact dezelfde boom', () => {
  const proeven = [
    'function f(a, b) {\n  // commentaar\n  return a + b;\n}',
    'const g = (x) => ({ a: x, b: x + 1 });',
    'const h = c => ({ "&": "&amp;", "<": "&lt;" })[c];',   // arrow -> object via [] (de valkuil)
    'class A extends B { #x = 1; get y() { return this.#x; } async doe() { await f(); } }',
    'const s = `hoi ${naam.slice(0, 3)} en ${1 + 2 * 3}`;',
    'for (const x of lijst) { if (x > 0) continue; doe(x); }',
    'const t = a ? b : c ?? d;'
  ];
  for (const bron of proeven) {
    const min = minifyCode(bron);
    assert.ok(min.length <= bron.length, 'niet groter: ' + JSON.stringify(bron.slice(0, 30)));
    assert.ok(zelfdeBoom(bron, min), 'zelfde boom voor: ' + JSON.stringify(bron.slice(0, 40)) + ' -> ' + JSON.stringify(min.slice(0, 60)));
  }
});

test('onparseerbare code wordt onaangeraakt teruggegeven (vangnet)', () => {
  const rommel = 'dit is <geen> geldige js {{{';
  assert.strictEqual(minifyCode(rommel), rommel);
  assert.strictEqual(minify(rommel).code, rommel);
});

test('minify levert nooit iets kapots: elke serveerbare frontend-JS blijft dezelfde boom en wordt netto kleiner', () => {
  const PUB = path.join(process.cwd(), 'public');
  const DEEL = new Set(Object.values(bundels).map(m => path.join(PUB, m)));
  const files = [];
  (function ga(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); const st = fs.statSync(p); if (st.isDirectory()) { if (n === 'dist' || DEEL.has(p)) continue; ga(p); } else if (n.endsWith('.js') && n !== 'sw.js') files.push(p); } })(PUB);
  assert.ok(files.length > 20, 'we minificeren de echte frontend (' + files.length + ' bestanden)');
  let bron = 0, min = 0;
  for (const f of files) {
    const c = fs.readFileSync(f, 'utf8');
    const m = minifyCode(c);
    assert.ok(zelfdeBoom(c, m), 'zelfde boom na minify: ' + path.relative(PUB, f)); // NB: geldt ook bij terugval
    bron += c.length; min += m.length;
  }
  assert.ok(min < bron * 0.9, 'de frontend wordt echt kleiner (' + Math.round((1 - min / bron) * 100) + '% kleiner, niet louter terugval)');
});
