'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const hosts = [
  ['index.html', './public/shared/interface/world-desktop-copy.js'],
  ['explore/index.html', '../public/shared/interface/world-desktop-copy.js'],
  ...['business-lite', 'business-pass', 'community', 'lifestyle-pass', 'rtg-pass']
    .map(naam => ['public/site/passen/' + naam + '.html', '../../shared/interface/world-desktop-copy.js']),
  ['public/site/techniek/techniek.html', '../../shared/interface/world-desktop-copy.js'],
  ...['foundationos', 'livingos', 'travelos', 'workos']
    .map(naam => ['public/site/werelden/' + naam + '.html', '../../shared/interface/world-desktop-copy.js'])
];

test('alle publieke platformhosts verklaren de gedeelde kopietaal statisch vóór hun verbruiker', () => {
  for (const [bestand, bron] of hosts) {
    const html = fs.readFileSync(bestand, 'utf8');
    const eigenaar = html.indexOf('src="' + bron + '"');
    const detailTag = html.match(/<script[^>]+src="[^"]*platform-detail\.js"/);
    const shellTag = html.match(/<script[^>]+src="[^"]*platform-shell\.js"/);
    const detail = detailTag ? html.indexOf(detailTag[0]) : -1;
    const shell = shellTag ? html.indexOf(shellTag[0]) : -1;
    const verbruiker = detail >= 0 ? detail : shell;
    assert.ok(eigenaar >= 0, bestand + ': gedeelde kopietaal ontbreekt');
    assert.ok(verbruiker >= 0 && eigenaar < verbruiker, bestand + ': eigenaar moet vóór de verbruiker staan');
  }
});

test('publieke platformowners gebruiken native media/ankers en geen runtime-scriptloader', () => {
  const elementen = fs.readFileSync('public/site/platform-elements.js', 'utf8');
  const detail = fs.readFileSync('public/site/platform-detail.js', 'utf8');
  assert.match(elementen, /document\.createElement\('img'\)/);
  assert.match(elementen, /secure=document\.createElement\('a'\)/);
  assert.doesNotMatch(elementen, /createElement\('script'\)/);
  assert.doesNotMatch(detail, /createElement\('script'\)/);
  assert.match(detail, /setAttribute\('href',url\)/);
});

test('iedere publieke fragmentroute heeft na integratie precies één inhoudseigenaar', () => {
  for (const [bestand] of hosts) {
    const html = fs.readFileSync(bestand, 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    const dubbel = ids.filter((id, index) => ids.indexOf(id) !== index);
    assert.deepEqual(dubbel, [], bestand + ': geen dubbel prijsblok of dubbel routedoel');
    if (bestand.includes('/passen/')) {
      assert.equal(ids.filter(id => id === 'beschikbaarheid').length, 1,
        bestand + ': de redactionele indeling verplaatst het bestaande beleidsblok, niet de inhoud kopiëren');
    }
  }
});

test('publieke Edge-modules zijn begrensd en iedere host laadt de gedeelde ingang precies eenmaal', () => {
  const modules = ['edge-door', 'edge-menu-layout', 'edge-menu-pager', 'platform-edge',
    'storyline-edge', 'platform-shell', 'platform-elements'];
  for (const naam of modules) {
    const bestand = 'public/site/' + naam + '.js';
    assert.ok(fs.statSync(bestand).size <= 10000, bestand + ': één afgebakende verantwoordelijkheid per bron');
  }
  for (const [bestand] of [...hosts, ['public/site/404.html']]) {
    const html = fs.readFileSync(bestand, 'utf8');
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)]
      .map(match => match[1].split('/').pop());
    const ingang = scripts.indexOf('edge-door.js');
    const adapter = scripts.indexOf(bestand === 'index.html' ? 'platform-edge.js' : 'storyline-edge.js');
    assert.equal(scripts.filter(naam => naam === 'edge-door.js').length, 1, bestand);
    assert.ok(ingang >= 0 && ingang < adapter, bestand + ': ingang vóór de adapter');
    for (const naam of ['edge-menu-layout.js', 'edge-menu-pager.js']) {
      assert.equal(scripts.filter(script => script === naam).length, bestand === 'index.html' ? 1 : 0,
        bestand + ': magazinepaginering wordt alleen door haar bestaande host geladen');
    }
    if (bestand === 'index.html') assert.ok(scripts.indexOf('edge-menu-layout.js') < scripts.indexOf('edge-menu-pager.js') &&
      scripts.indexOf('edge-menu-pager.js') < adapter, 'layout vóór pager, beide vóór de ene Edge-adapter');
  }
});

test('Edge-lippen blijven aantoonbaar native beelden met dezelfde asset op Pages en diepe Node-routes', () => {
  const bron = fs.readFileSync('public/site/edge-door.js', 'utf8');
  const analyse = require('../scripts/ontwerpsysteem').scriptLaadAnalyse(bron, { ds: true });
  assert.deepEqual(analyse.onzeker, [], 'de afbeelding is geen onbesliste script- of stijllader');
  assert.deepEqual(analyse.verwijzingen, []);
  assert.equal(analyse.injecties + analyse.mogelijkeInjecties, 0);
  for (const [script, verwacht] of [
    ['https://voorbeeld.test/rtg/public/site/edge-door.js', 'https://voorbeeld.test/rtg/public/images/brand/rtg-edge-lips.webp'],
    ['https://voorbeeld.test/site/edge-door.js', 'https://voorbeeld.test/images/brand/rtg-edge-lips.webp']
  ]) {
    const beelden = [];
    function node(tag) {
      const attrs = {};
      const el = { dataset: {}, classList: { add() {}, toggle() {} }, append() {}, prepend() {},
        addEventListener() {}, querySelector() { return null; },
        setAttribute(key, value) { attrs[key] = value; }, getAttribute(key) { return attrs[key]; } };
      if (tag === 'img') beelden.push(el);
      return el;
    }
    const document = { currentScript: { src: script }, createElement: node, addEventListener() {}, activeElement: null };
    const window = { RTGAdaptiveEdge: {}, location: { href: 'https://voorbeeld.test/onbekend/diep/' } };
    vm.runInNewContext(bron, { window, document, URL, MutationObserver: class { observe() {} } });
    const host = { ...node('div'), dataset: { rtgAdaptiveState: 'dock' }, contains() { return false; } };
    window.RTGPublicEdgeDoor.mount({ bar: {}, host }, {});
    const button = { ...node('button'), dataset: { rtgAdaptiveSlot: '2', rtgAdaptiveAction: 'ai' } };
    const bar = { ...node('nav'), querySelectorAll() { return [button]; } };
    window.RTGPublicEdgeDoor.dress({ querySelector() { return bar; } });
    assert.deepEqual(beelden.map(beeld => beeld.src), [verwacht, verwacht],
      'ingang en Rahul gebruiken hetzelfde script-relatieve merkasset, onafhankelijk van het documentpad');
  }
});

/* De echte bestaande hostcode met een smalle DOM-adapter. Dit bewijst routering
   en doelkeuze; de browsertoets bewijst apart zichtbaarheid en native klikken. */
function publicHost(hash = '') {
  const shown = [], scrolled = [], events = {}, node = () => ({ dataset: {}, append() {}, setAttribute() {} });
  const scene = { ...node(), id: 'passen', dataset: { scene: 'Passen' } };
  const target = (id, tagName, owner = scene) => ({ ...node(), id, tagName, open: false,
    closest: selector => selector === '[data-scene]' ? owner : null,
    scrollIntoView: () => scrolled.push(id) });
  const targets = { passen: scene, prijsbeleid: target('prijsbeleid', 'DIV'),
    commissie: target('commissie', 'DETAILS'), orphan: target('orphan', 'DIV', null) };
  const source = { querySelectorAll: () => [scene] };
  const shell = { show: (id, title, content) => shown.push({ id, title, content }),
    page: id => shell.pages.push(id), pages: [],
    collapse: () => { shell.collapsed++; }, collapsed: 0, select() {}, refresh() {} };
  const document = { body: node(), documentElement: node(), createElement: node, addEventListener() {},
    getElementById: id => id === 'inhoud' ? source : targets[id],
    querySelector: selector => selector === '.pp-feature-photo' ? null : node() };
  const window = { location: { hash }, addEventListener: (type, fn) => { events[type] = fn; },
    RTGPublicPlatform: { init: () => shell, node, button: node },
    RTGExperience: { choose() {}, permission() {}, snapshot() {}, currentWorld: () => 'living' },
    RTGPublicContent: { words: {} }, I18N: { en: {} }, RTGPublicEdge() {}, RTGi18n: { apply() {} } };
  vm.runInNewContext(fs.readFileSync('public/site/platform-app.js', 'utf8'), { window, document, URLSearchParams, URL });
  return { window, shell, scene, targets, shown, scrolled,
    hashchange: value => { window.location.hash = value; events.hashchange(); } };
}

test('nested openbare ankers openen hun bestaande canonieke scene en doel-details', () => {
  const host = publicHost();
  host.window.RTGPublicApp.open('prijsbeleid');
  assert.equal(host.shown[0].id, 'passen');
  assert.equal(host.shown[0].content, host.scene, 'geen tweede scene of gekopieerde beleidsinhoud');
  assert.deepEqual(host.scrolled, ['prijsbeleid']);
  host.hashchange('#commissie');
  assert.equal(host.shown.at(-1).id, 'passen');
  assert.equal(host.targets.commissie.open, true);
  assert.deepEqual(host.scrolled, ['prijsbeleid', 'commissie']);
  assert.equal(host.shell.collapsed, 0, 'gewone ankers sluiten hun doel niet meteen weer');
});

test('directe fragments werken, onbekende doelen krijgen geen nieuwe eigenaar en home opent de editie', () => {
  const host = publicHost('#commissie');
  assert.equal(host.shown.length, 1);
  assert.equal(host.shown[0].id, 'passen');
  assert.equal(host.targets.commissie.open, true);
  host.hashchange('#onbekend');
  host.hashchange('#orphan');
  assert.equal(host.shown.length, 1, 'zonder canonieke scene ontstaat geen nieuw route-eigenaarschap');
  host.hashchange('#rtg?detail=passen');
  assert.equal(host.shown.length, 2, 'de bestaande detailroute blijft werken');
  host.hashchange('#platform-home');
  assert.deepEqual(host.shell.pages, ['editie']);
});
