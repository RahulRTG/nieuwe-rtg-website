/* DE OPERATOR VAN COMMAND (kern/command/operator.js): plan, zin en uitvoering.

   De operator is de agent die op een vraag ("herstel de dubbele boekingen")
   een plan maakt, alleen de VEILIGE gevallen zelf mag laten herstellen, en de
   rest als zaak bij een mens legt. Een taalmodel mag zijn zin mooier maken en
   verder niets. Op de randen beslist hij of een plan twee keer kan draaien, of
   een uitzondering verdwijnt als er geen oorzaak bekend is, en of een kapot of
   leeg modelantwoord de eigen, controleerbare zin vervangt.

   Wat hier niet mag sneuvelen:
   1. uitvoeren vraagt een bestaand plan en een medewerker op naam, en gebeurt
      één keer (409); alleen de veilige ids gaan naar het runbook;
   2. een runbook dat weigert wordt een fout in de uitslag en geen stilte; elke
      uitzondering wordt een zaak, ook zonder gemeten oorzaak;
   3. de zin is deterministisch uit het plan opgebouwd: zonder delen zegt hij
      dat er niets is (een uitslag, geen storing), met meer dan drie oorzaken
      telt hij de rest als "verspreid";
   4. het model mag de zin alleen vervangen met echte tekst: geen model, een
      te kort antwoord of een fout geeft de eigen zin terug;
   5. de planrij is begrensd op 200, en recent() toont het nieuwste eerst.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in voerVeilig() `if (p.uitgevoerd) return {... 409}` weggehaald
     -> "1. uitvoeren" ZAKT (RAAK): het runbook draait twee keer
   - in verwoord() `t.length > 20 ? t : p.tekst` vervangen door `t || p.tekst`
     -> "4. het model" ZAKT (RAAK)
   - `alleen: d.veiligeIds` vervangen door `alleen: undefined`
     -> "1. uitvoeren" ZAKT (RAAK)

   Draai: node --test test/commandoperator-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakOperator } = require('../server/kern/command/operator');
const { maakZaken } = require('../server/kern/command/zaken');

const PLAATSEN = ['A', 'A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'E'];
function maak(o) {
  o = o || {};
  const vak = {}, regels = [], voeringen = [];
  const journaal = { noteer: r => regels.push(r) };
  const beleid = { getal: (id, std) => std };
  const runbooks = {
    lijst: () => [{ id: 'rb1', naam: 'Dubbele boeking', oorzaak: 'dubbel', type: 'boeking', kandidaten: 10 },
      { id: 'rb2', naam: 'Wees', oorzaak: 'los', type: 'vreemd', kandidaten: 0 }],
    OP_ID: new Map([['rb1', { klantImpact: 'laag', terugDraaibaar: true, actie: 'herstel' }]]),
    kandidaten: () => ({ totaal: 10, rijen: PLAATSEN.map((p, i) => (o.zonderOorzaak ? { id: 'b' + i } : { id: 'b' + i, plaats: p })) }),
    voer: (id, opties) => { voeringen.push({ id, opties }); return o.weiger ? { error: 'grendel dicht' } : { run: { geraakt: opties.alleen.length } }; }
  };
  const register = { OP_TYPE: new Map([['boeking', { domein: 'reizen', meervoud: 'boekingen', sleutel: 'id' }]]),
    kort: (soort, r) => ({ titel: 'Boeking ' + r.id }) };
  const risico = { routeer: (gevallen) => ({
    veilig: gevallen.slice(0, o.veilig == null ? 7 : o.veilig).map(geval => ({ geval })),
    hulp: [], mens: gevallen.slice(o.veilig == null ? 7 : o.veilig).map(geval => ({ geval, oordeel: { score: 80, waarom: 'onomkeerbaar' } })),
    overgeslagen: 0, stapeloordeel: null }) };
  const zaken = maakZaken({ save: () => {}, crypto, journaal, beleid, vak: () => vak });
  const op = maakOperator({ save: () => {}, crypto, journaal, risico, runbooks, zaken, beleid, register,
    anthropic: o.anthropic, vak: () => vak });
  return { op, zaken, regels, voeringen, vak };
}

test('1. uitvoeren: bestaand plan, medewerker op naam, een keer, alleen de veilige ids', () => {
  const { op, voeringen } = maak();
  const p = op.plan('herstel de dubbele boekingen', 'mw-a');
  assert.equal(op.voerVeilig('weg', 'mw-a').status, 404);
  assert.equal(op.voerVeilig(p.id, '').status, 403);
  assert.equal(voeringen.length, 0);
  const r = op.voerVeilig(p.id, 'mw-a');
  assert.equal(r.hersteld, 7);
  assert.deepEqual(voeringen[0].opties.alleen, ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6']);
  assert.equal(voeringen[0].opties.reden, 'operator: herstel de dubbele boekingen');
  assert.equal(op.voerVeilig(p.id, 'mw-b').status, 409);
  assert.equal(voeringen.length, 1, 'een plan draait niet twee keer');
});

test('2. een weigerend runbook wordt een fout; elke uitzondering een zaak, ook zonder oorzaak', () => {
  const { op, zaken, regels } = maak({ weiger: true, zonderOorzaak: true });
  const p = op.plan('boeking', 'mw-a');
  const r = op.voerVeilig(p.id, 'mw-a', 'nachtronde');
  assert.deepEqual(r.fouten, [{ runbook: 'rb1', error: 'grendel dicht' }]);
  assert.equal(r.hersteld, 0);
  assert.equal(r.zaken, 3);
  const z = zaken.lijst();
  assert.deepEqual([...new Set(z.map(x => x.oorzaak))], ['geen veilige route']);
  assert.equal(z[0].bewijs.plan, p.id);
  const slot = regels[regels.length - 1];
  assert.deepEqual([slot.actie, slot.reden, slot.na.fouten], ['operator uitvoeren', 'nachtronde', 1]);
});

test('3. de zin: niets is een uitslag, en meer dan drie oorzaken worden "verspreid"', () => {
  const { op } = maak();
  const p = op.plan('dubbele boeking', 'mw-a');
  assert.match(p.tekst, /^10 × dubbele boeking \(boeking\)\. Oorzaken: 3 door plaats A, 2 door plaats B, 2 door plaats C en 3 verspreid\./);
  assert.match(p.tekst, /Ik kan 7 geval\(len\) veilig herstellen; 3 vragen een menselijke beoordeling\.$/);
  const leeg = op.tekst({ delen: [] });
  assert.match(leeg, /Dat is een uitslag, geen storing/);
  assert.match(maak({ veilig: 0 }).op.plan('x', 'mw-a').tekst, /Geen van deze gevallen mag ik zelf doen; 10 vragen een mens\.$/);
  assert.match(maak({ veilig: 10 }).op.plan('x', 'mw-a').tekst, /veilig herstellen\.$/);
  assert.match(op.tekst({ delen: [{ totaal: 0, naam: 'X', type: 't', oorzaken: [] }], veilig: 0, uitzonderingen: 0 }),
    /Er valt nu niets te herstellen\.$/);
});

test('4. het model mag de zin alleen vervangen met echte tekst', async () => {
  const p = maak().op.plan('boeking', 'mw-a');
  assert.equal(await maak().op.verwoord(p), p.tekst, 'zonder model de eigen zin');
  const kort = { messages: { create: async () => ({ content: [{ type: 'text', text: 'Prima.' }] }) } };
  assert.equal(await maak({ anthropic: kort }).op.verwoord(p), p.tekst);
  const leeg = { messages: { create: async () => ({}) } };
  assert.equal(await maak({ anthropic: leeg }).op.verwoord(p), p.tekst);
  const kapot = { messages: { create: async () => { throw new Error('429'); } } };
  assert.equal(await maak({ anthropic: kapot }).op.verwoord(p), p.tekst);
  let gevraagd = null;
  const goed = { messages: { create: async (v) => { gevraagd = v; return { content: [{ type: 'tool_use' },
    { type: 'text', text: 'Er staan tien dubbele boekingen open; zeven kunnen veilig worden hersteld.' }] }; } } };
  assert.equal(await maak({ anthropic: goed }).op.verwoord(p), 'Er staan tien dubbele boekingen open; zeven kunnen veilig worden hersteld.');
  assert.match(gevraagd.system, /Voeg NIETS toe/);
});

test('5. de planrij is begrensd, en recent toont het nieuwste eerst', () => {
  const { op, vak } = maak();
  const eerste = op.plan('', '');
  assert.equal(eerste.door, 'onbekend');
  for (let i = 0; i < 205; i++) op.plan('vraag ' + i, 'mw-a');
  assert.equal(vak.commandPlannen.length, 200);
  assert.equal(op.vind(eerste.id), null, 'het oudste plan is eraf');
  assert.deepEqual(op.recent(2).map(p => p.vraag), ['vraag 204', 'vraag 203']);
  assert.equal(op.recent().length, 10);
  assert.equal(op.vind(vak.commandPlannen[199].id).vraag, 'vraag 204');
});
