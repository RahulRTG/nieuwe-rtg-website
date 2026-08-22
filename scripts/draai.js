#!/usr/bin/env node
'use strict';
/* DE WERKRIJ -- toetsen verdelen op wat ze KOSTEN, niet op hoe ze heten.

   HET PROBLEEM MET VASTE SCHIJVEN. Wie de suite in vier gelijke stukken hakt,
   verdeelt op AANTAL. De duur verschilt hier met een factor duizend: een
   eenheidstoets is een paar milliseconden, een schermtoets start een server,
   een browser en een echte inlog en doet er soms dertig seconden over. Vier
   schijven van gelijk aantal betekent dan drie werkers die duimen draaien
   terwijl de vierde de zware bak leegt. De wandklok is de langste schijf, niet
   het gemiddelde.

   DUS EEN RIJ. Elke werker pakt de volgende zodra hij vrij is. De wandklok wordt
   dan de langste ENKELE toets plus de rest verdeeld -- en dat is het beste dat
   met deze toetsen te halen valt zonder ze zelf op te knippen.

   LANGSTE EERST, EN ONBEKEND TELT ALS LANG. Wie de dure toetsen aan het eind
   bewaart, eindigt met één werker die nog twintig minuten bezig is. Een toets
   waarvan de duur niet bekend is, gaat vooraan: verkeerd gokken kost aan de
   voorkant een beetje volgorde en aan de achterkant een halve suite.

   TWEE BANEN, EN DAT IS GEMETEN EN NIET GEVOELD. Op 21 augustus 2026 liepen hier
   schermtoetsen in een lus, en de machine hield 24 Chromium-processen over. De
   toetsen die daarna zakten, zakten NIET op hun eigen code: de belastingsgraad
   was het onderwerp geworden. Eenheidstoetsen kosten geheugen noch poort en
   mogen breed; schermtoetsen starten elk een server EN een browser en krijgen
   een eigen, smalle baan. Ze draaien wel tegelijk, want ze wachten op
   verschillende dingen.

   WAT DIT NIET IS, EN DAT IS DUUR GELEERD. Dit is geen vervanger van
   scripts/test-runner.js. Die loper weet dingen die deze rij niet wist: welke
   toetsen ALLEEN mogen draaien (bronmuterend, of tegen een echte klok), en hoe
   het routejournaal wordt opgezet. De eerste versie hier negeerde dat en draaide
   alles zes tegelijk -- veertien zakkers, geen enkele daarvan een echte fout.
   Precies de storing waar die solo-lijst tegen bedacht is, en precies de fout
   waar dit hele bouwwerk over gaat: twee plekken die hetzelfde denken te weten.

   Dus: de EENHEIDStoetsen gaan langs de bestaande loper, ongewijzigd. Wat deze
   rij toevoegt is de SCHERMbaan, en daar zit de winst ook: 155 bestanden die
   elk een server en een browser starten, met duren die een factor dertig
   verschillen, draaiden tot nu toe strikt achter elkaar.

   Zakt er iets, dan zakt de hele draai -- er wordt niets weggelaten en niets
   verzacht.

   GEBRUIK
     node scripts/draai.js               schermtoetsen op kosten verdeeld
     node scripts/draai.js --eenheid     ook de eenheidstoetsen (via test-runner.js)
     node scripts/draai.js --plan        alleen wat scripts/plan.js voorschrijft
     node scripts/draai.js --banen 6,2   eigen breedte (eenheid, scherm)
     node scripts/draai.js --alleen rem  alleen wat op dit patroon past
   ========================================================================== */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const DUUR = path.join(WORTEL, 'SUITEDUUR.json');
const ARG = process.argv.slice(2);
const heeft = (v) => ARG.includes(v);

const kernen = os.cpus().length;
const banenArg = (ARG.find((a) => a.startsWith('--banen')) || '').split('=')[1] ||
  (ARG[ARG.indexOf('--banen') + 1] || '');
const [BREED_EENHEID, BREED_SCHERM] = banenArg.includes(',')
  ? banenArg.split(',').map(Number)
  : [Math.max(2, Math.min(8, kernen - 2)), 2];

function duren() {
  try { return JSON.parse(fs.readFileSync(DUUR, 'utf8')); } catch (e) { return { versie: 1, ms: {} }; }
}

function alleToetsen() {
  return fs.readdirSync(path.join(WORTEL, 'test'))
    .filter((n) => /\.(?:test|e2e)\.js$/.test(n)).map((n) => 'test/' + n).sort();
}

function tePakken() {
  /* --alleen is er voor het beproeven van deze rij zelf, en voor een gerichte
     ronde op een handvol bestanden. Hij verkleint de suite en mag dus NOOIT in
     een poort staan: dat zou snelheid uit overgeslagen zekerheid halen. */
  const iA = ARG.indexOf('--alleen');
  if (iA >= 0) {
    const p = new RegExp(ARG[iA + 1]);
    return alleToetsen().filter((t) => p.test(t));
  }
  if (!heeft('--plan')) return alleToetsen();
  const uit = require('child_process').execFileSync(process.execPath,
    [path.join(__dirname, 'plan.js'), '--json'], { cwd: WORTEL, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(uit).draaien;
}

/* ONBEKEND KRIJGT DE ZWAARSTE SCHATTING die we van zijn soort kennen -- niet
   nul, en niet het gemiddelde. Dat is dezelfde fail-closed-vorm als overal in
   deze laag: wat je niet weet, behandel je als het duurste geval. */
function schat(boek, toets) {
  const bekend = boek.ms[toets];
  if (bekend) return bekend;
  const soort = /\.e2e\.js$/.test(toets) ? 'e2e' : 'test';
  const zelfde = Object.entries(boek.ms)
    .filter(([k]) => (/\.e2e\.js$/.test(k) ? 'e2e' : 'test') === soort).map(([, v]) => v);
  return zelfde.length ? Math.max(...zelfde) : (soort === 'e2e' ? 60000 : 5000);
}

function baan(naam, rij, breedte, boek, gemeten, mislukt) {
  let volgende = 0, bezig = 0;
  return new Promise((klaar) => {
    const start = () => {
      while (bezig < breedte && volgende < rij.length) {
        const toets = rij[volgende++];
        bezig++;
        const t0 = Date.now();
        const kind = spawn(process.execPath,
          ['--test', '--test-concurrency=1', '--test-timeout=600000', toets],
          { cwd: WORTEL, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, RTG_DRAAI: naam } });
        let uit = '';
        kind.stdout.on('data', (d) => { uit += d; });
        kind.stderr.on('data', (d) => { uit += d; });
        kind.on('close', (code) => {
          const ms = Date.now() - t0;
          gemeten[toets] = ms;
          if (code !== 0) mislukt.push({ toets, uit: uit.slice(-4000) });
          process.stdout.write((code === 0 ? '\x1b[32m.\x1b[0m' : '\x1b[31mX\x1b[0m'));
          bezig--;
          if (volgende >= rij.length && bezig === 0) return klaar();
          start();
        });
      }
    };
    if (!rij.length) return klaar();
    start();
  });
}

/* De eenheidstoetsen gaan langs de bestaande loper. Die kent de solo-lijst
   (scripts/lib/geisoleerd.js) en zet het routejournaal op; dat wordt hier niet
   nagebouwd. */
function eenheidLangsDeLoper(bestanden) {
  const r = require('child_process').spawnSync(process.execPath,
    [path.join(__dirname, 'test-runner.js'), '--bestanden=' + bestanden.map((b) => path.basename(b)).join(',')],
    { cwd: WORTEL, stdio: 'inherit' });
  return r.status === 0;
}

(async function () {
  const boek = duren();
  const toetsen = tePakken();
  const eenheid = toetsen.filter((t) => !/\.e2e\.js$/.test(t)).sort((a, b) => schat(boek, b) - schat(boek, a));
  const scherm = toetsen.filter((t) => /\.e2e\.js$/.test(t)).sort((a, b) => schat(boek, b) - schat(boek, a));

  const onbekend = toetsen.filter((t) => !boek.ms[t]).length;
  console.log('\n' + toetsen.length + ' toets(en): ' + eenheid.length + ' eenheid (via de loper), ' +
    scherm.length + ' scherm op ' + BREED_SCHERM + ' baan/banen.' +
    (onbekend ? '  \x1b[2m' + onbekend + ' zonder bekende duur; die gaan vooraan\x1b[0m' : ''));
  const geschat = [...eenheid, ...scherm].reduce((a, t) => a + schat(boek, t), 0);
  console.log('\x1b[2mseriële duur naar schatting ' + Math.round(geschat / 60000) + ' min\x1b[0m\n');

  const t0 = Date.now();
  const gemeten = {}, mislukt = [];
  let eenheidGroen = true;
  if (eenheid.length && heeft('--eenheid')) {
    console.log('\x1b[2m' + eenheid.length + ' eenheidstoets(en) gaan langs scripts/test-runner.js' +
      ' -- die kent de solo-lijst\x1b[0m');
    eenheidGroen = eenheidLangsDeLoper(eenheid);
  } else if (eenheid.length) {
    console.log('\x1b[2m' + eenheid.length + ' eenheidstoets(en) overgeslagen; draai ze met --eenheid' +
      ' of met npm test\x1b[0m');
  }
  await baan('scherm', scherm, BREED_SCHERM, boek, gemeten, mislukt);
  const duur = Date.now() - t0;
  if (!eenheidGroen) mislukt.push({ toets: '(de eenheidstoetsen)', uit: 'scripts/test-runner.js gaf een fout terug' });

  /* DE GEMETEN DUUR TERUGSCHRIJVEN. Zonder dit blijft de verdeling voor altijd
     op de eerste gok staan, en dan is deze hele rij niet meer dan een dure
     manier om alfabetisch te sorteren. */
  boek.ms = { ...boek.ms, ...gemeten };
  boek.laatst = { toetsen: toetsen.length, wandklok: duur, banen: [BREED_EENHEID, BREED_SCHERM] };
  fs.writeFileSync(DUUR, JSON.stringify(boek, null, 1) + '\n');

  const serieel = Object.values(gemeten).reduce((a, b) => a + b, 0);
  console.log('\n\nwandklok ' + Math.round(duur / 1000) + 's, opgeteld ' + Math.round(serieel / 1000) +
    's -- ' + (serieel / duur).toFixed(1) + 'x');
  const traagste = Object.entries(gemeten).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log('\x1b[2mtraagste: ' + traagste.map(([t, m]) => t.replace(/^test\//, '') + ' ' +
    Math.round(m / 1000) + 's').join(', ') + '\x1b[0m');
  console.log('\x1b[2mde ondergrens van deze verdeling is de langste enkele toets: ' +
    Math.round((traagste[0] ? traagste[0][1] : 0) / 1000) + 's\x1b[0m');

  if (mislukt.length) {
    console.log('\n\x1b[31m' + mislukt.length + ' toets(en) gezakt:\x1b[0m');
    for (const m of mislukt) {
      console.log('\n--- ' + m.toets + ' ---');
      const kern = m.uit.split('\n').filter((r) => /✖|AssertionError|Error:|not ok/.test(r)).slice(0, 6);
      console.log(kern.length ? kern.join('\n') : m.uit.slice(-800));
    }
    process.exit(1);
  }
  console.log('\n\x1b[32mAlles groen.\x1b[0m');
})();
