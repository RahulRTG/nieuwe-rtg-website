/* DE VIER VANDAAG-STARTS DELEN EEN LUXELAAG ZONDER HUN WERELDDATA TE
   VERMENGEN. Deze toets borgt de canonieke routes, de fotografische
   uitsnedes, de eerlijke datastaten en de visuele huisregels. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const luxe = require('../public/shared/rtg-vandaag-luxe.js');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'public/shared/rtg-vandaag-luxe.css'), 'utf8');
const JS = fs.readFileSync(path.join(ROOT, 'public/shared/rtg-vandaag-luxe.js'), 'utf8');

const WERELDPAGINAS = [
  'public/apps/rtg.html',
  'public/apps/kantoor.html',
  'public/apps/reizen.html',
  'public/apps/foundation/os-publiek.html'
];

test('alle vier canonieke wereldstarts laden de luxe laag en foto vooraf', () => {
  for (const bestand of WERELDPAGINAS) {
    const html = fs.readFileSync(path.join(ROOT, bestand), 'utf8');
    assert.equal((html.match(/data-rtg-vandaag-luxe/g) || []).length, 1, bestand);
    assert.equal((html.match(/\/shared\/rtg-vandaag-luxe\.css/g) || []).length, 1, bestand);
    assert.equal((html.match(/\/shared\/rtg-vandaag-luxe\.js/g) || []).length, 1, bestand);
    assert.match(html, /<link[^>]+wereld-atlas\.jpg[^>]+rel="preload"[^>]+as="image"/);
  }
});

test('de luxe Vandaag-laag kent exact de vier werelden en hun canonieke poorten', () => {
  assert.deepEqual(luxe.PORTALEN.map(({ wereld, href }) => [wereld, href]), [
    ['living', '/apps/rtg.html'],
    ['work', '/apps/kantoor.html'],
    ['travel', '/apps/reizen.html'],
    ['foundation', '/apps/foundation/os-publiek.html']
  ]);
  assert.equal(luxe.WERELDEN.living.kop, 'Uw dag, mooi in balans.');
  assert.equal(luxe.WERELDEN.work.kop, 'Vandaag vraagt uw aandacht.');
  assert.equal(luxe.WERELDEN.travel.kop, 'Uw reis beweegt met u mee.');
  assert.equal(luxe.WERELDEN.foundation.kop, 'Vandaag maken we samen verschil.');
});

test('de laag activeert uitsluitend met een geldige opt-in en wereld', () => {
  assert.equal(luxe.normaliseerWereld(' TRAVEL '), 'travel');
  assert.equal(luxe.normaliseerWereld('core'), null);
  assert.equal(luxe.activeer({ body: { hasAttribute: () => false } }), null);
  assert.equal(luxe.CONTRACT.activatie, 'data-rtg-vandaag-luxe');
  assert.equal(luxe.CONTRACT.wereld, 'data-rtg-world');
  assert.match(JS, /['"]__merk['"]/);
  assert.match(JS, /['"]RTG['"]/);
  assert.doesNotMatch(JS, /Rahul Travel Group/);
});

test('home en surface hebben een klein expliciet contract', () => {
  assert.equal(luxe.CONTRACT.versie, 2);
  assert.deepEqual(luxe.CONTRACT.modi, ['home', 'surface']);
  assert.equal(luxe.CONTRACT.standaard, 'home');
  assert.equal(luxe.CONTRACT.surface, 'data-rtg-vandaag-surface');
  assert.equal(luxe.CONTRACT.titel, 'data-rtg-vandaag-surface-title');
  assert.equal(luxe.CONTRACT.render, 'data-rtg-vandaag-render');
  assert.equal(luxe.CONTRACT.netwerk, false);
  assert.equal(luxe.CONTRACT.opslag, false);
  assert.equal(luxe.normaliseerModus('surface'), 'surface');
  assert.equal(luxe.normaliseerModus('onbekend'), 'home');
  assert.equal(luxe.normaliseerSurface(' projecten '), 'projecten');
  assert.equal(luxe.normaliseerSurface('dashboard'), null);
  assert.deepEqual(Object.fromEntries(Object.entries(luxe.SURFACES)
    .map(([naam, route]) => [naam, [route.doel, route.fallback]])), {
    agenda: ['main', '#inhoud'],
    reisboek: ['#main', 'main'],
    projecten: ['#inhoud', 'main'],
    'public-city': ['#main', 'main']
  });
});

test('geen enkele Today-presentatie wordt binnen ingebedde chrome toegevoegd', () => {
  assert.equal(luxe.presentatieVoor('home', true), null);
  assert.equal(luxe.presentatieVoor('surface', true), null);
  assert.equal(luxe.presentatieVoor('surface', false), 'surface');

  const element = (klassen = [], kenmerken = {}) => ({
    classList: { contains: (naam) => klassen.includes(naam) },
    getAttribute: (naam) => kenmerken[naam] || null
  });
  const documentVoor = ({ htmlKlassen = [], bodyKlassen = [], kenmerken = {}, zoek = '', frame = false } = {}) => {
    const view = { location: { search: zoek } };
    view.self = frame ? {} : view;
    view.top = frame ? {} : view;
    return {
      documentElement: element(htmlKlassen, kenmerken),
      body: element(bodyKlassen),
      defaultView: view
    };
  };
  assert.equal(luxe.isIngebed(documentVoor({ frame: true })), true);
  assert.equal(luxe.isIngebed(documentVoor({ zoek: '?embed=1' })), true);
  assert.equal(luxe.isIngebed(documentVoor({ htmlKlassen: ['rtg-command-blad'] })), true);
  assert.equal(luxe.isIngebed(documentVoor({ bodyKlassen: ['rtg-edge-embed'] })), true);
  assert.equal(luxe.isIngebed(documentVoor({ kenmerken: { 'data-rtg-oppervlak': '1' } })), true);
  assert.equal(luxe.isIngebed(documentVoor()), false);

  const attrs = new Map([
    [luxe.CONTRACT.activatie, 'surface'], [luxe.CONTRACT.wereld, 'work'],
    [luxe.CONTRACT.surface, 'projecten'], [luxe.CONTRACT.render, 'surface']
  ]);
  const ingebed = documentVoor({ zoek: '?embed=1' });
  ingebed.body.hasAttribute = (naam) => attrs.has(naam);
  ingebed.body.getAttribute = (naam) => attrs.get(naam) || null;
  ingebed.body.removeAttribute = (naam) => attrs.delete(naam);
  ingebed.getElementById = () => null;
  assert.equal(luxe.activeer(ingebed), null);
  assert.equal(attrs.has(luxe.CONTRACT.render), false, 'embed laat ook geen lege layout-offset achter');
});

test('surface is een eigen compacte contextstrip met declaratieve titel', () => {
  assert.match(CSS, /data-modus="surface"\]\{min-height:clamp\(9rem,16svh,13rem\)/);
  assert.match(CSS, /max-width:780px[^}]*}[\s\S]*data-modus="surface"\]\{min-height:clamp\(8rem,20svh,11rem\)/);
  assert.match(CSS, /data-rtg-vandaag-surface="projecten"\][^{]*\{[^}]*--rtg-vandaag-werk-kop:clamp\(9rem,16svh,13rem\)/s);
  assert.match(CSS, /data-rtg-vandaag-surface="projecten"\][^{]*>\.wk-shell\{[^}]*inset:var\(--rtg-vandaag-werk-kop\) 0 0!important/s);
  const bouwer = JS.match(/function bouwSurface[\s\S]+?function plaats/)[0];
  assert.match(bouwer, /['"]__surface['"]/);
  assert.match(bouwer, /setAttribute\('role',\s*'group'\)/);
  assert.doesNotMatch(bouwer, /maakBovenbalk|__focus|aside|maak\([^)]*'header'/);
  assert.equal(luxe.surfaceTitel({
    body: { getAttribute: (naam) => naam === luxe.CONTRACT.titel ? '  Projecten en taken  ' : '' },
    querySelector: () => ({ textContent: 'Verkeerde inlogtitel' }),
    title: 'Andere titel | RTG'
  }, luxe.WERELDEN.work), 'Projecten en taken');
});

test('de fotoatlas gebruikt voor iedere wereld het afgesproken kwadrant', () => {
  assert.match(CSS, /url\("\/images\/worlds\/vandaag\/wereld-atlas\.jpg"\)/);
  assert.match(CSS, /background-size:\s*200% auto/);
  assert.match(CSS, /max-aspect-ratio:\s*1\/1[^}]+background-size:\s*auto 200%/s);
  const posities = {
    living: 'left top',
    work: 'right top',
    travel: 'left bottom',
    foundation: 'right bottom'
  };
  for (const [wereld, positie] of Object.entries(posities)) {
    const patroon = new RegExp('data-wereld="' + wereld + '"[^}]+background-position:\\s*' + positie);
    assert.match(CSS, patroon, wereld + ' gebruikt ' + positie + ' uit de atlas');
  }
});

test('de wereldfotografie heeft een controleerbare lokale herkomst', () => {
  const map = path.join(ROOT, 'public/images/worlds/vandaag');
  const beeld = fs.readFileSync(path.join(map, 'wereld-atlas.jpg'));
  const herkomst = JSON.parse(fs.readFileSync(path.join(map, 'HERKOMST.json'), 'utf8'));
  assert.equal(herkomst.generator, 'OpenAI ingebouwde ImageGen');
  assert.match(herkomst.verklaring, /Geen extern stockbeeld/);
  assert.equal(crypto.createHash('sha256').update(beeld).digest('hex'), herkomst.sha256);
});

test('focusinformatie komt alleen uit bestaande velden en kent een eerlijke lege stand', () => {
  for (const selector of ['#volgendMoment', '#volgendTijd', '#volgendLabel', '#vandaag', '#steden']) {
    assert.ok(JS.includes(selector), selector + ' wordt als bestaande bron waargenomen');
  }
  const leegDoc = { querySelector: () => null };
  assert.equal(luxe.leesFocus('living', leegDoc, false).status, 'loading');
  assert.equal(luxe.leesFocus('living', leegDoc, true).status, 'empty');
  assert.doesNotMatch(JS, /\b\d{1,3}%\b/, 'de presentatielaag verzint geen percentage');
});

test('bestaande Living- en Travelvelden worden letterlijk maar veilig weergegeven', () => {
  const element = (waarde, kinderen = {}) => ({
    textContent: waarde,
    querySelector: (selector) => kinderen[selector] || null
  });
  const livingMoment = element('', {
    '[data-veld="titel"]': element('Diner bij De Salon'),
    '[data-veld="tijd"]': element('19:00')
  });
  const living = luxe.leesFocus('living', {
    querySelector: (selector) => selector === '#volgendMoment' ? livingMoment : null
  }, false);
  assert.deepEqual(living, { status: 'ready', titel: 'Diner bij De Salon', meta: '19:00' });

  const travel = luxe.leesFocus('travel', {
    querySelector: (selector) => selector === '#volgendTijd'
      ? element('11:30')
      : selector === '#volgendLabel' ? element('Transfer naar Casa Meridiana') : null
  }, false);
  assert.deepEqual(travel, {
    status: 'ready', titel: 'Transfer naar Casa Meridiana', meta: '11:30'
  });
});

test('Work bevestigt aanwezigheid zonder mogelijk gevoelige taaktekst te kopiëren', () => {
  const geheim = 'Vertrouwelijke overnamebespreking';
  const work = luxe.leesFocus('work', {
    querySelector: (selector) => selector === '#vandaag' ? { textContent: geheim } : null
  }, false);
  assert.equal(work.status, 'ready');
  assert.equal(work.titel, 'Uw werk voor vandaag staat klaar.');
  assert.ok(!JSON.stringify(work).includes(geheim));
});

test('de goedgekeurde wereldpaletten zijn vast en leesbaar', () => {
  const paletten = {
    living: ['#f4f0e8', '#fbf8f2', '#e8e0d2', '#211e19', '#675f54', '#b89545', '#745718'],
    travel: ['#14090e', '#231016', '#0e090b', '#f7f0e6', '#c2b2aa', '#7f1634', '#d0b77b'],
    work: ['#0c1112', '#141b1c', '#090d0e', '#f0f2ec', '#aab6b2', '#75b8b1', '#c1a45f'],
    foundation: ['#071522', '#0b2032', '#06101b', '#f2f2ea', '#aebccc', '#d0b66e', '#d0b66e']
  };
  const luminantie = (hex) => {
    const kanalen = hex.match(/[0-9a-f]{2}/gi).map((waarde) => parseInt(waarde, 16) / 255)
      .map((waarde) => waarde <= .04045 ? waarde / 12.92 : ((waarde + .055) / 1.055) ** 2.4);
    return .2126 * kanalen[0] + .7152 * kanalen[1] + .0722 * kanalen[2];
  };
  const contrast = (a, b) => {
    const waarden = [luminantie(a), luminantie(b)].sort((x, y) => y - x);
    return (waarden[0] + .05) / (waarden[1] + .05);
  };
  for (const [wereld, kleuren] of Object.entries(paletten)) {
    const blok = CSS.match(new RegExp('body\\[data-rtg-vandaag-luxe\\]\\[data-rtg-world="' + wereld + '"\\]\\{([^}]+)'));
    assert.ok(blok, wereld + ' heeft een paginapalet');
    for (const kleur of kleuren) assert.ok(blok[1].includes(kleur), wereld + ' bevat ' + kleur);
    assert.ok(contrast(kleuren[3], kleuren[0]) >= 4.5, wereld + ' hoofdtekst is leesbaar');
    assert.ok(contrast(kleuren[4], kleuren[0]) >= 4.5, wereld + ' gedempte tekst is leesbaar');
    assert.ok(contrast(kleuren[6], kleuren[0]) >= 4.5, wereld + ' metaaltekst is leesbaar');
  }
  assert.match(CSS, /body\[data-rtg-vandaag-luxe\]\[data-rtg-world\]\{[^}]*--edge-bg:/s);
  assert.match(CSS, /body\[data-rtg-vandaag-luxe\]\[data-rtg-world\]\{[^}]*--rtg-bg:/s);
  assert.match(CSS, /data-rtg-world="work"\][^{]*\{[^}]*--wo-bordeaux:#4f8580[^}]*--wk-red:#75b8b1/s);
  assert.match(CSS, /--burgundy:var\(--rtg-v-signature\)/);
  assert.match(CSS, /data-rtg-world="foundation"\][^{]+\.onthaal-beeld\{[^}]*#0b2032/s);
  assert.match(CSS, /data-rtg-world="foundation"\][^{]+\.buurtknop\.vol\{[^}]*border:1px solid #d0b66e/s);
  assert.match(CSS, /data-rtg-world="work"\][^{]+\.knop\.p\{[^}]*rgba\(117,184,177,.08\)/s);
  assert.match(CSS, /data-rtg-vandaag-luxe="surface"\]\[data-rtg-world="living"\]\[data-kantoor-tool="agenda"\]/);
});

test('de presentatielaag verricht geen netwerk- of opslagwerk', () => {
  assert.doesNotMatch(JS, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/);
});

test('vorm en beweging volgen de huisregels', () => {
  assert.match(CSS, /contract versie 2/);
  assert.match(CSS, /prefers-reduced-motion:\s*reduce/);
  assert.match(CSS, /:focus-visible/);
  assert.match(CSS, /\.rtg-edge-host \.rtg-vandaag-luxe__boven\s*{\s*display:\s*none/);
  assert.doesNotMatch(CSS + JS, /[\u2012-\u2015]/, 'geen brede streepjes');
  for (const match of CSS.matchAll(/border-radius\s*:\s*([^;}]+)/g)) {
    assert.ok(['0', '50%'].includes(match[1].trim()), 'alleen rechte hoeken of echte cirkels');
  }
});

test('de browsermodule blijft onder de repo-grens van 10 KiB', () => {
  assert.ok(Buffer.byteLength(JS) <= 10 * 1024, 'Vandaag runtime is ' + Buffer.byteLength(JS) + ' bytes');
});
