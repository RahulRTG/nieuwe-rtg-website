/* DE MERKKERN IS DE ENIGE BRON -- en dat is een structuurbewering, geen wens.

   Dit huis had het merk-idee vier keer: kern/tenant/merkkern.js (de definitie),
   kern/theater/huisstijl.js, kern/webmerk.js en kern/journalistiek.js. Vier
   kopieen van "een accentkleur is een hexcode" en "een thema is licht of
   donker". Ze waren AL uit elkaar gelopen, en niet op een detail:

     Theater        -> 400 met "een accentkleur is een hexcode"
     Webmerk        -> 200, kleur stil genegeerd
     Journalistiek  -> 200, kleur stil genegeerd

   Voor wie de knop indrukt is dat het verschil tussen weten dat het niet mocht
   en denken dat het gelukt is. De stille variant is de erge, en hij was in de
   meerderheid.

   Deze toets heeft daarom twee helften:

   1. DE WAARDEREGELS, op de plek waar ze nu wonen. Wat is een geldige kleur,
      een geldig thema, een geldig logo, en wat gebeurt er met een lege waarde.
   2. DE STRUCTUUR. De drie consumenten LEZEN de definitie en dragen er zelf
      geen kopie meer van. Zonder deze helft komt de vijfde kopie er gewoon
      weer bij, en dan zakt er niets -- en dat is precies hoe het de eerste
      keer is gegaan.

   Wat hier NIET staat: dat de drie hetzelfde OPSLAAN. Dat doen ze met opzet
   niet -- het Theater bewaart per kanaal, Webmerk per keten, de tenant per org,
   en die drie hebben een verschillende scope. Ook de leesstandaard mag
   verschillen (een krant staat standaard op licht, een werkruimte op donker).
   Alleen wat GELDIG is, is overal hetzelfde.

   Draai los: node --test test/merkkern.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const merkkern = require('../server/kern/tenant/merkkern');

const WORTEL = path.join(__dirname, '..');
const schoon = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

/* De drie die de definitie horen te LEZEN. */
const LEZERS = [
  ['server/kern/theater/huisstijl.js', "require('../tenant/merkkern')"],
  ['server/kern/webmerk.js', "require('./tenant/merkkern')"],
  ['server/kern/journalistiek.js', "require('./tenant/merkkern')"]
];

test('1. een accentkleur is een hexcode, en hij komt in een vaste vorm terug', () => {
  for (const fout of ['rood', 'bordeaux', '#FFF', '#GG1122', '', '#7F1634 ', 1]) {
    const r = merkkern.leesMerkvelden({ accent: fout }, {}, schoon);
    assert.ok(r.error, 'geweigerd: ' + JSON.stringify(fout));
    assert.match(r.error, /hexcode/);
    assert.equal(r.status, 400);
  }
  assert.equal(merkkern.leesMerkvelden({ accent: '#1b7f5a' }, {}, schoon).merk.accent, '#1B7F5A',
    'kleine letters komen als hoofdletters terug -- anders staan dezelfde kleur en dezelfde kleur niet gelijk');
});

test('2. een thema is licht of donker, en verder niets', () => {
  for (const fout of ['neon', 'DONKER', 'dark', '', 0]) {
    const r = merkkern.leesMerkvelden({ thema: fout }, {}, schoon);
    assert.ok(r.error, JSON.stringify(fout));
    assert.match(r.error, /licht of donker/);
  }
  assert.equal(merkkern.leesMerkvelden({ thema: 'licht' }, {}, schoon).merk.thema, 'licht');
});

test('3. een logo is een klein beeld, en leeg betekent weg', () => {
  const groot = 'data:image/png;base64,' + 'A'.repeat(merkkern.MAX_LOGO);
  assert.match(merkkern.leesMerkvelden({ logo: groot }, {}, schoon).error, /tot 60 kB/);
  assert.match(merkkern.leesMerkvelden({ logo: 'https://ergens/logo.png' }, {}, schoon).error, /png/,
    'een verwijzing naar buiten is geen logo: dat zou een baken in elk scherm zijn');
  assert.match(merkkern.leesMerkvelden({ logo: 'data:image/svg+xml;base64,PHN2Zz4=' }, {}, schoon).error, /png/,
    'en svg niet, want dat is een document met script erin en geen beeld');

  const met = merkkern.leesMerkvelden({ logo: 'data:image/png;base64,iVBORw0KGgo=' }, {}, schoon).merk;
  assert.ok(met.logo);
  assert.equal(merkkern.leesMerkvelden({ logo: '' }, met, schoon).merk.logo, undefined, 'leeg haalt hem weg');
});

test('4. wat je niet meestuurt, verandert niet', () => {
  const huidig = { naam: 'Bakkerij Imran', accent: '#1B7F5A', thema: 'licht' };
  const uit = merkkern.leesMerkvelden({ payoff: 'Elke dag vers' }, huidig, schoon).merk;
  assert.equal(uit.naam, 'Bakkerij Imran');
  assert.equal(uit.accent, '#1B7F5A');
  assert.equal(uit.payoff, 'Elke dag vers');
  assert.notEqual(uit, huidig, 'en het gaat om een kopie, niet om het origineel');
  assert.equal(huidig.payoff, undefined, 'het origineel is niet aangeraakt');
});

/* ---------- de tweede helft: de structuur ---------- */

test('5. de drie consumenten LEZEN de definitie', () => {
  for (const [rel, verwacht] of LEZERS) {
    const bron = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    assert.ok(bron.includes(verwacht), rel + ' hoort ' + verwacht + ' te doen');
  }
});

test('6. en dragen er zelf geen kopie meer van', () => {
  /* De twee vormen die de kopieen aannamen. Wie er een vijfde bijzet, zakt
     hier -- en dat is de hele reden dat deze toets bestaat: zonder hem komt de
     kopie terug en merkt niemand het, precies zoals de eerste keer. */
  const KOPIEVORMEN = [
    [/#\[0-9a-fA-F\]\{6\}/, 'een eigen hexcontrole op een merkkleur'],
    [/\[\s*'licht'\s*,\s*'donker'\s*\]/, 'een eigen lijst met geldige themas']
  ];
  for (const [rel] of LEZERS) {
    const bron = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    /* Het commentaar telt niet mee: dat mag de oude vorm juist NOEMEN om uit
       te leggen waarom hij weg is. */
    const code = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const [patroon, wat] of KOPIEVORMEN)
      assert.ok(!patroon.test(code), rel + ' draagt nog ' + wat);
  }
});

test('7. de definitie zelf noemt waar het merk OPHOUDT', () => {
  /* Een opsomming van wat een merk kan, zonder de zin waar het ophoudt, leest
     als dekking. De grens hoort in het manifest zelf te zitten en niet in een
     document ernaast, want een scherm leest het manifest en geen document. */
  assert.match(merkkern.GRENS, /eigen domein bestaat hier niet/);
  assert.match(merkkern.GRENS, /e-mail, documenten en meldingen/);
});
