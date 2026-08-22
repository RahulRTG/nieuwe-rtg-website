/* ============================================================================
   DE DIENST: ZERO-SEARCH, EN WAT ER NIET BIJ KOMT.

   WAAROM DIT BESTAAT

   Een medewerker die zijn dienst opent, hoort niet te hoeven zoeken naar iets
   wat het systeem al weet: welke dienst is van mij, waar is dat, wie staat er
   nog meer, en wat moet ik weten voor ik begin. Dat is fase 4 uit FESTIVAL.md,
   en het is EEN vraag: mijnDienst().

   De verleiding daarbij is om er een tweede rooster, een tweede klok en een
   stiptheidscijfer omheen te bouwen. Deze toets sluit die drie.

   WAT ER WORDT VASTGELEGD
    1. Een dienst valt binnen de openingstijden van zijn dag.
    2. Een dienst eindigt na zijn begin.
    3. Niemand staat op twee plekken tegelijk.
   3b. Ook niet als de dienst over middernacht heen loopt.
    4. Twee diensten die elkaar NIET overlappen mogen wel.
    5. mijnDienst geeft de lopende dienst en de eerstvolgende.
    6. De weg erheen is de keten van plekken, van buiten naar binnen.
    7. Collega's zijn wie er op dezelfde plek in hetzelfde venster staat.
    8. Er komt geen klok en geen score bij: de vorm van het antwoord ligt vast.
    9. Buiten een dienst is `nu` leeg en staat er wel wat er straks komt.
   10. Zonder dag is er geen dienst, en dat wordt gezegd in plaats van geraden.

   DE MUTATIES staan aan het slot.
   Draai los: node --test test/festival-dienst.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { schoon } = require('../server/kern/util');
const maakFestival = require('../server/kern/festival');

function wereld() {
  const db = { data: {} };
  const k = maakFestival({ db, save() {}, crypto, schoon });
  const fid = k.festivalNieuw('ZAAK1', { naam: 'Testival' }).festival.id;
  const eid = k.editieNieuw(fid, { jaar: 2027 }).editie.id;
  const dag = k.dagZet(fid, eid, { datum: '2027-07-02', open: '12:00', sluit: '02:00' }).dag;
  const p = (d) => k.plekZet(fid, eid, d).plek;
  const terrein = p({ naam: 'Terrein', soort: 'terrein', capaciteit: 5000 });
  const weide = p({ naam: 'Weide', soort: 'zone', ouder: terrein.id, capaciteit: 2000 });
  const bar = p({ naam: 'Bar Lima', soort: 'bar', ouder: weide.id });
  const kassa = p({ naam: 'Kassa Noord', soort: 'food', ouder: terrein.id });

  const zet = (d) => k.dienstZet(fid, eid, { dag: dag.id, ...d });
  const mijn = (wie, tijd) => k.mijnDienst(fid, eid, { wie, dag: dag.id, tijd });
  return { k, fid, eid, dag, terrein, weide, bar, kassa, zet, mijn };
}

test('1. een dienst valt binnen de openingstijden van zijn dag', () => {
  const w = wereld();
  const buiten = w.zet({ plek: w.bar.id, wie: 'Sara', van: '09:00', tot: '11:00' });
  assert.equal(buiten.status, 400);
  assert.match(buiten.error, /buiten de openingstijden/);
  assert.equal(w.zet({ plek: w.bar.id, wie: 'Sara', van: '16:00', tot: '23:00' }).ok, true);
});

test('2. een dienst eindigt na zijn begin', () => {
  const w = wereld();
  const fout = w.zet({ plek: w.bar.id, wie: 'Sara', van: '20:00', tot: '20:00' });
  assert.equal(fout.status, 400);
  assert.match(fout.error, /eindigt niet/);
});

test('3. niemand staat op twee plekken tegelijk', () => {
  const w = wereld();
  assert.equal(w.zet({ plek: w.bar.id, wie: 'Sara', van: '16:00', tot: '23:00' }).ok, true);
  const dubbel = w.zet({ plek: w.kassa.id, wie: 'Sara', van: '20:00', tot: '22:00' });
  assert.equal(dubbel.status, 409);
  assert.match(dubbel.error, /Bar Lima/, 'en hij zegt waar ze al staat');
  /* Een rooster waarin dit kan, is geen rooster maar een verlanglijst: op de
     dag zelf staat er dan een bar zonder mensen terwijl het rooster groen is. */
});

test('3b. ook niet als de dienst over middernacht heen loopt', () => {
  const w = wereld();
  /* De dag loopt van 12:00 tot 02:00. Een dienst van 22:00 tot 01:00 en een
     van 00:00 tot 01:30 overlappen -- maar op de KLOK gelezen is "22:00" groter
     dan "01:30", en dan lijken ze elkaar niet te raken. Dat is precies waarom
     overlapt() in minuten na opening rekent en niet in tekst. */
  assert.equal(w.zet({ plek: w.bar.id, wie: 'Sara', van: '22:00', tot: '01:00' }).ok, true);
  const dubbel = w.zet({ plek: w.kassa.id, wie: 'Sara', van: '00:00', tot: '01:30' });
  assert.equal(dubbel.status, 409, 'over middernacht heen is het nog steeds dezelfde nacht');
  assert.match(dubbel.error, /Bar Lima/);
});

test('4. twee diensten die elkaar niet overlappen mogen wel', () => {
  const w = wereld();
  assert.equal(w.zet({ plek: w.bar.id, wie: 'Sara', van: '16:00', tot: '20:00' }).ok, true);
  assert.equal(w.zet({ plek: w.kassa.id, wie: 'Sara', van: '20:00', tot: '23:00' }).ok, true,
    'aansluitend is niet overlappend');
});

test('5. mijnDienst geeft de lopende dienst en de eerstvolgende', () => {
  const w = wereld();
  w.zet({ plek: w.bar.id, wie: 'Sara', van: '16:00', tot: '20:00', rol: 'Bar' });
  w.zet({ plek: w.kassa.id, wie: 'Sara', van: '21:00', tot: '23:00', rol: 'Kassa' });

  const om18 = w.mijn('Sara', '18:00');
  assert.equal(om18.nu.plek, 'Bar Lima');
  assert.equal(om18.nu.rol, 'Bar');
  assert.equal(om18.straks.plek, 'Kassa Noord');
});

test('6. de weg erheen is de keten van plekken, van buiten naar binnen', () => {
  const w = wereld();
  w.zet({ plek: w.bar.id, wie: 'Sara', van: '16:00', tot: '20:00' });
  const d = w.mijn('Sara', '18:00').nu;
  assert.deepEqual(d.weg, ['Terrein', 'Weide', 'Bar Lima'],
    'dat is wat iemand nodig heeft die er nog nooit is geweest');
});

test('7. collegas zijn wie er op dezelfde plek in hetzelfde venster staat', () => {
  const w = wereld();
  w.zet({ plek: w.bar.id, wie: 'Sara', van: '16:00', tot: '23:00' });
  w.zet({ plek: w.bar.id, wie: 'Toni', van: '18:00', tot: '23:00', rol: 'Runner' });
  w.zet({ plek: w.bar.id, wie: 'Ines', van: '12:30', tot: '15:00' });   // andere uren
  w.zet({ plek: w.kassa.id, wie: 'Pere', van: '18:00', tot: '20:00' }); // andere plek

  const d = w.mijn('Sara', '19:00').nu;
  assert.deepEqual(d.collegas.map(c => c.wie), ['Toni']);
  assert.equal(d.collegas[0].rol, 'Runner');
});

test('8. er komt geen klok en geen score bij', () => {
  const w = wereld();
  w.zet({ plek: w.bar.id, wie: 'Sara', van: '16:00', tot: '20:00', briefing: 'Bekers bij B12', pauze: '18:00' });
  const d = w.mijn('Sara', '17:00').nu;

  /* De VORM van het antwoord ligt vast. Komt er ooit een stiptheidscijfer of
     een tweede urenstaat bij, dan zakt deze toets en volgt er een gesprek --
     in- en uitklokken hoort in kern/personeel.js te blijven, en een score op
     een mens hoort nergens (LIFE.md, CLAUDE.md). */
  assert.deepEqual(Object.keys(d).sort(),
    ['briefing', 'collegas', 'id', 'pauze', 'plek', 'rol', 'tot', 'van', 'weg']);
  const alles = JSON.stringify(d).toLowerCase();
  for (const woord of ['score', 'stiptheid', 'ingeklokt', 'uren', 'beoordeling', 'ranglijst']) {
    assert.ok(!alles.includes(woord), 'de dienst draagt geen "' + woord + '"');
  }
});

test('9. buiten een dienst is nu leeg en staat er wel wat er straks komt', () => {
  const w = wereld();
  w.zet({ plek: w.bar.id, wie: 'Sara', van: '16:00', tot: '20:00' });
  const vroeg = w.mijn('Sara', '13:00');
  assert.equal(vroeg.nu, null);
  assert.equal(vroeg.straks.plek, 'Bar Lima');

  const laat = w.mijn('Sara', '23:00');
  assert.equal(laat.nu, null);
  assert.equal(laat.straks, null, 'na afloop wordt er niets verzonnen');
});

test('10. zonder dag is er geen dienst, en dat wordt gezegd', () => {
  const w = wereld();
  const r = w.k.mijnDienst(w.fid, w.eid, { wie: 'Sara', dag: 'bestaatniet', tijd: '18:00' });
  assert.equal(r.ok, true);
  assert.equal(r.nu, null);
  assert.equal(r.geenDag, true, 'geen dag open is een antwoord, geen fout en geen gok');
});

/* ============================================================================
   DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2)

   Tien mutaties, alle tien RAAK -- de tweede pas na een toets die er nog niet
   was, en dat is de vijfde keer deze ronde dat een afgeslagen mutatie een gat
   in de TOETSEN aanwijst in plaats van in de code.

    1. De overlapcontrole weghalen. -> toets 3 zakte.

    2. overlapt() op KLOKTIJD laten vergelijken in plaats van op minuten na
       opening. Sloeg eerst af: geen enkele toets had een dienst die over
       middernacht heen liep, en binnen een avond is de tekstvolgorde toevallig
       gelijk aan de tijdsvolgorde. Toets 3b staat er nu (22:00-01:00 tegen
       00:00-01:30) en zakt erop.

    3. De dienst niet meer binnen de openingstijden hoeven vallen. -> toets 1.
    4. Een dienst op zijn eigen begin laten eindigen. -> toets 2.
    5. De lopende dienst gewoon de eerste laten zijn. -> toets 9 zakte: om 13:00
       stond er een dienst "nu" die pas om 16:00 begint.
    6. De weg van binnen naar buiten laten lopen. -> toets 6.
    7. Collega's iedereen op die plek laten zijn, ongeacht de tijd. -> toets 7.
    8. Een urenstaat aan het antwoord toevoegen. -> toets 8 zakte. Dat is de
       toets die de VORM vastlegt: in- en uitklokken hoort in kern/personeel.js
       te blijven, en een score op een mens hoort nergens.
    9. `straks` niet naar het moment laten kijken. -> toets 9.
   10. Zonder dag toch een gok doen in plaats van geenDag te melden. -> toets 10.
   ========================================================================== */
