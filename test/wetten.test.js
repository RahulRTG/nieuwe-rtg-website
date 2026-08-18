/* De ijking van het wettenregister: wie de wetten meet, wordt hier zelf gemeten.

   WAAROM DIT BESTAAT. `npm run wetten` geeft per systeemwet een bewijsstand, en
   die stand komt uit `npm run sabotage`. Dat is precies de vorm waar LAT.md
   regel 10 voor waarschuwt: een meter die een oordeel draagt en die je nooit
   hebt zien uitslaan, meet niets -- en getallen ogen als feiten. Een wettenlijst
   met veertig groene vinkjes is daarvan de duurste variant, want hij koopt
   vertrouwen over precies die dingen waar dit huis niet aan wil tornen.

   Er worden hier vier dingen bewezen, en alle vier met een bekend-foute invoer:

     1. DE NULMETING WERKT. Een wachter die AL rood was, mag nooit als bewijs
        tellen. Zonder die controle telt elke kapotte toets mee als handhaver.
        Mutatie: zet in scripts/sabotage.js `if (!nul.groen)` op `if (false)`,
        en deze toets zakt op "blind". Dat is ook de sabotage die WETTEN.json
        voor de wet techniek-sabotage-meet-zichzelf opschrijft.
     2. DE TOEWIJZING VAN EEN KEURINGSREGEL KLOPT. `rodeRegels()` moet een kruis
        aan de kop erboven hangen en niet aan de keuring als geheel. Deed hij
        dat laatste, dan bewees regel 24 die rood staat de wet die aan regel 23
        hangt -- een meter die het verkeerde antwoord geeft in plaats van geen.
     3. EEN VAAG RECEPT WORDT GEWEIGERD. Een aanknopingspunt dat er twee keer
        staat, raakt iets anders dan de bedoeling. Dat hoort LOSGERAAKT te heten
        en geen geslaagde proef te zijn.
     4. DE METER BEWEEGT. `wettenOnbewezen` moet omhoog gaan zodra een wet zijn
        bewijs verliest. Een teller die altijd hetzelfde zegt, telt niets.

   Draai los: node --test test/wetten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const W = require('../scripts/lib/wetboek');
const sabotage = require('../scripts/sabotage');

/* Een proefbestand in server/data/: dat staat in .gitignore en wordt door de
   keuringen overgeslagen, dus een afgebroken toets laat geen rommel achter die
   ergens anders rood wordt. Nooit over een bestaand bestand heen -- dezelfde
   voorzichtigheid als in test/meterijk.test.js, en om dezelfde reden. */
const PROEFBESTAND = 'server/data/zz-wettenproef.txt';
function metProefbestand(inhoud, doe) {
  const vol = path.join(WORTEL, PROEFBESTAND);
  fs.mkdirSync(path.dirname(vol), { recursive: true });
  assert.equal(fs.existsSync(vol), false, 'de ijking overschrijft nooit een bestaand bestand');
  fs.writeFileSync(vol, inhoud);
  try { return doe(); } finally { try { fs.unlinkSync(vol); } catch (e) {} }
}

function proefwet(wachters, zoek) {
  return { id: 'zz-proefwet', soort: 'proef', wet: 'een verzonnen wet, alleen om de motor te ijken',
    bron: { bestand: 'LAT.md', anker: 'De lat' }, handhaver: [],
    sabotage: { wat: 'proef', bestand: PROEFBESTAND, zoek, zet: 'NOOT', wachters } };
}

test('1. een wachter die AL rood was, telt nooit als bewijs', () => {
  /* De wachter faalt altijd -- ook zonder sabotage. Een motor zonder nulmeting
     ziet "rood na de sabotage" en meldt RAAK; dat is een bewijs dat volledig uit
     de lucht komt. Hij hoort BLIND te heten. */
  const uitslag = metProefbestand('AAP\n', () =>
    sabotage.probeer(proefwet(['script:node -e "process.exit(1)"'], 'AAP')));
  assert.equal(uitslag.stand, 'blind',
    'een altijd rode wachter mag geen bewijs opleveren, maar de motor zei: ' + uitslag.stand);
  assert.match(uitslag.reden, /al rood/);
});

test('2. een wachter die groen was en rood wordt, is WEL bewijs', () => {
  /* De tegenhanger, en die hoort er te staan: een toets die alleen kan zeggen
     "geen bewijs" is net zo waardeloos als een die alles goedkeurt. De wachter
     kijkt hier echt in het gesaboteerde bestand. */
  const cmd = 'script:node -e "process.exit(require(\'fs\').readFileSync(\'' + PROEFBESTAND + '\',\'utf8\').includes(\'AAP\')?0:1)"';
  const uitslag = metProefbestand('AAP\n', () => sabotage.probeer(proefwet([cmd], 'AAP')));
  assert.equal(uitslag.stand, 'raak', 'de wachter zag het verschil niet: ' + uitslag.reden);
});

test('3. de sabotage wordt byte voor byte teruggezet', () => {
  const cmd = 'script:node -e "process.exit(1)"';
  metProefbestand('AAP en nog wat tekst\n', () => {
    const vol = path.join(WORTEL, PROEFBESTAND);
    const voor = fs.readFileSync(vol, 'utf8');
    sabotage.probeer(proefwet([cmd], 'AAP'));
    assert.equal(fs.readFileSync(vol, 'utf8'), voor, 'het bestand staat niet meer zoals het stond');
  });
  assert.equal(fs.existsSync(sabotage.JOURNAAL), false, 'na een geslaagde proef ligt er geen journaal meer');
});

test('4. een aanknopingspunt dat er twee keer staat, heet losgeraakt', () => {
  /* Een recept dat twee plekken raakt, weet niet wat het bewijst. Dat hoort een
     harde fout te zijn en geen geslaagde proef, want een geslaagde proef op de
     verkeerde plek is erger dan geen proef. */
  const uitslag = metProefbestand('AAP\nAAP\n', () =>
    sabotage.probeer(proefwet(['script:node -e "process.exit(1)"'], 'AAP')));
  assert.equal(uitslag.stand, 'losgeraakt');
  assert.match(uitslag.reden, /2x/);
});

test('5. een kruis hangt aan de keuringsregel erboven, niet aan de keuring', () => {
  /* De scherpe kant: als regel 24 rood staat, mag regel 23 daar NIET van
     profiteren. Zonder deze toewijzing bewijst elke willekeurige fout in de
     keuring elke wet die aan de keuring hangt. */
  const uitvoer = [
    '23) een merkkleur heeft een spelling',
    '  ✓ geen enkele kleur ligt een haar naast een merkkleur',
    '24) een coordinaat komt nooit uit een kale Number()',
    '  ✗ server/x.js leest een positie met Number(req.body.lat)',
    '25) een toets die een externe dienst nodig heeft, staat ook in de draaier',
    '  ✓ alles in orde'
  ].join('\n');
  const rood = sabotage.rodeRegels(uitvoer);
  assert.ok(rood.has('24'), 'regel 24 hoort rood te zijn');
  assert.equal(rood.has('23'), false, 'regel 23 mag NIET rood heten: zijn kruis staat er niet');
  assert.equal(rood.has('25'), false, 'regel 25 mag niet meeliften op de fout erboven');
  assert.equal(rood.size, 1);
});

test('6. een kop met een letter (3b) wordt als eigen regel geteld', () => {
  /* De keuring kent 3b naast 3. Las de toewijzing alleen cijfers, dan viel het
     kruis van 3b onder 3 en bewees het de verkeerde wet. */
  const rood = sabotage.rodeRegels('3) geen brede streepjes\n  ✓ ok\n3b) geen emoji\n  ✗ emoji in server/x.js\n');
  assert.ok(rood.has('3b'));
  assert.equal(rood.has('3'), false);
});

test('7. alleen RAAK telt als bewezen; de meter beweegt als het bewijs wegvalt', () => {
  /* De meter `wettenOnbewezen` draagt een norm in NORM.json. Een teller die
     altijd hetzelfde getal geeft, telt niets -- dus voeren we hem hier een
     bekend-foute stand en eisen dat hij dat ziet. */
  const boek = { wetten: [
    { id: 'a', wet: 'x', afdruk: '1' }, { id: 'b', wet: 'y', afdruk: '2' },
    { id: 'c', wet: 'z', afdruk: '3' }, { id: 'd', wet: 'q', mensenwerk: 'met opzet geen machine' }
  ] };
  const alles = { wetten: { a: { stand: 'raak', afdruk: '1' }, b: { stand: 'raak', afdruk: '2' }, c: { stand: 'raak', afdruk: '3' } } };
  assert.equal(W.onbewezen(boek, alles), 1, 'alleen de mensenwerk-wet is onbewezen');

  const eenAfgeslagen = { wetten: Object.assign({}, alles.wetten, { b: { stand: 'afgeslagen', afdruk: '2' } }) };
  assert.equal(W.onbewezen(boek, eenAfgeslagen), 2, 'een afgeslagen wet hoort mee te tellen als onbewezen');

  const eenBlind = { wetten: Object.assign({}, alles.wetten, { b: { stand: 'blind', afdruk: '2' } }) };
  assert.equal(W.onbewezen(boek, eenBlind), 2, 'blind is geen bewijs');

  assert.equal(W.onbewezen(boek, null), 4, 'zonder meting is niets bewezen -- geen nul en geen groen');
});

test('8. een meting op een VERANDERD recept vervalt', () => {
  /* Anders staat er "bewezen" op grond van een proef die voor iets anders is
     gedraaid, en dat is een leugen die niemand ooit betrapt. */
  const wet = { id: 'a', wet: 'x', afdruk: 'nieuw' };
  const oud = { wetten: { a: { stand: 'raak', afdruk: 'oud' } } };
  const stand = W.standVan(wet, oud);
  assert.equal(stand.stand, 'verlopen');
  assert.equal(stand.was, 'raak', 'wat er stond blijft leesbaar, zodat je ziet wat er vervalt');
});

test('9. het echte wetboek is leesbaar, en elke bron staat er nog', () => {
  /* De harde controle over WETTEN.json zelf: geen vormfouten, en elke wet wijst
     naar een zin die werkelijk in zijn bronbestand staat. Dit is de toets die
     zakt zodra iemand een wet formuleert die de doctrine niet draagt. */
  const { boek, vormfouten } = W.lees();
  assert.deepEqual(vormfouten, [], 'WETTEN.json klopt niet van vorm');
  assert.ok(boek.wetten.length >= 40, 'er horen minstens veertig wetten te staan, nu ' + boek.wetten.length);
  const wetten = require('../scripts/wetten.js');
  for (const w of boek.wetten) {
    const b = wetten.bronstand(w);
    assert.ok(b.ok, w.id + ': ' + (b.waarom || ''));
  }
});
