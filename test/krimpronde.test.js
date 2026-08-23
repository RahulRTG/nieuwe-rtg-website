/* DE KRIMPRONDE MOET KUNNEN ZEGGEN "IK WEET HET NIET".

   scripts/krimpronde.js leest een suite-log en bouwt de catalogus van legitieme
   grote krimpen die TAKEN.md 4.62 eist voordat RTG_BEGROTING=weigeren aan kan.
   Zijn gevaarlijkste uitslag is niet een fout getal maar een LEEG getal dat op
   een uitslag lijkt: "nul meldingen" betekent er kromp niets OF de val stond
   niet aan, en die twee zijn niet uit elkaar te houden zonder bewijs.

   Dat bewijs is het levensteken -- de regel die server/opzet/begroting.js bij
   zijn eerste installatie schrijft, met de grens erin. Deze toets bewaakt de
   drie manieren waarop dat mis kan gaan:

     1. het levensteken ontbreekt          -> geen uitslag, en dat zegt hij
     2. het levensteken staat op de standaardgrens -> de ronde meet niets, en dat zegt hij
     3. de tekst van de regel loopt uiteen -> de twee bestanden dragen een
        gezamenlijke waarheid (LAT.md regel 4), en die wordt hier vastgeprikt
        aan de ECHTE regel die de begroting schrijft, niet aan een nagetypte.

   WAT DEZE TOETS NIET ZIET: of de suite de begroting ook echt LANGS komt. Dat
   is een eigenschap van de ronde, niet van dit script; krimpronde.js zegt in
   zijn eigen kop dat zijn catalogus een ondergrens is.

   Draai los: node --test test/krimpronde.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
/* Deze require doet twee dingen. Hij haalt de standaardgrens uit de module in
   plaats van hem hier over te typen -- en hij is het enige spoor waaraan
   scripts/mutatie.js kan zien WELKE module deze toets onderzoekt: die motor
   zoekt letterlijk require('../server/...'), en require.resolve() telt niet
   mee. Zonder hem meldt hij "geen module gevonden" en telt dit bestand als
   niet gemeten. */
const BEGROTING = require('../server/opzet/begroting');

const WORTEL = path.join(__dirname, '..');
const RONDE = path.join(WORTEL, 'scripts', 'krimpronde.js');

function draai(logtekst) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'krimp-')), 'x.log');
  fs.writeFileSync(p, logtekst);
  const r = spawnSync(process.execPath, [RONDE, '--lees', p], { encoding: 'utf8' });
  try { fs.rmSync(path.dirname(p), { recursive: true, force: true }); } catch (e) {}
  return { code: r.status, uit: (r.stdout || '') + (r.stderr || '') };
}

/* DE ECHTE REGEL, opgehaald bij de bron. Zou iemand het bericht in begroting.js
   veranderen, dan verandert deze invoer mee en zakt niet deze toets maar de
   ronde -- precies andersom als het zou moeten. Daarom staat er hieronder OOK
   een toets die eist dat de ronde die letterlijke regel herkent. */
function echteLevensteken(grens, installaties) {
  const regels = [];
  const mod = requireVers();
  const log = (niveau, bericht, velden) =>
    regels.push(new Date().toISOString() + ' ' + niveau.toUpperCase().padEnd(5) + ' ' +
      bericht + ' ' + JSON.stringify(velden));
  /* Elke installatie krijgt een EIGEN object, want bewaak() geeft voor dezelfde
     data dezelfde wikkel terug -- twee keer hetzelfde object zou de val nooit
     een tweede keer installeren en de proef hieronder waardeloos maken. */
  for (let i = 0; i < (installaties || 1); i++) mod.bewaak({ ['iets' + i]: [] }, { grens, log });
  return regels;
}

/* Het levensteken valt EEN keer per proces. Deze toets heeft er meerdere nodig
   met verschillende grenzen, dus moet de module echt opnieuw geladen worden. */
function requireVers() {
  const p = require.resolve('../server/opzet/begroting');
  delete require.cache[p];
  return require(p);
}

test('zonder levensteken is het GEEN uitslag, en de ronde zegt dat met exitcode 2', () => {
  const r = draai('ok 1 - van alles\nok 2 - en nog wat\n');
  assert.equal(r.code, 2, 'een log zonder levensteken hoort geen groene uitslag te geven');
  assert.match(r.uit, /GEEN ENKEL LEVENSTEKEN/);
});

test('DE VAL WAAR HIJ IN LIEP: een toetsnaam over een projectbegroting is geen bewijs', () => {
  /* Dit is de echte regel uit de eerste ronde. De eerste versie van dit script
     zocht op /begroting:/ en zou hierop hebben gemeld "de begroting was aan het
     woord" -- over een ronde waarin de module geen letter schreef. */
  const r = draai('ok 5596 - begroting: een project kent zijn nulmeting, zijn uitgaven en zijn effect\n');
  assert.equal(r.code, 2, 'een TOETSNAAM met het woord begroting telt ten onrechte als bewijs');
});

test('een ronde op de STANDAARDGRENS meet niets, en dat is ook geen uitslag', () => {
  const regels = echteLevensteken(BEGROTING.STANDAARDGRENS);
  const r = draai(regels.join('\n') + '\n');
  assert.equal(r.code, 2,
    'een ronde op ' + BEGROTING.STANDAARDGRENS + ' zegt niets over wat daaronder gebeurt');
  assert.match(r.uit, /STANDAARDGRENS/);
});

test('met het levensteken op 1 en geen meldingen is nul een ECHTE uitslag', () => {
  const regels = echteLevensteken(1);
  const r = draai(regels.join('\n') + '\n');
  assert.equal(r.code, 0, r.uit);
  assert.match(r.uit, /processen met de val aan\s*:\s*1/);
  assert.match(r.uit, /GEEN ENKELE collectie kromp/);
});

test('DE BRUG: de ronde herkent de regel die de begroting ECHT schrijft', () => {
  /* Twee bestanden dragen hier een gezamenlijke waarheid: het bericht
     "begroting: waakt" en het veld "grens". Zou een van de twee verschuiven,
     dan valt de ronde stil terug op "geen uitslag" -- luidruchtig, maar pas als
     iemand hem draait. Deze toets is het moment waarop dat meteen opvalt. */
  /* EEN KEER PER PROCES, en dat is geen netheid maar een getal. De ronde telt
     deze regels en publiceert ze als "processen met de val aan". Valt hij bij
     elke installatie, dan telt hij processen die er niet zijn -- en een te hoog
     getal leest als meer dekking dan er is. redis.js vervangt db.data bij elke
     externe wijziging, dus dat verschil is in productie niet klein. */
  const regels = echteLevensteken(7, 4);
  assert.equal(regels.length, 1,
    'de begroting schrijft geen levensteken meer, of een per installatie in plaats van per proces');
  assert.match(regels[0], /begroting: waakt/, 'het bericht is veranderd; de ronde zoekt nog het oude');
  assert.match(regels[0], /"grens":7/, 'de grens staat niet meer in de regel; de ronde kan hem niet lezen');
  const r = draai(regels[0] + '\n');
  assert.equal(r.code, 0, 'de ronde herkent de echte regel niet meer:\n' + r.uit);
});

test('in de GEWONE stand blijft het levensteken van stdout af', () => {
  /* DIT KOSTTE METEEN EEN METER. Het levensteken stond eerst op `info`, en
     server/log.js stuurt alles onder warn naar STDOUT. Daar zet
     scripts/routekaart.js zijn JSON neer, die `npm run norm` inleest -- en die
     viel dus om op "de routekaart gaf geen routes". Een regel die niets kost in
     de ene bril, breekt een meter in de andere.

     Vandaar: warn (stderr) zodra de stand afwijkt, en debug in de gewone stand
     -- onder de standaarddrempel, dus hij komt er niet eens uit. */
  const stil = [];
  requireVers().bewaak({ a: [] }, { log: (niveau) => stil.push(niveau) });
  assert.deepEqual(stil, ['debug'],
    'de gewone stand hoort DEBUG te zijn: info en hoger komen op stdout terecht, ' +
    'en daar staat de JSON van scripts/routekaart.js');

  const luid = [];
  requireVers().bewaak({ a: [] }, { grens: 1, log: (niveau) => luid.push(niveau) });
  assert.deepEqual(luid, ['warn'],
    'een verlaagde grens hoort WARN te zijn, anders staat het bewijs van de ronde niet in het log');
});

test('de meldingen zelf worden in BEIDE logvormen gelezen, plat en JSON', () => {
  /* server/log.js schrijft JSON als LOG_JSON aanstaat en anders platte tekst.
     De eerste versie van de ronde eiste "bericht":"..." en was dus blind in de
     testmodus -- precies waar hij draait. */
  const teken = echteLevensteken(1)[0];
  const plat = '2026-08-23T20:00:00.000Z WARN  begroting: zou zijn geweigerd ' +
    '{"id":"a1","p":"/api/x","collectie":"leden","rijen":42,"grens":1}';
  const json = '{"t":"2026-08-23T20:00:00.000Z","niveau":"warn","bericht":"begroting: zou zijn geweigerd",' +
    '"id":"a2","p":"/api/y","collectie":"boekingen","rijen":9,"grens":1}';
  const r = draai([teken, plat, json].join('\n') + '\n');
  assert.equal(r.code, 0, r.uit);
  assert.match(r.uit, /leden/, 'de platte logvorm wordt niet gelezen');
  assert.match(r.uit, /boekingen/, 'de JSON-logvorm wordt niet gelezen');
  assert.match(r.uit, /\/api\/x/, 'de route komt niet in de catalogus');
  assert.match(r.uit, /collecties die krimpen\s*:\s*2/);
});
