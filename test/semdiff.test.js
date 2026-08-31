/* ============================================================================
   HET REGRESSIECORPUS VAN DE SEMANTISCHE DIFF.

   Deze laag levert de ONDERGRENS waarmee scripts/lib/risico.js verder rekent.
   Zit die ondergrens te laag, dan wordt er straks een bewijs overgeslagen dat
   had moeten draaien -- en dat gebeurt geruisloos. Zit hij overal te hoog, dan
   draagt het etiket geen informatie meer en versnelt er nooit iets; dat is niet
   "veilig conservatief" maar waardeloos.

   DE FOUT DIE DIT BESTAND AFDWONG. De eerste versie liet de codepatronen ook op
   proza los en noemde ADAPTIEF.md "beveiliging" omdat er het woord sleutel in
   stond: 540 van de 2542 gewijzigde bestanden kregen die stempel. Vandaar dat de
   eerste vier toetsen hieronder over SOORTEN gaan en niet over woorden.

   DE MUTATIE VOOR DIT BESTAND: haal in semdiff.js de soort-afhandeling weg
   (laat klasseVanBestand altijd de patronen draaien) -> "proza is geen
   beveiliging" zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { diff, ontleed, soortVan, klasseVanBestand, zwaarste, isCosmetisch } = require('../scripts/lib/semdiff');

const klasse = (pad, ...regels) => klasseVanBestand(pad, regels).klasse;

test('proza is geen beveiliging, ook niet als het over sleutels gaat', () => {
  /* GEMETEN EN NIET GEVOELD: geen enkele servermodule leest een .md in (nul
     treffers op readFile/require van .md onder server/). Een documentwijziging
     kan dus de POORTEN raken -- tien keuringsscripts lezen wel documenten -- en
     nooit het draaiende huis. */
  assert.equal(soortVan('ADAPTIEF.md'), 'document');
  assert.equal(klasse('ADAPTIEF.md', '+de sleutel staat nooit in de repo', '+een token verloopt'),
    'documentatie');
});

test('de bewijsmachinerie zelf is de ZWAARSTE klasse, zwaarder dan beveiliging', () => {
  /* Een wijziging aan de machinerie die bewijs oplevert, kan niet worden
     gecertificeerd door diezelfde machinerie. Wie een ratel losdraait of een
     toets uitzet, verandert de weegschaal en niet het huis. */
  assert.equal(klasse('.github/workflows/ci.yml', '+  timeout-minutes: 240'), 'besturing');
  assert.equal(klasse('NORM.json', '+  "bewijsAchterstand": 40'), 'besturing');
  assert.equal(klasse('test/rem.test.js', '+  assert.equal(saldo, 0);'), 'besturing');
  assert.equal(klasse('scripts/check.js', '+// niets'), 'besturing');
  assert.equal(klasse('.nvmrc', '+26'), 'besturing',
    'de Node-versie hoort bij de omgeving waaronder bewijs geldig is');
  assert.equal(zwaarste('security', 'besturing'), 'besturing');
});

test('documentatie is de LICHTSTE klasse en verliest van alles', () => {
  /* Zonder deze plek in de ladder valt `documentatie` er stilletjes buiten, en
     dan gedraagt indexOf zich als -1: elke vergelijking geeft dan de andere kant
     terug, ook waar dat niet hoort. */
  assert.equal(zwaarste('documentatie', 'cosmetic'), 'cosmetic');
  assert.equal(zwaarste('documentatie', 'implementation'), 'implementation');
  assert.equal(zwaarste('cosmetic', 'documentatie'), 'cosmetic');
});

test('de ontleding: commentaarregels komen niet in de telling terecht', () => {
  /* DE MUTATIE DIE MIJN EERSTE CORPUS NIET ZAG. Zolang deze ontleding in diff()
     zat, was hij alleen te beproeven door een echte repository te bouwen -- en
     dus werd hij niet beproefd. Het commentaarfilter eruit halen liet toen geen
     enkele toets zakken, terwijl dat precies de fout is die elke
     documentatieronde de zwaarste toetsen laat draaien. */
  const r = ontleed([
    '--- a/server/rem.js',
    '+++ b/server/rem.js',
    '@@ -1,0 +1,4 @@',
    '+// deze nonce is een sleutel',
    '+ * en dit ook, met een hmac',
    '+',
    '+const x = 1;'
  ].join('\n'));
  assert.equal(r.length, 1);
  assert.equal(r[0].cosmetisch, 3, 'drie regels commentaar en witruimte');
  assert.equal(r[0].regels, 1, 'en één echte coderegel');
  assert.equal(r[0].klasse, 'implementation',
    'de woorden stonden alleen in commentaar, dus dit is geen beveiliging');
});

test('de ontleding: een VERWIJDERD bestand blijft in de meting staan', () => {
  /* Een verwijdering is voor de impactvraag de lastigste: daarna weet de
     omgekeerde graaf niets meer van dat bestand. Verdwijnt hij ook hier, dan is
     hij nergens meer -- en dan lijkt er niets gebeurd. */
  const r = ontleed([
    '--- a/server/routes/weg.js',
    '+++ /dev/null',
    '@@ -1,2 +0,0 @@',
    '-const a = 1;'
  ].join('\n'));
  assert.equal(r.length, 1);
  assert.equal(r[0].pad, 'server/routes/weg.js');
  assert.equal(r[0].verwijderd, true);
});

test('een .json van de server is geen document maar gewoon gegevens', () => {
  /* Servercode leest wel .json (vier plekken), dus die krijgt de volle
     behandeling. Dat verschil met .md is gemeten, niet aangenomen. */
  assert.equal(soortVan('server/data/tarieven.json'), 'gegevens');
  assert.notEqual(klasse('server/data/tarieven.json', '+ "bedrag": 6500'), 'documentatie');
});

test('een scherm en een stijlblad krijgen geen woordpatronen opgeplakt', () => {
  /* Daar betekenen dezelfde woorden iets anders -- `rem` is in een stijlblad een
     eenheid. Wat het scherm WEL is, bepaalt de graaf: een scherm in een geldpad
     is een geldpad. */
  assert.equal(klasse('public/apps/x.css', '+  padding: 2rem;'), 'implementation');
  assert.equal(klasse('public/apps/x.html', '+<span>bedrag</span>'), 'implementation');
});

test('in CODE winnen de patronen, en de zwaarste en niet de eerste', () => {
  assert.equal(klasse('server/kern/x.js', "+router.get('/a', h);"), 'public API');
  assert.equal(klasse('server/kern/x.js', '+module.exports = { a };'), 'contract');
  assert.equal(klasse('server/kern/x.js', '+  const centen = 10;'), 'money');
  assert.equal(klasse('server/kern/x.js', '+  const nonce = maak();'), 'security');
  /* Twee patronen op één regel: geld en beveiliging. Beveiliging weegt zwaarder,
     dus die wint -- ook al staat geld eerder in de lijst. */
  assert.equal(klasse('server/kern/x.js', '+  const bedrag = hmac(saldo);'), 'security');
});

test('over MEERDERE regels wint ook de zwaarste, en niet de laatste', () => {
  /* DE MUTATIE DIE MIJN EERSTE CORPUS NIET ZAG. Binnen één regel loopt de
     patronenlijst toevallig van licht naar zwaar, dus "de laatste die past" en
     "de zwaarste die past" gaven daar hetzelfde antwoord. Over meerdere regels
     niet: staat de zware regel bovenaan en de lichte eronder, dan zakt het hele
     bestand terug naar die lichte -- en dat is een bewijs dat wordt overgeslagen. */
  assert.equal(klasse('server/kern/x.js',
    '+  const nonce = maak();', '+module.exports = { a };'), 'security');
});

test('een onbekende klasse WINT, in plaats van stilletjes te verliezen', () => {
  /* Dit is geen bedachte randgeval maar een echte fout die hier heeft gezeten:
     risico.js droeg een eigen kopie van de ladder zonder `besturing` erin, en
     indexOf geeft voor een onbekende naam -1 -- waardoor de ZWAARSTE klasse van
     alles verloor. Wie een klasse toevoegt en hem hier vergeet, hoort te veel
     bewijs te krijgen en niet te weinig. */
  assert.equal(zwaarste('verzonnen-klasse', 'security'), 'verzonnen-klasse');
  assert.equal(zwaarste('security', 'verzonnen-klasse'), 'verzonnen-klasse');
});

test('de twee lagen delen ÉÉN ladder', () => {
  /* Zolang risico.js een eigen kopie droeg, konden ze het oneens zijn zonder dat
     iemand het merkte -- en waren ze het ook oneens. */
  const risico = require('../scripts/lib/risico');
  const { GEWICHT } = require('../scripts/lib/semdiff');
  assert.deepEqual(risico.KLASSEN, GEWICHT, 'dezelfde ladder, dezelfde volgorde');
  assert.equal(risico.hogerst('besturing', 'implementation'), 'besturing',
    'een wijziging aan de bewijsmachinerie zelf is de zwaarste die er is');
});

test('de redenen staan erbij, zodat een etiket na te rekenen is', () => {
  const k = klasseVanBestand('server/kern/x.js', ['+  const bedrag = 1;', '+  const nonce = 2;']);
  assert.equal(k.klasse, 'security');
  assert.deepEqual(k.redenen.sort(), ['money', 'security']);
});

test('witruimte en commentaar tellen niet mee', () => {
  assert.ok(isCosmetisch('+   '));
  assert.ok(isCosmetisch('+// een nonce'));
  assert.ok(isCosmetisch('+ * met een sleutel'));
  assert.ok(!isCosmetisch('+const nonce = 1;'));
  /* Een bestand waar ALLEEN commentaar in veranderde, blijft cosmetisch -- ook
     in de beveiligingslaag. Zonder dit draait elke documentatieronde alles. */
  const k = klasseVanBestand('server/rem.js', []);
  assert.notEqual(k.klasse, 'security');
});

test('de echte tak: de meting draagt soort, klasse en verwijderingen', () => {
  /* DE METING ZELF, tegen de echte geschiedenis. Zonder dit kan deze
     classificator stilletjes veranderen in iets dat overal hetzelfde etiket op
     plakt -- en dat ziet er in geen enkele teller uit als kapot. */
  const r = diff();
  /* EEN LEGE DIFF IS EEN GELDIGE UITKOMST, EEN KAPOTTE NIET. Deze toets ging uit
     van "er is altijd wel iets veranderd", en dat is een aanname over de
     OMGEVING en niet over de code: in een ondiepe kloon bestaat origin/main niet,
     de merge-base mislukt, en dan komt er nul uit zonder dat er iets stuk is.
     Dat gebeurde ook echt, in de schervenjob die geen fetch-depth: 0 had.
     Wat hier hoort te worden beproefd is dat diff() WERKT -- geen fout, en elk
     bestand met soort en klasse. Is er niets veranderd, dan is dat geen bewijs
     van iets kapots. */
  assert.ok(!r.fout, 'diff() liep vast: ' + r.fout);
  assert.ok(Array.isArray(r.bestanden), 'diff() levert een lijst');
  /* HIER STOND EEN TWEEDE AANNAME OVER DE OMGEVING, uit dezelfde familie als
     die hierboven: bij meer dan tien gewijzigde bestanden moest de tak minstens
     VIER klassen dragen, anders zou de classificator overal hetzelfde etiket
     plakken. Maar dat is geen eigenschap van de classificator, het is een
     eigenschap van de TAK die hem toevallig voedt. Een gerichte schermronde
     raakt twaalf bestanden die allemaal front-end zijn, en zakte hierop --
     terwijl er niets mis was met het onderscheid.

     Wat er te bewijzen valt is dat hij ECHT onderscheidt, en dat hoort tegen
     invoer die wij kiezen: dan draait de proef altijd (ook op een lege diff) en
     hangt hij niet af van wat er die dag toevallig veranderde. */
  const proef = new Map([
    ['ONTWERP.md', []],
    ['public/apps/kantoor.html', []],
    ['scripts/check.js', []],
    ['server/kern/pay/poort.js', ['+  const bedrag = centen(regel);']],
    ['server/kern/sessie.js', ['+  const token = maakToken(lid);']]
  ]);
  const klassen = new Set([...proef].map(([pad, regels]) => klasseVanBestand(pad, regels).klasse));
  assert.ok(klassen.size >= 4,
    'de classificator onderscheidt te weinig: ' + [...klassen].join(', '));
  for (const b of r.bestanden) {
    assert.ok(b.soort && b.klasse, 'elk bestand draagt soort en klasse: ' + b.pad);
    if (b.soort === 'document') {
      assert.equal(b.klasse, 'documentatie', b.pad + ' is proza en kreeg ' + b.klasse);
    }
  }
});
