#!/usr/bin/env node
/* ============================================================================
   DE MAKERS -- delen ze werkelijk een kern, of alleen een woord?

   DE VRAAG KOMT UIT CREATE.md par. 3. Daar staat de aantrekkelijkste belofte van
   de hele makerslaag, en tegelijk de gevaarlijkste:

     "Website-maker, Lesmaker, Clips, Mall-bouwer en Partnerstudio worden samen
      RTG Create."

   Ze kunnen samen een ERVARING vormen -- dat is CREATE-01. De vraag die dit
   script beantwoordt is de andere: delen ze ook een MODEL? Want alleen dan mag
   er een gedeeld projectbegrip komen (CREATE-03), en anders is het precies de
   fout die PLATFORM.md bij Cercle en Entourage al een keer heeft voorkomen.

   WAAROM DIT NIET scripts/objectmodel.js IS. Dat script meet DOMEINEN en de map
   onder server/ is daar de eenheid. Hier is de eenheid de MAKER, en een maker
   beslaat meerdere bestanden en soms meerdere mappen (de Website-maker alleen
   al dertien). De vraag verschilt ook: daar "bestaat er een universeel type",
   hier "mogen deze twee gereedschappen op een model".

   WAT ER GEDEELD BLIJFT MET DAT SCRIPT, EN MET OPZET: de EXTRACTIE. `vormenVan`
   en `wring` komen er rechtstreeks vandaan. Een tweede manier om een vorm uit
   een bestand te lezen is een tweede manier om hem verkeerd te lezen
   (LAT-regel 4). En de ENVELOP wordt niet opnieuw afgeleid maar overgenomen uit
   OBJECTMODEL.json: de envelop is een eigenschap van dit HUIS, gemeten over 216
   domeinen. Hem opnieuw afleiden uit acht makers zou hem uit een steekproef van
   acht halen, en dan valt precies datgene weg wat we zoeken -- een veld dat twee
   makers delen zou dan "verpakking" heten.

   VIER DIMENSIES, want vorm alleen is te dun voor deze vraag. Twee makers die
   toevallig `{ id, titel, blokken, at }` delen, delen nog geen gereedschap.

     1 VORM      welke bewaarde velden blijven over na de envelop
     2 TAAL      welke GESLOTEN WOORDENSCHAT hij kent (de bloktypen, de bronnen,
                 de soorten -- lijsten van vaste woorden die een domein afbakenen)
     3 OPSLAG    welke db.data-sleutels de maker aanraakt
     4 PUBLICATIE welke stappen van de levensloop hij kent (concept, live,
                 versies, herstel, plannen, spoor)
     5 POORT     achter welke inlog zijn routes staan

   WAAROM DIMENSIE 2 ERBIJ IS GEKOMEN, en dat is de belangrijkste les van dit
   script. De eerste versie mat alleen vorm, en gaf Website-maker <-> Atelier
   0,22 -- terwijl je bij het lezen van die twee bestanden ziet dat ze DEZELFDE
   bloktaal spreken. De reden: die taal woont niet in een bewaarde vorm maar in
   `TYPES = ['hero','kop','tekst',...]` en in toekenningen per type. Een meter die
   daarnaast kijkt, zegt "nee" op de goede vraag om de verkeerde reden, en dat is
   erger dan geen meter (zie de kop van test/objectmodel.test.js).

   HET OORDEEL. Een paar heeft een GEDEELDE KERN als de TAAL de drempel haalt, of
   als de VORM hem haalt EN er opslag wordt gedeeld.

   Waarom taal alleen genoeg is en vorm niet: een gesloten woordenschat van vier
   of meer vaste woorden is een DOMEINBESLUIT dat iemand heeft genomen. Twee
   makers die er een delen, delen een afspraak. Twee makers die alleen
   `{ kop, tekst }` delen, delen de Nederlandse taal. Opslag is daarom wel nodig
   naast vorm en niet naast taal: het Atelier bewaart sjablonen in `atelierSites`
   en de maker sites in `ledenSites`, en dat ZIJN ook twee dingen -- ze delen het
   formaat, niet de kast.

   WAT DIT NIET BEWIJST, en dat hoort er hard bij te staan: een gedeelde NAAM is
   geen gedeelde BETEKENIS. Dit script wijst kandidaten aan; of twee makers
   werkelijk een model delen, beslist een mens die beide modules opent. Daarom
   staat bij elk paar WAAR het vandaan komt.

   Draai: node scripts/makers.js              (leesbaar)
          node scripts/makers.js --json       (voor de ratel)
          node scripts/makers.js --vastleggen (schrijft MAKERS.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { vormenVan, wring } = require('./objectmodel');

const WORTEL = path.join(__dirname, '..');
const GELIJKENIS = 0.6;   // dezelfde drempel als scripts/objectmodel.js
const MIN_KERN = 3;       // een vorm met minder dan drie eigen velden zegt niets

/* De makers, en dit is met opzet een LIJST en geen vondst. Wat een maker is, is
   een productbesluit (CREATE.md par. 2) en geen mappenstructuur -- de
   Website-maker woont in dertien bestanden en de Partnerstudio in zeven. De
   patronen zijn prefixen, zodat een nieuw webmaker-*.js vanzelf meetelt en deze
   lijst niet stilletjes achterloopt. */
const MAKERS = [
  { id: 'websitemaker', naam: 'Website-maker', prefix: ['server/kern/webmaker', 'server/kern/webplatform', 'server/kern/webdomein', 'server/kern/webmerk'] },
  { id: 'websitestudio', naam: 'Website-studio (Atelier)', prefix: ['server/kern/atelierweb'] },
  { id: 'appstore', naam: 'App Store', prefix: ['server/kern/appstore/'] },
  { id: 'lesmaker', naam: 'Lesmaker', prefix: ['server/kern/lesmaker'] },
  { id: 'clips', naam: 'Clips-studio', prefix: ['server/kern/clips'] },
  { id: 'ondernemer', naam: 'Bedrijfsontwerper / Mall-bouwer', prefix: ['server/kern/onderneming/ontwerper'] },
  { id: 'partnerstudio', naam: 'Magnaat Partnerstudio', prefix: ['server/kern/magnaat-partnerstudio'] },
  { id: 'creator', naam: 'Creator-laag', prefix: ['server/kern/creator'] }
];

/* De levensloopstappen waarop een publicatiemodel te herkennen is. Namen uit dit
   huis, want dit huis schrijft Nederlands: een maker die `publiceer` en
   `herstel` kent, heeft een publicatiemodel, ook als hij het nergens zo noemt. */
const LEVENSLOOP = {
  concept: /\bbewaar\b|\bconcept\b/,
  live: /\bzetLive\b|\bpubliceer\b|\bgepubliceerd\b/,
  offline: /\boffline\b|\bintrekken\b|\bintrekk/,
  versies: /\bversies\b|\bversiegeschiedenis\b/,
  herstel: /\bherstel\b/,
  plan: /\bplan\(|\bgepland\b|\bmoment\b/,
  spoor: /\bspoor\b|\bjournaal\b|\bboek\(/
};
const POORTEN = ['auth', 'supplierAuth', 'officeAuth', 'staffAuth', 'techAuth', 'gastAuth'];

function bestandenOnder(map, uit) {
  const vol = path.join(WORTEL, map);
  let namen = [];
  try { namen = fs.readdirSync(vol, { withFileTypes: true }); } catch (e) { return uit; }
  for (const d of namen) {
    const rel = map + '/' + d.name;
    if (d.isDirectory()) bestandenOnder(rel, uit);
    else if (d.name.endsWith('.js')) uit.push(rel);
  }
  return uit;
}

/* Welke bestanden bij welke maker horen. Een bestand kan maar bij EEN maker
   horen: hoorde het bij twee, dan zou het zijn eigen vormen met zichzelf
   vergelijken en elk paar een gratis gelijkenis geven. */
function verdeel() {
  const alle = bestandenOnder('server/kern', []);
  const van = new Map();
  for (const m of MAKERS) van.set(m.id, []);
  for (const p of alle) {
    const m = MAKERS.find(x => x.prefix.some(pre => p.startsWith(pre)));
    if (m) van.get(m.id).push(p);
  }
  return van;
}

/* De opslagsleutels die een maker aanraakt. `db.data.x` is in dit huis de enige
   manier om bij bewaarde staat te komen, dus dit is geen benadering maar een
   telling. */
function opslagVan(bron) {
  const s = wring(bron);
  const uit = new Set();
  for (const m of s.matchAll(/\bdb\s*\.\s*data\s*\.\s*([A-Za-z_$][\w$]*)/g)) uit.add(m[1]);
  for (const m of s.matchAll(/\bS\(\)\s*\.\s*([A-Za-z_$][\w$]*)/g)) uit.add('appstore:' + m[1]);
  return uit;
}

/* Commentaar eruit, TEKENREEKSEN erin. `wring` uit objectmodel.js haalt allebei
   weg, en dat is daar juist -- een veldnaam in een uitleg mag niet meetellen.
   Hier is het precies verkeerd om: een woordenschat WOONT in tekenreeksen. Dus
   een eigen, kleine strijker, die de aanhalingstekens bijhoudt zodat een `//` in
   'https://...' niet de halve regel opeet. */
function zonderCommentaar(bron) {
  let uit = '', i = 0, quote = null;
  while (i < bron.length) {
    const c = bron[i], twee = bron.slice(i, i + 2);
    if (quote) {
      if (c === '\\') { uit += bron.slice(i, i + 2); i += 2; continue; }
      if (c === quote) quote = null;
      uit += c; i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; uit += c; i++; continue; }
    if (twee === '//') { while (i < bron.length && bron[i] !== '\n') i++; continue; }
    if (twee === '/*') { i += 2; while (i < bron.length && bron.slice(i, i + 2) !== '*/') i++; i += 2; continue; }
    uit += c; i++;
  }
  return uit;
}

/* De gesloten woordenschatten van een maker: lijsten van vaste woorden die een
   domein afbakenen (`TYPES`, `ZAAKBRONNEN`, `FORMSOORTEN`, `CATEGORIEEN`). Vier
   of meer korte, kleingeschreven tekenreeksen op een rij -- dat is geen zin en
   geen pad maar een besluit over wat er mag bestaan.

   Alleen kleine letters, cijfers, streepje en punt: zo vallen zinnen ("Stel ons
   een vraag"), foutmeldingen en URL's eruit, en blijft over wat een sleutel is. */
function talenVan(bron) {
  const s = zonderCommentaar(bron);
  const uit = [];
  for (const m of s.matchAll(/\[([^[\]]{12,700})\]/g)) {
    const woorden = [...m[1].matchAll(/'([a-z0-9][a-z0-9.\-]{1,23})'/g)].map(x => x[1]);
    const uniek = [...new Set(woorden)];
    // een lijst is pas een woordenschat als hij bijna helemaal uit die woorden bestaat
    const stukken = m[1].split(',').length;
    if (uniek.length >= 4 && uniek.length >= stukken - 1) uit.push(uniek);
  }
  return uit;
}

function levensloopVan(bron) {
  const s = wring(bron);
  const uit = [];
  for (const [stap, vorm] of Object.entries(LEVENSLOOP)) if (vorm.test(s)) uit.push(stap);
  return uit;
}

/* De poort achter de routes van een maker. We zoeken de routebestanden die deze
   maker AANROEPEN en lezen daar de middleware uit. Een maker zonder gevonden
   routebestand krijgt een lege lijst en geen verzonnen poort -- `onbekend` is
   hier een uitslag en geen nul (BESTUUR.md). */
function poortenVan(makerId, paden) {
  const namen = paden.map(p => path.basename(p, '.js'));
  const routes = bestandenOnder('server/routes', []);
  const uit = new Set();
  for (const r of routes) {
    let bron;
    try { bron = fs.readFileSync(path.join(WORTEL, r), 'utf8'); } catch (e) { continue; }
    const raakt = namen.some(n => bron.includes(n)) || bron.includes(makerId);
    if (!raakt) continue;
    const s = wring(bron);
    for (const p of POORTEN) if (new RegExp('\\b' + p + '\\b').test(s)) uit.add(p);
  }
  return [...uit].sort();
}

function lees() {
  const envelop = new Set(require(path.join(WORTEL, 'OBJECTMODEL.json')).envelop);
  const van = verdeel();
  const makers = [];
  for (const m of MAKERS) {
    const paden = van.get(m.id) || [];
    const vormen = [];
    const talen = [];
    const opslag = new Set();
    const levensloop = new Set();
    for (const p of paden) {
      const bron = fs.readFileSync(path.join(WORTEL, p), 'utf8');
      const gezien = new Set();
      for (const velden of vormenVan(bron)) {
        const sleutel = velden.slice().sort().join(',');
        if (gezien.has(sleutel)) continue;
        gezien.add(sleutel);
        const kern = velden.filter(f => !envelop.has(f));
        if (kern.length >= MIN_KERN) vormen.push({ bestand: p, velden, kern });
      }
      const gezienT = new Set();
      for (const woorden of talenVan(bron)) {
        const sleutel = woorden.slice().sort().join(',');
        if (gezienT.has(sleutel)) continue;
        gezienT.add(sleutel);
        talen.push({ bestand: p, woorden });
      }
      for (const k of opslagVan(bron)) opslag.add(k);
      for (const l of levensloopVan(bron)) levensloop.add(l);
    }
    makers.push({ id: m.id, naam: m.naam, bestanden: paden.length, paden,
      vormen, talen, opslag: [...opslag].sort(), levensloop: [...levensloop].sort(),
      poorten: poortenVan(m.id, paden) });
  }
  return { makers, envelop: [...envelop].sort() };
}

/* Het rekenen staat los van het inlezen, zodat het met verzonnen makers te
   voeren is waarvan je WEET wat eruit hoort te komen (LAT-regel 10). */
function analyse(makers, opties) {
  const O = Object.assign({ gelijkenis: GELIJKENIS }, opties || {});
  const paren = [];
  for (let i = 0; i < makers.length; i++) {
    for (let j = i + 1; j < makers.length; j++) {
      const a = makers[i], b = makers[j];
      let beste = { gelijkenis: 0, a: null, b: null, gedeeld: [] };
      for (const va of a.vormen) {
        const ka = new Set(va.kern);
        for (const vb of b.vormen) {
          const kb = new Set(vb.kern);
          let snee = 0;
          for (const f of ka) if (kb.has(f)) snee++;
          if (!snee) continue;
          const gelijk = snee / (ka.size + kb.size - snee);
          if (gelijk > beste.gelijkenis) {
            beste = { gelijkenis: Number(gelijk.toFixed(2)), a: va.bestand, b: vb.bestand,
              gedeeld: [...ka].filter(f => kb.has(f)).sort() };
          }
        }
      }
      /* Dezelfde rekensom over de gesloten woordenschatten: welk paar lijsten
         lijkt het meest op elkaar. */
      /* De keuze van HET paar woordenschatten is hier belangrijker dan bij vorm,
         en de eerste versie koos hem fout. Op de hoogste gelijkenis sturen gaf
         `['id','type','verberg','varianten']` -- een uitsluitlijstje dat in beide
         bestanden woordelijk voorkomt en dus 1,00 haalt. Het OORDEEL klopte, het
         BEWIJS niet, en een meter die het goede antwoord met het verkeerde bewijs
         staaft is een meter die je de volgende keer op het verkeerde been zet.

         Dus: onder de gevonden paren die de drempel halen wint die met de MEESTE
         gedeelde woorden. Tien woorden bloktaal is zwaarder bewijs dan vier
         woorden huishouding. Haalt niets de drempel, dan wordt de hoogste
         gelijkenis gerapporteerd -- want dan is dat het eerlijke getal. */
      const kandidaten = [];
      for (const ta of a.talen) {
        const sa = new Set(ta.woorden);
        for (const tb of b.talen) {
          const sb = new Set(tb.woorden);
          const gedeeld = [...sa].filter(w => sb.has(w));
          if (!gedeeld.length) continue;
          const gelijk = gedeeld.length / (sa.size + sb.size - gedeeld.length);
          kandidaten.push({ gelijkenis: Number(gelijk.toFixed(2)), a: ta.bestand, b: tb.bestand,
            gedeeld: gedeeld.sort(), haalt: gelijk >= O.gelijkenis });
        }
      }
      kandidaten.sort((x, y) => (y.haalt - x.haalt)
        || (y.haalt ? y.gedeeld.length - x.gedeeld.length : y.gelijkenis - x.gelijkenis)
        || y.gelijkenis - x.gelijkenis);
      const taal = kandidaten[0] || { gelijkenis: 0, a: null, b: null, gedeeld: [] };
      const opslagGedeeld = a.opslag.filter(k => b.opslag.includes(k));
      const levensloopGedeeld = a.levensloop.filter(k => b.levensloop.includes(k));
      const poortGedeeld = a.poorten.filter(k => b.poorten.includes(k));
      /* HET OORDEEL.

         TAAL alleen is genoeg: een gesloten woordenschat is een besluit over wat
         er mag bestaan, en twee makers die er een delen, delen een afspraak.

         VORM heeft opslag ernaast nodig, want vorm alleen liegt de andere kant
         op: twee makers die `{ kop, tekst, blokken }` delen maar in een andere
         kast schrijven, delen de Nederlandse taal en geen model. */
      const viaTaal = taal.gelijkenis >= O.gelijkenis;
      const viaVorm = beste.gelijkenis >= O.gelijkenis && opslagGedeeld.length > 0;
      const kern = viaTaal || viaVorm;
      paren.push({ a: a.id, b: b.id, gedeeldeKern: kern, via: viaTaal ? 'taal' : viaVorm ? 'vorm' : null,
        vorm: beste.gelijkenis, vormA: beste.a, vormB: beste.b, vormGedeeld: beste.gedeeld,
        taal: taal.gelijkenis, taalA: taal.a, taalB: taal.b, taalGedeeld: taal.gedeeld,
        opslagGedeeld, levensloopGedeeld, poortGedeeld,
        waarom: viaTaal
          ? 'zelfde gesloten woordenschat (' + taal.gelijkenis + '): ' + taal.gedeeld.slice(0, 8).join(' ')
          : viaVorm
            ? 'vorm ' + beste.gelijkenis + ' en gedeelde opslag (' + opslagGedeeld.join(', ') + ')'
            : 'taal ' + taal.gelijkenis + ' en vorm ' + beste.gelijkenis + ' halen de drempel ' + O.gelijkenis + ' niet' });
    }
  }
  paren.sort((x, y) => Math.max(y.taal, y.vorm) - Math.max(x.taal, x.vorm));
  return {
    gemeten: {
      makers: makers.length,
      bestanden: makers.reduce((n, m) => n + m.bestanden, 0),
      vormen: makers.reduce((n, m) => n + m.vormen.length, 0),
      paren: paren.length,
      metGedeeldeKern: paren.filter(p => p.gedeeldeKern).length,
      drempel: O.gelijkenis
    },
    makers: makers.map(m => ({ id: m.id, naam: m.naam, bestanden: m.bestanden,
      vormen: m.vormen.length, talen: m.talen.length, opslag: m.opslag, levensloop: m.levensloop, poorten: m.poorten })),
    paren
  };
}

function meet() { const g = lees(); return analyse(g.makers); }

module.exports = { meet, lees, analyse, talenVan, zonderCommentaar, opslagVan, MAKERS, GELIJKENIS };

if (require.main === module) {
  const r = meet();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r)); process.exit(0); }
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'MAKERS.json'), JSON.stringify(Object.assign({
      uitleg: 'Gemeten met scripts/makers.js; de vraag en de methode staan in de kop van dat bestand en in CREATE.md par. 3. Een gedeelde NAAM is geen gedeelde BETEKENIS: dit wijst kandidaten aan, een mens beslist. De envelop is niet hier afgeleid maar overgenomen uit OBJECTMODEL.json.',
      vastgelegd: new Date().toISOString().slice(0, 10)
    }, r), null, 2) + '\n');
    console.log('MAKERS.json geschreven.');
  }
  const g = r.gemeten;
  console.log('\n  DE MAKERS VAN DIT HUIS\n');
  console.log('  ' + g.makers + ' makers, ' + g.bestanden + ' bestanden, ' + g.vormen + ' bewaarde vormen na aftrek van de envelop.');
  console.log('  ' + g.paren + ' paren onderzocht; ' + g.metGedeeldeKern + ' met een gedeelde kern (drempel ' + g.drempel + ').\n');
  for (const m of r.makers) {
    console.log('    ' + m.naam);
    console.log('      ' + m.bestanden + ' bestanden, ' + m.vormen + ' vormen');
    console.log('      opslag:     ' + (m.opslag.length ? m.opslag.slice(0, 6).join(' ') + (m.opslag.length > 6 ? ' (+' + (m.opslag.length - 6) + ')' : '') : '-'));
    console.log('      levensloop: ' + (m.levensloop.join(' ') || '-'));
    console.log('      poort:      ' + (m.poorten.join(' ') || 'onbekend'));
  }
  console.log('\n  DE PAREN\n');
  for (const p of r.paren) {
    const oordeel = p.gedeeldeKern ? 'JA ' : 'NEE';
    console.log('    ' + oordeel + '  ' + p.a.padEnd(15) + ' <-> ' + p.b.padEnd(15)
      + '  taal ' + p.taal.toFixed(2) + '  vorm ' + p.vorm.toFixed(2));
    console.log('           ' + p.waarom);
    if (p.gedeeldeKern && p.via === 'taal') console.log('           ' + p.taalA + '  <->  ' + p.taalB);
    if (p.gedeeldeKern && p.via === 'vorm') console.log('           ' + p.vormA + '  <->  ' + p.vormB);
  }
  console.log('');
  const kern = r.paren.filter(p => p.gedeeldeKern);
  if (!kern.length) {
    console.log('  GEEN ENKEL PAAR haalt de drempel. Dat is een antwoord: RTG Create is een');
    console.log('  laag over zelfstandige makers, en er hoort geen gedeeld projectmodel te komen.\n');
  } else {
    console.log('  Alleen deze paren mogen op een gedeeld model (CREATE-03). De rest krijgt');
    console.log('  een gedeelde INGANG en houdt zijn eigen domein.\n');
  }
}
