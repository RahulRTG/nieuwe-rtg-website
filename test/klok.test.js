/* DE KLOK (server/lib/klok.js) en de klokschuld (scripts/klok.js).

   WAT HIER OP HET SPEL STAAT. Tijd is de enige chaosfactor waar dit huis tot nu
   toe niets aan kon draaien: 1300 directe tijdsaanroepen in server/, elk apart
   aan het besturingssysteem, dat altijd de waarheid zegt. Daardoor was een hele
   klasse vragen onbeantwoordbaar -- schrikkeldag, zomertijd, een verlopen
   mandaat, en de scherpste van allemaal: wat ziet iemand die vandaag precies
   achttien wordt.

   Die laatste is geen gedachte-experiment. CLAUDE.md legt vast dat alles wat een
   prestatie bewaart buiten het potje pas bestaat vanaf achttien. Die grens is
   nooit op de dag zelf getoetst, en dat kon ook niet: je kunt niet wachten tot
   de jarige jarig is. Met de klok wel, en dat is de toets onderaan.

   DE TWEEDE HELFT IS DE WEIGERING. Een verzette klok in productie is geen proef
   maar een storing. Dat de klok daar hard op afslaat is even belangrijk als dat
   hij kan verzetten, en het is met een subproces te bewijzen -- de weigering
   gebeurt bij het LADEN, dus in dit proces is hij niet na te spelen.

   Draai los: node --test test/klok.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { lees, nu, datum, verschoven, EENHEDEN } = require('../server/lib/klok');

const WORTEL = path.join(__dirname, '..');

/* De klok leest zijn stand bij het laden, dus een andere stand is een ander
   proces. Dat is geen omweg maar precies hoe hij in het echt werkt. */
function inProces(env, code) {
  return execFileSync(process.execPath, ['-e', code],
    { encoding: 'utf8', env: { ...process.env, ...env }, cwd: WORTEL }).trim();
}
function valtOm(env, code) {
  try { inProces(env, code); return null; } catch (e) { return String(e.stderr || e.message); }
}

/* ---------- de instelling lezen ---------- */

test('zonder RTG_KLOK staat de klok uit en loopt hij gelijk', () => {
  assert.deepEqual(lees(''), { soort: 'uit', ms: 0 });
  assert.deepEqual(lees(undefined), { soort: 'uit', ms: 0 });
  assert.equal(verschoven(), false, 'deze testrun hoort zelf geen verzette klok te hebben');
});

test('een verschuiving wordt in de goede richting en de goede eenheid gelezen', () => {
  assert.deepEqual(lees('+17m'), { soort: 'verschoven', ms: 17 * 60000 });
  assert.deepEqual(lees('-1u'), { soort: 'verschoven', ms: -3600000 });
  assert.deepEqual(lees('+30s'), { soort: 'verschoven', ms: 30000 });
  assert.deepEqual(lees('+2d'), { soort: 'verschoven', ms: 2 * 86400000 });
  assert.deepEqual(lees('+10j'), { soort: 'verschoven', ms: 10 * 31536000000 });
});

test('elke eenheid uit de tabel is ook echt te gebruiken', () => {
  /* Anders staat er een eenheid in EENHEDEN die de regexp niet accepteert:
     een regel die er is en niets doet. */
  for (const [teken, ms] of Object.entries(EENHEDEN)) {
    assert.deepEqual(lees('+1' + teken), { soort: 'verschoven', ms },
      'eenheid ' + teken + ' staat in de tabel maar wordt niet gelezen');
  }
});

test('zonder teken wordt een verschuiving geweigerd -- raden hoort hier niet', () => {
  assert.equal(lees('17m').soort, 'onleesbaar');
});

test('onzin is onleesbaar en wordt niet stilletjes nul', () => {
  /* Stil op nul vallen zou het ergste zijn wat deze module kan doen: dan denkt
     iemand dat hij op schrikkeldag draait terwijl het gewoon dinsdag is. */
  for (const rommel of ['morgen', '++1u', '1uur', '+1x', '+', '-']) {
    assert.equal(lees(rommel).soort, 'onleesbaar', rommel + ' hoort onleesbaar te zijn');
  }
});

test('een absoluut moment wordt een verschil, zodat de tijd daarna doorloopt', () => {
  const uit = lees('2028-02-29T12:00:00Z');
  assert.equal(uit.soort, 'gezet');
  assert.equal(uit.naar, '2028-02-29T12:00:00Z');
  const bedoeld = Date.parse('2028-02-29T12:00:00Z') - Date.now();
  assert.ok(Math.abs(uit.ms - bedoeld) < 5000, 'het verschil hoort bij het moment te passen');
});

/* ---------- de klok in een echt proces ---------- */

test('nu() en datum() geven zonder verschuiving gewoon de echte tijd', () => {
  const verschil = Math.abs(nu() - Date.now());
  assert.ok(verschil < 1000, 'ongeschoven hoort de klok gelijk te lopen');
  assert.ok(Math.abs(datum().getTime() - Date.now()) < 1000);
});

test('met RTG_KLOK verschuift de tijd werkelijk, en precies zoveel', () => {
  const uit = inProces({ RTG_KLOK: '+2d' },
    "const k=require('./server/lib/klok');console.log(k.nu()-Date.now())");
  const gemeten = Number(uit);
  assert.ok(Math.abs(gemeten - 2 * 86400000) < 5000,
    'twee dagen vooruit hoort twee dagen te zijn, gemeten: ' + gemeten);
});

test('de klok kan ook terug', () => {
  const gemeten = Number(inProces({ RTG_KLOK: '-1u' },
    "const k=require('./server/lib/klok');console.log(k.nu()-Date.now())"));
  assert.ok(gemeten < -3500000 && gemeten > -3700000, 'gemeten: ' + gemeten);
});

test('een gezet moment brengt je op de schrikkeldag', () => {
  const uit = inProces({ RTG_KLOK: '2028-02-29T12:00:00Z' },
    "const k=require('./server/lib/klok');console.log(k.datum().toISOString().slice(0,10))");
  assert.equal(uit, '2028-02-29');
});

test('de 2038-proef: tientallen jaren vooruit blijft een geldige datum', () => {
  const uit = inProces({ RTG_KLOK: '2038-01-19T04:00:00Z' },
    "const k=require('./server/lib/klok');const d=k.datum();console.log(d.toISOString().slice(0,4)+' '+(d.getTime()>0))");
  assert.equal(uit, '2038 true');
});

/* ---------- de weigeringen ---------- */

test('onleesbare invoer laat de server bij het laden omvallen, niet later', () => {
  const fout = valtOm({ RTG_KLOK: 'morgen' }, "require('./server/lib/klok')");
  assert.ok(fout, 'een onleesbare klok hoort te gooien');
  assert.match(fout, /RTG_KLOK is niet te lezen/);
});

test('een verzette klok weigert in productie', () => {
  const fout = valtOm({ RTG_KLOK: '+1u', NODE_ENV: 'production' }, "require('./server/lib/klok')");
  assert.ok(fout, 'in productie hoort een verzette klok te gooien');
  assert.match(fout, /productie/);
});

test('in productie zonder RTG_KLOK gebeurt er niets bijzonders', () => {
  const uit = inProces({ NODE_ENV: 'production', RTG_KLOK: '' },
    "const k=require('./server/lib/klok');console.log(k.verschoven())");
  assert.equal(uit, 'false');
});

/* ---------- en waar het allemaal om begonnen was ---------- */

test('de 18+-poort op de dag dat een lid precies achttien wordt', () => {
  /* Achttien jaar en één dag vóór een vast moment geboren, dus op dat moment
     achttien. Dit was tot nu toe niet te toetsen: je kunt niet wachten tot de
     jarige jarig is, en zonder klok is er niets om aan te draaien. */
  const code = "const {leeftijdVan}=require('./server/lib/leeftijd');" +
    "console.log(leeftijdVan('2010-06-15'))";
  const dagErvoor = inProces({ RTG_KLOK: '2028-06-14T12:00:00Z' }, code);
  const opDeDag = inProces({ RTG_KLOK: '2028-06-15T12:00:00Z' }, code);
  assert.equal(dagErvoor, '17', 'de dag voor de verjaardag is hij nog zeventien');
  assert.equal(opDeDag, '18', 'op zijn verjaardag is hij achttien -- de poort gaat open');
});

test('een schrikkeldagkind wordt ook in een gewoon jaar jarig', () => {
  /* 29 februari 2012 geboren; in 2029 bestaat 29 februari niet. Op 1 maart hoort
     hij zeventien te zijn -- niet zestien, en niet null. */
  const code = "const {leeftijdVan}=require('./server/lib/leeftijd');" +
    "console.log(leeftijdVan('2012-02-29'))";
  assert.equal(inProces({ RTG_KLOK: '2029-02-28T12:00:00Z' }, code), '16');
  assert.equal(inProces({ RTG_KLOK: '2029-03-01T12:00:00Z' }, code), '17');
});

/* ---------- de schuldmeter ---------- */

test('de klokschuld telt alleen tijdsvragen en geen omrekeningen', () => {
  /* spawnSync, want deze meter sluit met 1 af zodra de schuld is gegroeid -- en
     execFileSync GOOIT dan, waarna deze toets "Command failed" meldt in plaats
     van te meten wat hij beweert te meten. De uitslag op stdout is er gewoon;
     het is de exitcode die iets anders zegt, en die gaat over de ratel en niet
     over deze twee vragen. */
  const uit = String(spawnSync(process.execPath, [path.join(WORTEL, 'scripts', 'klok.js')],
    { encoding: 'utf8', cwd: WORTEL, maxBuffer: 64 * 1024 * 1024 }).stdout || '');
  const totaal = Number((uit.match(/directe tijdsaanroepen : (\d+)/) || [])[1]);
  assert.ok(totaal > 0, 'de meter hoort iets te zien');
  /* De ruwe grep vindt er meer, want die telt `new Date(x)` mee. Zou dit getal
     daaraan gelijk zijn, dan telt de meter omrekeningen mee en is de schuld
     nooit af te lossen. */
  const ruw = execFileSync('/bin/sh', ['-c',
    "grep -rEo 'new Date\\(|Date\\.now\\(' server --include=*.js 2>/dev/null | wc -l"],
    { encoding: 'utf8', cwd: WORTEL });
  assert.ok(totaal < Number(ruw.trim()), 'de meter hoort strenger te zijn dan een ruwe grep');
});

test('de klokschuld ziet de module die WEL op de klok zit', () => {
  /* spawnSync, want deze meter sluit met 1 af zodra de schuld is gegroeid -- en
     execFileSync GOOIT dan, waarna deze toets "Command failed" meldt in plaats
     van te meten wat hij beweert te meten. De uitslag op stdout is er gewoon;
     het is de exitcode die iets anders zegt, en die gaat over de ratel en niet
     over deze twee vragen. */
  const uit = String(spawnSync(process.execPath, [path.join(WORTEL, 'scripts', 'klok.js')],
    { encoding: 'utf8', cwd: WORTEL, maxBuffer: 64 * 1024 * 1024 }).stdout || '');
  const op = Number((uit.match(/modules op de klok\s+: (\d+)/) || [])[1]);
  assert.ok(op >= 1, 'server/lib/leeftijd.js zit op de klok en hoort geteld te worden');
});
