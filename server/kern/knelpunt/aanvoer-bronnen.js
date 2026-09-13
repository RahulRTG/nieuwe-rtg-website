/* ============================================================================
   DE BRONNEN VRAGEN -- en wat er gebeurt met wat ze teruggeven.

   Afgesplitst van ./aanvoer.js op de naad die telt: daar staat WAT een vondst
   is (de etiketten, de keuring, de velden die een bron nooit mag meesturen),
   hier HOE de bronnen worden gevraagd en hoe hun antwoorden worden verzameld.
   Dezelfde splitsing als ./openingen.js tegenover ./openingen-kaart.js, en om
   dezelfde reden: ze lopen op een andere klok.

   DE SCHERPSTE REGEL STAAT IN DE HANDTEKENING VAN `vondsten()`: hij neemt een
   randvoorwaarde en verder niets. Geen profiel, geen codenaam, geen leeftijd.
   Daardoor is een geschiktheidstoets hier niet iets om af te leren maar iets
   dat structureel niet KAN (FOUNDATION.md par. 5, HDI.md par. 5.1). Wie er een
   tweede argument bij zet, neemt een besluit -- en test/aanvoer.test.js toets 5
   zakt erop.

   DRIE DINGEN DIE HIJ NOOIT DOET:

   1. SORTEREN. De volgorde is die van de bronnen. Een rangorde is een oordeel,
      en deze laag kent de mens niet eens om er een over te vellen.
   2. AFTREKKEN. Er valt niets weg. Een bron die niets heeft, levert een
      UITSLAG met de reden -- `geenBron` -- en niet stilte. Dat is dezelfde
      regel als in kern/ontvanger.js, en hij komt uit dezelfde fout.
   3. EEN KAPOTTE BRON DE ANDERE LATEN MEENEMEN. Elke bron staat in een try,
      net als de push in opzet/meldaan.js.
   ========================================================================== */
'use strict';

const { keur } = require('./aanvoer');

/* Maakt een aanvoerlaag op de bronnen die dit huis werkelijk heeft.

   `bronnen` is een object { herkomst: fn }, waarbij fn EEN randvoorwaarde
   krijgt en een lijst ruwe vondsten teruggeeft. De herkomst is de sleutel, en
   die wordt door DEZE laag gezet en niet door de bron: een bron die zijn eigen
   herkomst mag opschrijven, kan zich voordoen als een andere. */
function maakAanvoer(bronnen) {
  const lijst = bronnen && typeof bronnen === 'object' ? bronnen : {};

  /* `voorwaarde` is de randvoorwaarde uit ./index.js en draagt GEEN mens.
     Er is met opzet geen tweede argument: wie er een wil meegeven, moet deze
     handtekening veranderen, en dan is het een besluit. */
  function vondsten(voorwaarde) {
    const uit = { vondsten: [], geenBron: [], geweigerd: [], bronnenGevraagd: 0 };
    for (const herkomst of Object.keys(lijst)) {
      const fn = lijst[herkomst];
      if (typeof fn !== 'function') { uit.geweigerd.push({ herkomst, reden: 'bron-is-geen-functie' }); continue; }
      uit.bronnenGevraagd++;
      let ruw;
      /* Een kapotte bron neemt de andere niet mee -- dezelfde regel als in
         kern/ontvanger.js en opzet/meldaan.js. */
      try { ruw = fn(voorwaarde); } catch (e) {
        uit.geweigerd.push({ herkomst, reden: 'bron-brak: ' + ((e && e.message) || e) }); continue;
      }
      if (!Array.isArray(ruw)) { uit.geweigerd.push({ herkomst, reden: 'bron gaf geen lijst' }); continue; }
      /* Niets hebben is een UITSLAG en geen stilte. Zonder deze regel is een
         bron die stuk is niet te onderscheiden van een bron die leeg is. */
      if (!ruw.length) { uit.geenBron.push({ herkomst, reden: 'deze bron heeft hier niets' }); continue; }
      for (const r of ruw) {
        const k = keur(r, herkomst);
        if (k.ok) uit.vondsten.push(k.vondst);
        else uit.geweigerd.push({ herkomst, reden: k.reden });
      }
    }
    /* De volgorde is die van de bronnen en verder niets: er wordt NIET
       gesorteerd. Een rangorde is een oordeel, en deze laag kent de mens niet
       eens om er een over te vellen. */
    return uit;
  }

  return { vondsten };
}

module.exports = { maakAanvoer };
