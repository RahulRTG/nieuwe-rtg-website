/* DE SNELLE SYNTAXZEEF MOET HETZELFDE ZEGGEN ALS node --check.

   Keuringsregel 1 keurt 4823 bestanden. Hij deed dat met een proces per
   bestand (127.619 ms) en doet het nu in-proces met `new vm.Script` (1.188 ms).
   Een keuring honderd keer sneller maken is alleen winst als hij daarna
   HETZELFDE zegt; anders is het een poort die stiller is geworden.

   DAAROM IS DE REFERENTIE HIER `node --check` ZELF en niet een lijst van wat ik
   verwacht. Elk geval gaat langs allebei de wegen en de uitslagen moeten gelijk
   zijn. Dat is dezelfde vorm als test/samlc14n.test.js, dat de eigen
   canonicalisatie naast xmllint legt: onszelf toetsen met onze eigen aanname
   bewijst niets.

   DE SCHERPSTE VAN DE VIJF is de top-level `return`. Die is in een CommonJS-
   module legaal en `node --check` accepteert hem; een KALE `vm.Script` weigert
   hem, want die ontleedt als script. Zonder de wikkel zou de keuring dus rood
   staan op een bestand dat klopt -- en dat is precies het soort valse rood
   waardoor een poort binnen een week wordt uitgezet. De derde toets hieronder
   bewijst dat de wikkel dat verschil maakt, zodat niemand hem later "opruimt".

   Los: node --test test/syntaxproef.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const { syntaxfout } = require('../scripts/lib/syntaxproef');

/* De vijf gevallen. Vier ervan zijn echte vormen die in deze codebase
   voorkomen of konden voorkomen; de vijfde is de val. */
const GEVALLEN = [
  ['echte syntaxfout', 'const a = {;'],
  ['ongesloten haakje', 'function f( { return 1 }'],
  ['ongesloten commentaar', '/* dit sluit nooit\nconst a = 1;'],
  ['top-level return (legaal in CommonJS)', 'if (!process.env.X) return;\nmodule.exports = 1;'],
  ['gewoon geldig bestand', 'const a = 1;\nmodule.exports = { a };']
];

/* De referentie: node zelf, in een eigen proces, precies zoals regel 1 het deed
   voordat hij werd versneld. */
function volgensNode(bron) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-syntaxproef-'));
  const bestand = path.join(dir, 'proef.js');
  try {
    fs.writeFileSync(bestand, bron);
    return spawnSync(process.execPath, ['--check', bestand]).status === 0 ? 'ok' : 'afgekeurd';
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
}

test('de snelle zeef geeft op elk geval hetzelfde oordeel als node --check', () => {
  const verschillen = [];
  for (const [naam, bron] of GEVALLEN) {
    const referentie = volgensNode(bron);
    const snel = syntaxfout(bron, 'proef.js') ? 'afgekeurd' : 'ok';
    if (snel !== referentie) verschillen.push(naam + ': node zegt ' + referentie + ', de zeef zegt ' + snel);
  }
  assert.deepEqual(verschillen, [],
    'de snelle zeef wijkt af van node --check. Een keuring die sneller is maar iets anders zegt, ' +
    'is geen versnelling maar een tweede mening: ' + verschillen.join(' | '));
});

test('DE TEGENPROEF: de zeef keurt echt af, en keurt echt goed', () => {
  /* Zonder deze zou een zeef die ALTIJD null teruggeeft de toets hierboven ook
     halen -- dan is "hetzelfde als node" waar voor de drie kapotte gevallen en
     onwaar zonder dat iemand het merkt, want node keurt die ook af... nee: dan
     zou hij juist afwijken. Maar een zeef die altijd een FOUT teruggeeft haalt
     hem evenmin. Deze toets zegt het hoe dan ook expliciet, zodat de bewering
     niet afhangt van de samenstelling van de lijst hierboven. */
  assert.ok(syntaxfout('const a = {;', 'p.js'), 'een echte syntaxfout hoort te worden afgekeurd');
  assert.equal(syntaxfout('const a = 1;', 'p.js'), null, 'geldige code hoort door te komen');
  assert.match(String(syntaxfout('const a = {;', 'p.js')), /./,
    'en de afkeuring draagt de ontleedfout van node, niet een eigen samenvatting');
});

test('DE WIKKEL IS DE HELE TRUC: zonder hem sneuvelt een legale top-level return', () => {
  /* Dit is de bewering die de reparatie draagt. Zou iemand de wikkel later
     "opruimen" omdat hij er overbodig uitziet, dan zakt deze toets -- en niet
     pas op de dag dat er een module met een vroege return bij komt.

     Precies dat is LAT.md regel 9: een toets die niet kan zakken is slechter
     dan geen toets. Deze kan zakken, en op de goede manier. */
  const bron = 'if (!process.env.X) return;\nmodule.exports = 1;';
  assert.equal(volgensNode(bron), 'ok', 'node --check accepteert een top-level return in CommonJS');
  assert.equal(syntaxfout(bron, 'p.js'), null, 'en de zeef met wikkel dus ook');

  const kaal = () => { try { new vm.Script(bron, { filename: 'p.js' }); return null; } catch (e) { return e.message; } };
  assert.ok(kaal(),
    'een KALE vm.Script hoort dit juist af te keuren -- is dat niet meer zo, dan is de wikkel ' +
    'geen bewezen noodzaak meer en hoort deze toets herschreven, niet weggehaald');
});

test('de zeef leest bron en geen pad, zodat een proef niets op schijf achterlaat', () => {
  /* TAKEN.md 6.11: een ijking die het echte bestand overschrijft en een kill die
     de finally overslaat, laat een spoor achter dat elke latere meting vervuilt.
     Deze sessie is dat opnieuw gebeurd. Een zeef die BRON aanneemt in plaats van
     een pad, kan die fout niet maken. */
  assert.equal(typeof syntaxfout('const a = 1;'), 'object', 'null bij geldige bron, zonder pad');
  assert.equal(syntaxfout('const a = 1;'), null);
});
