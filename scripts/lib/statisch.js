/* Een statische server voor public/, voor de scans die een echte browser
   nodig hebben (scripts/a11y.js, scripts/telefoonmaat.js).

   Waarom apart: hij stond in a11y.js, en de tweede scan die hem nodig had zou
   hem hebben overgeschreven. Twee plekken die dezelfde waarheid vasthouden
   lopen uiteen -- meestal zonder dat iets klaagt (LAT regel 4). Eén MIME-lijst
   dus, en één padcontrole.

   Bewust GEEN backend: deze scans meten de eerste render van een scherm zoals
   de browser hem krijgt, niet het gedrag erachter. Wie de app ingelogd wil
   meten, gebruikt startServer() uit test/helper.js. */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const PUB = path.join(__dirname, '..', '..', 'public');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff' };

function server() {
  return http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    const bestand = path.join(PUB, path.normalize(rel));
    if (!bestand.startsWith(PUB)) { res.writeHead(403); return res.end(); }
    fs.readFile(bestand, (err, data) => {
      if (err) { res.writeHead(404); return res.end('niet gevonden'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(bestand)] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

/* Alle pagina's onder public/, als webpad. public/dist is bouwuitvoer en telt
   niet mee (dezelfde uitzondering die check.js hanteert). */
function paginas(dir = PUB, uit = []) {
  for (const naam of fs.readdirSync(dir).sort()) {
    const vol = path.join(dir, naam);
    if (fs.statSync(vol).isDirectory()) { if (naam !== 'dist') paginas(vol, uit); }
    else if (naam.endsWith('.html')) uit.push('/' + path.relative(PUB, vol).split(path.sep).join('/'));
  }
  return uit;
}

/* Dezelfde zoektocht als in elke e2e: het pakket als het er is, anders de
   eigen CDP-driver, anders niets. */
function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}

module.exports = { PUB, MIME, server, paginas, laadBrowser };
