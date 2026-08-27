/* Stadsstart (kern/command/stadstart.js): een stad inrichten, en eerlijk zeggen
   wat een knop niet kan.

   WAT DEZE TOETS VOORAL BEWAAKT is dat een MISLUKTE weefselbouw niet als groen
   wordt gemeld. Deze stap stond lang op "kan een knop niet doen", omdat de boom
   één geografie droeg; sinds kern/stadsweefsel/steden.js draagt hij er meer en
   bouwt deze knop hem echt. Maar hij kan mislukken -- geen middelpunt, een stad
   die overlapt -- en dan hoort de stap open te blijven staan met de reden. De
   duurste variant is de andere: iemand start Antwerpen, ziet "ingericht", en
   ontdekt een maand later dat elke meting in de zones van de eerste stad is
   geboekt.

   En het tweede: een stad in een land dat niet is ingericht, is een stad zonder
   munt, zonder tarieven en zonder loonregels. Dat wordt geweigerd en niet
   half gedaan.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de weefselstap altijd op gedaan:true zetten
     -> "zonder middelpunt blijft de weefselstap openstaan, met de reden" ZAKT (RAAK)
   - de landcontrole uit start() halen
     -> "een stad zonder ingericht land gaat niet door" ZAKT (RAAK)
   - stop() de per-plaats-standen laten staan
     -> "stoppen haalt de per-plaats-standen weg" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakStadstart } = require('../server/kern/command/stadstart');
const { maakLandpakket } = require('../server/kern/command/landpakket');
const maakCmdOpslag = require('../server/kern/command/opslag');
const fiscaal = require('../server/kern/fiscaal/landen');
const valuta = require('../server/kern/payroll/valuta');
const { plaatsNorm } = require('../server/functies/toegang');

function maak() {
  const db = { data: { talen: { actief: ['nl', 'en'] }, techniek: { functies: {} } } };
  const regels = [];
  const journaal = { noteer: r => regels.push(r) };
  const functies = { OP_ID: { 'supplier-pos': { id: 'supplier-pos' } } };
  const landpakket = maakLandpakket({ db, opslag: maakCmdOpslag({ db }), save: () => {}, journaal, fiscaal, valuta,
    talen: () => db.data.talen, functies });
  /* Een nagemaakt weefsel dat zich als het echte gedraagt: het kent zones per
     stad en alleen van steden die er zijn gezet. */
  const bak = {};
  const weefsel = {
    weefselZones: (naam) => bak[String(naam || '')] || [],
    weefselStadErbij: ({ naam }) => {
      if (bak[naam]) return { status: 409, error: 'bestaat al' };
      bak[naam] = ['Oud-West', 'Centrum', 'Marina', 'Bedrijvenkwartier', 'Groenzone', 'Boulevard'];
      return { stad: { id: 'G-x-stad', naam }, zones: bak[naam] };
    }
  };
  const stad = maakStadstart({ db, opslag: maakCmdOpslag({ db }), save: () => {}, journaal, landpakket, functies, plaatsNorm, weefsel });
  return { db, stad, landpakket, regels, bak };
}

test('een stad zonder ingericht land gaat niet door', () => {
  const { stad } = maak();
  const r = stad.start('Antwerpen', { land: 'XX', door: 'ik' });
  assert.equal(r.status, 409);
  assert.match(r.error, /zonder munt/);
  assert.equal(stad.start('Antwerpen', { door: 'ik' }).status, 409, 'en zonder land ook niet');

  /* EN EEN PAKKET DAT WEL BESTAAT MAAR UITSTAAT IS OOK NIET GENOEG. Dit geval
     stond er eerst niet, en de code was daardoor lakser dan zijn eigen melding:
     hij liet elk land door waarvoor een pakket in LANDEN.json stond, ook als
     niemand het had aangezet. */
  const uit = stad.start('Antwerpen', { land: 'BE', door: 'ik' });
  assert.equal(uit.status, 409);
  assert.match(uit.error, /Zet eerst het landpakket/);
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

test('met een middelpunt wordt het weefsel echt gebouwd', () => {
  /* DEZE STAP STOND OP "KAN EEN KNOP NIET DOEN", en dat was waar zolang de boom
     één geografie droeg. Sinds kern/stadsweefsel/steden.js draagt hij meerdere
     wortels, en meet deze stap of DEZE stad er echt in staat. */
  const { stad, landpakket, bak } = maak();
  landpakket.activeer('BE', 'ik');
  const r = stad.start('Antwerpen', { land: 'BE', lat: 51.22, lng: 4.40, door: 'ik' });
  const w = r.stappen.find(s => s.stap === 'stadsweefsel');
  assert.equal(w.gedaan, true);
  assert.match(w.uitleg, /6 zones/);
  assert.deepEqual(r.open, [], 'er staat geen stap meer open');
  assert.equal(bak.Antwerpen.length, 6, 'en het weefsel is echt aangeroepen');
  assert.match(r.let, /eerlijker dan de knop/);
});

test('zonder middelpunt blijft de weefselstap openstaan, met de reden', () => {
  /* DE ANDERE KANT, en die is belangrijker: een mislukte weefselbouw mag NIET
     als groen gemeld worden. Zonder lat en lng valt er niets te bouwen, en dan
     staat de stap open met de reden erbij in plaats van te verdwijnen. */
  const { stad, landpakket, db } = maak();
  landpakket.activeer('BE', 'ik');
  const r = stad.start('Antwerpen', { land: 'BE', door: 'ik' });
  const w = r.stappen.find(s => s.stap === 'stadsweefsel');
  assert.equal(w.gedaan, false);
  assert.match(w.uitleg, /staat niet in het weefsel/);
  assert.deepEqual(r.open, ['stadsweefsel']);
  assert.match(db.data.steden.antwerpen.weefsel.fout, /geen middelpunt/);
  assert.ok(r.mensenwerk.length >= 5, 'en er blijft mensenwerk staan');
});

test('starten zet de per-plaats-standen, stoppen haalt ze weg', () => {
  const { db, stad, landpakket } = maak();
  landpakket.activeer('BE', 'ik');
  stad.start('Antwerpen', { land: 'BE', lat: 51.22, lng: 4.40, door: 'ik', sluit: ['supplier-pos', 'bestaat-niet'] });
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
