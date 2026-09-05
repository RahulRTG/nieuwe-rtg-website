'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* De schermsuite heeft een eigen inventaris. Alleen namen tellen is niet
   genoeg: een bestaand toetsbestand kan worden afgezwakt zonder dat het aantal
   verandert. Daarom bindt deze hash pad, grootte en inhoud van elk bestand. */
function inventaris(root) {
  const map = path.join(root, 'test');
  const regels = fs.readdirSync(map).filter(n => n.endsWith('.e2e.js')).sort().map(naam => {
    const inhoud = fs.readFileSync(path.join(map, naam));
    return { pad: 'test/' + naam, bytes: inhoud.length,
      sha256: crypto.createHash('sha256').update(inhoud).digest('hex') };
  });
  const h = crypto.createHash('sha256');
  for (const r of regels) h.update(r.pad + '\0' + r.bytes + '\0' + r.sha256 + '\n');
  return { bestanden: regels.length, bestandenSha256: h.digest('hex') };
}

/* Node's TAP-reporter sluit af met één canonieke samenvatting. Afwezig is
   onbekend, nooit stilzwijgend nul. */
function tapSamenvatting(tekst) {
  const waarden = {};
  for (const m of String(tekst || '').matchAll(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$/gm))
    waarden[m[1]] = Number(m[2]);
  const volledig = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']
    .every(k => Number.isSafeInteger(waarden[k]));
  return { volledig, tests: waarden.tests, geslaagdeTests: waarden.pass,
    mislukt: waarden.fail, geannuleerd: waarden.cancelled,
    overgeslagen: waarden.skipped, todo: waarden.todo };
}

function zelfdeInventaris(a, b) {
  return !!a && !!b && a.bestanden === b.bestanden &&
    a.bestandenSha256 === b.bestandenSha256;
}

module.exports = { inventaris, tapSamenvatting, zelfdeInventaris };
