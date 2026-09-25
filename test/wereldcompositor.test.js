/* DE WERELDCOMPOSITOR -- een app vraagt een wereld, en de compositor weet welke
   er zijn en wat elk nodig heeft.

   Wat dit bestand bewaakt, en elke regel kan zakken:

     1. Geen wees. Elke scripts/lib/wereld-*.js die een zet...Klaar exporteert,
        staat in het register. Op 24 september 2026 werden er vijf door geen
        enkele proef gebruikt; met een register dat ze allemaal moet kennen,
        is dat voortaan zichtbaar in plaats van stil.
     2. Het register klopt met de bouwer: de functie bestaat, en elke invoer die
        hij vraagt heeft een fundering.
     3. Het plan is minimaal: wie om horeca vraagt krijgt geen school, en een
        wereld zonder families zet geen families op.
     4. Het plan is deterministisch en respecteert `na` (spel na school).
     5. Een onbekende wereld wordt geweigerd, en niet een lege wereld die er
        klaar uitziet.
     6. Elke app-wereld in het contract bestaat en haalt de meting: de bouwer
        raakt minstens twee routes die de ingang van de app aanroept. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const C = require('../scripts/lib/wereldcompositor');
const { WERELD } = require('../scripts/lib/appcontract');
const B = require('../scripts/lib/bewijsbron');
const reg = require('../scripts/lib/wereldregister');

const LIB = path.join(__dirname, '..', 'scripts', 'lib');

test('1. geen wereldbouwer buiten het register', () => {
  const bouwers = [];
  for (const f of fs.readdirSync(LIB).filter((x) => /^wereld-.*\.js$/.test(x))) {
    const m = require(path.join(LIB, f));
    for (const k of Object.keys(m)) if (/^zet\w*Klaar$/.test(k) && typeof m[k] === 'function') bouwers.push('./' + f.replace(/\.js$/, '') + '#' + k);
  }
  assert.ok(bouwers.length >= 11, 'de telling van bouwers is ingestort: ' + bouwers.length);
  const bekend = new Set(Object.values(C.WERELDEN).map((w) => w.module + '#' + w.fn));
  /* zetGesprekKlaar is een hulpstap BINNEN de wortels-wereld en geen eigen wereld. */
  const hulp = new Set(['./wereld-wortels#zetGesprekKlaar']);
  const wees = bouwers.filter((b) => !bekend.has(b) && !hulp.has(b));
  assert.deepEqual(wees, [], 'wereldbouwer zonder plek in het register (dan kan geen app hem vragen): ' + wees.join(', '));
});

test('2. elke registerregel wijst naar een bestaande bouwer met gefundeerde invoer', () => {
  for (const [n, w] of Object.entries(C.WERELDEN)) {
    const m = require(path.join(LIB, w.module));
    assert.equal(typeof m[w.fn], 'function', n + ': ' + w.fn + ' bestaat niet in ' + w.module);
    for (const v of w.vraagt) assert.ok(C.FUNDERING_VAN[v], n + ' vraagt "' + v + '" zonder fundering');
    for (const eerder of w.na || []) assert.ok(C.WERELDEN[eerder], n + ' wil na een onbekende wereld ' + eerder);
  }
});

test('3. het plan is minimaal', () => {
  const h = C.plan(['horeca']);
  assert.deepEqual(h.werelden, ['horeca']);
  assert.deepEqual(h.families, ['gast'], 'horeca heeft de gastfamilie nodig en niets anders');
  assert.deepEqual(h.fundering, ['server', 'sleutelbos', 'families']);
  const f = C.plan(['festival']);
  assert.deepEqual(f.fundering, ['server', 'sleutelbos'], 'een wereld zonder families zet geen families op');
  assert.deepEqual(f.families, []);
  assert.deepEqual(C.plan([]).fundering, [], 'niets gevraagd, niets opgezet');
  /* School vraagt geen tokens, maar zijn families wel: de sleutelbos moet mee. */
  assert.deepEqual(C.plan(['school']).fundering, ['server', 'sleutelbos', 'families']);
});

test('4. deterministisch, en `na` wint van de registervolgorde', () => {
  /* Een eigen register waarin de volgorde tegen `na` in staat: zonder deze
     proef bewijst het echte register niets, want daar staat school al voor spel. */
  const reg2 = { b: { vraagt: ['post'], na: ['a'] }, a: { vraagt: ['post'] }, c: { vraagt: ['post'], na: ['b'] } };
  assert.deepEqual(C.plan(['c', 'b', 'a'], reg2).werelden, ['a', 'b', 'c']);
  assert.deepEqual(C.plan(['b'], reg2).werelden, ['b'], '`na` is zacht: niet gevraagd is niet gebouwd');
  assert.deepEqual(C.plan(['spel', 'school']).werelden, ['school', 'spel']);
  assert.deepEqual(C.plan(['school', 'spel']).werelden, ['school', 'spel']);
  assert.deepEqual(C.plan(['spel', 'horeca', 'spel']).werelden, C.plan(['horeca', 'spel']).werelden);
});

test('5. een onbekende wereld wordt geweigerd', () => {
  assert.throws(() => C.plan(['horeca', 'ruimteschip']), /onbekende wereld: ruimteschip/);
});

test('6. elke app-wereld bestaat en raakt de ingang van zijn app', () => {
  assert.ok(Object.keys(WERELD).length >= 1);
  for (const [functie, d] of Object.entries(WERELD)) {
    const sleutel = functie.slice(functie.indexOf(':') + 1);
    const app = reg.LINKS[sleutel];
    assert.ok(app && app.url, functie + ' staat niet in MAPPEN');
    assert.ok(d.waarom, functie + ': de reden ontbreekt');
    for (const n of d.werelden) {
      const w = C.WERELDEN[n];
      assert.ok(w, functie + ' vraagt een onbekende wereld ' + n);
      const ing = B.ingangRoutes(app.url);
      const raakVan = (m) => B.gedeeld(B.proefRoutes('scripts/lib/' + C.WERELDEN[m].module.slice(2) + '.js'), ing).length;
      const raak = raakVan(n);
      assert.ok(raak >= 2, functie + ': wereld ' + n + ' raakt ' + raak + ' route(s) van ' + app.url + '; een verklaring op minder dan twee is raden');
      /* En geen andere wereld raakt er meer: anders is de verklaring de
         verkeerde wereld, ook al haalt hij de drempel. */
      for (const m of Object.keys(C.WERELDEN)) {
        if (m !== n && !d.werelden.includes(m)) assert.ok(raakVan(m) < raak,
          functie + ': wereld ' + m + ' raakt ' + raakVan(m) + ' routes van ' + app.url + ', de gedeclareerde ' + n + ' maar ' + raak);
      }
    }
  }
});
