/* WAT TELT ALS "HET SCHERM ZEGT HET ZELF" -- EEN GESLOTEN LIJST PER VELD.

   scripts/edgedekking.js telt per veld niet alleen of er een waarde is, maar ook
   of het SCHERM die zelf leverde. Dat onderscheid is de hele reden dat de
   dekkingsmeter iets zegt: de context is op bijna elk los scherm de titel van
   het casco, en de wereld komt uit de wereldkaart. Tot ronde 2 besliste een
   patroon (`^scherm`, plus het pagina-attribuut) en dat liet twee dingen door
   die geen publicatie van het scherm zijn: `data-rtg-world` (een gebakken kopie
   van het MANIFEST) en elke herkomst die toevallig met "scherm" begint.

   Wat hier vastligt:

   1. VOLLEDIG: elk veld van het contract staat in ZELF, en een veld dat er niet
      staat is een fout en geen stille nee;
   2. PER VELD: wat telt en wat nooit telt -- wereld nooit (K-reikwijdte), een
      `blad` nooit, een terugval (casco, route, padtabel, toestel) nooit;
   3. DE BESTURINGSPROEF: een los scherm dat alles zelf publiceert, haalt voor
      context, object, activiteit, hoofdactie en trust ook echt `zelf` -- anders
      kan een tikfout in ZELF een veld stil op nul zetten;
   4. DE SCHIL (in vm, met het echte register, de echte brug en het echte
      blikveld): een context die via de brug binnenkomt heet `blad` en `blad:rail`
      en telt voor geen enkel veld als zelf;
   5. DE BRON: van de scripts die app.html laadt (plus alles onder public/shared,
      want de Edge-keten laadt daarvandaan na), zet alleen adaptief/brug.js een
      context in RTGAdaptief. Dat is de grond onder het etiket `blad`: stond er
      een tweede publicist in de schil, dan zou `blad` over hem liegen.
      LEXICAAL, en dat staat er even groot bij: een publicist die de naam via een
      omweg aanroept, ziet deze scan niet.

   DE MUTATIES, elk nagetrokken: voeg 'route' toe aan ZELF.wereld (toets 2 zakt),
   voeg 'blad' toe aan ZELF.context (toets 2 zakt), haal de trust-regel uit ZELF
   (toets 1 zakt), geef in de schil weer 'scherm' (toets 4 zakt), zet een
   RTGAdaptief.context-aanroep in een schilscript (toets 5 zakt). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORTEL = path.join(__dirname, '..');
const meter = require('../scripts/edgedekking.js');
const { zelf, ZELF, VELDEN } = meter;
const { zonderCommentaar } = require('../scripts/lib/bron.js');
const { maak } = require('../public/shared/edge/blikveld.js');
const Hoofdactie = require('../public/shared/edge/blikveld-hoofdactie.js');
const leer = require('../public/shared/adaptief.js');
const gram = require('../public/shared/adaptief/grammatica.js');
const lees = (rel) => fs.readFileSync(path.join(WORTEL, rel), 'utf8');

test('1. elk veld van het contract staat in ZELF, en een onbekend veld is een fout', () => {
  assert.deepEqual(Object.keys(ZELF).sort(), VELDEN.slice().sort());
  for (const v of VELDEN) assert.ok(Array.isArray(ZELF[v]) && Object.isFrozen(ZELF[v]), v + ' draagt een bevroren lijst');
  assert.ok(Object.isFrozen(ZELF), 'de lijst zelf is bevroren');
  assert.throws(() => zelf('bevoegdheid', 'scherm'), /ZELF/, 'een veld buiten het contract is een fout, geen stille nee');
});

test('2. per veld: wat telt als zelf, en wat nooit', () => {
  /* Per veld elke herkomst die het blikveld kan geven (EDGE.md par. 2, plus de
     etiketten van de schil), en welke daarvan het scherm zelf is. */
  const tabel = {
    identiteit: { ja: [], nee: ['edge-signaal', 'geen', ''] },
    wereld: { ja: [], nee: ['route', 'pagina', 'blad', 'geen'] },
    context: { ja: ['scherm'], nee: ['blad', 'edge-casco', 'document', 'schermx', ''] },
    object: { ja: ['scherm'], nee: ['blad', 'geen'] },
    activiteit: { ja: ['scherm'], nee: ['blad', 'geen'] },
    presence: { ja: [], nee: ['edge-signaal', 'geen'] },
    voortzetting: { ja: [], nee: ['toestel:werktafel', 'edge-signaal', 'geen'] },
    hoofdactie: { ja: ['scherm:data-hoofdactie'], nee: ['blad:data-hoofdactie', 'blad', 'edge-padtabel', 'scherm', 'geen'] },
    trust: { ja: ['scherm:rail'], nee: ['blad:rail', 'toestel', 'scherm', 'geen'] }
  };
  assert.deepEqual(Object.keys(tabel).sort(), VELDEN.slice().sort(), 'de proef dekt elk veld');
  for (const [v, t] of Object.entries(tabel)) {
    for (const h of t.ja) assert.equal(zelf(v, h), true, v + ': ' + h + ' is het scherm zelf');
    for (const h of t.nee) assert.equal(zelf(v, h), false, v + ': ' + JSON.stringify(h) + ' is niet het scherm zelf');
    assert.equal(zelf(v, undefined), false, v + ': zonder herkomst geen zelf');
  }
});

/* Een los scherm, nagemaakt: het register geeft de context die het scherm zelf
   zette, en het scherm wijst zijn hoofdactie aan met data-hoofdactie. */
function losVenster(ctx) {
  const knop = { hidden: false, disabled: false, textContent: '+ Nieuw', attrs: {},
    getAttribute(n) { return this.attrs[n] === undefined ? null : this.attrs[n]; } };
  const d = { title: 'Proef', body: { getAttribute(n) { return n === 'data-rtg-world' ? 'work' : null; } }, getElementById() { return null; },
    querySelector() { return null; }, querySelectorAll(sel) { return sel === '[data-hoofdactie]' ? [knop] : []; } };
  const c = Object.assign({ bron: '', titel: '', acties: [], selectie: false, staat: {}, rail: [], sleutel: 'k' }, ctx);
  return { document: d, location: { pathname: '/apps/office.html', origin: 'https://rtg.test' }, navigator: { onLine: true },
    RTGEdgeBlikveldHoofdactie: Hoofdactie,
    RTGAdaptief: { context() { return c; }, opContext(f) { f(c); }, voorNu() { return []; }, capability() { return null; } } };
}

test('3. besturingsproef: een los scherm dat alles zelf publiceert, haalt ook zelf', () => {
  const l = maak(losVenster({ bron: 'office.tekst', titel: 'Brief', object: { soort: 'document', id: 'd1' },
    activiteit: 'schrijven', rail: [{ sleutel: 'opslag', tekst: 'Opgeslagen', staat: 'rustig' }] })).lees();
  for (const v of ['context', 'object', 'activiteit', 'hoofdactie', 'trust']) {
    assert.notEqual(l.velden[v].waarde, null, v + ' hoort een waarde te hebben');
    assert.equal(zelf(v, l.velden[v].herkomst), true, v + ' komt van het scherm zelf (' + l.velden[v].herkomst + ')');
  }
  /* En de wereld, ook als het scherm hem als attribuut draagt: nooit zelf. */
  assert.deepEqual([l.velden.wereld.waarde, l.velden.wereld.herkomst], ['work', 'pagina']);
  assert.equal(zelf('wereld', l.velden.wereld.herkomst), false);
});

/* DE SCHIL IN VM: het echte register, de echte brug en het echte blikveld in
   een context, met een nagemaakte werktafel eromheen. Het blad stuurt zijn
   context zoals brug.js dat in een iframe doet; de proef levert het bericht af
   bij de luisteraar van de bovenkant. */
function schil() {
  const luisteraars = [];
  const bladVenster = { postMessage() {} };
  const frame = { contentWindow: bladVenster, isConnected: true };
  const document = {
    title: 'RTG', documentElement: { setAttribute() {} },
    body: { getAttribute(n) { return n === 'data-rtg-blad-wereld' ? 'travel' : null; } },
    getElementById(id) { return id === 'rtgCommand' ? {} : null; },
    querySelector(sel) { return sel === '#rtgCommand .cmd-pane.actief iframe' ? frame : null; },
    querySelectorAll(sel) { return sel === '#rtgCommand .cmd-pane iframe' ? [frame] : []; }
  };
  const ctx = vm.createContext({
    document, console: { warn() {}, error() {} },
    navigator: { onLine: true }, location: { pathname: '/apps/app.html', origin: 'https://rtg.test' },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener(soort, f) { if (soort === 'message') luisteraars.push(f); },
    RTGAdaptiefLeer: leer, RTGGrammatica: gram
  });
  vm.runInContext('window = globalThis; parent = globalThis;', ctx);
  for (const rel of ['public/shared/adaptief/register.js', 'public/shared/adaptief/brug.js', 'public/shared/edge/blikveld.js']) {
    vm.runInContext(lees(rel), ctx, { filename: rel });
  }
  const zend = (c) => luisteraars.forEach((f) => f({ origin: 'https://rtg.test', source: bladVenster,
    data: { merk: 'rtg-adaptief', soort: 'context', caps: [], ctx: c } }));
  return { ctx, zend };
}

test('4. in de schil: een context via de brug heet blad en blad:rail, en telt nergens als zelf', () => {
  const { ctx, zend } = schil();
  assert.equal(typeof ctx.RTGEdgeBlikveld.lees, 'function', 'het blikveld hoort in de schil te laden');
  zend({ bron: 'reizen.tabs', titel: 'Reizen', acties: [], selectie: false, staat: {},
    rail: [{ sleutel: 'opslag', tekst: 'Opgeslagen', staat: 'rustig' }], object: { soort: 'reis', id: 'r1' }, activiteit: 'plannen' });
  const l = JSON.parse(JSON.stringify(ctx.RTGEdgeBlikveld.lees()));
  assert.equal(l.velden.context.waarde.bron, 'reizen.tabs', 'de context van het blad kwam over de brug aan');
  assert.deepEqual(['context', 'object', 'activiteit', 'trust'].map((v) => l.velden[v].herkomst), ['blad', 'blad', 'blad', 'blad:rail']);
  assert.deepEqual(l.velden.object.waarde, { soort: 'reis', id: 'r1' });
  for (const v of VELDEN) assert.equal(zelf(v, l.velden[v].herkomst), false, v + ' telt in de schil niet als zelf (' + l.velden[v].herkomst + ')');
});

test('5. in de schil zet alleen de brug een context (lexicaal)', () => {
  const html = lees('public/apps/app.html');
  const tags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1].split('?')[0]);
  assert.ok(tags.includes('/shared/adaptief/brug.js'), 'app.html laadt de brug');
  const gedeeld = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      if (fs.statSync(p).isDirectory()) loop(p);
      else if (naam.endsWith('.js')) gedeeld.push('/' + path.relative(path.join(WORTEL, 'public'), p).split(path.sep).join('/'));
    }
  })(path.join(WORTEL, 'public', 'shared'));
  const alle = Array.from(new Set(tags.concat(gedeeld))).sort();
  const ontbreekt = alle.filter((p) => !fs.existsSync(path.join(WORTEL, 'public', p)));
  assert.deepEqual(ontbreekt, [], 'app.html laadt een script dat niet bestaat');
  /* Een publicist noemt RTGAdaptief (vaak als alias: `var A = w.RTGAdaptief`) en
     roept .context( aan MET een argument; zonder argument is het lezen. */
  const publicisten = alle.filter((p) => {
    const bron = zonderCommentaar(lees(path.join('public', p)));
    return /RTGAdaptief/.test(bron) && /\.context\(\s*[^)\s]/.test(bron);
  });
  assert.deepEqual(publicisten, ['/shared/adaptief/brug.js']);
});
