/* WELKE TOESTAND BESTAAT ER, EN KLOPT DAT REGISTER NOG?

   Fase A van de verificatie-runtime: 647 serverstarts kosten 35% van alle
   toetstijd, en dat wordt pas minder als een server hergebruikt kan worden.
   Hergebruik mag alleen als van elke muteerbare wortel bekend is wie hem bezit
   en of hij terug kan naar zijn beginstand. Een enkele onbekende singleton
   maakt honderd keurig geisoleerde toetsen waardeloos -- en dat merk je niet,
   want een gedeelde server die lekt geeft geen fout maar een verkeerd antwoord.

   scripts/lib/staatscan.js telt die wortels, STATE.json bewaart wie ze bezit.
   Deze toets bewaakt allebei. De scherpte zit in wat er NIET meetelt: zonder
   dat onderscheid telde de scanner 1123 wortels waar er 143 zijn, en een
   register van 1123 regels leest niemand meer.

   Draai los: node --experimental-sqlite --test test/staatregister.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { scanBestand, eigenaarVan } = require('../scripts/lib/staatscan.js');
const { maakBoom, binnen } = require('../scripts/lib/ephemere-boom');
const staat = require('../scripts/staat.js');

const WORTEL = path.join(__dirname, '..');
const wortelsVan = (bron) => scanBestand(bron, 'proef.js').wortels;
const namen = (bron) => wortelsVan(bron).map(w => w.naam).sort();

test('een let of var op moduleniveau is altijd een wortel', () => {
  assert.deepEqual(namen('let a = 1;\nvar b = 2;\nconst c = 3;\n'), ['a', 'b'],
    'een const op een getal is geen muteerbare toestand');
});

/* DIT IS DE HELE PRECISIE VAN DE SCANNER. Zonder deze eis staan er honderden
   vaste tabellen in het register en wordt de ratel zinloos. */
test('een const-container telt alleen als er ook echt in geschreven wordt', () => {
  assert.deepEqual(namen('const LANDEN = ["nl", "be"];\nconst T = { a: 1 };\nconst M = new Map();\n'), [],
    'vaste tabellen zijn geen toestand, ook al zijn ze technisch muteerbaar');

  assert.deepEqual(namen('const kaart = new Map();\nfunction zet(k, v) { kaart.set(k, v); }\n'), ['kaart']);
  assert.deepEqual(namen('const lijst = [];\nfunction voeg(x) { lijst.push(x); }\n'), ['lijst']);
  assert.deepEqual(namen('const stel = new Set();\nfunction voeg(x) { stel.add(x); }\n'), ['stel']);
  assert.deepEqual(namen('const o = {};\nfunction zet(k, v) { o[k] = v; }\n'), ['o']);
  assert.deepEqual(namen('const o = {};\nfunction vul(x) { Object.assign(o, x); }\n'), ['o'],
    'Object.assign muteert zijn eerste argument -- zonder dat zou dit een tabel lijken');

  /* En lezen maakt van een tabel geen toestand: dat is precies het verschil
     tussen 143 en 1123. */
  assert.deepEqual(namen('const kaart = new Map();\nfunction lees(k) { return kaart.get(k) || kaart.has(k) || kaart.size; }\n'), [],
    'get, has en size zijn lezen; daar wordt een tabel geen toestand van');
});

test('alleen bij het laden geschreven = bootvast, en dat wordt afgeleid en niet gegokt', () => {
  const vast = wortelsVan('const kaart = new Map();\nkaart.set("a", 1);\nmodule.exports = kaart;\n');
  assert.equal(vast.length, 1);
  assert.equal(vast[0].naLaden, false, 'alleen op moduleniveau geschreven: staat na de boot vast');

  const beweegt = wortelsVan('const kaart = new Map();\nkaart.set("a", 1);\nfunction zet(k) { kaart.set(k, 1); }\n');
  assert.equal(beweegt[0].naLaden, true, 'ook binnen een functie geschreven: kan na de boot nog bewegen');
});

test('new Date(x) is geen kloklezing, new Date() wel', () => {
  const k = scanBestand('const a = new Date();\nconst b = new Date("2026-01-01");\nconst c = Date.now();\n', 'p.js').klok;
  assert.equal(k.datumLezing, 1, 'new Date() zonder argument leest de klok');
  assert.equal(k.datumBouw, 1, 'new Date(x) bouwt een datum uit iets dat er al was');
  assert.equal(k.dateNow, 1);
  /* Zonder dit onderscheid telt de meter 1788 waar er 1297 zijn, en dan meet je
     bij elke reparatie het verkeerde getal. */
  assert.notEqual(k.datumLezing, k.datumLezing + k.datumBouw, 'de twee horen apart geteld te worden');
});

test('de eigenaar is de map waarin de wortel woont', () => {
  assert.equal(eigenaarVan('server/kern/lid.js'), 'server/kern');
  assert.equal(eigenaarVan('server/db/tx/ledger.js'), 'server/db');
  assert.equal(eigenaarVan('server/betaal.js'), 'server');
});

/* DE VAL DIE IK ER ZELF IN BOUWDE, en die stil regresseert.

   De census gaat door server/lib/bronkas.js zodat hij niet bij elke aanroep
   2,7 seconde kost. Die kas onthoudt zijn bestandsmanifest PER PROCES, en voor
   een draaiende server is dat juist goed: de broncodestand van de START hoort te
   gelden. Maar de meterijking verandert de bron met OPZET en meet daarna
   opnieuw, in hetzelfde proces. Met een onthouden manifest is de sleutel dan
   onveranderd en komt de OUDE census terug.

   Toen ik dat deed gaf een verse boom 143 wortels, en na een bestand met een
   nieuwe wortel erbij gaf de tweede telling in 3 milliseconden opnieuw 143.
   Sindsdien vraagt de scanner om een verse lezing. Deze toets houdt dat vast:
   hij telt twee keer in HETZELFDE proces met een wijziging ertussen. */
test('een tweede census in hetzelfde proces ziet een bestand dat er net bij kwam', () => {
  const boom = maakBoom('censusvers');
  try {
    const { scan } = require('../scripts/lib/staatscan.js');
    const voor = scan({ wortel: boom.pad });
    const p = binnen(boom.pad, path.join(boom.pad, 'server', 'kern', 'zz-censusproef.js'));
    fs.writeFileSync(p, 'let ijkTeller = 0;\nfunction tik() { ijkTeller++; }\nmodule.exports = { tik };\n');

    const na = scan({ wortel: boom.pad });
    assert.equal(na.wortels.length, voor.wortels.length + 1,
      'de census kwam uit de kas terwijl de bron veranderd was: de sleutel is niet meebewogen');
    assert.ok(na.wortels.some(w => w.id === 'server/kern/zz-censusproef.js#ijkTeller'),
      'en de nieuwe wortel hoort er met naam in te staan');

    /* En de andere kant: zonder wijziging hoort hij WEL uit de kas te komen,
       anders is de hele kas weg en kost elke meting weer seconden. */
    const t0 = Date.now();
    const nogmaals = scan({ wortel: boom.pad });
    const kosten = Date.now() - t0;
    assert.equal(nogmaals.wortels.length, na.wortels.length);
    assert.ok(kosten < 1000,
      'een onveranderde boom hoort uit de kas te komen; ' + kosten + ' ms betekent dat hij opnieuw telde');
  } finally { boom.ruimOp(); }
});

/* DE ECHTE BOOM. Hier hoort niets ongeregistreerd te staan; dat is de hele
   afspraak. Zakt dit, dan heeft iemand muteerbare toestand toegevoegd zonder
   er een eigenaar bij te zetten. */
test('alle muteerbare toestand in server/ staat in STATE.json', () => {
  const beeld = staat.meet();
  assert.ok(beeld.register, 'STATE.json hoort te bestaan');
  assert.deepEqual(beeld.ongeregistreerd.map(w => w.id), [],
    'muteerbare toestand zonder eigenaar maakt elke gedeelde server onbetrouwbaar; ' +
    'draai node scripts/staat.js --vastleggen en geef hem daarna een levensduur');
  assert.deepEqual(beeld.verdwenen, [], 'het register noemt wortels die niet meer bestaan');
  assert.ok(beeld.uitslag.wortels.length > 50,
    'de scan hoort echt wortels te vinden (' + beeld.uitslag.wortels.length + '); een lege uitslag zou hier groen zijn om de verkeerde reden');
  assert.equal(beeld.uitslag.onleesbaar.length, 0,
    'elk serverbestand hoort door de eigen parser te komen; wat niet gelezen wordt, wordt ook niet geteld');
});

test('elke geregistreerde wortel heeft een eigenaar en een geldige klasse', () => {
  const reg = staat.leesRegister();
  for (const [id, r] of Object.entries(reg.wortels)) {
    assert.ok(r.eigenaar, id + ' heeft geen eigenaar');
    assert.ok(staat.KLASSEN.includes(r.levensduur), id + ' heeft een onbekende klasse: ' + r.levensduur);
    /* Wie zegt herstelbaar te zijn, moet zeggen HOE -- anders is het een
       belofte en geen contract (LAT-regel 6). */
    if (r.levensduur === 'herstelbaar') {
      assert.ok(r.reset && r.reset !== 'onbekend', id + ' heet herstelbaar maar noemt geen reset');
      assert.ok(r.bewijs, id + ' heet herstelbaar maar noemt geen bewijs dat die reset werkt');
    }
  }
});

/* En de poort zelf: nieuwe toestand hoort de ronde ROOD te maken. In een
   wegwerpkopie, want deze toets mag de gedeelde boom niet muteren (check.js
   regel 51). */
test('nieuwe muteerbare toestand zonder registratie geeft exitcode 1', () => {
  const boom = maakBoom('staatpoort');
  try {
    const schoon = execFileSync(process.execPath, [path.join(boom.pad, 'scripts', 'staat.js'), '--json'],
      { cwd: boom.pad, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(schoon).ongeregistreerd, [], 'de kopie hoort schoon te beginnen');

    const p = binnen(boom.pad, path.join(boom.pad, 'server', 'kern', 'zz-staatproef.js'));
    fs.writeFileSync(p, 'let ijkTeller = 0;\nfunction tik() { ijkTeller++; }\nmodule.exports = { tik };\n');

    let code = 0, uit = '';
    try {
      uit = execFileSync(process.execPath, [path.join(boom.pad, 'scripts', 'staat.js'), '--json'],
        { cwd: boom.pad, encoding: 'utf8' });
    } catch (e) { code = e.status; uit = e.stdout || ''; }
    assert.equal(code, 1, 'ongeregistreerde toestand hoort exitcode 1 te geven, niet 0');
    assert.deepEqual(JSON.parse(uit).ongeregistreerd, ['server/kern/zz-staatproef.js#ijkTeller'],
      'en hij hoort precies te zeggen WELKE wortel er niemand van is');

    // en de echte boom is niet aangeraakt
    assert.equal(fs.existsSync(path.join(WORTEL, 'server', 'kern', 'zz-staatproef.js')), false,
      'deze proef hoort in de wegwerpkopie te gebeuren');
  } finally { boom.ruimOp(); }
});
