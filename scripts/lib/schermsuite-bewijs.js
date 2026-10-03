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
  const bron = String(tekst || '');
  const waarden = {};
  for (const m of bron.matchAll(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$/gm))
    waarden[m[1]] = Number(m[2]);
  /* Een fail-closed ronde weigert skips en todo's. Alleen hun aantal bewaren
     maakte de weigering bij duizenden toetsen onnodig traag te onderzoeken.
     Deze begrensde TAP-regels zijn diagnose, nooit vervangend bewijs. */
  const regelsVoor = merkteken => [...bron.matchAll(new RegExp(
    '^\\s*(?:ok|not ok)\\s+\\d+\\s+-\\s+([^\\r\\n]*?)\\s+#\\s+' + merkteken + '(?:\\s+([^\\r\\n]*))?$', 'gmi'))]
    .map(m => ({ test: String(m[1] || '').trim().slice(0, 300),
      reden: String(m[2] || '').trim().slice(0, 500) || null }));
  const volledig = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']
    .every(k => Number.isSafeInteger(waarden[k]));
  /* Een urenlange browserronde die alleen `mislukt: 2` bewaart, laat de
     operator de hele ronde opnieuw draaien om zelfs maar te weten welke twee.
     Bewaar daarom uitsluitend de begrensde TAP-testnaam en de eerste begrensde
     foutregel. Requestlogs en diagnostische objecten worden niet opgenomen. */
  const misluktTests = [...bron.matchAll(/^\s*not ok\s+\d+\s+-\s+([^\r\n#]*)(?![^\r\n]*#\s+(?:SKIP|TODO))/gmi)]
    .slice(0, 100)
    .map(m => {
      const vanaf = m.index + m[0].length;
      const blok = bron.slice(vanaf, vanaf + 4000);
      const fout = blok.match(/^\s*(?:error|name|message):\s*([^\r\n]{1,1000})$/mi) ||
        blok.match(/^\s*([^#\r\n]*(?:AssertionError|Error):[^\r\n]{0,1000})$/mi);
      return { test: String(m[1] || '').trim().slice(0, 300),
        fout: fout ? String(fout[1] || '').trim().slice(0, 1000) : null };
    });
  return { volledig, tests: waarden.tests, geslaagdeTests: waarden.pass,
    mislukt: waarden.fail, geannuleerd: waarden.cancelled,
    overgeslagen: waarden.skipped, todo: waarden.todo,
    misluktTests, overgeslagenTests: regelsVoor('SKIP'), todoTests: regelsVoor('TODO') };
}

function zelfdeInventaris(a, b) {
  return !!a && !!b && a.bestanden === b.bestanden &&
    a.bestandenSha256 === b.bestandenSha256;
}

module.exports = { inventaris, tapSamenvatting, zelfdeInventaris };
