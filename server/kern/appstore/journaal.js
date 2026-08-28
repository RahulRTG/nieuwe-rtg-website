/* ============================================================================
   HET JOURNAAL VAN DE APP STORE -- en wat ervan naar buiten gaat.

   Afgesplitst van ./index.js langs een echte naad: dat bestand BOUWT de motor
   op, dit bestand houdt bij wat er gebeurd is. Wie wil weten hoe een beslissing
   over een derde wordt vastgelegd en wie hem te zien krijgt, hoeft daar maar
   een bestand voor te lezen.

   Twee dingen met een eigen taak, en met opzet geen tweede boekhouding: het
   JOURNAAL is de waarheid -- het groeit aan en wordt nooit herschreven -- en de
   UITZENDING is vluchtig en belooft niets. Geen levering, geen volgorde, geen
   opslag.
   ========================================================================== */
'use strict';

/* Het kanaal waarop de App Store zijn gebeurtenissen zet. De ENVELOP eromheen
   komt van server/bus.js en niet van hier: die zet er een op elk bericht van
   elke publicerende plek, met een keten die vanzelf doorloopt. Twee lagen die
   allebei een envelop maken is een tweede berichtformaat binnen een jaar. */
const KANAAL = 'rtg:appstore:v1';

module.exports = function maakJournaal({ S, nu, norm, bus, log }) {
  /* Het journaal GROEIT AAN en wordt nooit herschreven -- dezelfde regel als het
     actielog van de werelden (PLATFORM.md, de vijfde laag). Elke beslissing over
     een derde is hier terug te vinden, ook een die iemand liever kwijt was. */
  function boek(wat, over, wie, extra) {
    const j = S().journaal;
    j.unshift(Object.assign({ at: nu(), wat, over: over || null, wie: wie || null }, extra || null));
    if (j.length > 5000) j.length = 5000;
    /* En dezelfde regel gaat als GEBEURTENIS naar buiten. Het journaal blijft de
       waarheid -- het groeit aan en wordt nooit herschreven; de uitzending is
       vluchtig en belooft niets (envelop.NIET_GEBOUWD). Twee dingen met een
       eigen taak dus, en geen tweede boekhouding.

       De classificatie is `intern` en niet `persoonsgegeven`: dit journaal noemt
       organisaties en appsleutels, geen mensen. Zou hier ooit een codenaam in
       belanden, dan hoort die classificatie mee te veranderen -- een codenaam
       telt in kern/envelop.js uitdrukkelijk als persoonsgegeven. */
    if (bus && typeof bus.publish === 'function') {
      try {
        bus.publish(KANAAL, {
          /* De OPGAVE aan de bus: alleen wat deze plek weet. Geen id en geen
             tijd -- die verzint een publicist niet zelf. */
          envelop: { actor: wie || undefined, classificatie: 'intern' },
          soort: 'appstore.' + wat, onderwerp: over || null,
          inhoud: extra && typeof extra === 'object' && !Array.isArray(extra) ? extra : {}
        });
      } catch (e) {
        /* Een bus die stukgaat is geen reden om de handeling te laten mislukken,
           maar wel om het te zeggen (LAT-regel 5). Het journaal hierboven is de
           waarheid; de uitzending is vluchtig en belooft niets. */
        try { (log || console.warn)('[appstore] de bus weigerde ' + wat + ': ' + (e && e.message)); } catch (e2) {}
      }
    }
    return j[0];
  }
  const journaal = (n) => S().journaal.slice(0, Math.max(1, Math.min(500, Number(n) || 100)));

  /* Het journaal van EEN uitgever: wat er met zijn eigen inzendingen is gebeurd.
     Tot nu toe zag een uitgever alleen de STAND van een versie -- wachtend,
     live, geweigerd -- en niet wat er onderweg gebeurde. Dat is precies de
     informatie waar hij iets aan heeft, en het is zijn eigen.

     Twee regels. Een regel telt mee als hij OVER zijn app gaat of DOOR zijn
     organisatie is gedaan; wie alleen op `wie` filtert, mist de besluiten die
     een mens van RTG over zijn app nam. En een regel van iemand anders komt er
     nooit uit: de app moet van deze org zijn (APPSTORE.md -- een uitgever ziet
     aantallen en bedragen, nooit een ander). */
  /* Welke apps van een organisatie zijn. Staat hier omdat de motor de apps
     kent; de meter kent ze met opzet niet (die weet alleen sleutels). */
  const uitgeverApps = (org) => Object.values(S().apps).filter(a => a.org === norm(org)).map(a => a.sleutel);

  function journaalVan(org, n) {
    const o = norm(org);
    const eigenApps = new Set(Object.values(S().apps).filter(a => a.org === o).map(a => a.sleutel));
    return S().journaal
      .filter(r => (r.over && eigenApps.has(r.over)) || r.wie === o)
      .slice(0, Math.max(1, Math.min(200, Number(n) || 50)));
  }

  return { boek, journaal, uitgeverApps, journaalVan, KANAAL };
};
module.exports.KANAAL = KANAAL;
