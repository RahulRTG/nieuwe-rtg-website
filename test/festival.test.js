/* ============================================================================
   RTG FESTIVAL: HET TERREIN, DE PAS EN DE VOORUITBLIK.

   WAAROM DIT BESTAAT

   Een festival was in dit huis een `activiteit` van een zaak, en dat model kon
   vier dingen niet (FESTIVAL.md par. 2): het duurde nooit meer dan een dag, het
   kende geen terrein met binnenwerk, een kaartje droeg een TYPE in plaats van
   rechten, en de code werd ingetypt. Deze toets legt vast dat die vier nu wel
   kunnen, en -- belangrijker -- dat de randen eromheen dichtzitten.

   WAT ER WORDT VASTGELEGD

    1. Een dag loopt over middernacht heen: 01:12 hoort bij de dag van gisteren.
    2. Twee dagen die allebei over middernacht lopen, claimen niet hetzelfde
       moment.
    3. Een curfew buiten de openingstijden wordt geweigerd.
    4. Een recht op een zone opent wat erin ligt, en niets ernaast.
    5. Een besloten plek erft niet: een terreinrecht opent backstage niet.
    6. Een eis houdt tegen tot het bewijs er is.
    7. Aan de poort wint de MEEST SPECIFIEKE ware reden.
    8. Een pas geldt per dag: dag 1 wel, dag 3 niet.
    9. Een venster dat op geen enkele dag valt, wordt bij het schrijven geweigerd.
   10. Een plek kan niet in zichzelf liggen, en een kapotte boom hangt niets op.
   11. Een plek met kinderen kan niet weg.
   12. Dubbelgebruik geeft oranje, met poort en tijd van de eerste scan.
   13. Naar buiten mag altijd, ook met een ingetrokken pas.
   14. De vergunde capaciteit sluit de poort; de veilige capaciteit niet.
   15. Iedereen wordt een keer geteld, ook wie twee poorten door is.
   16. De vooruitblik rekent de aanlooptijd uit.
   17. Rust is een uitkomst en geen leegte: een drempel zonder meting is een
       bevinding.
   18. Een offline bundel vindt de dubbele en draait niets terug.

   DE MUTATIES DIE ZIJN GEDAAN, EN WAT ERVAN ZAKTE
   Staan aan het slot van dit bestand. Een toets die je niet hebt zien zakken is
   geen toets (LAT-regel 2).

   Puur, dus zonder server: de kern krijgt zijn bronnen als parameter mee, en
   elke beslissing gaat over een datum en een tijd die de toets zelf meegeeft --
   er wordt nergens op de wandklok gekeken.
   Draai los: node --test test/festival.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { schoon } = require('../server/kern/util');
const maakFestival = require('../server/kern/festival');

/* Een miniwereld: een database van niets, en een terrein dat de vormen bevat
   waar het om gaat -- een zone in een terrein, een podium in die zone, poorten
   die nergens toe behoren, en een besloten backstage. */
function wereld() {
  const db = { data: {} };
  const k = maakFestival({ db, save() {}, crypto, schoon });
  const fid = k.festivalNieuw('ZAAK1', { naam: 'Testival' }).festival.id;
  const eid = k.editieNieuw(fid, { jaar: 2027 }).editie.id;
  const p = (d) => k.plekZet(fid, eid, d).plek;
  const dag = (d) => k.dagZet(fid, eid, d).dag;

  const d1 = dag({ datum: '2027-07-02', open: '12:00', sluit: '02:00', curfew: '01:00' });
  const d2 = dag({ datum: '2027-07-03', open: '12:00', sluit: '02:00', curfew: '01:00' });
  const d3 = dag({ datum: '2027-07-04', open: '12:00', sluit: '23:00', curfew: '22:30' });

  const terrein = p({ naam: 'Terrein', soort: 'terrein', capaciteit: 65000, veiligeCapaciteit: 60000 });
  const weide = p({ naam: 'Weide', soort: 'zone', ouder: terrein.id, capaciteit: 20000, veiligeCapaciteit: 18000 });
  const alpha = p({ naam: 'Alpha', soort: 'podium', ouder: weide.id, capaciteit: 18000, veiligeCapaciteit: 16000 });
  const noord = p({ naam: 'Noord', soort: 'ingang', ouder: terrein.id });
  const alphahek = p({ naam: 'Alpha-hek', soort: 'ingang', ouder: alpha.id });
  const backstage = p({ naam: 'Backstage', soort: 'backstage', ouder: terrein.id, besloten: true, capaciteit: 300 });

  const pas = (rechten, extra) => k.pasUitgeven(fid, eid, { drager: 'Kobalt', rechten, ...(extra || {}) }).pas;
  const magHier = (code, plek, datum, tijd, bewijs) => k.magHier(fid, eid, { code, plek, datum, tijd, bewijs });
  const scan = (code, plek, datum, tijd, extra) => k.scan(fid, eid, { code, plek, datum, tijd, ...(extra || {}) });

  return { db, k, fid, eid, d1, d2, d3, terrein, weide, alpha, noord, alphahek, backstage, p, pas, magHier, scan };
}

const HEEL = [{ soort: 'festival.entree' }];      // overal, elke dag

/* ---------------------------------------------------------------- 1, 2, 3 -- */

test('1. een dag loopt over middernacht heen: 01:12 hoort bij de dag ervoor', () => {
  const w = wereld();
  const pas = w.pas(HEEL);
  const uit = w.scan(pas.code, w.noord.id, '2027-07-03', '01:12', { poort: 'Noord' });
  assert.equal(uit.stand, 'groen');
  assert.equal(uit.scan.dag, w.d1.id, 'een scan om 01:12 op 3 juli hoort bij de dag van 2 juli');
});

test('2. twee dagen die over middernacht lopen, claimen niet hetzelfde moment', () => {
  const w = wereld();
  const e = w.k.editieVind(w.fid, w.eid);
  // 01:12 op 3 juli valt binnen de dag van 2 juli (12:00-02:00) en NIET binnen
  // die van 3 juli -- daar zou 01:12 pas op 4 juli vallen.
  assert.equal(w.k.dagOpMoment(e, '2027-07-03', '01:12').id, w.d1.id);
  assert.equal(w.k.dagOpMoment(e, '2027-07-03', '13:00').id, w.d2.id);
  assert.equal(w.k.dagOpMoment(e, '2027-07-04', '01:12').id, w.d2.id);
  // 11:00 zit tussen de sluiting van gisteren en de opening van vandaag: niets.
  assert.equal(w.k.dagOpMoment(e, '2027-07-03', '11:00'), null);
});

test('3. een curfew buiten de openingstijden wordt geweigerd', () => {
  const w = wereld();
  const r = w.k.dagZet(w.fid, w.eid, { datum: '2027-07-05', open: '18:00', sluit: '23:00', curfew: '15:00' });
  assert.equal(r.status, 400);
  assert.match(r.error, /buiten de openingstijden/);
  const goed = w.k.dagZet(w.fid, w.eid, { datum: '2027-07-05', open: '18:00', sluit: '23:00', curfew: '22:00' });
  assert.equal(goed.ok, true);
});

/* ------------------------------------------------------------- 4, 5, 6, 7 -- */

test('4. een recht op een zone opent wat erin ligt, en niets ernaast', () => {
  const w = wereld();
  const pas = w.pas([{ soort: 'toegang.weide', plek: w.weide.id }]);
  assert.equal(w.magHier(pas.code, w.alpha.id, '2027-07-02', '20:00').ok, true, 'Alpha ligt in de Weide');
  const nee = w.magHier(pas.code, w.noord.id, '2027-07-02', '20:00');
  assert.equal(nee.ok, false, 'de ingang van het terrein ligt niet in de Weide');
  assert.match(nee.reden, /geen toegang tot Noord/);
});

test('5. een besloten plek erft niet: een terreinrecht opent backstage niet', () => {
  const w = wereld();
  const alg = w.pas([{ soort: 'festival.entree', plek: w.terrein.id }]);
  assert.equal(w.magHier(alg.code, w.weide.id, '2027-07-02', '20:00').ok, true, 'de weide erft wel');
  const nee = w.magHier(alg.code, w.backstage.id, '2027-07-02', '20:00');
  assert.equal(nee.ok, false);
  assert.match(nee.reden, /Backstage/);
});

test('6. een eis houdt tegen tot het bewijs er is', () => {
  const w = wereld();
  const crew = w.pas([
    { soort: 'crew.terrein', plek: w.terrein.id },
    { soort: 'crew.backstage', plek: w.backstage.id, van: '13:00', tot: '19:00', eis: 'veiligheidsinstructie' }
  ], { soort: 'crew', drager: 'Sara' });

  const zonder = w.magHier(crew.code, w.backstage.id, '2027-07-02', '14:00');
  assert.equal(zonder.ok, false);
  assert.match(zonder.reden, /veiligheidsinstructie/);

  const met = w.magHier(crew.code, w.backstage.id, '2027-07-02', '14:00', ['veiligheidsinstructie']);
  assert.equal(met.ok, true);
  assert.equal(met.recht.soort, 'crew.backstage');
});

test('7. aan de poort wint de meest specifieke ware reden', () => {
  const w = wereld();
  const crew = w.pas([
    { soort: 'crew.terrein', plek: w.terrein.id },
    { soort: 'crew.backstage', plek: w.backstage.id, van: '13:00', tot: '19:00', eis: 'veiligheidsinstructie' }
  ], { soort: 'crew', drager: 'Sara' });

  /* Vier rechten raken deze plek niet of half. De nuttigste zin voor de mens aan
     de deur is het VENSTER -- niet "geen toegang", en ook niet de eis, want die
     is op dit uur niet meer het probleem. */
  const laat = w.magHier(crew.code, w.backstage.id, '2027-07-02', '20:00', ['veiligheidsinstructie']);
  assert.equal(laat.ok, false);
  assert.match(laat.reden, /van 13:00 tot 19:00/);
});

/* ------------------------------------------------------------------ 8, 9 -- */

test('8. een pas geldt per dag: dag 1 wel, dag 3 niet', () => {
  const w = wereld();
  const vrij = w.pas([{ soort: 'festival.entree', dagen: [w.d1.id] }]);
  assert.equal(w.magHier(vrij.code, w.noord.id, '2027-07-02', '13:00').ok, true);
  const nee = w.magHier(vrij.code, w.noord.id, '2027-07-04', '13:00');
  assert.equal(nee.ok, false);
  assert.match(nee.reden, /2027-07-04/);
});

test('9. een venster dat op geen enkele dag valt, wordt bij het schrijven geweigerd', () => {
  const w = wereld();
  // 4 juli sluit om 23:00; een venster van 02:00 tot 03:00 gaat daar nooit open.
  const stuk = w.k.productZet(w.fid, w.eid, { naam: 'Nachtbar', prijs: 10,
    rechten: [{ soort: 'nacht.bar', dagen: [w.d3.id], van: '02:00', tot: '03:00' }] });
  assert.equal(stuk.status, 400);
  assert.match(stuk.error, /buiten de openingstijden/);

  // Dezelfde tijden op een dag die WEL tot 02:00 doorloopt, mogen gewoon.
  const goed = w.k.productZet(w.fid, w.eid, { naam: 'Nachtbar', prijs: 10,
    rechten: [{ soort: 'nacht.bar', dagen: [w.d1.id], van: '00:30', tot: '01:30' }] });
  assert.equal(goed.ok, true);
});

/* -------------------------------------------------------------- 10, 11 ---- */

test('10. een plek kan niet in zichzelf liggen, en een kapotte boom hangt niets op', () => {
  const w = wereld();
  const lus = w.k.plekZet(w.fid, w.eid, { id: w.weide.id, naam: 'Weide', soort: 'zone', ouder: w.alpha.id });
  assert.equal(lus.status, 400);
  assert.match(lus.error, /in zichzelf/);

  /* En de grendel bij het LEZEN, voor data die niet via plekZet binnenkwam --
     een herstelde back-up, een hand in db.json. Zonder die grendel is dit een
     oneindige lus en hangt de server. */
  const e = w.k.editieVind(w.fid, w.eid);
  e.plekken[w.weide.id].ouder = w.alpha.id;          // met de hand een lus maken
  assert.equal(w.k.plekPad(e, w.alpha.id), null, 'een lus geeft null in plaats van te hangen');
  assert.equal(w.magHier(w.pas(HEEL).code, w.alpha.id, '2027-07-02', '20:00').ok, false);
});

test('10b. een boom die te diep wordt, wordt bij het SCHRIJVEN geweigerd', () => {
  const w = wereld();
  /* Zonder deze grens bouw je een boom die plekZet accepteert en plekPad
     daarna null noemt -- en dan weigert elk recht erop zonder dat er iets is
     gemeld. De grens moet dus bij het schrijven vallen, niet bij het lezen. */
  let ouder = w.alpha.id, laatste = null;
  for (let i = 0; i < 12; i++) {
    const r = w.k.plekZet(w.fid, w.eid, { naam: 'Laag ' + i, soort: 'zone', ouder });
    if (r.status) { laatste = r; break; }
    ouder = r.plek.id;
  }
  assert.ok(laatste, 'ergens hoort het te stoppen');
  assert.equal(laatste.status, 400);
  assert.match(laatste.error, /lagen diep/);
});

test('11. een plek met kinderen kan niet weg', () => {
  const w = wereld();
  const nee = w.k.plekWeg(w.fid, w.eid, w.weide.id);
  assert.equal(nee.status, 409);
  assert.equal(w.k.plekWeg(w.fid, w.eid, w.alphahek.id).ok, true, 'een blad mag wel weg');
});

/* ---------------------------------------------------------- 12, 13, 14 ---- */

test('12. dubbelgebruik geeft oranje, met poort en tijd van de eerste scan', () => {
  const w = wereld();
  /* TWEE VERSCHILLENDE POORTEN NAAR HETZELFDE TERREIN, en dat is de hele
     bedoeling: dubbelgebruik hoort te hangen aan de plek waar je BINNEN bent en
     niet aan het hek waar je langs kwam. Scande deze toets twee keer bij
     dezelfde ingang, dan zou een telling per hek er ook doorheen komen -- en
     dat is precies de vorm waarmee een pas twee keer naar binnen loopt. */
  const zuid = w.p({ naam: 'Zuid', soort: 'ingang', ouder: w.terrein.id });
  const pas = w.pas(HEEL);
  assert.equal(w.scan(pas.code, w.noord.id, '2027-07-02', '12:41', { poort: 'Noord' }).stand, 'groen');
  const twee = w.scan(pas.code, zuid.id, '2027-07-02', '13:10', { poort: 'Zuid' });
  assert.equal(twee.stand, 'oranje');
  assert.match(twee.zin, /Noord/);
  assert.match(twee.zin, /12:41/);
});

test('13. naar buiten mag altijd, ook met een ingetrokken pas', () => {
  const w = wereld();
  const pas = w.pas(HEEL);
  w.scan(pas.code, w.noord.id, '2027-07-02', '12:41', { poort: 'Noord' });
  assert.equal(w.k.pasIntrekken(w.fid, w.eid, pas.code, 'gestolen').ok, true);

  const naarBinnen = w.scan(pas.code, w.noord.id, '2027-07-02', '13:00', { poort: 'Noord' });
  assert.equal(naarBinnen.stand, 'rood');
  assert.match(naarBinnen.zin, /ingetrokken/);

  const naarBuiten = w.scan(pas.code, w.noord.id, '2027-07-02', '13:05', { poort: 'Noord', richting: 'uit' });
  assert.equal(naarBuiten.stand, 'groen', 'wie binnen staat, moet eruit kunnen');

  const b = w.k.bezetting(w.fid, w.eid, w.d1.id);
  const terrein = b.plekken.find(x => x.id === w.terrein.id);
  assert.equal(terrein.aanwezig, 0, 'en de telling klopt daarna');
});

test('14. de vergunde capaciteit sluit de poort; de veilige capaciteit niet', () => {
  const w = wereld();
  const kraam = w.p({ naam: 'Kraam', soort: 'zone', ouder: w.terrein.id, capaciteit: 2, veiligeCapaciteit: 1 });
  const hek = w.p({ naam: 'Kraamhek', soort: 'ingang', ouder: kraam.id });
  const een = w.pas(HEEL), twee = w.pas(HEEL), drie = w.pas(HEEL);

  assert.equal(w.scan(een.code, hek.id, '2027-07-02', '13:00', { poort: 'K' }).stand, 'groen');
  assert.equal(w.scan(twee.code, hek.id, '2027-07-02', '13:01', { poort: 'K' }).stand, 'groen',
    'voorbij de VEILIGE capaciteit gaat er niets dicht -- daar begint een uitzondering');
  const vol = w.scan(drie.code, hek.id, '2027-07-02', '13:02', { poort: 'K' });
  assert.equal(vol.stand, 'rood');
  assert.equal(vol.vol, true);
  assert.match(vol.zin, /vergunde capaciteit/);
});

/* -------------------------------------------------------------- 15 -------- */

test('15. iedereen wordt een keer geteld, ook wie twee poorten door is', () => {
  const w = wereld();
  const pas = w.pas(HEEL);
  w.scan(pas.code, w.noord.id, '2027-07-02', '13:00', { poort: 'Noord' });      // in het terrein
  w.scan(pas.code, w.alphahek.id, '2027-07-02', '13:30', { poort: 'Alpha' });   // en in Alpha

  const b = w.k.bezetting(w.fid, w.eid, w.d1.id);
  const op = (id) => b.plekken.find(x => x.id === id).aanwezig;
  assert.equal(op(w.alpha.id), 1);
  assert.equal(op(w.weide.id), 1);
  assert.equal(op(w.terrein.id), 1, 'een mens die twee poorten door is, is nog steeds een mens');
});

/* -------------------------------------------------------------- 16, 17 ---- */

test('16. de vooruitblik rekent de aanlooptijd uit', () => {
  const w = wereld();
  const zone = w.p({ naam: 'Bravo', soort: 'zone', ouder: w.terrein.id, capaciteit: 100, veiligeCapaciteit: 20 });
  const hek = w.p({ naam: 'Bravohek', soort: 'ingang', ouder: zone.id });
  for (let i = 0; i < 10; i++) {
    const pas = w.pas(HEEL);
    w.scan(pas.code, hek.id, '2027-07-02', '13:' + String(i + 1).padStart(2, '0'), { poort: 'B' });
  }
  const u = w.k.uitzonderingen(w.fid, w.eid, { dag: w.d1.id, datum: '2027-07-02', tijd: '13:10', venster: 15 });
  const bravo = u.uitzonderingen.find(x => x.plek === zone.id);
  assert.ok(bravo, 'Bravo hoort een uitzondering te zijn');
  assert.equal(bravo.over, 15, '10 binnen, 20 veilig, 10 in 15 minuten -> nog 15 minuten');
  assert.equal(bravo.ernst, 'hoog');
  assert.match(bravo.zin, /over 15 minuten/);
});

test('17. rust is een uitkomst en geen leegte', () => {
  const w = wereld();
  const pas = w.pas(HEEL);
  w.scan(pas.code, w.noord.id, '2027-07-02', '13:00', { poort: 'Noord' });
  const u = w.k.uitzonderingen(w.fid, w.eid, { dag: w.d1.id, datum: '2027-07-02', tijd: '13:10' });

  assert.equal(u.uitzonderingen.length, 0, 'niets loopt vol');
  assert.ok(u.ongemeten.some(x => x.id === w.backstage.id),
    'backstage heeft een drempel en geen enkele meting -- dat is een bevinding, geen rust');
  assert.equal(u.rust, false, 'stilte is geen rust');

  const stand = w.k.festivalStand(w.fid, w.eid, { dag: w.d1.id, datum: '2027-07-02', tijd: '13:10' });
  assert.match(stand.zin, /niet gemeten/);
});

test('17b. en rust bestaat wel, als alles met een drempel gemeten wordt', () => {
  const db = { data: {} };
  const k = maakFestival({ db, save() {}, crypto, schoon });
  const fid = k.festivalNieuw('ZAAK2', { naam: 'Klein' }).festival.id;
  const eid = k.editieNieuw(fid, { jaar: 2027 }).editie.id;
  const dag = k.dagZet(fid, eid, { datum: '2027-07-02', open: '12:00', sluit: '23:00' }).dag;
  const terrein = k.plekZet(fid, eid, { naam: 'T', soort: 'terrein', capaciteit: 9000, veiligeCapaciteit: 8000 }).plek;
  const zone = k.plekZet(fid, eid, { naam: 'Z', soort: 'zone', ouder: terrein.id, capaciteit: 5000, veiligeCapaciteit: 4000 }).plek;
  const hek = k.plekZet(fid, eid, { naam: 'H', soort: 'ingang', ouder: zone.id }).plek;
  const pas = k.pasUitgeven(fid, eid, { drager: 'Kobalt', rechten: HEEL }).pas;
  k.scan(fid, eid, { code: pas.code, plek: hek.id, datum: '2027-07-02', tijd: '13:00', poort: 'H' });

  const u = k.uitzonderingen(fid, eid, { dag: dag.id, datum: '2027-07-02', tijd: '13:10' });
  assert.equal(u.gemeten, 2);
  assert.deepEqual(u.ongemeten, []);
  assert.equal(u.rust, true);
  assert.match(k.festivalStand(fid, eid, { dag: dag.id, datum: '2027-07-02', tijd: '13:10' }).zin, /^Rustig/);
});

/* -------------------------------------------------------------- 18 -------- */

test('18. een offline bundel vindt de dubbele en draait niets terug', () => {
  const w = wereld();
  const pas = w.pas(HEEL);
  const uit = w.k.scanBundel(w.fid, w.eid, [
    { code: pas.code, plek: w.noord.id, datum: '2027-07-02', tijd: '13:20', poort: 'Zuid' },
    { code: pas.code, plek: w.noord.id, datum: '2027-07-02', tijd: '12:50', poort: 'Noord' },
    { code: 'BESTAATNIET', plek: w.noord.id, datum: '2027-07-02', tijd: '13:00', poort: 'Noord' }
  ]);
  assert.equal(uit.verwerkt, 1, 'de vroegste scan wint');
  assert.equal(uit.dubbel.length, 1);
  assert.equal(uit.dubbel[0].poort, 'Zuid', 'de latere scan is de dubbele');
  assert.equal(uit.geweigerd.length, 1);

  const b = w.k.bezetting(w.fid, w.eid, w.d1.id);
  assert.equal(b.plekken.find(x => x.id === w.terrein.id).aanwezig, 1,
    'er wordt niets teruggedraaid -- die mens staat al binnen');
});

/* ============================================================================
   DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2)

   Dertien mutaties, alle dertien RAAK. Per stuk wat er is stukgemaakt en welke
   toets dat zag.

    1. In kern/festival/model.js dagOpMoment() teruggezet op offset(d, tijd) --
       de vorm zonder datum, waarin twee dagen die allebei over middernacht
       lopen hetzelfde moment claimen.
       -> toets 2 zakte (01:12 op 4 juli kwam bij de dag van 2 juli uit) en
          toets 8 zakte mee (de dagcontrole van een recht keek daardoor naar de
          verkeerde dag). Dat de fout zich op twee plekken laat zien, is zelf de
          bevinding: dit is een rekenregel waar alles onder hangt.

    2. In kern/festival/poort.js de beslotenheidsgrens uitgezet (`if (false)`).
       -> toetsen 5, 6 en 7 zakten. Een terreinrecht opende backstage, en
          daarmee viel ook de eis erachter weg -- want een recht dat er nooit
          had mogen zijn, komt eerst.

    3. In poort.js beter() een lege functie gemaakt, zodat elke weigering
       terugvalt op "geen toegang tot X".
       -> toetsen 6, 7 en 8 zakten. Dit is de mutatie die het meest zegt: de
          poort weigert nog steeds precies dezelfde mensen. Alleen de ZIN die de
          medewerker leest is waardeloos geworden, en dat is hier een fout.

    4. In kern/festival/bezetting.js diepste() elke telplek laten meetellen in
       plaats van alleen de diepste.
       -> toets 15 zakte: wie door twee poorten was, telde twee keer.

    5. In kern/festival/toegang.js de uitgang voor een ongeldige pas uitgezet.
       -> toets 13 zakte: een ingetrokken pas kwam het terrein niet meer af, en
          de telling bleef daarna op 1 staan.

    6. In toegang.js de poort laten sluiten bij de VEILIGE capaciteit.
       -> toets 14 zakte op de tweede scan. Precies de verwarring die
          FESTIVAL.md par. 5.3 beschrijft: een drempel waar een mens over
          beslist, verward met een grens die een mens al ondertekend heeft.

    7. In kern/festival/rechten.js de controle op een venster dat op geen enkele
       dag valt, uitgezet.
       -> toets 9 zakte: het product werd aangenomen, en het recht erin zou
          nooit opengaan (LAT-regel 6, een belofte zonder code).

    8. In kern/festival/uitzondering.js rust teruggebracht tot `uit.length === 0`.
       -> toets 17 zakte: een terrein met een ongemeten backstage meldde rust.

    9. In kern/festival/terrein.js de cyclusweigering bij plekZet uitgezet.
       -> toets 10 zakte: een zone kon in haar eigen podium worden gehangen.

   10. In model.js de curfew-controle uitgezet.
       -> toets 3 zakte: een curfew om 15:00 op een dag die om 18:00 opent werd
          aangenomen, en die geluidsstop valt dus nooit.

   11. In toegang.js telplekVan() de gescande plek zelf laten teruggeven in
       plaats van omhoog te lopen naar de eerste tellende plek.
       -> toetsen 12 en 14 zakten: dubbelgebruik werd per HEK bijgehouden, dus
          dezelfde pas liep bij Noord en Zuid allebei groen naar binnen.
          LET OP: bij de eerste ronde zakte alleen toets 14, omdat toets 12
          twee keer bij dezelfde poort scande. Dat was een gat in de toets en
          niet in de code; toets 12 scant nu bij twee verschillende ingangen van
          hetzelfde terrein en ziet de fout wel. Dit is waar de mutatiediscipline
          voor bestaat -- niet om de code te keuren maar om de toets te keuren.

   12. In terrein.js de dieptegrens bij het schrijven uitgezet.
       -> toets 10b zakte: een boom van twaalf lagen werd netjes aangenomen,
          waarna plekPad hem null noemde en elk recht erop weigerde zonder dat
          er iets was gemeld.

   13. In terrein.js de dieptegrendel in plekPad uitgezet (de leeskant).
       -> toets 10 zakte. Zonder deze grendel is een lus in de boom een
          oneindige while. Hier stond eerst OOK een Set van geziene plekken
          naast; die is weggehaald toen bleek dat hij niets ving wat de diepte
          niet al ving -- dode code die op een wacht lijkt, is erger dan geen
          wacht.
   ========================================================================== */
