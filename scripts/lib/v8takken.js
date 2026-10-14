/* ============================================================================
   DE TAKKEN VAN DE DEKKINGSVLOER, OP EEN SLEUTEL DIE IN ELK PROCES GELIJK IS.

   Regels en functies telt de vloer uit lcov (scripts/lib/lcov.js), en daar is
   de sleutel stabiel: een regelnummer, een functienaam. Bij takken niet. Node's
   lcov-reporter schrijft BRDA:<regel>,<blok>,<tak>, en dat <blok> is het
   volgnummer van de tak in dat bestand, in DAT proces. V8 meldt de blokken van
   een functie alleen als hij in dat proces is gecompileerd; raakt een batch een
   functie niet, dan schuiven alle volgnummers erna op, en bij het optellen
   telden dezelfde takken als nieuwe, ongedekte takken. Op de hele suite was
   ongeveer 40% van de noemer zulke dubbeltelling, en de vloer schommelde per
   run (test/v8takken.test.js laat het zien).

   DE SLEUTEL is hier de plek in de bron: begin- en eindpositie van het blok,
   zoals V8 hem in de ruwe dekking (NODE_V8_COVERAGE) zelf meldt.

   DE TELLING VOLGT DE REGEL VAN V8, en dat is de tweede helft. V8 meldt een blok
   alleen als zijn telling AFWIJKT van die van het omvattende blok: na g(1) staat
   alleen de nee-kant erin (met 0), na g(0) alleen de ja-kant. De ja-kant van de
   eerste run is daar niet ongedekt maar onvermeld -- hij telt mee met zijn
   ouder. De telling van een plek in de bron is daarom die van het BINNENSTE
   gemelde bereik dat haar omvat. Per batch bewaren we dus twee dingen: alle
   gemelde blokken (de noemer) en de stukken van de bron die in minstens een
   proces met een telling boven nul zijn uitgevoerd. Een blok is gedekt als zijn
   beginpositie in zo'n stuk valt.

   Wat als tak telt: elk bereik dat V8 meldt, het functiebereik zelf incluis --
   zo telt Node's eigen reporter ook (de BRDA op regel 1 is de module). Van een
   functie die in GEEN proces is gecompileerd kent V8 alleen dat functiebereik,
   met nul: die telt als een ongedekte tak en valt niet stil uit de noemer.

   Buiten de meting, net als in de lcov: alles buiten server/, scripts/ en
   public/, en node_modules daarbinnen.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

const BINNEN = /^(server|scripts|public)\//;

/* De stukken [begin, eind) waar het binnenste bereik een telling boven nul
   heeft, voor de bereiken van EEN script in EEN proces. */
function uitgevoerd(bereiken) {
  const r = bereiken.slice().sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
  const uit = [];
  const stapel = [];
  let pos = r.length ? r[0].startOffset : 0;
  const zet = (tot) => {
    if (tot <= pos) return;
    const top = stapel[stapel.length - 1];
    if (top && top.count > 0) uit.push([pos, tot]);
    pos = tot;
  };
  for (const b of r) {
    while (stapel.length && stapel[stapel.length - 1].endOffset <= b.startOffset) {
      zet(stapel[stapel.length - 1].endOffset);
      stapel.pop();
    }
    zet(b.startOffset);
    stapel.push(b);
  }
  while (stapel.length) { zet(stapel[stapel.length - 1].endOffset); stapel.pop(); }
  return voegStukkenSamen(uit);
}

function voegStukkenSamen(stukken) {
  const s = stukken.slice().sort((a, b) => a[0] - b[0]);
  const uit = [];
  for (const [a, b] of s) {
    const laatste = uit[uit.length - 1];
    if (laatste && a <= laatste[1]) laatste[1] = Math.max(laatste[1], b);
    else uit.push([a, b]);
  }
  return uit;
}

function binnenStuk(stukken, p) {
  let lo = 0, hi = stukken.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (p < stukken[m][0]) hi = m - 1;
    else if (p >= stukken[m][1]) lo = m + 1;
    else return true;
  }
  return false;
}

/* Lees een map met ruwe V8-dekking (een JSON per proces). Een ruw bestand dat
   niet te lezen is (een proces dat midden in het schrijven werd gestopt) wordt
   GETELD en niet overgeslagen: wat daarin stond ontbreekt in de meting, en dat
   hoort te zien te zijn. */
function uitRuw(map, wortel) {
  const per = new Map();
  let onleesbaar = 0;
  let namen = [];
  try { namen = fs.readdirSync(map).filter((n) => n.endsWith('.json')).sort(); } catch (e) { namen = []; }
  for (const naam of namen) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(map, naam), 'utf8')); } catch (e) { onleesbaar++; continue; }
    for (const s of (j && j.result) || []) {
      if (!s || typeof s.url !== 'string' || !s.url.startsWith('file:')) continue;
      let rel;
      try { rel = path.relative(wortel, fileURLToPath(s.url)).split(path.sep).join('/'); } catch (e) { continue; }
      if (!BINNEN.test(rel) || rel.includes('/node_modules/')) continue;
      let doel = per.get(rel);
      if (!doel) { doel = { takken: new Set(), stukken: [] }; per.set(rel, doel); }
      const bereiken = [];
      for (const fn of s.functions || []) for (const b of fn.ranges || []) {
        doel.takken.add(b.startOffset + '-' + b.endOffset);
        bereiken.push(b);
      }
      doel.stukken.push(...uitgevoerd(bereiken));
    }
  }
  return { per, onleesbaar };
}

/* Het compacte bestand dat naast een lcov-bestand komt te staan. */
function naarBestand({ per, onleesbaar }) {
  const bestanden = {};
  for (const rel of [...per.keys()].sort()) {
    const d = per.get(rel);
    bestanden[rel] = { takken: [...d.takken].sort(), uitgevoerd: voegStukkenSamen(d.stukken) };
  }
  return { versie: 1, bestanden, onleesbaar };
}

function bewaar(ruwMap, uitPad, wortel) {
  const uit = naarBestand(uitRuw(ruwMap, wortel));
  fs.writeFileSync(uitPad, JSON.stringify(uit) + '\n');
  return { bestanden: Object.keys(uit.bestanden).length, onleesbaar: uit.onleesbaar };
}

/* Takkenbestanden optellen: de noemer is elk blok dat ergens is gemeld, en een
   plek die in een batch is uitgevoerd, is uitgevoerd. */
function voegSamen(lijst) {
  const per = new Map();
  let onleesbaar = 0;
  for (const k of lijst) {
    onleesbaar += Number(k && k.onleesbaar) || 0;
    for (const [rel, b] of Object.entries((k && k.bestanden) || {})) {
      let doel = per.get(rel);
      if (!doel) { doel = { takken: new Set(), stukken: [] }; per.set(rel, doel); }
      for (const t of b.takken || []) doel.takken.add(t);
      doel.stukken.push(...(b.uitgevoerd || []));
    }
  }
  for (const d of per.values()) d.stukken = voegStukkenSamen(d.stukken);
  return { per, onleesbaar };
}

function tel({ per, onleesbaar }) {
  let gedekt = 0, totaal = 0;
  for (const d of per.values()) {
    for (const t of d.takken) {
      totaal++;
      if (binnenStuk(d.stukken, Number(t.split('-')[0]))) gedekt++;
    }
  }
  const pct = totaal === 0 ? 100 : Math.round((gedekt / totaal) * 10000) / 100;
  return { bestanden: per.size, gedekt, totaal, pct, onleesbaar };
}

module.exports = { uitRuw, naarBestand, bewaar, voegSamen, tel, uitgevoerd };
