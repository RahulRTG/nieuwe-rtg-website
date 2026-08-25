#!/usr/bin/env node
/* ============================================================================
   HET OBJECTMODEL -- delen de domeinen van dit huis werkelijk een vorm?

   DE VRAAG KOMT UIT DEVELOPERCLOUD.md par. 2. Daar staat de aantrekkelijkste
   belofte van de hele Developer Cloud:

     "Een restauranttafel kan een Asset zijn. Een hotelkamer ook. Een
      festivalpodium ook. Een leaseauto ook. Een developer die tooling voor
      assets bouwt, kan dus tegelijk horeca, hotels, festivals en fleet bedienen."

   Ze KUNNEN het zijn. De vraag is of ze het ZIJN, en dit huis heeft die vraag
   al eens verkeerd beantwoord: PLATFORM.md legt vast dat Cercle en Entourage
   identiek KLONKEN en totaal verschillende data en werkstromen bleken te hebben.
   Een objecttype dat over vier domeinen heen wordt VERKLAARD, duwt alles wat ze
   onderscheidt naar een `extra`-veld -- en dan heeft de ontwikkelaar die
   "tooling voor assets" bouwt vier keer werk in plaats van een keer.

   Dus wordt het GEMETEN, met dezelfde methode die scripts/grenzen.js op de
   kern-namen losliet: tel wat er werkelijk staat, en laat het getal de conclusie
   dragen in plaats van andersom.

   HOE ER GEMETEN WORDT

   1. Per kernmodule worden de VORMEN gezocht die hij wegschrijft: een
      object-literaal met een `id` en ten minste vier velden. Dat is precies
      genoeg om een bewaard ding te zijn en te precies om een optiezak te vangen.
      Commentaar en tekenreeksen gaan er eerst uit (dezelfde wringer als
      scripts/grenzen.js), anders telt een veldnaam in een uitleg mee.

   2. DE ENVELOP GAAT ERAF, EN DAT IS DE HELE KUNST. Bijna elke bewaarde rij in
      dit huis draagt `id`, `at`, `naam`, `status`, `door`. Twee vormen die
      alleen die velden delen, delen NIETS -- ze zijn allebei een rij in een
      database. Een meting die de envelop meetelt, vindt overal verwantschap en
      bewijst daarmee niets. Wat een veld tot envelop maakt is hier geen lijst
      die iemand heeft bedacht maar een DREMPEL: staat hij in meer dan een
      vijfde van alle vormen, dan is hij verpakking.

   3. Daarna pas de vraag: welke velden delen vier of meer MODULES, en welke
      vormparen uit VERSCHILLENDE modules lijken echt op elkaar (overlap van
      Jaccard over wat er na de envelop overblijft).

   WAT DIT NIET BEWIJST, en dat hoort er hard bij te staan: een gedeelde NAAM is
   geen gedeelde BETEKENIS. `code` in suppliers en `code` in payCodes zijn twee
   verschillende dingen met dezelfde vier letters. Dit script wijst kandidaten
   aan; of ze werkelijk een type zijn, beslist een mens die de twee modules
   opent. Daarom staat bij elke kandidaat WAAR hij vandaan komt.

   Draai: node scripts/objectmodel.js            (leesbaar)
          node scripts/objectmodel.js --json     (voor de ratel)
          npm run objectmodel:vast               (schrijft OBJECTMODEL.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const BRONNEN = ['server/kern', 'server/bedrijf', 'server/school', 'server/papieren'];

/* SEED- EN CATALOGUSBESTANDEN TELLEN NIET MEE, en dat is de belangrijkste
   correctie op de eerste versie van dit script. Die vond 2227 gelijkende
   vormparen en de top stond vol met dezelfde huurauto uit twee initdata-
   bestanden -- gelijkenis 1,00. Dat is gekopieerde VOORBEELDDATA en het bewijst
   niets over gedeelde types; het meet alleen dat iemand een demo-rij twee keer
   heeft neergezet. Een domeinvorm wordt GEBOUWD (met een id, een klok, een
   berekening), een catalogusrij wordt OPGESCHREVEN. */
const GEEN = [/\/initdata\//, /\/seed\//, /-data\.js$/, /-rijen\//, /demoantwoorden/, /\/data\//,
  /* zz- is in dit huis het voorvoegsel van een PROEFBESTAND: test/meterijk.test.js
     zet er echte bestanden voor neer in server/kern en ruimt ze daarna op. Deze
     meter leest de levende boom en niet de git-index, dus zag hij ze staan --
     en in een volle suite draait dat naast elkaar. Uitkomst: de meting gaf 1499
     waar het vastgelegde bestand 1498 zegt, en de toets zakte op iets wat na
     afloop niet meer bestond. Een meter die per ronde een ander getal geeft,
     meet de suite en niet de code. */
  /\/zz-[^/]*\.js$/];

const MIN_VELDEN = 4;          // minder is geen bewaard ding maar een optiezak
/* De envelop wordt gemeten over MODULES en niet over vormen. Over vormen gemeten
   viel de drempel op 363 en bleven er vier velden over (at id naam soort),
   terwijl `status` in 195 vormen stond en `door` in 131 -- overduidelijk
   verpakking, en ze telden mee als bewijs van verwantschap. Het aantal vormen
   per module verschilt te veel om er een deel van te nemen; het aantal modules
   dat een veld gebruikt is de eerlijke maat. */
const ENVELOP_DEEL = 0.06;     // een veld dat in 6%+ van de modules staat, is verpakking
const GEDEELD_VANAF = 4;       // "wat vier domeinen delen, is een objecttype"
const GELIJKENIS = 0.6;        // twee vormen lijken op elkaar vanaf deze overlap

/* Commentaar en tekenreeksen eruit voordat er iets geteld wordt -- dezelfde
   wringer als scripts/grenzen.js, en om dezelfde reden: zonder dit telt een
   veldnaam die in een uitleg wordt genoemd mee als een echt veld. */
const wring = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"\\/])\/\/[^\n]*/g, (m, p) => p)
  .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, m => m.replace(/[^\n]/g, ' '));

function bestanden(map, uit) {
  const vol = path.join(WORTEL, map);
  if (!fs.existsSync(vol)) return uit;
  for (const naam of fs.readdirSync(vol)) {
    const p = path.join(vol, naam);
    const rel = path.join(map, naam).replace(/\\/g, '/');
    if (fs.statSync(p).isDirectory()) bestanden(path.join(map, naam), uit);
    else if (naam.endsWith('.js') && !GEEN.some(g => g.test(rel))) uit.push(rel);
  }
  return uit;
}

/* WELK DOMEIN IS DIT? De eerste uitkomst zette `gast/buitenshuis.js` naast
   `gast/sessie.js` bovenaan, en `levensgraaf/bronnen.js` naast `bronnen2.js`.
   Dat zijn geen twee domeinen die een type delen -- dat is EEN domein waarvan de
   bestanden ooit zijn gesplitst omdat ze over de 10 kB gingen. Wie die als bewijs
   telt, meet zijn eigen bestandsindeling.

   Het domein is daarom de MAP onder server/ (kern/gast, kern/command, bedrijf),
   en voor een module die los in kern/ ligt zijn eigen naam. Dat is grof, en het
   is de goede kant om grof te zijn: het verwerpt eerder een paar dan dat het er
   een verzint. */
function domeinVan(pad) {
  const d = pad.replace(/^server\//, '').replace(/\.js$/, '').split('/');
  if (d[0] !== 'kern') return d[0];
  return d.length > 1 ? 'kern/' + d[1] : 'kern/' + d[0];
}

/* De vormen in een bron. Alleen literalen ZONDER geneste accolades: een vorm met
   een sub-object erin wordt zo niet half gelezen, hij wordt niet gelezen. Dat is
   de goede kant om fout te zitten -- een gemiste vorm verzwakt een conclusie
   over gedeeldheid, een half gelezen vorm vervuilt hem. */
function vormenVan(bron) {
  const s = wring(bron);
  const uit = [];
  for (const m of s.matchAll(/\{([^{}]{20,1600})\}/g)) {
    const velden = [...m[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g)].map(x => x[1]);
    const uniek = [...new Set(velden)];
    if (uniek.length >= MIN_VELDEN && uniek.includes('id')) uit.push(uniek);
  }
  return uit;
}

/* Het inlezen en het REKENEN staan los van elkaar, en dat is niet netheid maar
   toetsbaarheid: analyse() krijgt vormen en geeft een uitkomst, dus is hij te
   voeren met verzonnen vormen waarvan je WEET wat eruit hoort te komen. Een
   meter die alleen op de echte boom draait, is een meter die je nooit hebt zien
   uitslaan (LAT-regel 10). */
function lees() {
  const paden = BRONNEN.reduce((a, m) => bestanden(m, a), []);
  const vormen = [];   // { module, velden[] }
  for (const p of paden) {
    /* Dezelfde vorm twee keer in een bestand is EEN vorm. Zonder dit telde een
       module die zijn rij op drie plekken opbouwt (maken, bijwerken, tonen)
       drie keer mee, en verscheen elk paar drie keer in de uitkomst. */
    const gezien = new Set();
    for (const velden of vormenVan(fs.readFileSync(path.join(WORTEL, p), 'utf8'))) {
      const sleutel = velden.slice().sort().join(',');
      if (gezien.has(sleutel)) continue;
      gezien.add(sleutel);
      vormen.push({ module: p, velden });
    }
  }
  return { vormen, bestanden: paden.length };
}

/* De drie drempels zijn te overschrijven, en dat is er voor de toets: met de
   echte waarden heeft een verzonnen voorbeeld van vier vormen 216 domeinen nodig
   voordat er iets uit de envelop valt. Wie ze hier zet, ziet ze ook staan. */
function analyse(vormen, bestandenTel, opties) {
  const O = Object.assign({ envelopDeel: ENVELOP_DEEL, gedeeldVanaf: GEDEELD_VANAF, gelijkenis: GELIJKENIS,
    envelopVanaf: null }, opties || {});
  // hoe vaak komt elk veld voor, en in hoeveel MODULES
  const inVormen = new Map(), inModules = new Map();
  for (const v of vormen) {
    for (const f of v.velden) {
      inVormen.set(f, (inVormen.get(f) || 0) + 1);
      if (!inModules.has(f)) inModules.set(f, new Set());
      inModules.get(f).add(v.module);
    }
  }

  /* De envelop: verpakking, geen type. Hij wordt gemeten en niet opgeschreven,
     zodat hij meebeweegt met de code in plaats van achter te lopen. */
  const modules = new Set(vormen.map(v => v.module)).size;
  const domeinen = new Set(vormen.map(v => domeinVan(v.module))).size;
  const drempel = O.envelopVanaf != null ? O.envelopVanaf : Math.max(2, Math.ceil(domeinen * O.envelopDeel));
  const envelopTel = new Map();
  for (const [f, mods] of inModules) envelopTel.set(f, new Set([...mods].map(domeinVan)).size);
  const envelop = [...envelopTel.entries()].filter(([, n]) => n >= drempel).map(([f]) => f).sort();
  const isEnvelop = new Set(envelop);

  const kern = (v) => v.velden.filter(f => !isEnvelop.has(f));
  /* Ook de veldentelling gaat per DOMEIN en niet per module, en om dezelfde
     reden: een veld dat in vier bestanden van kern/gast staat, wordt door EEN
     domein gebruikt. */
  const inDomeinen = new Map();
  for (const [f, mods] of inModules) inDomeinen.set(f, new Set([...mods].map(domeinVan)));
  const eigen = [...inDomeinen.entries()].filter(([f, s]) => s.size === 1 && !isEnvelop.has(f)).length;
  const gedeeld = [...inDomeinen.entries()]
    .filter(([f, s]) => s.size >= O.gedeeldVanaf && !isEnvelop.has(f))
    .map(([f, s]) => ({ veld: f, domeinen: s.size, waar: [...s].sort().slice(0, 6) }))
    .sort((a, b) => b.domeinen - a.domeinen);

  /* Vormparen uit VERSCHILLENDE modules die op elkaar lijken, gemeten NA de
     envelop. Dit is het enige getal dat de belofte uit DEVELOPERCLOUD.md
     werkelijk raakt: een gedeeld objecttype bestaat pas als twee domeinen meer
     delen dan hun verpakking. */
  const zwaar = vormen.map(v => ({ module: v.module, domein: domeinVan(v.module), velden: v.velden, kern: new Set(kern(v)) }))
    .filter(v => v.kern.size >= MIN_VELDEN);
  const paren = [];
  for (let i = 0; i < zwaar.length; i++) {
    for (let j = i + 1; j < zwaar.length; j++) {
      const a = zwaar[i], b = zwaar[j];
      if (a.domein === b.domein) continue;
      let snee = 0;
      for (const f of a.kern) if (b.kern.has(f)) snee++;
      if (!snee) continue;
      const unie = a.kern.size + b.kern.size - snee;
      const gelijk = snee / unie;
      if (gelijk >= O.gelijkenis) paren.push({ gelijkenis: Number(gelijk.toFixed(2)),
        a: a.module, b: b.module, domeinA: a.domein, domeinB: b.domein,
        gedeeld: [...a.kern].filter(f => b.kern.has(f)).sort() });
    }
  }
  paren.sort((x, y) => y.gelijkenis - x.gelijkenis || y.gedeeld.length - x.gedeeld.length);

  return {
    gemeten: { bestanden: bestandenTel != null ? bestandenTel : new Set(vormen.map(v => v.module)).size,
      vormen: vormen.length, velden: inVormen.size,
      modules, domeinen, envelopDrempel: drempel, envelop: envelop.length,
      veldenDomeineigen: eigen, veldenGedeeldVanafVier: gedeeld.length, gelijkendeVormparen: paren.length },
    envelop, gedeeld: gedeeld.slice(0, 40), paren: paren.slice(0, 40)
  };
}

function meet() { const g = lees(); return analyse(g.vormen, g.bestanden); }

module.exports = { meet, lees, analyse, vormenVan, wring, domeinVan };

if (require.main === module) {
  const r = meet();
  const g = r.gemeten;
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r)); process.exit(0); }
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'OBJECTMODEL.json'), JSON.stringify(Object.assign({
      uitleg: 'Gemeten met scripts/objectmodel.js; de vraag en de methode staan in de kop van dat bestand en in DEVELOPERCLOUD.md par. 2. Een gedeelde NAAM is geen gedeelde BETEKENIS: dit wijst kandidaten aan, een mens beslist.',
      vastgelegd: new Date().toISOString().slice(0, 10)
    }, r), null, 2) + '\n');
    console.log('OBJECTMODEL.json geschreven.');
  }
  console.log('\n  DE VORMEN VAN DIT HUIS\n');
  console.log('  ' + g.vormen + ' bewaarde vormen in ' + g.bestanden + ' bestanden, samen ' + g.velden + ' verschillende velden.');
  console.log('  Uit ' + g.modules + ' modules in ' + g.domeinen + ' domeinen; ' + g.envelop + ' velden zijn ENVELOP (in ' + g.envelopDrempel + '+ domeinen):');
  console.log('    ' + r.envelop.join(' '));
  console.log('');
  console.log('  ' + g.veldenDomeineigen + ' velden komen in PRECIES EEN domein voor.');
  console.log('  ' + g.veldenGedeeldVanafVier + ' velden worden door ' + GEDEELD_VANAF + ' of meer domeinen gebruikt.');
  console.log('  ' + g.gelijkendeVormparen + ' vormparen uit verschillende DOMEINEN lijken voor ' + Math.round(GELIJKENIS * 100) + '%+ op elkaar,');
  console.log('  gemeten NA aftrek van de envelop.\n');
  if (r.gedeeld.length) {
    console.log('  DE MEEST GEDEELDE VELDEN (envelop eraf)\n');
    for (const v of r.gedeeld.slice(0, 12)) console.log('    ' + String(v.domeinen).padStart(3) + '  ' + v.veld.padEnd(22) + v.waar.slice(0, 4).join(', '));
    console.log('');
  }
  if (r.paren.length) {
    console.log('  VORMEN DIE ECHT OP ELKAAR LIJKEN\n');
    for (const p of r.paren.slice(0, 10)) {
      console.log('    ' + p.gelijkenis + '  ' + p.domeinA + '  ' + p.a);
      console.log('          ' + p.domeinB + '  ' + p.b);
      console.log('          gedeeld: ' + p.gedeeld.join(' '));
    }
    console.log('');
  } else {
    console.log('  GEEN ENKEL VORMPAAR uit verschillende modules haalt de drempel.');
    console.log('  Dat is een antwoord: de domeinen delen hun verpakking en verder niets.\n');
  }
}
