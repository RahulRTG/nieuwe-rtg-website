/* RTGAdaptief.doe() DWINGT HET GEWICHT AF -- EDGE.md ronde 3.

   Tot hier keek doe() alleen of een handeling VERHINDERD was, niet wat hij
   WOOG (EDGE.md par. 11: "wie hem rechtstreeks aanroept, slaat de bevestiging
   over"). Elke ingang moest er zelf aan denken eerst RTGGewicht.voer te nemen;
   de uitlegknop van waarom.js deed dat zonder gewichtlaag niet en voerde dan een
   zware handeling direct uit. Nu ligt de regel in het register zelf:

   1. licht gaat direct, zoals altijd;
   2. alles wat niet licht is (ook `terug`, die zijn Ongedaan maken in de rail
      hoort te krijgen) gaat via RTGGewicht.voerId -- dezelfde weg als een tik;
   3. zonder gewichtlaag gaat het dicht, en dat staat in de console;
   4. alleen de uitvoerder (gewicht.js) en de brug in een blad (de schil woog
      al) mogen `{ gewogen: true }` meegeven, en dat staat hier op de bron vast
      -- lexicaal (ook als sleutel tussen aanhalingstekens of als toekenning),
      dus een bescherming tegen vergissingen en geen gezagsgrens: wie
      capability(id).doe() rechtstreeks roept, omzeilt ook mag(). Wat iemand
      mag, beslist de server;
   5. met de ECHTE gewicht.js opent een rechtstreekse doe() van een zware
      handeling de lade en voert niets uit; pas na bevestigen draait hij -- en
      dat zonder een tweede lade (geen lus).

   DE MUTATIES, elk nagetrokken: haal de gewichtstak uit doe() (1-3 en 5
   zakken), laat gewicht.js `{ gewogen: true }` weglaten (5 zakt: na bevestigen
   opent er een tweede lade in plaats van uitvoeren), laat brug.js het weglaten
   (4 zakt), en zet het merkje in een derde bestand (4 zakt). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');
const gram = require('../public/shared/adaptief/grammatica.js');
const leer = require('../public/shared/adaptief.js');
const VORM = { telefoon: ['balk'], tablet: ['balk'], bureau: ['werkbalk'] };

function wereld(o) {
  o = o || {};
  const waarschuwing = [], laden = [];
  const el = () => ({ className: '', textContent: '', kinderen: [], style: {}, dataset: {}, attrs: {},
    appendChild(k) { this.kinderen.push(k); return k; }, setAttribute() {}, addEventListener() {},
    classList: { add() {}, remove() {} } });
  const document = { createElement: el, createTextNode: (t) => ({ textContent: t }), getElementById: () => null,
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const window = { RTGAdaptiefLeer: leer, matchMedia: () => ({ matches: false, addEventListener() {} }),
    console: { warn: (m) => waarschuwing.push(m), error() {} }, setTimeout: (f) => f(), addEventListener() {} };
  if (o.grammatica !== false) window.RTGGrammatica = gram;
  if (o.lagen) window.RTGLagen = { lade: (x) => { const lijf = el(); x.inhoud(lijf); laden.push({ titel: x.titel, lijf }); }, sluit() {} };
  window.RTGVasthoud = (x) => { const b = el(); b.klaar = x.klaar; return b; };
  for (const f of ['vorm.js', 'register.js']) vm.runInNewContext(lees('public/shared/adaptief/' + f), { window, document, navigator: {} });
  if (o.gewicht === 'echt') vm.runInNewContext(lees('public/shared/adaptief/gewicht.js'), { window, document });
  const gedaan = [];
  const A = window.RTGAdaptief;
  const decl = (id, gewicht) => A.declareer(Object.assign({ id, naam: id, gewicht, doe: (a) => { gedaan.push([id, a]); return true; } }, VORM));
  decl('p.licht'); decl('p.zwaar', 'zwaar'); decl('p.bewust', 'bewust'); decl('p.terug', 'terug');
  A.context({ bron: 'proef', titel: 'Proef', acties: ['p.licht', 'p.zwaar', 'p.bewust', 'p.terug'],
    staat: { 'p.terug': { ongedaan: () => {} } } });
  return { window, A, gedaan, waarschuwing, laden };
}

test('1. licht gaat direct, zoals altijd', () => {
  const w = wereld();
  assert.equal(w.A.doe('p.licht', 7), true);
  assert.deepEqual(w.gedaan, [['p.licht', 7]]);
});

test('2. wat niet licht is, gaat via RTGGewicht.voerId -- ook terug', () => {
  const w = wereld(), via = [];
  w.window.RTGGewicht = { voerId: (id) => { via.push(id); return true; } };
  for (const id of ['p.zwaar', 'p.bewust', 'p.terug']) assert.equal(w.A.doe(id), true, id);
  assert.deepEqual(via, ['p.zwaar', 'p.bewust', 'p.terug']);
  assert.deepEqual(w.gedaan, [], 'een rechtstreekse doe() voert niets zwaars uit langs het gewicht heen');
  // speelt hij nu niet (voerId geeft false), dan is dat niet stil
  w.window.RTGGewicht = { voerId: () => false };
  assert.equal(w.A.doe('p.zwaar'), false);
  assert.ok(w.waarschuwing.some((m) => /p\.zwaar: speelt nu niet/.test(m)), 'buiten de context dichtgaan is niet stil');
});

test('3. zonder gewichtlaag gaat het dicht, met een melding; zonder grammatica ook', () => {
  for (const grammatica of [true, false]) {
    const w = wereld({ grammatica });
    assert.equal(w.A.doe('p.zwaar'), false);
    assert.equal(w.A.doe('p.bewust'), false);
    assert.deepEqual(w.gedaan, [], 'grammatica ' + grammatica);
    assert.ok(w.waarschuwing.some((m) => /p\.zwaar.*zonder gewichtlaag/.test(m)), 'het dichtgaan is niet stil');
    assert.equal(w.A.doe('p.licht'), true);
  }
  // een verhinderde handeling blijft geweigerd, ook gewogen
  const w = wereld();
  w.A.context({ bron: 'proef', acties: ['p.licht'], staat: { 'p.licht': { verhinderd: { reden: 'Mag niet', bron: 'beleid' } } } });
  assert.equal(w.A.doe('p.licht', undefined, { gewogen: true }), false);
});

test('4. alleen gewicht.js en de brug geven `gewogen` mee', () => {
  const vinden = [];
  (function loop(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) { if (f.name !== 'dist' && f.name !== 'node_modules') loop(p); continue; }
      if (!/\.(js|html)$/.test(f.name)) continue;
      const code = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      if (/(?:[{,]\s*['"]?|\.|\[\s*['"])gewogen['"]?\s*\]?\s*[:=](?!=)/.test(code)) vinden.push(path.relative(WORTEL, p));
    }
  })(path.join(WORTEL, 'public'));
  assert.deepEqual(vinden.sort(), ['public/shared/adaptief/brug.js', 'public/shared/adaptief/gewicht.js'],
    'een derde ingang die zelf zegt dat hij gewogen is, omzeilt het gewicht');
  assert.match(lees('public/shared/adaptief/brug.js'), /soort === 'doe'\) \{ A\.doe\(id, m\.extra \|\| undefined, \{ gewogen: true \}\)/,
    'de brug in een blad voert uit wat de schil al woog');
  assert.match(lees('public/shared/adaptief/gewicht.js'), /RTGAdaptief\.doe\(it\.id, a, \{ gewogen: true \}\)/);
});

test('5. met de echte uitvoerder: eerst de lade, na bevestigen een keer uitvoeren', () => {
  const w = wereld({ gewicht: 'echt', lagen: true });
  assert.ok(w.window.RTGGewicht, 'gewicht.js laadt');
  assert.equal(w.A.doe('p.bewust'), true);
  assert.deepEqual(w.gedaan, [], 'een rechtstreekse doe() opent eerst de lade');
  assert.equal(w.laden.length, 1);
  const knoppen = [];
  (function alles(n) { if (n.className === 'gw-ga') knoppen.push(n); (n.kinderen || []).forEach(alles); })(w.laden[0].lijf);
  assert.equal(knoppen.length, 1, 'de lade heeft een doorgaanknop');
  knoppen[0].onclick();
  assert.equal(w.gedaan.length, 1, 'na bevestigen draait hij precies een keer');
  assert.equal(w.gedaan[0][0], 'p.bewust');
  assert.equal(w.laden.length, 1, 'en er opent geen tweede lade (geen lus tussen doe en voer)');
});
