/* WIE ER AAN DE ECHTE BRON ZIT, DRAAIT ALLEEN.

   WAAROM DIT BESTAAT. Sommige toetsen moeten een ECHT bronbestand kapotmaken om
   iets te bewijzen -- dat is LAT.md regel 10: een meter die je niet hebt zien
   uitslaan, meet niets. test/gezag.test.js hernoemt een trede in
   geldbeleid/regels.js; test/envelop.test.js haalt `function gastAuth(` weg uit
   routes/gast.js. Allebei zetten ze het in een finally netjes terug.

   MAAR DE SUITE DRAAIT PARALLEL. Terwijl gast.js een halve seconde stuk is,
   start een andere toets twintig bestanden verderop een echte server -- en die
   leest het kapotte bestand. Dat is precies wat er gebeurde:

       ERROR uitzondering {"fout":"gastAuth is not defined",
         "stack":"ReferenceError ... at server/routes/gast.js:99"}

   De strenge poort meldde het keurig, maar wees test/excursie.test.js aan, dat
   er niets mee te maken had en in zijn eentje gewoon groen is. Twee eerdere
   volledige runs waren groen -- door de timing, niet doordat het goed stond.

   Dat is de duurste vorm van een fout: hij verplaatst zich, hij is niet
   reproduceerbaar in isolatie, en hij beschuldigt onschuldige code.

   DE OPLOSSING BESTOND AL. scripts/test-runner.js heeft een GEISOLEERD-lijst
   voor precies deze toetsen, en zijn eigen kop legt uit waarom: "bronmuterende
   meetproeven tegelijk met scanners van diezelfde bron". Wat er ontbrak was een
   handhaver die merkt dat er een bij komt die er niet in staat -- want dat
   gebeurt vanzelf: wie een nieuwe meter schrijft, schrijft er een mutatietoets
   bij en denkt niet aan de draaier.

   WAT DEZE TOETS DOET. Hij zoekt elke toets die een bestand in server/, scripts/
   of public/ overschrijft, en eist dat die in de isolatielijst staat. Niet meer
   en niet minder.

   DE TWEEDE VORM, ERBIJ OP 3 SEPTEMBER 2026 (TAKEN.md 4.77). Hier stond dat een
   `fs.writeFileSync` met een pad uit een VARIABELE buiten de zeef viel, en dat
   was geen theorie: het narekenen vond er 21, waarvan `capabilities.test.js`
   (die een echt bestand in server/kern/ neerzet) en `gezagshandelingen.test.js`
   (die kern/frictie/bodem.js muteert) niet in de isolatielijst stonden.

   Die vorm vraagt een FLOW-controle en niet een patroon, en dat is de reden dat
   hij er niet meteen bij zat: `begrotingsgrenzen.test.js` heeft een variabele
   `map` die uit server/kern/vergeten komt en een tweede `map` die uit
   os.tmpdir() komt. Een zeef die alleen ziet dat beide woorden in het bestand
   staan, beschuldigt een toets die alleen LEEST -- en een zeef die onschuldige
   toetsen aanwijst, wordt weggeklikt. Dus: een naam telt alleen als ELKE
   toekenning eraan uit de bron komt, en als er ook echt op die naam geschreven
   wordt.

   FAIL-CLOSED OP HET ONBEKENDE. Komt de map uit een variabele
   (`path.join(WORTEL, rel)`), dan is statisch niet te zien waar hij landt --
   en dan telt hij mee. Dat is de goede kant om fout te staan: de kosten van een
   onterechte isolatie zijn een tragere scherf, de kosten van een gemiste zijn
   een rood dat een onschuldig bestand aanwijst.

   WAT HIJ NOG STEEDS NIET ZIET, en dat hoort erbij:
   - een toets die een SCRIPT start dat in de repo schrijft. Gemeten: veertien
     toetsen starten zo'n script, maar geen van de veertien geeft een vlag mee
     waaronder dat script schrijft (ze gebruiken --json, --lees, --controle).
     Alle veertien isoleren zou de suite trager maken voor een gevaar dat er
     vandaag niet is; het narekenen ervan hoort bij de vlaggen te beginnen en
     niet bij de bestandsnamen.
   - een schrijf naar een register in de wortel (GEZAG.json, package.json). Dat
     is een kleiner gevaar -- geen enkele toets VOERT die bestanden uit -- en het
     zou de zeef over een andere klasse laten gaan dan waar hij voor is.

   Draai los: node --test test/bronmutanten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const DRAAIER = path.join(WORTEL, 'scripts', 'test-runner.js');
const { GEISOLEERD, isGeisoleerd } = require('../scripts/lib/geisoleerd');

/* De vormen waarin een toets in dit huis aan een echt bronbestand komt. Elk
   patroon eist een pad dat in server/, scripts/ of public/ begint -- een
   tijdelijk bestand in os.tmpdir() is geen bronmutatie. */
const VORMEN = [
  /metVervangen\(\s*['"](server|scripts|public)\//,
  /metNieuwBestand\(\s*['"](server|scripts|public)\//,
  /metAanbouw\(\s*['"](server|scripts|public|LAT\.md|NORM\.json)/,
  /metTijdelijkBestand\(\s*['"](server|scripts|public|test)\//,
  /fs\.writeFileSync\(\s*path\.join\(\s*WORTEL\s*,\s*['"](server|scripts|public)\//
];

/* De lijst komt uit scripts/lib/geisoleerd.js en niet uit een regex over de
   bron van de draaier. Dat was de eerste versie, en die had twee gebreken: hij
   brak op de opmaak van andermans bestand, en hij las alleen TEKST -- waardoor
   deze toets voor de mutatiemotor onbereikbaar was en als "niet gemeten" telde
   terwijl er vier beweringen op staan. */
function isolatielijst() {
  assert.ok(Array.isArray(GEISOLEERD) && GEISOLEERD.length,
    'scripts/lib/geisoleerd.js geeft geen lijst -- dan bewaakt deze toets niets');
  const bron = fs.readFileSync(DRAAIER, 'utf8');
  assert.match(bron, /require\('\.\/lib\/geisoleerd'\)/,
    'de draaier leest de lijst niet meer, dus wat hier staat zegt niets over wat er draait');
  assert.match(bron, /isGeisoleerd\(n\)/,
    'de draaier gebruikt het predicaat niet meer om te scheiden');
  /* Via het PREDICAAT en niet via de lijst: dat is wat de draaier ook doet, en
     het is het punt dat een mutatie kan raken. */
  return { has: (n) => isGeisoleerd(n) };
}

/* DIT BESTAND ZELF TELT NIET MEE, en dat is geen achterdeur maar een noodzaak:
   de tegenproef hieronder DRAAGT de patronen als tekst, want anders is niet te
   bewijzen dat de zeef ze herkent. Zonder deze uitzondering beschuldigt de zeef
   zichzelf -- de vierde keer deze ronde dat een meter tekst voor code aanzag.

   Precies EEN uitzondering, en die staat hier met naam. Zou het er een tweede
   worden, dan is dat een achterdeur en hoort er een reden bij te staan zoals de
   MAG-lijst in scripts/klok.js dat doet. */
const EIGEN = 'bronmutanten.test.js';

/* server/data/ is de RUNTIME-map (database, sleutels, staat er in .gitignore) en
   geen bron: geen enkele toets voert die bestanden uit. Wie daar schrijft raakt
   wel gedeelde staat, maar dat is een andere klasse dan een kapot .js-bestand. */
const GEEN_BRON = /^(server\/data|\.release)\b/;
const BRONMAP = /^(server|scripts|public)\b/;

/* DE FLOW-ZEEF voor een pad uit een variabele. Geeft de namen terug waarvan
   ELKE toekenning uit de bron komt en waarop ook echt geschreven wordt. */
function variabeleBronschrijvers(bron) {
  const raak = [];
  /* Alle toekenningen per naam, ook de tweede en de derde: een naam die ook uit
     os.tmpdir() gevuld kan worden is niet aan te wijzen. */
  const toekenningen = new Map();
  for (const m of bron.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)) {
    if (!toekenningen.has(m[1])) toekenningen.set(m[1], []);
    toekenningen.get(m[1]).push(m[2]);
  }
  for (const [naam, waarden] of toekenningen) {
    const schrijft = new RegExp('fs\\.(writeFileSync|appendFileSync|rmSync|copyFileSync|renameSync)\\(\\s*' +
      naam + '\\b').test(bron);
    if (!schrijft) continue;
    const uitBron = waarden.map(w => {
      const j = /path\.join\(\s*WORTEL\s*,\s*(.+)$/.exec(w);
      if (!j) return 'geen';                       // niet uit de wortel: geen bronpad
      /* ALLE literale delen aan elkaar, en niet alleen de eerste.
         path.join(WORTEL, 'server', 'data', 'x.js') begint met 'server' en is
         toch geen bron -- die eerste versie beschuldigde schermmutatie.test.js. */
      const delen = [...j[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
      let pad = delen.join('/');
      if (!delen.length) {
        /* De map komt uit een naam. Staat die als const in ditzelfde bestand,
           dan is hij op te zoeken -- dat haalt wetten.test.js (PROEFBESTAND =
           'server/data/...') terecht uit de verdenking. Lukt dat niet, dan is
           het onbekend en telt hij mee: fail-closed op wat we niet kunnen zien. */
        const naamIn = /^\s*([A-Za-z_$][\w$]*)/.exec(j[1]);
        const con = naamIn && new RegExp('(?:const|let|var)\\s+' + naamIn[1] +
          "\\s*=\\s*['\"]([^'\"]+)['\"]").exec(bron);
        if (!con) return 'onbekend';
        pad = con[1];
      }
      if (GEEN_BRON.test(pad)) return 'geen';
      return BRONMAP.test(pad) ? 'bron' : 'geen';
    });
    /* Alleen als GEEN enkele toekenning buiten de bron valt. Eén 'geen' maakt de
       naam dubbelzinnig, en dan wijst deze zeef misschien een lezer aan. */
    if (uitBron.every(x => x !== 'geen') && uitBron.some(x => x === 'bron' || x === 'onbekend')) {
      raak.push(naam);
    }
  }
  return raak;
}

function muterendeToetsen() {
  const uit = [];
  for (const naam of fs.readdirSync(path.join(WORTEL, 'test')).sort()) {
    if (!naam.endsWith('.test.js')) continue;
    if (naam === EIGEN) continue;
    let bron;
    try { bron = fs.readFileSync(path.join(WORTEL, 'test', naam), 'utf8'); } catch (e) { continue; }
    const raak = VORMEN.filter(v => v.test(bron));
    if (raak.length || variabeleBronschrijvers(bron).length) uit.push(naam);
  }
  return uit;
}

test('elke toets die aan de ECHTE bron zit, staat in de isolatielijst van de draaier', () => {
  const geisoleerd = isolatielijst();
  const muterend = muterendeToetsen();
  assert.ok(muterend.length >= 2,
    'nul of bijna nul bronmuterende toetsen gevonden -- dan zoekt deze toets de verkeerde vorm ' +
    'en bewaakt hij niets (gevonden: ' + muterend.join(', ') + ')');
  const los = muterend.filter(n => !geisoleerd.has(n));
  assert.deepEqual(los, [],
    'deze toetsen muteren echte bronbestanden maar draaien PARALLEL met de rest. ' +
    'Een andere toets die op dat moment een server start, leest het kapotte bestand en valt om -- ' +
    'met een foutmelding die naar een onschuldig bestand wijst. Zet ze in GEISOLEERD in ' +
    'scripts/test-runner.js:\n  ' + los.join('\n  '));
});

test('het predicaat scheidt echt, en zegt nee tegen wat er niet in staat', () => {
  /* Dit is het punt waar een mutatie bijt: draait de vergelijking in
     isGeisoleerd() om, dan zakt deze bewering. Zonder haar was deze hele toets
     voor de mutatiemotor onbereikbaar en telde hij als "niet gemeten". */
  for (const naam of GEISOLEERD) assert.equal(isGeisoleerd(naam), true, naam + ' hoort geïsoleerd te zijn');
  assert.equal(isGeisoleerd('server.test.js'), false, 'een gewone toets hoort NIET geïsoleerd te zijn');
  assert.equal(isGeisoleerd(''), false);
  assert.equal(isGeisoleerd(null), false);
});

test('DE TEGENPROEF: de zeef ziet een bronmutatie ook echt', () => {
  /* Zonder deze bewering kan het patroon stilletjes verkeerd zijn en meldt de
     toets hierboven voor eeuwig "alles in orde" omdat hij niets vindt -- de
     meter die groen staat omdat hij blind is (LAT.md regel 10). */
  const nep = "metVervangen('server/kern/iets.js', 'a', 'b', () => {});";
  assert.ok(VORMEN.some(v => v.test(nep)), 'een echte bronmutatie wordt niet herkend');
  const onschuldig = "metVervangen(path.join(os.tmpdir(), 'x'), 'a', 'b', () => {});";
  assert.equal(VORMEN.some(v => v.test(onschuldig)), false, 'een tijdelijk bestand telt ten onrechte mee');
});

test('DE TEGENPROEF op de flow-zeef: een pad uit een variabele wordt gezien', () => {
  /* De zeef die op 3 september 2026 is bijgekomen (TAKEN.md 4.77). Zonder deze
     bewering kan hij stilletjes niets meer vinden en meldt de toets hierboven
     voor eeuwig "alles in orde" -- de meter die groen staat omdat hij blind is. */
  const echt = "const vol = path.join(WORTEL, 'server/kern/iets.js');\n" +
    'fs.writeFileSync(vol, nieuw);';
  assert.deepEqual(variabeleBronschrijvers(echt), ['vol'], 'een bronmutatie via een variabele wordt gemist');

  /* Meerdere delen: path.join(WORTEL, 'server', 'data', ...) begint met server
     en is toch geen bron. Deze regel haalde schermmutatie.test.js terecht uit
     de verdenking. */
  const runtime = "const tmp = path.join(WORTEL, 'server', 'data', 'proef.js');\n" +
    'fs.writeFileSync(tmp, x);';
  assert.deepEqual(variabeleBronschrijvers(runtime), [], 'server/data is runtime en geen bron');

  /* Twee toekenningen waarvan een uit os.tmpdir(): dan is de naam dubbelzinnig
     en wijst deze zeef misschien een LEZER aan. Dat overkwam
     begrotingsgrenzen.test.js in de eerste versie. */
  const dubbel = "const map = path.join(WORTEL, 'server', 'kern', 'vergeten');\n" +
    "const map = fs.mkdtempSync(path.join(os.tmpdir(), 'x'));\n" +
    'fs.writeFileSync(map, x);';
  assert.deepEqual(variabeleBronschrijvers(dubbel), [], 'een dubbelzinnige naam hoort niet beschuldigd te worden');

  /* Alleen LEZEN telt niet. */
  const leest = "const map = path.join(WORTEL, 'server', 'kern');\nfs.readdirSync(map);";
  assert.deepEqual(variabeleBronschrijvers(leest), [], 'lezen is geen muteren');

  /* FAIL-CLOSED: komt de map uit een naam die hier niet staat, dan telt hij mee. */
  const onbekend = "const vol = path.join(WORTEL, rel);\nfs.writeFileSync(vol, x);";
  assert.deepEqual(variabeleBronschrijvers(onbekend), ['vol'],
    'een pad dat statisch niet te zien is, hoort mee te tellen en niet weggelaten te worden');
});

test('er is precies EEN uitzondering op de zeef, en dat is dit bestand zelf', () => {
  /* Een uitzonderingslijst die kan groeien zonder dat het opvalt, is de manier
     waarop deze hele klasse fouten terugkomt. */
  const bron = fs.readFileSync(__filename, 'utf8');
  const uitzonderingen = [...bron.matchAll(/^const EIGEN = '([^']+)';$/gm)].map(m => m[1]);
  assert.deepEqual(uitzonderingen, ['bronmutanten.test.js']);
  assert.equal(bron.includes('if (naam === EIGEN) continue;'), true,
    'de uitzondering wordt niet meer toegepast, of anders geschreven -- dan klopt deze bewering niet meer');
});

test('de twee toetsen die deze ronde de fout veroorzaakten, staan er nu in', () => {
  /* Met naam vastgelegd, want een lijst waar iets uit kan vallen zonder dat het
     opvalt, is geen lijst. */
  const geisoleerd = isolatielijst();
  for (const naam of ['gezag.test.js', 'envelop.test.js']) {
    assert.equal(geisoleerd.has(naam), true, naam + ' hoort geïsoleerd te draaien');
  }
});

test('elke suite-opdracht past de isolatielijst ook echt toe', () => {
  /* DE LIJST BESTOND, DE DRAAIER BESTOND, EN CI GEBRUIKTE ZE ALLEBEI NIET.

     `test:gate` in package.json was een eigen aanroep: `node --test
     test/*.test.js` met de dekkingsvlaggen erachter. Dat is letterlijk het
     commando dat de kop van scripts/test-runner.js beschrijft als de reden dat
     die draaier bestaat -- en het ging langs GEISOLEERD heen. In CI is
     test:gate de ENIGE suite-run, dus daar zijn de acht bronmuterende toetsen
     nooit geisoleerd geweest, geen enkele keer.

     Vier toetsen zijn daar aantoonbaar op omgevallen zonder dat er iets mis
     was: excursie en horeca-host op CI, negenplus en schakelkast-dekking
     lokaal. Allemaal startten ze een server of scanden ze de bron terwijl
     envelop.test.js `function gastAuth(` had hernoemd of meterijk.test.js een
     tijdelijk bestand in public/apps/ had staan.

     De toets hierboven bewaakt WIE er op de lijst hoort. Deze bewaakt DAT de
     lijst wordt toegepast. Zonder deze tweede was de eerste een lijst die
     niemand las -- en dat is precies wat er drie maanden lang het geval was. */
  /* DE ZEEF KIJKT NAAR OPDRACHTEN DIE ALLE test/*.test.js PAKKEN, en naar niets
     anders. Twee grenzen, allebei met een reden:

       - `.e2e.js` valt erbuiten. De isolatielijst gaat over .test.js; de
         schermtoetsen zijn een andere verzameling.
       - `--test-concurrency=1` valt erbuiten. Een seriele run KAN de race niet
         hebben: er draait nooit een tweede bestand naast het bronmuterende.
         Die uitzondering staat hier en niet in iemands hoofd, want een zeef die
         zwijgt zonder te zeggen waarom is een zeef die je een keer verkeerd
         leest. */
  const raaktHeleSuite = (t) => /test\/\*\.test\.js|test\/\*\*\/\*\.test\.js/.test(t);
  const serieel = (t) => /--test-concurrency=1\b/.test(t);
  const langsDeDraaier = (t) => t.includes('scripts/test-runner.js');
  const verdacht = (t) => raaktHeleSuite(t) && !serieel(t) && !langsDeDraaier(t);

  const pkg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8'));
  const fout = Object.entries(pkg.scripts || {})
    .filter(([, opdracht]) => verdacht(String(opdracht)))
    .map(([naam, opdracht]) => naam + ': ' + opdracht);
  assert.deepEqual(fout, [],
    'deze opdracht(en) draaien alle test/*.test.js buiten scripts/test-runner.js om, en dus zonder de ' +
    'isolatielijst; laat ze door de draaier lopen (zie de kop hierboven)');

  /* En de tegenproef, want een zeef die niets kan vinden bewaakt niets
     (LAT.md regel 9). Dit is het commando dat hier tot 24 augustus 2026 stond. */
  assert.equal(verdacht('node --experimental-sqlite --experimental-test-coverage --test test/*.test.js'), true,
    'de zeef herkent het oude test:gate-commando niet meer');
  assert.equal(verdacht('node scripts/test-runner.js --dekking=78,78,65'), false,
    'de zeef wijst de draaier zelf aan, en dan is er geen commando dat hem tevredenstelt');
  assert.equal(verdacht('node --test --test-concurrency=1 test/*.test.js'), false,
    'een seriele run wordt aangewezen terwijl die de race niet kan hebben');
  assert.equal(verdacht('node --test test/*.e2e.js'), false,
    'de schermtoetsen worden aangewezen, terwijl de isolatielijst over .test.js gaat');
});

test('de draaier past de lijst ook echt toe, en niet alleen op papier', () => {
  /* DE LAATSTE METER. De toets hierboven bewaakt dat elke suite-opdracht via
     scripts/test-runner.js loopt. Maar die draaier splitst met een enkele regel
     -- `bestanden.filter(n => !isGeisoleerd(n))` -- en toen ik die muteerde naar
     `filter(n => true)` zakte er niets. De lijst bestond, het commando liep er
     langs, en de splits kon stilletjes verdwijnen.

     Daarom vraagt deze toets de draaier zelf wat hij zou doen (`--toon`), met
     een gewoon bestand en twee bronmuterende ernaast. De uitslag moet ze
     scheiden. Muteer de splits weg en deze toets zakt. */
  const uit = execFileSync(process.execPath,
    [path.join(WORTEL, 'scripts', 'test-runner.js'), '--toon',
      '--bestanden=kappen.test.js,gezag.test.js,envelop.test.js'],
    { cwd: WORTEL, encoding: 'utf8', env: { ...process.env, RTG_AFBOUW_SLOT_ACTIEF: '1' } });
  const plan = JSON.parse(uit);
  assert.deepEqual(plan.parallel, ['kappen.test.js'],
    'een gewone toets hoort in de parallelle groep, en alleen die');
  assert.deepEqual(plan.geisoleerd.slice().sort(), ['envelop.test.js', 'gezag.test.js'],
    'de twee bronmuterende toetsen horen apart te draaien; staan ze in de parallelle groep, dan is ' +
    'de splits in scripts/test-runner.js weg en is de hele isolatielijst een dode letter');
});
