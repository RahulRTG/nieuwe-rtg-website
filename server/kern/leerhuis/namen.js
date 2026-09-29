/* ============================================================================
   HET LEERHUIS -- wie er in een cockpit staat, op CODENAAM (fase B-UI).

   Het spoor kent mensen als `lid:<id>`. Dat is een sleutel en geen naam: een
   trainer die "lid:12" leest, weet niet wie hij voor zich heeft. De echte naam
   hoort hier evenmin, want die staat in de kluis (CLAUDE.md: privacy by
   design). Wat een mens in dit huis draagt, is zijn codenaam, en die zet deze
   module ernaast.

   HIJ VOEGT ALLEEN TOE. De sleutel blijft staan (een handeling noemt hem), er
   verdwijnt niets uit het antwoord, en wie geen codenaam heeft krijgt `null`
   en geen verzonnen naam.
   ========================================================================== */
'use strict';

function maakNaamVan(codenaamVan) {
  return (persoon) => {
    const m = /^lid:(\d+)$/.exec(String(persoon || ''));
    if (!m || typeof codenaamVan !== 'function') return null;
    try { return codenaamVan('user-' + m[1]) || null; } catch (e) { return null; }
  };
}

/* De trainer- en managercockpit (zicht.js) dragen hun mensen in LEERLINGEN,
   VANDAAG en TEAM; het werk van de assessor (werk.js) in OPEN en LOPEND. */
function metNamen(antwoord, naamVan) {
  if (!antwoord || typeof antwoord !== 'object') return antwoord;
  const zet = (lijst) => Array.isArray(lijst) ? lijst.map(x => Object.assign({}, x, { naam: naamVan(x.persoon) })) : lijst;
  const uit = Object.assign({}, antwoord);
  for (const veld of ['LEERLINGEN', 'VANDAAG', 'TEAM', 'OPEN', 'LOPEND']) if (veld in uit) uit[veld] = zet(uit[veld]);
  return uit;
}

module.exports = { maakNaamVan, metNamen };
