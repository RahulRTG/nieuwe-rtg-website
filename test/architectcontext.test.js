/* ============================================================================
   DE CONTEXT VAN DE ARCHITECT EN ZIJN VOLDOENDHEID (ARCHITECTOPDRACHT.md fase 7)

   Het stop/go-bewijs van fase 7, als toetsen:

     - over vijf ijktaken een uitslag per taak, gelijk aan de vastgelegde in
       test/fixtures/contextijking.json, en elke `onvoldoende` met reden;
     - de mutatie: haal de wetten uit het pakket, en de uitslag wordt
       `onvoldoende`;
     - voldoendheid wordt uitgerekend en nooit afgevinkt: een pakket dat zelf
       "voldoende" zegt, verandert niets;
     - schaduw: niets houdt iets tegen, de opdracht eindigt met 0 ook bij
       `onvoldoende`, en geen werkstroom gebruikt hem als poort;
     - het pakket noemt wat de agent niet mag aannemen, met besluit 6.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const A = require('../scripts/lib/codearchitect');

const WORTEL = path.join(__dirname, '..');
const { taken } = require('./fixtures/contextijking.json');
const lezer = A.maakLezer();

test('1. vijf ijktaken, elk met de vastgelegde uitslag, en elke onvoldoende met reden', () => {
  assert.equal(taken.length, 5);
  let onvoldoende = 0;
  for (const t of taken) {
    const c = A.context(lezer, t.taakklasse, t.onderwerp);
    const v = c.voldoendheid;
    assert.equal(v.uitslag, t.verwacht, t.id + ': ' + JSON.stringify(v.ontbreekt));
    assert.deepEqual(v.ontbreekt.map((o) => o.eis), t.ontbreekt, t.id);
    for (const o of v.ontbreekt) assert.ok(o.reden && o.reden.length > 10, t.id + ' ' + o.eis + ' zonder reden');
    if (v.uitslag === 'onvoldoende') onvoldoende++;
  }
  assert.equal(onvoldoende, taken.filter((t) => t.verwacht === 'onvoldoende').length);
});

test('2. elke regel in het pakket draagt drie assen en een herkomst die terug te volgen is', () => {
  for (const t of taken) {
    for (const r of A.context(lezer, t.taakklasse, t.onderwerp).regels) {
      assert.ok(r.graad && r.versheid && r.tegenspraak, t.id + ' ' + r.veld);
      assert.ok(r.herkomst && r.herkomst.register, t.id + ' ' + r.veld + ' zonder register');
      if (r.herkomst.navolgbaar === false) { assert.ok(r.herkomst.reden); continue; }
      if (r.waarde === null) { assert.ok(r.reden, t.id + ' ' + r.veld + ' leeg zonder reden'); continue; }
      assert.deepEqual(A.volg(lezer.laad(r.herkomst.register).data, r.herkomst.pad, r.herkomst.kies), r.waarde, t.id + ' ' + r.veld);
    }
  }
});

test('3. mutatie: haal de wetten uit het pakket, en de uitslag wordt onvoldoende', () => {
  const c = A.context(lezer, 'code-wijzigen', 'server/kern/pay/poort.js');
  assert.equal(c.voldoendheid.uitslag, 'voldoende');
  const zonder = { ...c, regels: c.regels.map((r) => (r.veld === 'wetten' ? { ...r, waarde: null, graad: 'onbekend', reden: 'weggehaald' } : r)) };
  const v = A.voldoendheid(zonder, 'code-wijzigen');
  assert.equal(v.uitslag, 'onvoldoende');
  assert.deepEqual(v.ontbreekt.map((o) => o.eis), ['wetten']);
  const weg = { ...c, regels: c.regels.filter((r) => r.veld !== 'wetten') };
  assert.equal(A.voldoendheid(weg, 'code-wijzigen').uitslag, 'onvoldoende', 'een ontbrekend veld is geen gehaalde eis');
});

test('4. voldoendheid wordt uitgerekend, nooit afgevinkt', () => {
  const c = A.context(lezer, 'geldregel-wijzigen', 'server/kern/pay/boeking.js');
  const afgevinkt = { ...c, voldoendheid: { uitslag: 'voldoende' }, voldoende: true, uitslag: 'voldoende' };
  assert.equal(A.voldoendheid(afgevinkt, 'geldregel-wijzigen').uitslag, 'onvoldoende');
});

test('5. schaduw: houdt niets tegen, uitgang 0 bij onvoldoende, en geen werkstroom gebruikt het als poort', () => {
  const v = A.context(lezer, 'geldregel-wijzigen', 'server/kern/pay/boeking.js').voldoendheid;
  assert.equal(v.schaduw, true);
  assert.equal(v.houdtTegen, false);
  const r = spawnSync(process.execPath, ['scripts/codearchitect.js', 'context', 'geldregel-wijzigen', 'server/kern/pay/boeking.js'], { cwd: WORTEL, encoding: 'utf8' });
  assert.equal(r.status, 0, 'een onvoldoende pakket hoort niemand tegen te houden');
  assert.match(r.stdout, /VOLDOENDHEID: onvoldoende/);
  const stromen = path.join(WORTEL, '.github', 'workflows');
  for (const f of fs.readdirSync(stromen)) {
    assert.doesNotMatch(fs.readFileSync(path.join(stromen, f), 'utf8'), /codearchitect(?:\.js)?\s+context|codearchitect -- context/, f + ' maakt van de schaduw een poort');
  }
});

test('6. het pakket noemt wat de agent niet mag aannemen, met de punten van besluit 6', () => {
  const c = A.context(lezer, 'toets-toevoegen', 'server/kern/pay/boeking.js');
  const tekst = c.nietAannemen.map((n) => n.zin + ' ' + n.bron).join('\n');
  assert.match(tekst, /dekking compleet/);
  assert.match(tekst, /register actueel/);
  for (const punt of [2, 3, 4, 5]) assert.match(tekst, new RegExp('besluit 6 punt ' + punt));
  assert.ok(c.kennisgaten.length >= 2);
});

test('7. een onbekende taakklasse of een onbekend onderwerp zegt dat, en is nooit voldoende', () => {
  assert.equal(A.context(lezer, 'alles-mag', 'server/kern/pay/boeking.js').gevonden, false);
  const c = A.context(lezer, 'toets-toevoegen', 'bestaat/niet.js');
  assert.equal(c.voldoendheid.uitslag, 'onvoldoende');
  assert.equal(c.voldoendheid.ontbreekt[0].eis, 'onderwerp');
});

test('8. R1: context schrijft nergens heen (gemeten met het invoerspoor)', () => {
  const r = spawnSync(process.execPath, ['-r', './scripts/lib/invoerspoor-preload.js', '-e',
    "process.argv = [process.argv[0], 'codearchitect', 'context', 'code-wijzigen', 'server/kern/pay/poort.js', '--json'];" +
    "require('./scripts/codearchitect.js');" +
    "process.on('exit', () => process.stderr.write('SCHRIJF=' + JSON.stringify([...global.__rtgInvoerspoor.schrijf])));"],
  { cwd: WORTEL, encoding: 'utf8' });
  const m = /SCHRIJF=(\[.*\])/.exec(r.stderr);
  assert.ok(m, 'het spoor gaf geen uitslag: ' + r.stderr.slice(-300));
  assert.deepEqual(JSON.parse(m[1]), []);
});
