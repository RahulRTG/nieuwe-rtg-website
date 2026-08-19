/* LIGT rtg-hulpklassen.css OP DEZE PAGINA?

   Twee plekken stellen die vraag en ze moeten hetzelfde antwoord geven:
   scripts/check.js regel 37 (een pagina die een hulpklasse GEBRUIKT moet het
   stijlblad laden, anders verdwijnt de opmaak) en scripts/hulpklassen-omzet.js
   (die mag een style-attribuut alleen inruilen waar de klasse ook echt ligt).
   Twee kopieen zouden uiteenlopen en dan ruilt de een iets in wat de ander
   afkeurt (LAT.md regel 4).

   WAAROM EEN `includes()` OP DE PAGINA NIET GENOEG IS. Het stijlblad lag op EEN
   van de 259 pagina's. Sinds het via `@import` in rtg-ui.css hangt, ligt het op
   231 -- maar op geen van die 231 staat de naam in de HTML. Een keuring die
   alleen naar de <link>-tags kijkt, ziet dus 146 pagina's als kaal terwijl de
   browser de klassen gewoon laadt. Dat is dezelfde soort fout als een meter die
   een proxy telt in plaats van het ding zelf.

   TWEE NIVEAUS DIEP, EN NIET DIEPER. rtg-ui.css importeert vier zusterbladen;
   dieper genest is er niets. Een keten die ooit dieper wordt telt hier als NIET
   gedekt -- dat is de veilige kant: de omzetter laat het bestand dan met rust
   en de keuring klaagt, in plaats van dat iets stilzwijgend doorglipt. */
'use strict';
const fs = require('fs');
const path = require('path');

const HULPCSS = 'rtg-hulpklassen.css';

function cssDraagt(pad, publiek, diepte) {
  if (diepte > 2 || !fs.existsSync(pad)) return false;
  let bron; try { bron = fs.readFileSync(pad, 'utf8'); } catch (e) { return false; }
  if (bron.includes(HULPCSS)) return true;
  for (const m of bron.matchAll(/@import\s+url\(['"]?([^'")]+)['"]?\)/g)) {
    const doel = m[1].startsWith('/') ? path.join(publiek, m[1].slice(1))
      : path.join(path.dirname(pad), m[1]);
    if (cssDraagt(doel, publiek, diepte + 1)) return true;
  }
  return false;
}

function paginaDraagt(bron, paginaPad, publiek) {
  if (bron.includes(HULPCSS)) return true;
  const map = path.posix.dirname(path.relative(publiek, paginaPad).replace(/\\/g, '/'));
  for (const m of bron.matchAll(/<link[^>]*href="([^"]+\.css)[^"]*"/g)) {
    const href = m[1].split('?')[0];
    const doel = href.startsWith('/') ? path.join(publiek, href.slice(1))
      : path.join(publiek, path.posix.normalize(path.posix.join(map, href)));
    if (cssDraagt(doel, publiek, 0)) return true;
  }
  return false;
}

module.exports = { HULPCSS, cssDraagt, paginaDraagt };
