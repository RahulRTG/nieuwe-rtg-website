#!/usr/bin/env node
/* ============================================================================
   HET SEMANTISCH REGISTER -- hoeveel woorden betekenen hier twee dingen?

   DE VRAAG KOMT UIT BEWIJSMACHINE.md par. 3, en die vraag komt op zijn beurt uit
   een vondst. scripts/capabilities.js stuitte op twee constanten die allebei
   VERMOGENS heten:

     kern/bevoegdheid/lijst.js   SEPA_UIT, KLANTGELD, WALLET_SALDO   (wat RTG MAG)
     kern/command/vermogens.js   bereikbaar, binnenkomen, betalen    (of iets DOET)

   Nul gedeelde leden. Hetzelfde woord, een ander ding -- en niemand die het merkt,
   want er is geen plek waar staat wat een woord in dit huis betekent.

   De opzet vraagt daar een Semantic Registry voor. Voordat er een register komt,
   hoort de vraag beantwoord: hoe vaak gebeurt dit? Een register voor een enkel
   geval is een la; een register voor dertig gevallen is infrastructuur.

   HOE ER GEMETEN WORDT

   1. Per bestand onder server/ worden de benoemde CATALOGI gezocht: een const met
      een hoofdletternaam die een gesloten verzameling ids draagt. Dat is dezelfde
      vondst als in scripts/capabilities.js, en de LEDEN worden dan ook met
      diezelfde functie gelezen (ledenVan). Een tweede uitvoering ernaast zou
      LAT-regel 4 zijn -- en dit script gaat er nu juist over dat dat misgaat.

      WEL ANDERS: hier staat GEEN naamzeef op. capabilities.js wilde alleen
      vermogenslijsten; deze wil elk begrip, want een botsing tussen twee
      SOORTEN of twee STANDEN is even duur als een botsing tussen twee
      VERMOGENS.

   2. Catalogi worden gegroepeerd op NAAM. Een naam die maar op een plek staat,
      kan per definitie niet botsen en valt af.

   3. Voor elke naam die in twee of meer DOMEINEN staat, worden de ledenlijsten
      naast elkaar gelegd. Daar vallen twee uitkomsten uit, en ze vragen om het
      TEGENOVERGESTELDE:

        BOTSING     de leden overlappen nauwelijks -> hetzelfde woord voor twee
                    dingen. De reparatie is HERNOEMEN.
        DUBBELING   de leden overlappen sterk -> een waarheid op twee plekken,
                    LAT-regel 4. De reparatie is SAMENVOEGEN.

      Een meter die die twee op een hoop gooit, geeft een getal waar niemand iets
      mee kan: de ene helft moet uit elkaar, de andere naar elkaar toe.

   WAAROM HET DOMEIN EN NIET HET BESTAND. Twee bestanden van hetzelfde domein die
   allebei STANDEN declareren, zijn een gesplitste module en geen botsing --
   dezelfde les die scripts/objectmodel.js met domeinVan trok en die
   scripts/magnaatlab.js herhaalde. Daarom komt domeinVan hier uit objectmodel.js
   en niet uit een eigen kopie.

   WAT DIT NIET BEWIJST, en dat hoort er hard bij te staan:

   - Een botsing is niet vanzelf FOUT. `ACTIES` in twee spellen die allebei hun
     eigen zetten opsommen, is precies goed. Wat de meter aanwijst is dat het
     woord geen betekenis draagt buiten zijn eigen module -- en dat pas gevaarlijk
     wordt zodra iemand er een gedeelde laag op bouwt. De uitslag is dus een
     WERKVOORRAAD en geen foutenlijst.
   - Een lage overlap kan ook betekenen dat de twee lijsten los zijn gegroeid uit
     een gedeelde oorsprong. Het verschil tussen "nooit hetzelfde geweest" en
     "uit elkaar gelopen" leest deze meter niet; dat leest een mens in de twee
     bestanden. Daarom staat bij elke botsing waar hij vandaan komt.

   Draai: node scripts/semantiek.js            (leesbaar)
          node scripts/semantiek.js --json     (voor de ratel)
          npm run semantiek:vast               (schrijft SEMANTIEK.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const objectmodel = require('./objectmodel');
const capabilities = require('./capabilities');

const WORTEL = path.join(__dirname, '..');
const BRONNEN = ['server'];

/* Zelfde uitsluitingen als capabilities.js, en om dezelfde redenen. */
const GEEN = [/\/initdata\//, /-data\.js$/, /\/zz-[^/]*\.js$/, /node_modules/];

const MIN_LEDEN = 3;        // gelijk aan capabilities.js
const BOTSING_ONDER = 0.15; // overlap hieronder: twee dingen, een woord
const DUBBEL_BOVEN = 0.6;   // overlap hierboven: een ding, twee plekken

/* Alleen commentaar eruit -- de tekenreeksen ZIJN hier de leden. Dezelfde val als
   in scripts/magnaatlab.js, waar de geleende wringer van objectmodel.js de
   requires opat en de meter doodleuk nul meldde. */
const wringCommentaar = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"\\/])\/\/[^\n]*/g, (m, p) => p);

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

/* HET DOMEIN, MET DE SPLITSING ERAF. objectmodel.domeinVan geeft een los bestand
   onder kern/ zijn eigen naam als domein -- terecht daar, want daar gaat het om
   vormen. Hier levert dat een valse botsing: `kern/staffseed.js` en
   `kern/staffseed2.js` zijn EEN module die over de 10 kB ging, en hun STAFF_SEED
   botst dan met zichzelf. Dit huis splitst met een cijfer (`register2`), met een
   letter (`genres-lijst-a`) of met een woord (`-deel1`, `-basis`), dus die gaan
   eraf voordat er wordt gegroepeerd.

   Grof, en dat is de goede kant: twee domeinen die ten onrechte een worden,
   verbergen hooguit een botsing. Een domein dat ten onrechte in tweeen valt,
   VERZINT er een -- en dat is precies het getal waar dit script over gaat. */
function domeinVan(pad) {
  return objectmodel.domeinVan(pad)
    .replace(/\d+$/, '')
    .replace(/-(deel|del)?\d+$/, '')
    .replace(/-(a|b|c|d)$/, '')
    .replace(/-(basis|data|lijst|register|rijen)$/, '');
}

function blokVanaf(s, start) {
  let d = 0;
  for (let i = start; i < s.length && i < start + 9000; i++) {
    const c = s[i];
    if (c === '{' || c === '[') d++;
    else if (c === '}' || c === ']') { d--; if (!d) return s.slice(start, i + 1); }
  }
  return null;
}

function lees() {
  const paden = BRONNEN.reduce((a, m) => bestanden(m, a), []);
  const catalogi = [];
  for (const p of paden) {
    const s = wringCommentaar(fs.readFileSync(path.join(WORTEL, p), 'utf8'));
    for (const m of s.matchAll(/const\s+([A-Z][A-Z0-9_]{2,})\s*=\s*[{[]/g)) {
      const blok = blokVanaf(s, m.index + m[0].length - 1);
      if (!blok) continue;
      const leden = capabilities.ledenVan(blok);
      if (leden.length < MIN_LEDEN) continue;
      catalogi.push({ bestand: p, domein: domeinVan(p), naam: m[1], leden });
    }
  }
  return { catalogi, bestanden: paden.length };
}

function analyse(catalogi, opties) {
  const O = Object.assign({ botsingOnder: BOTSING_ONDER, dubbelBoven: DUBBEL_BOVEN }, opties || {});

  const opNaam = new Map();
  for (const c of catalogi) {
    if (!opNaam.has(c.naam)) opNaam.set(c.naam, []);
    opNaam.get(c.naam).push(c);
  }

  /* DE EENHEID IS HET WOORD, NIET HET PAAR -- en dat was de eerste fout van deze
     meter. Hij telde paren, en dan explodeert een generiek woord: `CATEGORIEEN`
     staat in zes domeinen en levert vijftien paren, dus de teller sloeg door naar
     1258 en las als een ramp. Het is er EEN woord dat zes dingen betekent.

     Dus wordt er per naam GECLUSTERD: catalogi die elkaar boven de botsingsdrempel
     overlappen horen bij dezelfde betekenis. Het aantal clusters is het aantal
     betekenissen, en dat is precies wat een semantisch register moet weten. */
  const woorden = [];
  let namenInMeerDomeinen = 0, dubbelingen = 0;

  for (const [naam, lijst] of opNaam) {
    /* Per DOMEIN de rijkste catalogus, zodat een gesplitste module niet met
       zichzelf botst. */
    const perDomein = new Map();
    for (const c of lijst) {
      const eerder = perDomein.get(c.domein);
      if (!eerder || c.leden.length > eerder.leden.length) perDomein.set(c.domein, c);
    }
    const domeinen = [...perDomein.values()];
    if (domeinen.length < 2) continue;
    namenInMeerDomeinen++;

    /* Enkelvoudige koppeling: A en B horen bij elkaar zodra ze meer dan de
       botsingsdrempel delen. Wat overblijft zijn losse betekenissen. */
    const cluster = domeinen.map((_, i) => i);
    const vind = (i) => (cluster[i] === i ? i : (cluster[i] = vind(cluster[i])));
    let maxOverlap = 0, hoogsteBinnen = 0;
    for (let i = 0; i < domeinen.length; i++) {
      for (let j = i + 1; j < domeinen.length; j++) {
        const o = capabilities.jaccard(domeinen[i].leden, domeinen[j].leden);
        maxOverlap = Math.max(maxOverlap, o);
        if (o > O.botsingOnder) { cluster[vind(i)] = vind(j); hoogsteBinnen = Math.max(hoogsteBinnen, o); }
      }
    }
    const groepen = new Map();
    for (let i = 0; i < domeinen.length; i++) {
      const w = vind(i);
      if (!groepen.has(w)) groepen.set(w, []);
      groepen.get(w).push(domeinen[i]);
    }

    const betekenissen = groepen.size;
    if (hoogsteBinnen >= O.dubbelBoven) dubbelingen++;

    woorden.push({
      naam,
      domeinen: domeinen.length,
      betekenissen,
      hoogsteOverlap: Math.round(maxOverlap * 100) / 100,
      soort: betekenissen === 1
        ? (maxOverlap >= O.dubbelBoven ? 'dubbeling' : 'grijs')
        : (maxOverlap <= O.botsingOnder ? 'botsing' : 'gemengd'),
      waar: [...groepen.values()].map(g => ({
        bestanden: g.map(c => c.bestand),
        leden: g[0].leden.length,
        voorbeeld: g[0].leden.slice(0, 4)
      }))
    });
  }

  /* Sorteren op hoeveel betekenissen een woord draagt: dat is de werkvoorraad. */
  woorden.sort((a, b) => b.betekenissen - a.betekenissen || b.domeinen - a.domeinen ||
    a.naam.localeCompare(b.naam));

  const botsende = woorden.filter(w => w.betekenissen > 1);
  return {
    catalogi: catalogi.length,
    verschillendeNamen: opNaam.size,
    namenInMeerDomeinen,
    woordenMetMeerBetekenissen: botsende.length,
    betekenissenTotaal: botsende.reduce((n, w) => n + w.betekenissen, 0),
    ergsteWoord: botsende.length ? botsende[0].naam : null,
    ergsteAantal: botsende.length ? botsende[0].betekenissen : 0,
    dubbelingen,
    top: woorden.slice(0, 25)
  };
}

function meet(opties) {
  const { catalogi, bestanden: n } = lees();
  const uit = analyse(catalogi, opties);
  uit.bestanden = n;
  return uit;
}

/* ---------------------------------------------------------------- rapport -- */

function rapport(r) {
  const L = [];
  L.push('HET SEMANTISCH REGISTER -- hoeveel woorden betekenen hier twee dingen?');
  L.push('');
  L.push(`  ${r.bestanden} bestanden, ${r.catalogi} catalogi, ${r.verschillendeNamen} verschillende namen`);
  L.push(`  ${r.namenInMeerDomeinen} namen staan in meer dan een domein`);
  L.push('');
  L.push(`  ${r.woordenMetMeerBetekenissen} woorden dragen MEER DAN EEN betekenis ` +
    `(samen ${r.betekenissenTotaal} betekenissen)`);
  if (r.ergsteWoord) L.push(`  het ergste woord is ${r.ergsteWoord}, met ${r.ergsteAantal} betekenissen`);
  L.push(`  ${r.dubbelingen} namen dragen juist EEN betekenis op twee plekken (LAT-regel 4)`);
  L.push('');
  for (const w of r.top.slice(0, 14)) {
    L.push(`    ${w.naam}  --  ${w.betekenissen} betekenis(sen) over ${w.domeinen} domeinen  [${w.soort}]`);
    for (const g of w.waar.slice(0, 4))
      L.push(`        ${g.bestanden[0]}  (${g.leden}: ${g.voorbeeld.join(' ')})`);
    if (w.waar.length > 4) L.push(`        ... en nog ${w.waar.length - 4}`);
  }
  L.push('');
  L.push('  Let op: een botsing is niet vanzelf fout. Het zegt dat het woord geen');
  L.push('  betekenis draagt buiten zijn eigen module -- gevaarlijk zodra er een');
  L.push('  gedeelde laag op wordt gebouwd. Dit is een werkvoorraad, geen foutenlijst.');
  return L.join('\n');
}

/* ------------------------------------------------------------------ start -- */

if (require.main === module) {
  const args = process.argv.slice(2);
  const r = meet();
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  } else if (args.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'SEMANTIEK.json'), JSON.stringify(r, null, 2) + '\n');
    process.stdout.write(rapport(r) + '\n\nVastgelegd in SEMANTIEK.json\n');
  } else {
    process.stdout.write(rapport(r) + '\n');
  }
}

module.exports = { lees, analyse, meet, rapport, domeinVan, MIN_LEDEN, BOTSING_ONDER, DUBBEL_BOVEN };
