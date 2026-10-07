/* ============================================================================
   DE ARCHITECT (ARCHITECTOPDRACHT.md fase 4)

   De stop/go-eisen van fase 4, als toetsen:

     R1  hij schrijft nergens heen -- gemeten met het invoerspoor van fase 2
     R2  niets in server/ laadt hem
     R3  drie assen per regel, geen samengesteld cijfer
     R4  de herkomstproef: voor elke navolgbare regel van de drie gouden
         onderwerpen leidt de herkomst naar dezelfde waarde
     R5  een ontbrekend register geeft onbekend met reden, geen crash
     en de mutatie: verander een registerwaarde, en de uitleg verandert mee.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const A = require('../scripts/lib/codearchitect');

const WORTEL = path.join(__dirname, '..');
const GOUDEN = ['server/kern/pay/poort.js', 'POST /api/supplier/horeca/rekening/open', 'knelpunt'];
const GRADEN = ['onbekend', 'vermoed', 'gemeten', 'bewezen'];
const VERSHEDEN = ['actueel', 'mogelijk-verouderd', 'onbekend'];
const TEGENSPRAAK = ['geen-gevonden', 'onbepaald', 'gevonden'];

test('1. R1: de Architect schrijft nergens heen (gemeten met het invoerspoor)', () => {
  const r = spawnSync(process.execPath, ['-r', './scripts/lib/invoerspoor-preload.js', '-e',
    "process.argv = [process.argv[0], 'codearchitect', 'explain', 'server/kern/pay/poort.js', '--json'];" +
    "require('./scripts/codearchitect.js');" +
    "process.on('exit', () => process.stderr.write('SCHRIJF=' + JSON.stringify([...global.__rtgInvoerspoor.schrijf])));"],
  { cwd: WORTEL, encoding: 'utf8' });
  const m = /SCHRIJF=(\[.*\])/.exec(r.stderr);
  assert.ok(m, 'het spoor gaf geen uitslag: ' + r.stderr.slice(-300));
  assert.deepStrictEqual(JSON.parse(m[1]), []);
});

test('2. R2: niets in server/ laadt de Architect', () => {
  const raak = [];
  (function loop(map) {
    for (const d of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, d.name);
      if (d.isDirectory()) { if (d.name !== 'node_modules' && d.name !== 'data') loop(p); continue; }
      if (!d.name.endsWith('.js')) continue;
      if (/require\([^)]*codearchitect|import[^;]*codearchitect/.test(fs.readFileSync(p, 'utf8'))) raak.push(path.relative(WORTEL, p));
    }
  })(path.join(WORTEL, 'server'));
  assert.deepStrictEqual(raak, [], 'de Architect hoort nooit in de runtime (CODE.md par. 6, grens 2)');
});

test('3. R3 en R4: elke regel van de gouden onderwerpen draagt drie assen en een herkomst die klopt', () => {
  const lezer = A.maakLezer();
  for (const ding of GOUDEN) {
    const u = A.uitleg(lezer, ding);
    assert.ok(u.gevonden, ding + ': ' + u.reden);
    assert.ok(u.regels.length >= 3, ding + ' heeft te weinig regels');
    for (const r of u.regels) {
      const wie = ding + ' / ' + r.veld;
      assert.ok(GRADEN.includes(r.graad), wie + ': graad ' + r.graad);
      assert.ok(VERSHEDEN.includes(r.versheid), wie + ': versheid ' + r.versheid);
      assert.ok(TEGENSPRAAK.includes(r.tegenspraak), wie + ': tegenspraak ' + r.tegenspraak);
      assert.ok(!('score' in r) && !('confidence' in r), wie + ': een samengesteld cijfer hoort hier niet');
      assert.ok(r.herkomst && r.herkomst.register, wie + ': geen herkomst');
      if (r.herkomst.navolgbaar === false) { assert.ok(r.herkomst.reden, wie + ': niet navolgbaar zonder reden'); continue; }
      if (r.waarde === null) { assert.ok(r.reden, wie + ': leeg zonder reden'); continue; }
      const data = lezer.laad(r.herkomst.register).data;
      assert.deepStrictEqual(A.volg(data, r.herkomst.pad, r.herkomst.kies), r.waarde,
        wie + ': de herkomst ' + r.herkomst.register + ' ' + r.herkomst.pad + ' leidt naar een andere waarde');
    }
  }
});

/* Een eigen registermap: de registers die de uitleg leest, gekopieerd zodat de
   toets ze kan veranderen of weghalen. De code blijft in de echte boom. */
function kopie(namen) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-architect-'));
  for (const n of namen) fs.copyFileSync(path.join(WORTEL, n), path.join(d, n));
  return d;
}

test('4. de mutatie: verander een waarde in een register, en de uitleg verandert mee', () => {
  const d = kopie(['SYMBOLEN.json', 'ROUTEBRON.json', 'AANROEPGRAAF.json', 'WETTEN.json']);
  const voor = A.uitleg(A.maakLezer({ wortel: d }), 'server/kern/pay/poort.js');
  const s = JSON.parse(fs.readFileSync(path.join(d, 'SYMBOLEN.json'), 'utf8'));
  s.perBestand.find((b) => b.bestand === 'server/kern/pay/poort.js').gebruiktDoor = ['server/ijking/verzonnen.js'];
  fs.writeFileSync(path.join(d, 'SYMBOLEN.json'), JSON.stringify(s));
  const na = A.uitleg(A.maakLezer({ wortel: d }), 'server/kern/pay/poort.js');
  const veld = (u) => u.regels.find((r) => r.veld === 'geladen door').waarde;
  assert.notDeepStrictEqual(veld(na), veld(voor));
  assert.deepStrictEqual(veld(na), ['server/ijking/verzonnen.js']);
});

test('5. R5: een ontbrekend register geeft onbekend met de reden, en geen crash of oude waarde', () => {
  const d = kopie(['SYMBOLEN.json', 'AANROEPGRAAF.json']);
  const u = A.uitleg(A.maakLezer({ wortel: d }), 'POST /api/supplier/horeca/rekening/open');
  assert.ok(u.gevonden);
  const bestand = u.regels.find((r) => r.veld === 'bestand');
  assert.strictEqual(bestand.waarde, null);
  assert.strictEqual(bestand.graad, 'onbekend');
  assert.match(bestand.reden, /ROUTEBRON\.json bestaat hier niet/);
  assert.ok(!u.regels.some((r) => r.herkomst.register === 'EXECUTION_MAP.json' && r.waarde !== null),
    'zonder EXECUTION_MAP.json mag er geen bewijsstand verschijnen');
});

test('6. dubbelzinnig: de Architect noemt de kandidaten en kiest er niet stil een', () => {
  const u = A.uitleg(A.maakLezer(), 'lijst');
  assert.strictEqual(u.gevonden, false);
  assert.ok(u.kandidaten.length > 1, 'lijst hoort in meer dan een bestand te staan');
});

test('7. impact: drie blokken, en toetsreductie is nooit toegestaan', () => {
  const i = A.impact(A.maakLezer(), ['server/kern/pay/poort.js']);
  assert.ok(i.statisch.length && i.waargenomen.length && i.kennisgaten.length);
  assert.strictEqual(i.toetsreductie.toegestaan, false);
  assert.ok(!('totaal' in i));
  const geraakt = i.statisch[0].waarde;
  assert.ok(geraakt.includes('server/kern/pay/index.js'), 'wie de poort laadt, hoort geraakt te zijn');
});

test('8. unknowns: vier bakken en geen totaal', () => {
  const o = A.onbekenden(A.maakLezer());
  assert.deepStrictEqual(Object.keys(o), ['graadOnbekend', 'versheid', 'tegenspraak', 'verklaardeSchuld']);
  assert.ok(!JSON.stringify(o).includes('"totaal"'));
  const v = o.versheid;
  assert.ok(v.actueel.length + v['mogelijk-verouderd'].length + v.onbekend.length > 100, 'de versheid hoort elk register te tellen');
});
