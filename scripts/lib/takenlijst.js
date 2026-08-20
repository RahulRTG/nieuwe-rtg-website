/* DE TAKENLIJST LEZEN: de nummers en de verwijzingen ernaartoe.

   Dit stond eerst in test/takenlijst.test.js zelf. Dat was verkeerd om, en de
   mutatiemotor wees het aan: een toets zonder module om te muteren is een toets
   die de motor niet KAN meten ("geen module gevonden"), en dan telt hij mee in
   `toetsenNietGemeten` -- terecht, want niemand heeft hem ooit zien zakken op
   iets anders dan een handmatige proef.

   Dus woont de zeef hier, en toetst test/takenlijst.test.js hem. Nu kan de motor
   een `===` omdraaien en zien dat er iets zakt.

   TWEE VORMEN, EN DE TWEEDE IS DE VALKUIL. Een regel in TAKEN.md staat er als
   `| 4.24 | ...` zolang hij open is en als `| ~~4.24~~ | ~~...~~` zodra hij af
   is. Een zeef die alleen de eerste vorm ziet, houdt afgeronde nummers voor vrij
   -- en precies dat is hier misgegaan: het opruimen van de dubbelingen deelde
   zes nummers uit die al bezet waren door afgeronde regels. Een afgeronde regel
   is af, niet weg; hij houdt zijn nummer. */
'use strict';
const fs = require('fs');
const path = require('path');

/* Een DEFINITIE staat in een genummerde paragraaf (`## 4. Bekende defecten`).
   De prioriteitstabel bovenaan staat onder een paragraaf zonder nummer en HAALT
   regels aan in dezelfde vorm; die tellen dus niet als definitie. */
function definities(bron) {
  const uit = new Map();
  let inSectie = false;
  bron.split('\n').forEach((r, i) => {
    const kop = /^## (\d+)\./.exec(r);
    if (/^## /.test(r)) inSectie = !!kop;
    const rij = /^\|\s*~{0,2}(\d+\.\d+)~{0,2}\s*\|/.exec(r);
    if (rij && inSectie) {
      if (!uit.has(rij[1])) uit.set(rij[1], []);
      uit.get(rij[1]).push(i + 1);
    }
  });
  return uit;
}

function dubbelingen(bron) {
  return [...definities(bron)].filter(([, regels]) => regels.length > 1)
    .map(([nummer, regels]) => nummer + ' (regels ' + regels.join(', ') + ')');
}

/* Elke `TAKEN.md 4.21` in de code en de documenten. De vorm is bewust ruim (de
   ene plek schrijft `TAKEN.md 5.22`, de andere `` `TAKEN.md` 5.22 ``) maar niet
   ruimer dan dat: drie tekens speling, zodat een zin die toevallig een getal
   achter het woord zet niet als verwijzing telt. */
function verwijzingen(wortel, mappen = ['server', 'scripts', 'test', 'public']) {
  const uit = [];
  const kijk = (vol, toon) => {
    let bron; try { bron = fs.readFileSync(vol, 'utf8'); } catch (e) { return; }
    for (const m of bron.matchAll(/TAKEN\.md[^0-9a-zA-Z]{0,3}(\d+\.\d+)/g)) uit.push({ bestand: toon, nummer: m[1] });
  };
  const loop = (dir) => {
    let namen; try { namen = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of namen) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!/^(node_modules|\.git|data|dist)$/.test(e.name)) loop(p); continue; }
      if (/\.(js|md)$/.test(e.name)) kijk(p, path.relative(wortel, p).replace(/\\/g, '/'));
    }
  };
  for (const map of mappen) loop(path.join(wortel, map));
  for (const b of fs.readdirSync(wortel)) {
    if (b.endsWith('.md') && b !== 'TAKEN.md') kijk(path.join(wortel, b), b);
  }
  return uit;
}

function losseVerwijzingen(bron, wortel, vergeven = {}) {
  const bekend = definities(bron);
  return verwijzingen(wortel)
    .filter(v => !bekend.has(v.nummer) && !vergeven[v.nummer])
    .map(v => v.bestand + ' -> ' + v.nummer);
}

module.exports = { definities, dubbelingen, verwijzingen, losseVerwijzingen };
