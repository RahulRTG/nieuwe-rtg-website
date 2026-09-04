/* CODE-AI-001 -- DE RUNTIME-AI KOMT NOOIT AAN DE BRON.

   Dit huis heeft vandaag twee gescheiden intelligenties, en die scheiding is
   waardevoller dan hij eruitziet:

     RUNTIME  het stuur (kern/stuur/*) bestuurt RTG via capabilities. Zijn
              wereld is beleid.js + de resolver: API-paden, geen bestanden.
     BRON     de meters (scripts/*) lezen de code deterministisch en schrijven
              registers. Zij bedienen niets.

   Zodra een agent BEIDE heeft -- productie bedienen en de bron lezen -- valt de
   trust boundary weg die nu gratis bestaat. Deze toets houdt hem vast, en hij
   verklaart precies EEN uitzondering: een register lezen mag. VERTROUWEN.json
   is afgeleide, gepubliceerde waarheid; server/kern/pay/poort.js is dat niet.
   Dat onderscheid IS de invariant -- niet "geen fs".

   De grens hoort hier en niet in een document, want een document houdt niemand
   tegen die morgen `readFileSync(__dirname + '/../pay/poort.js')` schrijft. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');

/* De ingangen van de runtime-AI: wat het model kan aanroepen (gereedschap),
   wat die aanroepen afhandelt (lus), wat ze weegt (plan, beleid, resolver) en
   wat ze mag versmallen (mandaat). */
const INGANGEN = ['server/kern/stuur/lus.js', 'server/kern/stuur/gereedschap.js', 'server/kern/stuur/plan.js',
  'server/kern/stuur/resolver.js', 'server/kern/stuur/beleid.js', 'server/kern/stuur/mandaat.js',
  'server/kern/stuur/gevolg.js', 'server/kern/stuur/goedkeuring.js'];

function sluiting(start) {
  const gezien = new Set(); const rij = start.filter(f => fs.existsSync(path.join(WORTEL, f)));
  while (rij.length) {
    const rel = rij.shift(); if (gezien.has(rel)) continue; gezien.add(rel);
    const src = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    for (const m of src.matchAll(/require\((["'])(\.[^"']+)\1\)/g)) {
      let p = path.normalize(path.join(path.dirname(rel), m[2]));
      if (!p.endsWith('.js')) p += '.js';
      if (fs.existsSync(path.join(WORTEL, p))) rij.push(p);
      else { const idx = p.replace(/\.js$/, '/index.js'); if (fs.existsSync(path.join(WORTEL, idx))) rij.push(idx); }
    }
  }
  return [...gezien];
}

const MODULES = sluiting(INGANGEN);

test('1. de sluiting van het stuur leest geen broncode van schijf', () => {
  /* Een register lezen mag: dat is afgeleide waarheid die de meters al hebben
     gepubliceerd. Een .js, .html of .css lezen is bron, en die hoort deze kant
     van het huis niet te kennen -- ook niet "even, voor de uitleg". */
  const fout = [];
  for (const rel of MODULES) {
    const src = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    for (const m of src.matchAll(/read(?:File|dir)(?:Sync)?\s*\(([^)]*)\)/g)) {
      const arg = m[1];
      if (/\.json\b|JSON_|_JSON|bronPad\(\)/.test(arg)) continue;            // een register: toegestaan
      if (/\.(js|mjs|html|css)\b/.test(arg) || /['"]server['"]|['"]public['"]|__dirname\s*\+\s*['"]\/\.\./.test(arg)) {
        fout.push(rel + ': ' + m[0].slice(0, 70));
      }
    }
  }
  assert.deepStrictEqual(fout, [], 'CODE-AI-001: de runtime-AI leest bron\n' + fout.join('\n'));
});

test('2. de sluiting van het stuur raakt de bronmeters niet aan', () => {
  /* De meters (scripts/) en een toekomstig codeobservatorium zijn de ANDERE
     helft. Wie ze hiervandaan importeert, heeft de twee werelden samengevoegd
     zonder dat er een besluit over is genomen. */
  const fout = [];
  for (const rel of MODULES) {
    const src = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    for (const m of src.matchAll(/require\((["'])([^"']+)\1\)/g)) {
      const doel = m[2];
      if (/(^|\/)scripts\//.test(doel) || /codeobservatorium|codewereld/i.test(doel)) fout.push(rel + ' -> ' + doel);
    }
  }
  assert.deepStrictEqual(fout, [], 'CODE-AI-001: het stuur importeert de bronkant\n' + fout.join('\n'));
});

test('3. het model kan niet meer gereedschappen dan hier staan', () => {
  /* Een ratel, geen slot: een nieuw gereedschap MAG, maar niet ongezien. Zonder
     deze regel is de goedkoopste weg naar broncode-in-de-runtime een vierde
     tool met een onschuldige beschrijving. */
  const { TOOLS } = require('../server/kern/stuur/gereedschap');
  assert.deepStrictEqual(TOOLS.map(t => t.name).sort(), ['doe', 'kaart', 'plan'],
    'er is een gereedschap bij of af. Is het een bron-lezer? Dan hoort hij bij de Architect en niet hier.');
});
