/* DE CARRIERELAAG: RTG Vertegenwoordiging, het jeugdbestuur en RTG Rugdekking.

   Achttien routes, en de indeling hieronder is GEMETEN en niet beredeneerd. Er
   is per laag een dubbeltik-ronde gedraaid (elke weg twee keer met hetzelfde
   lijf, en tellen wat er in de collectie bij kwam); de uitslagen staan per route
   in ./mutatiecontracten-vertegenwoordiging.js en ./mutatiecontracten-
   rugdekking.js, en daar hoort dit register bij te kloppen.

   DRIE SOORTEN, EN HET VERSCHIL DOET ERTOE:

   `leest`      raakt de opslag niet. Alle vijf gebruiken `kijk()` en niet
                `bak()`, zodat een blik geen lege rij achterlaat
                (kern/eigencollectie.js). Een tweede vraag hoort het antwoord
                van NU te krijgen -- zelfde reden als bij ./idemsleutels-
                kaarten.js -- dus `leest` en geen `zelfdeVerzoek`.

   `zelfdeVerzoek`  een tweede identieke aanroep laat dezelfde stand achter.
                LET OP WAT DAT HIER BETEKENT: bij het merendeel komt dat doordat
                de route de tweede keer WEIGERT (409) op grond van de toestand.
                Dat is een toestandscontrole en geen duplicaatlaag
                (MUTATIECONTRACT.md par. 5o), en dat verschil wordt hier niet
                weggepoetst -- wat vaststaat is dat er geen tweede effect kan
                ontstaan, niet dat een dubbeltik wordt herkend. Waar het WEL
                echte idempotentie is (een toewijzing in plaats van een
                toevoeging) staat dat erbij.

   `nietIdempotent`  de tweede aanroep DOET met opzet iets. Er is er precies
                een, en de reden staat erbij.

   TWEE DINGEN DIE DE RONDE VOND EN DIE HIER NIET MOGEN VERDWIJNEN. `voogd/vraag`
   liet bij een dubbeltik twee spoorregels na voor een verzoek dat er maar een
   is; dat is gerepareerd met een vroege terugkeer zonder schrijven. En
   `rugdekking/stel` liet twee LOPENDE programma's achter (0 -> 1 -> 2): bij een
   agenda is dat rommel, bij geld het dubbele bedrag dat RTG een mens beloofde.
   Allebei gerepareerd VOORDAT deze regels werden geschreven. */
'use strict';

const SLEUTELS = {
  /* ---- lezen: geen van de vijf raakt de opslag ---- */
  'POST /api/vertegenwoordiging/bevoegdheden': { leest: true },
  'POST /api/vertegenwoordiging/mijn': { leest: true },
  'POST /api/vertegenwoordiging/simulatie': { leest: true },
  'POST /api/rugdekking/lijst': { leest: true },
  'POST /api/rugdekking/mijn': { leest: true },

  /* ---- de machtiging zelf ---- */
  'POST /api/vertegenwoordiging/voorstel': { zelfdeVerzoek: true },
  'POST /api/vertegenwoordiging/aanvaard': { zelfdeVerzoek: true },
  'POST /api/vertegenwoordiging/intrek': { zelfdeVerzoek: true },
  /* Een TOEWIJZING en geen toevoeging: de eigen grens van het lid wordt gezet.
     De tweede oproep gaf 200 met dezelfde grens en liet geen tweede spoorregel
     na, want er versmalde niets meer. Dit is dus echte idempotentie en geen
     toestandscontrole -- de route weigert niet, hij antwoordt hetzelfde. */
  'POST /api/vertegenwoordiging/grens': { zelfdeVerzoek: true },

  /* ---- het jeugdbestuur ---- */
  'POST /api/vertegenwoordiging/voogd/vraag': { zelfdeVerzoek: true },
  'POST /api/vertegenwoordiging/voogd/rol': { zelfdeVerzoek: true },
  'POST /api/vertegenwoordiging/voogd/tekent': { zelfdeVerzoek: true },
  'POST /api/office/voogdij/besluit': { zelfdeVerzoek: true },

  /* ---- de rugdekking ---- */
  'POST /api/office/rugdekking/alle': { leest: true },
  'POST /api/office/rugdekking/stel': { zelfdeVerzoek: true },
  'POST /api/office/rugdekking/stop': { zelfdeVerzoek: true },
  /* Ook een toewijzing: de stand wordt GEZET. Twee keer `open` gaf twee keer
     200 met dezelfde stand, en twee keer `gesloten` ook. Wat elke keer WEL
     meebeweegt zijn `standDoor` en `standAt`, en dat is de bedoeling: wie de
     juridische positie van dit huis als laatste heeft bevestigd, is precies wat
     je bij een geschil wilt weten. */
  'POST /api/office/rugdekking/beurs': { zelfdeVerzoek: true },

  /* DE ENIGE DIE MET OPZET EEN TWEEDE KEER IETS DOET. Elke aanroep zet een regel
     in het spoor van de client, en dat IS de bedoeling: twee keer namens iemand
     handelen zijn twee handelingen, en de client hoort ze allebei te zien -- ook
     als ze op elkaar lijken. Ze samenvouwen zou betekenen dat een tweede,
     latere handeling verdwijnt in de eerste, terwijl juist het AANTAL keren dat
     er namens u iets gebeurde is wat een client wil weten. Datzelfde geldt voor
     een GEWEIGERDE poging: die wordt bewust gelogd, want een vertegenwoordiger
     die drie keer iets probeerde wat hij niet mocht, is een gesprek waard. */
  'POST /api/vertegenwoordiging/handel': { nietIdempotent: true,
    waarom: 'elke aanroep is een eigen handeling in het spoor van de client; samenvouwen zou een ' +
      'tweede handeling laten verdwijnen in de eerste, en ook een geweigerde poging hoort zichtbaar te blijven' }
};

module.exports = { SLEUTELS };
