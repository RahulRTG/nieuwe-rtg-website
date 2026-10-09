const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

test('de filmische laag is centraal en volgt na de wereldgrammatica', () => {
  const heritage = read('public/shared/rtg-heritage.css');
  const basis = read('public/shared/basis.js');
  assert.match(heritage, /@import url\('\.\/rtg-cinematic-system\.css(?:\?[^']+)?'\);/);
  assert.match(basis, /\['rtg-heritage-components', 'RTGHeritageComponents'\],[\s\S]*\['rtg-cinematic-system', 'RTGCinematicSystem'\]/);
});

test('www bepaalt de vaste kaders van app, header en Edge', () => {
  const heritage = read('public/shared/rtg-heritage.css');
  const css = read('public/shared/rtg-cinematic-system.css');
  assert.match(heritage, /--rtg-frame-mobile:16px/);
  assert.match(heritage, /--rtg-header-mobile:64px/);
  assert.match(heritage, /--rtg-edge-mobile-height:64px/);
  assert.match(heritage, /--rtg-edge-desktop-width:660px/);
  assert.match(css, /width:calc\(100% - \(var\(--rtg-frame-mobile\) \* 2\)\)!important/);
  assert.match(css, /width:calc\(100vw - \(var\(--rtg-edge-mobile-inset\) \* 2\)\)!important/);
});

test('alle vier werelden gebruiken bestaande lokale productiebeelden', () => {
  const css = read('public/shared/rtg-cinematic-system.css');
  ['living', 'travel', 'work', 'foundation'].forEach((world) => {
    const relative = `public/images/worlds/heritage/${world}-heritage-v2.jpg`;
    assert.equal(fs.existsSync(path.join(ROOT, relative)), true, `${relative} ontbreekt`);
    assert.match(css, new RegExp(`${world}-heritage-v2\\.jpg`));
  });
});

test('de laag benoemt bestaande schermen en tekent geen tweede Edge', () => {
  const source = read('public/shared/rtg-cinematic-system.js');
  assert.match(source, /data-rtg-cinematic-root/);
  assert.match(source, /data-rtg-cinematic-lead/);
  assert.doesNotMatch(source, /createElement|appendChild|insertAdjacentHTML|innerHTML\s*=/);
  assert.match(source, /SKIP = '\.rtg-edge-chrome/);
});

test('native canvassen blijven uitgesloten van fotografische inhoudsregie', () => {
  const source = read('public/shared/rtg-cinematic-system.js');
  const css = read('public/shared/rtg-cinematic-system.css');
  assert.match(source, /canvas \|\| declared === 'canvas'/);
  assert.match(source, /kind === 'immersive'/);
  assert.match(css, /data-rtg-cinematic-kind="immersive"/);
});
