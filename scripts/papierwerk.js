#!/usr/bin/env node
/* ============================================================================
   PAPIERWERK OP PAPIER -- de achttien vragen als invulbestand.

   npm run golive blokkeert zolang het papierwerk niet af is: achttien vragen
   die alleen RTG kan beantwoorden (het KvK-nummer, het vestigingsadres, de
   functionaris gegevensbescherming, de bewaartermijnen, wie er bij een datalek
   om drie uur 's nachts gebeld wordt). Die vragen worden normaal gesproken
   uitgevraagd op de technische pagina, vraag voor vraag.

   Dit script is de andere weg: het schrijft ze allemaal in een bestand dat je
   in je eigen tempo invult, en leest dat bestand daarna weer in.

   WAAROM ER GEEN VOORINGEVULDE ANTWOORDEN IN STAAN. Een verwerkingsregister
   met een verzonnen KvK-nummer is geen half document maar een onwaar document.
   Het is een stuk dat je aan een toezichthouder overlegt en waar leden rechten
   aan ontlenen. Alles wat hier staat moet ergens vandaan komen; daarom staat
   er bij elke vraag wat hij betekent en wat een geldig antwoord is, en verder
   niets.

   Wat dit script WEL en NIET doet: het zet de antwoorden op de plek waar de
   keuring ze leest. Het beoordeelt niet of ze juridisch kloppen -- dat blijft
   mensenwerk, en het document zegt dat zelf ook.

   Het ingevulde bestand bevat privénummers en bedrijfsgegevens. Het komt
   daarom in server/data/ terecht: die map staat in .gitignore en hoort daar te
   blijven.

   Schrijven:  node scripts/papierwerk.js
   Inlezen:    node scripts/papierwerk.js --lees
   Andere plek: beide met een pad erachter.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const papieren = require(path.join(WORTEL, 'server', 'papieren'));
const DATADIR = process.env.RTG_DATA_DIR || path.join(WORTEL, 'server', 'data');
const STANDAARD = path.join(DATADIR, 'papierwerk-invullen.txt');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[2m', reset: '\x1b[0m' };

const MERK = '### ';
const ANTWOORD = 'Antwoord:';

/* Wat telt hier als een geldig antwoord? Dat staat niet hier maar in
   server/papieren/index.js (antwoord()), en dat hoort ook zo: twee plekken die
   allebei een mening hebben over "lang genoeg" lopen uit de pas. We beschrijven
   de eis alleen, en laten het oordeel aan de bron. */
function eisTekst(v) {
  if (v.soort === 'ja-nee-reden')
    return 'ja of nee, MET toelichting (met wie, per wanneer) -- een kaal "ja" wordt geweigerd';
  return 'vrije tekst, minstens ' + (v.min || 4) + ' tekens'
    + (v.voorbeeld ? '. Bijvoorbeeld: ' + v.voorbeeld : '');
}

function schrijf(doel) {
  const staat = papieren.overzicht();
  const perGroep = new Map();
  for (const v of papieren.VRAGEN) {
    if (!perGroep.has(v.groep)) perGroep.set(v.groep, []);
    perGroep.get(v.groep).push(v);
  }
  const uit = [];
  uit.push('PAPIERWERK VOOR DE LANCERING -- ' + papieren.VRAGEN.length + ' vragen');
  uit.push('='.repeat(72));
  uit.push('');
  uit.push('Vul achter "' + ANTWOORD + '" je antwoord in, op een of meer regels. Lees het');
  uit.push('daarna in met:   node scripts/papierwerk.js --lees');
  uit.push('');
  uit.push('Weet je iets nog niet? Laat het leeg, of schrijf "weet ik niet". Dan blijft');
  uit.push('het punt open staan en gaat de keuring er niet overheen. Dat is beter dan');
  uit.push('iets invullen om van het rode kruisje af te zijn: dit papier gaat naar een');
  uit.push('toezichthouder, en leden ontlenen er rechten aan.');
  uit.push('');
  uit.push('Regels die met # beginnen worden genegeerd.');
  uit.push('');

  let n = 0;
  for (const [groep, vragen] of perGroep) {
    uit.push('');
    uit.push('-'.repeat(72));
    uit.push('  ' + groep.toUpperCase());
    uit.push('-'.repeat(72));
    for (const v of vragen) {
      n++;
      const al = (staat.antwoorden || {})[v.id];
      const ingevuld = al && al.waarde && !al.parkeer ? al.waarde : '';
      uit.push('');
      uit.push(MERK + n + '. ' + v.id);
      uit.push('# Vraag:  ' + v.vraag);
      if (v.waarom) for (const r of hak('# Waarom: ', v.waarom)) uit.push(r);
      if (v.huidig) for (const r of hak('# Nu:     ', v.huidig)) uit.push(r);
      uit.push('# Geldig: ' + eisTekst(v));
      uit.push(ANTWOORD + (ingevuld ? ' ' + ingevuld : ''));
    }
  }
  uit.push('');
  fs.mkdirSync(path.dirname(doel), { recursive: true });
  fs.writeFileSync(doel, uit.join('\n'), { mode: 0o600 });
  return { pad: doel, aantal: n };
}

// een lange uitleg netjes over regels van ~76 tekens, met de inspringing erbij
function hak(voorvoegsel, tekst) {
  const woorden = String(tekst).split(/\s+/);
  const regels = []; let r = voorvoegsel;
  for (const w of woorden) {
    if ((r + ' ' + w).length > 76 && r !== voorvoegsel) { regels.push(r); r = '#         ' + w; }
    else r = r === voorvoegsel ? r + w : r + ' ' + w;
  }
  if (r.trim() !== '#') regels.push(r);
  return regels;
}

function lees(bron) {
  if (!fs.existsSync(bron)) {
    console.log('\n  ' + K.rood + 'Geen invulbestand op ' + bron + K.reset);
    console.log('  ' + K.grijs + 'Maak hem eerst met: node scripts/papierwerk.js' + K.reset + '\n');
    return 1;
  }
  const regels = fs.readFileSync(bron, 'utf8').split('\n');
  const blokken = [];
  let huidig = null, verzamelt = false;
  for (const regel of regels) {
    if (regel.startsWith(MERK)) {
      const id = (regel.slice(MERK.length).match(/^\d+\.\s*(\S+)/) || [])[1];
      huidig = { id, tekst: [] };
      verzamelt = false;
      if (id) blokken.push(huidig);
      continue;
    }
    if (!huidig) continue;
    if (regel.startsWith('#')) continue;                      // uitleg
    if (regel.startsWith(ANTWOORD)) {
      const eerste = regel.slice(ANTWOORD.length).trim();
      if (eerste) huidig.tekst.push(eerste);
      verzamelt = true;                                       // meerregelig antwoord mag
      continue;
    }
    /* EEN LEGE REGEL SLUIT HET ANTWOORD. Zonder deze grens liep het door tot de
       volgende ###, en dan slurpte een antwoord de streepjeslijn en het
       tussenkopje van de volgende groep op. Dat gebeurde ook echt: er stond
       "ja ---------- BEWAARTERMIJNEN" in het register, en twee vragen die
       helemaal LEEG waren kregen zo alsnog een "antwoord" dat uit niets dan
       opmaak bestond. Een document dat je aan een toezichthouder overlegt mag
       niet vollopen met de vormgeving van het invulvel. */
    if (!regel.trim()) { verzamelt = false; continue; }
    if (verzamelt) huidig.tekst.push(regel.trim());
  }

  const goed = [], leeg = [], stuk = [];
  for (const b of blokken) {
    const waarde = b.tekst.join(' ').replace(/\s+/g, ' ').trim();
    if (!waarde) { leeg.push(b.id); continue; }
    const r = papieren.antwoord(b.id, waarde, { door: 'papierwerk.js' });
    if (r.fout) stuk.push({ id: b.id, reden: r.fout });
    else if (r.geparkeerd) leeg.push(b.id);
    else goed.push(b.id);
  }

  console.log('\n\x1b[1mPAPIERWERK INGELEZEN\x1b[0m ' + K.grijs + bron + K.reset + '\n');
  console.log('  ' + K.groen + goed.length + ' vastgelegd' + K.reset
    + ', ' + K.geel + leeg.length + ' nog open' + K.reset
    + (stuk.length ? ', ' + K.rood + stuk.length + ' geweigerd' + K.reset : ''));
  for (const s of stuk) console.log('    ' + K.rood + s.id + K.reset + ': ' + s.reden);
  if (leeg.length) console.log('    ' + K.grijs + 'nog open: ' + leeg.join(', ') + K.reset);
  const open = papieren.openVragen();
  console.log('\n  ' + (open.length
    ? K.geel + open.length + ' van de ' + papieren.VRAGEN.length + ' vragen staan nog open' + K.reset
      + '\n  ' + K.grijs + 'npm run golive blijft daarop blokkeren, en dat is de bedoeling.' + K.reset
    : K.groen + 'Alle ' + papieren.VRAGEN.length + ' vragen zijn beantwoord.' + K.reset
      + '\n  ' + K.grijs + 'Laat het papier alsnog juridisch nakijken; dit script leest alleen of het af is.' + K.reset));
  console.log('');
  return stuk.length ? 1 : 0;
}

function main() {
  const args = process.argv.slice(2);
  const wilLezen = args.includes('--lees');
  const pad = args.find(a => !a.startsWith('--')) || STANDAARD;
  if (wilLezen) return lees(pad);

  const r = schrijf(pad);
  const open = papieren.openVragen().length;
  console.log('\n\x1b[1mPAPIERWERK\x1b[0m ' + K.grijs + r.aantal + ' vragen geschreven' + K.reset + '\n');
  console.log('  ' + r.pad);
  console.log('  ' + K.grijs + 'rechten 0600, in server/data/ -- die map staat in .gitignore en hoort daar te blijven' + K.reset);
  console.log('\n  ' + (open ? open + ' van de ' + r.aantal + ' vragen staan nog open.' : 'Alle vragen waren al beantwoord; ze staan ingevuld in het bestand.'));
  console.log('  ' + K.grijs + 'Vul in en lees terug met: node scripts/papierwerk.js --lees' + K.reset + '\n');
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { schrijf, lees };
