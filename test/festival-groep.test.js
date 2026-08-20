/* ============================================================================
   DE GROEP: WAT ER NIET IN ZIT IS DE TOETS.

   WAAROM DIT BESTAAT

   Een festival beleef je met mensen, en dat is precies waarom een groep het
   gevaarlijkste stuk van deze wereld is. Elke voor de hand liggende functie --
   vrienden uitnodigen, een herinnering sturen, "nog 2 plekken!" -- raakt een
   TWEEDE persoon, en daar geldt LIFE.md par. 4: samenstellen en klaarzetten
   mag, bevestigen doet de mens.

   Deze toets legt daarom vooral vast wat er NIET gebeurt. Dat is ongebruikelijk
   en het is met opzet: een grens die alleen in een merkdocument staat, is over
   een half jaar weg.

   WAT ER WORDT VASTGELEGD

    1. Meedoen is een eigen handeling: je hebt de code en je gebruikt hem.
    2. Er bestaat geen manier om iemand anders toe te voegen.
   2b. Een code opzoeken voegt niemand toe, en gokt niet bij twijfel.
    3. Een code hoort bij EEN editie.
    4. Een code is in te trekken, en de oude werkt daarna niet meer.
    5. Er is geen hoofd van de groep: elk lid mag de code vernieuwen.
    6. Weg kan altijd, zonder dat iemand het goedkeurt.
   6b. Er is geen functie om een ander te verwijderen, en een niet-lid krijgt
       404 in plaats van een antwoord waaruit blijkt dat de groep bestaat.
    7. Vertrekt de laatste, dan houdt de groep op te bestaan.
    8. De stand is alleen voor een lid; een buitenstaander krijgt 404.
    9. Het gat is een GETAL en geen aansporing.
   10. Wie een pas heeft, wordt geteld uit de passen zelf.

   DE MUTATIES staan aan het slot.
   Draai los: node --test test/festival-groep.test.js
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
  const maak = (naam, maker) => k.groepMaak(fid, eid, { naam, maker });
  const mee = (code, codenaam) => k.groepDeelnemen(fid, eid, { code, codenaam });
  const stand = (id, codenaam) => k.groepStand(fid, eid, id, codenaam);
  const pas = (drager) => k.pasUitgeven(fid, eid, { drager, rechten: [{ soort: 'festival.entree' }] });
  return { k, fid, eid, dag, maak, mee, stand, pas };
}

test('1. meedoen is een eigen handeling: je hebt de code en je gebruikt hem', () => {
  const w = wereld();
  const g = w.maak('Naar Testival', 'Kobalt').groep;
  assert.deepEqual(g.leden.map(l => l.codenaam), ['Kobalt']);

  assert.equal(w.mee(g.code, 'Amber').ok, true);
  assert.equal(w.stand(g.id, 'Kobalt').leden.length, 2);

  const fout = w.mee('ZZZZZZZZZZ', 'Ivo');
  assert.equal(fout.status, 404);
  assert.match(fout.error, /klopt niet/);
});

test('2. er bestaat geen manier om iemand anders toe te voegen', () => {
  const w = wereld();
  /* Dit is een toets op de OPPERVLAKTE en niet op een gedraging: als er ooit
     een functie bijkomt die een ander in een groep zet, hoort deze te zakken en
     hoort er een gesprek te volgen -- niet een stille uitbreiding. */
  const namen = Object.keys(w.k).filter(n => /^groep/.test(n)).sort();
  assert.deepEqual(namen,
    ['groepCodeVernieuw', 'groepDeelnemen', 'groepEditieVanCode', 'groepMaak', 'groepStand',
      'groepVerlaat', 'groepenVan'],
    'geen groepNodig, groepVoegToe of groepUitnodig: RTG legt geen contact namens iemand');
});

test('2b. het opzoeken van een code voegt niemand toe, en gokt niet bij twijfel', () => {
  /* `groepEditieVanCode` is de enige naam die ooit aan de lijst hierboven is
     toegevoegd, en de reden staat in de kop van kern/festival/groep.js: een lid
     dat nog niets heeft, ziet ook nog geen festival en kon de code die hij van
     een vriend kreeg nergens invullen.

     Hij zet NIEMAND ergens in -- hij vertaalt een code naar een editie, en het
     meedoen zelf loopt daarna onveranderd langs groepDeelnemen, met de codenaam
     uit de sessie. Deze toets legt allebei die eigenschappen vast. */
  const w = wereld();
  const g = w.maak('Naar Testival', 'Kobalt').groep;
  const gevonden = w.k.groepEditieVanCode(g.code);
  assert.equal(gevonden.eid, w.eid);
  assert.equal(w.k.groepStand(w.fid, w.eid, g.id, 'Kobalt').leden.length, 1,
    'opzoeken alleen voegt niemand toe');

  assert.equal(w.k.groepEditieVanCode('ZZZZZZZZZZ'), null);

  /* Dezelfde code in twee edities: dan is er geen goed antwoord, en wordt er
     niet gegokt. Gokken zou iemand in de groep van een vreemde zetten. */
  const tweede = w.k.editieNieuw(w.fid, { jaar: 2028 }).editie.id;
  const ander = w.k.groepMaak(w.fid, tweede, { naam: 'Volgend jaar', maker: 'Ivo' }).groep;
  ander.code = g.code;
  assert.equal(w.k.groepEditieVanCode(g.code).meerdere, true);
});

test('3. een code hoort bij EEN editie', () => {
  const w = wereld();
  const g = w.maak('Naar Testival', 'Kobalt').groep;
  const anderJaar = w.k.editieNieuw(w.fid, { jaar: 2028 }).editie.id;

  const fout = w.k.groepDeelnemen(w.fid, anderJaar, { code: g.code, codenaam: 'Amber' });
  assert.equal(fout.status, 404, 'een code van vorig jaar hoort nergens toe te leiden');
});

test('4. een code is in te trekken, en de oude werkt daarna niet meer', () => {
  const w = wereld();
  const g = w.maak('Naar Testival', 'Kobalt').groep;
  const oud = g.code;
  const nieuw = w.k.groepCodeVernieuw(w.fid, w.eid, { id: g.id, codenaam: 'Kobalt' });
  assert.equal(nieuw.ok, true);
  assert.notEqual(nieuw.groep.code, oud);
  assert.equal(w.mee(oud, 'Ivo').status, 404, 'te breed gedeeld hoort in te trekken te zijn');
  assert.equal(w.mee(nieuw.groep.code, 'Ivo').ok, true);
});

test('5. er is geen hoofd van de groep', () => {
  const w = wereld();
  const g = w.maak('Naar Testival', 'Kobalt').groep;
  w.mee(g.code, 'Amber');
  /* Amber is niet de maker en mag toch de code vernieuwen: een maker met meer
     rechten dan de rest maakt van een vriendengroep een trechter. */
  assert.equal(w.k.groepCodeVernieuw(w.fid, w.eid, { id: g.id, codenaam: 'Amber' }).ok, true);
  assert.equal(w.k.groepCodeVernieuw(w.fid, w.eid, { id: g.id, codenaam: 'Vreemde' }).status, 404);
});

test('6. weg kan altijd, zonder dat iemand het goedkeurt', () => {
  const w = wereld();
  const g = w.maak('Naar Testival', 'Kobalt').groep;
  w.mee(g.code, 'Amber');
  assert.equal(w.k.groepVerlaat(w.fid, w.eid, { id: g.id, codenaam: 'Amber' }).ok, true);
  assert.deepEqual(w.stand(g.id, 'Kobalt').leden.map(l => l.codenaam), ['Kobalt']);
  assert.equal(w.stand(g.id, 'Amber').status, 404, 'en daarna leest zij niet meer mee');
});

test('6b. er is geen functie om een ander te verwijderen, en een niet-lid krijgt 404', () => {
  const w = wereld();
  const g = w.maak('Naar Testival', 'Kobalt').groep;
  w.mee(g.code, 'Amber');

  /* groepVerlaat kent EEN codenaam, en dat is die van wie het doet -- op de
     route komt hij uit de sessie (test/festival-routes.test.js toets 19). De
     kern kan "wie vertrekt" en "wie het vraagt" dus niet uit elkaar houden, en
     dat hoeft ook niet: er is geen tweede weg. Wat hier telt is dat er geen
     functie BESTAAT die een ander eruit zet. */
  assert.equal(typeof w.k.groepVerwijder, 'undefined');
  assert.equal(typeof w.k.groepZetUit, 'undefined');

  /* En wie geen lid is, krijgt 404 en geen bevestiging dat de groep bestaat --
     anders is een groeps-id genoeg om te weten wie er waar heen gaat. */
  const vreemde = w.k.groepVerlaat(w.fid, w.eid, { id: g.id, codenaam: 'Nieuwsgierig' });
  assert.equal(vreemde.status, 404);
  assert.equal(w.stand(g.id, 'Amber').leden.length, 2, 'en er is niemand verdwenen');
});

test('7. vertrekt de laatste, dan houdt de groep op te bestaan', () => {
  const w = wereld();
  const g = w.maak('Naar Testival', 'Kobalt').groep;
  const uit = w.k.groepVerlaat(w.fid, w.eid, { id: g.id, codenaam: 'Kobalt' });
  assert.ok(uit.groep.beeindigd, 'een lege groep is een lijst met een naam en verder niets');
  assert.equal(w.mee(g.code, 'Ivo').status, 404, 'en zijn code leidt nergens meer heen');
  assert.deepEqual(w.k.groepenVan(w.k.editieVind(w.fid, w.eid), 'Kobalt'), []);
});

test('8. de stand is alleen voor een lid', () => {
  const w = wereld();
  const g = w.maak('Naar Testival', 'Kobalt').groep;
  w.mee(g.code, 'Amber');
  assert.equal(w.stand(g.id, 'Amber').ok, true);
  const buiten = w.stand(g.id, 'Nieuwsgierig');
  assert.equal(buiten.status, 404, 'wie er in een groep zit is niets voor buitenstaanders');
});

test('9. het gat is een getal en geen aansporing', () => {
  const w = wereld();
  const g = w.maak('Naar Testival', 'Kobalt').groep;
  w.mee(g.code, 'Amber');
  w.mee(g.code, 'Ivo');
  const s = w.stand(g.id, 'Kobalt');
  assert.equal(s.zonderPas, 3);

  /* GEEN tekst, geen knop, geen klok. CLAUDE.md verbiedt kunstmatige urgentie,
     en in een groep komt die druk van vrienden -- wat beter werkt dan welke
     banner ook, en juist daarom niet gebeurt. */
  const velden = Object.keys(s).sort();
  assert.deepEqual(velden, ['code', 'id', 'leden', 'maker', 'naam', 'ok', 'zonderPas']);
  const alles = JSON.stringify(s).toLowerCase();
  for (const woord of ['nodig', 'herinner', 'nog maar', 'laatste kans', 'verloopt', 'urgent']) {
    assert.ok(!alles.includes(woord), 'de stand draagt geen aansporing: "' + woord + '"');
  }
});

test('10. wie een pas heeft wordt geteld uit de passen zelf', () => {
  const w = wereld();
  const g = w.maak('Naar Testival', 'Kobalt').groep;
  w.mee(g.code, 'Amber');
  assert.equal(w.stand(g.id, 'Kobalt').zonderPas, 2);

  const p = w.pas('Amber').pas;
  assert.equal(w.stand(g.id, 'Kobalt').zonderPas, 1);
  assert.equal(w.stand(g.id, 'Kobalt').leden.find(l => l.codenaam === 'Amber').heeftPas, true);

  /* En een ingetrokken pas telt niet meer -- een vlag op het lid zou hier
     achterlopen. */
  w.k.pasIntrekken(w.fid, w.eid, p.code, 'gestolen');
  assert.equal(w.stand(g.id, 'Kobalt').zonderPas, 2);
});

/* ============================================================================
   DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2)

   Acht mutaties, alle acht RAAK -- de laatste pas na een reparatie aan de
   TOETS, en dat is de vierde keer deze ronde dat dat gebeurt.

   1. De groepscode over ALLE edities laten zoeken in plaats van binnen deze.
      -> negen toetsen zakten. Een code van vorig jaar hoort nergens toe te
         leiden: een groep hoort bij de editie waarin hij begon.

   2. Een beeindigde groep weer mee laten doen. -> toets 7 zakte.
   3. De laatste die weggaat de groep laten staan. -> toets 7 zakte.

   4. De stand ook aan buitenstaanders geven.
      -> toetsen 6 en 8 zakten. Wie er in een groep zit, is niets voor iemand
         daarbuiten -- ook niet voor de organisatie.

   5. Alleen de maker de code laten vernieuwen.
      -> toets 5 zakte. Een maker met meer rechten dan de rest maakt van een
         vriendengroep een trechter met een eigenaar.

   6. Vernieuwen de oude code laten staan. -> toets 4 zakte.

   7. heeftPas niet uit de passen tellen maar de ingetrokken passen meenemen.
      -> toets 10 zakte: een gestolen pas telde nog als "heeft er een".

   8. De lidmaatschapscontrole bij groepVerlaat weghalen.
      -> toets 6b zakte -- maar pas nadat die toets was herschreven. Hij beweerde
         eerst dat een lid een ANDER niet kan verwijderen, en dat kan de kern
         niet zien: groepVerlaat kent een codenaam, en dat is die van wie het
         doet (de route zet hem uit de sessie). Wat de controle wel doet, is een
         niet-lid 404 geven in plaats van een antwoord waaruit blijkt dat de
         groep bestaat -- en dat legt de toets nu vast.
   ========================================================================== */
