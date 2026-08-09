/* Stadsstart (kern/command/stadstart.js): een stad inrichten, en eerlijk zeggen
   wat een knop niet kan.

   WAT DEZE TOETS VOORAL BEWAAKT is de stap die BEWUST op "niet gedaan" blijft
   staan. Het stadsweefsel draagt vandaag één geografie zonder sleutel "welke
   stad"; een tweede stad met eigen zones en Stadsdozen is een verbouwing van
   die laag en geen knop hier. Dat had verstopt kunnen worden achter een groene
   melding, en dat is precies de duurste soort knop: iemand start Antwerpen,
   ziet "ingericht", en ontdekt een maand later dat elke meting in de zones van
   de eerste stad is geboekt.

   En het tweede: een stad in een land dat niet is ingericht, is een stad zonder
   munt, zonder tarieven en zonder loonregels. Dat wordt geweigerd en niet
   half gedaan.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de weefselstap op gedaan:true zetten
     -> "de weefselstap blijft openstaan en zegt waarom" ZAKT (RAAK)
   - de landcontrole uit start() halen
     -> "een stad zonder ingericht land gaat niet door" ZAKT (RAAK)
   - stop() de per-plaats-standen laten staan
     -> "stoppen haalt de per-plaats-standen weg" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakStadstart } = require('../server/kern/command/stadstart');
const { maakLandpakket } = require('../server/kern/command/landpakket');
const fiscaal = require('../server/kern/fiscaal/landen');
const valuta = require('../server/kern/payroll/valuta');
const { plaatsNorm } = require('../server/functies/toegang');

function maak() {
  const db = { data: { talen: { actief: ['nl', 'en'] }, techniek: { functies: {} } } };
  const regels = [];
  const journaal = { noteer: r => regels.push(r) };
  const functies = { OP_ID: { 'supplier-pos': { id: 'supplier-pos' } } };
  const landpakket = maakLandpakket({ db, save: () => {}, journaal, fiscaal, valuta,
    talen: () => db.data.talen, functies });
  const stad = maakStadstart({ db, save: () => {}, journaal, landpakket, functies, plaatsNorm,
    weefsel: { weefselZones: () => ['centrum', 'marina'] } });
  return { db, stad, landpakket, regels };
}

test('een stad zonder ingericht land gaat niet door', () => {
  const { stad } = maak();
  const r = stad.start('Antwerpen', { land: 'XX', door: 'ik' });
  assert.equal(r.status, 409);
  assert.match(r.error, /zonder munt/);
  assert.equal(stad.start('Antwerpen', { door: 'ik' }).status, 409, 'en zonder land ook niet');
  assert.equal(stad.stand().steden.length, 0, 'er is geen halve stad blijven staan');
});

test('een stad in een ingericht land start, met de naam genormaliseerd', () => {
  const { stad, landpakket, regels } = maak();
  landpakket.activeer('BE', 'ik');
  const r = stad.start("'s-Hertogenbosch", { land: 'BE', door: 'ik' });
  assert.equal(r.sleutel, plaatsNorm("'s-Hertogenbosch"), 'dezelfde normalisatie als de schakelkast');
  assert.equal(r.land, 'BE');
  assert.ok(regels.some(x => x.actie === 'stad gestart'));
  assert.equal(stad.start("'S-HERTOGENBOSCH", { land: 'BE', door: 'ik' }).status, 409,
    'dezelfde plaats anders getypt is dezelfde plaats');
});

test('de weefselstap blijft openstaan en zegt waarom', () => {
  /* DE KERN. Deze stap hoort NIET groen te worden door hem te starten. */
  const { stad, landpakket } = maak();
  landpakket.activeer('BE', 'ik');
  const r = stad.start('Antwerpen', { land: 'BE', door: 'ik' });
  const w = r.stappen.find(s => s.stap === 'stadsweefsel');
  assert.equal(w.gedaan, false);
  assert.match(w.uitleg, /EEN geografie/);
  assert.match(w.uitleg, /verbouwing/);
  assert.deepEqual(r.open, ['stadsweefsel']);
  assert.ok(r.mensenwerk.length >= 3);
  assert.match(r.let, /eerlijker dan de knop/);
});

test('starten zet de per-plaats-standen, stoppen haalt ze weg', () => {
  const { db, stad, landpakket } = maak();
  landpakket.activeer('BE', 'ik');
  stad.start('Antwerpen', { land: 'BE', door: 'ik', sluit: ['supplier-pos', 'bestaat-niet'] });
  assert.equal(db.data.techniek.functies['supplier-pos'].perPlaats.antwerpen, false);
  assert.equal(db.data.techniek.functies['bestaat-niet'], undefined, 'een onbekende functie wordt niet verzonnen');
  const k = stad.stand('Antwerpen');
  assert.match(k.stappen.find(s => s.stap === 'schakelkast').uitleg, /supplier-pos/);

  assert.equal(stad.stop('Antwerpen', 'ik').gestopt, 'antwerpen');
  assert.equal(db.data.techniek.functies['supplier-pos'].perPlaats.antwerpen, undefined);
  assert.equal(stad.stop('Antwerpen', 'ik').status, 404);
});

test('de lijst zegt de beperking ook zonder dat je een stad opent', () => {
  const { stad, landpakket } = maak();
  landpakket.activeer('NL', 'ik');
  stad.start('Rotterdam', { land: 'NL', door: 'ik' });
  const l = stad.stand();
  assert.equal(l.steden.length, 1);
  assert.match(l.let, /EEN geografie/);
  assert.equal(stad.stand('bestaatniet').status, 404);
});
