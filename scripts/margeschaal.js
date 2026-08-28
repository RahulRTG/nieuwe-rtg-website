#!/usr/bin/env node
/* ============================================================================
   DE MARGES OP DE RUIMTESCHAAL VAN ONTWERP.MD.

   WAT ER STOND. Zeventien willekeurige stappen -- .3, .35, .4, .45, .5, .55,
   .6, .65, .7, .8, .9, 1, 1.1, 1.2, 1.4, 1.5rem -- door elkaar geschreven als
   `.5rem` en `0.5rem`. Niemand heeft die gekozen; ze zijn ontstaan. Het verschil
   tussen 0.55rem en 0.6rem is 0,8 pixel: dat is geen ontwerpbeslissing maar
   ruis.

   WAAROM DAT MEER IS DAN NETHEID. Zolang er zeventien stappen zijn, heeft elke
   stap een eigen hulpklasse nodig, en dan is `style="..."` wegwerken een
   oefening in het verplaatsen van rommel. Met vijf stappen dekt een handvol
   klassen alles. De ruimteschaal is dus de voorwaarde onder TAKEN.md 4.51 en
   niet een aparte wens.

   DE SCHAAL STAAT IN ONTWERP.MD EN NIET HIER. Drie van de vijf stappen zijn de
   basisruimte van World, Pro en Command, die daar al in de modi-tabel stonden.
   Dit script voert uit; het bedenkt niets.

   WAT HET MET RUST LAAT, en dat is met opzet ruim:
     - `0` en `auto`             geen ruisstap, nergens naartoe te snappen
     - alles boven 2rem          een bewuste grote sprong, geen ruis
     - `px`, `%`, `calc()`, `em` die zitten in een berekening of in een raster
     - negatieve marges          die trekken iets ergens overheen; een halve
                                 pixel daar is zelden toeval
     - alles buiten een `style="..."`-attribuut. De CSS-bestanden zijn een eigen
       vraag met een eigen risico (cascade, specificiteit) en horen niet in
       dezelfde ronde.

   BIJ GELIJKE AFSTAND NAAR DE RUIMERE STAP. 1rem ligt precies tussen 0.75 en
   1.25. Dat wordt 1.25, want CLAUDE.md zegt: bij twijfel meer ruimte.

   Draai:  node scripts/margeschaal.js --proef      (telt, schrijft niets)
           node scripts/margeschaal.js              (zet om)
           node scripts/margeschaal.js --controle   (zakt op elke stap ernaast)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const PUB = path.join(WORTEL, 'public');
const SCHAAL = [0.25, 0.5, 0.75, 1.25, 2];
const MAX = 2;

/* De dichtstbijzijnde stap; bij een gelijkspel de ruimere. */
function opSchaal(x) {
  let best = SCHAAL[0];
  for (const s of SCHAAL) {
    const d = Math.abs(s - x), db = Math.abs(best - x);
    if (d < db - 1e-9 || (Math.abs(d - db) < 1e-9 && s > best)) best = s;
  }
  return best;
}

const isMarge = (p) => /^margin(-top|-bottom|-left|-right)?$/.test(p);
/* Een enkelvoudige, positieve rem-waarde binnen bereik. Alles wat hier niet aan
   voldoet blijft staan -- de lijst met uitzonderingen in de kop hierboven is
   deze functie. */
const REM = /^([0-9]*\.?[0-9]+)rem$/;

function nieuweWaarde(waarde) {
  /* Een korthand kan meerdere waarden dragen ("0.5rem 1rem auto"). Elk stuk
     wordt apart gewogen; wat geen rem-stap is, blijft letterlijk staan. */
  const stukken = String(waarde).trim().split(/\s+/);
  let veranderd = false;
  const uit = stukken.map((st) => {
    const m = REM.exec(st);
    if (!m) return st;
    const x = parseFloat(m[1]);
    if (!(x > 0) || x > MAX) return st;
    const d = opSchaal(x);
    if (Math.abs(d - x) < 1e-9) return d + 'rem';   // ook de schrijfwijze gelijk: .5rem -> 0.5rem
    veranderd = true;
    return d + 'rem';
  });
  const samen = uit.join(' ');
  return { tekst: samen, veranderd: veranderd || samen !== String(waarde).trim() };
}

/* Elk style-attribuut, declaratie voor declaratie. De aanhalingstekens blijven
   zoals ze waren -- een enkel quote in een JS-string omzetten naar een dubbele
   zou de string zelf breken. */
const ATTR = /style\s*=\s*("([^"]*)"|'([^']*)')/g;

function zetOm(bron) {
  let raak = 0, netjes = 0;
  const uit = bron.replace(ATTR, (heel, geheel, dubbel, enkel) => {
    const inhoud = dubbel !== undefined ? dubbel : enkel;
    const quote = dubbel !== undefined ? '"' : "'";
    let iets = false;
    const declaraties = inhoud.split(';').map((decl) => {
      const i = decl.indexOf(':');
      if (i < 0) return decl;
      const naam = decl.slice(0, i).trim().toLowerCase();
      if (!isMarge(naam)) return decl;
      const voor = decl.slice(i + 1);
      const r = nieuweWaarde(voor);
      if (!r.veranderd) return decl;
      iets = true;
      if (r.tekst !== voor.trim().replace(/\s+/g, ' ')) raak++; else netjes++;
      return decl.slice(0, i + 1) + (/^\s/.test(voor) ? ' ' : '') + r.tekst;
    });
    if (!iets) return heel;
    return 'style=' + quote + declaraties.join(';') + quote;
  });
  return { uit, raak, netjes };
}

/* Wat er NA de omzetting nog naast de schaal ligt. Dit is de controlekant: hij
   telt wat een omzetting zou veranderen, en dat hoort nul te zijn. */
function ernaast(bron) {
  const uit = [];
  let m;
  const attr = new RegExp(ATTR.source, 'g');
  while ((m = attr.exec(bron))) {
    const inhoud = m[2] !== undefined ? m[2] : m[3];
    for (const decl of inhoud.split(';')) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const naam = decl.slice(0, i).trim().toLowerCase();
      if (!isMarge(naam)) continue;
      const r = nieuweWaarde(decl.slice(i + 1));
      if (r.veranderd) uit.push(naam + ':' + decl.slice(i + 1).trim());
    }
  }
  return uit;
}

function bestanden() {
  const uit = [];
  (function loop(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'dist') loop(p); continue; }
      if (/\.(html|js)$/.test(e.name)) uit.push(p);
    }
  })(PUB);
  return uit;
}

function main() {
  const proef = process.argv.includes('--proef');
  const controle = process.argv.includes('--controle');
  let raak = 0, netjes = 0, geraakt = 0;
  const klachten = [];
  for (const pad of bestanden()) {
    const bron = fs.readFileSync(pad, 'utf8');
    if (controle) {
      const fout = ernaast(bron);
      if (fout.length) klachten.push([path.relative(WORTEL, pad), fout]);
      continue;
    }
    const r = zetOm(bron);
    if (!r.raak && !r.netjes) continue;
    raak += r.raak; netjes += r.netjes; geraakt++;
    if (!proef) fs.writeFileSync(pad, r.uit);
  }
  if (controle) {
    if (!klachten.length) { console.log('  Alle rem-marges liggen op de ruimteschaal van ONTWERP.md 2b.'); return 0; }
    const totaal = klachten.reduce((a, b) => a + b[1].length, 0);
    console.error('\n  ' + totaal + ' marge(s) naast de ruimteschaal, in ' + klachten.length + ' bestand(en):\n');
    for (const [f, lijst] of klachten.slice(0, 15)) console.error('    ' + f + ': ' + lijst.slice(0, 4).join(', '));
    if (klachten.length > 15) console.error('    ... en nog ' + (klachten.length - 15) + ' bestanden');
    console.error('\n  De schaal staat in ONTWERP.md 2b (0.25 / 0.5 / 0.75 / 1.25 / 2rem).\n' +
      '  Zet ze om met: node scripts/margeschaal.js\n');
    return 1;
  }
  console.log((proef ? '[proef] ' : '') + raak + ' marge(s) naar de schaal en ' + netjes +
    ' alleen anders geschreven (.5rem -> 0.5rem), in ' + geraakt + ' bestanden.');
  return 0;
}

module.exports = { opSchaal, nieuweWaarde, zetOm, ernaast, SCHAAL };
if (require.main === module) process.exit(main());
