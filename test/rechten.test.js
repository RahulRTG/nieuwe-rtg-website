/* ============================================================================
   HET RECHTENBORD -- wat mag deze partij nu ECHT?

   HET INTERESSANTSTE VERSCHIL DAT DIT BORD LAAT ZIEN:

     NOMINAAL   wat het productprofiel zegt
     EFFECTIEF  wat er vandaag werkelijk gebeurt

   Die twee lopen uiteen zodra een handhavingsregel in de SCHADUW staat. Een zaak
   op Business Lite heeft nominaal geen governance -- en krijgt het vandaag toch,
   omdat die regel nog meeloopt. Dat is geen fout maar een besluit; het moet
   alleen wel te ZIEN zijn, want anders staat er in de verkooppraatjes iets
   anders dan in de deur. Precies dat gat is waar dit hele traject mee begon.

   DE BEWERINGEN DIE ERTOE DOEN:

     toets 2   een schaduwregel maakt effectief anders dan nominaal
     toets 4   "elders bewaakt" is geen gat -- een vals alarm dat vier keer per
               bord afgaat, leert iedereen de kolom te negeren
     toets 6   dit bord verandert niets; het leest alleen

   Draai los: node --experimental-sqlite --test test/rechten.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakRechten } = require('../server/kern/commercie/rechten');
const { maakSchaduw, MODUS } = require('../server/kern/commercie/schaduw');
const routepoort = require('../server/kern/commercie/routepoort');
const caps = require('../server/kern/commercie/capaciteiten');

const nu = () => 1_700_000_000_000;
const GOV = 'can_use_enterprise_governance';
const LITE = caps.tredenMet('can_be_partner').find(t => !caps.mag(t, GOV));
const GROOT = caps.tredenMet(GOV)[0];

function opstelling({ pas = LITE, herkomst = 'vastgelegd', standen } = {}) {
  const db = { data: {} };
  const S = maakSchaduw({ db, save: () => {}, nu });
  for (const r of routepoort.regels()) {
    const gewenst = (standen && standen[r.cap]) || (r.vrijstelling ? MODUS.AFDWINGEN : MODUS.SCHADUW);
    S.meld(r.id, MODUS.SCHADUW);
    if (gewenst === MODUS.AFDWINGEN) {
      S.stelVrij(r.id, 'in deze toets gaat het om het bord en niet om de rijpheid', 'toets');
      S.zetModus(r.id, MODUS.AFDWINGEN, 'toets');
    } else if (gewenst === MODUS.UIT) S.zetModus(r.id, MODUS.UIT, 'toets');
  }
  const R = maakRechten({ schaduw: S,
    zaakAbonnement: { van: (code) => ({ code, pas, herkomst, sinds: 1, contractId: null }) } });
  return { R, S, db };
}

test('1. het bord zet de drie kolommen naast elkaar, voor elke capability', () => {
  const { R } = opstelling();
  const b = R.voorZaak('lite');
  assert.equal(b.code, 'LITE', 'de code komt er in hoofdletters uit, net als overal');
  assert.equal(b.pas, LITE);
  assert.equal(b.rechten.length, Object.keys(caps.CAPS).length, 'alle capabilities, ook die op nee staan');
  for (const r of b.rechten) {
    assert.equal(typeof r.nominaal, 'boolean');
    assert.equal(typeof r.effectief, 'boolean');
    assert.ok(r.uitleg, 'met de uitleg erbij, want een sleutel zonder uitleg wordt geraden');
  }
});

/* DE BEWERING. */
test('2. een schaduwregel maakt effectief anders dan nominaal, en zegt waarom', () => {
  const { R } = opstelling();                       // governance loopt mee
  const b = R.voorZaak('LITE');
  const gov = b.rechten.find(r => r.cap === GOV);

  assert.equal(gov.nominaal, false, 'het product zegt nee');
  assert.equal(gov.effectief, true, 'en toch gebeurt het');
  assert.equal(gov.handhaving, MODUS.SCHADUW);
  assert.match(gov.let, /loopt nog mee en houdt niemand tegen/);
  assert.deepEqual(b.afwijkend, [GOV], 'en dat staat vooraan, niet ergens in een rij');
});

test('3. zodra dezelfde regel afdwingt, sluit het gat', () => {
  const { R } = opstelling({ standen: { [GOV]: MODUS.AFDWINGEN } });
  const b = R.voorZaak('LITE');
  const gov = b.rechten.find(r => r.cap === GOV);
  assert.equal(gov.effectief, false);
  assert.equal(gov.bewaakt, true);
  assert.equal(gov.let, null, 'een rij die altijd een opmerking draagt, wordt niet meer gelezen');
  assert.deepEqual(b.afwijkend, []);

  // en een regel die UIT staat geeft het recht wel, met een andere reden
  const uit = opstelling({ standen: { [GOV]: MODUS.UIT } }).R.voorZaak('LITE');
  assert.equal(uit.rechten.find(r => r.cap === GOV).effectief, true);
  assert.match(uit.rechten.find(r => r.cap === GOV).let, /regel staat uit/);
});

/* DE TWEEDE BEWERING. Vier van de acht capabilities hebben hun poort elders. Wie
   die "onbewaakt" noemt, laat vier keer per bord een vals alarm afgaan. */
test('4. "elders bewaakt" is geen gat', () => {
  /* Alle regels op AFDWINGEN, zodat wat er overblijft alleen nog "elders" kan
     zijn. Anders meet deze toets de schaduwstand mee en niet de vraag die hij
     stelt. */
  const alles = {};
  for (const r of routepoort.regels()) alles[r.cap] = MODUS.AFDWINGEN;
  const { R } = opstelling({ pas: GROOT, standen: alles });
  const b = R.voorZaak('GROOT');

  const inDeTabel = new Set(routepoort.regels().map(r => r.cap));
  for (const r of b.rechten) {
    if (inDeTabel.has(r.cap)) assert.notEqual(r.handhaving, 'elders', r.cap + ' staat wel in de routetabel');
    else {
      assert.equal(r.handhaving, 'elders', r.cap + ' wordt buiten de abonnementspoort gevraagd');
      assert.equal(r.bewaakt, null, 'null betekent elders en niet nee');
    }
  }
  assert.deepEqual(b.onbewaakt, [], 'niets is onbewaakt zolang elke regel in de tabel afdwingt of vrijgesteld is');
});

test('5. een regel die HIER hoort te bewaken en het niet doet, staat wel in onbewaakt', () => {
  const standen = {};
  for (const r of routepoort.regels()) standen[r.cap] = MODUS.AFDWINGEN;
  standen.can_use_pos = MODUS.SCHADUW;

  const { R } = opstelling({ pas: GROOT, standen });
  const b = R.voorZaak('GROOT');
  assert.deepEqual(b.onbewaakt, ['can_use_pos'],
    'de kassa hoort bij deze trede, de regel staat in de tabel, en hij dwingt niet af');
  assert.equal(b.rechten.find(r => r.cap === 'can_use_pos').bewaakt, false);

  /* En dit is de ANDERE kant van dezelfde munt als `afwijkend`: daar krijgt een
     trede iets dat het product niet geeft, hier verifieert niemand dat alleen de
     rechthebbende het krijgt. Twee lijsten, want het zijn twee vragen. */
  assert.equal(b.rechten.find(r => r.cap === 'can_use_pos').nominaal, true);
  assert.deepEqual(b.afwijkend, [], 'business verliest niets; het is niet hetzelfde gat');
});

/* DE DERDE BEWERING. Een bord dat ook knoppen heeft, wordt gebruikt om te sturen,
   en dan is er een zevende plek waar rechten vandaan komen. */
test('6. dit bord verandert niets', () => {
  const bron = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'server', 'kern', 'commercie', 'rechten.js'), 'utf8');
  const code = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\bsave\s*\(/, 'geen opslag');
  assert.doesNotMatch(code, /\bzetModus\s*\(/, 'en geen knop om een regel om te zetten');
  assert.doesNotMatch(code, /\bstelVrij\s*\(/);

  // en het laat de schaduwstand ongemoeid
  const { R, S } = opstelling();
  const voor = JSON.stringify(S.lijst());
  R.voorZaak('LITE'); R.voorZaak('LITE'); R.scheuren(['LITE', 'X']);
  assert.equal(JSON.stringify(S.lijst()), voor, 'lezen verandert de stand niet');
});

test('7. de herkomst staat vooraan: een terugval is iets anders dan een besluit', () => {
  const vast = opstelling({ pas: GROOT, herkomst: 'vastgelegd' }).R.voorZaak('A');
  const terug = opstelling({ pas: GROOT, herkomst: 'voor-de-ladder' }).R.voorZaak('B');
  assert.equal(vast.herkomst, 'vastgelegd');
  assert.equal(terug.herkomst, 'voor-de-ladder');
  assert.deepEqual(vast.rechten.map(r => r.effectief), terug.rechten.map(r => r.effectief),
    'ze mogen precies hetzelfde -- het verschil zit in of er een besluit onder ligt');
});

test('8. zonder schaduwlaag zegt het bord "onbekend" en niet "afgedwongen"', () => {
  const R = maakRechten({ zaakAbonnement: { van: (c) => ({ code: c, pas: LITE, herkomst: 'vastgelegd' }) } });
  const b = R.voorZaak('LITE');
  for (const r of b.rechten) {
    assert.equal(r.handhaving, 'elders', 'zonder schaduwlaag valt er hier niets na te kijken');
    assert.equal(r.bewaakt, null);
  }
  assert.deepEqual(b.afwijkend, [], 'en dan is effectief gelijk aan nominaal, zonder te doen alsof');
  assert.equal(b.rechten.find(r => r.cap === GOV).effectief, false);
});

test('9. de scheuren tellen over alle zaken, en wijzen de regel aan als hij overal loopt', () => {
  const { R } = opstelling();
  const s = R.scheuren(['A', 'B', 'C']);
  assert.equal(s.aantal, 3, 'alle drie de zaken staan op dezelfde trede en hebben dus dezelfde scheur');
  assert.deepEqual(s.zaken[0].afwijkend, [GOV]);
  assert.ok(s.regels.some(r => r.cap === GOV && r.modus === MODUS.SCHADUW),
    'een scheur die over ALLE zaken loopt is geen zaakprobleem maar een regel die nog niet afdwingt');

  // zonder scheuren blijft de lijst leeg en verzint hij er geen
  const dicht = opstelling({ standen: { [GOV]: MODUS.AFDWINGEN } }).R.scheuren(['A', 'B']);
  assert.equal(dicht.aantal, 0);
  assert.deepEqual(dicht.zaken, []);
});

test('10. het bord voor een lid spreekt dezelfde taal als dat voor een zaak', () => {
  const { R } = opstelling();
  const lid = R.voorLid('rtg');
  assert.equal(lid.soort, 'lid');
  assert.equal(lid.herkomst, 'pas');
  assert.deepEqual(lid.rechten.map(r => r.cap), R.voorZaak('X').rechten.map(r => r.cap),
    'dezelfde kolommen, zodat er een taal is en niet twee');
  assert.equal(lid.rechten.find(r => r.cap === 'can_use_ai').nominaal, true, 'RTG Pass heeft AI');
  assert.equal(lid.rechten.find(r => r.cap === 'can_use_pos').nominaal, false, 'en geen kassa');
});
