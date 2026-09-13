/* DE ZES ROUTES VAN DE PUBLIEKE LAAG (STAGE.md par. 3 en 7) -- wat is hier
   "hetzelfde verzoek"?

   DRIE LEZEN EN DRIE SCHRIJVEN, en dat onderscheid is hier niet cosmetisch: de
   lezende drie zijn POST omdat dit huis geen GET met een sessie kent, niet omdat
   ze iets veranderen. `leest: true` is dus een BESLUIT en geen gat -- de poort
   doet er niets, en een tweede aanroep hoort het antwoord van NU te krijgen
   (dezelfde redenering als in ./idemsleutels-move.js).

   EN LET OP DE TWEEDE UITLICHTING. Die wordt GEWEIGERD met 409 "Deze post is al
   uitgelicht", en dat is een TOESTANDSCONTROLE en geen idempotentie
   (MUTATIECONTRACT.md). Een herhaling die wordt tegengehouden door de stand van
   het onderwerp is iets anders dan een herhaling die stil hetzelfde antwoord
   teruggeeft, en wie die twee samenvoegt kan later niet meer zien of de route
   veilig te herhalen IS of alleen toevallig niets deed. Vandaar `zelfdeVerzoek`
   op het venster van de dubbeltik en niet `nietIdempotent`: binnen vijf seconden
   is een tweede identieke uitlichting een haperend netwerk, daarbuiten komt hij
   bij de 409 uit -- en beide uitkomsten zijn goed.

   DE VOLGKNOP IS EEN STAND EN GEEN TELLER. `/aanwezig/volg` draagt `aan`, en
   twee keer "aan" zetten is een keer volgen: de lijst is een verzameling en geen
   optelling (kern/mediaos/aanwezigheid.js gebruikt indexOf voor het zetten).
   Daarom telt `id` samen met `aan` als identiteit -- zonder `aan` zou een
   volg-gevolgd-door-ontvolg binnen het venster als herhaling wegvallen, en dan
   blijft iemand volgen die net heeft afgezegd. */
'use strict';
const SLEUTELS = {
  /* Lezen: opzoeken, de eigen volglijst, en het redactiebord. */
  'POST /api/mediaos/aanwezig': { leest: true },
  'POST /api/mediaos/aanwezig/mijn': { leest: true },
  'POST /api/office/salon/uitlicht/bord': { leest: true },

  /* Schrijven. */
  'POST /api/mediaos/aanwezig/volg': { velden: ['id', 'aan'] },
  'POST /api/office/salon/uitlicht': { velden: ['postId', 'grond'] },
  'POST /api/office/salon/uitlicht/intrek': { velden: ['postId'] }
};
module.exports = { SLEUTELS };
