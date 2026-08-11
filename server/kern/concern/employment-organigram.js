/* CONCERN (deelmodule): HET ORGANIGRAM.

   Afgesplitst van ./employment.js toen die over de 10 kB ging, en de naad is
   echt: daar staat de WERKRELATIE (aannemen, wijzigen, beëindigen, opzoeken),
   hier staat de BOOM die eruit volgt. Het een is opslag, het ander is een
   afleiding, en de afleiding hoort geen plek in de opslag te krijgen.

   NIEMAND TEKENT EEN ORGANIGRAM. Het volgt uit dienstverband plus
   leidinggevende; wijzigt iemands leidinggevende, dan wijzigt de boom vanzelf
   mee. Een getekend organigram is een tweede waarheid die na de eerste
   reorganisatie niet meer klopt (LAT-regel 4).

   EEN RING WORDT BENOEMD EN NIET GEVOLGD. A rapporteert aan B en B aan A komt
   in het echt voor -- meestal door een invoerfout. Oneindig doorlopen zou de
   hele opbouw laten hangen; stil overslaan zou iemand uit het organigram laten
   verdwijnen zonder dat iemand weet waarom. */
'use strict';

module.exports = (ctx) => {
  const { vanEntiteit } = ctx;

  /* HET ORGANIGRAM WORDT NIET GETEKEND MAAR GEVOLGD. Uit leidinggevende +
     dienstverband volgt de boom; wijzigt iemands leidinggevende, dan wijzigt de
     boom vanzelf mee. Een ring (A rapporteert aan B, B aan A) wordt benoemd en
     niet gevolgd -- oneindig doorlopen zou de hele opbouw laten hangen. */
  function organigram(entiteitId) {
    const leden = vanEntiteit(entiteitId, false).filter(e => e.telt);
    const perId = new Map(leden.map(e => [e.id, e]));
    const kinderen = new Map();
    const ringen = [];
    for (const e of leden) {
      const baas = e.leidinggevende && perId.has(e.leidinggevende) ? e.leidinggevende : null;
      if (baas) {
        // ring opsporen: loop omhoog en kijk of we onszelf tegenkomen
        let p = perId.get(baas), stappen = 0, ring = false;
        while (p && stappen++ < 50) {
          if (p.id === e.id) { ring = true; break; }
          p = p.leidinggevende ? perId.get(p.leidinggevende) : null;
        }
        if (ring) { ringen.push({ wie: e.persoon, via: baas }); continue; }
      }
      const sleutel = baas || '';
      if (!kinderen.has(sleutel)) kinderen.set(sleutel, []);
      kinderen.get(sleutel).push(e);
    }
    const bouw = (id, diep) => (kinderen.get(id) || []).map(e => ({
      id: e.id, persoon: e.persoon, rol: e.rol, afdeling: e.afdeling, vestiging: e.vestigingNaam,
      onder: diep > 20 ? [] : bouw(e.id, diep + 1)
    }));
    return { top: bouw('', 0), aantal: leden.length, ringen,
      uitleg: 'Dit organigram volgt uit de dienstverbanden en hun leidinggevende; het wordt niet apart getekend.' };
  }


  return { employmentOrganigram: organigram };
};
