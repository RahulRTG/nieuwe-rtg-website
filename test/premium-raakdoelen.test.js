'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const lees = pad => fs.readFileSync(path.join(ROOT, pad), 'utf8');

test('native DS en de Heritage-overgang bewaken dezelfde premium-doelmaat', () => {
  const ds = lees('public/ds/componenten/basis.css');
  const heritage = lees('public/shared/rtg-editorial-v4.css');
  assert.match(ds, /\.ds-scherm :where\([^}]+min-inline-size: var\(--ds-doel\);[^}]+min-block-size: var\(--ds-doel\);/s);
  assert.match(heritage, /body\[data-rtg-editorial-v4="true"\] :where\([^}]+min-width:44px!important;[^}]*min-height:44px!important;/s);
  assert.match(heritage, /\.standen>button\{[^}]*min-width:44px!important;/);
  assert.doesNotMatch(lees('public/shared/rtg-experience-2026.css'),
    /body\.rtg-music-experience \.speler button/);
  assert.match(lees('public/apps/muziek-heritage.css'),
    /body\.rtg-music-experience[^}]+\.speler button\{[^}]*min-width:44px;[^}]*width:44px;[^}]*height:44px/);
  assert.match(lees('public/ds/tokens.css'), /--ds-doel: 48px;/);
});

test('de dagbron krimpt binnen het mobiele werkvlak', () => {
  const life = lees('public/apps/life.html');
  assert.match(life, /\.dagrij \.wat\{[^}]*min-width:0;/);
  assert.match(life, /\.dagrij \.bron\{[^}]*min-width:0;[^}]*overflow:hidden;[^}]*text-overflow:ellipsis;/);
});
