'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { contractFouten, DS } = require('../scripts/ontwerpsysteem');
function kopie(wijzig) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ds-token-'));
  try { fs.cpSync(DS, dir, { recursive: true }); wijzig(dir); return contractFouten({ paginas: {} }, dir); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const voegToe = (dir, css) => fs.appendFileSync(path.join(dir, 'componenten/knop.css'), '\n@layer rtg.component {' + css + '}\n');
test('verplicht ontbrekend token wordt niet als geldige DS-presentatie geaccepteerd', () => {
  const fouten = kopie(dir => voegToe(dir, '.ds-knop { border-radius: var(--ds-radius-nietbestaand); }'));
  assert.ok(fouten.some(x => x.includes('onbekend verplicht DS-token --ds-radius-nietbestaand')));
});
test('commentaar kan een ontbrekend token niet definiëren; referentie in commentaar telt niet', () => {
  const fouten = kopie(dir => {
    fs.appendFileSync(path.join(dir, 'tokens.css'), '\n/* --ds-alleen-commentaar: 1rem; */\n');
    voegToe(dir, '/* var(--ds-niet-gelezen) */ .ds-knop { gap: var(--ds-alleen-commentaar); }');
  });
  assert.ok(fouten.some(x => x.includes('onbekend verplicht DS-token --ds-alleen-commentaar')));
  assert.ok(!fouten.some(x => x.includes('--ds-niet-gelezen')));
});
test('bestaande tokens en expliciete optionele fallback blijven toegestaan', () => {
  assert.deepEqual(kopie(dir => voegToe(dir, '.ds-knop { gap: var(--ds-ruimte-2); min-block-size: var(--ds-hosthoogte, 3rem); }')), []);
  assert.deepEqual(contractFouten({ paginas: {} }), []);
});
test('CSS-tekst en deels overeenkomende namen maken geen verplichte tokens aan', () => {
  for (const vals of [
    'content: "--ds-niet-echt: 1rem";',
    '--anders--ds-niet-echt: 1rem;',
    'content: "regel\\\n--ds-niet-echt: 1rem";'
  ]) {
    const fouten = kopie(dir => voegToe(dir, '.ds-knop {' + vals + ' gap: var(--ds-niet-echt); }'));
    assert.ok(fouten.some(x => x.includes('onbekend verplicht DS-token --ds-niet-echt')), vals);
  }
  assert.deepEqual(kopie(dir => voegToe(dir, '.ds-knop::before { content: "var(--ds-geen-code)"; }')), []);
});
