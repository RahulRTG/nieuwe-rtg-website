/* ============================================================================
   DE OPBOUW VAN DE IDOR-PROEF -- A maakt echte objecten, langs de echte routes.

   WAAROM. De oogstgang raakt elke route een keer aan met een plausibel lijf
   (scripts/lib/rolproef.js plausibelLijf). Op ruim de helft van de ledenroutes
   is dat niet genoeg om iets te MAKEN: een pot vraagt een bestaand doel, een
   lijstje een vriend, een gesprek een tegenpartij, een spel een bekende naam.
   Gemeten (19 oktober 2026, BEVOEGD.json): 258 routes van de ledenschermen bleven
   ongesteld omdat A in dat domein niets bezat. Dan heeft B ook niets om op los te
   laten, en zegt de proef daar niets -- eerlijk, maar leeg.

   WAT DIT IS. Twee tabellen, en geen van beide verzint een uitkomst:

     LIJVEN    per route een geldig basislijf (veldnamen en waarden die de
               validatie doorlaten). A, B en de controle C sturen het allemaal;
               B krijgt het daarna verrijkt met A's id's uit de objectpool.
     stappen() een korte reeks echte verzoeken die A NA de oogstgang doet om
               objecten te maken. Wat terugkomt, gaat de pool en de merktekens
               in -- precies zoals elk ander antwoord van A.

   DE TEGENPARTIJ IS C, NOOIT B. Waar een object een tweede lid vraagt (een
   gesprek, een kring, een lijstje met een vriend), is dat de controle C. Was het
   B, dan mocht B het object rechtmatig zien en meet de proef niets.

   WAT DIT NIET DOET: een object van A rechtstreeks in de opslag zetten. Alles
   gaat langs de route die een lid ook gebruikt; een stap die faalt laat zijn
   routes eerlijk onbereikbaar, en de proef telt hoeveel stappen slaagden.
   ========================================================================== */
'use strict';

const vandaag = () => new Date().toISOString().slice(0, 10);
const over = (dagen) => new Date(Date.now() + dagen * 86400000).toISOString().slice(0, 10);

/* Basislijven. Een functie krijgt de context { tegen } (C's codenaam en e-mail). */
const LIJVEN = {};

/* De opbouwstappen. Elke stap: { pad, lijf(ctx) }. */
function stappen(ctx) { // eslint-disable-line no-unused-vars
  return [];
}

function lijfVoor(pad, basis, ctx) {
  const e = LIJVEN[pad];
  if (!e) return basis;
  return Object.assign({}, basis, typeof e === 'function' ? e(ctx || {}) : e);
}

module.exports = { LIJVEN, stappen, lijfVoor, vandaag, over };
