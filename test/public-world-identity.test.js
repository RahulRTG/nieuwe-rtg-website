'use strict';

/* Publieke wereldidentiteit: oorspronkelijke eigenaarfoto's, vaste toewijzing,
   alleen publieke paletovererving en randloze themakleuren. Geen bewijs van
   app-toegang of geleverde diensten; echte layout staat in de browserproef. */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const IMAGE_PATH = 'images/worlds/owner-20261114/';
const IMAGE_ROOT = path.join(ROOT, 'public', IMAGE_PATH);
// Independent fingerprints of the four original user attachments. Their order
// is intentional: Foundation, Travel, Living, Work, not the navigation order.
const EXPECTED = [
  { world: 'foundation', name: 'FoundationOS', original: '1-Foto-1.jpg', hash: '193c81ac447d4cd70d984b6c5f0872b8f95202ece91f2092000c0dbe91f249ea' },
  { world: 'travel', name: 'TravelOS', original: '2-Foto-2.jpg', hash: '952bd3e4b34b5076a331c816e9a73f3c8b01abfeb768070308db1e70bd48f3e2' },
  { world: 'living', name: 'LivingOS', original: '3-Foto-3.jpg', hash: '24ddf1f10a39c50b3894cc59f52997b228c1159d195268495bddb2562137d233' },
  { world: 'work', name: 'WorkOS', original: '4-Foto-4.jpg', hash: 'cb36205e899f0c35cb550142cb25fa784ca2c58e379e1eec8264cf2dbf497914' }
];

test('de vier wereldfoto’s bewaren de originele bytes en de expliciete fotokeuze', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(IMAGE_ROOT, 'PROVENANCE.json'), 'utf8'));
  assert.equal(manifest.source, 'user-provided');
  assert.deepEqual(manifest.images.map(image => image.world).sort(), EXPECTED.map(image => image.world).sort());
  const fingerprints = new Set();
  for (const expected of EXPECTED) {
    const image = manifest.images.find(item => item.world === expected.world);
    assert.equal(image.path, expected.world + '.jpg');
    assert.equal(image.worldName, expected.name);
    assert.equal(image.originalFilename, expected.original);
    assert.equal(image.source, 'user-provided');
    assert.equal(image.illustrative, true);
    assert.equal(image.sha256, expected.hash);
    const bytes = fs.readFileSync(path.join(IMAGE_ROOT, image.path));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected.hash, expected.name + ' behoudt zijn eigen originele foto');
    fingerprints.add(expected.hash);
  }
  assert.equal(fingerprints.size, 4, 'iedere wereld heeft zijn eigen aangeleverde foto');
  const brandRoot = path.join(ROOT, 'public/images/brand/owner-20261114');
  const brand = JSON.parse(fs.readFileSync(path.join(brandRoot, 'PROVENANCE.json'), 'utf8'));
  const originals = [
    ['lips-wide.jpg', '4-Foto-4.jpg', 'ace5d40c5ff56aacf3dc23b7028cb382d7d64c7317201db8594f0325134e083f'],
    ['lips.jpg', '5-Foto-5.jpg', 'd33206f0bf3d0e624c0d3438db8cebba50d336bf4912e1ddec56ba5cb1b0f363'],
    ['brush-orbit.jpg', '6-Foto-6.jpg', '1872351f57dd9b4dcab2ddf4fcccaf93c62ec536b573102b59b199766718e9f7'],
    ['brush-ribbon.jpg', '7-Foto-7.jpg', '07b77eb8c2559d63dbb8ff22ba8e61b504726916344dc3d7d7a96bdbd665c2ab']
  ];
  assert.equal(brand.source, 'user-provided');
  assert.equal(brand.suppliedBy, 'owner');
  assert.equal(brand.primaryBrandMark, 'lips.jpg');
  assert.equal(brand.images.length, originals.length);
  for (const [file, original, hash] of originals) {
    const image = brand.images.find(item => item.path === file);
    assert.ok(image, file + ' heeft een herkomstvermelding');
    assert.equal(image.originalFilename, original);
    assert.equal(image.source, 'user-provided');
    assert.equal(image.suppliedBy, 'owner');
    assert.ok(image.role);
    assert.equal(image.sha256, hash);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(brandRoot, file))).digest('hex'), hash, file + ' behoudt de originele bytes');
  }
  const landing = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(landing, /<link rel="icon" href="\.\/public\/images\/brand\/owner-20261114\/lips\.jpg" type="image\/jpeg">/);
});

test('de vier wereldpanelen op de publieke voordeur tonen de toegewezen foto', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const expected of EXPECTED) {
    const panel = html.match(new RegExp('<article\\b[^>]*data-room="' + expected.world + '"[^>]*>([\\s\\S]*?)</article>'));
    assert.ok(panel, expected.name + ' heeft een eigen wereldpaneel');
    const photos = [...panel[1].matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]);
    assert.equal(photos[0], './public/' + IMAGE_PATH + expected.world + '.jpg', expected.name + ' gebruikt zijn eigen aangeleverde foto');
    for (const other of EXPECTED.filter(item => item.world !== expected.world)) {
      assert.ok(!photos.some(photo => photo.includes(IMAGE_PATH + other.world + '.jpg')), expected.name + ' gebruikt niet de foto van ' + other.name);
    }
  }
});

test('de vier verhaalpagina’s behouden hun eigen wereldnaam en thema-identiteit', () => {
  for (const expected of EXPECTED) {
    const html = fs.readFileSync(path.join(ROOT, 'public/site/werelden', expected.world + 'os.html'), 'utf8');
    assert.ok(html.includes('<title>' + expected.name + ' | Rahul Travel Group</title>'));
    assert.match(html, new RegExp('<body\\b[^>]*data-rtg-world="' + expected.world + '"'));
    assert.match(html, new RegExp('<body\\b[^>]*data-world="' + expected.world + '"'));
    assert.match(html, new RegExp('<body\\b[^>]*data-public-world="' + expected.world + '"'));
  }
});

const PUBLIC_PALETTE = ['bg', 'card', 'ink', 'muted', 'line', 'accent', 'action', 'action-ink'].map(name => '--ds-public-' + name);
const PUBLIC_DEFAULT = ':where(body[data-public-platform],body.rtg-experience,body.world-story)';

test('Explore laadt de gedeelde menubediening vóór het menu start', () => {
  const html = fs.readFileSync(path.join(ROOT, 'explore/index.html'), 'utf8');
  const visual = html.indexOf('rtg-adaptive-edge-visual.js');
  const cinema = html.indexOf('rtg-adaptive-edge-cinema.js');
  const edge = html.indexOf('rtg-adaptive-edge.js');
  assert.ok(visual >= 0 && cinema > visual && edge > cinema);
});

function publicPaletteRules() {
  const css = fs.readFileSync(path.join(ROOT, 'public/ds/thema/public-worlds.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.replace(/\s+/g, ''),
    tokens: Object.fromEntries([...body.matchAll(/(--ds-public-[a-z-]+)\s*:\s*([^;{}]+);?/g)].map(([, token, value]) => [token, value.trim()]))
  })).filter(rule => Object.keys(rule.tokens).length);
}

test('LivingOS is de laag-specifieke publieke standaard, geen globale appstijl', () => {
  const rules = publicPaletteRules();
  const defaults = rules.filter(rule => rule.selector.includes(PUBLIC_DEFAULT));
  assert.equal(defaults.length, 1, 'één publieke LivingOS-standaard');
  assert.equal(defaults[0].selector, PUBLIC_DEFAULT + ',[data-public-world="living"]', 'alleen publieke body-markeringen krijgen de standaard');
  assert.deepEqual(Object.keys(defaults[0].tokens).sort(), PUBLIC_PALETTE.slice().sort());
  assert.equal(defaults[0].tokens['--ds-public-bg'], 'var(--ds-p-ivoor)');
  assert.equal(defaults[0].tokens['--ds-public-ink'], 'var(--ds-p-public-living-ink)');
  assert.equal(defaults[0].tokens['--ds-public-action'], 'var(--ds-p-public-living-action)');

  const allowedSelectors = new Set([
    '[data-public-world]', defaults[0].selector,
    ...['travel', 'work', 'foundation'].map(world => '[data-public-world="' + world + '"]')
  ]);
  for (const rule of rules) {
    assert.equal(rule.tokens['--ds-public-line'], 'transparent', 'kleurvlakken vervangen decoratieve scheidingslijnen');
    assert.ok(allowedSelectors.has(rule.selector), rule.selector + ' mag geen ongerichte appstijl worden');
    assert.deepEqual(Object.keys(rule.tokens).sort(), PUBLIC_PALETTE.slice().sort());
  }
  const rootTokens = fs.readFileSync(path.join(ROOT, 'public/ds/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(rootTokens, /--ds-public-[a-z-]+\s*:/, 'geen publieke semantische defaults op :root: apps moeten hun eigen fallbacks houden');
});

test('expliciete TravelOS-, WorkOS- en FoundationOS-thema’s blijven sterker dan de LivingOS-standaard', () => {
  const rules = publicPaletteRules();
  for (const world of ['travel', 'work', 'foundation']) {
    const matches = rules.filter(rule => rule.selector === '[data-public-world="' + world + '"]');
    assert.equal(matches.length, 1, world + ' heeft één expliciet attribuutthema buiten :where');
    assert.equal(matches[0].tokens['--ds-public-card'], 'var(--ds-p-public-' + world + '-card)');
    assert.equal(matches[0].tokens['--ds-public-action'], 'var(--ds-p-public-' + (world === 'travel' ? '' : world + '-') + 'action)');
  }
});

test('overige marketingpagina’s krijgen de publieke basis zonder geforceerde wereldidentiteit', () => {
  const pages = ['index.html', 'explore/index.html'];
  for (const directory of ['public/site/passen', 'public/site/techniek']) {
    pages.push(...fs.readdirSync(path.join(ROOT, directory)).filter(file => file.endsWith('.html')).map(file => directory + '/' + file));
  }
  for (const file of pages) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const body = html.match(/<body\b[^>]*>/)?.[0];
    assert.ok(body, file + ' heeft een body');
    assert.match(body, /\bdata-public-platform=|\bclass="[^"]*\b(?:rtg-experience|world-story)\b/, file + ' erft het publieke LivingOS-palet');
    assert.doesNotMatch(body, /\bdata-public-world=/, file + ' wordt geen expliciete wereldpagina');
  }
});

test('de zichtbare cataloguskaarten koppelen dezelfde foto en naam aan iedere wereld', () => {
  const context = vm.createContext({ window: {} });
  for (const file of ['platform-data.js', 'platform-app-data.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'public/site', file), 'utf8'), context, { filename: file });
  }
  const content = context.window.RTGPublicContent;
  assert.equal(content.app.primary.length, 4);
  for (const expected of EXPECTED) {
    const cards = content.app.primary.filter(card => card.world === expected.world);
    assert.equal(cards.length, 1, expected.name + ' komt één keer voor in de catalogus');
    assert.equal(cards[0].photo, 'worlds/owner-20261114/' + expected.world + '.jpg');
    assert.equal(cards[0].target, 'world:' + expected.world);
    assert.equal(content.words[cards[0].title][0], expected.name);
  }
});

test('ook de bestaande voorbeelddemonstraties behouden de toegewezen wereldfoto', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public/site/storyline-stage.js'), 'utf8');
  const scenes = { living: 'dinner', travel: 'travel', work: 'work', foundation: 'family' };
  for (const expected of EXPECTED) {
    const scene = source.match(new RegExp('\\b' + scenes[expected.world] + ":\\s*\\{\\s*photo:\\s*'([^']+)'"));
    assert.ok(scene, expected.name + ' heeft een voorbeeldscène');
    assert.equal(scene[1], 'worlds/owner-20261114/' + expected.world + '.jpg');
  }
});

// This fixture exercises the real detail projection's routing and image
// selection only. Responsive layout and image cropping need browser checks.
function projectDetail(html) {
  function element() {
    return {
      dataset: {}, children: [], classList: { add() {} },
      append(...children) { this.children.push(...children); },
      appendChild(child) { this.children.push(child); },
      setAttribute() {}, before() {},
      get firstChild() { return this.children[0]; }
    };
  }
  const bodyTag = html.match(/<body\b[^>]*>/)[0], body = element();
  for (const [, key, value] of bodyTag.matchAll(/data-([a-z-]+)="([^"]+)"/g)) {
    body.dataset[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  body.classList.contains = name => (bodyTag.match(/class="([^"]*)"/)?.[1] || '').split(/\s+/).includes(name);
  const source = element(), hero = /class="world-hero"/.test(html) ? element() : null;
  source.querySelector = selector => selector === '.world-hero' ? hero : null;
  source.querySelectorAll = () => [];
  const document = { body, title: '', createElement: element, querySelector: () => source };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'public/site/platform-detail.js'), 'utf8'), {
    window: { RTGPublicPlatform: { asset: () => 'https://example.test/project/public/', brand: element } },
    document, URL, getComputedStyle: () => ({ getPropertyValue: () => '' })
  });
  return { image: hero?.children[0]?.children[0]?.src, world: body.dataset.publicWorld };
}

test('de detailprojectie gebruikt wereldfoto’s alleen voor de vier echte wereldpagina’s', () => {
  for (const expected of EXPECTED) {
    const html = fs.readFileSync(path.join(ROOT, 'public/site/werelden', expected.world + 'os.html'), 'utf8');
    const result = projectDetail(html);
    assert.equal(result.world, expected.world);
    assert.equal(result.image, 'https://example.test/project/public/' + IMAGE_PATH + expected.world + '.jpg');
  }
  const otherPages = {
    'public/site/passen/community.html': 'moment-family-support.webp',
    'public/site/passen/rtg-pass.html': 'living-home.webp',
    'public/site/passen/business-lite.html': 'company-opportunity.webp',
    'public/site/passen/business-pass.html': 'company-control.webp',
    'public/site/passen/lifestyle-pass.html': 'moment-dinner.webp',
    'public/site/techniek/techniek.html': 'company-technology.webp',
    'explore/index.html': null
  };
  for (const [file, photo] of Object.entries(otherPages)) {
    const result = projectDetail(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    assert.equal(result.world, undefined, file + ' wordt niet ongemerkt een wereldpagina');
    assert.equal(result.image, photo ? 'https://example.test/project/public/images/editorial/' + photo : undefined, file + ' behoudt zijn eigen beeld');
  }
});
