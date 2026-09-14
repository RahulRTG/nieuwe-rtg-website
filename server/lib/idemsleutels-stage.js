/* DE ZES ROUTES VAN DE PUBLIEKE LAAG (STAGE.md par. 3 en 7) -- wat is hier
   "hetzelfde verzoek"?

   DRIE LEZEN EN DRIE SCHRIJVEN, en dat onderscheid is hier niet cosmetisch: de
   lezende drie zijn POST omdat dit huis geen GET met een sessie kent, niet omdat
   ze iets veranderen. `leest: true` is dus een BESLUIT en geen gat -- de poort
   doet er niets, en een tweede aanroep hoort het antwoord van NU te krijgen
   (dezelfde redenering als in ./idemsleutels-move.js).

   EN LET OP DE TWEEDE UITLICHTING, want die heeft TWEE DEUREN en dat is geen
   slordigheid maar het venster.

   In de MODULE wordt zij GEWEIGERD met 409 "Deze post is al uitgelicht", en dat
   is een TOESTANDSCONTROLE en geen idempotentie (MUTATIECONTRACT.md). Een
   herhaling die wordt tegengehouden door de stand van het onderwerp is iets
   anders dan een herhaling die stil hetzelfde antwoord teruggeeft, en wie die
   twee samenvoegt kan later niet meer zien of de route veilig te herhalen IS of
   alleen toevallig niets deed.

   Op de ROUTE staat de dubbeltikpoort ervoor. Daarom `velden` -- hetzelfde
   venster van vijf seconden als `zelfdeVerzoek`, alleen met een smallere
   identiteit -- en niet `nietIdempotent`: binnen dat venster is een woordelijk
   gelijk verzoek een haperend netwerk en krijgt het het antwoord van de eerste
   terug (200, `herhaald: true`, dezelfde uitlichting-id). Buiten het venster,
   en bij elk verzoek dat NIET woordelijk gelijk is, draait de handler wel en
   komt hij op de 409 uit.

   DE IDENTITEIT IS `postId` + `grond`, EN DAT IS EEN BESLUIT. Dezelfde post met
   een andere grond is geen dubbeltik maar een tweede redactiebesluit; die hoort
   dus langs de poort en tegen de toestandscontrole aan te lopen. Alleen de grond
   meetellen en de toelichting niet, is dezelfde regel als BUITEN_AFDRUK in
   ./idem-poort.js: vrije tekst maakt er geen ander verzoek van.

   BEIDE DEUREN BEWAREN DEZELFDE INVARIANT: er ontstaat nooit een tweede
   uitlichting. test/aanwezigheid-routes.e2e.js legt ze allebei vast en telt
   daarna de lopende uitlichtingen -- want twee statuscodes zeggen op zichzelf
   niets over wat er in het register staat. Die toets zakte eerst, en terecht:
   hij eiste onvoorwaardelijk 409 en beschreef daarmee de wereld van voordat dit
   bestand bestond.

   DE VOLGKNOP IS EEN STAND EN GEEN TELLER, EN DAAROM MAG DE POORT HEM NIET
   DEDUPLICEREN. Dit is op 13 september herschreven nadat de eigen e2e-toets er
   een echt defect mee vond, en de eerste versie van deze alinea was de oorzaak.

   Die versie declareerde `velden: ['id', 'aan']` en redeneerde: twee keer "aan"
   zetten is een keer volgen, en door `aan` mee te tellen valt een
   volg-gevolgd-door-ontvolg niet als herhaling weg. Het eerste klopt. Het tweede
   niet, en het verschil is GEMETEN:

       volg(aan:true)  -> 200, volgIk: true
       volg(aan:false) -> 200, volgIk: false
       volg(aan:true)  -> 200, volgIk: true, herhaald: true
       ... en /aanwezig/mijn staat op NUL.

   Het derde verzoek is woordelijk gelijk aan het eerste, dus de dubbeltikpoort
   gaf het antwoord van toen terug en de handler kwam er niet aan te pas. Een lid
   dat binnen vijf seconden volgt, ontvolgt en opnieuw volgt, VOLGT NIET -- en de
   API zegt van wel. Dat is geen randgeval maar een gewone vinger op een knop, en
   een stille onwaarheid tegen het lid.

   De rem hoort er dus af. `volg()` is namelijk ZELF al idempotent: hij zet een
   stand met indexOf en telt niets op, dus tweemaal uitvoeren geeft precies
   dezelfde uitkomst als eenmaal. De poort voegt hier niets toe en kost
   correctheid.

   EN DE NAAM VAN DE VORM DEKT DE LADING NIET, dus dat staat er hardop bij.
   `nietIdempotent` betekent in lib/idemsleutels.js "een herhaling is een ECHTE
   tweede handeling" -- de worp, de teller, het trekken van een kaart. Dat is
   deze route niet. Wat hij wél deelt met die familie is het enige dat
   lib/idem-sleutelbepaling.js regel 82 ermee doet: geen sleutel, dus de poort
   laat elke aanroep door. Er bestaat vandaag geen vorm die zegt "de handler is
   zelf idempotent, dus dedupliceren is overbodig en voor een toggle schadelijk",
   en die vijfde vorm verzinnen is een besluit en geen bouwtaak -- vandaar deze
   uitleg in plaats van een nieuw woord.

   LET OP DE TWEE ASSEN, want ze spreken elkaar hier niet tegen. In
   ../lib/mutatiecontracten-stage.js staat deze route als
   `semantiek: { klasse: 'idempotent' }`, en dat blijft waar: dat gaat over wat
   de HANDELING is. Dit bestand gaat over wat de POORT met een tweede aanroep
   doet. MUTATIECONTRACT.md houdt die twee met opzet uit elkaar. */
'use strict';
const SLEUTELS = {
  /* Lezen: opzoeken, de eigen volglijst, en het redactiebord. */
  'POST /api/mediaos/aanwezig': { leest: true },
  'POST /api/mediaos/aanwezig/mijn': { leest: true },
  'POST /api/office/salon/uitlicht/bord': { leest: true },
  /* En de twee die schakel 2 en 5 van de momentproef sloten. Allebei LEZEN ze:
     Discovery doorzoekt de aanwezigheden, de Fan Inbox leest de tijdlijn van wat
     je volgt. Herhalen hoort hier het antwoord van NU te geven -- wie tweemaal
     zoekt na een nieuw optreden, wil dat optreden zien en niet het antwoord van
     vijf seconden geleden. */
  'POST /api/mediaos/aanwezig/zoek': { leest: true },
  'POST /api/mediaos/momenten': { leest: true },

  /* Schrijven. */
  'POST /api/mediaos/aanwezig/volg': { nietIdempotent: true,
    waarom: 'Een TOGGLE, en de poort mag hem niet dedupliceren. volg() is zelf idempotent (hij zet een stand met indexOf), dus herhalen is veilig -- maar het venster van vijf seconden gaf bij volgen-ontvolgen-volgen het antwoord van de eerste terug en sloeg de derde over: het lid volgde niets terwijl de API 200 en volgIk:true zei. Zie de kop voor de meting en voor waarom de NAAM van deze vorm de lading hier niet dekt.' },
  'POST /api/office/salon/uitlicht': { velden: ['postId', 'grond'] },
  'POST /api/office/salon/uitlicht/intrek': { velden: ['postId'] }
};
module.exports = { SLEUTELS };
