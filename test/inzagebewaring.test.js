/* BESLUIT 6: DE BEWARING VOLGT DE BELOFTE, EN NIET ANDERSOM.

   Het inzagejournaal was begrensd op 5000 REGELS. Tegen een lid zeggen we
   *"u kunt zien wie uw dossier bekeek"*; wat de code waarmaakte was *"wij bewaren
   de laatste vijfduizend inzages"*. Dat zijn twee beloftes, en bij vijftig
   inzages per dag lopen ze na honderd dagen uiteen -- stilletjes, want een
   afgevallen regel laat niets achter.

   De eigenaar heeft gekozen: de bewaring wordt uitgebreid naar de belofte. Dus
   bewaart het journaal op TIJD (BEWAARDAGEN), met een NOODREM (MAX) tegen
   ongebreidelde groei die ruim boven de termijn ligt.

   WAT DEZE TOETS BEWAAKT, en het derde punt is het eigenlijke:

     1. een regel BINNEN de termijn blijft staan, ook als er duizenden bijkomen
        -- de oude grens van 5000 zou hem hebben weggegooid;
     2. een regel BUITEN de termijn valt weg -- de termijn is echt en niet
        decoratief;
     3. bijt de NOODREM, dan is dat ZICHTBAAR. Een grens die stil afkapt is een
        belofte die stil breekt, en dat is precies de faalvorm die deze hele
        ronde heeft opgeruimd. Verjaring en noodrem worden daarom NOOIT op een
        hoop gegooid: het eerste is de termijn die werkt, het tweede is een
        tekort.

   GEMETEN MET DE MUTATIE (13 september 2026):
     a. snoei() alleen op MAX laten snoeien (de oude vorm) -> toets 2 zakt
     b. MAX terug naar 5000                                -> toets 1 zakt
     c. de noodremteller niet bijhouden                    -> toets 3 en 4 zakken
     d. `volledig` hard op true                            -> toets 4 zakt

   Draai los: node --test test/inzagebewaring.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const inzagelog = require('../server/inzagelog');

/* Een nepdatabase: het journaal krijgt zijn opslag via zet() binnen, dus deze
   toets heeft geen server nodig. `save` telt alleen mee dat hij is geroepen. */
function verseLog() {
  const db = { data: { inzageLog: [] } };
  inzagelog.zet(db, () => {}, null, null);
  return db;
}

const dagenGeleden = (n) => new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();

/* Een regel rechtstreeks in de rij zetten, met een gekozen datum. Dat kan niet
   via noteer() -- die stempelt `nu` -- en het is precies wat je nodig hebt om
   verjaring te beproeven zonder twee jaar te wachten. De hashketen raakt hier
   niet van slag: verifieer() is niet wat deze toets meet.

   DE RIJ STAAT NIEUWSTE-EERST, en deze toets is daar zelf op gezakt. De eerste
   versie duwde de regels er in leesvolgorde in (oud, daarna recent), en dan
   staat de OUDE vooraan -- terwijl snoei() van achteren pelt. Gevolg: de verjaarde
   regel bleef staan, en de toets wees een gebrek aan dat niet bestond. Precies
   de valkuil uit CLAUDE.md over de fixture die zich houdt aan de vorm die de code
   AANNEEMT in plaats van aan de echte: in productie zet noteer() met unshift, dus
   de rij is altijd aflopend. Zet de oudste dus als LAATSTE. */
function zetOud(db, dagen, over) {
  db.data.inzageLog.push({ at: dagenGeleden(dagen), doorId: 'k1', overId: String(over),
    waarom: 'oude regel', bron: 'toets' });
}

test('1. een regel binnen de termijn overleeft duizenden nieuwe -- de oude grens van 5000 niet', () => {
  const db = verseLog();
  zetOud(db, 10, 42);                       // tien dagen oud: ruim binnen de termijn
  for (let i = 0; i < 6000; i++) inzagelog.noteer({ door: { id: 'k' }, over: { id: i }, waarom: 'ruis', bron: 'toets' });
  const nog = db.data.inzageLog.some(r => String(r.overId) === '42');
  assert.ok(nog,
    'de regel van tien dagen oud is weggevallen terwijl hij binnen de bewaartermijn ligt. ' +
    'Dat is precies de oude vorm: begrenzen op AANTAL in plaats van op tijd, waardoor de ' +
    'belofte aan een lid stilletjes onvolledig wordt zodra het druk is.');
});

test('2. een regel buiten de termijn valt weg -- de termijn is echt', () => {
  const db = verseLog();
  zetOud(db, 5, 78);                                  // nieuwste eerst...
  zetOud(db, inzagelog.BEWAARDAGEN + 30, 77);         // ...en de verjaarde als laatste
  inzagelog.noteer({ door: { id: 'k' }, over: { id: 1 }, waarom: 'nieuw', bron: 'toets' });
  const ids = db.data.inzageLog.map(r => String(r.overId));
  assert.ok(!ids.includes('77'), 'een regel ouder dan de bewaartermijn hoort te zijn verjaard');
  assert.ok(ids.includes('78'), 'en een regel van vijf dagen oud hoort er nog te staan');
});

test('3. bijt de noodrem, dan wordt dat GETELD -- verjaring en noodrem zijn twee dingen', () => {
  const db = verseLog();
  /* Verjaring alleen mag de teller nooit aanraken: dat is de termijn die werkt. */
  zetOud(db, inzagelog.BEWAARDAGEN + 1, 99);
  inzagelog.noteer({ door: { id: 'k' }, over: { id: 1 }, waarom: 'nieuw', bron: 'toets' });
  assert.ok(!Number(db.data.inzageLogAfgekapt),
    'een VERJAARDE regel is opgeteld als noodremverlies. Dan meldt het journaal een tekort ' +
    'dat er niet is, en wordt het echte tekort onvindbaar in de ruis.');

  /* En nu de noodrem zelf: verse regels tot ruim over MAX. */
  const b = verseLog();
  for (let i = 0; i < inzagelog.MAX + 25; i++) {
    b.data.inzageLog.push({ at: new Date().toISOString(), doorId: 'k', overId: String(i), waarom: 'x', bron: 't' });
  }
  inzagelog.noteer({ door: { id: 'k' }, over: { id: 'laatste' }, waarom: 'nieuw', bron: 'toets' });
  assert.ok(Number(b.data.inzageLogAfgekapt) > 0,
    'de noodrem heeft afgekapt zonder dat iemand dat kan zien. Een grens die stil afkapt, ' +
    'is een belofte die stil breekt.');
});

test('4. het antwoord aan een betrokkene DRAAGT de belofte, en zegt wanneer die niet klopt', () => {
  const db = verseLog();
  inzagelog.noteer({ door: { id: 'k' }, over: { id: 5 }, waarom: 'controle', bron: 'toets' });

  const goed = inzagelog.voorBetrokkene(5);
  assert.ok(Array.isArray(goed.regels) && goed.regels.length === 1, 'de regels staan erin');
  assert.equal(goed.bewaardagen, inzagelog.BEWAARDAGEN, 'de termijn reist mee met het antwoord');
  assert.match(goed.belofte, new RegExp(String(inzagelog.BEWAARDAGEN)),
    'de belofte noemt de termijn, zodat een scherm hem niet hoeft te verzinnen');
  assert.equal(goed.volledig, true, 'zonder noodremverlies is het overzicht volledig');
  assert.equal(goed.tekort, null, 'en dan staat er geen tekort bij');

  /* En met een tekort hoort het antwoord dat te ZEGGEN in plaats van het weg te laten. */
  db.data.inzageLogAfgekapt = 12;
  const mager = inzagelog.voorBetrokkene(5);
  assert.equal(mager.volledig, false, 'met noodremverlies is het overzicht niet volledig');
  assert.match(String(mager.tekort), /12/, 'en het zegt om hoeveel regels het gaat');

  const s = inzagelog.samenvatting();
  assert.equal(s.bewaring.afgekaptDoorNoodrem, 12, 'de samenvatting meldt hetzelfde getal');
  assert.equal(s.bewaring.volledig, false, 'en trekt dezelfde conclusie');
  assert.equal(s.bewaring.dagen, inzagelog.BEWAARDAGEN, 'met de termijn erbij');
});
