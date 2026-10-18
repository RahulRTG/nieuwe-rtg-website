/* De API-deuren van de Magnaat Capability Graph, gelezen uit de BRON.

   Een pure functie over een kaart bestand -> brontekst: magnaat-capabilities-
   bronnen.js leest de bestanden en houdt de motorkeuze (JS of de Rust-
   tweeling in motor/src/capabilities.rs), deze module zegt wat een route in
   die tekst is. Beide motoren doen exact dezelfde afleiding; scan() toetst dat
   op pariteit, en scripts/lib/bronscannerachterstand.js houdt de uitkomst
   tegen de levende router (bronscannerGemist, bronscannerSpook). */
'use strict';

const path = require('node:path');

const API_RE = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]+)\2/g;

function toegangVan(bron, einde) {
  const kop = bron.slice(einde, einde + 240).split(/=>|\{/)[0];
  if (/boardroomAuth/.test(kop)) return 'boardroom';
  if (/officeAuth/.test(kop)) return 'office';
  if (/staffAuth/.test(kop)) return 'staff';
  if (/supplierAuth/.test(kop)) return 'supplier';
  if (/auth/.test(kop)) return 'member';
  return 'publiek';
}

/* Een letterlijke string gevolgd door `+` is het BEGIN van een adres, geen
   adres: de spellenlus in server/routes/spellen.js plakt er een spelnaam
   achter en registreert zo veertig routes, en geen enkele die
   `/api/member/spel/` heet. Zonder deze toets
   noemde de scanner vier routes die de router niet kent (bronscannerSpook). */
function wordtAangevuld(bron, na) {
  let p = na;
  while (p < bron.length && ' \t\n\r\v\f'.includes(bron[p])) p++;
  return bron[p] === '+';
}

/* DE MOUNTS. Een router die relatief registreert (router.post met pad
   /gezin/maak) en in server/opzet/poortwachters.js op /api/foundation wordt
   opgehangen (app.use met rtf.router als tweede argument), schrijft
   zijn volle adres nergens op. Het voorvoegsel staat op de mount, en de routes
   staan in de module die daar wordt opgehangen of in een module die DIE
   (transitief) laadt -- zo krijgen de dertig foundation- en schoolmodules hun
   router via ctx. De scanner volgt dus: de mount, het `require` dat de naam in
   dat bestand bindt, en de relatieve requires vanaf daar. Alleen de ontvanger
   `router.` telt, en alleen een pad dat met `/` begint en niet al met `/api/`.
   Wat hier verkeerd zou landen, telt scripts/lib/bronscannerachterstand.js als
   spook: de router blijft de toets op deze afleiding. */
const MOUNT_RE = /\bapp\.use\(\s*(['"])(\/api\/[^'"]*)\1\s*,\s*([A-Za-z_$][\w$]*)(?:\.router)?\s*[,)]/g;
const ROUTER_RE = /\brouter\.(get|post|put|patch|delete)\s*\(\s*(['"`])(\/[^'"`]*)\2/g;
const REQUIRE_RE = /\brequire\(\s*(['"])(\.[^'"]*)\1\s*\)/g;

function losOp(bronnen, van, relatief) {
  const basis = path.resolve(path.dirname(van), relatief);
  for (const kandidaat of [basis, basis + '.js', path.join(basis, 'index.js')]) {
    if (bronnen.has(kandidaat)) return kandidaat;
  }
  return null;
}

function geladen(bronnen, start) {
  const gezien = new Set([start]);
  const rij = [start];
  while (rij.length) {
    const bestand = rij.pop();
    const bron = bronnen.get(bestand);
    REQUIRE_RE.lastIndex = 0;
    let m;
    while ((m = REQUIRE_RE.exec(bron))) {
      const doel = losOp(bronnen, bestand, m[2]);
      if (doel && !gezien.has(doel)) { gezien.add(doel); rij.push(doel); }
    }
  }
  return [...gezien].sort();      // op de padtekst, zoals de Rust-tweeling
}

function gebondenRequire(bron, naam) {
  const re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*(['"])(\.[^'"]*)\2\s*\)/g;
  let m;
  while ((m = re.exec(bron))) if (m[1] === naam) return m[3];
  return null;
}

function gemounteEndpoints(root, bronnen, uniek) {
  for (const bestand of [...bronnen.keys()].sort()) {
    const bron = bronnen.get(bestand);
    MOUNT_RE.lastIndex = 0;
    let m;
    while ((m = MOUNT_RE.exec(bron))) {
      const voorvoegsel = m[2].replace(/\/+$/, '');
      const relatief = gebondenRequire(bron, m[3]);
      const module = relatief && losOp(bronnen, bestand, relatief);
      if (!module) continue;
      for (const kind of geladen(bronnen, module)) {
        const kindBron = bronnen.get(kind);
        ROUTER_RE.lastIndex = 0;
        let r;
        while ((r = ROUTER_RE.exec(kindBron))) {
          if (r[3].startsWith('/api/') || wordtAangevuld(kindBron, ROUTER_RE.lastIndex)) continue;
          const route = (voorvoegsel + r[3]).replace(/\/+$/, '') || voorvoegsel;
          const sleutel = r[1].toUpperCase() + ' ' + route;
          if (uniek.has(sleutel)) continue;
          uniek.set(sleutel, {
            sleutel, methode: r[1].toUpperCase(), route,
            bestand: path.relative(root, kind).split(path.sep).join('/'),
            toegang: toegangVan(kindBron, ROUTER_RE.lastIndex)
          });
        }
      }
    }
  }
}

function scanEndpoints(root, bronnen) {
  const uniek = new Map();
  for (const [bestand, bron] of bronnen) {
    API_RE.lastIndex = 0;
    let m;
    while ((m = API_RE.exec(bron))) {
      if (!m[3].startsWith('/api/') || wordtAangevuld(bron, API_RE.lastIndex)) continue;
      const sleutel = m[1].toUpperCase() + ' ' + m[3];
      uniek.set(sleutel, {
        sleutel, methode: m[1].toUpperCase(), route: m[3],
        bestand: path.relative(root, bestand).split(path.sep).join('/'),
        toegang: toegangVan(bron, API_RE.lastIndex)
      });
    }
  }
  gemounteEndpoints(root, bronnen, uniek);
  return [...uniek.values()].sort((a, b) => a.sleutel.localeCompare(b.sleutel));
}

module.exports = { scanEndpoints };
