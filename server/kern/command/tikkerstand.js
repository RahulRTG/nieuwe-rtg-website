/* ============================================================================
   MOGEN DE ACHTERGRONDTIKKERS LOPEN?

   Drie lagen van RTG Command hebben een `tikker()`: het alarm weegt elke
   minuut, de canary en de uitrolregie op hun eigen tempo. Ze schrijven allemaal
   uit zichzelf, zonder dat er iemand aanklopt -- en dat is precies hun taak:
   "klimt vanzelf" betekent niets als er eerst iemand moet kijken.

   WAAROM DIT ER IS. In een MEETserver is diezelfde eigenschap gif. De
   staatproef vergelijkt de opslag voor en na een verzoek en vraagt: wat heeft
   DEZE aanroep veranderd. Een tikker die toevallig binnen dat venster afgaat,
   schrijft `commandAlarmen` -- en die schrijfactie wordt toegerekend aan de
   route die op dat moment onder de meetklok lag.

   Dat is geen theoretisch bezwaar. Op 2 september 2026 stonden er vier routes
   geschorst in VERTROUWEN.json, en twee daarvan (`/api/onderneming/aandeel/zet`
   en `/api/supplier/horeca/venue/publiceer`) hadden als enige "bewijs" dat
   `commandAlarmen` bewoog. Via server/middleware/schorspoort.js betekent zo'n
   schorsing een 503 op echt verkeer. Twee werkende routes gingen dus dicht
   omdat er een minuutklok afliep.

   HET VERKLAART OOK WAAROM DE LIJST BLEEF SCHUIVEN. Elke ronde leverde andere
   geschorste routes op, en niemand kon zeggen welke er nu echt stuk waren: met
   4738 routes en een tikker van zestig seconden is het loterij welke route
   onder de klok ligt als hij afgaat.

   WAAROM DE STILLE CONTROLE HEM NIET VANGT. scripts/lib/staatproef.js meet een
   STIL VENSTER zonder aanroepen en trekt af wat daar ook beweegt -- precies
   voor doorlopende schrijvers. Maar dat venster duurt seconden en de tikker
   zestig; hij valt er bijna altijd naast. Het venster verlengen zou de proef
   over 4738 routes dagen laten duren.

   WAT DIT NIET UITZET. Alleen de LUS. Roept een route zelf `weeg()` aan, dan
   schrijft die nog steeds binnen het verzoek -- en dat hoort de proef juist te
   zien, want dat IS een gevolg van de aanroep. Het onderscheid is dus niet
   "alarm aan of uit" maar "veroorzaakt door een verzoek of door een klok".

   NOOIT IN PRODUCTIE. De vlag komt uit de omgeving en wordt gezet door
   scripts/lib/wegwerpserver.js, dezelfde plek die RTG_SCHORSPOORT_UIT zet. Wie
   hem op een echte server zet, zet zijn bewaking uit -- vandaar dat hij hier op
   EEN plek staat en niet drie keer los in een module.
   ========================================================================== */
'use strict';

/* Een functie en geen constante: een module die bij het laden een
   momentopname van de omgeving neemt, is niet te toetsen zonder hem opnieuw te
   laden. */
const tikkersUit = () => process.env.RTG_TIKKERS_UIT === '1';

module.exports = { tikkersUit };
