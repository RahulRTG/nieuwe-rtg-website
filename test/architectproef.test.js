/* ============================================================================
   DE ARCHITECTPROEF (ARCHITECTOPDRACHT.md fase 5)

   Het stop/go-bewijs van fase 5, als toetsen:

     - twintig vragen, tien per domein, elk met een uitslag;
     - geen enkel antwoord zonder herkomst;
     - elke mislukte vraag draagt een sluitweg;
     - de uitslag per vraag is de vastgelegde: verandert er een, dan zakt dit
       en wordt test/fixtures/architectproef.json met reden bijgewerkt;
     - de mutatie: een Architect die een herkomst laat wegvallen of naar het
       verkeerde element laat wijzen, wordt gevangen.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');
const A = require('../scripts/lib/codearchitect');
const { proef, VRAGEN } = require('../scripts/architectproef');

const WORTEL = path.join(__dirname, '..');
const { vragen } = require(VRAGEN);

test('1. twintig vragen, tien over pay en tien over de tafelketen, elk met een eigen id', () => {
  assert.strictEqual(vragen.length, 20);
  assert.strictEqual(vragen.filter((v) => v.domein === 'pay').length, 10);
  assert.strictEqual(vragen.filter((v) => v.domein === 'tafel').length, 10);
  assert.strictEqual(new Set(vragen.map((v) => v.id)).size, 20);
});

test('2. de stop/go: geen antwoord zonder herkomst, en elke uitslag is de vastgelegde', () => {
  const p = proef();
  assert.strictEqual(p.verdeling.zonderHerkomst, 0,
    'zonder herkomst: ' + p.per.filter((x) => x.uitslag === 'zonderHerkomst').map((x) => x.id + ' (' + x.reden + ')').join(', '));
  for (const x of p.per) assert.strictEqual(x.uitslag, x.verwacht, x.id + ': ' + (x.reden || ''));
});

test('3. een mislukte vraag is een bevinding met een sluitweg, en een onbekende draagt zijn reden', () => {
  for (const x of proef().per) {
    if (x.uitslag === 'mislukt') assert.ok(x.sluitweg && x.sluitweg.length > 40, x.id + ' mislukt zonder sluitweg');
    if (x.uitslag === 'onbekend') assert.ok(x.reden, x.id + ' onbekend zonder reden');
    if (x.uitslag === 'beantwoord') assert.ok(x.graad && x.versheid && x.tegenspraak, x.id + ' zonder drie assen');
  }
});

/* De mutatie: een Architect die zijn herkomst kwijtraakt. Twee vormen, elk een
   echte manier waarop een projectie stil kan gaan liegen. */
function kapot(verander) {
  return {
    uitleg: (lezer, ding) => {
      const u = A.uitleg(lezer, ding);
      return u.regels ? { ...u, regels: u.regels.map(verander) } : u;
    },
    impact: (lezer, b) => {
      const i = A.impact(lezer, b);
      return { ...i, statisch: i.statisch.map(verander), waargenomen: i.waargenomen.map(verander) };
    },
  };
}

test('4. mutatie: een weggevallen herkomst wordt gevangen', () => {
  const p = proef({ architect: kapot((r) => ({ ...r, herkomst: undefined })) });
  assert.ok(p.verdeling.zonderHerkomst >= 15, 'elke beantwoorde en onbekende vraag hoort nu te zakken, gezien ' + p.verdeling.zonderHerkomst);
});

test('5. mutatie: een herkomst die naar het verkeerde element wijst, wordt gevangen', () => {
  const p = proef({ architect: kapot((r) => (r.herkomst && r.herkomst.pad && r.herkomst.navolgbaar !== false && r.waarde !== null
    ? { ...r, herkomst: { ...r.herkomst, pad: r.herkomst.pad.replace(/\[([^=~\]]+)=([^\]]*)\]/, '[$1=verzonnen]') } }
    : r)) });
  const gevangen = p.per.filter((x) => x.uitslag === 'zonderHerkomst').map((x) => x.id);
  assert.ok(gevangen.includes('pay-1') && gevangen.includes('tafel-1'), 'gevangen: ' + gevangen.join(', '));
});

test('6. de proef schrijft nergens heen (gemeten met het invoerspoor)', () => {
  const r = spawnSync(process.execPath, ['-r', './scripts/lib/invoerspoor-preload.js', '-e',
    "process.argv = [process.argv[0], 'architectproef', '--json'];" +
    "require('./scripts/architectproef.js');" +
    "process.on('exit', () => process.stderr.write('SCHRIJF=' + JSON.stringify([...global.__rtgInvoerspoor.schrijf])));"],
  { cwd: WORTEL, encoding: 'utf8' });
  const m = /SCHRIJF=(\[.*\])/.exec(r.stderr);
  assert.ok(m, 'het spoor gaf geen uitslag: ' + r.stderr.slice(-300));
  assert.deepStrictEqual(JSON.parse(m[1]), []);
});
