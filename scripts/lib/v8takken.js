/* ============================================================================
   DE TAKKEN VAN DE DEKKINGSVLOER, OP EEN SLEUTEL DIE IN ELK PROCES GELIJK IS.

   Regels en functies telt de vloer uit lcov (scripts/lib/lcov.js), en daar is
   de sleutel stabiel: een regelnummer, een functienaam. Bij takken niet. Node's
   lcov-reporter schrijft BRDA:<regel>,<j>,0,<aantal>, en die <j> is de index
   van het bereik in de platte lijst van alle bereiken van dat bestand, in DAT
   proces (lib/internal/test_runner/reporter/lcov.js in Node 26). V8 meldt de
   blokken van een functie alleen als hij in dat proces is gecompileerd; raakt
   een batch een functie niet, dan schuiven alle volgnummers erna op, en bij het
   optellen telden dezelfde takken als nieuwe, ongedekte takken.

   WAT V8 MELDT, en waarom "begin-eind" ook nog geen identiteit was. Elke
   functie heeft een vaste set telpunten (slots) in de bron. Wat V8 in de ruwe
   dekking (NODE_V8_COVERAGE) meldt, is die set NA een paar bewerkingen die van
   de TELLINGEN afhangen (src/debug/debug-coverage.cc):
     - een blok met dezelfde telling als zijn ouder valt weg;
     - een blok met nul binnen een ouder met nul valt weg;
     - twee AANGRENZENDE blokken met dezelfde telling worden EEN bereik.
   Dat laatste verandert het EINDE van een gemeld bereik. Gemeten aan
   test/fixtures/takidentiteit/takken.js: na kies(1) meldt V8 de else-tak en het
   vervolg samen als 66-115 (beide nul), na kies(1);kies(1);kies(0,1) als 66-100
   en 100-115. Met begin-eind als sleutel staat dezelfde else-tak dan twee keer
   in de noemer. Het BEGIN van een bereik is altijd het begin van een echt
   telpunt: samenvoegen houdt het eerste begin, wegvallen haalt een heel bereik
   weg. Het begin is dus de identiteit van een blok.

   EEN FUNCTIE IS GEEN BLOK. Het functiebereik (het eerste bereik van elke
   functie) wordt nooit samengevoegd en draagt de eigen aanroeptelling. Het kan
   wel op dezelfde plek beginnen als een ander functiebereik: een bestand dat
   met `function f` begint, meldt de module als 0-L en f als 0-n. Daarom twee
   soorten sleutels: F:<begin>-<eind> voor een functie, B:<begin> voor een blok.
   Een functie is gedekt als zij in minstens een proces een telling boven nul
   had. (De oude telling keek ook bij functies naar de plek, en rekende daardoor
   de module van zo'n bestand als ongedekt zodra f nooit draaide.)

   DE TELLING VAN EEN BLOK volgt de regel van V8: de telling van een plek in de
   bron is die van het BINNENSTE gemelde bereik dat haar omvat. Per batch
   bewaren we dus de stukken van de bron die in minstens een proces met een
   telling boven nul zijn uitgevoerd, en een blok is gedekt als zijn begin in
   zo'n stuk valt -- ook in een proces waarin V8 het blok zelf niet meldde.

   DE AANNAME, EN DE WACHTER EROP. B:<begin> klopt alleen als twee verschillende
   blokken nooit op dezelfde plek beginnen, en een blok nooit op de plek van een
   functie. Binnen EEN proces is dat te controleren: daar is elk gemeld bereik
   een eigen telpunt (of een samenvoeging die met dat telpunt begint). Komt het
   toch voor, dan telt `botsingen` het, en weigert de vloer te rekenen: een
   sleutel die twee takken kan betekenen, is geen meting.

   GRENS VAN DE DATA, niet van de samenvoeging: van een functie die in geen
   enkel proces is gecompileerd kent V8 alleen het functiebereik (met nul), en
   een blok dat in elk proces dezelfde telling had als zijn ouder, wordt nergens
   gemeld. Beide gelden ook voor Node's eigen reporter in een enkel proces.

   Buiten de meting, net als in de lcov: alles buiten server/, scripts/ en
   public/, en node_modules daarbinnen. Offsets zijn tekens (UTF-16), geen bytes.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

const BINNEN = /^(server|scripts|public)\//;
const VERSIE = 2;

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

function leeg() {
  return { functies: new Set(), gedekteFuncties: new Set(), blokken: new Set(), stukken: [], botsingen: 0 };
}

/* EEN script in EEN proces. Geeft het aantal botsingen terug: blokken die op
   dezelfde plek beginnen als een ander blok of een functie in DIT proces. */
function neemScript(doel, functies) {
  const bereiken = [];
  const functieBegin = new Set();
  const blokEind = new Map();
  for (const fn of functies || []) {
    const r = fn.ranges || [];
    if (!r.length) continue;
    const kop = r[0];
    const sleutel = kop.startOffset + '-' + kop.endOffset;
    doel.functies.add(sleutel);
    if (kop.count > 0) doel.gedekteFuncties.add(sleutel);
    functieBegin.add(kop.startOffset);
    for (const b of r) bereiken.push(b);
  }
  let botsingen = 0;
  for (const fn of functies || []) {
    const r = fn.ranges || [];
    for (let i = 1; i < r.length; i++) {
      const b = r[i];
      const eerder = blokEind.get(b.startOffset);
      if ((eerder !== undefined && eerder !== b.endOffset) || functieBegin.has(b.startOffset)) botsingen++;
      blokEind.set(b.startOffset, b.endOffset);
      doel.blokken.add(b.startOffset);
    }
  }
  doel.stukken.push(...uitgevoerd(bereiken));
  doel.botsingen += botsingen;
  return botsingen;
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
      if (!doel) { doel = leeg(); per.set(rel, doel); }
      neemScript(doel, s.functions);
    }
  }
  return { per, onleesbaar };
}

/* Het compacte bestand dat naast een lcov-bestand komt te staan. */
function naarBestand({ per, onleesbaar }) {
  const bestanden = {};
  for (const rel of [...per.keys()].sort()) {
    const d = per.get(rel);
    const b = {
      functies: [...d.functies].sort(),
      gedekteFuncties: [...d.gedekteFuncties].sort(),
      blokken: [...d.blokken].sort((x, y) => x - y),
      uitgevoerd: voegStukkenSamen(d.stukken)
    };
    if (d.botsingen) b.botsingen = d.botsingen;
    bestanden[rel] = b;
  }
  return { versie: VERSIE, bestanden, onleesbaar };
}

function bewaar(ruwMap, uitPad, wortel) {
  const uit = naarBestand(uitRuw(ruwMap, wortel));
  fs.writeFileSync(uitPad, JSON.stringify(uit) + '\n');
  return { bestanden: Object.keys(uit.bestanden).length, onleesbaar: uit.onleesbaar };
}

/* Takkenbestanden optellen: de noemer is elke functie en elk blokbegin dat
   ergens is gemeld; een functie die ergens is aangeroepen, is gedekt; een plek
   die in een batch is uitgevoerd, is uitgevoerd.

   FAIL-CLOSED OP DE VERSIE. Een bestand van versie 1 draagt begin-eind-sleutels
   zonder onderscheid tussen functie en blok; dat is niet terug te rekenen naar
   deze sleutels, en het met versie 2 mengen zou de dubbeltelling terugbrengen. */
function voegSamen(lijst) {
  const per = new Map();
  let onleesbaar = 0;
  let botsingen = 0;
  for (const k of lijst) {
    if (!k || k.versie !== VERSIE) {
      throw new Error('takkenbestand van versie ' + (k && k.versie) + ', verwacht ' + VERSIE +
        ': oude sleutels zijn niet met de nieuwe op te tellen');
    }
    onleesbaar += Number(k.onleesbaar) || 0;
    for (const [rel, b] of Object.entries(k.bestanden || {})) {
      let doel = per.get(rel);
      if (!doel) { doel = leeg(); per.set(rel, doel); }
      for (const t of b.functies || []) doel.functies.add(t);
      for (const t of b.gedekteFuncties || []) doel.gedekteFuncties.add(t);
      for (const t of b.blokken || []) doel.blokken.add(Number(t));
      doel.stukken.push(...(b.uitgevoerd || []));
      doel.botsingen += Number(b.botsingen) || 0;
      botsingen += Number(b.botsingen) || 0;
    }
  }
  for (const d of per.values()) d.stukken = voegStukkenSamen(d.stukken);
  return { per, onleesbaar, botsingen };
}

/* Per bestand: welke sleutels er zijn en welke gedekt. De sleutels zelf staan
   erbij, zodat een toets (en een mens) kan zien WELKE tak er telt. */
function sleutels(d) {
  const uit = [];
  for (const f of d.functies) uit.push({ sleutel: 'F:' + f, gedekt: d.gedekteFuncties.has(f) });
  for (const b of d.blokken) uit.push({ sleutel: 'B:' + b, gedekt: binnenStuk(d.stukken, b) });
  return uit;
}

function perBestand(samen) {
  const uit = {};
  for (const rel of [...samen.per.keys()].sort()) {
    let gedekt = 0, totaal = 0;
    for (const s of sleutels(samen.per.get(rel))) { totaal++; if (s.gedekt) gedekt++; }
    uit[rel] = { gedekt, ongedekt: totaal - gedekt, totaal };
  }
  return uit;
}

function tel(samen) {
  let gedekt = 0, totaal = 0;
  for (const d of samen.per.values()) {
    for (const s of sleutels(d)) { totaal++; if (s.gedekt) gedekt++; }
  }
  const pct = totaal === 0 ? 100 : Math.round((gedekt / totaal) * 10000) / 100;
  return { bestanden: samen.per.size, gedekt, totaal, pct, onleesbaar: samen.onleesbaar,
    botsingen: samen.botsingen || 0 };
}

module.exports = { VERSIE, uitRuw, naarBestand, bewaar, voegSamen, tel, perBestand, sleutels, uitgevoerd };
