/* DE PREFIXKAART VAN DE TOEGANGSMOTOR (server/functies/toegang.js).

   functieVoorPad() zegt WELKE functieschakelaar dit pad bewaakt. Dat is geen
   sierlijk detail: geeft hij null terug, dan is het pad "niet door een functie
   bewaakt -> altijd vrij". Een fout hier betekent dus dat een beheerder een
   functie uitzet en het verkeer gewoon doorloopt.

   Het was een dubbele lus over de hele registratie -- 191 functies met samen
   329 paden, per verzoek. Nu wordt de registratie één keer een kaart en loopt
   een verzoek zijn eigen voorouders af, van lang naar kort.

   Deze toets doet twee dingen die allebei nodig zijn:

   1. GELIJK GEDRAG. De oude dubbele lus staat hieronder als referentie, en de
      uitkomsten worden vergeleken over elk geregistreerd pad plus een reeks
      gemene varianten: met en zonder afsluitende slash, met een id erachter,
      met een letter eraan geplakt, een voorvoegsel ervoor, hoofdletters. Bij
      toegangscode is "het werkt in de gevallen die ik bedacht" niet genoeg.

   2. EEN VANGRAIL OP DE SNELHEID. Een kaart die zich precies zo gedraagt als de
      lus én precies zo traag is, haalt punt 1 met vlag en wimpel. Daarom wordt
      de verhouding gemeten, in dezelfde run -- geen absolute drempel, want die
      knippert op een drukke machine.

   Draai los: node --test test/toegangprefix.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FUNCTIES } = require('../server/functies/register');
const { functieVoorPad } = require('../server/functies/toegang.js');

/* ---------- de referentie: de dubbele lus, zoals hij was ---------- */
function prefixLengte(pad, prefix) {
  if (!pad.startsWith(prefix)) return 0;
  const rest = pad.slice(prefix.length);
  return (rest === '' || rest[0] === '/') ? prefix.length : 0;
}
function oudFunctieVoorPad(pad) {
  let beste = null, besteLen = 0;
  for (const f of FUNCTIES) for (const p of f.paden) {
    const len = prefixLengte(pad, p);
    if (len > besteLen) { besteLen = len; beste = f; }
  }
  return beste;
}

const alleGeregistreerd = [];
for (const f of FUNCTIES) for (const p of (f.paden || [])) alleGeregistreerd.push(p);

test('1. de registratie ziet eruit zoals de kaart aanneemt', () => {
  /* De kaart loopt de voorouders van een pad af en kapt af op '/'. Dat klopt
     alleen als elk geregistreerd pad met een '/' begint en er niet op eindigt.
     Zou dat ooit veranderen, dan moet deze toets zakken en niet de toegang. */
  for (const p of alleGeregistreerd) {
    assert.ok(p.startsWith('/'), 'pad begint met een slash: ' + p);
    assert.ok(p === '/' || !p.endsWith('/'), 'pad eindigt niet op een slash: ' + p);
  }
  assert.ok(alleGeregistreerd.length > 100, 'er staat een echte registratie (' + alleGeregistreerd.length + ' paden)');
});

test('2. de kaart geeft exact hetzelfde antwoord als de dubbele lus', () => {
  const proef = new Set(['', '/', '/api', '/api/', '/apix', '/nope', '//', '/a//b']);
  for (const p of alleGeregistreerd) {
    proef.add(p);
    proef.add(p + '/');            // afsluitende slash
    proef.add(p + '/42');          // een id erachter
    proef.add(p + 'x');            // eraan geplakt: mag NIET matchen
    proef.add(p + '-x');
    proef.add(p.slice(0, -1));     // een teken eraf
    proef.add(p + '/a/b/c');       // dieper
    proef.add(p.replace(/\/[^/]*$/, ''));  // een segment eraf
    proef.add(p.toUpperCase());    // hoofdletters: paden zijn hoofdlettergevoelig
    proef.add('/pre' + p);         // een voorvoegsel ervoor
  }
  let n = 0;
  for (const p of proef) {
    n++;
    const a = oudFunctieVoorPad(p), b = functieVoorPad(p);
    assert.equal(b ? b.id : null, a ? a.id : null, 'zelfde uitkomst voor ' + JSON.stringify(p));
  }
  assert.ok(n > 1000, 'genoeg paden vergeleken: ' + n);
});

test('3. eraan geplakte tekens matchen niet -- de grens is een SEGMENT', () => {
  /* De gevaarlijke kant op: /api/lidx mag nooit de schakelaar van /api/lid
     krijgen, want dan bewaakt de ene functie het pad van de andere. */
  for (const p of alleGeregistreerd.slice(0, 60)) {
    const f = functieVoorPad(p + 'zz');
    const eigen = functieVoorPad(p);
    if (eigen && f) assert.notEqual(f.id === eigen.id && p !== p + 'zz', true,
      'een eraan geplakt teken mag de functie van ' + p + ' niet erven');
  }
});

test('4. VANGRAIL: de kaart blijft meetbaar sneller dan de dubbele lus', () => {
  /* Zonder deze proef kan de kaart stilletjes terugvallen op iets traags zonder
     dat er iets rood wordt: de gedragstoetsen halen het dan nog steeds. De
     marge is ruim -- losgemeten was het 63x, hier staat 8x -- dus we zakken pas
     als de winst grotendeels weg is en niet als hij schommelt. */
  const monster = alleGeregistreerd.slice(0, 200).map(p => p + '/42');
  const meet = (fn) => {
    for (let i = 0; i < 5000; i++) fn(monster[i % monster.length]);      // opwarmen
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 40000; i++) fn(monster[i % monster.length]);
    return Number(process.hrtime.bigint() - t0) / 1e6;
  };
  const msOud = meet(oudFunctieVoorPad);
  const msNieuw = meet(functieVoorPad);
  const factor = msOud / msNieuw;
  assert.ok(factor >= 8,
    'de prefixkaart hoort minstens 8x sneller te zijn dan de dubbele lus; gemeten ' +
    factor.toFixed(1) + 'x (lus ' + msOud.toFixed(1) + ' ms, kaart ' + msNieuw.toFixed(1) + ' ms)');
});
