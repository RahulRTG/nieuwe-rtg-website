/* ============================================================================
   HET REGRESSIECORPUS VAN DE LCOV-SAMENVOEGING.

   Deze code bepaalt of de dekkingsvloer wordt gehaald wanneer de suite over
   parallelle scherven is verdeeld. Rekent hij te RUIM, dan glipt er code onder
   de vloer door en merkt niemand het; rekent hij te KRAP, dan zakt de bouw op
   iets dat niet stuk is en gaat de vloer omlaag "omdat hij toch niet klopt".
   Allebei erg, en het tweede is verraderlijker.

   DE REGEL DIE ALLES DRAAGT: een regel is gedekt als MINSTENS EEN scherf hem
   heeft aangeraakt -- precies wat het ene proces ook deed. En een gemiste regel
   blijft gemist, hoe vaak hij ook in de scherven voorkomt.

   DE MUTATIE VOOR DIT BESTAND: laat tel() de LF/LH uit het lcov-bestand
   overnemen in plaats van ze opnieuw te rekenen -> "dezelfde regel in twee
   scherven telt een keer" zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ontleed, voegSamen, tel } = require('../scripts/lib/lcov');

const scherfA = [
  'TN:', 'SF:/rtg/server/a.js',
  'FN:3,doe', 'FNDA:2,doe', 'FN:9,stil', 'FNDA:0,stil',
  'DA:3,2', 'DA:4,2', 'DA:9,0',
  'BRDA:4,0,0,1', 'BRDA:4,0,1,-',
  'LF:3', 'LH:2', 'end_of_record'
].join('\n');

const scherfB = [
  'TN:', 'SF:/rtg/server/a.js',
  'FN:3,doe', 'FNDA:1,doe', 'FN:9,stil', 'FNDA:5,stil',
  'DA:3,1', 'DA:4,0', 'DA:9,5',
  'BRDA:4,0,0,0', 'BRDA:4,0,1,3',
  'LF:3', 'LH:2', 'end_of_record',
  'TN:', 'SF:/rtg/server/b.js',
  'FN:1,alleen', 'FNDA:0,alleen', 'DA:1,0',
  'LF:1', 'LH:0', 'end_of_record'
].join('\n');

test('een regel is gedekt als MINSTENS EEN scherf hem raakte', () => {
  const s = voegSamen([scherfA, scherfB]);
  const a = s.get('/rtg/server/a.js');
  assert.equal(a.regels.get('3'), 3, '2 + 1');
  assert.equal(a.regels.get('4'), 2, 'alleen scherf A raakte hem');
  assert.equal(a.regels.get('9'), 5, 'alleen scherf B raakte hem');
});

test('dezelfde regel in twee scherven telt ÉÉN keer in de noemer', () => {
  /* DE FOUT DIE HIER HET MAKKELIJKST IN SLUIPT: de LF/LH-tellingen uit de
     bestanden bij elkaar optellen. Dan heeft a.js zes regels in plaats van drie
     en klopt het percentage niet meer -- en het is een percentage waar een
     poort aan hangt. */
  const t = tel(voegSamen([scherfA, scherfB]));
  assert.equal(t.regels.totaal, 4, 'drie regels in a.js en een in b.js');
  assert.equal(t.regels.gedekt, 3, 'alleen b.js regel 1 bleef ongedekt');
  assert.equal(t.regels.pct, 75);
});

test('een gemiste regel blijft gemist, in hoeveel scherven hij ook staat', () => {
  const t = tel(voegSamen([scherfB, scherfB, scherfB]));
  const b = voegSamen([scherfB, scherfB, scherfB]).get('/rtg/server/b.js');
  assert.equal(b.regels.get('1'), 0);
  assert.ok(t.regels.pct < 100, 'nul plus nul plus nul blijft nul');
});

test('functies worden per NAAM opgeteld, niet per voorkomen', () => {
  const s = voegSamen([scherfA, scherfB]);
  const a = s.get('/rtg/server/a.js');
  assert.equal(a.functies.get('doe'), 3, '2 + 1');
  assert.equal(a.functies.get('stil'), 5, '0 + 5 -- in A ongedekt, in B wel');
  const t = tel(s);
  assert.equal(t.functies.totaal, 3, 'doe, stil, alleen');
  assert.equal(t.functies.gedekt, 2);
});

test('een tak die in de ene scherf nooit is bereikt (-), telt de andere niet weg', () => {
  /* `-` betekent "dit blok is nooit bereikt". Dat mag een echte treffer in een
     andere scherf niet wissen -- anders daalt de dekking juist doordat je
     verdeelt, en dat is het tegenovergestelde van de bedoeling. */
  const s = voegSamen([scherfA, scherfB]);
  const a = s.get('/rtg/server/a.js');
  assert.equal(a.takken.get('4:0:0'), 1, '1 + 0');
  assert.equal(a.takken.get('4:0:1'), 3, '- telt als 0, plus 3');
  const t = tel(s);
  assert.equal(t.takken.gedekt, 2);
  assert.equal(t.takken.totaal, 2);
});

test('een bestand dat maar in ÉÉN scherf voorkomt, gaat niet verloren', () => {
  const t = tel(voegSamen([scherfA, scherfB]));
  assert.equal(t.bestanden, 2, 'b.js komt alleen in scherf B voor en telt gewoon mee');
});

test('een functie die alleen als FN staat en nooit als FNDA, telt als ongedekt', () => {
  /* Zonder deze regel verdwijnt een nooit-aangeroepen functie uit de noemer, en
     dan stijgt de dekking door code die NIET wordt getoetst. */
  const t = tel(voegSamen(['SF:/x.js\nFN:1,nooit\nDA:1,0\nend_of_record']));
  assert.equal(t.functies.totaal, 1);
  assert.equal(t.functies.gedekt, 0);
});

test('nul scherven en lege invoer geven geen onzin', () => {
  const t = tel(voegSamen([]));
  assert.equal(t.bestanden, 0);
  assert.equal(t.regels.pct, 100, 'niets te meten is niet hetzelfde als niets gedekt');
  assert.equal(ontleed('').size, 0);
  assert.equal(ontleed('DA:1,1\nend_of_record').size, 0, 'regels zonder SF horen nergens bij');
});

test('na end_of_record hoort een losse regel bij NIEMAND', () => {
  /* Zonder deze grens plakt alles wat na een record komt aan het vorige bestand
     vast. Dat verzint dekking die er niet is -- de gevaarlijkste kant, want de
     vloer wordt dan gehaald met regels die nooit zijn uitgevoerd. */
  const s = ontleed('SF:/x.js\nDA:1,1\nend_of_record\nDA:99,1\nFNDA:4,zwerver');
  assert.equal(s.size, 1);
  const x = s.get('/x.js');
  assert.equal(x.regels.size, 1, 'alleen regel 1, niet regel 99');
  assert.ok(!x.regels.has('99'));
  assert.equal(x.functies.size, 0, 'en de zwervende functie hoort er ook niet bij');
});

test('samenvoegen is commutatief -- de volgorde van de scherven doet er niet toe', () => {
  const heen = tel(voegSamen([scherfA, scherfB]));
  const terug = tel(voegSamen([scherfB, scherfA]));
  assert.deepEqual(heen, terug);
});

/* ----------------------------------------------------------------------------
   DE WACHTER DIE SCHERVEN TELT, EN NIET BESTANDEN.

   De vloer is fail-closed: ontbreekt er een scherf, dan wordt er niet gerekend.
   Die wachter telde bestanden, en dat is iets anders -- elke scherf schreef in
   CI naar dezelfde bestandsnaam, dus na het samenvoegen van de artefacten bleef
   er van vier scherven een handvol bestanden over die elkaar hadden
   overschreven. De bouw zakte op "er ontbreken scherven" terwijl alle vier
   hadden geupload. Sinds de bestandsnaam zijn scherfnummer draagt, leest de
   wachter dat nummer terug. Deze twee toetsen houden dat vast: een scherf die
   twee bestanden oplevert telt een keer, en een scherf die er nul oplevert valt
   op MET zijn nummer.
   -------------------------------------------------------------------------- */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const VLOER = path.join(__dirname, '..', 'scripts', 'dekkingsvloer.js');
const DEKKING = ['TN:', 'SF:/rtg/server/z.js', 'DA:1,1', 'LF:1', 'LH:1',
  'BRF:0', 'BRH:0', 'FNF:0', 'FNH:0', 'end_of_record'].join('\n');

function draaiVloer(namen) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scherven-'));
  for (const n of namen) fs.writeFileSync(path.join(map, n), DEKKING + '\n');
  const uit = spawnSync(process.execPath, [VLOER, '--map', map, '--scherven', '4'], { encoding: 'utf8' });
  fs.rmSync(map, { recursive: true, force: true });
  return { code: uit.status, tekst: (uit.stdout || '') + (uit.stderr || '') };
}

test('vier scherven, waarvan een met twee bestanden: de wachter laat door', () => {
  const uit = draaiVloer(['scherf-1.info', 'scherf-2.info', 'solo-2.info', 'scherf-3.info', 'scherf-4.info']);
  assert.equal(uit.code, 0, uit.tekst);
  assert.match(uit.tekst, /scherven met dekking: 1, 2, 3, 4/);
});

test('een ontbrekende scherf zakt, en de melding noemt welke', () => {
  const uit = draaiVloer(['scherf-1.info', 'scherf-2.info', 'scherf-4.info']);
  assert.equal(uit.code, 1, uit.tekst);
  assert.match(uit.tekst, /scherf 3 ontbreekt/);
});
