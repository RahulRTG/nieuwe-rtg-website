#!/usr/bin/env node
/* ============================================================================
   DE TOEVALSCHULD -- hoeveel van dit huis gooit zijn eigen munt op?

   WAAROM DIT ER IS. server/lib/toeval.js maakt het MOGELIJK om het toeval vast
   te zetten (RTG_ZAAD). Dat is niet hetzelfde als dat het WERKT: een module die
   `Math.random()` blijft aanroepen trekt zich van dat zaad niets aan. Een
   herhaalbare ronde is dus precies zoveel waard als het aantal modules dat
   meedoet, en dat aantal hoort een kant op te lopen.

   Zonder dit script zou het zaad een voorziening zijn waarvan niemand weet hoe
   ver hij reikt -- en dat is erger dan geen zaad, want dan denkt de volgende
   lezer dat een herhaalde ronde iets bewijst terwijl er onderweg nog vijftig
   keer een echte munt is opgegooid. Precies dezelfde redenering als bij
   scripts/klok.js, en met opzet dezelfde vorm: wie de een kent, kent de ander.

   WAT ER GETELD WORDT: `Math.random()`. En met opzet NIET crypto.randomBytes en
   familie. Dat is geen omissie maar de grens zelf: een sessietoken, een pincode
   of een entreecode hoort ONvoorspelbaar te zijn, ook als je het zaad kent. Wie
   die zou meetellen, zou een schuld maken die nooit nul mag worden -- en een
   ratel die zijn nul niet kan halen, wordt uitgezet.

   DE RATEL. TOEVAL.json houdt de stand vast. Meer directe aanroepen dan
   opgeschreven: de poort gaat dicht. Minder: leg het vast met --vastleggen.

   Draai:  node scripts/toeval.js
           node scripts/toeval.js --vastleggen
           node scripts/toeval.js --top
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { loopMap } = require('./lib/routes');
const { scanBestand } = require('./lib/staatscan.js');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'TOEVAL.json');
const ZAADPAD = require.resolve(path.join(WORTEL, 'server', 'lib', 'toeval.js'));
const argv = process.argv.slice(2);
const VASTLEGGEN = argv.includes('--vastleggen');
const TOP = argv.includes('--top');

/* WIE MAG WEL RECHTSTREEKS. Elk met een reden; staat er geen reden, dan hoort
   het hier niet -- dezelfde regel als bij de klokschuld. */
const MAG = new Map([
  ['server/lib/toeval.js', 'DIT IS het toeval; hij moet ergens een echte munt opgooien']
]);

function tel() {
  const perBestand = {};
  const onleesbaar = [];
  let totaal = 0, gebruikers = 0, metCrypto = 0;
  loopMap(path.join(WORTEL, 'server'), /\.js$/, (f) => {
    const rel = path.relative(WORTEL, f).replace(/\\/g, '/');
    let bron;
    try { bron = fs.readFileSync(f, 'utf8'); } catch (e) { return; }
    /* Een binair bestand met een .js-naam laat een grep struikelen; hier valt
       hij er stil uit, net als bij de klokschuld. */
    if (bron.includes('\0')) return;
    /* Wie zit er op het zaad? Het pad wordt RESOLVED en niet gematcht: een
       `require('./toeval')` kan ook een heel andere buurmodule bedoelen, en een
       meter die de voorziening te groot voorstelt is vals groen. */
    for (const m of bron.matchAll(/require\((['"])([^'"]+)\1\)/g)) {
      if (!m[2].startsWith('.')) continue;
      let doel;
      try { doel = require.resolve(path.resolve(path.dirname(f), m[2])); } catch (e) { continue; }
      if (doel === ZAADPAD) { gebruikers++; break; }
    }
    if (MAG.has(rel)) return;
    let w;
    try { w = scanBestand(bron, rel).willekeur; }
    catch (e) {
      /* Een serverbestand dat de eigen parser niet leest is GEEN nul. Stil
         overslaan zou de schuld te laag maken. */
      onleesbaar.push(rel);
      return;
    }
    if (w.crypto) metCrypto++;
    if (w.math) { perBestand[rel] = w.math; totaal += w.math; }
  });
  return { totaal, bestanden: Object.keys(perBestand).length, gebruikers, metCrypto, perBestand, onleesbaar };
}

const nu = tel();
const oud = (() => { try { return JSON.parse(fs.readFileSync(UITSLAG, 'utf8')); } catch (e) { return null; } })();

console.log('\n=== DE TOEVALSCHULD ===\n');
console.log('  directe Math.random-aanroepen : ' + nu.totaal);
console.log('  in bestanden                  : ' + nu.bestanden);
console.log('  modules op het zaad           : ' + nu.gebruikers);
console.log('  bestanden met crypto-toeval   : ' + nu.metCrypto + '  (tellen NIET mee: die horen onvoorspelbaar te zijn)');
console.log('  vrijgesteld                   : ' + MAG.size + '  (met reden, zie MAG in dit bestand)');
if (nu.onleesbaar.length) {
  console.error('\n  NIET GETELD, want de eigen parser komt er niet door (' + nu.onleesbaar.length + '):');
  for (const f of nu.onleesbaar.slice(0, 5)) console.error('    ' + f);
  console.error('  Ongetelde bestanden maken de schuld te laag; los dit op voordat je vastlegt.');
  process.exitCode = 1;
}

if (TOP) {
  console.log('\n  de zwaarste bestanden:');
  Object.entries(nu.perBestand).sort((a, b) => b[1] - a[1]).slice(0, 30)
    .forEach(([f, n]) => console.log('    ' + String(n).padStart(4) + '  ' + f));
}

const stand = {
  uitleg: 'Directe Math.random-aanroepen in server/. MAG ALLEEN KRIMPEN -- zie test/toeval.test.js. ' +
    'Wie zijn eigen munt opgooit doet niet mee aan RTG_ZAAD, en een ronde die je overdoet ' +
    'verloopt dan alsnog anders. crypto.randomBytes telt hier met opzet NIET mee: dat hoort ' +
    'onvoorspelbaar te zijn, ook met een zaad.',
  hoe: 'node scripts/toeval.js --top',
  gemeten: { totaal: nu.totaal, bestanden: nu.bestanden, modulesOpHetZaad: nu.gebruikers,
    bestandenMetCryptoToeval: nu.metCrypto },
  vrijgesteld: [...MAG.entries()].map(([f, r]) => ({ bestand: f, reden: r }))
};

if (VASTLEGGEN) {
  if (oud && nu.totaal > oud.gemeten.totaal) {
    console.log('\n  GEWEIGERD: ' + oud.gemeten.totaal + ' -> ' + nu.totaal +
      '. De ratel legt geen verslechtering vast.');
    process.exit(1);
  }
  fs.writeFileSync(UITSLAG, JSON.stringify(stand, null, 2) + '\n');
  console.log('\n  vastgelegd in TOEVAL.json');
  process.exit(0);
}

if (!oud) { console.log('\n  Nog geen TOEVAL.json. Leg de stand vast met --vastleggen.'); process.exit(0); }
if (nu.totaal > oud.gemeten.totaal) {
  console.log('\n  ZAKT: ' + oud.gemeten.totaal + ' -> ' + nu.totaal +
    ' (+' + (nu.totaal - oud.gemeten.totaal) + ').');
  console.log('  Er staat nieuwe code buiten het zaad. Laat de nieuwe module zijn toeval halen');
  console.log('  bij server/lib/toeval.js -- kans() voor een getal, kies() voor een element,');
  console.log('  geheel() voor een geheel getal, schud() voor een rij -- in plaats van Math.random.');
  console.log('  Hoort het juist ONvoorspelbaar te zijn (een token, een code, een pincode),');
  console.log('  gebruik dan crypto.randomBytes: die telt hier niet mee, en dat is de bedoeling.');
  process.exit(1);
}
if (nu.totaal < oud.gemeten.totaal) {
  console.log('\n  BETER: ' + oud.gemeten.totaal + ' -> ' + nu.totaal + '. Zet de ratel strakker met --vastleggen.');
  process.exit(0);
}
console.log('\n  De stand is gelijk aan TOEVAL.json.');
process.exit(0);
