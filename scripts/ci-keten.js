#!/usr/bin/env node
'use strict';

/* ============================================================================
   HET CI-CONTRACT: de keten toetst zichzelf.

   De toetsen bewaken het product. Dit bewaakt het systeem dat die toetsen
   draait -- en dat had niemand, terwijl er in de werkstromen precies de vorm
   fouten stond die in de code allang een keuringsregel had.

   VIER REGELS, ALLE VIER UIT EEN VONDST VAN 31 AUGUSTUS 2026:

   1. EEN CHECKOUT LAAT GEEN CREDENTIAL ACHTER. Eenentwintig checkouts stonden
      zonder `persist-credentials: false`, dus in elke job stond een
      GITHUB_TOKEN in .git/config terwijl 1058 toetsbestanden en de scripts van
      elke dependency in diezelfde job draaiden. Geen enkele job hier pusht.

   2. DE RUNTIME WORDT GEDECLAREERD, NIET OVERGETYPT. In ci.yml stond negen keer
      node 26 en vijf keer node 22 -- geen matrix, geen besluit, uit elkaar
      gegroeid. De schermtoetsen draaiden daardoor op een andere versie dan
      productie (Dockerfile: node:26-slim). Een echte versiematrix mag: dan
      staat er `${{ matrix.… }}` en is de keuze te zien.

   3. ER WORDT NIETS GEINSTALLEERD BUITEN DE LOCKFILE OM. In acht jobs stond
      `npm i --no-save playwright@^1.49.0` NA `npm ci`: een tweede installatie
      zonder integriteitscontrole, op een bereik dat niet meer klopte met wat
      package-lock.json pint. De schermtoetsen draaiden op een versie die de
      repo niet vastlegde.

   4. ELKE EXTERNE ACTION STAAT OP EEN COMMIT-SHA. Dat was de oorspronkelijke
      regel van dit bestand; een tag als @v4 is verplaatsbaar, en een gekaapt
      Action-account verplaatst hem.

   WAAROM HIER EN NIET IN EEN NIEUW BESTAND. Er bestond al een keuring over de
   werkstromen. Een tweede ernaast is LAT.md regel 4 op de plek waar hij het
   goedkoopst te vermijden is.

   WAT DEZE KEURING NIET IS. Hij leest tekst, geen betekenis: hij ziet dat er
   een runtime gedeclareerd staat, niet of het de juiste is. En hij zegt niets
   over wat een job DOET -- alleen over hoe zijn omgeving tot stand komt.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

function losseActions(tekst, bestand) {
  const fout = [];
  String(tekst).split(/\r?\n/).forEach((regel, i) => {
    const m = /^\s*(?:-\s*)?uses:\s*([^\s#]+)/.exec(regel);
    if (!m || m[1].startsWith('./')) return;
    const at = m[1].lastIndexOf('@');
    const ref = at >= 0 ? m[1].slice(at + 1) : '';
    if (!/^[0-9a-f]{40}$/.test(ref)) fout.push(`${bestand}:${i + 1} ${m[1]}`);
  });
  return fout;
}


/* 1) EEN CHECKOUT LAAT GEEN CREDENTIAL ACHTER.

   De regel kijkt naar het blok dat op de checkout volgt: `with:` en daaronder
   de inspringende sleutels. Staat `persist-credentials: false` daar niet bij,
   dan blijft het token in .git/config staan. */
function checkoutMetCredential(tekst, bestand) {
  const fout = [];
  const R = String(tekst).split(/\r?\n/);
  R.forEach((regel, i) => {
    const m = /^(\s*)-\s*uses:\s*actions\/checkout@/.exec(regel);
    if (!m) return;
    const diep = m[1].length;
    let gevonden = false;
    for (let j = i + 1; j < R.length; j++) {
      const r = R[j];
      if (!r.trim()) continue;
      const inspring = r.length - r.trimStart().length;
      /* Terug op of boven het niveau van de stap: het blok is afgelopen. */
      if (inspring <= diep) break;
      if (/^\s*persist-credentials:\s*false\s*$/.test(r)) { gevonden = true; break; }
    }
    if (!gevonden) fout.push(`${bestand}:${i + 1} checkout zonder persist-credentials: false`);
  });
  return fout;
}

/* 2) DE RUNTIME WORDT GEDECLAREERD, NIET OVERGETYPT.

   `node-version-file` wijst naar .nvmrc en is dus een verwijzing naar de
   waarheid. Een LETTERLIJK getal is een kopie, en kopieen lopen uiteen. Een
   matrixwaarde mag wel: dan is de spreiding een zichtbaar besluit. */
function overgetypteRuntime(tekst, bestand) {
  const fout = [];
  String(tekst).split(/\r?\n/).forEach((regel, i) => {
    const m = /^\s*node-version:\s*(.+?)\s*$/.exec(regel);
    if (!m) return;
    const waarde = m[1].replace(/^['"]|['"]$/g, '');
    if (waarde.includes('matrix.')) return;
    fout.push(`${bestand}:${i + 1} node-version: ${waarde} -- gebruik node-version-file: '.nvmrc' of een zichtbare matrix`);
  });
  return fout;
}

/* 3) ER WORDT NIETS GEINSTALLEERD BUITEN DE LOCKFILE OM.

   `npm ci` installeert exact wat package-lock.json pint. Elke andere
   npm-installatie in een run-stap zet daar iets naast dat niemand vastlegt.
   Een pad naar een lokaal bestand (`npm i ./iets`) valt hier ook onder: ook
   dat staat niet in de lockfile van deze bouw. */
const INSTALLEERT = /(?:^|[\s;&|(])(?:npm\s+(?:i|install|add)\b(?!\s+ci\b)|yarn\s+add\b|pnpm\s+(?:i|install|add)\b)/;
function installatieBuitenLockfile(tekst, bestand) {
  const fout = [];
  String(tekst).split(/\r?\n/).forEach((regel, i) => {
    /* Commentaar telt niet: deze bestanden leggen hun geschiedenis erin vast,
       en een keuring die op zijn eigen uitleg zakt leert je wegkijken. */
    const code = regel.replace(/#.*$/, '');
    if (!INSTALLEERT.test(code)) return;
    if (/npm\s+ci\b/.test(code)) return;
    fout.push(`${bestand}:${i + 1} installeert buiten package-lock.json om: ${regel.trim()}`);
  });
  return fout;
}

const REGELS = [losseActions, checkoutMetCredential, overgetypteRuntime, installatieBuitenLockfile];

function controleer(map) {
  const fout = [];
  for (const naam of fs.readdirSync(map).filter(n => /\.ya?ml$/.test(n)).sort()) {
    const bestand = path.join(map, naam);
    const tekst = fs.readFileSync(bestand, 'utf8');
    for (const regel of REGELS) fout.push(...regel(tekst, bestand));
  }
  return fout;
}

if (require.main === module) {
  const map = path.join(__dirname, '..', '.github', 'workflows');
  const fout = controleer(map);
  if (fout.length) {
    console.error('Het CI-contract is geschonden (' + fout.length + '):');
    fout.forEach(f => console.error(' - ' + f));
    process.exitCode = 1;
  } else {
    console.log('Het CI-contract: elke Action op een SHA, elke checkout zonder credential,\n' +
      '  elke runtime gedeclareerd, geen installatie buiten de lockfile om.');
  }
}

module.exports = { losseActions, checkoutMetCredential, overgetypteRuntime,
  installatieBuitenLockfile, REGELS, controleer };
