#!/usr/bin/env node
/* ============================================================================
   HET VERBAND -- kan de machine zelf terugvinden welke wachter welke wet draagt?

   WAT DIT IS, EN WAAROM HET EEN IJKING IS EN GEEN GRAAF

   De verleiding bij deze stap is om alle mogelijke relaties tussen doctrine,
   wetten, toetsen, routes en code te verzamelen en een indrukwekkende graaf te
   tonen: twaalfduizend randen, allemaal waar. Dan gebeurt precies wat bij de
   eerste doctrinecompiler gebeurde -- die meldde 1088 kandidaten en vond 21 van
   de 50 wetten die dit huis al kende. Een getal zonder ijking is geen kennis.

   Daarom begint deze laag niet met verzamelen maar met een vraag:

     Kan een onafhankelijke waarnemer de wet->wachter-randen reconstrueren
     waarvan WETTEN.json al zegt dat ze bestaan?

   DE REGEL DIE DIT BESTAND DRAAGT: `handhaver` IS DE REFERENTIE, NOOIT EEN SENSOR

   WETTEN.json noemt per wet zijn handhavers. Dat veld is hier de GRONDWAARHEID
   waartegen gemeten wordt. Zou een sensor dat veld lezen, dan ijkt de machine
   zichzelf en is de uitslag per definitie honderd procent -- de duurste vorm van
   vals groen die er is. test/verband.test.js houdt vast dat geen enkele sensor
   eraan komt.

   HET VELD MENGT TWEE RELATIES, en dat is hier zichtbaar geworden. Van de 91
   verklaarde randen wijzen er 56 naar een WACHTER (een toets of een script dat
   rood wordt) en 35 naar de IMPLEMENTATIE die de regel draagt (server/, public/).
   Dat zijn twee verschillende beweringen onder een naam. Deze meter gaat over de
   eerste; de tweede staat apart in de uitslag en wordt er niet bij opgeteld.
   Of WETTEN.json die twee uit elkaar moet trekken is een BESLUIT en geen
   berekening, dus dat gebeurt hier niet.

   VIJF SENSOREN, EN ZE WORDEN NOOIT TOT EEN CIJFER GEMIDDELD

     causaal      de sabotage van een wet noemt een doelbestand; MUTATIES.json
                  zegt onafhankelijk welke toets zakt als dat bestand muteert.
                  Het sterkste signaal dat er is -- en vandaag het dunste, want
                  de mutatiemotor legt per toets EEN module vast.
     document     de wachter noemt het brondocument van de wet.
     anker        de wachter noemt het letterlijke anker van de wet.
     doelbestand  de wachter noemt het bestand dat de sabotage muteert.
     wettekst     de wachter deelt de helft van de inhoudswoorden van de wet.

   Een gemiddelde van die vijf betekent niets: `anker` haalt 7 van de 56 met 11
   voorstellen, `wettekst` haalt er 51 met 403. De een is bijna ruisloos, de
   ander bijna blind voor niets. Dezelfde reden waarom DOCTRINE.json zijn
   structuur- en woordas apart houdt.

   WAT HIER NIET STAAT: een betrouwbaarheidspercentage per rand. Een rand draagt
   welke sensoren hem zagen, en de lezer weegt zelf. `87% zeker` zou verbergen
   dat de ene sensor causaal is en de andere een woordoverlap.

   DE GRAAD IS `vermoed`. De RECALL is gemeten (54 van de 56); de PRECISIE niet
   -- van de honderden voorstellen is niet vastgesteld welk deel een echte
   handhaver aanwijst.

   Draai:  node scripts/verband.js           (schrijft VERBAND.json)
           node scripts/verband.js --toon     (laat zien, schrijft niets)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'VERBAND.json');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[90m', vet: '\x1b[1m', uit: '\x1b[0m' };
const TOON = process.argv.includes('--toon');

/* ------------------------------------------------------------ de bouwstenen */

const _cache = {};
function lees(rel) {
  if (_cache[rel] !== undefined) return _cache[rel];
  try { _cache[rel] = fs.readFileSync(path.join(WORTEL, rel), 'utf8'); }
  catch (e) { _cache[rel] = null; }
  return _cache[rel];
}

const STOP = new Set(('de het een en of van in op te dat die dit deze aan met voor is zijn wordt worden als bij uit om ook niet geen nog maar dan er wat wie waar hoe dus want zo al meer ze hij zij wij per tot nooit alleen').split(' '));
const kernwoorden = (t) => new Set(String(t).toLowerCase()
  .replace(/[^a-z0-9à-ÿ\s]/g, ' ').split(/\s+/).filter(x => x.length > 4 && !STOP.has(x)));

/* Is dit pad een WACHTER (iets dat rood kan worden) of de IMPLEMENTATIE? */
const isWachter = (p) => p.startsWith('test/') || p.startsWith('scripts/');

/* ---------------------------------------------------------------- de sensoren */

/* GEEN VAN DEZE FUNCTIES LEEST `w.handhaver`. Dat is de hele ijking, en
   test/verband.test.js leest deze bron om het vast te houden. */
function maakSensoren(wachters, perModule) {
  return {
    causaal(w) {
      const doel = w.sabotage && w.sabotage.bestand;
      return doel ? (perModule[doel] || []) : [];
    },
    document(w) {
      const doc = w.bron && w.bron.bestand;
      if (!doc) return [];
      return wachters.filter(p => { const t = lees(p); return t && t.includes(doc); });
    },
    anker(w) {
      const a = w.bron && w.bron.anker;
      if (!a || a.length < 8) return [];
      return wachters.filter(p => { const t = lees(p); return t && t.includes(a); });
    },
    doelbestand(w) {
      const doel = w.sabotage && w.sabotage.bestand;
      if (!doel) return [];
      const basis = doel.split('/').pop();
      return wachters.filter(p => { const t = lees(p); return t && (t.includes(doel) || t.includes(basis)); });
    },
    wettekst(w) {
      const kw = [...kernwoorden(w.wet)];
      if (kw.length < 3) return [];
      return wachters.filter(p => {
        const t = lees(p); if (!t) return false;
        const laag = t.toLowerCase();
        return kw.filter(x => laag.includes(x)).length / kw.length >= 0.5;
      });
    },
  };
}

/* ------------------------------------------------------------------- meten */

function meet() {
  let wetten, mutRuw;
  try { wetten = require(path.join(WORTEL, 'WETTEN.json')).wetten; }
  catch (e) {
    console.error(K.rood + 'WETTEN.json is niet te lezen (' + e.message + '); zonder grondwaarheid ' +
      'is er niets te ijken en zou elke uitslag honderd procent heten' + K.uit);
    process.exit(1);
  }
  try { mutRuw = require(path.join(WORTEL, 'MUTATIES.json')).toetsen; }
  catch (e) { mutRuw = null; }

  /* De causale sensor leunt op MUTATIES.json. Ontbreekt dat register, dan staat
     die sensor op `geenBron` en niet op nul -- een sensor die niet kon kijken is
     iets anders dan een sensor die niets zag (BESTUUR.md). */
  const perModule = {};
  let causaalBron = true;
  if (mutRuw) {
    const rijen = Array.isArray(mutRuw) ? mutRuw : Object.entries(mutRuw);
    for (const [toets, r] of rijen) {
      if (!r || !r.module) continue;
      (perModule[r.module] ||= []).push('test/' + toets);
    }
  } else { causaalBron = false; }

  /* GRONDWAARHEID: alleen de wachters. */
  const grond = [];
  const implementatie = [];
  for (const w of wetten) {
    for (const h of (w.handhaver || [])) {
      if (isWachter(h)) grond.push({ wet: w.id, wachter: h, w });
      else implementatie.push({ wet: w.id, bestand: h, relatie: 'DRAAGT', bronrelatie: 'handhaver' });
    }
  }
  const wachters = [...new Set(grond.map(g => g.wachter))];
  const sensoren = maakSensoren(wachters, perModule);

  const perSensor = {};
  for (const naam of Object.keys(sensoren)) perSensor[naam] = { raak: 0, voorstellen: 0 };

  const randen = [];
  const gemist = [];
  for (const g of grond) {
    const zag = [];
    for (const [naam, fn] of Object.entries(sensoren)) {
      const kandidaten = fn(g.w) || [];
      perSensor[naam].voorstellen += kandidaten.length;
      if (kandidaten.includes(g.wachter)) { perSensor[naam].raak++; zag.push(naam); }
    }
    randen.push({
      wet: g.wet, wachter: g.wachter, gezienDoor: zag,
      /* DE RELATIE HEET WAT HIJ IS, EN DE BRON ZEGT WAT ER STOND.
         `handhaver` in WETTEN.json draagt twee betekenissen; deze rand is er
         een van. Zou hier alleen `handhaver` staan, dan bouwt de volgende laag
         door op een dubbelzinnigheid die deze meter al gemeten heeft. */
      relatie: 'BEWAAKT_DOOR',
      bronrelatie: 'handhaver',
    });
    if (!zag.length) gemist.push({ wet: g.wet, wachter: g.wachter });
  }
  const gevonden = grond.length - gemist.length;

  return { wetten, grond, randen, gemist, gevonden, perSensor, implementatie, causaalBron };
}

/* --------------------------------------------------------------- het stempel */

function stempel() {
  const git = (...a) => { try { return execFileSync('git', a, { cwd: WORTEL, encoding: 'utf8' }).trim(); } catch (e) { return null; } };
  const vuil = git('status', '--porcelain');
  return {
    op: new Date().toISOString(),
    commit: git('rev-parse', '--short', 'HEAD'),
    boomVuil: vuil === null ? null : vuil.length > 0,
    instrument: 'scripts/verband.js',
    node: process.version,
  };
}

/* ------------------------------------------------------------------ draaien */

function draai() {
  const m = meet();
  const uit = {
    stempel: stempel(),
    uitleg: 'De ijking van de verbandlaag: kan een onafhankelijke waarnemer de wet->wachter-randen ' +
      'terugvinden die WETTEN.json verklaart? Het veld `handhaver` is hier de REFERENTIE en wordt door ' +
      'geen enkele sensor gelezen -- anders ijkt de machine zichzelf en is de uitslag altijd honderd procent.',
    graad: 'vermoed',
    grens: 'De RECALL is gemeten, de PRECISIE niet: van de voorstellen per sensor is niet vastgesteld welk ' +
      'deel een echte handhaver aanwijst. De vijf sensoren worden NOOIT tot een cijfer gemiddeld -- `anker` ' +
      'haalt 7 van de 56 met 11 voorstellen en `wettekst` 51 met 403, dus een gemiddelde verbergt precies ' +
      'het verschil waar een lezer op moet wegen. Een rand draagt daarom WELKE sensoren hem zagen en geen ' +
      'betrouwbaarheidspercentage.',
    telling: {
      wetten: m.wetten.length,
      randenWachter: m.grond.length,
      randenImplementatie: m.implementatie.length,
      gevonden: m.gevonden,
      gemist: m.gemist.length,
    },
    /* Twee relaties onder een veldnaam. Ze worden niet opgeteld; welke kant
       WETTEN.json op moet is een besluit en geen berekening. */
    tweeRelaties: {
      uitleg: 'Het veld `handhaver` draagt twee verschillende beweringen: een WACHTER die rood wordt ' +
        '(relatie BEWAAKT_DOOR), en de IMPLEMENTATIE die de regel draagt (relatie DRAAGT). Deze meter ijkt ' +
        'alleen de eerste. Elke rand draagt daarom een `relatie` die zegt WAT hij is, naast een `bronrelatie` ' +
        'die zegt wat er in WETTEN.json stond.',
      interpretatie: 'ONBEPAALD IN DE BRON: WETTEN.json kent een veldnaam voor twee relaties. De splitsing ' +
        'hier is een LEZING van deze meter en geen besluit -- WETTEN.json is niet aangeraakt. Wie die twee ' +
        'daar uit elkaar trekt, doet dat als besluit en niet als berekening.',
      wachter: m.grond.length,
      implementatie: m.implementatie.length,
    },
    sensoren: Object.fromEntries(Object.entries(m.perSensor).map(([n, v]) => [n, {
      recall: v.raak, van: m.grond.length, voorstellen: v.voorstellen,
      bron: n === 'causaal' && !m.causaalBron ? 'geenBron' : 'gemeten',
    }])),
    gemist: m.gemist,
    randen: m.randen,
    /* De DRAAGT-randen staan er WEL in en worden nergens bij de BEWAAKT_DOOR-randen
       opgeteld. Ze taggen zonder ze te tonen zou de tag decoratie maken. */
    implementatie: m.implementatie,
  };

  if (TOON) { toon(uit); return; }
  fs.writeFileSync(DOEL, JSON.stringify(uit, null, 2) + '\n');
  toon(uit);
  console.log(K.grijs + 'VERBAND.json geschreven.' + K.uit);
}

function toon(uit) {
  const t = uit.telling;
  console.log('');
  console.log(K.vet + '  HET VERBAND -- vindt de machine de bekende wet->wachter-randen zelf terug?' + K.uit);
  console.log(K.grijs + '  (graad: vermoed -- recall gemeten, precisie niet)' + K.uit);
  console.log('');
  console.log('    grondwaarheid: ' + t.randenWachter + ' verklaarde wet->wachter-randen' +
    K.grijs + '  (plus ' + t.randenImplementatie + ' naar de implementatie, niet opgeteld)' + K.uit);
  console.log('');
  console.log('    sensor'.padEnd(20) + 'recall'.padStart(9) + '   voorstellen');
  for (const [naam, s] of Object.entries(uit.sensoren)) {
    const bron = s.bron === 'geenBron' ? K.grijs + '  (geen bron -- MUTATIES.json ontbreekt)' + K.uit : '';
    console.log('    ' + naam.padEnd(16) + String(s.recall).padStart(9) + '/' + s.van +
      String(s.voorstellen).padStart(10) + bron);
  }
  console.log('');
  const pct = t.randenWachter ? Math.round((t.gevonden / t.randenWachter) * 100) : 0;
  console.log('    ' + (pct >= 90 ? K.groen : K.geel) + 'UNIE: ' + t.gevonden + ' van ' + t.randenWachter +
    ' (' + pct + '%)' + K.uit);
  if (uit.gemist.length) {
    console.log('');
    console.log(K.vet + '  DOOR GEEN ENKELE SENSOR GEZIEN' + K.uit);
    for (const g of uit.gemist) console.log('    ' + K.geel + '-' + K.uit + ' ' + g.wet + '  ->  ' + g.wachter);
  }
  console.log('');
}

if (require.main === module) draai();
module.exports = { maakSensoren, meet, isWachter, kernwoorden, DOEL };
