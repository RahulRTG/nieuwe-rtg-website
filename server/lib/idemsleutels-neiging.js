/* ============================================================================
   WAT IS "HETZELFDE VERZOEK" -- de persoonlijke laag (NEIGING.md).

   Zelfde register als ./idemsleutels.js, eigen bestand; zie de kop daar voor de
   vier vormen en waarom idempotentie verklaard moet worden in plaats van
   geraden. Zeven routes, en ze vallen in twee groepen die om VERSCHILLENDE
   redenen ongevaarlijk zijn bij een herhaling.

   VIJF ZIJN AL IDEMPOTENT IN DE HANDLER ZELF, en dat is geen toeval maar het
   ontwerp van deze laag. Een neiging is een VERZAMELING en geen teller: een
   onderwerp staat er of het staat er niet. `antwoord` met dezelfde keuzes zet
   dus niets tweede keer bij -- kern/neiging/bewaren.js telt een herhaling van
   grond `gezegd` met opzet niet mee, want *twee keer hetzelfde ZEGGEN is een
   uitspraak, terwijl twee keer hetzelfde DOEN twee keren zijn.* Datzelfde geldt
   voor `vergeet` (weg is weg), `niet-voor` (geweigerd is geweigerd),
   `overslaan` (alle vragen gezet) en `opnieuw` (de vragenstand leeg).

   Ze staan hier toch als `zelfdeVerzoek`, en niet als "regelt zichzelf wel":
   de verklaring gaat over wat een HERHALING BETEKENT, niet over wie hem
   tegenhoudt. Wie de handler ooit verbouwt tot iets dat wel optelt, hoort deze
   regel tegen te komen.

   EN TWEE ZIJN MET OPZET *GEEN* `zelfdeVerzoek`, en dat is de val die de kop
   van ./idemsleutels-bescherming.js beschrijft: de poort speelt bij een treffer
   het EERDERE ANTWOORD terug zonder de handler aan te roepen. Bij `intake` is
   dat fout, en meetbaar fout. Het lichaam van elke intake-aanroep is `{}`, dus
   deze drie verzoeken zijn voor de poort woordelijk gelijk:

       intake  -> vraag 1
       antwoord {vraag 1, ...}
       intake  -> zou VRAAG 1 terugspelen, terwijl vraag 2 aan de beurt is

   Binnen vijf seconden is dat een gewone klikvolgorde en geen randgeval. Een
   replay zou het lid dezelfde vraag nog een keer voorleggen -- precies het
   gedrag dat NEIGING.md par. 7 als bevinding beschrijft en dat daar juist uit
   is gehaald. `leest: true` zet de poort daarom uit.

   WAT `leest: true` HIER WEL EN NIET BELOOFT. Het lid-gegeven wordt niet
   aangeraakt: intake en geheugen LEGGEN NIETS VAST. Wat ze wel kunnen doen is
   de bewaartermijn afdwingen -- `veeg()` in kern/neiging/beheer.js gooit weg wat
   vervallen is, en die staat daar met zoveel woorden op de LEESweg en niet in
   een achtergrondtaak, *zodat er nooit een dag is waarop de termijn wel is
   verstreken en het gegeven er nog staat omdat een timer niet draaide.* Dat is
   een opruiming op de klok en geen handeling van het lid: hij is idempotent (de
   tweede aanroep vindt niets meer) en hij schrijft alleen als er werkelijk iets
   vervallen is (`if (houd.length === lijst.length) return 0`). Die nuance staat
   hier hardop, want "verandert niets" is anders te sterk en dan is de
   verklaring zelf niet waar.
   ========================================================================== */
'use strict';

const SLEUTELS = {
  /* ---- de twee leeswegen: de poort blijft eraf, zie de kop ---- */
  'POST /api/neiging/intake': { leest: true },
  'POST /api/neiging/geheugen': { leest: true },

  /* ---- en de vijf die iets vastleggen ---- */
  /* Dezelfde keuzes op dezelfde vraag zijn een dubbeltik. De handler telt een
     herhaalde `gezegd` al niet mee, dus poort en handler zeggen hetzelfde. */
  'POST /api/neiging/antwoord': { zelfdeVerzoek: true },
  /* Weg is weg. Een tweede keer vergeten is geen tweede handeling. */
  'POST /api/neiging/vergeet': { zelfdeVerzoek: true },
  /* Geweigerd is geweigerd: een doel dat er al af is, gaat er niet nog eens af. */
  'POST /api/neiging/niet-voor': { zelfdeVerzoek: true },
  /* Overslaan zet alle vragen op gesteld; de tweede keer staat dat er al. */
  'POST /api/neiging/overslaan': { zelfdeVerzoek: true },
  /* Opnieuw leegt de vragenstand en raakt geen enkele neiging aan -- twee keer
     leegmaken geeft dezelfde lege stand. */
  'POST /api/neiging/opnieuw': { zelfdeVerzoek: true }
};

module.exports = { SLEUTELS };
