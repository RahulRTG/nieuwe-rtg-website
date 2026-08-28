/* WAARTEGEN ZETTEN WE DEZE WIJZIGING AF.

   Twee poorten stellen dezelfde vraag. scripts/deltapoort.js vergelijkt de
   BESTANDEN met hun vorige versie; scripts/normverval.js vergelijkt NORM.json
   met zijn vorige versie om te zien of er een lat met de hand is verlaagd.
   Zouden ze elk hun eigen antwoord zoeken, dan kan de een tegen het aftakpunt
   keuren en de ander tegen de vorige commit -- en dan is een verlaging die de
   ene poort tegenhoudt voor de andere onzichtbaar (LAT.md regel 4).

   HET AFTAKPUNT EN NIET DE VORIGE COMMIT. Een tak van tien commits hoort in zijn
   geheel beoordeeld te worden. Wie tegen HEAD~1 keurt, laat alles door zolang je
   het maar over twee commits verdeelt. */
'use strict';
const path = require('path');
const cp = require('child_process');

function maakGit(wortel) {
  const git = (args) => cp.execFileSync('git', args, { cwd: wortel, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trimEnd();
  git.stil = (args) => { try { return git(args); } catch (e) { return null; } };
  return git;
}

/* Geeft { ref, hoe } of { fout }. Nooit een stil null: een poort die zijn
   vergelijkingspunt niet vindt, hoort dat te ZEGGEN en te zakken. */
function bepaalBasis(wortel, gevraagd) {
  const git = maakGit(wortel);
  if (gevraagd) {
    if (git.stil(['rev-parse', '--verify', gevraagd + '^{commit}']) === null)
      return { fout: 'de meegegeven basis "' + gevraagd + '" bestaat niet in deze kloon' };
    return { ref: gevraagd, hoe: 'meegegeven' };
  }
  for (const kandidaat of ['origin/main', 'origin/master', 'main', 'master']) {
    if (git.stil(['rev-parse', '--verify', kandidaat + '^{commit}']) === null) continue;
    const punt = git.stil(['merge-base', 'HEAD', kandidaat]);
    if (punt) return { ref: punt, hoe: 'aftakpunt van ' + kandidaat };
  }
  return { fout: 'geen hoofdlijn gevonden om tegen af te zetten (origin/main, origin/master, main, master). ' +
    'In CI komt dat bijna altijd door een ondiepe kloon: zet fetch-depth: 0 bij de checkout.' };
}

/* De inhoud van een bestand zoals het bij de basis was, of null als het toen
   nog niet bestond. Dat onderscheid draagt in beide poorten een beslissing, dus
   het mag geen lege string worden. */
function versieBij(wortel, ref, pad) {
  if (!pad) return null;
  try { return cp.execFileSync('git', ['show', ref + ':' + pad], { cwd: wortel, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch (e) { return null; }
}

module.exports = { bepaalBasis, versieBij, maakGit };
