#!/usr/bin/env node
/* ============================================================================
   DE SCHERMDEKKING -- legt een toets de weg van deze app werkelijk af?

   WAAROM DIT ER IS

   "Af" was in dit huis een bewering. Een app kreeg een menu, een uitvoerknop
   en sneltoetsen, er stond "klaar" in een tussenstand, en niemand kon nagaan
   of er ooit een browser op dat scherm had gestaan. Bij 188 app-schermen is
   dat geen detail: het is het verschil tussen een systeem dat werkt en een
   systeem waarvan iedereen aanneemt dat het werkt.

   LAT.md regel 2 zegt het al: trek elke bewering na. Deze meter maakt er een
   getal van dat niet weg te praten is.

   EN WAAROM HET NIET "GEOPEND" TELT

   De eerste versie telde precies dat, en gaf bij zijn allereerste meting 188
   van 188 -- een meter die meteen "in orde" zegt, en dat is de vorm waar
   LAT-regel 10 voor waarschuwt. De oorzaak was geen fout in de telling maar
   een te makkelijke vraag: test/leven.e2e.js loopt ALLE schermen langs om te
   zien of ze een teken van leven geven, dus "geopend" was al waar voordat
   iemand iets had bewezen.

   Een veeg is nuttig (dood is stiller dan stuk), maar het is geen weg die
   wordt afgelegd. Daarom noteert de server er sinds deze ronde bij WELKE toets
   het scherm opvroeg (RTG_TOETS, gezet in test/helper.js), en telt deze meter
   de schermen waar geen enkele toets meer doet dan even langslopen.

   HET VERSCHIL MET EEN TEKSTTELLING

   Je kunt ook de schermtoetsen doorzoeken op bestandsnamen. Dat is precies de
   fout die scripts/keuring.js twee keer heeft gemaakt en die in
   server/routelog.js met naam staat: een meter die tekst leest in plaats van
   waarnemingen. Hij liegt twee kanten op -- een toets die via een tegel op het
   bureaublad doorklikt noemt de pagina nergens, en een pad in een commentaar
   telt gewoon mee. Zo'n cijfer poets je op met zoek-en-vervang.

   Daarom vraagt dit script het aan de SERVER. De haken in
   middleware/voordeur.js (de nonce-laag, die elke pagina zelf serveert) en
   web/bestanden.js (de statische laag, als die nonce-laag uitstaat) schrijven
   met RTG_ROUTELOG gezet een regel `SCHERM /apps/x.html`. Wat daarin staat is
   geopend. Wat er niet in staat, niet.

   EN OPGEHAALD IS NOG NIET BEZOCHT

   Dat "wat daarin staat is geopend" klopte een tijd lang niet. Een service
   worker haalt bij zijn install zijn hele schil voorop, en die verzoeken zijn
   van een bezoek niet te onderscheiden zolang je alleen het pad noteert: een
   browser die eenmaal /apps/foundation/rust.html opende leverde 45 SCHERM-
   regels op, alle 45 op naam van dezelfde toets. Sinds server/routelog.js het
   soort verzoek meeschrijft telt hier alleen nog een echte navigatie mee.

   Wat dat met het getal deed, op twee volledige e2e-rondes met een echte
   Chromium: 3 -> 42, met in beide rondes dezelfde 42 schermen. Drieendertig
   ervan waren wel OPGEHAALD en door geen enkele toets bezocht; die stonden
   hiervoor als "met een eigen toets" in de telling. De reden staat voluit in
   NORM.json.

   DRAAIEN

     npm run e2e                       (schrijft .schermjournaal)
     node scripts/schermen.js          (leest .schermjournaal)
     node scripts/schermen.js --lees <bestand>
     node scripts/schermen.js --json
     node scripts/schermen.js --vastleggen

   DE METER: `schermenZonderToets` in NORM.json, een AANTAL en geen percentage
   -- bij 188 schermen verdwijnen er in een afronding een stuk of twee, en dat
   zijn er twee te veel. Alleen omlaag.

   Dat getal begint hoog, en dat hoort. Het is de eerlijke maat van hoeveel
   apps hier "af" heten op iemands woord.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const NORMBESTAND = path.join(WORTEL, 'NORM.json');
const JOURNAAL = path.join(WORTEL, '.schermjournaal');
const METER = 'schermenZonderToets';

const jsonUit = process.argv.includes('--json');
const vastleggen = process.argv.includes('--vastleggen');
const leesIdx = process.argv.indexOf('--lees');

/* ---- de inventaris: welke schermen bestaan er ----
   Alles onder public/apps dat een pagina is. Geen uitzonderingslijst: wie een
   scherm niet wil laten toetsen moet dat kunnen uitleggen, en dan hoort die
   uitleg in TAKEN.md te staan en niet in een filter hier. */
function alleSchermen() {
  const uit = [];
  const loop = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) { loop(p); continue; }
      if (f.name.endsWith('.html')) uit.push('/' + path.relative(path.join(WORTEL, 'public'), p).split(path.sep).join('/'));
    }
  };
  loop(path.join(WORTEL, 'public', 'apps'));
  return uit.sort();
}

/* ---- het journaal: welke schermen zijn geopend, en door welke toets ----
   Alleen de SCHERM-regels; in hetzelfde bestand staan ook de routes.
   Vorm: `SCHERM /apps/x.html toets.e2e.js navigatie|nevenverzoek`.

   Zonder dat derde veld is een voorophaling niet van een bezoek te
   onderscheiden (zie de kop), en dan meet dit script het geheugen van een
   cache in plaats van het werk van een toets. */
function geopendeSchermen(pad) {
  let tekst = '';
  try { tekst = fs.readFileSync(pad, 'utf8'); } catch (e) { return null; }
  const afgelegd = new Map();                  // scherm -> Set van toetsen die er ECHT naartoe gingen
  const neven = new Map();                     // scherm -> Set van toetsen die hem alleen ophaalden
  let zonderSoort = 0;                         // regels van een server van voor deze ronde
  for (const regel of tekst.split('\n')) {
    const r = regel.trim();
    if (!r.startsWith('SCHERM ')) continue;
    const velden = r.slice(7).split(' ').filter(Boolean);
    if (velden.length < 3) { zonderSoort++; continue; }
    const scherm = velden[0];
    const soort = velden[velden.length - 1];
    const toets = velden.slice(1, -1).join(' ');
    const doel = soort === 'navigatie' ? afgelegd : neven;
    if (!doel.has(scherm)) doel.set(scherm, new Set());
    doel.get(scherm).add(toets);
  }
  return { afgelegd, neven, zonderSoort };
}

/* ---- de meter zelf: welke schermen legt geen enkele toets af ----
   Een eigen functie, en niet een filter in main(), omdat dit het sommetje is
   dat het getal in NORM.json draagt: test/meterijk.test.js hoort DEZE aan te
   roepen. Een ijking die hier zijn eigen telling naast zet, ijkt zijn eigen
   telling en niet de meter (LAT-regel 10). */
function zonderEigenToets(afgelegd, alle) {
  const vegers = veegToetsen(afgelegd, alle.length);
  return alle.filter(s => {
    const t = afgelegd.get(s);
    return !t || [...t].every(n => vegers.has(n));
  });
}

/* ---- welke toetsen zijn VEEGTOETSEN ----

   De eerste versie van deze meter telde alleen "is dit scherm geopend", en gaf
   bij de allereerste meting 188 van 188. Dat is de vorm waar LAT-regel 10 voor
   waarschuwt: een meter die nog nooit iets anders heeft gezegd dan "in orde".
   De oorzaak was geen fout maar een verkeerde vraag -- test/leven.e2e.js loopt
   ALLE schermen langs om te zien of ze een teken van leven geven, dus "geopend"
   was al waar voordat iemand iets had bewezen.

   Een veeg is nuttig (dood is stiller dan stuk) maar het is geen weg die wordt
   afgelegd. Daarom het onderscheid, en bewust NIET met een lijst namen: die
   veroudert en wordt dan met de hand kloppend gemaakt. Een toets die meer dan
   een kwart van alle schermen aantikt, doet per definitie geen enkele app echt
   na. Die grens leest zichzelf af aan de inventaris en verhuist dus mee. */
function veegToetsen(geopend, totaalSchermen) {
  const perToets = new Map();
  for (const toetsen of geopend.values()) {
    for (const t of toetsen) perToets.set(t, (perToets.get(t) || 0) + 1);
  }
  const grens = Math.max(10, Math.ceil(totaalSchermen / 4));
  return new Set([...perToets].filter(([, n]) => n >= grens).map(([t]) => t));
}

/* Een journaal van voor de laatste wijziging meet code die er niet meer zo
   staat, en dat leest als een meting. Dezelfde controle als in dekking.js,
   maar over de schermen: de pagina's zelf en de toetsen die ze openen. */
function jongerDanDeSchermen(pad) {
  let jn;
  try { jn = fs.statSync(pad).mtimeMs; } catch (e) { return { ok: false, reden: 'bestaat niet' }; }
  let nieuwste = 0, naam = '';
  const loop = (d, exts) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) { loop(p, exts); continue; }
      if (!exts.some(e => f.name.endsWith(e))) continue;
      const m = fs.statSync(p).mtimeMs;
      if (m > nieuwste) { nieuwste = m; naam = path.relative(WORTEL, p); }
    }
  };
  try {
    loop(path.join(WORTEL, 'public', 'apps'), ['.html']);
    loop(path.join(WORTEL, 'test'), ['.e2e.js']);
  } catch (e) { return { ok: false, reden: 'kon de bronmappen niet lezen' }; }
  if (nieuwste > jn) return { ok: false, reden: naam + ' is gewijzigd na de laatste schermrun' };
  return { ok: true };
}

function leesNorm() {
  try { return JSON.parse(fs.readFileSync(NORMBESTAND, 'utf8')); }
  catch (e) { return { meters: {} }; }
}

function main() {
  const pad = leesIdx !== -1 ? process.argv[leesIdx + 1] : JOURNAAL;
  if (leesIdx !== -1 && (!pad || !fs.existsSync(pad))) {
    console.error('Het schermjournaal "' + pad + '" bestaat niet. Draaide de e2e-suite met RTG_ROUTELOG gezet?');
    return 2;
  }
  const journaal = geopendeSchermen(pad);
  if (!journaal) {
    /* LAT.md regel 3: geen invoer is geen oordeel. Groen geven zonder journaal
       zou precies de leugen zijn die deze meter moet uitbannen. */
    console.error('Geen schermjournaal gevonden (' + path.relative(WORTEL, pad) + ').');
    console.error('Draai eerst `npm run e2e`; die schrijft het. Zonder journaal is er geen oordeel.');
    return 2;
  }
  if (journaal.zonderSoort) {
    /* Dezelfde regel 3, een laag dieper: dit journaal komt van een server die
       nog niet noteerde HOE een scherm werd opgevraagd. Zo'n regel als bezoek
       lezen geeft het oude, opgeblazen cijfer terug; hem als voorophaling
       lezen verzint een verslechtering. Beide zijn een oordeel op een gok. */
    console.error(journaal.zonderSoort + ' regels in ' + path.relative(WORTEL, pad) +
      ' zeggen niet of het een bezoek of een voorophaling was.');
    console.error('Dat journaal is van voor deze ronde. Draai `npm run e2e` opnieuw; er valt zo niets te tellen.');
    return 2;
  }
  const geopend = journaal.afgelegd;
  const vers = jongerDanDeSchermen(pad);

  const alle = alleSchermen();
  const vegers = veegToetsen(geopend, alle.length);
  const nooit = alle.filter(s => !geopend.has(s));
  /* De meter: schermen waar GEEN toets zijn eigen weg aflegt. Nooit geopend
     telt mee, en alleen-door-een-veegtoets ook -- een teken van leven is geen
     bewijs dat de app doet wat hij belooft. */
  const zonder = zonderEigenToets(geopend, alle);
  const alleenVeeg = zonder.length - nooit.length;
  /* Het gat dat de oude meter dichtpleisterde: schermen die geen enkele toets
     aflegt maar die WEL zijn opgehaald (een service worker die zijn schil
     voorophaalt, of een fetch die alleen op status 200 kijkt). Precies deze
     stonden hiervoor als "met een eigen toets" in de telling. Ze staan er dus
     bij, want een getal dat met tientallen omhoog springt hoort uit te leggen
     waarvan. (Op de ronde van 2026-08-04: 33 van de 42.) Niet op `nooit` gefilterd
     maar op `zonder`: paginas.e2e.js tikt elk scherm even aan, dus `nooit`
     staat in deze suite altijd op nul en die regel zou nooit iets tonen. */
  const alleenOpgehaald = zonder.filter(s => journaal.neven.has(s));
  const norm = leesNorm();
  const grond = norm.meters && norm.meters[METER];

  if (jsonUit) {
    console.log(JSON.stringify({
      totaal: alle.length, eigenToets: alle.length - zonder.length,
      nooitGeopend: nooit, alleenVeegtoets: zonder.filter(s => !nooit.includes(s)),
      alleenOpgehaald, veegtoetsen: [...vegers], vers
    }, null, 2));
    return 0;
  }

  console.log('\nDE SCHERMDEKKING -- legt een toets de weg van deze app af?\n');
  if (!vers.ok) console.log('  LET OP: het journaal is niet vers (' + vers.reden + '). Draai `npm run e2e` opnieuw.\n');
  console.log('  schermen totaal          ' + String(alle.length).padStart(4));
  console.log('  met een eigen toets      ' + String(alle.length - zonder.length).padStart(4));
  console.log('  alleen door een veegtoets' + String(alleenVeeg).padStart(4));
  console.log('  nooit geopend            ' + String(nooit.length).padStart(4));
  console.log('  ZONDER EIGEN TOETS       ' + String(zonder.length).padStart(4) +
    (typeof grond === 'number' ? '   (norm: ' + grond + ')' : '   (nog geen norm)'));
  if (alleenOpgehaald.length) {
    console.log('  ... daarvan wel opgehaald' + String(alleenOpgehaald.length).padStart(4));
    console.log('      (een cache die een pagina ophaalt is geen toets die hem aflegt;');
    console.log('       tot deze ronde telden juist deze mee als "met een eigen toets")');
  }
  console.log('\n  veegtoetsen (tikken een kwart of meer van alle schermen aan): ' +
    ([...vegers].join(', ') || 'geen'));

  if (zonder.length) {
    console.log('\n  Deze schermen legt geen enkele toets werkelijk af:');
    for (const s of zonder.slice(0, 40)) console.log('    ' + s);
    if (zonder.length > 40) console.log('    ... en nog ' + (zonder.length - 40));
  }

  if (vastleggen) {
    if (typeof grond === 'number' && zonder.length > grond) {
      console.error('\n  Weiger vast te leggen: ' + zonder.length + ' is slechter dan de norm ' + grond + '.');
      return 1;
    }
    norm.meters = norm.meters || {};
    norm.meters[METER] = zonder.length;
    fs.writeFileSync(NORMBESTAND, JSON.stringify(norm, null, 2) + '\n');
    console.log('\n  Vastgelegd: ' + METER + ' = ' + zonder.length);
    return 0;
  }

  if (typeof grond === 'number' && zonder.length > grond) {
    console.error('\n  DE NORM IS NIET GEHAALD: ' + zonder.length + ' schermen zonder eigen toets, terwijl de norm ' + grond + ' is.');
    console.error('  Een app waar geen toets de weg van aflegt, is niet af -- hoe compleet hij er in de code ook uitziet.');
    return 1;
  }
  console.log('');
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { alleSchermen, geopendeSchermen, jongerDanDeSchermen, veegToetsen, zonderEigenToets };
