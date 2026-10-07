/* ============================================================================
   ROTEREN MET DE HAND -- de telling achter keuringsregel 75.

   UITVOERINGSPLAN par. 7.1: bearercode v2 heeft `roteer()` (nieuwe code, oude
   dicht, einde nooit later, geschiedenis begrensd). Een domein dat zijn rotatie
   nog zelf ophoogt (`rotatie + 1`), doet dat buiten die regels om. scripts/check.js
   regel 75 telt die plekken en houdt het aantal vast.

   WAAROM DE TELLING HIER STAAT. Het aantal was een ratel als constante
   (ROTATIE_MAX) in check.js, dus buiten NORM.json en buiten het slot van
   scripts/normbasis.js. Sinds 6 oktober 2026 is het de meter `rotatieMetDeHand`;
   check.js en scripts/norm.js tellen allebei met deze functie, zodat er een
   telling is en niet twee die uit elkaar lopen (LAT.md regel 4).

   De vorm wordt gelezen ZONDER spaties: `(u.toegang.rotatie||1)+1` ontsnapte
   aan de eerste vorm van deze regel, die alleen de gespatieerde schrijfwijze
   kende. De twee alternatieven beginnen met een ander teken, anders kan een
   reeks `)||0)` op twee manieren gelezen worden en loopt de regex exponentieel
   vast (CodeQL).
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const VORM = /rotatie(?:\|\|[01]\)|\))*\+1(?!\d)/;
const isHandrotatie = (regel) => VORM.test(String(regel).replace(/\s+/g, ''));

/* Alle plekken onder server/, als `bestand:regel`. bearercode*.js zelf telt
   niet mee: daar WOONT roteer(), en dat is de toegestane plek. */
function plekken(root) {
  const uit = [];
  const loop = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const q = path.join(d, e.name);
      if (e.isDirectory()) { if (!['data', 'node_modules'].includes(e.name)) loop(q); continue; }
      if (!e.name.endsWith('.js') || /^bearercode/.test(e.name)) continue;
      fs.readFileSync(q, 'utf8').split('\n').forEach((r, i) => {
        if (isHandrotatie(r)) uit.push(path.relative(root, q) + ':' + (i + 1));
      });
    }
  };
  loop(path.join(root, 'server'));
  return uit;
}

module.exports = { plekken, isHandrotatie };
