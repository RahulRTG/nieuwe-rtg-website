/* Idempotentiebesluiten voor de nieuwe foto-, video- en muziekbestanden.

   De twee lijsten zijn echte lezers. De overige routes mogen niet door de
   generieke antwoordcache worden overgenomen: uploads dragen rauwe bytes die
   niet in de JSON-vingerafdruk zitten, een luisterticket is een kort geheim,
   verwijderen moet na de eerste keer de actuele 404 teruggeven en een
   aan/uit-stand kan binnen het venster wisselen. De upload van muziek heeft
   bovendien zijn eigen, langere Idempotency-Key in de domeinkern. */
'use strict';
const SLEUTELS = {
  'POST /api/muziek/bestanden': { leest: true },
  'POST /api/muziek/feed': { leest: true },
  'POST /api/muziek/bestand': { nietIdempotent: true,
    waarom: 'de route dedupliceert zelf op de expliciete Idempotency-Key en de rauwe audiobytes zitten niet veilig in de generieke JSON-vingerafdruk' },
  'POST /api/muziek/bestand-ticket': { nietIdempotent: true,
    waarom: 'ieder antwoord bevat een nieuw kort luistergeheim; een generieke antwoordcache mag dat ticket niet bewaren of heronthullen' },
  'POST /api/muziek/bestand-weg': { nietIdempotent: true,
    waarom: 'de eerste aanroep verwijdert en een herhaling hoort de actuele ontbrekende stand te beoordelen in plaats van een oud succes af te spelen' },
  'POST /api/muziek/mooi': { nietIdempotent: true,
    waarom: 'de handler zet zelf de gewenste aan-uitstand; cachen maakt aan-uit-aan binnen vijf seconden onwaar doordat de derde handeling wordt overgeslagen' },
  'POST /api/salon/media': { nietIdempotent: true,
    waarom: 'een upload draagt rauwe foto- of videobytes buiten de JSON-vingerafdruk en iedere bewuste opname moet als eigen mediabestand door de domeinkern worden beoordeeld' }
};
module.exports = { SLEUTELS };
