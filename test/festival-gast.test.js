/* ============================================================================
   DE GASTENKANT: ZIJN EIGEN DINGEN, EN VERDER NIETS.

   WAAROM DIT BESTAAT

   Deze wereld had bijna een jaar lang alleen een organisatiekant. De ledenkant
   bestond wel in de kern (de groep) maar had geen enkel scherm, en wie een pas
   kocht kon zijn eigen pascode nergens terugzien. Par. 10 van FESTIVAL.md
   vraagt of een gast een heel weekend kan beleven zonder organisatorisch gedoe;
   het antwoord was dat hij zijn kaartje niet kon vinden.

   De twee dingen die hier kunnen sneuvelen, zijn allebei ernstig:
   een pascode die bij de verkeerde terechtkomt (dat IS het toegangsbewijs), en
   een programma dat sets toont die niemand heeft getekend.

   WAT ER WORDT VASTGELEGD

    1. Een gast ziet alleen passen die op zijn eigen codenaam staan.
    2. Een ingetrokken pas verdwijnt uit zijn beeld.
    3. De rechten komen leesbaar terug: datums en plekken, geen id's.
    4. Een editie verschijnt als hij er een pas heeft.
    5. ...en ook als hij er alleen in een groep zit.
    6. Een editie waar hij niets heeft, bestaat voor hem niet.
    7. Het programma toont alleen BEVESTIGDE sets.
    8. Hoeveel er niet rond zijn, staat er wel bij.
    9. Een afgezegde set telt in geen van beide.

   DE MUTATIES staan aan het slot.
   Draai los: node --test test/festival-gast.test.js
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
  const terrein = k.plekZet(fid, eid, { naam: 'Weide', soort: 'terrein', capaciteit: 9000 }).plek;
  const alpha = k.plekZet(fid, eid, { naam: 'Alpha', soort: 'podium', ouder: terrein.id,
    capaciteit: 8000 }).plek;
  const camping = k.plekZet(fid, eid, { naam: 'Camping', soort: 'camping', ouder: terrein.id,
    capaciteit: 2000 }).plek;

  const pas = (drager, rechten) => k.pasUitgeven(fid, eid, { drager, rechten }).pas;
  const boek = (d) => k.boekingZet(fid, eid, { dag: dag.id, podium: alpha.id, ...d }).boeking;
  return { k, fid, eid, dag, terrein, alpha, camping, pas, boek };
}

test('1. een gast ziet alleen passen op zijn eigen codenaam', () => {
  const w = wereld();
  w.pas('KOBALT', [{ soort: 'festival.entree', dagen: [w.dag.id] }]);
  w.pas('AMBER', [{ soort: 'festival.entree', dagen: [w.dag.id] }]);

  const mijn = w.k.gastPassen(w.fid, w.eid, 'KOBALT');
  assert.equal(mijn.passen.length, 1);
  /* De pascode IS het toegangsbewijs: wie hem heeft, staat binnen. Hij hoort
     dus bij precies een mens terug te komen. */
  assert.equal(w.k.gastPassen(w.fid, w.eid, 'AMBER').passen.length, 1);
  assert.notEqual(mijn.passen[0].code, w.k.gastPassen(w.fid, w.eid, 'AMBER').passen[0].code);
  assert.equal(w.k.gastPassen(w.fid, w.eid, 'IEMAND ANDERS').passen.length, 0);
});

test('2. een ingetrokken pas verdwijnt uit zijn beeld', () => {
  const w = wereld();
  const p = w.pas('KOBALT', [{ soort: 'festival.entree', dagen: [w.dag.id] }]);
  assert.equal(w.k.gastPassen(w.fid, w.eid, 'KOBALT').passen.length, 1);
  w.k.pasIntrekken(w.fid, w.eid, p.code, 'dubbel verkocht');
  assert.equal(w.k.gastPassen(w.fid, w.eid, 'KOBALT').passen.length, 0,
    'een pas die aan de poort niet meer werkt, hoort ook niet meer op het scherm te staan');
});

test('3. de rechten komen leesbaar terug', () => {
  const w = wereld();
  w.pas('KOBALT', [
    { soort: 'festival.entree', dagen: [w.dag.id] },
    { soort: 'festival.camping', plek: w.camping.id },
    { soort: 'festival.bar', van: '20:00', tot: '23:00' }
  ]);
  const r = w.k.gastPassen(w.fid, w.eid, 'KOBALT').passen[0].rechten;
  assert.deepEqual(r[0].dagen, ['2027-07-02'], 'de datum en niet het dag-id');
  assert.equal(r[1].plek, 'Camping', 'de naam en niet het plek-id');
  assert.deepEqual(r[1].dagen, [], 'geen dagen betekent elke dag; dat vertaalt het scherm');
  assert.equal(r[2].van, '20:00');
  assert.equal(r[2].plek, null);
});

test('4. een editie verschijnt als hij er een pas heeft', () => {
  const w = wereld();
  w.pas('KOBALT', [{ soort: 'festival.entree', dagen: [w.dag.id] }]);
  const uit = w.k.gastEdities('KOBALT');
  assert.equal(uit.edities.length, 1);
  assert.equal(uit.edities[0].naam, 'Testival');
  assert.equal(uit.edities[0].passen, 1);
  assert.equal(uit.edities[0].dagen.length, 1);
});

test('5. en ook als hij er alleen in een groep zit', () => {
  const w = wereld();
  const g = w.k.groepMaak(w.fid, w.eid, { naam: 'Busje', maker: 'AMBER' });
  w.k.groepDeelnemen(w.fid, w.eid, { code: g.groep.code, codenaam: 'KOBALT' });
  const uit = w.k.gastEdities('KOBALT');
  assert.equal(uit.edities.length, 1);
  assert.equal(uit.edities[0].passen, 0);
  assert.equal(uit.edities[0].groepen, 1,
    'wie met vrienden gaat maar zijn kaartje nog niet heeft, hoort het festival wel te zien');
});

test('6. een editie waar hij niets heeft, bestaat voor hem niet', () => {
  const w = wereld();
  w.pas('AMBER', [{ soort: 'festival.entree', dagen: [w.dag.id] }]);
  assert.deepEqual(w.k.gastEdities('KOBALT').edities, [],
    'er is geen publieke lijst met festivals, en die komt hier niet terug');
});

test('7. het programma toont alleen bevestigde sets', () => {
  const w = wereld();
  const rond = w.boek({ artiest: 'Fred Again', van: '21:00', tot: '22:30' });
  w.k.boekingStand(w.fid, w.eid, { id: rond.id, stand: 'bevestigd', door: 'Marta',
    hoe: 'getekend contract' });
  w.boek({ artiest: 'Nog Niet Rond', van: '19:00', tot: '20:30' });

  const p = w.k.gastProgramma(w.fid, w.eid, w.dag.id);
  assert.equal(p.programma.length, 1);
  assert.equal(p.programma[0].artiest, 'Fred Again');
  assert.equal(p.programma[0].podium, 'Alpha');
  /* Een voornemen tonen is doen alsof een boeking rond is, en dat is precies
     wat CLAUDE.md verbiedt. Hier heeft het bovendien een gedupeerde: iemand
     koopt een kaartje voor een naam die er niet blijkt te staan. */
  assert.ok(!p.programma.some(x => x.artiest === 'Nog Niet Rond'));
});

test('8. hoeveel er niet rond zijn, staat er wel bij', () => {
  const w = wereld();
  const rond = w.boek({ artiest: 'Fred Again', van: '21:00', tot: '22:30' });
  w.k.boekingStand(w.fid, w.eid, { id: rond.id, stand: 'bevestigd', door: 'Marta', hoe: 'contract' });
  w.boek({ artiest: 'A', van: '17:00', tot: '18:00' });
  w.boek({ artiest: 'B', van: '19:00', tot: '20:00' });

  const p = w.k.gastProgramma(w.fid, w.eid, w.dag.id);
  assert.equal(p.nogNiet, 2,
    'anders lijkt een halve line-up op een hele, en is stilte weer een uitspraak');
});

test('9. een afgezegde set telt in geen van beide', () => {
  const w = wereld();
  const weg = w.boek({ artiest: 'Afgezegd', van: '21:00', tot: '22:30' });
  w.k.boekingStand(w.fid, w.eid, { id: weg.id, stand: 'afgezegd', door: 'Marta' });
  const p = w.k.gastProgramma(w.fid, w.eid, w.dag.id);
  assert.equal(p.programma.length, 0);
  assert.equal(p.nogNiet, 0, 'een afzegging is geen openstaand voornemen');
});

/* ============================================================================
   DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2)

   Negen mutaties, alle negen raak.

   GAST (gast.js)
   GA1. De dragervergelijking weghalen, zodat iedereen alle passen ziet.
        -> toetsen 1 en 6 zakten. Dit is de zwaarste mutatie van dit bestand:
        een pascode IS het toegangsbewijs, en wie hem heeft staat binnen. De
        toets vergelijkt daarom niet alleen de aantallen maar ook de codes.
   GA2. Ingetrokken passen tonen. -> toets 2 zakte: een pas die aan de poort
        niet meer werkt, stond nog groot op het scherm van de gast.
   GA3. Ook voornemens in het programma zetten. -> toets 7 zakte. CLAUDE.md
        verbiedt doen alsof een boeking rond is; hier heeft dat een echte
        gedupeerde, want iemand koopt een kaartje voor die naam.
   GA4. `nogNiet` altijd nul laten zijn. -> toets 8 zakte. Dat getal is wat een
        halve line-up van een hele onderscheidt; zonder dat getal is de stilte
        zelf een uitspraak (dezelfde regel als `ongemeten` in uitzondering.js).
   GA5. Een afgezegde set als openstaand voornemen tellen. -> toets 9.
   GA6. Het dag-id teruggeven in plaats van de datum. -> toets 3.
   GA7. Alle edities tonen in plaats van alleen die waar hij iets heeft.
        -> toets 6 zakte: dat is een publieke festivallijst, en dat is precies
        de marketingpagina die dit huis er bewust uit heeft.
   GA8. Groepen niet meetellen bij het vinden van een editie. -> toets 5 zakte:
        wie met vrienden gaat maar zijn kaartje nog niet heeft, zag niets.
   GA9. De plek als id teruggeven in plaats van als naam. -> toets 3.
   ========================================================================== */
