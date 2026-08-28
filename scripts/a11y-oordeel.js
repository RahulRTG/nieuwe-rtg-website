#!/usr/bin/env node
'use strict';

/* HET OORDEEL OVER DE OPGEDEELDE A11Y-SCAN.

   Elk deel van de scan (scripts/a11y.js --deel=N/M --meting=<bestand>) schrijft
   ruwe tellingen weg en zwijgt verder. Dit script telt die delen op en velt
   daarna EEN keer het oordeel, tegen hetzelfde budget als toen de scan nog in
   zijn geheel draaide (A11Y-INGELOGD.json). Het oordeel zelf staat in
   scripts/lib/a11yoordeel.js, zodat de hele scan en deze samentelling door
   dezelfde code lopen en niet uit elkaar kunnen groeien.

   DRIE MANIEREN WAAROP DIT STIL KON GAAN LIEGEN, en wat er tegen staat:

   1. EEN DEEL DAT NIETS AFLEVERDE. Zonder controle telt dit script drie kwart
      van de ronde op, vindt netjes nul fouten en meldt groen. Daarom: er moeten
      evenveel metingen zijn als delen beloofd, en samen moeten ze ALLE schermen
      hebben gezien die scripts/schermen.js kent.
   2. EEN DEEL DAT MINDER SCHERMEN ZAG DAN HET DACHT. Dezelfde controle vangt
      dat: het aantal opgetelde schermen moet exact kloppen, niet ongeveer.
   3. HET BUDGET PER DEEL. Dat is de fout die dit hele bestand voorkomt -- zie
      de kop van scripts/lib/a11yoordeel.js.

   Gebruik:
     node scripts/a11y-oordeel.js <map-met-metingen> [--delen=4]
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { alleSchermen } = require('./schermen');
const oordeel = require('./lib/a11yoordeel');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const verwachteDelen = Number((argv.find(a => a.startsWith('--delen=')) || '').slice(8)) || 0;
const paden = argv.filter(a => !a.startsWith('--'));

function metingen(paden) {
  const uit = [];
  for (const p of paden) {
    let st;
    try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) {
      for (const naam of fs.readdirSync(p).sort()) uit.push(...metingen([path.join(p, naam)]));
    } else if (p.endsWith('.json')) {
      try { uit.push(JSON.parse(fs.readFileSync(p, 'utf8'))); }
      catch (e) { console.error('[a11y] onleesbare meting: ' + p + ' (' + e.message + ')'); process.exit(1); }
    }
  }
  return uit;
}

if (!paden.length) {
  console.error('Geef de map met de metingen van de delen mee.');
  process.exit(2);
}

const delen = metingen(paden);
if (!delen.length) {
  console.error('[a11y] geen metingen gevonden in: ' + paden.join(', ') + ' -- dan stelt dit oordeel niets vast.');
  process.exit(1);
}
if (verwachteDelen && delen.length !== verwachteDelen) {
  console.error('[a11y] ' + delen.length + ' meting(en) gevonden terwijl er ' + verwachteDelen +
    ' delen beloofd zijn. Een ontbrekend deel is geen groene ronde.');
  process.exit(1);
}

const samen = oordeel.telOp(delen);
const verwachteSchermen = alleSchermen().length + 1;   // + /site/404.html, zie a11y.js
if (samen.paginas !== verwachteSchermen) {
  console.error('[a11y] de delen samen zagen ' + samen.paginas + ' schermen, en er zijn er ' +
    verwachteSchermen + '. Er is een deel dat minder heeft gemeten dan het beloofde;');
  console.error('       een oordeel over een gat is geen oordeel.');
  process.exit(1);
}

console.log('\n[a11y] ' + delen.length + ' delen samengeteld: ' +
  delen.map(d => d.deel + ' (' + d.paginas + ')').join(', '));
for (const r of samen.perRonde) console.log(`[a11y] ${r.naam.padEnd(10)} ${r.struct} structureel · ${r.contr} contrast`);

const grens = JSON.parse(fs.readFileSync(path.join(ROOT, 'A11Y-INGELOGD.json'), 'utf8'));
const uit = oordeel.veld(samen, grens);
if (uit.fouten.length) {
  console.error('\n[a11y] MISLUKT:');
  for (const f of uit.fouten) console.error('  · ' + f);
  process.exit(1);
}
for (const m of uit.meldingen) console.log(m);
console.log(uit.samenvatting);
