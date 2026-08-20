/* ============================================================================
   NORM EN VOORSPELLING: HET GETAL IS VAN EEN MENS.

   WAAROM DIT BESTAAT

   LAT-regel 3 zegt dat een meter zonder invoer niets hoort te beweren, en een
   voorspellingslaag is precies de plek waar die regel sneuvelt. De verleiding
   is een kengetal: "reken op 1 medewerker per 250 bezoekers". Zo'n getal ziet
   eruit als kennis, is een gok, en wordt nooit meer weggehaald.

   Hier komt elk getal dus uit een meting (de scans) of uit een norm die een
   mens heeft gezet. Waar er een ontbreekt, staat er geen getal maar een zin.
   Deze toetsen leggen dat vast -- vooral de gevallen waarin er NIETS wordt
   uitgerekend, want dat is het deel dat een volgende hand wil "verbeteren".

   WAT ER WORDT VASTGELEGD

    1. Een norm zonder aantal bestaat niet.
    2. Een norm die op geen enkele dag binnen de openingstijden valt, wordt
       geweigerd in plaats van stil nooit mee te tellen.
    3. De vraag telt vast plus per honderd aanwezigen.
    4. Een plek die zelf niet telt, rekent op de zone erboven -- en zegt dat.
    5. Zonder telling blijft alleen het vaste deel over, met een vlag erop.
    6. Een gat is nodig min wat er volgens het rooster staat.
   6b. Wat geen mensen zijn (bekers, bakken ijs) komt niet in de bemensing.
    7. Een dienst op de zone bemenst de bar in die zone niet.
    8. Vooruitkijken vindt het gat van straks; nu en straks worden niet dubbel
       gemeld.
    9. Zonder doorstroom wordt het leeglopen niet gerekend, en dat staat er.
   10. Het leeglopen rekent de nooduitgangen niet mee.
   11. De uitstroom die niet meer past voor sluitingstijd, is een uitzondering.
   12. De gaten komen op dezelfde hoop als de rest.

   DE MUTATIES staan aan het slot.
   Draai los: node --test test/festival-vooruit.test.js
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
  const dag = k.dagZet(fid, eid, { datum: '2027-07-02', open: '12:00', sluit: '02:00',
    curfew: '01:00' }).dag;
  const terrein = k.plekZet(fid, eid, { naam: 'Terrein', soort: 'terrein', capaciteit: 9000 }).plek;
  const noord = k.plekZet(fid, eid, { naam: 'Zone Noord', soort: 'zone', ouder: terrein.id,
    capaciteit: 4000 }).plek;
  const bar = k.plekZet(fid, eid, { naam: 'Bar Lima', soort: 'bar', ouder: noord.id }).plek;
  const poort = k.plekZet(fid, eid, { naam: 'Noordpoort', soort: 'ingang', ouder: noord.id }).plek;

  /* Een pas met entree op deze dag, en een scan naar binnen: zo ontstaat een
     gemeten aanwezigheid zonder de telling na te bouwen. */
  function binnen(n) {
    for (let i = 0; i < n; i++) {
      const pas = k.pasUitgeven(fid, eid, { drager: 'Gast ' + i,
        rechten: [{ soort: 'festival.entree', dagen: [dag.id] }] }).pas;
      k.scan(fid, eid, { code: pas.code, plek: poort.id, poort: 'Noord',
        datum: '2027-07-02', tijd: '13:00', door: 'Toni' });
    }
  }
  const norm = (d) => k.normZet(fid, eid, { plek: bar.id, van: '12:00', tot: '02:00', ...d });
  const dienst = (d) => k.dienstZet(fid, eid, { dag: dag.id, plek: bar.id, van: '12:00',
    tot: '02:00', ...d });
  return { k, fid, eid, dag, terrein, noord, bar, poort, binnen, norm, dienst };
}

test('1. een norm zonder aantal bestaat niet', () => {
  const w = wereld();
  const r = w.norm({ vast: 0, per100: 0 });
  assert.equal(r.status, 400);
  assert.match(r.error, /zegt niets/);
});

test('2. een norm buiten de openingstijden wordt geweigerd', () => {
  const w = wereld();
  /* De dag loopt van 12:00 tot 02:00. Een norm van 09:00 tot 11:00 zou anders
     netjes worden opgeslagen en daarna nooit meetellen -- een stille fout
     (LAT-regel 5), en de vervelendste soort: de bemensing STAAT er. */
  const r = w.norm({ vast: 2, van: '09:00', tot: '11:00' });
  assert.equal(r.status, 400);
  assert.match(r.error, /openingstijden/);
});

test('3. de vraag is vast plus per honderd aanwezigen', () => {
  const w = wereld();
  w.binnen(250);
  w.norm({ vast: 2, per100: 1 });
  const v = w.k.vraagOp(w.fid, w.eid, { dag: w.dag.id, tijd: '14:00' });
  assert.equal(v.ok, true);
  assert.equal(v.vraag.length, 1);
  assert.equal(v.vraag[0].aanwezig, 250);
  assert.equal(v.vraag[0].nodig, 5, '2 vast plus 1 per 100 van 250, naar boven afgerond');
});

test('4. een bar rekent op de zone erboven, en zegt dat erbij', () => {
  const w = wereld();
  w.binnen(120);
  w.norm({ vast: 1, per100: 2 });
  const v = w.k.vraagOp(w.fid, w.eid, { dag: w.dag.id, tijd: '14:00' });
  const r = v.vraag[0];
  assert.equal(r.plekNaam, 'Bar Lima');
  assert.equal(r.gemetenOp, 'Zone Noord',
    'een bar telt zelf niemand; het percentage komt van de zone waarin hij ligt');
  assert.equal(r.nodig, 4);
});

test('5. zonder telling blijft alleen het vaste deel over', () => {
  const w = wereld();
  w.norm({ vast: 2, per100: 4 });
  const v = w.k.vraagOp(w.fid, w.eid, { dag: w.dag.id, tijd: '14:00' });
  const r = v.vraag[0];
  assert.equal(r.aanwezig, 0);
  assert.equal(r.nodig, 2, 'niemand geteld is geen reden om er vier bij te verzinnen');
  assert.equal(r.gemetenOp, 'Zone Noord',
    'en er staat bij WAAR dat nul vandaan komt, zodat "nul" en "niet gemeten" niet op elkaar lijken');
});

test('6. een gat is nodig min wat er staat', () => {
  const w = wereld();
  w.binnen(300);
  w.norm({ vast: 1, per100: 1 });          // 1 + ceil(300/100) = 4
  w.dienst({ wie: 'Ana' });
  w.dienst({ wie: 'Bo' });
  const g = w.k.bemensing(w.fid, w.eid, { dag: w.dag.id, tijd: '14:00' });
  assert.equal(g.gaten.length, 1);
  assert.equal(g.gaten[0].nodig, 4);
  assert.equal(g.gaten[0].staat, 2);
  assert.equal(g.gaten[0].gat, 2);
});

test('6b. wat geen mensen zijn, komt niet in de bemensing terecht', () => {
  const w = wereld();
  w.binnen(400);
  w.norm({ wat: 'bekers', vast: 200, per100: 50 });
  const v = w.k.vraagOp(w.fid, w.eid, { dag: w.dag.id, tijd: '14:00' });
  assert.equal(v.vraag[0].nodig, 400, 'de vraag rekent elke eenheid');
  assert.equal(v.vraag[0].wat, 'bekers');

  const g = w.k.bemensing(w.fid, w.eid, { dag: w.dag.id, tijd: '14:00' });
  assert.equal(g.gaten.length, 0,
    'bekers worden klaargezet en niet ingeroosterd; ze als personeelsgat melden zou de lijst onleesbaar maken');
});

test('7. een dienst op de zone bemenst de bar in die zone niet', () => {
  const w = wereld();
  w.norm({ vast: 2 });
  w.k.dienstZet(w.fid, w.eid, { dag: w.dag.id, plek: w.noord.id, wie: 'Ana',
    van: '12:00', tot: '02:00' });
  w.k.dienstZet(w.fid, w.eid, { dag: w.dag.id, plek: w.noord.id, wie: 'Bo',
    van: '12:00', tot: '02:00' });
  const g = w.k.bemensing(w.fid, w.eid, { dag: w.dag.id, tijd: '14:00' });
  assert.equal(g.gaten[0].staat, 0,
    'anders bemant een rooster met tien man op het terrein elke bar tegelijk');
});

test('8. vooruitkijken vindt het gat van straks, en meldt niet dubbel', () => {
  const w = wereld();
  /* Op de bar staat het de hele avond goed; op de zone valt om 15:00 het gat. */
  w.norm({ vast: 1 });
  w.dienst({ wie: 'Ana' });
  w.k.normZet(w.fid, w.eid, { plek: w.noord.id, vast: 1, van: '12:00', tot: '02:00' });
  w.k.dienstZet(w.fid, w.eid, { dag: w.dag.id, plek: w.noord.id, wie: 'Bo',
    van: '12:00', tot: '15:00' });

  const nu = w.k.vooruitSignalen(w.fid, w.eid, { dag: w.dag.id, tijd: '14:00', vooruit: 60 });
  const zone = nu.signalen.filter(s => s.naam === 'Zone Noord');
  assert.equal(zone.length, 1);
  assert.equal(zone[0].ernst, 'aandacht');
  assert.match(zone[0].zin, /over 60 minuten/);
  assert.equal(nu.signalen.filter(s => s.naam === 'Bar Lima').length, 0, 'daar staat het goed');

  /* En om 15:30 is het geen vooruitblik meer maar een gat, en dan staat het er
     EEN keer -- niet ook nog als "over een uur ook". */
  const later = w.k.vooruitSignalen(w.fid, w.eid, { dag: w.dag.id, tijd: '15:30', vooruit: 60 });
  const nogSteeds = later.signalen.filter(s => s.naam === 'Zone Noord');
  assert.equal(nogSteeds.length, 1);
  assert.equal(nogSteeds[0].ernst, 'hoog');
});

test('9. zonder doorstroom wordt het leeglopen niet gerekend', () => {
  const w = wereld();
  w.binnen(500);
  const l = w.k.leegloop(w.fid, w.eid, { dag: w.dag.id, tijd: '23:00' });
  assert.equal(l.ok, true);
  assert.equal(l.bekend, false);
  assert.equal(l.minuten, undefined, 'geen getal is beter dan een plausibel getal');
  assert.match(l.zin, /geen enkele uitgang een doorstroom/);
});

test('10. het leeglopen rekent de nooduitgangen niet mee', () => {
  const w = wereld();
  w.binnen(600);
  w.k.plekZet(w.fid, w.eid, { naam: 'Uitgang Zuid', soort: 'uitgang', ouder: w.noord.id,
    doorstroom: 1200 });
  w.k.plekZet(w.fid, w.eid, { naam: 'Nooddeur', soort: 'nooduitgang', ouder: w.noord.id,
    doorstroom: 3000 });
  const l = w.k.leegloop(w.fid, w.eid, { dag: w.dag.id, tijd: '23:00' });
  assert.equal(l.bekend, true);
  assert.equal(l.perUur, 1200, 'de nooddeur is er voor een ontruiming, niet voor het naar huis gaan');
  assert.equal(l.uitgangen.length, 1);
  assert.equal(l.minuten, 30, '600 mensen door 20 per minuut');
});

test('11. een uitstroom die niet meer past voor sluitingstijd is een uitzondering', () => {
  const w = wereld();
  w.binnen(600);
  w.k.plekZet(w.fid, w.eid, { naam: 'Uitgang Zuid', soort: 'uitgang', ouder: w.noord.id,
    doorstroom: 600 });                       // 10 per minuut: 60 minuten leeglopen
  /* Om 00:30 is er nog een half uur tot de curfew van 01:00. */
  const s = w.k.vooruitSignalen(w.fid, w.eid, { dag: w.dag.id, tijd: '00:30' });
  const uit = s.signalen.find(x => x.bron === 'leegloop');
  assert.ok(uit, 'dit is te weten voordat de laatste band opgaat');
  assert.equal(uit.ernst, 'hoog');
  assert.match(uit.zin, /60 minuten en er is nog 30 minuten/);

  /* Om 22:00 past het ruim, en dan staat er niets. Wat goed gaat komt niet in
     beeld -- anders staat deze melding er de hele avond en leest niemand hem. */
  const vroeg = w.k.vooruitSignalen(w.fid, w.eid, { dag: w.dag.id, tijd: '22:00' });
  assert.equal(vroeg.signalen.filter(x => x.bron === 'leegloop').length, 0);
});

test('12. de gaten komen op dezelfde hoop als de rest', () => {
  const w = wereld();
  w.norm({ vast: 3 });
  const u = w.k.uitzonderingen(w.fid, w.eid, { dag: w.dag.id, datum: '2027-07-02', tijd: '14:00' });
  assert.ok(u.uitzonderingen.some(x => x.bron === 'bemensing'),
    'een cockpit met twee lijsten laat de leiding kiezen welke ze eerst leest');
  assert.equal(u.rust, false);
});

/* ============================================================================
   DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2)

   Twaalf mutaties. Elf raak, een afgeslagen -- en die ene wees een gat in de
   TOETSEN aan, niet in de code.

   NORM (norm.js)
    N1. De per100 negeren en alleen `vast` teruggeven. -> toetsen 3, 4 en 6.
    N2. Naar beneden afronden in plaats van naar boven. -> toetsen 3 en 4.
        Een halve medewerker bestaat niet, en naar beneden afronden zet er
        stelselmatig een te weinig neer op elke drukke plek tegelijk.
    N3. Op de plek zelf tellen in plaats van op de eerste tellende plek erboven.
        -> toetsen 3, 4, 5 en 6 zakten: een bar telt niemand (./soorten.js), dus
        elke barnorm met een per100 viel terug op het vaste deel.
    N4. Het venster niet toetsen bij het schrijven. -> toets 2 zakte: een norm
        van 09:00-11:00 op een festival dat om 12:00 opengaat werd netjes
        opgeslagen en telde daarna nooit mee. De bemensing STAAT er dan, en
        niemand die merkt dat hij niet bestaat (LAT-regel 5).

   VOORSPELLING (voorspelling.js)
    V1. De plekvergelijking in bemand() weghalen. -> toetsen 7 en 8 zakten: een
        rooster met tien man op het terrein bemande elke bar tegelijk.
    V2. De dienst niet op tijd toetsen. -> toets 8: een dienst die om 15:00
        eindigde bemande de plek de hele nacht.
    V3. Ook eenheden die geen mensen zijn als bemensingsgat melden.
        AFGESLAGEN, en dat lag aan de toetsen: geen enkele had een norm over
        iets anders dan mensen. Toets 6b staat er nu (200 bekers) en zakt erop.
        Zonder die toets was "1.400 bekers, er staat er 0" als personeelsgat op
        de cockpit verschenen.
    V4. De nooduitgangen meerekenen in het leeglopen. -> toets 10. Dit is de
        mutatie die het getal mooier maakt en de avond gevaarlijker.
    V5. Zonder doorstroom toch een getal geven. -> toets 9 zakte. LAT-regel 3
        in zijn zuiverste vorm: er is niets gemeten, dus er hoort niets te staan.
    V6. Dubbel melden: een plek die nu al een gat heeft ook nog als "over een
        uur ook". -> toets 8.
    V7. De leegloopmelding altijd geven in plaats van alleen als hij niet meer
        past. -> toets 11 zakte op de stille kant: om 22:00 hoort er niets te
        staan, anders staat die melding er de hele avond en leest niemand hem.
    V8. De curfew negeren en tot sluitingstijd rekenen. -> toets 11. De curfew
        is het moment waarop de muziek uit moet, en dus waarop het uitstromen
        begint; tot sluitingstijd rekenen geeft een uur speling die er niet is.
   ========================================================================== */
