/* De vier wereldhomes zijn hun eigen luxe dashboard. De gedeelde laag
   annoteert uitsluitend de oorspronkelijke main en maakt geen tweede UI. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const luxe = require('../public/shared/rtg-vandaag-luxe.js');

const ROOT = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(ROOT, bestand), 'utf8');
const CSS = lees('public/shared/rtg-vandaag-luxe.css');
const JS = lees('public/shared/rtg-vandaag-luxe.js');
const HOMES = [
  ['living', 'public/apps/rtg.html', '/apps/rtg.html', '#inhoud', 'living-heritage-v2.jpg'],
  ['work', 'public/apps/kantoor.html', '/apps/kantoor.html', '#inhoud', 'work-heritage-v2.jpg'],
  ['travel', 'public/apps/reizen.html', '/apps/reizen.html', '#inhoud', 'travel-heritage-v2.jpg'],
  ['foundation', 'public/apps/foundation/os-publiek.html', '/apps/foundation/os-publiek.html', '#main', 'foundation-heritage-v2.jpg']
];

test('exact de vier canonieke homes laden één runtime, stijl en eigen wereldbeeld', () => {
  for (const [wereld, bestand, , , beeld] of HOMES) {
    const html = lees(bestand);
    assert.match(html, new RegExp('<body[^>]+data-rtg-world="' + wereld +
      '"[^>]+data-rtg-world-dashboard="' + wereld + '"[^>]+data-rtg-vandaag-luxe(?:\\s|>)'), bestand);
    assert.equal((html.match(/\/shared\/rtg-vandaag-luxe\.css/g) || []).length, 1, bestand);
    assert.equal((html.match(/\/shared\/rtg-vandaag-luxe\.js/g) || []).length, 1, bestand);
    assert.equal((html.match(new RegExp('/images/worlds/heritage/' + beeld, 'g')) || []).length, 1, bestand);
    assert.doesNotMatch(html, /wereld-atlas\.jpg/, bestand + ' mag geen quadrant uit de oude atlas laden');
  }
});

test('runtime commit uitsluitend de bestaande main en bouwt geen presentatielaag', () => {
  assert.equal(luxe.CONTRACT.versie, 3);
  assert.equal(luxe.CONTRACT.gereed, 'data-rtg-world-dashboard-ready');
  assert.equal(luxe.CONTRACT.netwerk, false);
  assert.equal(luxe.CONTRACT.opslag, false);
  assert.deepEqual(Object.fromEntries(Object.entries(luxe.WERELDEN)
    .map(([wereld, cfg]) => [wereld, [cfg.pad, cfg.hoofd]])), {
    living: ['/apps/rtg.html', '#inhoud'],
    work: ['/apps/kantoor.html', '#inhoud'],
    travel: ['/apps/reizen.html', '#inhoud'],
    foundation: ['/apps/foundation/os-publiek.html', '#main']
  });
  assert.doesNotMatch(JS, /createElement|insertBefore|appendChild|innerHTML/);
  assert.doesNotMatch(JS + CSS, /rtg-vandaag-surface-cover|rtg-vandaag-luxe__/);
  assert.doesNotMatch(JS, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/);
});

function documentVoor({ wereld = 'living', dashboard = wereld, pad = '/apps/rtg.html',
  luxeWaarde = '', frame = false, embed = '' } = {}) {
  const attrs = new Map([
    ['data-rtg-vandaag-luxe', luxeWaarde],
    ['data-rtg-world', wereld],
    ['data-rtg-world-dashboard', dashboard]
  ]);
  const klassen = new Set();
  const hoofdAttrs = new Map();
  const hoofd = {
    classList: {
      add: naam => klassen.add(naam), remove: naam => klassen.delete(naam),
      contains: naam => klassen.has(naam)
    },
    setAttribute: (naam, waarde) => hoofdAttrs.set(naam, waarde),
    removeAttribute: naam => hoofdAttrs.delete(naam)
  };
  const body = {
    classList: { contains: () => false },
    hasAttribute: naam => attrs.has(naam),
    getAttribute: naam => attrs.has(naam) ? attrs.get(naam) : null,
    setAttribute: (naam, waarde) => attrs.set(naam, waarde),
    removeAttribute: naam => attrs.delete(naam)
  };
  const view = { location: { pathname: pad, search: embed }, URLSearchParams };
  view.self = frame ? {} : view;
  view.top = frame ? {} : view;
  const document = {
    body, documentElement: { classList: { contains: () => false }, getAttribute: () => null },
    defaultView: view,
    querySelector: selector => selector === luxe.WERELDEN[wereld]?.hoofd ? hoofd :
      selector === '.rtg-world-dashboard[data-rtg-dashboard-world]' && klassen.has('rtg-world-dashboard') ? hoofd : null,
    getElementById: () => null
  };
  return { document, attrs, klassen, hoofdAttrs };
}

test('alleen marker, wereld en canonieke route kunnen het dashboard committen', () => {
  const geldig = documentVoor();
  assert.equal(luxe.activeer(geldig.document), geldig.document.querySelector('#inhoud'));
  assert.equal(geldig.attrs.get('data-rtg-world-dashboard-ready'), 'true');
  assert.equal(geldig.attrs.get('data-rtg-vandaag-render'), 'dashboard');
  assert.equal(geldig.klassen.has('rtg-world-dashboard'), true);
  assert.equal(geldig.hoofdAttrs.get('data-rtg-dashboard-world'), 'living');

  for (const ongeldig of [
    documentVoor({ dashboard: 'travel' }),
    documentVoor({ pad: '/apps/agenda.html' }),
    documentVoor({ luxeWaarde: 'surface' }),
    documentVoor({ frame: true }),
    documentVoor({ embed: '?embed=1' })
  ]) {
    assert.equal(luxe.activeer(ongeldig.document), null);
    assert.equal(ongeldig.attrs.has('data-rtg-world-dashboard-ready'), false);
  }
});

test('Foundation stadsquery blijft een toestand van hetzelfde dashboard', () => {
  const stad = documentVoor({
    wereld: 'foundation', pad: '/apps/foundation/os-publiek.html?stad=almere'
  });
  stad.document.defaultView.location.pathname = '/apps/foundation/os-publiek.html';
  stad.document.defaultView.location.search = '?stad=almere';
  assert.equal(luxe.routeKlopt(stad.document, 'foundation'), true);
  assert.ok(luxe.activeer(stad.document));
  assert.equal(stad.attrs.get('data-rtg-world-dashboard-ready'), 'true');
});

test('de vier bestaande panelstructuren en hun echte hoofdacties blijven bron-DOM', () => {
  const verwachtingen = [
    ['public/apps/rtg.html', ['class="dag"', 'class="kompas"', 'id="reisdossier"',
      'class="rtg-dashboard-hero-cta" href="/apps/vandaag.html"']],
    ['public/apps/kantoor.html', ['class="doelgroep"', 'class="cv-rij"', 'id="werkdag"', 'id="poorten"']],
    ['public/apps/reizen.html', ['class="dagdek"', 'class="strook"', 'class="kaartraster"',
      'data-naar-blad="reizen"']],
    ['public/apps/foundation/os-publiek.html', ['class="onthaal"', 'class="tweeluik"',
      'class="doen"', 'class="band"']]
  ];
  for (const [bestand, stukken] of verwachtingen) {
    const html = lees(bestand);
    for (const stuk of stukken) assert.ok(html.includes(stuk), bestand + ': ' + stuk);
  }
});

test('iedere wereld erft centraal materiaal en gebruikt een eigen brede foto', () => {
  const paletten = {
    living: ['#f4f0e8', '#fbf8f2', '#211e19', '#745718'],
    work: ['#0c1112', '#141b1c', '#f0f2ec', '#75b8b1'],
    travel: ['#14090e', '#231016', '#f7f0e6', '#a72049'],
    foundation: ['#071522', '#0b2032', '#f2f2ea', '#d0b66e']
  };
  for (const [wereld, kleuren] of Object.entries(paletten)) {
    const blok = CSS.match(new RegExp('body\\[data-rtg-vandaag-luxe\\]\\[data-rtg-world="' +
      wereld + '"\\]\\{([^}]+)'));
    assert.ok(blok, wereld);
    for (const kleur of kleuren) assert.ok(blok[1].includes(kleur), wereld + ': ' + kleur);
    for (const token of ['bg', 'card', 'card-strong', 'ink', 'muted', 'line', 'signature', 'metal']) {
      assert.ok(blok[1].includes('var(--rtg-world-' + token + ','),
        wereld + ' erft --rtg-world-' + token + ' niet');
    }
  }
  for (const beeld of HOMES.map(rij => rij[4]))
    assert.ok(JS.includes('/images/worlds/heritage/' + beeld), beeld + ' mist uit het runtimecontract');
  assert.doesNotMatch(CSS + JS, /wereld-atlas\.jpg/);
  assert.match(CSS, /background-size:auto,auto,cover,auto/);
});

test('de vier homes gebruiken één focuslaag en rustige inhoudsdiepte', () => {
  assert.match(CSS, /\.dagkop,[\s\S]*\.doelgroep,[\s\S]*\.kaartraster,[\s\S]*\.onthaal\{[\s\S]*box-shadow:var\(--rtg-v-depth-focus\)/);
  assert.match(CSS, /Heritage-diepte[\s\S]*box-shadow:var\(--rtg-v-depth-content\)/);
  assert.match(CSS, /\.dagkaart-volgend\{[^}]*border-left:2px solid var\(--rtg-v-signature\)/s);
  assert.match(CSS, /\.rahulsnel\{[^}]*border-left:2px solid var\(--rtg-v-signature\)/s);
  assert.match(CSS, /\.band\{[^}]*border-top:2px solid/s);
  assert.match(CSS, /@media\(hover:hover\) and \(pointer:fine\)/);
});

test('Agenda surface behoudt een stille Heritage-atmosfeer', () => {
  const blok = CSS.match(/data-rtg-vandaag-luxe="surface"\]\[data-rtg-world="living"\]\[data-kantoor-tool="agenda"\]\{([^}]+)\}/);
  assert.ok(blok, 'Agenda heeft geen gerichte surface');
  assert.ok(blok[1].includes('--rtg-world-photo'), 'Agenda verliest wereldfotografie');
  assert.ok(blok[1].includes('--rtg-world-ground'), 'Agenda verliest wereldgrond');
  assert.doesNotMatch(blok[1], /background\s*:\s*none/);
});

test('Travel toont geen bestemming of zekerheid voordat de reisbron antwoordt', () => {
  const html = lees('public/apps/reizen.html');
  assert.doesNotMatch(html, /<h1 id="titelVandaag">IBIZA<\/h1>/);
  assert.doesNotMatch(html, /<p class="sub" id="dagzin">Alles staat klaar\.<\/p>/);
  assert.match(html, /<h1 id="titelVandaag">Uw reizen<\/h1>/);
  assert.match(html, /function zetReisdek\(reizen, toestand\)/);
  assert.match(html, /const bestemming = String\(eerste\.bestemming \|\| ''\)\.trim\(\)/);
  assert.match(html, /zetReisdek\(reizen, 'geladen'\)/);
  assert.match(html, /zetReisdek\(\[\], 'fout'\)/);
});

test('dashboardtop blijft onder een viewport en de rasters schalen tot 320px', () => {
  assert.match(CSS, /min-height:clamp\(18rem,31vw,29rem\)/);
  assert.match(CSS, /min-height:clamp\(20rem,34vw,31rem\)/);
  assert.match(CSS, /min-height:clamp\(20rem,35vw,32rem\)/);
  assert.match(CSS, /@media\(max-width:780px\)/);
  assert.match(CSS, /@media\(max-width:390px\)/);
  assert.match(CSS, /prefers-reduced-motion:reduce/);
  assert.match(CSS, /:focus-visible/);
  for (const match of CSS.matchAll(/border-radius\s*:\s*([^;}]+)/g))
    assert.ok(['0', '50%'].includes(match[1].trim()), 'ongeldige radius: ' + match[1]);
});

test('ieder wereldbeeld heeft controleerbare lokale herkomst en de runtime blijft onder 10 KiB', () => {
  const map = path.join(ROOT, 'public/images/worlds/heritage');
  const herkomst = JSON.parse(fs.readFileSync(path.join(map, 'HERKOMST.json'), 'utf8'));
  assert.equal(herkomst.assets.length, 4);
  for (const record of herkomst.assets) {
    const beeld = fs.readFileSync(path.join(map, record.bestand));
    assert.equal(crypto.createHash('sha256').update(beeld).digest('hex'), record.sha256, record.bestand);
    assert.ok(beeld.byteLength > 200 * 1024, record.bestand + ' is geen volwaardig bronbeeld');
  }
  assert.ok(Buffer.byteLength(JS) < 10 * 1024, Buffer.byteLength(JS) + ' bytes');
});
