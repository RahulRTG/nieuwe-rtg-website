/* ============================================================================
   ARTIEST EN PODIUM: EEN VOORNEMEN IS GEEN PROGRAMMA.

   WAAROM DIT BESTAAT

   CLAUDE.md verbiedt met zoveel woorden te doen alsof een boeking verwerkt is.
   Op een podiumschema is dat verschil het verschil tussen een programma en een
   wensenlijst -- en een half uur voor de deuren opengaan is een onbevestigde
   set geen administratieve achterstand meer maar een gat in het programma.

   WAT ER WORDT VASTGELEGD

    1. Een nieuwe boeking staat op VOORNEMEN; RTG bevestigt nooit zelf.
    2. Bevestigen vraagt een naam EN waaruit het blijkt.
    3. Twee sets botsen niet op hetzelfde podium.
    4. De changeover van het podium telt mee, ook over middernacht heen.
    5. Een afgezegde boeking blokkeert het podium niet meer.
    6. Een soundcheck valt binnen de dag en voor de set.
    7. Het beeld geeft nu, straks en de tijd ertussen.
    8. Een onbevestigde set die zo opgaat, is KRITIEK.
    9. Open riderpunten wegen zwaarder naarmate de set dichterbij komt.
   10. De podiumsignalen komen op dezelfde hoop als de rest.
   11. De afrekening is een overzicht en zegt dat er niets is betaald.

   DE MUTATIES staan aan het slot.
   Draai los: node --test test/festival-podium.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { schoon } = require('../server/kern/util');
const maakFestival = require('../server/kern/festival');

function wereld() {
  const db = { data: {} };
  const k = maakFestival({ db, save() {}, crypto, schoon, kern: () => ({}) });
  const fid = k.festivalNieuw('ZAAK1', { naam: 'Testival' }).festival.id;
  const eid = k.editieNieuw(fid, { jaar: 2027 }).editie.id;
  const dag = k.dagZet(fid, eid, { datum: '2027-07-02', open: '12:00', sluit: '02:00' }).dag;
  const terrein = k.plekZet(fid, eid, { naam: 'Terrein', soort: 'terrein', capaciteit: 9000 }).plek;
  const alpha = k.plekZet(fid, eid, { naam: 'Alpha', soort: 'podium', ouder: terrein.id,
    capaciteit: 8000, changeover: 30 }).plek;
  const bravo = k.plekZet(fid, eid, { naam: 'Bravo', soort: 'podium', ouder: terrein.id, capaciteit: 2000 }).plek;

  const boek = (d) => k.boekingZet(fid, eid, { dag: dag.id, podium: alpha.id, ...d });
  const beeld = (tijd) => k.podiumBeeld(fid, eid, { dag: dag.id, tijd });
  const sig = (tijd, vooruit) => k.podiumSignalen(fid, eid, { dag: dag.id, tijd, vooruit });
  return { k, fid, eid, dag, terrein, alpha, bravo, boek, beeld, sig };
}

test('1. een nieuwe boeking staat op voornemen', () => {
  const w = wereld();
  const b = w.boek({ artiest: 'Fred Again', van: '21:00', tot: '22:30' });
  assert.equal(b.ok, true);
  assert.equal(b.boeking.stand, 'voornemen', 'RTG bevestigt nooit namens een artiest');
  assert.equal(b.boeking.bevestigd, null);
});

test('2. bevestigen vraagt een naam en waaruit het blijkt', () => {
  const w = wereld();
  const b = w.boek({ artiest: 'Fred Again', van: '21:00', tot: '22:30' }).boeking;

  assert.equal(w.k.boekingStand(w.fid, w.eid, { id: b.id, stand: 'bevestigd' }).status, 400);
  const zonderHoe = w.k.boekingStand(w.fid, w.eid, { id: b.id, stand: 'bevestigd', door: 'Marta' });
  assert.equal(zonderHoe.status, 400);
  assert.match(zonderHoe.error, /Waaruit blijkt dat/);

  const met = w.k.boekingStand(w.fid, w.eid, { id: b.id, stand: 'bevestigd',
    door: 'Marta', hoe: 'getekend contract 3 juni' });
  assert.equal(met.ok, true);
  assert.equal(met.boeking.bevestigd.door, 'Marta');
  assert.equal(met.boeking.bevestigd.hoe, 'getekend contract 3 juni');
});

test('3. twee sets botsen niet op hetzelfde podium', () => {
  const w = wereld();
  assert.equal(w.boek({ artiest: 'Een', van: '18:00', tot: '19:00' }).ok, true);
  const botst = w.boek({ artiest: 'Twee', van: '18:30', tot: '19:30' });
  assert.equal(botst.status, 409);
  assert.match(botst.error, /Alpha is dan bezet door Een/);
  assert.equal(w.k.boekingZet(w.fid, w.eid, { dag: w.dag.id, podium: w.bravo.id,
    artiest: 'Twee', van: '18:30', tot: '19:30' }).ok, true, 'op een ander podium mag het wel');
});

test('4. de changeover telt mee, ook over middernacht heen', () => {
  const w = wereld();
  assert.equal(w.boek({ artiest: 'Een', van: '18:00', tot: '19:00' }).ok, true);
  /* Alpha heeft 30 minuten changeover: om 19:20 is het podium nog niet om. */
  const tekort = w.boek({ artiest: 'Twee', van: '19:20', tot: '20:00' });
  assert.equal(tekort.status, 409);
  assert.match(tekort.error, /changeover 30 min/);
  assert.equal(w.boek({ artiest: 'Twee', van: '19:35', tot: '20:00' }).ok, true);

  /* En over middernacht: 23:30-00:30 tegen 00:45-01:30 is binnen de changeover.
     Op de klok gelezen lijkt "23:30" later dan "01:30" en botst er niets. */
  assert.equal(w.boek({ artiest: 'Drie', van: '23:30', tot: '00:30' }).ok, true);
  const nacht = w.boek({ artiest: 'Vier', van: '00:45', tot: '01:30' });
  assert.equal(nacht.status, 409, 'over middernacht heen geldt de changeover net zo goed');
});

test('5. een afgezegde boeking blokkeert het podium niet meer', () => {
  const w = wereld();
  const b = w.boek({ artiest: 'Een', van: '18:00', tot: '19:00' }).boeking;
  assert.equal(w.boek({ artiest: 'Twee', van: '18:00', tot: '19:00' }).status, 409);
  w.k.boekingStand(w.fid, w.eid, { id: b.id, stand: 'afgezegd', door: 'Marta' });
  assert.equal(w.boek({ artiest: 'Twee', van: '18:00', tot: '19:00' }).ok, true);
});

test('6. een soundcheck valt binnen de dag en voor de set', () => {
  const w = wereld();
  const nachtelijk = w.boek({ artiest: 'Een', van: '21:00', tot: '22:00', soundcheck: '09:00' });
  assert.equal(nachtelijk.status, 400);
  assert.match(nachtelijk.error, /buiten de openingstijden/);

  const erna = w.boek({ artiest: 'Een', van: '21:00', tot: '22:00', soundcheck: '21:30' });
  assert.equal(erna.status, 400);
  assert.match(erna.error, /na het begin van de set/);

  assert.equal(w.boek({ artiest: 'Een', van: '21:00', tot: '22:00', soundcheck: '18:00' }).ok, true);
});

test('7. het beeld geeft nu, straks en de tijd ertussen', () => {
  const w = wereld();
  w.boek({ artiest: 'Een', van: '18:00', tot: '19:00' });
  w.boek({ artiest: 'Twee', van: '20:00', tot: '21:00' });
  const b = w.beeld('18:30').podia.find(p => p.podium === w.alpha.id);
  assert.equal(b.nu.artiest, 'Een');
  assert.equal(b.straks.artiest, 'Twee');
  assert.equal(b.overTot, 90, 'anderhalf uur tot de volgende set');
  assert.equal(b.changeover, 30);

  const leeg = w.beeld('18:30').podia.find(p => p.podium === w.bravo.id);
  assert.equal(leeg.nu, null);
  assert.equal(leeg.overTot, null, 'zonder volgende set is dat null en niet nul');
});

test('8. een onbevestigde set die zo opgaat is kritiek', () => {
  const w = wereld();
  w.boek({ artiest: 'Fred Again', van: '21:00', tot: '22:30' });
  const ver = w.sig('18:00').signalen;
  assert.deepEqual(ver, [], 'drie uur van tevoren is het administratie');

  const dichtbij = w.sig('20:20').signalen;
  const k = dichtbij.find(x => /voornemen/.test(x.zin));
  assert.ok(k, 'veertig minuten van tevoren is het een gat in het programma');
  assert.equal(k.ernst, 'kritiek');
  assert.equal(k.over, 40);
  assert.match(k.zin, /Alpha: Fred Again/);
});

test('9. open riderpunten wegen zwaarder naarmate de set dichterbij komt', () => {
  const w = wereld();
  const b = w.boek({ artiest: 'Fred Again', van: '21:00', tot: '22:30' }).boeking;
  w.k.boekingStand(w.fid, w.eid, { id: b.id, stand: 'bevestigd', door: 'Marta', hoe: 'contract' });
  w.k.riderZet(w.fid, w.eid, { boeking: b.id, wat: 'Gitaarcabinet' });
  w.k.riderZet(w.fid, w.eid, { boeking: b.id, wat: 'Handdoeken' });

  const ver = w.sig('20:15').signalen.find(x => /riderpunt/.test(x.zin));
  assert.equal(ver.ernst, 'aandacht');
  assert.match(ver.zin, /2 open riderpunten/);

  const dichtbij = w.sig('20:40').signalen.find(x => /riderpunt/.test(x.zin));
  assert.equal(dichtbij.ernst, 'hoog', 'binnen het half uur is het geen aandachtspunt meer');

  w.k.riderVink(w.fid, w.eid, { boeking: b.id, item: b.rider[0].id, door: 'Toni' });
  assert.match(w.sig('20:40').signalen.find(x => /riderpunt/.test(x.zin)).zin, /1 open riderpunt\b/);
});

test('10. de podiumsignalen komen op dezelfde hoop als de rest', () => {
  const w = wereld();
  w.boek({ artiest: 'Fred Again', van: '21:00', tot: '22:30' });
  const u = w.k.uitzonderingen(w.fid, w.eid, { dag: w.dag.id, datum: '2027-07-02', tijd: '20:20' });
  assert.ok(u.uitzonderingen.some(x => x.bron === 'podium'),
    'een stage manager en een veiligheidscoordinator kijken naar hetzelfde scherm');
  assert.equal(u.uitzonderingen[0].ernst, 'kritiek', 'en het dringendste staat vooraan');
  assert.equal(u.rust, false);
});

test('11. de afrekening is een overzicht en zegt dat er niets is betaald', () => {
  const w = wereld();
  const b = w.boek({ artiest: 'Fred Again', van: '21:00', tot: '22:30',
    gage: 250000, voorschot: 50000 }).boeking;
  w.k.extraZet(w.fid, w.eid, { boeking: b.id, wat: 'Extra techniek', centen: 30000 });

  const a = w.k.afrekening(w.fid, w.eid, b.id);
  assert.equal(a.gage, 250000);
  assert.equal(a.voorschot, 50000);
  assert.equal(a.extras, 30000);
  assert.equal(a.openstaand, 230000);
  assert.equal(a.betaald, false);
  assert.match(a.let_op, /niets geind en niets overgemaakt/,
    'die zin staat IN de uitkomst, want wie deze data elders leest hoort hem ook te zien');
});

/* ============================================================================
   DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2)

   Veertien mutaties, alle veertien RAAK. Dat is deze ronde voor het eerst; de
   vorige vijf rondes wees telkens een afgeslagen mutatie een gat in de toetsen
   aan. Hier is dat gat er niet, en dat komt doordat de toetsen deze keer zijn
   geschreven vanuit de gevallen die de mutaties zouden maken (een set die de
   dag uit loopt, een changeover die precies past, een afgezegde boeking die
   nog in de weg staat) in plaats van vanuit de gelukkige weg.

   ARTIEST (artiest.js)
    A1. Een nieuwe boeking meteen op `bevestigd` zetten. -> toets 1 zakte: een
        voornemen is geen boeking, en dat verschil is de hele reden dat dit
        bestand een standenlijst heeft.
    A2. Bevestigen zonder `hoe` toestaan. -> toets 2. "Bevestigd door Marta" is
        geen bewijs; "getekend contract" of "mail van 3 juni" wel.
    A3. `door` uit het lichaam laten komen in plaats van uit de sessie. Dat
        staat op de ROUTE en niet in de kern, dus hij zakt daar: toets 22 in
        test/festival-routes.test.js (mutatie 15 aan het slot daarvan).
    A4. De botscontrole weghalen. -> toets 4.
    A5. De changeover uit de botscontrole halen (gat = 0). -> toets 5 zakte:
        twee sets die elkaar exact raken, op een podium dat 30 minuten nodig
        heeft om om te bouwen, gingen erdoorheen.
    A6. Een afgezegde boeking wel laten botsen. -> toets 6. Een afzegging die
        het podium bezet houdt, is de reden dat een vervanger niet geboekt kan
        worden op de avond dat het moet.
    A7. De soundcheck NA de set toestaan. -> toets 3.

   RIDER (rider.js)
    R1. `openstaand` als gage min voorschot rekenen, zonder de extras.
        -> toets 11.
    R2. `betaald: true` teruggeven. -> toets 11 zakte op de zin zelf. Dit is
        LAT-regel 6 in de kleinste vorm die er is: de belofte staat in de
        uitkomst, dus de toets leest de uitkomst en niet het scherm.

   PODIUM (podium.js, uitzondering.js)
    P1. Een onbevestigde set binnen de horizon op `hoog` zetten in plaats van
        `kritiek`. -> toets 8. Twee uur voor de deur is "wie speelt hier
        eigenlijk" geen aandachtspunt.
    P2. De horizon negeren en alles melden. -> toets 8 zakte op de stille kant:
        een onbevestigde set van morgenavond is geen uitzondering van nu.
    P3. Open riderpunten altijd `aandacht` geven. -> toets 9 zakte op de
        binnen-het-half-uur-kant.
    P4. `overTot` vanaf het einde van de set rekenen in plaats van vanaf het
        einde van de changeover. -> toets 7.
    P5. De podiumsignalen niet aan uitzonderingen() toevoegen. -> toets 10
        zakte. Een stage manager en een veiligheidscoordinator die naar twee
        verschillende schermen kijken, is precies wat deze wereld niet is.
   ========================================================================== */
