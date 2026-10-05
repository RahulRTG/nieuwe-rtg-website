/* ============================================================================
   LOS VAN HET VERZOEK -- achtergrondwerk start in de nulcontext.

   WAAROM DIT ER IS. Een timer erft de async-context van de plek waar hij werd
   GEZET. Twee gedeelde spoeltimers (kern/journaalbestand.js, kern/kosten/
   meter.js) spoelen het werk van ALLE verzoeken, maar draaiden in de context
   van het verzoek dat hem toevallig startte: 15 van 15 vuurden na afloop met
   de (gesloten) handeling van dat verzoek, 11 met de kostendrager van dat lid
   of die zaak, 10 met zijn AI-sessie (FASE2-meting, invariant I4). Een
   AI-aanroep in zo'n timer was op dat lid geboekt; een kernaanraking werd aan
   het pad van een verzoek toegeschreven dat al klaar was.

   HOE. `AsyncLocalStorage.snapshot()` legt de context vast van het moment van
   aanroepen -- voor ALLE winkels tegelijk, dus ook voor de winkels die deze
   module niet kent. Genomen bij het LADEN van dit bestand, buiten elk verzoek,
   is dat de nulcontext.

   DE VALKUIL, en die is nagemeten: wordt dit bestand voor het eerst geladen
   BINNEN een verzoek, dan legt de snapshot DAT verzoek vast en erft elke timer
   hier voortaan diens identiteit -- erger dan voorheen. Ook de asynchrone id
   verraadt dat niet (een synchrone run() blijft op 1). Daarom laadt
   server/opzet/handeling.js deze module bovenaan: die wordt geladen bij het
   opbouwen van de verzoekketen, voor het eerste verzoek. Dat het werkt, meet
   scripts/contextdoorgifte.js (I4) in plaats van het aan te nemen.

   WAT DIT NIET IS: een overdracht. Werk dat BIJ dit verzoek hoort en dat
   bewust de identiteit meeneemt, hoort een expliciete overdracht te krijgen
   (FASE2, PR 7). Dit is voor werk dat van niemand is.
   ========================================================================== */
'use strict';
const { AsyncLocalStorage } = require('async_hooks');

const nul = AsyncLocalStorage.snapshot();

/* fn(...args) in de nulcontext. Geeft terug wat fn teruggeeft. */
function losVanVerzoek(fn, ...args) { return nul(fn, ...args); }

module.exports = { losVanVerzoek };
