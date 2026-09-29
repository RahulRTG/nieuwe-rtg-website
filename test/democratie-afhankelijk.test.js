/* UNDECLARED_RTG_DEPENDENCY = 0 -- proef P3 wordt meetbaar (POLITIEK.md par. 1.1).

   Kan een onafhankelijke organisatie DemocratieOS elders voortzetten als RTG
   stopt? Dat begint met weten wat hij van RTG nodig heeft. Deze toets leest de
   BRON van server/kern/democratie/ en server/routes/democratie/ en zakt op elke
   afhankelijkheid die niet in server/kern/democratie/afhankelijkheden.js staat:
     - elke require() buiten die twee mappen;
     - elke naam die de fabriek van buitenaf krijgt;
     - elke naam die de routes aan hun expliciete grens ontvangen.
   Niet genoemd is geen afhankelijkheid, en dus een rode toets.

   HIJ LEEST ZONDER COMMENTAAR (scripts/lib/bron.js), want een require in een
   uitleg is geen afhankelijkheid -- BEWIJSMACHINE.md par. 6a: een wacht die zijn
   eigen commentaar leest, meet het verkeerde experiment. En hij heeft een
   ZELFIJKING (toets 4): een verzonnen bron met een onverklaarde require moet hij
   vinden.

   Toets 5 is DO-03 in zijn kleinste vorm: fase B kent geen partij, dus het woord
   komt in de code van deze laag niet voor.

   Draai los: node --test test/democratie-afhankelijk.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('../scripts/lib/bron');
const AFH = require('../server/kern/democratie/afhankelijkheden');

const WORTEL = path.join(__dirname, '..');
const KERN = path.join(WORTEL, 'server/kern/democratie');
const ROUTES = path.join(WORTEL, 'server/routes/democratie');
const bestanden = (map) => fs.readdirSync(map).filter(f => f.endsWith('.js')).map(f => path.join(map, f));
const lees = (f) => zonderCommentaar(fs.readFileSync(f, 'utf8'));

/* Alle require-paden die buiten de eigen twee mappen wijzen. */
function vreemdeRequires(bron) {
  const uit = [];
  for (const m of bron.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const p = m[1];
    if (p.startsWith('./')) continue;
    uit.push(p);
  }
  return uit;
}
function onverklaard(bron) {
  return vreemdeRequires(bron).filter(p => !Object.prototype.hasOwnProperty.call(AFH.MODULES, p));
}
/* De namen uit `{ ... } = kern` of uit de parameterlijst van een fabriek. */
const namen = (lijst) => lijst.split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean);

test('1. elke require buiten de eigen mappen staat in de verklaring', () => {
  const fout = [];
  for (const f of bestanden(KERN).concat(bestanden(ROUTES))) {
    for (const p of onverklaard(lees(f))) fout.push(path.relative(WORTEL, f) + ' -> ' + p);
  }
  assert.deepEqual(fout, [], 'UNDECLARED_RTG_DEPENDENCY: zet ze in afhankelijkheden.js MET wat ze doen en hoe vervangbaar ze zijn');
});

test('2. elke naam die de fabriek krijgt, staat in de verklaring', () => {
  const bron = lees(path.join(KERN, 'index.js'));
  const m = /function maakDemocratie\(\{([^}]*)\}\)/.exec(bron);
  assert.ok(m, 'de handtekening van maakDemocratie is niet gevonden -- dan meet deze toets niets');
  const fout = namen(m[1]).filter(n => !AFH.GEINJECTEERD[n]);
  assert.deepEqual(fout, [], 'UNDECLARED_RTG_DEPENDENCY in de fabriek');
});

test('3. elke naam die de routes aan hun grens ontvangen, staat in de verklaring', () => {
  const bron = lees(path.join(ROUTES, 'index.js'));
  const m = /module\.exports\s*=\s*\(([^)]*)\)\s*=>/.exec(bron);
  assert.ok(m, 'de expliciete routegrens is niet gevonden -- dan meet deze toets niets');
  const fout = namen(m[1]).filter(n => !AFH.ROUTES[n]);
  assert.deepEqual(fout, [], 'UNDECLARED_RTG_DEPENDENCY in de routes');
  assert.ok(!/\bkern\b/.test(bron),
    'de routes krijgen hun verklaarde afhankelijkheden expliciet en lezen geen kern-zak');
});

test('4. zelfijking: een verzonnen onverklaarde require wordt gevonden, een in commentaar niet', () => {
  assert.deepEqual(onverklaard("const x = require('../../kern/pay/poort');"), ['../../kern/pay/poort']);
  assert.deepEqual(onverklaard(zonderCommentaar("/* require('../../kern/pay/poort') */ const a = 1;")), []);
  assert.deepEqual(onverklaard("const k = require('../../lib/keten');"), []);
});

/* De burgerkern kent geen partij. Sinds stap 5 (de Political Connector) woont
   de partij in eigen bestanden; de lus van de burger -- kwestie, lid,
   koppeling, doe, beeld, eindstanden, meter, wek -- noemt haar niet, zodat
   proef P1 (de partij verdwijnt en de burgerlus draait door) ook in de bron
   waar blijft. */
const BURGERKERN = ['kwestie.js', 'lid.js', 'koppeling.js', 'doe.js', 'doe-bijeenkomst.js', 'beeld.js', 'eindstanden.js', 'meter.js', 'wek.js'];
/* FOUNDATION_PARTY_NEUTRALITY in zijn scherpste vorm: geen vergelijking van een
   partij, haar nummer of haar categorie met een vaste waarde. Een partij is
   gegevens in een register en nooit een tak in de code (par. 7.1). */
const TAK = /\b(partij|categorie|aanduiding|p\.id|partij\.id|v\.partij)\w*\s*[!=]==?\s*['"`]|['"`]\s*[!=]==?\s*(partij|categorie|aanduiding)\b/i;

test('5. de burgerkern kent geen partij, en nergens wordt op een partij vertakt (DO-03)', () => {
  for (const f of BURGERKERN) assert.ok(fs.existsSync(path.join(KERN, f)), f + ' bestaat niet meer -- dan meet deze toets niets');
  const fout = [];
  for (const f of BURGERKERN.map(b => path.join(KERN, b))) {
    if (/partij/i.test(lees(f))) fout.push(path.relative(WORTEL, f));
  }
  assert.deepEqual(fout, [], 'de burgerkern noemt een partij: zet het in partijen.js of voorstellen.js');
  const tak = [];
  for (const f of bestanden(KERN).concat(bestanden(ROUTES))) {
    lees(f).split('\n').forEach((r, i) => { if (TAK.test(r)) tak.push(path.relative(WORTEL, f) + ':' + (i + 1)); });
  }
  assert.deepEqual(tak, [], 'een tak op een bepaalde partij of categorie: DO-03 verbiedt dat');
  /* zelfijking */
  assert.ok(TAK.test("if (partij.id === 'PP-ABC123') extra();"));
  assert.ok(TAK.test("if (p.categorie !== 'deelnemer') return;"));
  assert.ok(!TAK.test("if (!CATEGORIEEN.includes(b.categorie)) return;"));
});

test('6. elke verklaring zegt wat hij doet en hoe vervangbaar hij is', () => {
  for (const groep of [AFH.MODULES, AFH.GEINJECTEERD, AFH.ROUTES]) {
    for (const [naam, v] of Object.entries(groep)) {
      assert.ok(v.wat && v.vervangbaar, naam + ' mist wat of vervangbaar');
    }
  }
  const gebruikt = new Set();
  for (const f of bestanden(KERN).concat(bestanden(ROUTES))) for (const p of vreemdeRequires(lees(f))) gebruikt.add(p);
  const dood = Object.keys(AFH.MODULES).filter(p => !gebruikt.has(p));
  assert.deepEqual(dood, [], 'een verklaarde afhankelijkheid die niemand gebruikt, maakt de lijst langer dan de werkelijkheid');
});
