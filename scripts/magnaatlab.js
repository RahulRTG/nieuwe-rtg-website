#!/usr/bin/env node
/* ============================================================================
   DE TESTHAL-METING -- bewijst Magnaat iets over RTG?

   DE VRAAG KOMT UIT MAGNAATLAB.md par. 2. De opzet daar wil van Magnaat de
   permanente simulatieomgeving van RTG maken, en zet er een regel boven die de
   hele constructie draagt:

     "Nothing critical reaches RTG production without first surviving RTG
      itself."

   En daaronder, als punt 4, de voorwaarde waar dat op staat of valt:

     "Magnaat mag geen eigen kopieen krijgen van RTG-functionaliteit. Dus
      absoluut niet MagnaatPaymentEngine naast RTG Payment Engine. Dat
      vernietigt de waarde van de testhal."

   Dat is geen mening maar een toetsbare bewering, en hij is in twee helften te
   meten. Deze meter doet ze allebei, want los zeggen ze allebei het verkeerde:

   1. HET BEREIK. Welke RTG-kernen roept de simulatielaag werkelijk aan? Een
      testhal die een capability niet AANRAAKT, bewijst er niets over -- hoe
      groot de simulatie ook is. Dit is de eerlijkste vorm van de vraag, want
      hij is niet te beantwoorden met een intentie: een `require` staat er of
      hij staat er niet.

   2. DE DUBBELING. Hoeveel van de simulatielaag is een TWEEDE UITVOERING van
      iets dat RTG al heeft? Gemeten zoals PLATFORM.md het bij Cercle en
      Entourage deed: eerst kijken of twee modules over hetzelfde ONDERWERP
      gaan (de naam), en dan pas of ze werkelijk vorm delen (de velden). Een
      gedeelde naam is geen gedeelde kern, en dat geldt hier in beide
      richtingen -- `magnaat/bank.js` en `kern/bank/` heten hetzelfde en zijn
      het misschien niet.

   WAAROM DE TWEEDE HELFT NIET GENOEG IS, EN DE EERSTE OOK NIET

   Alleen dubbeling meten geeft een getal dat als verwijt leest, en dat zou hier
   oneerlijk zijn: een spelbank die geld uit het niets maakt IS iets anders dan
   een betaalrail die dat nooit mag (WAARDE.md). Twee uitvoeringen kunnen
   volstrekt terecht zijn.

   Alleen bereik meten geeft een nul die als "kapot" leest, terwijl Magnaat als
   SPEL precies goed is zoals hij is.

   Samen zeggen ze wel iets: een simulatielaag die RTG niet aanraakt EN
   ondertussen zijn eigen uitvoering van dezelfde onderwerpen heeft, is geen
   testhal in aanbouw maar een tweede huis. Dat is de uitspraak die par. 2 van
   MAGNAATLAB.md draagt, en dit is wat hem waar of onwaar maakt.

   WAT DIT NIET BEWIJST, en dat hoort er hard bij te staan:

   - Een `require` is niet de enige manier om een capability te bereiken. Wie
     over HTTP praat of via de bus, telt hier niet mee. Dat maakt het bereik
     hieronder een ONDERGRENS en geen exacte waarde -- en de meter zegt er
     daarom bij hoeveel van de simulatielaag uberhaupt een netwerkaanroep doet,
     zodat een lezer ziet of die ontsnapping wordt gebruikt.
   - Een gedeeld onderwerp is geen gedeelde betekenis. De paren hieronder zijn
     KANDIDATEN; of ze werkelijk hetzelfde doen, beslist een mens die de twee
     bestanden opent. Daarom staat bij elk paar waar het vandaan komt.

   Draai: node scripts/magnaatlab.js            (leesbaar)
          node scripts/magnaatlab.js --json     (voor de ratel)
          npm run magnaatlab:vast               (schrijft MAGNAATLAB.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const objectmodel = require('./objectmodel');

const WORTEL = path.join(__dirname, '..');

/* DE SIMULATIELAAG. Twee werelden, en dat is zelf al een bevinding: Magnaat en
   hospitality-universe zijn allebei synthetische werelden met locaties, mensen,
   vraag en gebeurtenissen, en Magnaat roept de tweede aan. Ze staan hier samen
   omdat de opzet over "de simulatieomgeving" spreekt en niet over een van de
   twee; wie ze apart wil zien, leest `perWereld` in de uitkomst. */
const WERELDEN = {
  magnaat: [/^server\/kern\/spellen\/magnaat\//, /^server\/kern\/magnaat[^/]*\.js$/],
  hospitality: [/^server\/kern\/hospitality-universe\//]
};

/* Wat GEEN capability is en dus niet meetelt als bereik. `lib/klok` is de klok:
   elke module in dit huis leest hem, en hem meetellen zou elke wereld een
   bereik van 1 geven zonder dat er iets bewezen is. Node's eigen modules
   evenmin. Dit is de enige plek waar iets van het bereik wordt afgetrokken, en
   het staat hier zodat het te zien is. */
const GEEN_CAPABILITY = [/^node:/, /^(fs|path|crypto|util|os|child_process|events|assert)$/, /\/lib\/klok$/];

const isWereld = (rel) => Object.keys(WERELDEN).find(w => WERELDEN[w].some(r => r.test(rel)));

function bestanden(map, uit) {
  const vol = path.join(WORTEL, map);
  if (!fs.existsSync(vol)) return uit;
  for (const naam of fs.readdirSync(vol)) {
    const p = path.join(vol, naam);
    const rel = path.join(map, naam).replace(/\\/g, '/');
    if (fs.statSync(p).isDirectory()) bestanden(path.join(map, naam), uit);
    else if (naam.endsWith('.js')) uit.push(rel);
  }
  return uit;
}

/* Een require oplossen naar een pad onder server/, zodat "../../pay/poort" en
   "./bank" allebei op hun echte bestemming uitkomen. Lukt dat niet, dan is het
   een pakket of een node-module en telt hij niet als kern. */
function doelVan(bestand, spec) {
  if (!spec.startsWith('.')) return null;
  const p = path.posix.normalize(path.posix.join(path.posix.dirname(bestand), spec));
  return p.replace(/\.js$/, '');
}

/* ALLEEN COMMENTAAR ERUIT, EN NIET DE TEKENREEKSEN -- en dit is precies de val
   waar deze meter in trapte. Eerst gebruikte hij `objectmodel.wring`, maar die
   haalt ook de tekenreeksen weg, want daar zijn de VELDNAMEN de meting. Hier is
   de tekenreeks juist de meting: `require('./sectoren')` wordt daarmee
   `require(' ')` en de meter meldde doodleuk "0 requires in de simulatielaag".

   Nul is hier de gevaarlijke kant: het is exact de uitkomst die de conclusie
   van par. 2 zou bevestigen. Een meter die het gewenste antwoord geeft omdat
   hij zijn invoer heeft weggegooid, is de soort uit LAT-regel 10 -- en het is
   de tweede keer in twee documenten dat deze wringer die fout maakt. Daarom
   staat hij nu hier, met deze uitleg, in plaats van geleend te worden. */
const wringCommentaar = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"\\/])\/\/[^\n]*/g, (m, p) => p);

function requiresVan(bron) {
  return [...wringCommentaar(bron).matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]);
}

/* Doet deze module een aanroep naar buiten? Dat is de ontsnapping die par. 2
   noemt: wie over HTTP praat, staat niet in de requires. */
const PRAAT_NAAR_BUITEN = /\bfetch\s*\(|require\(\s*['"](?:http|https|node:http)/;

function lees() {
  const paden = bestanden('server', []);
  const modules = [];
  for (const rel of paden) {
    const wereld = isWereld(rel);
    const bron = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    modules.push({
      rel, wereld: wereld || null,
      requires: requiresVan(bron),
      naarBuiten: PRAAT_NAAR_BUITEN.test(wringCommentaar(bron)),
      vormen: objectmodel.vormenVan(bron)
    });
  }
  return modules;
}

/* Het ONDERWERP van een module: de bestandsnaam zonder versiering. `bank.js`,
   `magnaat-economie.js` en `kern/bank/index.js` gaan alle drie over iets met
   een naam, en die naam is waar de vergelijking begint. Voorvoegsels eraf,
   want `magnaat-economie` en `economie` zijn hetzelfde onderwerp -- juist dat
   is wat we willen zien. */
function onderwerpVan(rel) {
  let n = path.posix.basename(rel, '.js');
  if (n === 'index') n = path.posix.basename(path.posix.dirname(rel));
  return n.replace(/^(magnaat|rtg|kern)-/, '').replace(/-(acties|data|basis|lijst|register)$/, '');
}

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let snee = 0;
  for (const x of A) if (B.has(x)) snee++;
  const unie = A.size + B.size - snee;
  return unie ? snee / unie : 0;
}

function analyse(modules, opties) {
  const O = Object.assign({ gelijkenis: 0.4 }, opties || {});
  const sim = modules.filter(m => m.wereld);
  const rest = modules.filter(m => !m.wereld && /^server\/kern\//.test(m.rel));

  /* ---- 1. HET BEREIK ---- */
  const geraakt = new Map();     // kernpad -> welke simulatiemodules hem roepen
  let requiresTotaal = 0, naarBuiten = 0;
  const kruis = [];
  for (const m of sim) {
    if (m.naarBuiten) naarBuiten++;
    for (const spec of m.requires) {
      requiresTotaal++;
      if (GEEN_CAPABILITY.some(r => r.test(spec))) continue;
      const doel = doelVan(m.rel, spec);
      if (!doel || !/^server\//.test(doel)) continue;
      const doelWereld = isWereld(doel + '.js') || isWereld(doel + '/');
      if (doelWereld) {
        /* Een aanroep NAAR een andere synthetische wereld is geen bereik in
           RTG, maar hij hoort wel geteld: dat Magnaat hospitality-universe
           aanroept is precies de vraag of dit een simulatielaag is of twee. */
        if (doelWereld !== m.wereld) kruis.push({ van: m.rel, naar: doel, wereld: doelWereld });
        continue;
      }
      if (GEEN_CAPABILITY.some(r => r.test(doel))) continue;
      if (!geraakt.has(doel)) geraakt.set(doel, new Set());
      geraakt.get(doel).add(m.rel);
    }
  }
  const bereik = [...geraakt.entries()]
    .map(([doel, door]) => ({ doel, door: [...door].sort().slice(0, 4), aantal: door.size }))
    .sort((a, b) => b.aantal - a.aantal);

  /* De noemer: hoeveel kernDOMEINEN zijn er uberhaupt om te raken? Zonder dat
     getal is "raakt er 2 aan" niet te wegen. */
  const kernDomeinen = new Set(rest.map(m => objectmodel.domeinVan(m.rel)));
  const geraakteDomeinen = new Set(bereik.map(b => objectmodel.domeinVan(b.doel + '.js')));

  /* ---- 2. DE DUBBELING ---- */
  const restOpOnderwerp = new Map();
  for (const m of rest) {
    const o = onderwerpVan(m.rel);
    if (!restOpOnderwerp.has(o)) restOpOnderwerp.set(o, []);
    restOpOnderwerp.get(o).push(m);
  }

  const paren = [];
  for (const m of sim) {
    const o = onderwerpVan(m.rel);
    for (const tegen of restOpOnderwerp.get(o) || []) {
      /* De vormen naast elkaar: delen deze twee modules werkelijk iets, of
         alleen een woord? Beide zonder vormen -> geen uitspraak, en dat is
         eerlijker dan een 0 die als "verschillend" leest. */
      let beste = 0;
      for (const va of m.vormen) for (const vb of tegen.vormen) beste = Math.max(beste, jaccard(va, vb));
      paren.push({
        onderwerp: o,
        simulatie: m.rel,
        rtg: tegen.rel,
        vormgelijkenis: Math.round(beste * 100) / 100,
        meetbaar: !!(m.vormen.length && tegen.vormen.length)
      });
    }
  }
  paren.sort((a, b) => b.vormgelijkenis - a.vormgelijkenis || a.onderwerp.localeCompare(b.onderwerp));

  const gedeeldOnderwerp = new Set(paren.map(p => p.onderwerp));
  const echtGelijk = paren.filter(p => p.meetbaar && p.vormgelijkenis >= O.gelijkenis);

  const perWereld = {};
  for (const w of Object.keys(WERELDEN)) {
    const mods = sim.filter(m => m.wereld === w);
    perWereld[w] = {
      modules: mods.length,
      regels: 0,
      raaktKern: [...new Set(bereik.filter(b => b.door.some(d => isWereld(d) === w)).map(b => b.doel))].length
    };
  }

  return {
    simulatiemodules: sim.length,
    kernmodules: rest.length,
    kernDomeinen: kernDomeinen.size,
    perWereld,

    // 1. bereik
    requiresTotaal,
    geraakteKernmodules: bereik.length,
    geraakteKernDomeinen: geraakteDomeinen.size,
    bereikPct: kernDomeinen.size ? Math.round((geraakteDomeinen.size / kernDomeinen.size) * 100) : 0,
    modulesDiePratenNaarBuiten: naarBuiten,
    kruisWereldAanroepen: kruis.length,
    kruisWereld: kruis.slice(0, 8),
    bereik: bereik.slice(0, 15),

    // 2. dubbeling
    gedeeldeOnderwerpen: gedeeldOnderwerp.size,
    kandidaatparen: paren.length,
    parenMetGedeeldeVorm: echtGelijk.length,
    paren: paren.slice(0, 20)
  };
}

function meet(opties) { return analyse(lees(), opties); }

/* ---------------------------------------------------------------- rapport -- */

function rapport(r) {
  const L = [];
  L.push('DE TESTHAL-METING -- bewijst Magnaat iets over RTG?');
  L.push('');
  L.push(`  ${r.simulatiemodules} simulatiemodules tegenover ${r.kernmodules} kernmodules ` +
    `in ${r.kernDomeinen} domeinen`);
  for (const [w, d] of Object.entries(r.perWereld))
    L.push(`    ${w.padEnd(14)} ${String(d.modules).padStart(3)} modules, raakt ${d.raaktKern} kernmodules aan`);
  L.push('');
  L.push('  1. HET BEREIK -- welke RTG-kernen roept de simulatielaag werkelijk aan?');
  L.push(`     ${r.requiresTotaal} requires in de simulatielaag`);
  L.push(`     ${r.geraakteKernmodules} kernmodules geraakt, in ${r.geraakteKernDomeinen} van ${r.kernDomeinen} domeinen (${r.bereikPct}%)`);
  L.push(`     ${r.modulesDiePratenNaarBuiten} modules doen een netwerkaanroep (de ontsnapping die requires niet zien)`);
  L.push(`     ${r.kruisWereldAanroepen} aanroepen van de ene synthetische wereld naar de andere`);
  for (const k of r.kruisWereld) L.push(`       ${k.van} -> ${k.naar}`);
  if (r.bereik.length) {
    for (const b of r.bereik) L.push(`       ${b.doel}  (door ${b.aantal})`);
  } else {
    L.push('       GEEN ENKELE.');
  }
  L.push('');
  L.push('  2. DE DUBBELING -- hoeveel is een tweede uitvoering van iets dat RTG al heeft?');
  L.push(`     ${r.gedeeldeOnderwerpen} onderwerpen komen aan beide kanten voor (${r.kandidaatparen} paren)`);
  L.push(`     ${r.parenMetGedeeldeVorm} daarvan delen ook werkelijk een VORM`);
  for (const p of r.paren.slice(0, 12))
    L.push(`       ${String(p.vormgelijkenis).padStart(4)}  ${p.onderwerp.padEnd(14)} ` +
      `${p.simulatie}\n              ${p.meetbaar ? '' : '(geen vormen om te vergelijken)  '}${p.rtg}`);
  L.push('');
  L.push('  Let op: een gedeeld onderwerp is geen gedeelde betekenis. Open de twee.');
  return L.join('\n');
}

/* ------------------------------------------------------------------ start -- */

if (require.main === module) {
  const args = process.argv.slice(2);
  const r = meet();
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  } else if (args.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'MAGNAATLAB.json'), JSON.stringify(r, null, 2) + '\n');
    process.stdout.write(rapport(r) + '\n\nVastgelegd in MAGNAATLAB.json\n');
  } else {
    process.stdout.write(rapport(r) + '\n');
  }
}

module.exports = { lees, analyse, meet, rapport, onderwerpVan, doelVan, requiresVan,
  jaccard, WERELDEN, GEEN_CAPABILITY };
