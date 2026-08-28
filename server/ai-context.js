/* ============================================================================
   WIE DOET DEZE MODELAANROEP.

   Twee lagen hebben dat nodig en ze hebben het om verschillende redenen nodig:
   ./ai-rem.js telt aanroepen per minuut (daar is een IP genoeg), ./ai-budget.js
   houdt een dag- of maandbudget bij per PERSOON (daar is een IP juist fout).
   Dat is een reden voor twee lagen, niet voor twee contexten -- dus staat het
   hier een keer.

   HET PATROON. AsyncLocalStorage, hetzelfde als db/index.js al gebruikt. De
   middleware zet de context aan de buitenkant van het verzoek; alles wat
   daarbinnen gebeurt kan hem lezen, ook diep in een kern-module, zonder dat er
   een parameter door twintig functies hoeft.

   WAAROM HIJ HET VERZOEK BEWAART EN NIET DE SESSIE. De middleware hangt VOOR de
   routers (zie middleware/remmen.js), en daar heeft auth() nog niet gedraaid:
   req.session bestaat op dat moment nog niet. Zou de context de sessie nu
   uitlezen, dan stond er altijd null in. Hij bewaart daarom het verzoek zelf en
   leest de sessie pas op het moment van de aanroep -- dan heeft auth() hem
   allang gezet. Laat-gebonden, hetzelfde patroon als de regie in server.js.

   GEEN CONTEXT IS EEN ANTWOORD. Een achtergrondtaak, een script, de opstart of
   een cron heeft geen verzoek en dus geen persoon. Die horen niet stil te
   vallen doordat een bezoeker druk was, en ze horen ook niemands budget op te
   maken. Beide lagen lezen dat hier als "geen rem, geen budget".
   ========================================================================== */
'use strict';
const { AsyncLocalStorage } = require('async_hooks');

const opslag = new AsyncLocalStorage();

/* De context. `ip` is er altijd, `req` alleen bij een echt verzoek -- een toets
   mag ook een kale sleutel meegeven zonder een heel verzoek na te bouwen. */
function inContext(wat, fn) {
  const ctx = (wat && typeof wat === 'object') ? wat : { ip: String(wat || ''), req: null };
  return opslag.run(ctx, fn);
}

const huidig = () => opslag.getStore() || null;

/* Het IP van deze aanroep, of null. Dit is de sleutel van de rem. */
function ip() {
  const c = huidig();
  return (c && c.ip) || null;
}

/* De sessie van deze aanroep, of null. Pas HIER uitgelezen, niet bij het zetten
   -- zie de kop. */
function sessie() {
  const c = huidig();
  return (c && c.req && c.req.session) || null;
}

/* Het pad van deze aanroep, of ''. ./ai-budget.js leest hieraan af of dit een
   oppervlak is dat nooit mag sluiten. */
function pad() {
  const c = huidig();
  return (c && c.req && c.req.path) || '';
}

/* De middleware. Meer doet hij niet: het tellen en het remmen gebeurt pas als
   er echt een model wordt aangeroepen. */
function contextMiddleware() {
  return (req, res, next) => inContext({ ip: req.ip || '', req }, () => next());
}

module.exports = { inContext, huidig, ip, sessie, pad, contextMiddleware };
