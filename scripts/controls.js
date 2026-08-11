#!/usr/bin/env node
/* ============================================================================
   HET CONTROLREGISTER -- welke beheersmaatregel bestaat er, en wanneer is hij
   voor het LAATST bewezen?

   WAAROM DIT ER IS. TOEZICHT.md legt drie lagen op elkaar: bewijzen (Proof
   System), mappen naar wettelijke eisen (Regulatory Evidence), en gecontroleerd
   overleggen (Audit Room). De tweede laag wordt pas gebouwd als de eerste
   inhoudelijk staat -- anders bestaat hij uit lege vakjes.

   Maar één ding moet nu al: elke control moet de velden UITZENDEN die die laag
   straks nodig heeft. Achteraf een id, een eigenaar, een bewijsstuk en een
   grens door twintig bewijzen heen vlechten is een verbouwing; ze meteen
   meegeven kost niets. Dit script verzamelt wat de controls zelf verklaren.

   HET VERSCHIL DAT DIT REGISTER MOET BEWAKEN, en het is het hele punt:

     control AANWEZIG        de voorziening staat in de code
     control RECENT BEWEZEN  een toets heeft hem onlangs zien werken

   Een control die aanwezig is maar al maanden niet bewezen, is geen control
   maar een aanname met een bestandsnaam. Daarom wordt `laatstGroen` hier
   GEMETEN -- de toetsen draaien echt -- en niet overgeschreven uit een
   configuratiebestand. Een register dat zijn eigen groen mag opschrijven, is
   precies de compliance-theater die deze hele stapel moest vermijden.

   Draai:  node scripts/controls.js
           node scripts/controls.js --vastleggen   (meet en schrijft CONTROLS.json)
           node scripts/controls.js --json
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'CONTROLS.json');
const argv = process.argv.slice(2);
const VASTLEGGEN = argv.includes('--vastleggen');
const JSONUIT = argv.includes('--json');

/* WAAR DE CONTROLS WONEN. Bewust een opgeschreven lijst en geen zoektocht over
   de hele boom: een verzamelaar die modules laadt om te kijken of er misschien
   een CONTROL in zit, laadt op enig moment iets met een bijwerking. Een control
   toevoegen is een bewuste handeling en hoort hier een regel te kosten. */
const BRONNEN = [
  'server/lib/keten.js',
  'server/lib/keten-anker.js',
  'server/lib/klok.js',
  'scripts/lib/schermleugen.js',
  'scripts/lib/rolproef.js',
  'scripts/bewijsmatrix.js'
];

const VELDEN = ['control', 'wat', 'eigenaar', 'bewijs', 'bewijsstuk', 'grens'];

/* DE DERDE STAND, en hij is er gekomen doordat dit register de fout maakte die
   het moest voorkomen.

   AUDIT-KETEN-VERANKERD verklaarde zichzelf met inBedrijf:false -- het
   mechanisme is bewezen, maar er wordt nergens een anker weggezet, dus
   beschermt hij niets. De eerste versie van deze verzamelaar keek daar niet
   naar en zette hem GROEN op dertig beweringen. Dat is exact het gat waar
   TOEZICHT.md over gaat: een control die bewijs heeft voor het MECHANISME leest
   dan als een control die WERKT, en dat verschil is bij een wettelijke eis het
   hele verschil.

   Dus drie standen, niet twee: bewezen, ontworpen-maar-niet-in-bedrijf, en niet
   gemeten. Een control die inBedrijf:false verklaart, kan met geen enkele
   testuitslag groen worden. */
function staatVan(control, uitslag) {
  if (control && control.inBedrijf === false) {
    return { ...uitslag, staat: 'NIET IN BEDRIJF',
      mechanismeBewezen: uitslag.staat === 'GROEN',
      reden: 'ontworpen en bewezen, maar niet in gebruik -- zie grens' };
  }
  return uitslag;
}

function verzamel() {
  const uit = [];
  for (const rel of BRONNEN) {
    let mod;
    try { mod = require(path.join(WORTEL, rel)); } catch (e) {
      uit.push({ bron: rel, stuk: 'niet te laden: ' + String((e && e.message) || e).slice(0, 120) });
      continue;
    }
    if (!mod || !mod.CONTROL) { uit.push({ bron: rel, stuk: 'geen CONTROL verklaard' }); continue; }
    uit.push({ bron: rel, ...mod.CONTROL });
  }
  return uit;
}

/* DE METING. De genoemde toetsen echt draaien, en de uitslag stempelen.

   Een e2e-bestand slaat zichzelf over zonder browser, en dat is geen PASS: het
   is "niet gemeten". Die twee door elkaar halen zou een control groen zetten die
   niemand heeft zien werken -- precies waar dit register tegen is. Node's
   testrunner meldt overgeslagen bestanden apart, dus dat verschil is te zien. */
function meet(bewijs) {
  const bestanden = (Array.isArray(bewijs) ? bewijs : []).filter(f =>
    fs.existsSync(path.join(WORTEL, f)));
  if (!bestanden.length) return { staat: 'geen bewijs', at: null };
  let uit;
  try {
    uit = execFileSync(process.execPath,
      ['--experimental-sqlite', '--test', ...bestanden],
      { encoding: 'utf8', cwd: WORTEL, timeout: 900000, maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    uit = String((e && e.stdout) || '');
    const gezakt = Number((uit.match(/^# fail (\d+)/m) || [])[1] || 1);
    return { staat: 'GEZAKT', gezakt, at: new Date().toISOString(), bestanden };
  }
  return { ...duidUitslag(uit), at: new Date().toISOString(), bestanden };
}

/* DE UITSLAG DUIDEN, apart en puur -- want hier zit de regel die dit hele
   register draagt en die dus toetsbaar moet zijn zonder kindprocessen.

   OVERGESLAGEN IS GEEN GROEN. Een e2e-bestand slaat zichzelf over als er geen
   browser is, en Node's testrunner meldt dan keurig nul mislukkingen. Zou dat
   als PASS tellen, dan zet een control zichzelf groen die niemand heeft zien
   werken -- op een kale CI zonder browser precies de controls die het meest
   over de buitenkant beweren. Dat is de fout die dit register moest voorkomen,
   dus staat hij hier met een eigen stand: 'niet gemeten'. */
function duidUitslag(uitvoer) {
  const tekst = String(uitvoer || '');
  const geslaagd = Number((tekst.match(/^# pass (\d+)/m) || [])[1] || 0);
  const overgeslagen = Number((tekst.match(/^# skipped (\d+)/m) || [])[1] || 0);
  if (!geslaagd) return { staat: 'niet gemeten', reden: overgeslagen ? 'alles overgeslagen' : 'geen enkele bewering gedraaid' };
  return { staat: 'GROEN', beweringen: geslaagd, overgeslagen };
}

module.exports = { verzamel, duidUitslag, staatVan, VELDEN, BRONNEN };
if (require.main !== module) return;

const controls = verzamel();
const stuk = controls.filter(c => c.stuk);
const goed = controls.filter(c => !c.stuk);

/* Het contract uit TOEZICHT.md, hier afgedwongen en niet aangenomen. */
const onvolledig = [];
for (const c of goed) {
  for (const v of VELDEN) {
    if (c[v] == null || (typeof c[v] === 'string' && !c[v].trim()) ||
        (Array.isArray(c[v]) && !c[v].length)) onvolledig.push(c.control + ': mist ' + v);
  }
}

console.log('\n=== HET CONTROLREGISTER ===\n');
console.log('  verklaarde controls : ' + goed.length);
if (stuk.length) for (const s of stuk) console.log('  !! ' + s.bron + ' -- ' + s.stuk);
if (onvolledig.length) for (const o of onvolledig) console.log('  !! onvolledig: ' + o);

if (!VASTLEGGEN && !JSONUIT) {
  for (const c of goed) {
    console.log('\n  ' + c.control + '   [' + c.eigenaar + ']');
    console.log('    ' + c.wat);
    console.log('    bewijs     : ' + c.bewijs.join(', '));
    console.log('    bewijsstuk : ' + c.bewijsstuk);
    console.log('    grens      : ' + c.grens);
  }
  const oud = (() => { try { return JSON.parse(fs.readFileSync(UITSLAG, 'utf8')); } catch (e) { return null; } })();
  if (oud) {
    console.log('\n  laatst gemeten:');
    for (const c of oud.controls || []) {
      console.log('    ' + String(c.control).padEnd(24) + (c.laatstGroen ? c.laatstGroen.staat + '  ' + (c.laatstGroen.at || '') : 'nooit'));
    }
  } else {
    console.log('\n  Nog geen CONTROLS.json. Meet en leg vast met --vastleggen.');
  }
  process.exit(stuk.length || onvolledig.length ? 1 : 0);
}

/* Meten kost tijd (de toetsen draaien echt), dus alleen bij --vastleggen/--json. */
const gemeten = goed.map(c => ({ ...c, laatstGroen: staatVan(c, meet(c.bewijs)) }));
/* NIET IN BEDRIJF is geen mislukking maar ook geen bewijs: hij telt apart, zodat
   de uitslag van dit script niet rood staat om een control die eerlijk zegt dat
   hij er nog niet is -- en tegelijk niet meetelt als dekking. */
const nietInBedrijf = gemeten.filter(c => c.laatstGroen.staat === 'NIET IN BEDRIJF');
const nietGroen = gemeten.filter(c => c.laatstGroen.staat !== 'GROEN' && c.laatstGroen.staat !== 'NIET IN BEDRIJF');

const stand = {
  uitleg: 'Verklaarde beheersmaatregelen en wanneer elk voor het laatst BEWEZEN is. ' +
    'Zie TOEZICHT.md. laatstGroen is gemeten door de genoemde toetsen te draaien, ' +
    'niet overgeschreven -- een register dat zijn eigen groen opschrijft bewijst niets.',
  gemeten: { controls: gemeten.length,
    groen: gemeten.filter(c => c.laatstGroen.staat === 'GROEN').length,
    nietInBedrijf: nietInBedrijf.length,
    nietGroen: nietGroen.length },
  controls: gemeten
};

if (JSONUIT) { console.log(JSON.stringify(stand, null, 1)); process.exit(0); }

fs.writeFileSync(UITSLAG, JSON.stringify(stand, null, 2) + '\n');
console.log('\n  gemeten en vastgelegd in CONTROLS.json:');
for (const c of gemeten) {
  console.log('    ' + String(c.control).padEnd(24) + String(c.laatstGroen.staat).padEnd(16) +
    (c.laatstGroen.beweringen ? '  (' + c.laatstGroen.beweringen + ' beweringen)' : '') +
    (c.laatstGroen.reden ? '  -- ' + c.laatstGroen.reden : ''));
}
process.exit(nietGroen.length || stuk.length || onvolledig.length ? 1 : 0);
