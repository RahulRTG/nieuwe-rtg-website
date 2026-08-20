/* ============================================================================
   HET GEHEUGEN: EEN AFDRUK, GEEN HERBEREKENING.

   WAAROM DIT BESTAAT

   Overal in dit huis geldt LAT-regel 4: niet twee plekken die hetzelfde weten.
   Het geheugen breekt die regel met opzet, en dat is precies waarom het een
   eigen toetsbestand heeft. Een geheugen dat elk jaar opnieuw uitrekent wat er
   vorig jaar gebeurde, is geen geheugen: scans worden opgeruimd, een terrein
   wordt anders ingedeeld, een norm verandert. Dan schuift "vorig jaar" mee met
   vandaag, en niemand die het merkt.

   De tweede reden is FESTIVAL.md par. 5.1: een bezoeker is een telling en geen
   spoor. Een afdruk van een festivaldag is de plek waar dat het makkelijkst
   sneuvelt -- "even bewaren wie er waren" is één regel code. Toets 6 staat er
   om die regel tegen te houden.

   WAT ER WORDT VASTGELEGD

    1. Afsluiten vraagt een naam.
    2. De afdruk telt geldige passen tegen passen die werkelijk binnen waren.
    3. De piek is de HOOGSTE stand van de dag, niet de laatste.
    4. Hoe de piek gemeten is, staat in de afdruk zelf.
    5. Een tweede keer afsluiten gebeurt niet stil.
    6. In de afdruk staan aantallen en geen mensen.
    7. De afdruk verandert niet meer als de wereld eronder verandert.
    8. Zonder eerdere editie wordt er niets vergeleken.
    9. Met een eerdere editie staat erbij hoeveel edities dat zijn.
   9b. "Eerder" is eerder in de tijd, niet "een andere editie".
   9c. Een editie die nooit is afgesloten, telt niet als eerdere editie.

   DE MUTATIES staan aan het slot.
   Draai los: node --test test/festival-geheugen.test.js
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
  const poort = k.plekZet(fid, eid, { naam: 'Noordpoort', soort: 'ingang', ouder: terrein.id }).plek;

  const passen = [];
  function pas(dagen) {
    const p = k.pasUitgeven(fid, eid, { drager: 'Gast ' + passen.length,
      rechten: [{ soort: 'festival.entree', dagen: dagen || [dag.id] }] }).pas;
    passen.push(p);
    return p;
  }
  const scan = (p, tijd, richting) => k.scan(fid, eid, { code: p.code, plek: poort.id,
    poort: 'Noord', datum: '2027-07-02', tijd, richting: richting || 'in', door: 'Toni' });
  return { k, fid, eid, dag, terrein, poort, pas, scan, passen };
}

test('1. afsluiten vraagt een naam', () => {
  const w = wereld();
  const r = w.k.dagSluiten(w.fid, w.eid, { dag: w.dag.id });
  assert.equal(r.status, 400);
  assert.match(r.error, /Wie sluit/);
});

test('2. de afdruk telt geldige passen tegen wie er werkelijk was', () => {
  const w = wereld();
  const a = w.pas(), b = w.pas();
  w.pas();                                        // uitgegeven, nooit gekomen
  w.scan(a, '13:00');
  w.scan(b, '14:00');
  const r = w.k.dagSluiten(w.fid, w.eid, { dag: w.dag.id, door: 'Marta' });
  assert.equal(r.ok, true);
  assert.equal(r.afdruk.passenGeldig, 3);
  assert.equal(r.afdruk.passenBinnen, 2);
  assert.equal(r.afdruk.opkomst, 66.7, 'twee van de drie, op een tiende');
  assert.equal(r.afdruk.door, 'Marta');
});

test('3. de piek is de hoogste stand, niet de laatste', () => {
  const w = wereld();
  const a = w.pas(), b = w.pas(), c = w.pas();
  w.scan(a, '13:00'); w.scan(b, '13:10'); w.scan(c, '13:20');   // drie binnen
  w.scan(a, '23:00', 'uit'); w.scan(b, '23:10', 'uit');          // twee weer weg
  const r = w.k.dagSluiten(w.fid, w.eid, { dag: w.dag.id, door: 'Marta' });
  const terrein = r.afdruk.piek.plekken.find(p => p.naam === 'Terrein');
  assert.equal(terrein.aantal, 3, 'aan het eind stond er nog een; de avond had er drie');
  assert.equal(terrein.opMinuut, 80, '13:20 is tachtig minuten na opening om 12:00');
});

test('4. hoe de piek gemeten is, staat in de afdruk', () => {
  const w = wereld();
  const a = w.pas();
  w.scan(a, '13:00');
  const r = w.k.dagSluiten(w.fid, w.eid, { dag: w.dag.id, door: 'Marta' });
  assert.equal(r.afdruk.piek.hoe, 'elke scan');
  assert.equal(r.afdruk.piek.momenten, 1,
    'een piek die tussen twee peilmomenten in viel kan gemist zijn, dus hoort er te staan hoe fijn er gekeken is');
});

test('5. een tweede keer afsluiten gebeurt niet stil', () => {
  const w = wereld();
  w.k.dagSluiten(w.fid, w.eid, { dag: w.dag.id, door: 'Marta' });
  const nog = w.k.dagSluiten(w.fid, w.eid, { dag: w.dag.id, door: 'Joel' });
  assert.equal(nog.status, 409);
  assert.match(nog.error, /al afgesloten/);
  assert.match(nog.error, /Marta/, 'en door wie, want dat is de vraag die volgt');

  const opnieuw = w.k.dagSluiten(w.fid, w.eid, { dag: w.dag.id, door: 'Joel', opnieuw: true });
  assert.equal(opnieuw.ok, true);
  assert.equal(opnieuw.afdruk.herzien, 1, 'het mag, maar het staat er dan ook bij');
  assert.equal(opnieuw.afdruk.door, 'Joel');
});

test('6. in de afdruk staan aantallen en geen mensen', () => {
  const w = wereld();
  const a = w.pas();
  w.scan(a, '13:00');
  const r = w.k.dagSluiten(w.fid, w.eid, { dag: w.dag.id, door: 'Marta' });
  const tekst = JSON.stringify(r.afdruk);
  assert.ok(!tekst.includes(a.code), 'geen pascode');
  assert.ok(!tekst.includes(a.id), 'geen pas-id');
  assert.ok(!/Gast 0/.test(tekst), 'geen drager');
  assert.ok(!/Toni/.test(tekst), 'en niet wie er scande: een bezoeker is een telling, geen spoor');
});

test('7. de afdruk verandert niet meer als de wereld eronder verandert', () => {
  const w = wereld();
  const a = w.pas();
  w.scan(a, '13:00');
  const eerst = w.k.dagSluiten(w.fid, w.eid, { dag: w.dag.id, door: 'Marta' }).afdruk;
  assert.equal(eerst.passenBinnen, 1);

  /* De hele dag wordt uit de scans gewist -- een opruimactie, een migratie, een
     hand in db.json. Het geheugen hoort dat niet te merken. */
  const e = w.k.editieVind(w.fid, w.eid);
  e.scans = [];
  const g = w.k.geheugenVan(w.fid, w.eid);
  assert.equal(g.dagen[0].passenBinnen, 1,
    'wie hier opnieuw zou rekenen, heeft geen geheugen maar een schatting die meebeweegt');
});

test('8. zonder eerdere editie wordt er niets vergeleken', () => {
  const w = wereld();
  w.k.dagSluiten(w.fid, w.eid, { dag: w.dag.id, door: 'Marta' });
  const v = w.k.vergelijk(w.fid, w.eid);
  assert.equal(v.ok, true);
  assert.equal(v.bekend, false);
  assert.equal(v.opkomst, undefined, 'een percentage tegenover niets is een suggestie');
  assert.match(v.zin, /geen eerdere afgesloten editie/);
});

test('9. met een eerdere editie staat erbij hoeveel edities dat zijn', () => {
  const w = wereld();
  const a = w.pas(), b = w.pas();
  w.scan(a, '13:00'); w.scan(b, '13:10');
  w.k.dagSluiten(w.fid, w.eid, { dag: w.dag.id, door: 'Marta' });

  /* Een tweede editie, een jaar later, met een lagere opkomst. */
  const eid2 = w.k.editieNieuw(w.fid, { jaar: 2028 }).editie.id;
  const dag2 = w.k.dagZet(w.fid, eid2, { datum: '2028-07-01', open: '12:00', sluit: '02:00' }).dag;
  const terrein2 = w.k.plekZet(w.fid, eid2, { naam: 'Terrein', soort: 'terrein', capaciteit: 9000 }).plek;
  const poort2 = w.k.plekZet(w.fid, eid2, { naam: 'Poort', soort: 'ingang', ouder: terrein2.id }).plek;
  for (let i = 0; i < 4; i++) {
    w.k.pasUitgeven(w.fid, eid2, { drager: 'G' + i, rechten: [{ soort: 'festival.entree', dagen: [dag2.id] }] });
  }
  const een = Object.values(w.k.editieVind(w.fid, eid2).passen)[0];
  w.k.scan(w.fid, eid2, { code: een.code, plek: poort2.id, poort: 'P', datum: '2028-07-01',
    tijd: '13:00', door: 'Toni' });
  w.k.dagSluiten(w.fid, eid2, { dag: dag2.id, door: 'Marta' });

  const v = w.k.vergelijk(w.fid, eid2);
  assert.equal(v.bekend, true);
  assert.equal(v.opkomst.nu, 25);
  assert.equal(v.opkomst.eerder, 100);
  assert.equal(v.eerder.jaar, 2027);
  assert.match(v.zin, /Een editie is geen patroon/,
    'want dat is precies wat een tweede punt nog niet is');
});

test('9b. eerder is eerder in de tijd, en niet zomaar een andere editie', () => {
  const w = wereld();
  w.k.dagSluiten(w.fid, w.eid, { dag: w.dag.id, door: 'Marta' });

  /* Een editie die NA deze komt, en die ook is afgesloten. Vanuit 2027 gezien
     bestaat 2028 niet als geheugen: vergelijken met volgend jaar is geen
     geheugen maar een profetie. */
  const eid2 = w.k.editieNieuw(w.fid, { jaar: 2028 }).editie.id;
  const dag2 = w.k.dagZet(w.fid, eid2, { datum: '2028-07-01', open: '12:00', sluit: '02:00' }).dag;
  w.k.plekZet(w.fid, eid2, { naam: 'Terrein', soort: 'terrein', capaciteit: 9000 });
  w.k.dagSluiten(w.fid, eid2, { dag: dag2.id, door: 'Marta' });

  const v = w.k.vergelijk(w.fid, w.eid);
  assert.equal(v.bekend, false, 'vanuit 2027 is er nog niets geweest');
  assert.equal(w.k.vergelijk(w.fid, eid2).bekend, true, 'en vanuit 2028 wel');
});

test('9c. een editie die nooit is afgesloten telt niet als eerdere editie', () => {
  const w = wereld();
  /* 2026 bestaat, met een dag en al, maar is nooit afgesloten. Zou die meetellen,
     dan staat er "naast 2026 (0 afgesloten dagen)" met een opkomst van niets --
     precies de lege vergelijking die toets 8 tegenhoudt, maar dan met een jaartal
     erbij zodat hij op een uitkomst lijkt. */
  const oud = w.k.editieNieuw(w.fid, { jaar: 2026 }).editie.id;
  w.k.dagZet(w.fid, oud, { datum: '2026-07-03', open: '12:00', sluit: '02:00' });
  w.k.dagSluiten(w.fid, w.eid, { dag: w.dag.id, door: 'Marta' });

  const v = w.k.vergelijk(w.fid, w.eid);
  assert.equal(v.bekend, false);
  assert.match(v.zin, /geen eerdere afgesloten editie/);
});

/* ============================================================================
   DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2)

   Negen mutaties. Zeven raak, twee afgeslagen -- en die twee wezen allebei een
   gat in de TOETSEN aan. Beide gaten zaten op dezelfde plek: er was maar een
   editie, dus alles wat over de VOLGORDE van edities gaat, kon niet zakken.

   GEHEUGEN (geheugen.js)
    G1. De piek de laatste stand laten zijn in plaats van de hoogste.
        -> toets 3 zakte: een avond met 3.000 mensen waarvan er 2.000 vroeg weg
        waren, ging het geheugen in als een avond met 1.000.
    G2. De afdruk herrekenen uit de scans in plaats van teruggeven wat er staat.
        -> toets 7 zakte. Dit is de mutatie waar dit bestand voor bestaat: met
        lege scans zei het geheugen dat er niemand was geweest. Een geheugen dat
        meebeweegt met vandaag, is geen geheugen.
    G3. Stil overschrijven bij een tweede afsluiting. -> toets 5.
    G4. De pascodes meenemen in de afdruk. -> toets 6 zakte. Dit is een regel
        code en het is precies de regel die FESTIVAL.md par. 5.1 verbiedt: een
        bezoeker is een telling en geen spoor. De toets leest de hele afdruk als
        tekst, zodat ook een veld dat er later bij komt erdoor valt.
    G5. Zonder eerdere editie toch een vergelijking teruggeven. -> toets 8.
    G6. "Eerder" laten slaan op elke andere editie in plaats van op een eerder
        jaar. AFGESLAGEN: er was maar een editie, of de andere lag toevallig in
        het verleden. Toets 9b staat er nu en zakt erop -- zonder die toets
        vergeleek de editie van 2027 zichzelf met 2028.
    G7. Een editie zonder afgesloten dagen toch als eerdere editie tellen.
        AFGESLAGEN, om dezelfde reden. Toets 9c staat er nu: dan zou er "naast
        2026 (0 afgesloten dagen)" staan met een opkomst van niets -- de lege
        vergelijking van toets 8, maar met een jaartal erbij zodat hij op een
        uitkomst lijkt.

   BEZETTING (bezetting.js, de tijdsgrens die voor dit bestand is toegevoegd)
    B1. De tijdsgrens in laatsteStandPer() negeren. -> toets 3.
    B2. bezetting() altijd de hele dag laten lezen, ongeacht `tot`. -> toets 3.
        Deze twee staan er omdat de grens een UITBREIDING van de bestaande
        telling is en geen tweede telling: zou hij stilvallen, dan is de piek
        gewoon de eindstand en ziet niemand dat.
   ========================================================================== */
