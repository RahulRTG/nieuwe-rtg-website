/* Syntaxbewaking op de inline scripts van elke pagina.

   Waarom dit bestaat: de apps van RTG dragen hun JavaScript in een groot
   inline `<script>`-blok. Een syntaxfout daarin sloopt de HELE pagina -- geen
   knop doet het meer -- en geen enkele toets zag dat. De servertoetsen praten
   met de API en raken de HTML niet aan; de drifttoetsen knippen er een losse
   functie uit en parsen dus juist niet het geheel. Een pagina kon daardoor
   stuk gaan zonder dat er iets rood werd.

   Wat hij WEL doet: elk inline scriptblok van elke pagina onder `public/` door
   de parser van Node halen, plus JSON-blokken door `JSON.parse`. Wat hij NIET
   doet: iets zeggen over wat de code betekent -- alleen dat de browser hem kan
   lezen. Dat is precies de klasse fout waar het om gaat.

   Draai los: node --test test/paginascripts.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEBROOT = path.join(__dirname, '..', 'public');

function paginas(map, uit = []) {
  for (const e of fs.readdirSync(map, { withFileTypes: true })) {
    const p = path.join(map, e.name);
    if (e.isDirectory()) paginas(p, uit);
    else if (e.name.endsWith('.html')) uit.push(p);
  }
  return uit;
}

// elk inline blok van een pagina: { type, code, regel }
function blokkenVan(html) {
  const uit = [];
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attr = m[1] || '', code = m[2];
    if (/\bsrc=/.test(attr) || !code.trim()) continue; // externe of lege blokken
    const type = (/type\s*=\s*["']([^"']+)/.exec(attr) || [])[1] || 'text/javascript';
    uit.push({ type, code, regel: html.slice(0, m.index).split('\n').length });
  }
  return uit;
}

const ALLE = paginas(WEBROOT);

test('elke pagina heeft leesbaar JavaScript in zijn inline scripts', () => {
  const stuk = [];
  let geteld = 0;
  for (const p of ALLE) {
    for (const b of blokkenVan(fs.readFileSync(p, 'utf8'))) {
      const naam = path.relative(WEBROOT, p) + ':' + b.regel;
      geteld++;
      try {
        if (/json/.test(b.type)) JSON.parse(b.code);
        else if (/module/.test(b.type)) {
          /* Er staat vandaag geen enkele `type="module"` in de webroot, dus
             die tak is nooit gelopen. Hem stil doorlaten zou betekenen dat de
             eerste module die iemand toevoegt ongecontroleerd blijft -- precies
             het gat dat deze toets dicht moet houden. Dus: luid stoppen, met
             wat er moet gebeuren. `vm.SourceTextModule` kan het parsen, maar
             vraagt --experimental-vm-modules en dat draait de suite niet. */
          stuk.push(naam + ' -> type="module" wordt hier nog niet geparst. ' +
            'Breid deze toets uit (vm.SourceTextModule met --experimental-vm-modules) voor je er een toevoegt.');
        } else new vm.Script(b.code);
      } catch (e) {
        stuk.push(naam + ' -> ' + e.message);
      }
    }
  }
  assert.deepEqual(stuk, [], 'deze pagina\'s laden hun script niet:\n  ' + stuk.join('\n  '));
  /* Een toets die niets vindt is geen toets: raakt de scanner zijn pagina's
     kwijt (verplaatste webroot, gewijzigde <script>-vorm), dan zou hij stil
     groen blijven en niets meer bewaken. */
  assert.ok(geteld > 150, 'er horen ruim honderdvijftig inline scriptblokken te zijn, gevonden: ' + geteld);
});

test('de scanner kijkt echt naar de hele webroot', () => {
  assert.ok(ALLE.length > 200, 'er horen ruim tweehonderd pagina\'s te staan, gevonden: ' + ALLE.length);
  /* Een greep uit de drie mappen waar ze staan (141 in apps/, 68 in
     apps/foundation/, en site/). Zo valt het op als de scan een hele tak
     kwijtraakt in plaats van alleen een los bestand. */
  for (const p of ['apps/spelen.html', 'apps/foundation/arena.html', 'site/404.html'])
    assert.ok(ALLE.includes(path.join(WEBROOT, p)), p + ' hoort meegescand te worden');
});
