/* DE HERSTELTRANSACTIE VAN COMMAND (kern/command/transactie.js en
   transactie-poorten.js) op de weigerkant, aanvulling op
   test/hersteltransactie.test.js.

   Een herstelrecept schrijft in productiegegevens. Daarom twee poorten:
   VOORAF (mag dit nu, op dit veld, met deze weg terug, op dit fundament) en
   ACHTERAF (staat het er werkelijk). Hier de takken waar die poorten nee
   zeggen of niet kunnen kijken -- en of "niet gecontroleerd" dan ook zo heet,
   en niet stil als goed telt.

   Wat hier niet mag sneuvelen:
   1. een bevroren veld (identiteit, bedrag, recht) en een beloofde
      automatische terugweg op een onomkeerbaar recept blokkeren;
   2. een gezondheidskaart die omvalt of leeg is, is "niet gecontroleerd" met
      de reden -- geen blokkade en geen groen vinkje;
   3. achteraf: een verdwenen soort of een verdwenen object is een mislukte
      verificatie; zonder geraakte objecten valt er niets te verifiëren;
   4. een menselijk akkoord zonder het zware recht telt als afwezig, en waar de
      routering een mens eiste zegt de weigering welk recht ontbreekt;
   5. een mislukte verificatie met een terugdraaiing die zelf faalt heet
      "terug mislukt" en draagt de fout -- nooit stil "terug".

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in voorcontrole `zeg('veld-niet-bevroren', !bevroren, ...)` vervangen door
     `zeg('veld-niet-bevroren', true, ...)` -> "1. bevroren" ZAKT (RAAK)
   - in verifieer `if (!r) { mis.push(...); continue; }` vervangen door
     `if (!r) continue;` -> "3. achteraf" ZAKT (RAAK)
   - in draai() `terug && !terug.error ? 'terug' : 'terug mislukt'` vervangen
     door `'terug'` -> "5. terug mislukt" ZAKT (RAAK)

   Draai: node --test test/commandtransactie-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const poorten = require('../server/kern/command/transactie-poorten');
const { maakTransactie } = require('../server/kern/command/transactie');

const runbooksMet = (totaal) => ({ BEVROREN: new Set(['iban']), kandidaten: () => ({ totaal }) });
const stap = (v, naam) => v.stappen.find(x => x.naam === naam);

test('1. een bevroren veld en een valse terugweg blokkeren', () => {
  const v = poorten.voorcontrole({ rb: { veld: 'iban', terugDraaibaar: false },
    cert: { terugweg: 'automatisch', maxObjecten: 5 }, runbooks: runbooksMet(9) });
  assert.equal(v.mag, false);
  assert.deepEqual(v.blokkerend.map(b => b.naam).sort(), ['binnen-max-impact', 'terugweg-bestaat', 'veld-niet-bevroren']);
  assert.match(stap(v, 'veld-niet-bevroren').waarom, /"iban" draagt een identiteit/);
  assert.match(stap(v, 'terugweg-bestaat').waarom, /niet terug te draaien/);
});

test('2. een kaart die omvalt of leeg is, is niet gecontroleerd en houdt niets tegen', () => {
  const basis = { rb: { veld: 'status', terugDraaibaar: true }, cert: { terugweg: 'automatisch', maxObjecten: null }, runbooks: runbooksMet(1) };
  const kapot = poorten.voorcontrole({ ...basis, gezondheid: { stand: () => { throw new Error('kaart weg'); } } });
  assert.equal(kapot.mag, true);
  assert.deepEqual(kapot.nietGecontroleerd, ['fundament-gezond']);
  assert.match(stap(kapot, 'fundament-gezond').waarom, /kon niet gelezen worden \(kaart weg\)/);
  assert.equal(stap(kapot, 'fundament-gezond').goed, null, 'geen groen vinkje');
  const leeg = poorten.voorcontrole({ ...basis, gezondheid: { stand: () => null } });
  assert.match(stap(leeg, 'fundament-gezond').waarom, /\(onbekend\)/);
  const ziek = poorten.voorcontrole({ ...basis, gezondheid: { stand: () => ({ vermogens: [{ id: 'gegevens', naam: 'De gegevens', oordeel: 'storing' }] }) } });
  assert.equal(ziek.mag, false, 'een echte storing blokkeert wel');
});

test('3. achteraf: verdwenen soort of object is mislukt; niets geraakt is niets te verifiëren', () => {
  const rb = { type: 'boeking', veld: 'status', past: (r) => r.status === 'dubbel' };
  const register = { OP_TYPE: new Map([['boeking', { sleutel: 'id' }]]), rijen: () => [{ id: 'b1', status: 'ok' }, { id: 'b2', status: 'dubbel' }] };
  assert.equal(poorten.verifieer({ rb, cert: {}, geraakt: null, register }).nietVanToepassing, true);
  const weg = poorten.verifieer({ rb: { ...rb, type: 'vervallen' }, cert: {}, geraakt: [{ id: 'b1' }], register });
  assert.equal(weg.goed, false);
  assert.match(weg.waarom, /"vervallen" bestaat niet meer/);
  const v = poorten.verifieer({ rb, cert: {}, register,
    geraakt: [{ id: 'b1', veld: 'status', naar: 'ok' }, { id: 'b9', veld: 'status', naar: 'ok' }] });
  assert.equal(v.goed, false);
  assert.equal(stap(v, 'veld-staat-op-doel').waarom, 'b9 (bestaat niet meer)');
  const oorzaak = poorten.verifieer({ rb, cert: { verificaties: ['oorzaak-weg'] }, register,
    geraakt: [{ id: 'b2', veld: 'status', naar: 'ok' }] });
  assert.equal(oorzaak.goed, false);
  assert.equal(oorzaak.waarom, 'oorzaak-weg klopt niet');
});

function opstelling(o) {
  const regels = [], terug = [];
  const rb = { id: 'rb1', veld: 'status', type: 'boeking', terugDraaibaar: true, past: () => false,
    certificaat: o.cert === undefined ? { versie: 1, terugweg: 'automatisch', maxObjecten: null, verificaties: ['veld-staat-op-doel'] } : o.cert };
  const runbooks = { OP_ID: new Map([['rb1', rb]]), BEVROREN: new Set(), kandidaten: () => ({ totaal: 1 }),
    voer: () => o.voer || { run: { id: 'run1', geraakt: 1 }, oordeel: { niveau: 'auto' } },
    run: () => ({ geraaktVolledig: [{ id: 'b1', veld: 'status', naar: 'ok' }] }),
    draaiTerug: (id, door, reden) => { terug.push({ id, door, reden }); return { error: 'terugdraaien geweigerd' }; },
    noteerVerificatie: () => {} };
  const register = { OP_TYPE: new Map([['boeking', { sleutel: 'id' }]]), rijen: () => [{ id: 'b1', status: 'fout' }] };
  const tx = maakTransactie({ runbooks, register, journaal: { noteer: r => regels.push(r) }, zwaar: o.zwaar });
  return { tx, regels, terug };
}

test('4. een akkoord zonder zwaar recht telt als afwezig, met de reden waar het ertoe doet', () => {
  assert.equal(opstelling({}).tx.draai('weg').status, 404);
  const geweigerd = { status: 403, error: 'Dit vraagt het tijdelijke recht "herstel-forceren"', recht: 'herstel-forceren' };
  const { tx } = opstelling({ zwaar: () => geweigerd, voer: { error: 'vraagt een mens', oordeel: { niveau: 'hand' } } });
  const r = tx.draai('rb1', { droog: false, menselijkAkkoord: true, door: 'mw-a' });
  assert.deepEqual([r.status, r.recht, r.oordeel.niveau], [403, 'herstel-forceren', 'hand']);
  const ander = opstelling({ zwaar: () => geweigerd, voer: { error: 'grendel', status: 409, oordeel: { niveau: 'auto' } } })
    .tx.draai('rb1', { droog: false, menselijkAkkoord: true, door: 'mw-a' });
  assert.deepEqual([ander.status, ander.error], [409, 'grendel'], 'waar geen mens nodig was, de echte weigering');
  const droog = opstelling({ cert: null }).tx.draai('rb1');
  assert.equal(droog.droog, true, 'zonder opties: een droogloop');
  assert.equal(droog.certificaat.ongecertificeerd, true);
  assert.equal(droog.certificaat.terugweg, 'handmatig');
});

test('5. een mislukte verificatie met een falende terugdraaiing heet terug mislukt', () => {
  const { tx, regels, terug } = opstelling({});
  const r = tx.draai('rb1', { droog: false });
  assert.equal(r.verificatie.goed, false);
  assert.equal(r.teruggedraaid, null);
  assert.equal(r.terugMislukt, 'terugdraaien geweigerd');
  assert.equal(r.keten[r.keten.length - 1], 'terug mislukt');
  assert.equal(terug[0].door, 'transactie');
  assert.match(terug[0].reden, /^de verificatie mislukte: /);
  assert.equal(regels[0].actor, 'transactie');
  assert.equal(regels[0].na.teruggedraaid, false);
});
