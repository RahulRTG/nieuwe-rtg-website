/* ============================================================================
   DE EDITIE-TIJDLIJN: SAMENVOEGEN EN SORTEREN, MEER NIET.

   WAAROM DIT BESTAAT

   Par. 7 van FESTIVAL.md noemt vijf dingen die nieuw moesten omdat ze nergens
   anders konden wonen. Vier ervan zijn gebouwd; de vijfde -- de editie-tijdlijn
   -- stond alleen in het document. Dat is LAT-regel 6 in zijn zuiverste vorm:
   een belofte in tekst zonder een regel code eronder.

   De twee dingen die hier kunnen sneuvelen:

   1. HET WORDT EEN TWEEDE WAARHEID. Een eigen logtabel naast de scans en de
      controls loopt uit de pas zodra er een offline bundel binnenkomt of een
      back-up wordt hersteld. Toets 6 houdt dat tegen.
   2. HET WORDT EEN DOSSIER. "Pas 4f2a om 21:03 bij Noord, om 22:40 bij Alpha"
      is precies het spoor dat par. 5.1 verbiedt. Toets 1 en 2 houden dat tegen.

   WAT ER WORDT VASTGELEGD

    1. Scans staan er geteld in, per poort en per kwartier.
   1b. Een kwartier is een kwartier, ook als de scans minuten uit elkaar liggen.
    2. Er staat geen pas-id, geen codenaam en geen pascode in.
    3. Beslissingen dragen de naam van wie ze nam.
    4. Elke regel draagt zijn bron.
    5. Het nieuwste staat bovenaan.
    6. De tijdlijn bewaart niets: hij verandert mee met de bron.
    7. Groepen staan er niet in.
    8. Filteren op een dag en op een soort.
    9. Er wordt niet stil afgekapt.

   DE MUTATIES staan aan het slot.
   Draai los: node --test test/festival-tijdlijn.test.js
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
  const poort = k.plekZet(fid, eid, { naam: 'Noord', soort: 'ingang', ouder: terrein.id }).plek;
  const alpha = k.plekZet(fid, eid, { naam: 'Alpha', soort: 'podium', ouder: terrein.id,
    capaciteit: 8000 }).plek;

  function binnen(n, tijd) {
    const codes = [];
    for (let i = 0; i < n; i++) {
      const p = k.pasUitgeven(fid, eid, { drager: 'Gast ' + i,
        rechten: [{ soort: 'festival.entree', dagen: [dag.id] }] }).pas;
      k.scan(fid, eid, { code: p.code, plek: poort.id, poort: 'Noord',
        datum: '2027-07-02', tijd: tijd || '13:00', door: 'Toni' });
      codes.push(p);
    }
    return codes;
  }
  const lijn = (v) => k.tijdlijn(fid, eid, v);
  return { k, fid, eid, dag, terrein, poort, alpha, binnen, lijn };
}

test('1. scans staan er geteld in, per poort en per kwartier', () => {
  const w = wereld();
  w.binnen(3);
  const r = w.lijn();
  const scan = r.gebeurtenissen.filter(x => x.soort === 'scan');
  assert.equal(scan.length, 1, 'drie scans in hetzelfde kwartier zijn een regel');
  assert.match(scan[0].zin, /3 scans naar binnen bij Noord/);
});

test('1b. een kwartier is een kwartier, ook als de scans minuten uit elkaar liggen', () => {
  const w = wereld();
  w.binnen(1);
  /* De stempel van een scan is de serverklok, en die valt in een toets binnen
     dezelfde minuut. Hier worden de stempels dus met de hand uit elkaar gezet:
     zonder dit zou een indeling PER MINUUT even goed lijken te werken, en dan
     staat er bij 40.000 bezoekers een muur van duizenden regels waar niemand
     nog iets in terugvindt. */
  const e = w.k.editieVind(w.fid, w.eid);
  const eerste = e.scans[0];
  e.scans = [
    { ...eerste, at: '2027-07-02T21:01:00.000Z' },
    { ...eerste, at: '2027-07-02T21:07:30.000Z' },
    { ...eerste, at: '2027-07-02T21:14:59.000Z' },
    { ...eerste, at: '2027-07-02T21:15:00.000Z' }
  ];
  const scan = w.lijn().gebeurtenissen.filter(x => x.soort === 'scan');
  assert.equal(scan.length, 2, 'drie in het ene kwartier, een in het volgende');
  assert.match(scan[0].zin, /^1 scan /, 'het nieuwste kwartier bovenaan');
  assert.match(scan[1].zin, /^3 scans /);
});

test('2. er staat geen pas-id, geen codenaam en geen pascode in', () => {
  const w = wereld();
  const passen = w.binnen(2);
  const tekst = JSON.stringify(w.lijn());
  for (const p of passen) {
    assert.ok(!tekst.includes(p.code), 'geen pascode');
    assert.ok(!tekst.includes(p.id), 'geen pas-id');
  }
  assert.ok(!/Gast 0/.test(tekst), 'en geen drager: een bezoeker is een telling, geen spoor');
});

test('3. beslissingen dragen de naam van wie ze nam', () => {
  const w = wereld();
  const b = w.k.boekingZet(w.fid, w.eid, { dag: w.dag.id, podium: w.alpha.id,
    artiest: 'Fred Again', van: '21:00', tot: '22:30' }).boeking;
  w.k.boekingStand(w.fid, w.eid, { id: b.id, stand: 'bevestigd', door: 'Marta Salas',
    hoe: 'getekend contract' });

  const bev = w.lijn().gebeurtenissen.find(x => /bevestigd/.test(x.zin));
  assert.equal(bev.door, 'Marta Salas');
  assert.match(bev.zin, /getekend contract/,
    'de reconstructie hoort te tonen WAAROP de bevestiging berustte, niet alleen dat er een was');
});

test('4. elke regel draagt zijn bron', () => {
  const w = wereld();
  w.binnen(1);
  w.k.controlZet(w.fid, w.eid, { groep: 'veiligheid', naam: 'Hekwerkkeuring', kritiek: true,
    eis: 'Keuringsrapport van de hekwerkleverancier' });
  const controls = Object.values(w.k.editieVind(w.fid, w.eid).controls);
  w.k.bewijsIndienen(w.fid, w.eid, { control: controls[0].id, soort: 'keuring',
    geldigTot: '2027-12-31', door: 'Joel' });

  const r = w.lijn();
  assert.ok(r.gebeurtenissen.every(x => x.bron), 'zonder bron is een tijdlijn niet na te trekken');
  /* Deze twee bronnen zijn ECHT aangroeiend; een bevestiging is een stempel dat
     opnieuw gezet kan worden. Dat verschil hoort zichtbaar te zijn in plaats van
     dat de tijdlijn een garantie suggereert die de data niet geeft. */
  assert.match(r.gebeurtenissen.find(x => x.soort === 'scan').bron, /groeit aan/);
  assert.match(r.gebeurtenissen.find(x => x.soort === 'bewijs').bron, /groeit aan/);
});

test('5. het nieuwste staat bovenaan', () => {
  const w = wereld();
  const r = wereld().lijn();
  w.binnen(1);
  w.k.boekingZet(w.fid, w.eid, { dag: w.dag.id, podium: w.alpha.id, artiest: 'A',
    van: '21:00', tot: '22:30' });
  const lijst = w.lijn().gebeurtenissen;
  for (let i = 1; i < lijst.length; i++) {
    assert.ok(lijst[i - 1].op >= lijst[i].op, 'een reconstructie leest van achteren naar voren');
  }
  assert.equal(r.gebeurtenissen.length, 0, 'een lege editie geeft een lege lijn en geen fout');
});

test('6. de tijdlijn bewaart niets en verandert mee met de bron', () => {
  const w = wereld();
  w.binnen(2);
  assert.equal(w.lijn().gebeurtenissen.filter(x => x.soort === 'scan').length, 1);

  /* De scans worden gewist -- een opruiming, een migratie. De tijdlijn heeft
     geen eigen kopie, dus hij verandert mee. Dat is precies het verschil met
     ./geheugen.js, dat er WEL een afdruk van bewaart: die twee hebben allebei
     hun reden, en ze door elkaar halen levert of een dossier op of een
     reconstructie die niet klopt (LAT-regel 4). */
  w.k.editieVind(w.fid, w.eid).scans = [];
  assert.equal(w.lijn().gebeurtenissen.filter(x => x.soort === 'scan').length, 0);
});

test('7. groepen staan er niet in', () => {
  const w = wereld();
  const g = w.k.groepMaak(w.fid, w.eid, { naam: 'Busje van Ada', maker: 'KOBALT' });
  w.k.groepDeelnemen(w.fid, w.eid, { code: g.groep.code, codenaam: 'AMBER' });
  const tekst = JSON.stringify(w.lijn());
  assert.ok(!/Busje van Ada/.test(tekst));
  assert.ok(!/KOBALT|AMBER/.test(tekst),
    'een groep is tussen gasten; de organisatie leest daar niets van, ook niet achteraf');
});

test('8. filteren op een dag en op een soort', () => {
  const w = wereld();
  w.binnen(1);
  w.k.boekingZet(w.fid, w.eid, { dag: w.dag.id, podium: w.alpha.id, artiest: 'A',
    van: '21:00', tot: '22:30' });

  const tweede = w.k.dagZet(w.fid, w.eid, { datum: '2027-07-03', open: '12:00', sluit: '02:00' }).dag;
  w.k.boekingZet(w.fid, w.eid, { dag: tweede.id, podium: w.alpha.id, artiest: 'B',
    van: '21:00', tot: '22:30' });

  const dag1 = w.lijn({ dag: w.dag.id });
  assert.ok(dag1.gebeurtenissen.some(x => /artiest A|A in het schema/.test(x.zin)));
  assert.ok(!dag1.gebeurtenissen.some(x => /B in het schema/.test(x.zin)));

  const alleenBoeking = w.lijn({ soorten: ['boeking'] });
  assert.ok(alleenBoeking.gebeurtenissen.every(x => x.soort === 'boeking'));
  assert.ok(alleenBoeking.gebeurtenissen.length >= 2);
});

test('9. er wordt niet stil afgekapt', () => {
  const w = wereld();
  /* Meer dan vijfhonderd boekingen: de lijst stopt, maar zegt hoeveel er niet
     in staan. Een lijst die zwijgend afkapt, leest als "dit was alles". */
  const klok = (m) => {
    const k = (12 * 60 + m) % 1440;
    return String(Math.floor(k / 60)).padStart(2, '0') + ':' + String(k % 60).padStart(2, '0');
  };
  for (let i = 0; i < 520; i++) {
    const r = w.k.boekingZet(w.fid, w.eid, { dag: w.dag.id, podium: w.alpha.id,
      artiest: 'Act ' + i, van: klok(i), tot: klok(i + 1) });
    assert.equal(r.ok, true, 'set ' + i + ': ' + (r.error || ''));
  }
  const r = w.lijn();
  assert.equal(r.gebeurtenissen.length, 500);
  assert.equal(r.aantal, 520);
  assert.equal(r.meer, 20);
});

/* ============================================================================
   DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2)

   Vijf mutaties, vier raak. De afgeslagene is hier de interessantste.

    T1. De scans per PAS groeperen in plaats van per poort en per kwartier.
        -> toetsen 1 en 6 zakten. Dit is de mutatie die van een tijdlijn een
        dossier maakt, en het is precies de vorm waarin dat gebeurt: niemand zet
        er een codenaam in, iemand voegt een sleutel toe "zodat je kunt zien wie
        er nog binnen is".

    T2. De pas mee de regel in nemen. AFGESLAGEN -- en dat is hier de goede
        uitkomst, niet een gat. De aggregatie ZELF is de wacht: de regels worden
        opgebouwd uit een geteld bakje met alleen een poort, een richting en een
        aantal, dus er is geen enkele losse bewerking die een pas naar buiten
        laat lekken. Om hem eruit te krijgen moet je eerst T1 doen, en die zakt.
        Toets 2 blijft staan als struikeldraad voor het veld dat er later bij
        komt: hij leest de hele uitkomst als tekst en niet een lijstje velden.

    T3. Per minuut indelen in plaats van per kwartier. Sloeg eerst af: alle
        scans in een toets krijgen hun stempel van de serverklok en vallen dus
        binnen dezelfde minuut, waardoor beide indelingen een regel opleverden.
        Toets 1b staat er nu, met stempels die met de hand uit elkaar zijn gezet.
        Wat die toets beschermt is leesbaarheid en niet privacy: per minuut is
        het nog steeds een telling, maar bij 40.000 bezoekers is het een muur
        waar niemand meer iets in terugvindt -- en een reconstructie die niemand
        kan lezen, is geen reconstructie.

    T4. De bron weglaten bij de scans. -> toets 4 zakte. Zonder bron is een
        regel niet na te trekken, en dan suggereert de tijdlijn een garantie
        ("wordt nooit herschreven") die per bron verschilt.

    T5. Oudste bovenaan. -> toets 5.
   ========================================================================== */
