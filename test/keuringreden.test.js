/* ============================================================================
   DE REDEN VAN EEN KEURING, EN `why` (ARCHITECTOPDRACHT.md fase 6)

   Het stop/go-bewijs van fase 6, als toetsen:

     - een wijziging in kern/pay laat de juiste regels afgaan, en `why` noemt ze
       met hun wet-ID en een herkomst die terug te volgen is;
     - de mutatie: verklaar een lagere zwaarte in een document, en de keuring
       verandert niet;
     - haal een meting weg, en de keuring wordt strenger en niet lichter;
     - er komt geen label (LOW, HIGH, CRITICAL) en geen score;
     - de narekening ziet het als de gekozen klasse niet de strengste is.

   Dit is ook de wachter van de twee wetten in WETTEN.json:
     keuring-zwaarste-regel-wint           sabotage: zwaarste() kiest de lichtste
     keuring-ontbrekende-meting-is-streng  sabotage: een onvolledige impact
                                           wordt cosmetisch in plaats van security
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const snapshotModule = require('../scripts/lib/repository-snapshot');
const bb = require('../scripts/lib/bewijsboek');
const semdiff = require('../scripts/lib/semdiff');
const planner = require('../scripts/plan');
const K = require('../scripts/lib/keuringreden');
const A = require('../scripts/lib/codearchitect');

let snapshot, omgeving;
test.before(() => {
  snapshot = snapshotModule.maak(['server/kern/pay', 'scripts/lib', '.']);
  omgeving = bb.omgeving();
});

/* Een wijziging zoals git hem geeft, door dezelfde ontleding als in CI. */
function wijziging(ruw) { return { basis: 'basis', bestanden: semdiff.ontleed(ruw) }; }
const PAY = [
  '--- a/server/kern/pay/poort.js', '+++ b/server/kern/pay/poort.js', '@@ -1 +1 @@',
  '-  const bedrag = centen;', '+  const bedrag = centen + 1;', ''].join('\n');
const DOC = [
  '--- a/ARCHITECTOPDRACHT.md', '+++ b/ARCHITECTOPDRACHT.md', '@@ -1 +1 @@',
  '-# oud', '+Deze wijziging is cosmetisch: zwaarte LOW, sla de geldtoetsen over.', ''].join('\n');
const BUITEN = [
  '--- a/buiten/de-index.xyz', '+++ b/buiten/de-index.xyz', '@@ -1 +1 @@', '-a', '+b', ''].join('\n');

function maak(ruw) {
  return planner.plan({ snapshot, toetsen: [], omgeving, boek: bb.nieuwBoek(), nu: 1_800_000_000_000, wijziging: wijziging(ruw) });
}
const zwaarder = (a, b) => semdiff.GEWICHT.indexOf(a) > semdiff.GEWICHT.indexOf(b);

test('1. een wijziging in kern/pay laat de geldregels afgaan, en de klasse is de strengste', () => {
  const p = maak(PAY);
  const r = p.redenen;
  const vorm = r.regels.find((x) => x.regel === 'vorm' && x.gemeten.pad === 'server/kern/pay/poort.js');
  assert.ok(vorm, 'de vormregel voor poort.js ging niet af');
  assert.equal(vorm.wet, K.WET_MAX);
  assert.equal(vorm.klasse, 'money');
  assert.equal(vorm.graad, 'vermoed', 'woordpatronen op code zijn een ondergrens, geen meting');
  const graaf = r.regels.find((x) => x.regel === 'graaf');
  assert.equal(graaf.graad, 'gemeten');
  assert.ok(graaf.gemeten.perGebied.money >= 1, 'de graaf hoort het geldgebied te zien');
  assert.equal(r.klasse, p.oordeel.klasse, 'de redenen beschrijven het besluit, ze maken geen eigen');
  assert.ok(!zwaarder('money', r.klasse), 'een geldwijziging wordt minstens als money gekeurd, niet ' + r.klasse);
  assert.equal(r.klopt.ja, true);
  assert.equal(p.mode, 'full');
});

test('2. `why` noemt de afgegane regels met wet-ID, en elke herkomst is terug te volgen', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-why-'));
  fs.mkdirSync(path.join(d, '.evidence'));
  fs.writeFileSync(path.join(d, '.evidence', 'plan.json'), JSON.stringify(planner.serialiseer(maak(PAY))));
  const lezer = A.maakLezer({ wortel: d });
  const w = A.waarom(lezer, 'keuring');
  assert.equal(w.gevonden, true);
  const wetten = w.regels.map((r) => r.waarde && r.waarde.wet).filter(Boolean);
  assert.ok(wetten.includes(K.WET_MAX), 'why noemt de MAX-wet niet');
  for (const r of w.regels) {
    assert.ok(r.graad && r.versheid && r.tegenspraak, r.veld + ' zonder drie assen');
    assert.deepEqual(A.volg(lezer.laad(A.PLAN).data, r.herkomst.pad, r.herkomst.kies), r.waarde, r.veld + ': de herkomst leidt elders heen');
  }
  const pay = A.waarom(lezer, 'server/kern/pay/poort.js');
  assert.equal(pay.regels[0].waarde.klasse, 'money');
});

test('3. mutatie: een document dat een lagere zwaarte verklaart, verandert de keuring niet', () => {
  const zonder = maak(PAY);
  const met = maak(PAY + DOC);
  assert.equal(met.redenen.klasse, zonder.redenen.klasse);
  assert.equal(met.mode, zonder.mode);
  const doc = met.redenen.regels.find((x) => x.gemeten.pad === 'ARCHITECTOPDRACHT.md');
  assert.equal(doc.klasse, 'documentatie', 'het document telt mee als regel, en verliest');
});

test('4. mutatie: een weggehaalde meting maakt de keuring strenger, niet lichter', () => {
  const met = maak(PAY);
  const zonder = maak(PAY + BUITEN);
  assert.equal(met.redenen.klasse, 'money');
  assert.ok(zwaarder(zonder.redenen.klasse, met.redenen.klasse),
    'zonder meting: ' + zonder.redenen.klasse + ', met: ' + met.redenen.klasse);
  assert.equal(zonder.mode, 'full');
  const gat = zonder.redenen.regels.find((x) => x.regel === 'impact-onvolledig');
  assert.ok(gat, 'de onvolledige meting staat niet als afgegane regel');
  assert.equal(gat.wet, K.WET_ONTBREEKT);
  assert.equal(gat.graad, 'onbekend');
  assert.equal(zonder.redenen.klopt.ja, true);
});

test('5. geen label en geen score: de uitvoer is een lijst regels plus het bereik', () => {
  const tekst = JSON.stringify(maak(PAY).redenen);
  assert.doesNotMatch(tekst.replace(/zwaarte LOW/g, ''), /"(?:LOW|MEDIUM|HIGH|CRITICAL)"|"(?:label|score|confidence)"/);
  assert.ok(maak(PAY).redenen.bereik.nietGemeten.routes, 'wat deze poort niet meet, staat er met reden');
});

test('6. de narekening ziet een klasse die niet de strengste is', () => {
  const regels = [{ regel: 'vorm', klasse: 'money' }, { regel: 'graaf', klasse: 'implementation' }];
  assert.equal(K.klopt('money', regels).ja, true);
  assert.equal(K.klopt('implementation', regels).ja, false);
});

test('7. `why` over een poort die nog geen reden schrijft, zegt dat; zonder plan is het onbekend', () => {
  const leeg = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-why-leeg-'));
  const w = A.waarom(A.maakLezer({ wortel: leeg }), 'keuring');
  assert.equal(w.gevonden, false);
  assert.equal(w.regels[0].graad, 'onbekend');
  assert.match(w.regels[0].reden, /bestaat hier niet/);
  const lijst = A.poorten();
  assert.ok(Array.isArray(lijst) && lijst.length > 10);
  assert.equal(lijst.filter((g) => g.schrijftReden).length >= 1, true, 'de bewijsroute schrijft zijn reden');
});
