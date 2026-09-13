/* ============================================================================
   HET GEVOLGCONTRACT -- wat een capability VEROORZAAKT, verklaard en begrensd.

   WAAROM DIT NAAST ./gevolg.js STAAT EN HEM NIET VERVANGT. `gevolg.js` MEET: hij
   leest de `opslag` van IDEMPROEF.json en zegt welke collecties een route een
   keer echt aanraakte. Dat is hard en het is smal -- vers gemeten over de 173
   AI-bereikbare paden: 38 gemeten, 48 zonder effect, en 87 ONBEKEND. Een
   voorspelling die daarop leunt, weet van de helft niets.

   Dit bestand voegt de andere helft toe: een VERKLARING van een mens over wat een
   handeling veroorzaakt -- afgeleide gevolgen, gevolgen buiten de opslag, wat er
   bij een mislukking gebeurt, en wat we met opzet NIET weten. Meting en verklaring
   staan naast elkaar en worden nooit opgeteld; dat is dezelfde vorm als de twee
   assen van scripts/machinedekking.js en scripts/kantoormacht.js.

   DE REGEL DIE DIT EERLIJK HOUDT, en het is de enige die echt telt: een contract
   mag MEER zeggen dan de meting, maar nooit iets ANDERS. Waar het `graad: gemeten`
   claimt, moet `gevolg.js` dat bevestigen -- anders is het een bewering met een
   stempel dat niemand heeft gezet, en dan is dit register binnen een maand het
   valse groen dat het moest voorkomen. `keur()` weigert zo'n regel.

   VIER DINGEN UIT HET VOORSTEL ZIJN GEMETEN EN AANGEPAST. Niet uit voorzichtigheid
   maar omdat de naam of de ladder al bezet was:

   1. `reversible: yes/no` WORDT NIET VERKLAARD. Herstel is in dit huis GEMETEN,
      met VIJF uitslagen: `exact`, `compensatie`, `geen-herstel`, `nietBeproefd` en
      `wereldOntbreekt` (scripts/herstelproef.js). Een boolean eroverheen zou een
      meting met vijf standen platslaan tot twee -- en juist het verschil tussen
      "een creditnota" en "de factuur is weg" is waar die proef voor bestaat.
      Het contract VERWIJST dus naar die proef en verklaart hem niet.

   2. `KNOWN / BOUNDED / UNKNOWN` WORDT GEEN ZESDE ZEKERHEIDSLADDER. Dit huis
      heeft er al: de vier bewijsgraden (onbekend/vermoed/gemeten/bewezen, op twee
      plekken in kern/ als `GRADEN`), de drie graden van gevolg.js, vijf
      assurance-standen, acht uitkomsten in CONTROLPLANE.md, vier fiscale
      zekerheidsklassen, en `bewezenBegrensd`/`aannemelijkBegrensd` in
      scripts/lib/lusvorm.js -- dus zelfs het WOORD begrensd is bezet.
      AFSPRAAK.md verbiedt een zesde ladder met zoveel woorden.

      De bedoeling erachter is wel juist en blijft overeind, maar als TWEEDE AS in
      plaats van als derde trede: de graad zegt hoe hard we het weten, en het veld
      `uitkomsten` zegt of de uitkomstRUIMTE benoemd is. Een externe betaling met
      een gesloten set (`betaald`, `geweigerd`, `teruggeboekt`) is iets anders dan
      een gevolg waarvan niemand de mogelijkheden kent -- en dat verschil staat er
      nu zonder een nieuw woord voor "bounded".

   3. `affectedGoals` HEET `streefstand`. `doel` draagt in dit huis al twee
      betekenissen over 28 modules (een levensdoel en de AVG-doelbinding), en de
      gouden weg gebruikt daarom al `streefstand` voor wat na de handeling waar
      moet zijn (kern/kantoor/geldketen/klaarzet.js).

   4. `privacyImpact` HEET `classificatie`, uit de woordenlijst van
      kern/envelop.js. Daar staat ook de regel die meekomt: `onbekend` is geen
      `openbaar`, en een gevolg erft de classificatie niet -- dat zou raden zijn.

   WAT DIT BESTAND NIET DOET. Het voert niets uit, het beslist niets en het bezit
   geen plan -- net als ./plan.js en ./gevolg.js. En het zegt nooit HOEVEEL er
   verandert: "bankSaldi" is een collectie, geen bedrag. Wie hier een getal in wil,
   bouwt een tweede boekhouding.
   ========================================================================== */
'use strict';


/* De graden, de soorten en de geleende classificaties wonen in
   ./gevolgcontract/woorden.js -- daar staat ook waarom deze laag `gevolg` heet en
   niet `effect`, want dat woord is in dit huis vijf keer bezet. */
const { GRADEN, SOORTEN, klassen, werkwoorden } = require('./gevolgcontract/woorden');

/* De keuring woont in ./gevolgcontract/keuring.js -- zij groeit met elke regel die
   iemand erbij bedenkt, en deze laag hoort daar niet mee te groeien (dezelfde naad
   als server/kern/mutatiecontract/keuring.js naast zijn register). */
const { keur } = require('./gevolgcontract/keuring');
const { stand, STANDEN } = require('./gevolgcontract/stand');

module.exports = { keur, stand, GRADEN, SOORTEN, STANDEN, klassen, werkwoorden };
