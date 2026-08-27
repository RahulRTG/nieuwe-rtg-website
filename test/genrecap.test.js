/* DE GENRE-CAP: het woord dat hernoemd is, en de lijst waar hij naar wijst.

   OS.md par. 4.2 vond een botsing: "Capabilities" stond in het lagenmodel van
   PLATFORM.md par. 2 EN in dat van RTG Universal OS, en het betekende er niet
   hetzelfde. Laag 4 heet daarom sinds 27 augustus 2026 genre-cap. Dit bestand
   bewaakt twee dingen die zonder handhaver binnen een jaar terugdraaien:

     1. DE NAAM. Twee lagenmodellen mogen geen laagnaam delen, en een model dat
        in een ander document geciteerd wordt, moet gelijk zijn aan zijn bron.
        scripts/lagen.js leidt dat af uit de documenten zelf -- geen register
        naast de tekst, want dat verhoudt zich tot de tekst zoals de tekst zich
        tot de code verhoudt, en dan zijn er dríe plekken.

     2. DE LIJST. Het hernoemen bracht een ongedekte dubbeling aan het licht:
        FUNCTIES.md noemde "40 capabilities" en somde ze op, met de hand, naast
        het genre-register dat de waarheid houdt. Geen enkele toets keek ernaar.
        Dat is LAT-regel 4, en het was niet onschuldig -- PLATFORM.md noemde
        `rooms` als voorbeeld-cap, en die cap BESTAAT NIET. Geen van de 73
        genres draagt hem en kern/werkvormen.js maakt hem nergens aan.

   Die tweede vondst kostte geld. kern/fiscaal/tarief.js besliste op
   `caps.includes('rooms')` of een verkoop 'logies' is; die tak was dood, dus
   een verblijfszaak rekende te veel btw -- een appartement in Nederland 21% in
   plaats van 9%, een hotel in Duitsland 19% in plaats van 7%. Die reparatie en
   haar toetsen staan in test/kern-fiscaal.test.js, waar de btw hoort; hier
   staat alleen de toets die hem heeft gevonden (toets 8) en de tegenproef die
   hem terug zou vinden (toets 9).

   DE TEGENPROEVEN staan er omdat een meter die altijd "geen botsing" zegt hier
   groen zou blijven, en dan bewijst dit bestand dat een kapotte meter goed
   gebouwd is (LAT-regel 9).

   Draai los: node --test test/genrecap.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../scripts/lagen');
const genres = require('../server/seed/genres-lijst');
const werkvormen = require('../server/kern/werkvormen');

const WORTEL = path.join(__dirname, '..');
const lees = (b) => fs.readFileSync(path.join(WORTEL, b), 'utf8');

/* De caps die de 73 genres van huis uit dragen. Dit is de lijst die FUNCTIES.md
   opsomt, en hij wordt hier AFGELEID en niet overgetypt. */
function registerCaps() {
  const uit = new Set();
  for (const def of Object.values(genres)) for (const c of def.caps || []) uit.add(c);
  return [...uit].sort();
}

/* Alles wat een zaak ooit kan krijgen: de caps van haar genre plus die van elke
   werkvorm die zij kan aanzetten. Afgeleid door de ECHTE capsVan te draaien met
   een zaak die alle inhoudssignalen aan heeft staan -- zo kan deze lijst niet
   uiteenlopen met de functie die hem in productie bepaalt. */
function alleMogelijkeCaps() {
  const db = werkvormen.haakAan({ data: { supplierTypes: genres, thuisHuizen: {} } });
  const uit = new Set();
  for (const type of Object.keys(genres)) {
    const zaak = {
      code: 'PROEF', type, settings: {},
      rooms: [{}], menu: [{ name: 'x' }], fleet: [{}], ovLijnen: [{}], activiteiten: [{}],
      collecties: [{}], staff: [{}, {}], bezorg: { aan: true }, zzp: true
    };
    for (const c of db.capsVan(zaak)) uit.add(c);
  }
  return uit;
}

/* De backtick-namen uit een stukje tekst. Zo leest deze toets de voorbeelden
   die de documenten geven, zonder dat er een tweede lijst ontstaat. */
const genoemd = (tekst) => [...String(tekst).matchAll(/`([a-z][a-z0-9]*)`/g)].map(m => m[1]);


test('1. de meter vindt de lagenmodellen die er werkelijk staan', () => {
  /* De tegenproef op alles wat hierna komt: als het lezen stukloopt, vindt hij
     nul modellen en zegt "geen botsing" -- de gevaarlijkste groene uitslag die
     er is. Daarom staat hier hoeveel er zijn en hoe groot ze zijn. */
  const uit = L.meet(WORTEL);
  assert.ok(uit.aantalModellen >= 3, 'minstens drie lagenmodellen, gevonden: ' + uit.aantalModellen);
  const platform = uit.modellen['PLATFORM.md par. 2'];
  assert.ok(platform, 'het model van PLATFORM.md par. 2 is gevonden');
  assert.equal(platform.length, 7, 'PLATFORM.md par. 2 heeft zeven lagen');
  assert.ok(platform.includes('genre-caps'), 'laag 4 heet genre-caps');
  assert.ok(!platform.includes('capabilities'), 'en niet meer capabilities');
});

test('2. geen enkele laagnaam staat in twee lagenmodellen', () => {
  const uit = L.meet(WORTEL);
  assert.deepEqual(uit.botsingen, [],
    'botsende laagnamen: ' + uit.botsingen.map(b => b.naam + ' (' + b.modellen.join(' + ') + ')').join(', '));
});

test('3. een geciteerd lagenmodel is gelijk aan zijn bron', () => {
  /* OS.md par. 4.2 zet de lagen van PLATFORM.md par. 2 over in zijn eigen
     tabel. Dat is dezelfde waarheid op twee plekken; deze toets is de enige
     reden dat dat mag. Hij sloeg tijdens het hernoemen meteen aan. */
  const uit = L.meet(WORTEL);
  assert.deepEqual(uit.afwijkingen, [],
    'citaties die achterlopen: ' + uit.afwijkingen.map(a => a.waar + ' rij ' + a.merk).join(', '));
});

test('4. tegenproef: twee modellen die WEL een naam delen, worden gemeld', () => {
  const uit = L.analyse({
    modellen: {
      'A.md par. 1': ['core', 'capabilities', 'runtime'],
      'B.md par. 1': ['experiences', 'capabilities', 'journeys']
    },
    citaten: []
  });
  assert.equal(uit.botsingen.length, 1, 'precies een botsing');
  assert.equal(uit.botsingen[0].naam, 'capabilities');
  assert.deepEqual(uit.botsingen[0].modellen, ['A.md par. 1', 'B.md par. 1']);
});

test('5. tegenproef: een citatie die afwijkt van zijn bron, wordt gemeld', () => {
  const modellen = { 'A.md par. 2': ['core', 'genre-caps', 'runtime'] };
  const gelijk = L.analyse({ modellen, citaten: [
    { merk: 'A', bron: 'a.md par. 2', as: 'x', lagen: ['core', 'genre-caps', 'runtime'], waar: 'B.md' }] });
  assert.deepEqual(gelijk.afwijkingen, [], 'een kloppende citatie geeft geen melding');
  assert.equal(gelijk.aantalModellen, 1, 'en voegt geen tweede model toe');

  const scheef = L.analyse({ modellen, citaten: [
    { merk: 'A', bron: 'a.md par. 2', as: 'x', lagen: ['core', 'capabilities', 'runtime'], waar: 'B.md' }] });
  assert.equal(scheef.afwijkingen.length, 1, 'een achterlopende citatie wel');
  assert.equal(scheef.afwijkingen[0].bron, 'A.md par. 2');
});

test('6. de meter leest beide schrijfwijzen van een laagrij', () => {
  /* PLATFORM.md par. 0b zet zijn laagnamen vet, par. 2 niet. Een meter die er
     maar een kent, mist een heel model en meldt daarna vrolijk "geen botsing".

     De kastlijn staat hier als codepunt en niet als teken: keuringsregel 3
     verbiedt hem in de bron van dit huis, terwijl de markdown die de meter leest
     hem wel gebruikt. Met twee koppeltekens zou deze toets groen blijven op een
     meter die in de echte documenten niets meer vindt -- en dat is precies de
     toets die niets bewijst. */
  const K = String.fromCharCode(0x2014);
  assert.deepEqual(L.lagenUitTabel('| 4 ' + K + ' Genre-caps | x | y |'),
    [{ nummer: 4, naam: 'genre-caps' }]);
  assert.deepEqual(L.lagenUitTabel('| **1 ' + K + ' Specialistische apps** | x | y |'),
    [{ nummer: 1, naam: 'specialistische apps' }]);
  assert.deepEqual(L.lagenUitTabel('| 4 -- Genre-caps | x | y |'), [],
    'twee koppeltekens zijn geen kastlijn');
  assert.deepEqual(L.lagenUitTabel('| geen laagrij | x |'), []);
});

test('7. FUNCTIES.md somt precies de caps op die de genres dragen', () => {
  /* De lijst stond met de hand naast het register en niets keek ernaar. Nu
     zakt deze toets zodra iemand een cap aan een genre hangt zonder de tekst
     bij te werken -- of andersom. */
  const echt = registerCaps();
  const tekst = lees('FUNCTIES.md');
  const kop = new RegExp('De (\\d+) genre-caps waar de apps naar kijken');
  const m = kop.exec(tekst);
  assert.ok(m, 'FUNCTIES.md noemt de genre-caps met een aantal');
  assert.equal(Number(m[1]), echt.length, 'het genoemde aantal klopt met het register');

  const na = tekst.slice(m.index).split('\n').filter(r => r.trim())[1] || '';
  assert.deepEqual(genoemd(na).sort(), echt, 'de opgesomde caps zijn precies die van het register');

  const tabel = /\| Genre-caps \(waar de apps op sturen\) \| \*\*(\d+)\*\* \|/.exec(tekst);
  assert.ok(tabel, 'de tabel bovenaan noemt de genre-caps');
  assert.equal(Number(tabel[1]), echt.length, 'ook daar klopt het aantal');
});

test('8. elke cap die PLATFORM.md als voorbeeld noemt, bestaat echt', () => {
  /* Dit is de toets die `rooms` zou hebben gevangen. Een document dat een cap
     noemt die nergens wordt aangemaakt, stuurt iemand met vertrouwen de
     verkeerde kant op -- en in kern/fiscaal/tarief.js gebeurde dat ook. */
  const bestaat = alleMogelijkeCaps();
  const tekst = lees('PLATFORM.md');
  const regel = tekst.split('\n').find(r => r.includes('De genres dragen **genre-caps**'));
  assert.ok(regel, 'PLATFORM.md noemt de genre-caps met voorbeelden');
  const stuk = tekst.slice(tekst.indexOf(regel), tekst.indexOf(regel) + 400);
  const namen = genoemd(stuk).filter(n => n !== 'caps');
  assert.ok(namen.length >= 10, 'er staan voorbeelden, gevonden: ' + namen.length);
  for (const n of namen) assert.ok(bestaat.has(n), 'de cap `' + n + '` uit PLATFORM.md bestaat in de code');
});

test('9. tegenproef: een verzonnen cap bestaat niet, en `rooms` was er zo een', () => {
  const bestaat = alleMogelijkeCaps();
  assert.ok(bestaat.has('bookings'), 'bookings is een echte cap');
  assert.ok(!bestaat.has('rooms'), 'rooms is dat niet -- geen genre en geen werkvorm maakt hem');
  assert.ok(!bestaat.has('kamers'), 'en een verzonnen naam evenmin');
});
