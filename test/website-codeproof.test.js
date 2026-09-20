/* DE PUBLIEKE BLOKKEN ZEGGEN ALLEEN WAT DE CODE DRAAGT. Deze toets bewaakt dat
   ieder compact startblok en iedere resultaat- of mogelijkheidskaart verdieping
   heeft, en dat elk zichtbaar code-anker werkelijk in deze repository bestaat. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const worldPages = [
  'public/site/werelden/livingos.html',
  'public/site/werelden/travelos.html',
  'public/site/werelden/workos.html',
  'public/site/werelden/foundationos.html'
];

function sources(html) {
  return [...html.matchAll(/(?:data-proof-source="|class="proof-source">)([^"<]+)/g)]
    .flatMap(match => match[1].split('·'))
    .map(value => value.trim())
    .filter(Boolean);
}

test('alle compacte startblokken openen een begrensde uitleg uit de codebasis', () => {
  const html = read('index.html');
  const cards = [...html.matchAll(/<button type="button" class="fragment" data-code-proof[\s\S]*?<\/button>/g)];
  assert.equal(cards.length, 6);
  for (const [index, match] of cards.entries()) {
    assert.match(match[0], /data-proof-title="[^"]+"/, 'kaart ' + (index + 1) + ' mist een titel');
    assert.match(match[0], /data-proof-body="[^"]+"/, 'kaart ' + (index + 1) + ' mist begrensde uitleg');
    assert.match(match[0], /data-proof-source="[^"]+"/, 'kaart ' + (index + 1) + ' mist code-ankers');
  }
  assert.match(html, /<dialog class="code-proof-dialog" id="codeProofDialog"/);
  assert.match(read('public/site/start/experience-proof.js'), /dialog\.showModal\(\)/);
});

test('elk resultaat- en mogelijkheidsblok op de vier wereldpagina’s heeft verdieping', () => {
  for (const file of worldPages) {
    const html = read(file);
    const cards = [...html.matchAll(/<article class="(?:outcome|capability)">[\s\S]*?<\/article>/g)];
    assert.equal(cards.length, 7, file + ' hoort drie resultaten en vier mogelijkheden te hebben');
    for (const [index, match] of cards.entries()) {
      assert.match(match[0], /<details class="proof-detail">/, file + ' kaart ' + (index + 1) + ' mist verdieping');
      assert.match(match[0], /<summary>[^<]+<\/summary>/, file + ' kaart ' + (index + 1) + ' mist een bedienbare samenvatting');
      assert.match(match[0], /<span class="proof-source">[^<]+<\/span>/, file + ' kaart ' + (index + 1) + ' mist code-ankers');
    }
  }
});

test('alle genoemde code-ankers bestaan in deze repository', () => {
  const html = [read('index.html'), ...worldPages.map(read)].join('\n');
  for (const source of sources(html)) {
    assert.equal(fs.existsSync(path.join(root, source)), true, 'onbekend code-anker: ' + source);
  }
});
