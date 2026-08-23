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

/* HOEVEEL ER OPENSTAAN, per genummerde paragraaf. Een OPEN regel draagt zijn
   nummer kaal (`| 4.24 |`), een afgeronde doorgestreept (`| ~~4.24~~ |`) -- dus
   dit is `definities()` met precies de vorm die daar bewust wordt genegeerd.

   Waarom dit hier woont en niet alleen in de kop van TAKEN.md: een getal dat
   niemand narekent veroudert stil. Op 23 augustus 2026 stond er "zesentachtig"
   terwijl het er vierennegentig waren, en zes van die vierennegentig waren al af
   maar niet doorgestreept -- ze telden dus mee als werk dat er niet meer was. */
function openPerParagraaf(bron) {
  const uit = new Map();
  let sectie = null;
  for (const r of bron.split('\n')) {
    if (/^## /.test(r)) {
      const kop = /^## (\d+)\./.exec(r);
      sectie = kop ? kop[1] : null;
      if (sectie) uit.set(sectie, 0);
      continue;
    }
    if (sectie && /^\|\s*\d+\.\d+\s*\|/.test(r)) uit.set(sectie, uit.get(sectie) + 1);
  }
  return uit;
}

/* De telling zoals hij BEWEERD wordt bovenaan TAKEN.md:
   `**Open: 78** -- §1 11, §2 9, §3 4, §4 23, §5 31`. Null als hij er niet staat;
   de toets maakt daar een gezakte toets van en niet een stille nul. */
function gemeldeTelling(bron) {
  /* Het scheidingsteken is `--` en niet een breed streepje. Dat is geen
     smaakkwestie: keuringsregel 3 houdt brede streepjes uit de bron, en een
     regex is ook bron. Een tweede vorm toestaan zou hier dode code zijn --
     TAKEN.md schrijft er maar een. */
  const m = /\*\*Open:\s*(\d+)\*\*\s*--\s*((?:§\d+\s+\d+[,\s]*)+)/.exec(bron);
  if (!m) return null;
  const per = new Map();
  for (const p of m[2].matchAll(/§(\d+)\s+(\d+)/g)) per.set(p[1], Number(p[2]));
  return { totaal: Number(m[1]), per };
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

module.exports = { definities, dubbelingen, verwijzingen, losseVerwijzingen, openPerParagraaf, gemeldeTelling };
