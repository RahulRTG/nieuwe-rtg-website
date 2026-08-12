/* DE STAD ONTHOUDT -- fase C: de Living World en de levende kaart.

   Uit hoofdstuk 10 en 11 van de visie: jullie bouwden een bibliotheek, de wijk
   werd veiliger, en "nieuwe spelers weten niet eens meer dat het ooit een leeg
   terrein was". Acht beweringen, alle acht stil terug te draaien:

   1. WAT EEN CAMPAGNE BOUWT, STAAT ER DE VOLGENDE KEER NOG.
   2. ER STAAT GEEN PERSOON IN -- en daarom valt hij buiten de 18+-poort.
   3. NIEMAND BEZIT HEM. De bouwer erft precies hetzelfde als een vreemde.
   4. EEN GEERFDE STAD GEEFT GEEN ECONOMISCHE VOORSPRONG.
   5. HET SLIJT, op de klok van de STAD en niet op de kalender.
   6. ER IS EEN DAK per soort, anders is de stad een sneeuwbal.
   7. HET WORDT EEN KEER OPGESCHREVEN.
   8. EEN ANDER SPEL EN EEN STADLOZE PARTIJ RAKEN HEM NIET.

   Draai los: node --experimental-sqlite --test test/spelstad.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const maakStad = require('../server/kern/spellen/stadsgeheugen');
const { SLIJTAGE_POTJES, MAX_PER_SOORT } = maakStad;

const opstelling = () => {
  const db = { data: {} };
  return { db, G: maakStad({ db, save() {} }) };
};
const campagne = (n, projecten, stad) => ({ id: 'p' + n, soort: 'magnaat', status: 'klaar',
  variant: { stad: stad || 'IJmuiden' },
  staat: { foundation: { gedaan: projecten } } });

/* ================= 1 en 2. wat blijft er staan ================= */

test('wat een campagne bouwt, staat er de volgende keer nog', () => {
  const { G } = opstelling();
  assert.deepEqual(G.voor('IJmuiden').gedaan, [], 'een lege stad is leeg');
  G.onthoud(campagne(1, [{ id: 'bibliotheek', zone: 'centrum' }, { id: 'park', zone: 'boulevard' }]));
  const erf = G.voor('IJmuiden');
  assert.equal(erf.gedaan.length, 2);
  assert.deepEqual(erf.gedaan.map(g => g.id).sort(), ['bibliotheek', 'park']);
  assert.equal(erf.potjes, 1);
});

test('er staat geen persoon in, en dat is de reden dat hij buiten de 18+-poort valt', () => {
  /* ./grens.js noemt drie uitzonderingen met hun reden, en de derde past hier
     woordelijk: de dagtelling valt erbuiten omdat "daar geen persoon in staat".
     Dus wordt dat hier gemeten en niet aangenomen -- er gaat een potje in met
     spelers, een winnaar en vermogens, en er komt een stad uit zonder mensen. */
  const { db, G } = opstelling();
  const p = campagne(1, [{ id: 'bibliotheek', zone: 'centrum' }]);
  p.spelers = ['anna', 'boris'];
  p.winnaar = 'CN-anna';
  p.staat.geld = { anna: 9000000, boris: 12 };
  p.staat.vestigingen = { anna: [{ id: 'v1', naam: 'Zeezicht' }] };
  G.onthoud(p);
  const opslag = JSON.stringify(db.data.stadsgeheugen);
  for (const woord of ['anna', 'boris', 'CN-', '9000000', 'Zeezicht', 'winnaar', 'vermogen'])
    assert.ok(!opslag.includes(woord), 'de stad draagt ' + woord + ': ' + opslag);
  assert.ok(opslag.includes('bibliotheek') && opslag.includes('centrum'));
});

/* ================= 3 en 4. niemand bezit hem ================= */

test('de bouwer erft precies hetzelfde als een vreemde', () => {
  /* DE REGEL WAAR DEZE HELE LAAG OP STAAT OF VALT. Een stad is van niemand, dus
     kan hij niemand rijker maken dan een ander. Zou het anders zijn, dan is een
     oude speler structureel in het voordeel en is elke eerste campagne een
     verplichte inhaalronde.

     De toets: het geheugen kent geen speler, dus is er geen manier waarop
     `voor()` voor twee mensen iets anders kan teruggeven. Dat wordt hier
     gesteld op de VORM -- de functie neemt alleen een stad. */
  const { G } = opstelling();
  G.onthoud(campagne(1, [{ id: 'bibliotheek', zone: 'centrum' }]));
  assert.equal(G.voor.length, 1, 'voor() kent maar EEN argument: de stad');
  const a = JSON.stringify(G.voor('IJmuiden'));
  const b = JSON.stringify(G.voor('IJmuiden'));
  assert.equal(a, b);
  /* De bronscan strijkt commentaar EN stringliteralen weg. Zonder dat tweede
     zakt hij op zijn eigen uitlegzin ("door spelers gebouwd en van niemand"),
     en dat is dezelfde valstrik als eerder in deze map: een toets die zijn eigen
     tekst leest, meet zijn eigen tekst. */
  const kaleBron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/stadsgeheugen'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
  assert.ok(!/codenaam|speler|winnaar/i.test(kaleBron),
    'de laag leest een speler uit het potje: ' + (kaleBron.match(/.{0,40}(codenaam|speler|winnaar).{0,40}/i) || [])[0]);
});

test('een geerfde stad maakt je eigen eerste project niet goedkoper', () => {
  /* Anders erft een oude stad een voorsprong langs de achterdeur: je begint met
     een halfvolle Foundation-pot. `volgend` hoort op nul te staan, hoeveel er
     ook geerfd is. */
  const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
    save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {} });
  const m = maakMagnaat();
  const p = { id: 'x', soort: 'magnaat', spelers: ['a', 'b'], teams: [0, 1], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null,
    variant: { vorm: 'economie', stad: 'IJmuiden', duur: 'quick' },
    stadsgeheugen: { gedaan: [{ id: 'bibliotheek', zone: 'centrum' },
      { id: 'park', zone: 'boulevard' }], potjes: 7 } };
  m.spel.init(p);
  assert.equal(p.staat.foundation.gedaan.length, 2, 'de stad staat er');
  assert.ok(p.staat.foundation.gedaan.every(g => g.geerfd), 'en is als geerfd gemerkt');
  assert.equal(p.staat.foundation.volgend, 0, 'maar het volgende project begint vooraan');
  assert.equal(p.staat.foundation.lokaal, 0, 'en de pot is leeg');
  assert.equal(p.staat.stadsgeschiedenis.potjes, 7);
  // zonder geheugen begint een campagne zoals altijd
  const q = Object.assign({}, p, { id: 'y', stadsgeheugen: undefined, staat: undefined });
  m.spel.init(q);
  assert.equal(q.staat.foundation.gedaan.length, 0);
});

/* ================= 5 en 6. het slijt, en er is een dak ================= */

test('het slijt op de klok van de STAD en niet op de kalender', () => {
  /* Anders verliest een stad zijn geheugen doordat er even niemand speelde, en
     dat is precies de afwezigheidsgrens uit VERHAAL.md. */
  const { G } = opstelling();
  G.onthoud(campagne(1, [{ id: 'bibliotheek', zone: 'centrum' }]));
  assert.equal(G.voor('IJmuiden').gedaan.length, 1);
  // veel campagnes later is hij weggezakt
  for (let i = 2; i < SLIJTAGE_POTJES + 3; i++) G.onthoud(campagne(i, []));
  assert.equal(G.voor('IJmuiden').gedaan.length, 0, 'na veertig campagnes is hij weg');
  // en iets wat er net bij kwam staat er nog voluit
  G.onthoud(campagne(999, [{ id: 'park', zone: 'boulevard' }]));
  const erf = G.voor('IJmuiden');
  assert.deepEqual(erf.gedaan.map(g => g.id), ['park']);
});

test('van een soort blijft er hoogstens een handvol staan', () => {
  /* Zonder dak stapelt dezelfde bibliotheek zich twintig campagnes lang op tot
     de zone niet meer te herkennen is -- dan is de stad geen geheugen maar een
     sneeuwbal. */
  const { G } = opstelling();
  for (let i = 1; i <= 8; i++) G.onthoud(campagne(i, [{ id: 'bibliotheek', zone: 'centrum' }]));
  const erf = G.voor('IJmuiden');
  assert.equal(erf.gedaan.filter(g => g.id === 'bibliotheek').length, MAX_PER_SOORT);
  assert.equal(erf.potjes, 8, 'maar er is wel degelijk acht keer gespeeld');
});

/* ================= 7 en 8. de randen ================= */

test('een afgelopen campagne wordt EEN keer opgeschreven', () => {
  const { G } = opstelling();
  const p = campagne(1, [{ id: 'bibliotheek', zone: 'centrum' }]);
  G.onthoud(p); G.onthoud(p); G.onthoud(p);
  assert.equal(G.voor('IJmuiden').gedaan.length, 1);
  assert.equal(G.voor('IJmuiden').potjes, 1);
});

test('een ander spel, een lopende partij en een stadloze variant raken hem niet', () => {
  const { db, G } = opstelling();
  G.onthoud(Object.assign(campagne(1, [{ id: 'x', zone: 'z' }]), { soort: 'schaak' }));
  G.onthoud(Object.assign(campagne(2, [{ id: 'x', zone: 'z' }]), { status: 'bezig' }));
  G.onthoud(Object.assign(campagne(3, [{ id: 'x', zone: 'z' }]), { variant: {} }));
  assert.deepEqual(db.data.stadsgeheugen || {}, {}, 'er is niets bijgeschreven');
});

test('twee steden onthouden elk hun eigen geschiedenis', () => {
  const { G } = opstelling();
  G.onthoud(campagne(1, [{ id: 'bibliotheek', zone: 'centrum' }], 'IJmuiden'));
  G.onthoud(campagne(2, [{ id: 'park', zone: 'kade' }], 'Haarlem'));
  assert.deepEqual(G.voor('IJmuiden').gedaan.map(g => g.id), ['bibliotheek']);
  assert.deepEqual(G.voor('Haarlem').gedaan.map(g => g.id), ['park']);
});

test('het beeld zegt wat er staat, en dat het van niemand is', () => {
  const { G } = opstelling();
  G.onthoud(campagne(1, [{ id: 'bibliotheek', zone: 'centrum' }]));
  const b = G.beeld('IJmuiden');
  assert.equal(b.potjes, 1);
  assert.ok(b.perZone.centrum.length === 1);
  assert.match(b.uitleg, /van niemand/);
  assert.match(b.uitleg, /dezelfde kaart/);
  // een stad waar nooit gespeeld is, bestaat gewoon en is leeg
  assert.equal(G.beeld('Nergens').potjes, 0);
});

test('een stad vergeten is een besluit en geen opruiming', () => {
  const { G } = opstelling();
  G.onthoud(campagne(1, [{ id: 'bibliotheek', zone: 'centrum' }]));
  assert.equal(G.vergeet('IJmuiden').weg, true);
  assert.deepEqual(G.voor('IJmuiden').gedaan, []);
  assert.equal(G.vergeet('IJmuiden').weg, false);
});

/* ================= VAKANTIEMODUS (fase C) ================= */

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {} });
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

function tafel() {
  const m = maakMagnaat();
  const p = { id: 'v1', soort: 'magnaat', spelers: ['a', 'b'], teams: [0, 1], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null,
    variant: { vorm: 'economie', stad: 'IJmuiden', duur: 'quick' } };
  m.spel.init(p);
  for (const h of p.spelers) p.staat.geld[h] = 2000000;
  m.eco.zet(p, 'a', { actie: 'open',
    kavel: kaart('ijmuiden').kavels.filter(k => k.zone === 'boulevard')[0].id,
    sector: 'horeca', omvang: 30 });
  return { m, p, st: p.staat };
}

test('op vakantie gaan zet je manager aan en zegt het aan tafel', () => {
  /* WAAROM HIJ BESTAAT terwijl de manager er al was: "ik ben weg" is iets
     ANDERS dan "mijn manager draait". Wie een contract aanbiedt aan iemand die
     weg is, hoort te weten dat er een regelboek antwoordt en geen mens --
     anders is de manager een verborgen speler, en dat verbiedt beheer.js in
     zijn vierde wet. */
  const { m, p, st } = tafel();
  assert.equal(m.eco.zicht(p, st, 'b').anderen[0].vakantie, false, 'niemand is weg');
  const r = m.eco.zet(p, 'a', { actie: 'vakantie-aan' });
  assert.ok(r.ok);
  assert.equal(r.aan, true, 'de manager gaat vanzelf aan');
  assert.equal(m.eco.zicht(p, st, 'a').beheer.vakantie, true);
  assert.equal(m.eco.zicht(p, st, 'b').anderen[0].vakantie, true, 'en de tafel ziet het');
});

test('dat je een manager gebruikt blijft prive; dat je weg bent niet', () => {
  /* Het verschil is de hele grens. Een manager is een KEUZE en gaat de tafel
     niets aan; afwezigheid is een FEIT waar een tegenpartij op mag rekenen. */
  const { m, p, st } = tafel();
  m.eco.zet(p, 'a', { actie: 'beheer-aan' });
  const vanB = m.eco.zicht(p, st, 'b');
  assert.equal(vanB.anderen[0].vakantie, false, 'alleen de manager: dat blijft van hem');
  assert.ok(!JSON.stringify(vanB.anderen).includes('beheer'), 'en zijn beheer staat er niet');
});

test('weg zijn kost niets extra', () => {
  /* De afwezigheidsgrens uit VERHAAL.md, letterlijk: je betaalt het gewone
     beheertarief omdat je een manager gebruikt -- geen vakantietoeslag, geen
     boete, geen vervallende voortgang. */
  const a = tafel();
  a.m.eco.zet(a.p, 'a', { actie: 'beheer-aan' });
  const metManager = a.m.eco.zicht(a.p, a.st, 'a').beheer.kostenPerMaand;
  const b = tafel();
  b.m.eco.zet(b.p, 'a', { actie: 'vakantie-aan' });
  assert.equal(b.m.eco.zicht(b.p, b.st, 'a').beheer.kostenPerMaand, metManager,
    'op vakantie is precies even duur als een manager gebruiken');
  // en na twaalf maanden weg is de kas hetzelfde als met alleen een manager
  const draai = (w, n) => { for (let i = 0; i < n; i++) { w.st.gerekendTot -= w.st.maandMs; w.m.eco.bijrekenen(w.p); } };
  draai(a, 12); draai(b, 12);
  assert.ok(Math.abs(a.st.geld.a - b.st.geld.a) < 2,
    'twaalf maanden weg kost hetzelfde als twaalf maanden met een manager: '
    + Math.round(a.st.geld.a) + ' tegen ' + Math.round(b.st.geld.a));
});

test('terugkomen laat je bedrijf niet onbeheerd achter', () => {
  /* De manager stilzetten bij terugkomst zou een verrassing zijn en geen
     dienst: je komt terug en je zaken staan ineens stil. */
  const { m, p, st } = tafel();
  m.eco.zet(p, 'a', { actie: 'vakantie-aan' });
  const r = m.eco.zet(p, 'a', { actie: 'vakantie-uit' });
  assert.ok(r.ok);
  assert.equal(r.vakantie, false);
  assert.equal(r.aan, true, 'de manager draait door tot je hem zelf uitzet');
  assert.equal(m.eco.zicht(p, st, 'b').anderen[0].vakantie, false);
  assert.equal(m.eco.zet(p, 'a', { actie: 'vakantie-uit' }).status, 409);
});

test('op vakantie gaan mag buiten je beurt', () => {
  /* Wie halverwege een partij weg moet, hoort dat op dat moment te kunnen
     zeggen en niet pas als hij aan de beurt is. */
  const spel = maakMagnaat().spel;
  for (const naam of ['vakantie-aan', 'vakantie-uit'])
    assert.ok(spel.buitenBeurt.includes(naam), naam);
});
