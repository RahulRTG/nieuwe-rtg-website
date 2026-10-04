'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { bereiken, muteerHtml, geldigeScripts, OPERATOREN_HTML } = require('../scripts/lib/mutatie-html');
const { muteer, OPERATOREN } = require('../scripts/mutatie');
const keer = OPERATOREN.find(o => o.naam === 'voorwaarde-omkeren');

test('HTML-mutatie raakt alleen uitvoerbare inlinecode, ook bij meerdere scripts', () => {
  const voor = '<!-- <script>if (!fout) bad()</script> --><textarea><script>if (!tekst) bad()</script></textarea>' +
    '<script type="application/json">{"tekst":"if (!json)"}</script><script src="extern.js"></script>' +
    '<script>if (!eerste) resultaat=1;</script ><script>if (!tweede) resultaat=2;</script>';
  const na = muteerHtml(voor, keer, 1, muteer);
  assert.equal(na, voor.replace('if (!tweede)', 'if (tweede)'));
  assert.equal(geldigeScripts(na), true);
  assert.equal(muteerHtml(voor, keer, 2, muteer), null);
  const scripts = bereiken(na).scripts.map(p => na.slice(p.start, p.eind));
  assert.equal(scripts.length, 2);
  const vm = require('node:vm'), context = { eerste: true, tweede: true };
  vm.runInNewContext(scripts.join('\n'), context);
  assert.equal(context.resultaat, 2, 'de omgekeerde tweede tak voert echt uit');
});

test('een syntaxisfout telt niet als een inhoudelijk gevonden schermfout', () => {
  assert.equal(geldigeScripts('<script>if (!klaar) {</script>'), false);
  assert.equal(geldigeScripts('<script>const n=2;</script>'), true);
  assert.equal(geldigeScripts('<script type="application/json">{"tekst":"{"}</script>'), true);
});

test('layoutfouten behouden de pagina en muteren geen commentaar, attributen of sjabloon', () => {
  const bron = '<!-- <main> --><template><main>voorbeeld</main></template><body title=">"><main>inhoud</main></body>';
  const weg = muteerHtml(bron, OPERATOREN_HTML[0], 0, muteer);
  assert.equal(weg, bron.replace('<main>inhoud', '<main><style>main{display:none!important}</style>inhoud'));
  const breed = muteerHtml(bron, OPERATOREN_HTML[1], 0, muteer);
  assert.equal(breed, bron.replace('<body title=">">', '<body title=">"><style>body{min-width:200vw!important}</style>'));
  assert.equal(muteerHtml('<p>geen hoofdinhoud</p>', OPERATOREN_HTML[0], 0, muteer), null);
  assert.equal(muteer('const main = true;', OPERATOREN_HTML[0], 0), null);
});
