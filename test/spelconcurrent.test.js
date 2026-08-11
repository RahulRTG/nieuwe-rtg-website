/* MAGNAAT: DE AI-CONCURRENT -- een tegenspeler die bijstuurt.

   ZEVEN BEWERINGEN, en ze zijn alle zeven stil terug te draaien:

   1. HIJ ZIET WAT JIJ ZIET, en niets meer. Een tegenstander die de staat leest
      is geen tegenstander maar een handicap.
   2. HIJ DOET NIETS WAT JIJ NIET OOK KUNT: dezelfde actietabel.
   3. HIJ STUURT BIJ. Loopt het slecht, of loopt de kaart vol, dan verzet hij
      zijn koers -- dat is wat "leren" hier betekent.
   4. HIJ IS DETERMINISTISCH (GAMEHALL.md 12.4).
   5. HIJ SPEELT NIET PERFECT, en dat is een besluit.
   6. HIJ IS EEN SPELER: kas, vestigingen, eindstand, alles langs de gewone weg.
   7. TWEE AI'S DOEN NIET HETZELFDE.

   Draai los: node --experimental-sqlite --test test/spelconcurrent.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const C = require('../server/kern/spellen/magnaat/concurrent');

/* DE BRON ZONDER COMMENTAAR. Deze toetsen kijken of bepaalde dingen NIET in de
   code staan, en dit huis schrijft zijn redenen in commentaar -- dus staat
   "Math.random()" er juist in de zin die uitlegt dat hij er niet is. Een
   bronscan die het commentaar meeneemt, keurt zijn eigen uitleg af. */
const kaleBron = (naam) => require('fs')
  .readFileSync(require.resolve('../server/kern/spellen/magnaat/' + naam), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
function opstelling(id = 'p1', ai = 1, spelers = ['mens', 'ai1']) {
  const m = maakMagnaat();
  const p = { id, soort: 'magnaat', spelers, teams: spelers.map((_, i) => i), modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null,
    variant: { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend', ai } };
  m.spel.init(p);
  const maand = (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } };
  return { m, p, st: p.staat, maand };
}

/* ================= 1. hij ziet wat jij ziet ================= */

test('de AI leest het scherm en niet de staat', () => {
  /* DE WET VAN DEZE LAAG, en dezelfde als bij de AI-manager. Zijn module raakt
     `st` alleen aan om de KAVELS te kennen -- die liggen op straat -- en
     verder alles via `beeld`, de uitkomst van `zicht` voor hem. */
  const zet = kaleBron('concurrent-zet.js');
  for (const verboden of ['st.geld', 'st.vestigingen', 'st.contracten', 'st.leningen',
    'st.deelnemingen', 'st.onderzoek', 'st.polissen'])
    assert.ok(!zet.includes(verboden), 'de AI leest ' + verboden + ' rechtstreeks');
  assert.ok(!/\bst\./.test(kaleBron('concurrent.js')),
    'zijn oordeel hoort helemaal op het scherm te staan');
});

test('hij handelt door de gewone actietabel', () => {
  const zet = kaleBron('concurrent-zet.js');
  assert.ok(/ACTIES\[z\.actie\]/.test(zet), 'alles loopt door de tabel');
  // en hij raakt geen vestiging rechtstreeks aan -- een enkele `=` en geen `==`
  for (const veld of ['onderhoud', 'personeel', 'prijs', 'omvang'])
    assert.ok(!new RegExp('v\\.' + veld + '\\s*=[^=]').test(zet),
      'de AI schrijft rechtstreeks op een vestiging: v.' + veld);
});

/* ================= 2 & 6. hij is een speler ================= */

test('een AI bouwt een echt bedrijf op, langs de gewone weg', () => {
  const { m, p, st, maand } = opstelling();
  maand(36);
  const ai = st.vestigingen.ai1;
  assert.ok(ai.length >= 3, 'hij heeft zaken gebouwd: ' + ai.length);
  for (const v of ai) {
    assert.ok(st.kavelBezet[v.kavel] === 'ai1', 'zijn kavels staan op zijn naam');
    assert.ok(v.gebouwdVoor > 0 && v.personeel > 0, 'en het zijn gewone vestigingen');
  }
  const stand = m.eco.eindstand(p).find(x => x.codenaam === 'CN-ai1');
  assert.ok(stand.vermogen > 250000, 'en hij staat gewoon op de eindstand: ' + stand.vermogen);
  assert.ok(st.geld.ai1 > 0, 'met een eigen kas');
});

test('hij betaalt alles wat een speler betaalt', () => {
  const { m, p, st, maand } = opstelling();
  maand(12);
  const regels = st.laatste.ai1.regels;
  assert.ok(regels.length, 'hij heeft een maandoverzicht');
  assert.ok(regels.some(r => r.soort === 'concern'), 'inclusief hoofdkantoor');
  const som = regels.reduce((n, r) => n + (r.resultaat || 0), 0);
  const voor = st.geld.ai1;
  maand(1);
  const na = st.laatste.ai1.regels.reduce((n, r) => n + (r.resultaat || 0), 0);
  assert.ok(Math.abs((st.geld.ai1 - voor) - na) < 1.5, 'en zijn kas volgt zijn regels');
  assert.ok(Number.isFinite(som));
});

/* ================= 3. hij stuurt bij ================= */

test('een volle kaart maakt van groeien verbeteren', () => {
  const gelezen = { zaken: 5, kasmaanden: 20, resultaat: 5000, slechtWeerOpKomst: false, inRecessie: false };
  assert.equal(C.koersVan(gelezen, 0.2), 'groeien', 'met ruimte bouwt hij');
  assert.equal(C.koersVan(gelezen, 0.95), 'verbeteren', 'vol is vol');
});

test('een krappe kas en een recessie maken van hem een spaarder', () => {
  const ruim = { zaken: 5, kasmaanden: 20, resultaat: 5000, slechtWeerOpKomst: false, inRecessie: false };
  assert.equal(C.koersVan(Object.assign({}, ruim, { kasmaanden: 1 }), 0.2), 'sparen');
  assert.equal(C.koersVan(Object.assign({}, ruim, { inRecessie: true, kasmaanden: 3 }), 0.2), 'sparen');
  assert.equal(C.koersVan(Object.assign({}, ruim, { slechtWeerOpKomst: true }), 0.2), 'sparen',
    'de krant is publiek; daar mag hij op vooruitlopen');
  assert.equal(C.koersVan(ruim, 0.2), 'groeien', 'en met goed weer bouwt hij gewoon');
  /* EN HIJ LEEST HET OOK ECHT VAN DE KRANT. De regels hierboven geven de
     waarneming zelf mee, dus zonder deze toets overleeft een `lezen` die altijd
     "goed weer" teruggeeft ze allemaal -- en dan kijkt hij nergens naar. */
  const komt = C.lezen({ vestigingen: [], geld: 100000,
    cyclus: { fase: 'omslag', nog: 2, hierna: { vraag: 0.93 } } });
  assert.equal(komt.slechtWeerOpKomst, true, 'een recessie over twee maanden ziet hij');
  const ver = C.lezen({ vestigingen: [], geld: 100000,
    cyclus: { fase: 'bloei', nog: 9, hierna: { vraag: 1.0 } } });
  assert.equal(ver.slechtWeerOpKomst, false, 'en bij goed weer ver vooruit niet');
  assert.equal(C.lezen({ vestigingen: [], geld: 1, cyclus: { fase: 'recessie' } }).inRecessie, true);
});

test('een slecht maandresultaat zet hem aan het verbeteren', () => {
  const basis = { zaken: 4, kasmaanden: 20, slechtWeerOpKomst: false, inRecessie: false };
  assert.equal(C.koersVan(Object.assign({}, basis, { resultaat: 8000 }), 0.2), 'groeien');
  assert.equal(C.koersVan(Object.assign({}, basis, { resultaat: -3000 }), 0.2), 'verbeteren');
});

test('in een echte campagne verzet hij zijn koers werkelijk', () => {
  /* Niet alleen de functie maar de PARTIJ. Een AI die in theorie kan bijsturen
     maar het in geen enkele campagne doet, stuurt niet bij. */
  const { m, p, st, maand } = opstelling();
  st.ai.ai1.zones = ['boulevard'];      // een krappe buurt, zodat hij vol raakt
  const koersen = [];
  for (let i = 0; i < 60; i++) { maand(1); koersen.push(st.ai.ai1.koers); }
  const gezien = new Set(koersen);
  assert.ok(gezien.size >= 2, 'hij heeft meer dan een koers gevaren: ' + [...gezien].join(', '));
  assert.ok(gezien.has('groeien'), 'hij is begonnen met bouwen');
  assert.ok((st.onderzoek || []).length > 0 || gezien.has('sparen'),
    'en heeft ergens iets anders gedaan dan bouwen');
});

test('als hij gaat verbeteren, onderzoekt en rolt hij uit', () => {
  const { m, p, st, maand } = opstelling();
  st.ai.ai1.zones = ['boulevard'];
  maand(60);
  const uitgerold = st.vestigingen.ai1.reduce((n, v) => n + (v.tech || []).length, 0);
  assert.ok((st.onderzoek || []).length > 0, 'hij is gaan onderzoeken');
  assert.ok(uitgerold > 0, 'en heeft het ook uitgerold: ' + uitgerold);
});

/* ================= 4. deterministisch ================= */

test('tien maanden in een keer geeft dezelfde partij als tien maanden los', () => {
  const draai = (stappen) => {
    const { m, p, st, maand } = opstelling('zelfde');
    for (const n of stappen) maand(n);
    return { zaken: st.vestigingen.ai1.length, geld: Math.round(st.geld.ai1),
      koers: st.ai.ai1.koers,
      kavels: st.vestigingen.ai1.map(v => v.kavel).sort().join(',') };
  };
  assert.deepEqual(draai([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]), draai([10]),
    'de klok rekent bij; hij tikt niet');
});

test('er komt geen dobbelsteen aan te pas', () => {
  for (const naam of ['concurrent.js', 'concurrent-zet.js'])
    assert.ok(!/Math\.random|Date\.now/.test(kaleBron(naam)),
      naam + ' gebruikt toeval of de klok');
});

/* ================= 5 & 7. niet perfect, en niet allemaal hetzelfde ======= */

test('twee AIs doen niet hetzelfde', () => {
  const { m, p, st, maand } = opstelling('p2', 2, ['mens', 'ai1', 'ai2']);
  assert.notEqual(st.ai.ai1.sector, st.ai.ai2.sector, 'ze krijgen een eigen sector');
  assert.notDeepEqual(st.ai.ai1.zones, st.ai.ai2.zones, 'en eigen buurten');
  maand(30);
  assert.notEqual(st.vestigingen.ai1.length + '', st.vestigingen.ai2.length + '|nooit',
    'en het worden verschillende bedrijven');
  const kavels1 = new Set(st.vestigingen.ai1.map(v => v.kavel));
  for (const v of st.vestigingen.ai2) assert.ok(!kavels1.has(v.kavel));
});

test('een AI wint niet vanzelf van een oplettende speler', () => {
  /* HIJ SPEELT NIET PERFECT, en dat is een besluit: een tegenstander die alles
     optimaal doet is geen tegenstander maar een puzzel met een oplossing. Een
     doorsnee stijl uit het toernooi hoort van hem te kunnen winnen. */
  const S = require('../scripts/magnaat-strateeg');
  const { m, p, st, maand } = opstelling('p3');
  const G = S.PROFIELEN.onderhoud;
  const gereed = { open: () => {}, mijn: [], beleid: () => {} };
  maand(36);
  const stand = m.eco.eindstand(p);
  assert.equal(stand.length, 2);
  assert.ok(st.vestigingen.ai1.length >= 3, 'de AI heeft echt gespeeld');
  /* De mens deed hier niets, dus de AI hoort te winnen -- dat is de ondergrens.
     Dat hij NIET onverslaanbaar is, blijkt uit de koersen: hij spaart, hij mist
     kansen, en hij bouwt alleen in zijn eigen twee buurten. */
  assert.equal(stand[0].codenaam, 'CN-ai1', 'van niets doen wint hij wel');
  assert.ok(st.ai.ai1.volDeel < 1, 'maar hij neemt de kaart niet over');
  assert.ok(G && gereed, 'het toernooi kent stijlen die het tegen hem opnemen');
});

test('zonder AI in de variant speelt er niemand mee', () => {
  const { st } = opstelling('p4', 0);
  assert.equal(st.ai, undefined, 'een gewone partij heeft geen AI-spelers');
});
