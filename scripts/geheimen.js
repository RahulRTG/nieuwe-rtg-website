#!/usr/bin/env node
/* Secret-scan: doorzoekt de GETRACKTE bestanden op hoog-vertrouwen secret-patronen
   (prefix-gebaseerd, dus geen valse alarmen op nep-testsleutels met veel entropie).
   Faalt (exit 1) zodra er iets als een echte sleutel/token uitziet, zodat een per
   ongeluk gecommit geheim de CI rood maakt. Aanvult op GitHub's eigen secret
   scanning (die als repo-instelling aanstaat en push-protection biedt).

   Draai:  node scripts/geheimen.js            (scant git ls-files)
           node scripts/geheimen.js <bestand>  (scant losse bestanden; voor de zelftest) */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Hoog-vertrouwen patronen: een herkenbaar voorvoegsel + vaste lengte. Generieke
// "40 tekens base64" laten we bewust weg -- dat geeft ruis op hashes en testdata.
const PATRONEN = [
  ['AWS-toegangssleutel', /\bAKIA[0-9A-Z]{16}\b/],
  ['Privesleutel (PEM)', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['GitHub-token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Slack-token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['Google-API-sleutel', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Stripe live-sleutel', /\bsk_live_[0-9A-Za-z]{16,}\b/],
  ['Anthropic-API-sleutel', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ['Google OAuth-clientgeheim', /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/],
  ['JWT (mogelijk lek)', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/]
];

// Nooit scannen: lockfiles (integrity-hashes), binaire/build-uitvoer, deze scanner zelf.
const OVERSLAAN = /(^|\/)(package-lock\.json|node_modules\/|\.git\/|public\/dist\/|scripts\/geheimen\.js)/;
const BINAIR = /\.(png|jpe?g|gif|webp|ico|mp4|webm|mov|woff2?|ttf|otf|pdf|zip|gz|wasm)$/i;

function bestanden() {
  if (process.argv.length > 2) return process.argv.slice(2);
  return execSync('git ls-files', { cwd: path.join(__dirname, '..'), encoding: 'utf8' })
    .split('\n').map(s => s.trim()).filter(Boolean);
}

const wortel = path.join(__dirname, '..');
let vondsten = 0;
for (const rel of bestanden()) {
  if (OVERSLAAN.test(rel) || BINAIR.test(rel)) continue;
  const pad = path.isAbsolute(rel) ? rel : path.join(wortel, rel);
  let tekst;
  try { tekst = fs.readFileSync(pad, 'utf8'); } catch (e) { continue; }
  if (tekst.indexOf('\x00') !== -1) continue; // binair bestand: overslaan
  const regels = tekst.split('\n');
  for (let i = 0; i < regels.length; i++) {
    for (const [naam, re] of PATRONEN) {
      if (re.test(regels[i])) {
        console.error('LEK  ' + rel + ':' + (i + 1) + '  (' + naam + ')');
        vondsten++;
      }
    }
  }
}

if (vondsten) {
  console.error('\n' + vondsten + ' mogelijk geheim(en) in de broncode. Haal ze eruit (en roteer de sleutel) voordat je pusht.');
  process.exit(1);
}
console.log('secret-scan: schoon (geen sleutels of tokens in de getrackte bestanden).');
