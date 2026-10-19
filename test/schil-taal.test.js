/* DE SCHIL SPREEKT DE TAAL VAN DE PAGINA.

   Gevonden door TravelOS op /apps/arrival.html (19 oktober 2026): op een toestel
   in het Engels stond in het personenpaneel van de werktafel "View your
   conversations" boven een pagina die verder Nederlands was. De schilteksten
   liepen wel door de i18n-laag, maar die zet zonder keuze van het lid de
   toesteltaal op elke tekst MET een sleutel, terwijl de tekst zonder sleutel
   bewust Nederlands blijft tot het lid kiest (i18n.js, het vangnet). Van de
   298 pagina's met de schil dragen er 288 zelf geen sleutel: die werden dus
   half Engels.

   De regel: zonder expliciete taalkeuze volgt de schil de toesteltaal alleen
   als de pagina zelf vertaald wordt (eigen data-i18n-sleutels). Na een keuze
   vertaalt het vangnet de hele pagina en volgt de schil gewoon. En de
   taaldoorgifte aan een app in het frame maakt van de toesteltaal geen
   bewaarde keuze.

   Draai los: node --test test/schil-taal.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MAP = path.join(__dirname, '..', 'public/shared/interface');

function element(tag) {
  const attrs = {};
  return { tagName: tag.toUpperCase(), dataset: {}, className: '', textContent: '', children: [],
    setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return k in attrs ? attrs[k] : null },
    appendChild(c) { this.children.push(c); return c; } };
}

/* Een pagina in een nep-DOM: `eigenSleutels` zegt of de pagina zelf data-i18n draagt. */
function pagina({ lang, chosen, eigenSleutels }) {
  const document = {
    createElement: element,
    querySelector(sel) {
      if (!/data-i18n/.test(sel)) return null;
      return eigenSleutels ? element('p') : null;
    }
  };
  const window = { document };
  window.RTGi18n = lang == null ? undefined : {
    lang, chosen,
    /* Hetzelfde antwoord als inhoudVolgt() in i18n.js; die regel zelf toetst schil-taal.e2e.js in de browser. */
    inhoudVolgt() { return this.lang === 'nl' || !!this.chosen || !!eigenSleutels; },
    t(k, f) { if (this.lang === 'nl') return f; const v = window.I18N[this.lang] && window.I18N[this.lang][k]; return v != null ? v : f; }
  };
  window.window = window;
  const ctx = vm.createContext(window);
  for (const f of ['world-desktop-copy.js', 'world-widget-copy.js']) vm.runInContext(fs.readFileSync(path.join(MAP, f), 'utf8'), ctx);
  return window;
}

test('toesteltaal Engels, pagina zonder eigen sleutels, geen keuze: de schil blijft Nederlands', () => {
  const w = pagina({ lang: 'en', chosen: false, eigenSleutels: false });
  assert.equal(w.RTGDesktopUI.value('messages'), 'Bekijk uw gesprekken');
  assert.equal(w.RTGDesktopUI.value('contacts'), 'Bekijk uw contacten');
  assert.equal(w.RTGWidgetCopy('loading'), 'Uw gegevens worden opgehaald.');
  /* En de i18n-laag mag het later niet alsnog omzetten: geen sleutel op het element. */
  const kop = w.RTGDesktopUI.copy(w.RTGDesktopUI.el('h4'), 'friends');
  assert.equal(kop.textContent, 'Vrienden en collega’s');
  assert.equal(kop.dataset.i18n, undefined, 'een schiltekst met sleutel wordt door i18n.apply alsnog Engels');
});

test('na een expliciete taalkeuze volgt de schil de gekozen taal', () => {
  const w = pagina({ lang: 'en', chosen: true, eigenSleutels: false });
  assert.equal(w.RTGDesktopUI.value('messages'), 'View your conversations');
  assert.equal(w.RTGWidgetCopy('loading'), 'Your information is loading.');
  assert.equal(w.RTGDesktopUI.copy(w.RTGDesktopUI.el('h4'), 'friends').dataset.i18n, 'desktop.friends');
});

test('een pagina die zelf vertaald wordt, neemt de schil mee in de toesteltaal', () => {
  const w = pagina({ lang: 'en', chosen: false, eigenSleutels: true });
  assert.equal(w.RTGDesktopUI.value('messages'), 'View your conversations');
});

test('zonder i18n-laag of in het Nederlands: Nederlands', () => {
  assert.equal(pagina({ lang: null }).RTGDesktopUI.value('messages'), 'Bekijk uw gesprekken');
  assert.equal(pagina({ lang: 'nl', chosen: true, eigenSleutels: true }).RTGDesktopUI.value('messages'), 'Bekijk uw gesprekken');
});

test('de taaldoorgifte aan een app in het frame bewaart geen taalkeuze', () => {
  const frame = fs.readFileSync(path.join(MAP, 'world-desktop-frame.js'), 'utf8');
  const sets = frame.match(/RTGi18n\.set\([^;]*\)/g) || [];
  assert.ok(sets.length >= 2, 'het frame geeft de taal door');
  for (const s of sets) assert.match(s, /,\s*false\)$/, 'doorgifte zonder bewaren: ' + s);
});
