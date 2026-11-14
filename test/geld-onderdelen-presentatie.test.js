'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(root, bestand), 'utf8');
const stijleigenaren = [
  'balans.js', 'bank.js', 'labfonds.js', 'lidmaatschap.js', 'logboek.js',
  'mecenaat.js', 'metier.js', 'nalatenschap.js', 'overzicht.js',
  'overzichtb.js', 'rtgcodeb.js', 'waarde.js', 'wallet.js', 'wbw.js'
];
const starters = [
  'balansb.js', 'bankc.js', 'labfondsb.js', 'logboekb.js', 'mecenaatb.js',
  'metierc.js', 'nalatenschapb.js', 'overzichtc.js', 'waardec.js',
  'walletb.js', 'wbwb.js'
];

test('RTG Geld laadt één statisch presentatiecontract vóór zijn standen', () => {
  const html = lees('public/apps/geld.html');
  assert.equal((html.match(/\/ds\/componenten\/geld\.css/g) || []).length, 1);
  assert.ok(html.indexOf('/ds/componenten/geld.css') < html.indexOf('/apps/geld/overzicht.js'));
  assert.match(html, /<body class="[^"]*\bds-geld\b/);
  assert.doesNotMatch(html, /overzicht-a\.js/);
});

test('alle Geld-standen laten presentatie aan het gedeelde blad', () => {
  for (const naam of stijleigenaren) {
    const bron = lees('public/apps/geld/' + naam);
    assert.doesNotMatch(bron,
      /createElement\(\s*['"]style['"]|function stijl\s*\(|\.stijl\s*=\s*function|stijl:\s*stijl|RCCSS|ovcss/,
      naam);
  }
  for (const naam of starters) {
    const bron = lees('public/apps/geld/' + naam);
    assert.doesNotMatch(bron, /(?:Deel|D\(\)|D|B|M)\.stijl\s*\(/, naam);
  }
  assert.equal(fs.existsSync(path.join(root, 'public/apps/geld/overzicht-a.js')), false);
});

test('geld-onderdelen bewaart alle standidentiteiten en toegankelijke bediening', () => {
  const css = lees('public/ds/componenten/geld.css');
  for (const selector of [
    '.bl-week', '.bk-rek', '.lf-som', '.lm-rij', '.lb-attn', '.mc-tx',
    '.mt-tabs', '.nl-tx', '.ov-start', '.ovTdag', '#rcCode', '.wd-pos',
    '.wa-pas', '.wb-lijstknop'
  ]) assert.ok(css.includes(selector), selector);
  assert.match(css, /min-block-size:\s*var\(--ds-doel\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|!important/i);
});
