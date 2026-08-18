/* HET BOARDROOM-JOURNAAL VAN HET LID AAN DE HASHKETEN.

   Dit journaal bestaat om twee vragen te kunnen beantwoorden: "stond dat altijd
   al uit?" en "wie heeft dat aangezet?" -- bij een kind kan dat antwoord een
   ouder zijn. Die antwoorden zijn precies zoveel waard als de zekerheid dat er
   niemand achteraf aan gesleuteld heeft, en die zekerheid ontbrak.

   De keten loopt PER BOARDROOM, want zo is het journaal opgeslagen: een lijst
   per lid. Dat past bij de wisregel: op verzoek van de betrokkene verdwijnt
   zijn hele lijst, en dat laat geen gat in andermans keten.

   Draai los: node --test test/boardlog-keten.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const keten = require('../server/lib/keten');
const { maakJournaal, MAX } = require('../server/kern/lidboard/journaal');

/* Een nepdatabase; dit journaal raakt db.data zelf aan en niets anders. */
function maak() {
  const db = { data: {} };
  let saves = 0;
  return { j: maakJournaal({ db, save: () => { saves++; } }), db, saves: () => saves };
}

const wijziging = (id, van, naar) => [{ id, naam: id, van, naar }];

test('elke omzetting komt geketend in het journaal van dat lid', () => {
  const { j } = maak();
  j.noteer('lid-a', wijziging('locatie', true, false), { door: 'lid', bron: 'boardroom' });
  j.noteer('lid-a', wijziging('paspoort', true, false), { door: 'ouder', bron: 'ouderbord' });

  const rijen = j.lijst('lid-a', 50);
  assert.equal(rijen.length, 2);
  for (const r of rijen) {
    assert.ok(r.hash, 'elke regel hoort een hash te dragen');
    assert.ok(Number.isInteger(r.nr), 'en een volgnummer');
  }
  assert.equal(rijen[0].door, 'ouder', 'nieuwste vooraan');

  const stand = j.keten('lid-a');
  assert.equal(stand.ok, true, 'een ongemoeid journaal is heel');
  assert.equal(stand.top, rijen[0].hash, 'de top is de hash van de nieuwste');
});

test('een regel bijstellen valt op -- ook als iemand de stand omdraait', () => {
  const { j, db } = maak();
  j.noteer('lid-a', wijziging('locatie', true, false), { door: 'lid' });
  j.noteer('lid-a', wijziging('vindbaar', true, false), { door: 'lid' });

  assert.equal(j.keten('lid-a').ok, true);

  // "dat heeft het lid zelf gedaan" -- van ouder naar lid herschrijven
  db.data.ledenBoardLog['lid-a'][1].door = 'ouder';

  const stand = j.keten('lid-a');
  assert.equal(stand.ok, false, 'aan een regel sleutelen HOORT op te vallen');
  assert.ok(stand.gebroken.length > 0, 'en wel op een aanwijsbaar punt');
});

test('een regel uit het midden weghalen valt op bij zijn opvolger', () => {
  const { j, db } = maak();
  for (const id of ['a', 'b', 'c', 'd']) j.noteer('lid-a', wijziging(id, true, false), { door: 'lid' });
  assert.equal(j.keten('lid-a').ok, true);

  db.data.ledenBoardLog['lid-a'].splice(1, 1);
  assert.equal(j.keten('lid-a').ok, false, 'een regel wegnemen hoort op te vallen');
});

test('de journalen van twee leden staan los van elkaar', () => {
  const { j } = maak();
  j.noteer('lid-a', wijziging('locatie', true, false), { door: 'lid' });
  j.noteer('lid-b', wijziging('locatie', true, false), { door: 'lid' });

  assert.equal(j.keten('lid-a').ok, true);
  assert.equal(j.keten('lid-b').ok, true);
  assert.notEqual(j.keten('lid-a').top, j.keten('lid-b').top, 'twee leden, twee ketens');
  assert.equal(j.lijst('lid-a', 50).length, 1, 'en geen kruisbestuiving');
});

/* DEZE TOETS VOND EEN ECHTE ZWAKTE, en staat er daarom met zoveel woorden.

   Eerst droeg de regel niet WIENS journaal het was. Twee leden die in dezelfde
   milliseconde dezelfde knop omzetten kregen daardoor letterlijk identieke
   regels, inclusief hash -- en dan is een regel van het ene lid ongemerkt in
   het journaal van het andere te leggen. Voor een spoor dat moet antwoorden op
   "wie heeft dat aangezet?" is dat geen detail. */
test('een regel van een ander lid in jouw journaal leggen valt op', () => {
  const { j, db } = maak();
  j.noteer('lid-a', wijziging('locatie', true, false), { door: 'lid', bron: 'boardroom' });
  j.noteer('lid-b', wijziging('locatie', true, false), { door: 'ouder', bron: 'boardroom' });

  // de regel van lid-b overzetten naar lid-a, alsof hij daar altijd stond
  const vanB = db.data.ledenBoardLog['lid-b'][0];
  db.data.ledenBoardLog['lid-a'].unshift(JSON.parse(JSON.stringify(vanB)));

  const stand = j.keten('lid-a');
  assert.equal(stand.ok, false, 'een regel van een ander erin schuiven HOORT op te vallen');
});

test('wissen op verzoek haalt het hele spoor weg en laat geen gebroken keten achter', () => {
  const { j } = maak();
  j.noteer('lid-a', wijziging('locatie', true, false), { door: 'lid' });
  j.noteer('lid-b', wijziging('locatie', true, false), { door: 'lid' });

  assert.equal(j.wis('lid-a'), true);
  assert.equal(j.lijst('lid-a', 50).length, 0, 'weg is weg');
  assert.equal(j.keten('lid-a').ok, true, 'een leeg journaal is heel, niet gebroken');
  assert.equal(j.keten('lid-b').ok, true, 'en de buurman merkt er niets van');
});

test('de grens blijft gelden en snoeit de OUDSTE, niet de nieuwste', () => {
  const { j } = maak();
  for (let i = 0; i < MAX + 25; i++) j.noteer('lid-a', wijziging('f' + i, true, false), { door: 'lid' });

  const rijen = j.lijst('lid-a', MAX);
  assert.equal(rijen.length, MAX, 'de grens hoort gehandhaafd te worden');
  assert.equal(rijen[0].wijzigingen[0].id, 'f' + (MAX + 24), 'de nieuwste staat er nog');

  const stand = j.keten('lid-a');
  assert.equal(stand.gebroken.length, 0, 'snoeien aan de staart breekt de keten niet');
  assert.equal(stand.afgekapt, true, 'maar het meldt wel dat de oudste eruit liepen');
});

test('een bulk-actie blijft EEN gebeurtenis met EEN hash', () => {
  const { j } = maak();
  const veel = ['locatie', 'paspoort', 'vindbaar'].map(id => ({ id, naam: id, van: true, naar: false }));
  j.noteer('lid-a', veel, { door: 'lid', bron: 'alles-uit' });

  const rijen = j.lijst('lid-a', 50);
  assert.equal(rijen.length, 1, '"alles uit" is voor de lezer een gebeurtenis, geen drie');
  assert.equal(rijen[0].wijzigingen.length, 3);
  assert.equal(j.keten('lid-a').ok, true);
});

test('een journaal van vóór de keten gaat niet stuk', () => {
  const { j, db } = maak();
  // zoals het op schijf stond voordat de keten er was
  db.data.ledenBoardLog = { 'lid-a': [{ at: 'toen', door: 'lid', bron: 'boardroom', wijzigingen: [] }] };
  j.noteer('lid-a', wijziging('locatie', true, false), { door: 'lid' });

  const stand = j.keten('lid-a');
  assert.equal(stand.gebroken.length, 0, 'een bestaande installatie hoort hier niet op stuk te gaan');
  assert.equal(stand.zonderKeten, 1, 'de oude regel wordt geteld, niet veroordeeld');
});
