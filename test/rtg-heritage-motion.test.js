/* De motionlaag mag intentie bevestigen, maar nooit zelf een handeling, route
   of onmeetbare voortgang verzinnen. De tests bewaken zowel het CSS-contract
   als de toegankelijke statuskoppeling. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const motion = require('../public/shared/rtg-heritage-motion.js');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'public/shared/rtg-heritage-motion.css'), 'utf8');
const JS = fs.readFileSync(path.join(ROOT, 'public/shared/rtg-heritage-motion.js'), 'utf8');

function attrs(begin = {}) {
  const waarden = { ...begin };
  return {
    waarden,
    getAttribute: naam => Object.hasOwn(waarden, naam) ? waarden[naam] : null,
    setAttribute: (naam, waarde) => { waarden[naam] = String(waarde); },
    removeAttribute: naam => { delete waarden[naam]; }
  };
}

function actie(staat = 'idle') {
  const kopieen = ['idle', 'pending', 'success', 'error'].map(naam =>
    Object.assign({ textContent: naam }, attrs({ 'data-rtg-action-copy-for': naam })));
  const houder = attrs();
  const elementAttrs = attrs({ 'data-rtg-morph-action': '', 'data-rtg-action-state': staat });
  const stijl = {};
  return Object.assign(elementAttrs, {
    kopieen,
    houder,
    matches: selector => selector === '[data-rtg-morph-action]',
    querySelectorAll: selector => selector === '[data-rtg-action-copy-for]' ? kopieen : [],
    querySelector(selector) {
      if (selector === '[data-rtg-action-copy]') return houder;
      const gevonden = /data-rtg-action-copy-for="([^"]+)"/.exec(selector);
      return gevonden ? kopieen.find(k => k.getAttribute('data-rtg-action-copy-for') === gevonden[1]) || null : null;
    },
    style: {
      setProperty: (naam, waarde) => { stijl[naam] = waarde; },
      removeProperty: naam => { delete stijl[naam]; },
      waarden: stijl
    }
  });
}

function zonderKopie(staat) {
  const knop = actie(staat);
  const index = knop.kopieen.findIndex(k => k.getAttribute('data-rtg-action-copy-for') === staat);
  knop.kopieen.splice(index, 1);
  return knop;
}

test('de vier tijdklassen zijn centraal en binnen de doctrinegrenzen', () => {
  const verwacht = { direct: [70, 120, 100], functional: [160, 240, 200], structural: [260, 420, 340], atmospheric: [450, 700, 560] };
  for (const [naam, [min, max, exact]] of Object.entries(verwacht)) {
    const match = CSS.match(new RegExp('--rtg-time-' + naam + ':(\\d+)ms'));
    assert.ok(match, naam + ' mist');
    const waarde = Number(match[1]);
    assert.equal(waarde, exact);
    assert.ok(waarde >= min && waarde <= max, naam + ' valt buiten de doctrine');
    assert.match(CSS, new RegExp('--rtg-motion-' + naam + ':var\\(--rtg-time-' + naam + '\\)'));
  }
});

test('iedere wereld heeft één subtiele, eigen bewegingssignatuur', () => {
  for (const wereld of ['living', 'travel', 'work', 'foundation']) {
    const blok = CSS.match(new RegExp('data-rtg-world="' + wereld + '"\\]\\{([^}]+)\\}'));
    assert.ok(blok, wereld + ' mist');
    for (const token of ['--rtg-motion-world-ease:', '--rtg-motion-world-x:', '--rtg-motion-world-y:']) {
      assert.ok(blok[1].includes(token), wereld + ' mist ' + token);
    }
  }
  assert.match(CSS, /data-rtg-world="travel"[^}]*--rtg-motion-world-x:8px/s);
  assert.match(CSS, /data-rtg-world="work"[^}]*--rtg-motion-world-y:3px/s);
});

test('feedback is opt-in, pointerbewust en verandert nooit de layout', () => {
  assert.match(CSS, /\[data-rtg-motion="action"\]/);
  assert.match(CSS, /@media\(hover:hover\) and \(pointer:fine\)/);
  assert.match(CSS, /:focus-visible/);
  const actieKiezer = ':where([data-rtg-motion="action"],[data-rtg-morph-action])';
  assert.ok(CSS.includes(actieKiezer + ':not(:disabled):not([aria-disabled="true"]):hover'),
    'hover hoort bij de actie zelf, niet bij een toevallige afstammeling');
  assert.ok(CSS.includes(actieKiezer + ':not(:disabled):not([aria-disabled="true"]):active'),
    'press hoort bij de actie zelf, niet bij een toevallige afstammeling');
  assert.ok(CSS.includes(actieKiezer + ':is(:disabled,[aria-disabled="true"])'),
    'disabled hoort bij de actie zelf, niet bij een toevallige afstammeling');
  assert.doesNotMatch(CSS, /\[data-rtg-morph-action\]\)\s+:(?:not|is)\(/,
    'een witruimtecombinator zou de feedback naar een afstammeling verplaatsen');
  assert.match(CSS, /touch-action:manipulation/);
  assert.doesNotMatch(CSS, /transition(?:-property)?\s*:\s*all/);
  assert.doesNotMatch(CSS, /transition-property:[^;}]*\b(?:width|height|top|right|bottom|left|margin|padding)\b/);
});

test('morphteksten delen één gridcel en bekende voortgang blijft expliciet', () => {
  assert.match(CSS, /\[data-rtg-action-copy-for\]\{[^}]*grid-area:1\/1/s);
  for (const staat of motion.STATES) {
    assert.match(CSS, new RegExp('data-rtg-action-copy-state="' + staat + '"'));
  }
  assert.match(CSS, /:not\(\[data-rtg-action-progress\]\)::after/);
  assert.doesNotMatch(CSS, /@keyframes|infinite/);
});

test('status synchroniseert zichtbare en voorgelezen betekenis op dezelfde knop', () => {
  const knop = actie('pending');
  assert.equal(motion.syncAction(knop), 'pending');
  assert.equal(knop.getAttribute('aria-busy'), 'true');
  assert.equal(knop.getAttribute('data-rtg-action-copy-state'), 'pending');
  assert.equal(knop.houder.getAttribute('aria-live'), 'polite');
  assert.equal(knop.houder.getAttribute('aria-atomic'), 'true');
  assert.equal(knop.kopieen.find(k => k.textContent === 'pending').getAttribute('aria-hidden'), 'false');
  assert.ok(knop.kopieen.filter(k => k.textContent !== 'pending').every(k => k.getAttribute('aria-hidden') === 'true'));

  assert.equal(motion.setAction(knop, 'success'), true);
  assert.equal(knop.getAttribute('aria-busy'), 'false');
  assert.equal(knop.getAttribute('data-rtg-action-copy-state'), 'success');
  assert.equal(knop.kopieen.find(k => k.getAttribute('data-rtg-action-copy-for') === 'success').textContent, 'success');
  assert.equal(motion.setAction(knop, 'onbekend'), false);

  const incompleet = zonderKopie('success');
  assert.equal(motion.syncAction(incompleet), 'idle', 'niet-onderbouwd succes valt veilig terug');
  assert.equal(incompleet.getAttribute('data-rtg-action-state'), 'idle');
  assert.equal(incompleet.getAttribute('aria-busy'), 'false');
  assert.equal(motion.setAction(incompleet, 'success'), false);
});

test('voortgang is begrensd en wordt bij eindstatus weer verwijderd', () => {
  const knop = actie('pending');
  assert.equal(motion.setProgress(knop, 1.8), true);
  assert.equal(knop.getAttribute('data-rtg-action-progress'), '1');
  assert.equal(knop.style.waarden['--rtg-action-progress'], '1');
  assert.equal(motion.setAction(knop, 'error'), true);
  assert.equal(knop.getAttribute('data-rtg-action-progress'), null);
  assert.equal(knop.style.waarden['--rtg-action-progress'], undefined);
  assert.equal(motion.setProgress(knop, 'geen getal'), false);
  assert.equal(motion.setProgress(actie('idle'), .5), false, 'een rustende actie toont geen voortgang');
});

test('reduced motion respecteert toestel én RTG-profiel zonder inhoud te verbergen', () => {
  const doc = { documentElement: { classList: { contains: naam => naam === 'rtg-stil' } } };
  assert.equal(motion.allowsMotion({ matchMedia: () => ({ matches: false }) }, doc), false);
  const normaal = { documentElement: { classList: { contains: () => false } } };
  assert.equal(motion.allowsMotion({ matchMedia: () => ({ matches: true }) }, normaal), false);
  assert.equal(motion.allowsMotion({ matchMedia: () => ({ matches: false }) }, normaal), true);
  assert.match(CSS, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(CSS, /html\.rtg-stil/);
  assert.match(CSS, /\[data-rtg-motion="reveal"\]\{opacity:1!important\}/);
  const rustig = CSS.slice(CSS.indexOf('@media(prefers-reduced-motion:reduce)'));
  assert.doesNotMatch(rustig, /display\s*:\s*none|visibility\s*:\s*hidden/);
});

test('de helper neemt geen klik, toetsen, sleep, route of netwerk over', () => {
  assert.doesNotMatch(JS, /addEventListener\(['"](?:click|pointer|touch|key|drag)/);
  assert.doesNotMatch(JS, /fetch\s*\(|XMLHttpRequest|sendBeacon|location\.|history\.|\.click\s*\(/);
  assert.doesNotMatch(JS, /innerHTML|replaceWith|removeChild/);
  assert.match(JS, /attributeFilter:\s*\['data-rtg-action-state'\]/);
});

test('heritage laadt motion vóór materialen en componenten; basis dedupet de helper', () => {
  const heritage = fs.readFileSync(path.join(ROOT, 'public/shared/rtg-heritage.css'), 'utf8');
  assert.ok(heritage.indexOf('rtg-heritage-motion.css') < heritage.indexOf('rtg-heritage-materials.css'));
  const deel = fs.readFileSync(path.join(ROOT, 'public/shared/basis/basis-01a-motion.js'), 'utf8');
  assert.match(deel, /getElementById\('rtgHeritageMotionJs'\)/);
  assert.match(deel, /script\[src\^="\/shared\/rtg-heritage-motion\.js"\]/);
  assert.equal((deel.match(/\.src = '\/shared\/rtg-heritage-motion\.js'/g) || []).length, 1);
  assert.ok(fs.statSync(path.join(ROOT, 'public/shared/basis/basis-01a-motion.js')).size < 10 * 1024);
});
