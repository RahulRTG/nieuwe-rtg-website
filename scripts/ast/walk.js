/* AST-walker (deel van de zelfgebouwde AST-scanner). Loopt generiek over de boom
   -- elk object met een string-`type` is een knoop -- en roept de bezoeker aan
   met het pad (voorouders, wortel eerst). Geen per-knooptype-tabel nodig, dus
   nieuwe knooptypes lopen vanzelf mee. Puur eigen werk, geen dependency. */
'use strict';

function isKnoop(x) { return x != null && typeof x === 'object' && typeof x.type === 'string'; }

// bezoek(knoop, pad) voor elke knoop; pad = array voorouders (wortel eerst, zonder de knoop zelf)
function loop(node, bezoek, pad) {
  pad = pad || [];
  if (Array.isArray(node)) { for (const x of node) loop(x, bezoek, pad); return; }
  if (!isKnoop(node)) return;
  bezoek(node, pad);
  const dieper = pad.concat(node);
  for (const sleutel in node) {
    if (sleutel === 'start' || sleutel === 'end' || sleutel === 'lijn') continue;
    const v = node[sleutel];
    if (v && typeof v === 'object') loop(v, bezoek, dieper);
  }
}

module.exports = { loop, isKnoop };
