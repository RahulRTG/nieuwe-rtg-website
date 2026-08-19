/* WAT DE WERKTAFEL ONTHOUDT, en waarom dat drie beloftes tegelijk is.

   WERELD.md beloofde tot 19 augustus 2026 dat inloggen, je laatste blad sluiten
   en op Home drukken alle drie op dezelfde lege werktafel uitkwamen. Die eerste
   is bewust omgedraaid: je komt terug waar je gebleven was. De andere twee
   moeten het blijven doen, want zonder een van beide is er geen weg terug naar
   een schone tafel -- en dan is hervatten geen gemak maar een gevangenis.

   Het mechanisme is expres klein: sync() schrijft de stand van dat moment weg,
   en NUL BLADEN WEGSCHRIJVEN IS HET WISSEN. Home en het laatste blad sluiten
   hoeven daardoor geen eigen regel; ze komen allebei via sync() uit op een leeg
   geheugen. Deze toets bewaakt precies dat: dat er geen vierde weg ontstaat.

   Draait zonder browser: geheugen.js praat alleen met localStorage, dus een
   nagemaakte window volstaat en de bewering is zonder Playwright te toetsen.
   De schermkant staat in test/werktafel.e2e.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* Array.from() OM ELKE VERGELIJKING HEEN, en dat is geen smaak. geheugen.js
   draait in een eigen vm-context, dus de arrays die eruit komen hebben een
   ANDERE Array-prototype dan die hier. assert.deepEqual (strict) vergelijkt de
   prototype mee en meldt dan "same structure but not reference-equal" op twee
   lijsten die er identiek uitzien -- een half uur zoeken waard. */
const lijst = (x) => Array.from(x);

function laad() {
  const bak = {};
  const opslag = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(bak, k) ? bak[k] : null),
    setItem: (k, v) => { bak[k] = String(v); },
    removeItem: (k) => { delete bak[k]; }
  };
  const ctx = { window: null, localStorage: opslag };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public/shared/command/geheugen.js'), 'utf8'), ctx);
  return { G: ctx.window.RTGCommandGeheugen, bak };
}

test('twee bladen gaan erin en komen er hetzelfde uit', () => {
  const { G } = laad();
  G.schrijf([{ url: '/apps/geld-command.html', titel: 'Geld' },
    { url: '/apps/media.html', titel: 'Media' }], 1);
  const g = G.lees();
  assert.deepEqual(lijst(g.bladen.map((b) => b.url)), ['/apps/geld-command.html', '/apps/media.html']);
  assert.deepEqual(lijst(g.bladen.map((b) => b.titel)), ['Geld', 'Media']);
  assert.equal(g.actief, 1);
});

test('nul bladen wegschrijven IS het wissen, en dat is de weg terug', () => {
  /* Dit is de kern. Home roept wis() en dan sync(); het laatste blad sluiten
     komt ook via sync() uit op nul bladen. Beide zijn hier hetzelfde geval, en
     daarom hoeft er voor geen van beide een aparte regel te bestaan.

     DE MUTATIE: laat schrijf() bij een lege lijst gewoon terugkeren in plaats
     van removeItem() te doen. Dan blijft het oude geheugen staan, komt een lid
     na Home bij een herstart weer in zijn oude bladen terecht, en is de schone
     tafel onbereikbaar. */
  const { G, bak } = laad();
  G.schrijf([{ url: '/apps/media.html', titel: 'Media' }], 0);
  assert.ok(bak[G.SLEUTEL], 'voorwaarde: er staat iets in');
  G.schrijf([], -1);
  assert.equal(G.lees(), null, 'na nul bladen hoort er niets meer te staan');
  assert.equal(bak[G.SLEUTEL], undefined, 'en de sleutel zelf is weg, niet leeg');
});

test('een adres naar buiten komt er niet in terug', () => {
  /* Een blad is een iframe. Wat hier staat komt uit opslag die elke pagina van
     dit huis kan zetten, dus een adres naar een vreemde site zou die site in de
     schil trekken -- met de sessie van het lid eromheen. Alleen een pad dat met
     EEN schuine streep begint is per definitie hier.

     DE MUTATIE: haal de filter uit lees(). Dan komt https://example.com terug
     als blad. */
  const { G, bak } = laad();
  for (const url of ['https://example.com/x', '//example.com/x', 'javascript:alert(1)', 'data:text/html,x']) {
    bak[G.SLEUTEL] = JSON.stringify({ bladen: [{ url, titel: 'Buiten' }], actief: 0 });
    assert.equal(G.lees(), null, url + ' hoort geweigerd te worden');
  }
  bak[G.SLEUTEL] = JSON.stringify({ bladen: [{ url: '/apps/media.html', titel: 'Media' }], actief: 0 });
  assert.equal(G.lees().bladen.length, 1, 'een eigen pad komt er wel door');
});

test('kapotte of vreemde inhoud levert niets op, en geen uitzondering', () => {
  /* localStorage is geen contract: een oude versie, een half geschreven regel
     of een mens met een console kan er alles in zetten. Kapot hoort hier `null`
     te zijn en geen fout die de hele werktafel meeneemt. */
  const { G, bak } = laad();
  for (const ruw of ['{', 'null', '[]', '{"bladen":"nee"}', '{"bladen":[]}', '{"bladen":[{}]}']) {
    bak[G.SLEUTEL] = ruw;
    assert.equal(G.lees(), null, ruw + ' hoort null te geven');
  }
});

test('meer dan twee bladen worden er twee: de werktafel draagt er nooit meer', () => {
  const { G } = laad();
  G.schrijf([{ url: '/a.html', titel: 'A' }, { url: '/b.html', titel: 'B' },
    { url: '/c.html', titel: 'C' }], 2);
  assert.deepEqual(lijst(G.lees().bladen.map((b) => b.url)), ['/a.html', '/b.html']);
});

test('een actieve index buiten bereik wordt teruggebracht in plaats van gevolgd', () => {
  /* Anders zou select() met een index buiten de lijst worden aangeroepen en
     staat er een werktafel zonder actief blad. */
  const { G, bak } = laad();
  bak[G.SLEUTEL] = JSON.stringify({ bladen: [{ url: '/a.html', titel: 'A' }], actief: 7 });
  assert.equal(G.lees().actief, 0);
  bak[G.SLEUTEL] = JSON.stringify({ bladen: [{ url: '/a.html', titel: 'A' }], actief: -3 });
  assert.equal(G.lees().actief, 0);
});

test('het geheugen wordt bij uitloggen gewist', () => {
  /* Niet in deze module maar in app-main-04.js, naast rtg_actieve_tab. Zonder
     die regel ziet de volgende mens op een gedeeld toestel de titels van de
     vorige -- dat is niet alleen slordig maar een lek.

     DE MUTATIE: haal de removeItem-regel uit doLogout(). */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public/apps/app-main/app-main-04.js'), 'utf8');
  const uitlog = bron.slice(bron.indexOf('async function doLogout'));
  assert.match(uitlog.slice(0, 900), /removeItem\('rtg_cmd_bladen'\)/,
    'doLogout() wist het werktafelgeheugen niet meer');
});
