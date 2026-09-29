/* ============================================================================
   HET LEERHUIS -- wie er in een cockpit staat, op CODENAAM (fase B-UI).

   Het spoor kent mensen als `lid:<id>`. Dat is een sleutel en geen naam: een
   trainer die "lid:12" leest, weet niet wie hij voor zich heeft. De echte naam
   hoort hier evenmin, want die staat in de kluis (CLAUDE.md: privacy by
   design). Wat een mens in dit huis draagt, is zijn codenaam, en die zet deze
   module ernaast.

   HIJ VOEGT ALLEEN TOE. De sleutel blijft staan (een handeling noemt hem), er
   verdwijnt niets uit het antwoord, en wie geen codenaam heeft krijgt `null`
   en geen verzonnen naam. Het veld `naam` is daarom van DEZE module: een rij
   die zelf al een `naam` draagt (de naam van een vaardigheid), zou hier stil
   worden overschreven -- zo stond op de kaart van een assessor "Rode Vos van
   Rode Vos". Zo'n naam heet `vaardigheidNaam`, en grenstoets 22 houdt dat vast.
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
   VANDAAG en TEAM; het werk van de assessor (werk.js) in OPEN en LOPEND, en het
   beheer van de eigenaar in BESTUUR en RELATIES, en het werk van de autoriteiten in KLAAR,
   CERTIFICATEN, TRAINERS, ZONDER_TRAINER, KANDIDATEN, BEZWAREN en ONGELDIG. */
function metNamen(antwoord, naamVan) {
  if (!antwoord || typeof antwoord !== 'object') return antwoord;
  const zet = (lijst) => Array.isArray(lijst) ? lijst.map(x => Object.assign({}, x, { naam: naamVan(x.persoon) })) : lijst;
  const uit = Object.assign({}, antwoord);
  for (const veld of ['LEERLINGEN', 'VANDAAG', 'TEAM', 'OPEN', 'LOPEND', 'BESTUUR', 'RELATIES', 'KLAAR', 'CERTIFICATEN', 'TRAINERS', 'ZONDER_TRAINER', 'KANDIDATEN', 'BEZWAREN', 'ONGELDIG']) if (veld in uit) uit[veld] = zet(uit[veld]);
  return uit;
}

module.exports = { maakNaamVan, metNamen };
