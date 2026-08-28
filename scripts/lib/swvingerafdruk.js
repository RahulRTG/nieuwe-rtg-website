'use strict';
/* ============================================================================
   DE VINGERAFDRUK VAN EEN SERVICE-WORKERSCHIL -- OP EEN PLEK.

   Hij stond op twee plekken en die waren het op DRIE punten oneens:
   scripts/build.js raapte elk aanhalingsteken-pad uit het hele bestand op,
   hashte de sw-code zelf mee en niet de padnamen; scripts/swcache.js las
   alleen de `const SHELL = [...]`-lijst, hashte wel de padnamen en de sw-code
   niet. Uitkomst: build.js schreef rtg-app-5679a6fe, swcache.js eiste
   rtg-app-66cc3bc3, en welke van de twee je ook vastlegde -- de andere poort
   zakte. Dat kostte op 28 augustus 2026 drie CI-rondes voordat iemand doorhad
   dat de twee getallen niet over hetzelfde gingen.

   Wat de gedeelde afspraak nu is, en waarom:
   - de schil komt uit de `const SHELL`-lijst en niet uit "elk pad in het
     bestand". Een pad in een opmerking is geen schilbestand;
   - het PAD telt mee naast de inhoud, zodat het hernoemen van een bestand ook
     een nieuwe naam geeft;
   - de sw-CODE telt mee, minus zijn eigen CACHE-regel. Verandert de logica van
     de worker, dan hoort de cache te vervallen -- dat is precies de belofte in
     de kop van public/sw.js. De CACHE-regel er eerst uit halen is geen
     schoonheid maar noodzaak: anders bepaalt de uitkomst zijn eigen invoer.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* De schil zoals de worker hem zelf declareert. null = geen SHELL-lijst. */
function schilVan(tekst) {
  const m = /const SHELL = \[([^\]]*)\]/.exec(tekst);
  if (!m) return null;
  return (m[1].match(/'\/[^']*'/g) || []).map((s) => s.slice(1, -1));
}

/* Onleesbare schilbestanden slaan we over in plaats van te gooien: een schil
   mag naar iets wijzen dat de bouw nog moet maken, en dan is een hash over de
   rest nog altijd beter dan een bouw die staakt. */
function vingerafdruk(swTekst, schil, publicMap) {
  const h = crypto.createHash('sha256');
  for (const p of schil) {
    h.update(p);
    try { h.update(fs.readFileSync(path.join(publicMap, p))); } catch (e) { /* nog niet gebouwd */ }
  }
  h.update(swTekst.replace(/const CACHE = '[^']*';/, ''));
  return h.digest('hex').slice(0, 8);
}

/* De volledige naam: het voorvoegsel van de bestaande CACHE plus de afdruk.
   Geeft null als er geen CACHE- of SHELL-regel in staat. */
function cachenaamVoor(swTekst, publicMap) {
  const m = swTekst.match(/const CACHE = '([^']*)';/);
  const schil = schilVan(swTekst);
  if (!m || !schil) return null;
  const delen = m[1].split('-'); delen.pop();
  return { huidig: m[1], nieuw: (delen.join('-') || 'cache') + '-' + vingerafdruk(swTekst, schil, publicMap) };
}

module.exports = { schilVan, vingerafdruk, cachenaamVoor };
