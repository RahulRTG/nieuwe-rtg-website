/* Landpakketten (kern/command/landpakket.js): een land aanzetten als
   configuratiebundel.

   WAT DEZE TOETS VOORAL BEWAAKT is dat "geactiveerd" nooit gaat lezen als "in
   orde". Een pakket dekt de INRICHTING en niet de naleving: btw-registratie,
   loonaangifte en een toezichthouder blijven mensenwerk, en die lijst hoort na
   het activeren gewoon te blijven staan. Een knop die "land actief" meldt
   terwijl er geen btw-nummer is, is de duurste knop van dit scherm.

   En het tweede: LANDEN.json draagt alleen wat nergens anders staat. De
   fiscale kennis komt uit kern/fiscaal/landen.js en de muntschaal uit
   kern/payroll/valuta.js -- als die daar verdwijnen, hoort de stand dat te
   melden en niet stilzwijgend groen te blijven.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de mensenwerk-lijst leegmaken zodra een pakket geactiveerd is
     -> "activeren maakt de mensenwerk-lijst niet korter" ZAKT (RAAK)
   - `klaar` op true zetten ongeacht de onderdelen
     -> "een ontbrekend onderdeel maakt het pakket niet klaar" ZAKT (RAAK)
   - terug() de per-land-standen laten staan
     -> "terugdraaien haalt de per-land-standen weg" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakLandpakket } = require('../server/kern/command/landpakket');
const maakCmdOpslag = require('../server/kern/command/opslag');
const fiscaal = require('../server/kern/fiscaal/landen');
const valuta = require('../server/kern/payroll/valuta');

function maak(opties) {
  const o = opties || {};
  const db = { data: { talen: o.talen || { actief: ['nl', 'en'] }, techniek: { functies: {} } } };
  const regels = [];
  const land = maakLandpakket({ db, opslag: maakCmdOpslag({ db }), save: () => {}, journaal: { noteer: r => regels.push(r) },
    fiscaal, valuta, talen: () => db.data.talen,
    functies: { OP_ID: { 'supplier-pos': { id: 'supplier-pos' } } } });
  return { db, land, regels };
}

test('de lijst komt uit LANDEN.json en zegt per land hoeveel mensenwerk er ligt', () => {
  const { land } = maak();
  const l = land.stand();
  assert.equal(l.bestand, 'LANDEN.json');
  assert.ok(l.pakketten.length >= 4);
  const jp = l.pakketten.find(p => p.land === 'JP');
  assert.equal(jp.valuta, 'JPY');
  assert.ok(jp.mensenwerk >= 1, 'er blijft mensenwerk staan');
  assert.match(l.let, /nooit de naleving/);
});

test('de stand leunt op wat het huis al weet', () => {
  const { land } = maak();
  const es = land.stand('ES');
  const fisc = es.onderdelen.find(o => o.wat === 'fiscale kennis');
  assert.equal(fisc.ligt, true);
  assert.equal(fisc.bron, 'kern/fiscaal/landen.js', 'en niet uit een tweede tabel hier');
  const munt = es.onderdelen.find(o => o.wat === 'munt');
  assert.equal(munt.bron, 'kern/payroll/valuta.js');
  assert.match(munt.uitleg, /2 decimalen/);

  /* De yen heeft er nul, en dat komt uit dezelfde tabel. */
  assert.match(land.stand('JP').onderdelen.find(o => o.wat === 'munt').uitleg, /0 decimalen/);
  assert.equal(land.stand('XX').status, 404);
});

test('een ontbrekend onderdeel maakt het pakket niet klaar', () => {
  /* Spanje staat in het pakket op Engels omdat er geen Spaanse vertaling ligt.
     Zet je Engels uit, dan hoort dat pakket NIET klaar te zijn. */
  const { land } = maak({ talen: { actief: ['nl'] } });
  const es = land.stand('ES');
  assert.equal(es.klaar, false);
  assert.deepEqual(es.ontbreekt, ['voertaal']);
  assert.match(es.onderdelen.find(o => o.wat === 'voertaal').uitleg, /staat niet in de actieve talen/);
  assert.equal(land.stand('NL').klaar, true, 'Nederland ligt er wel');
});

test('activeren maakt de mensenwerk-lijst niet korter', () => {
  /* DE KERN. "Geactiveerd" mag nooit gaan lezen als "in orde". */
  const { land, regels } = maak();
  const voor = land.stand('NL').mensenwerk.length;
  const na = land.activeer('NL', 'ik');
  assert.equal(na.mensenwerk.length, voor, 'precies evenveel punten mensenwerk als ervoor');
  assert.match(na.waarschuwing, /verdwijnt niet door te activeren/);
  assert.ok(na.actief && na.actief.door === 'ik');
  assert.ok(regels.some(r => r.actie === 'landpakket geactiveerd'));
  assert.equal(land.activeer('XX', 'ik').status, 404);
});

test('terugdraaien haalt de per-land-standen weg', () => {
  const { db, land } = maak();
  /* Een pakket dat wél iets sluit, om de heen- en terugweg te kunnen zien. */
  const pak = land.pakketVan('NL');
  pak.sluit = ['supplier-pos'];
  try {
    land.activeer('NL', 'ik');
    assert.equal(db.data.techniek.functies['supplier-pos'].perLand.NL, false);
    assert.deepEqual(land.stand('NL').onderdelen.find(o => o.wat === 'schakelkast').uitleg.includes('supplier-pos'), true);

    land.terug('NL', 'ik');
    assert.equal(db.data.techniek.functies['supplier-pos'].perLand.NL, undefined);
    assert.equal(db.data.landen.NL, undefined);
    assert.equal(land.terug('NL', 'ik').status, 404, 'twee keer terug kan niet');
  } finally {
    pak.sluit = [];
  }
});

test('een onbekende functie in een pakket wordt overgeslagen en niet verzonnen', () => {
  const { db, land } = maak();
  const pak = land.pakketVan('BE');
  pak.sluit = ['bestaat-niet', 'supplier-pos'];
  try {
    const r = land.activeer('BE', 'ik');
    assert.deepEqual(r.zojuistGezet, ['supplier-pos']);
    assert.equal(db.data.techniek.functies['bestaat-niet'], undefined);
  } finally {
    pak.sluit = [];
    land.terug('BE', 'ik');
  }
});
