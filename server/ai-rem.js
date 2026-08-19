/* ============================================================================
   DE REM PER AANROEPER, EN WAAROM HIJ OP DE AANROEP ZIT EN NIET OP DE ROUTE.

   ./ai-meter.js telt wat er omgaat en draait de hoofdkraan dicht op een
   dagbedrag. Dat is een TERUGBLIK: hij grijpt in als het geld op is. Deze laag
   doet het andere: hij houdt tegen dat iemand er in een minuut doorheen gaat.

   Twee verschillende dingen, dus twee bestanden. De meter meet, de rem stopt.

   DE VERLEIDING IS EEN LIJST MET AI-PADEN en daar een rem voor hangen. Dat
   werkt precies tot iemand route nummer 101 toevoegt en de lijst vergeet -- en
   dan is de duurste route in huis juist de enige zonder rem. Dezelfde
   redenering staat in CLAUDE.md over de 18+-grens: de regel hoort op EEN plek
   te staan en nieuwe gevallen hangen eraan, ze krijgen geen eigen kopie.

   Daarom telt deze rem MODELAANROEPEN in plaats van verzoeken. Wie de aanroep
   deed komt uit een async-context die de middleware zet -- hetzelfde
   AsyncLocalStorage-patroon dat db/index.js al gebruikt. Een nieuwe route valt
   er automatisch onder, ook als niemand eraan denkt.

   DE GRENS. Zestig externe modelaanroepen per minuut per IP. Een mens haalt dat
   niet: een gesprek is er een paar, en zelfs de doe-lus van kern/stuur.js doet
   er een handvol per handeling. Voor een script is het wel een grens: het haalt
   de $244 per uur die de generieke rem van 300 verzoeken toestaat terug naar
   ongeveer $49. Te zetten met RTG_AI_BEURTEN_PER_MINUUT; 0 zet hem uit.

   GEEN CONTEXT IS GEEN REM. Een achtergrondtaak, een script of de opstart komt
   niet van buiten en hoort niet stil te vallen doordat een bezoeker druk was.
   ========================================================================== */
'use strict';
/* De tijd komt uit de klok van dit huis: het venster van deze rem IS
   tijdgedrag, en met server/lib/klok.js is dat te beproeven (RTG_KLOK). */
const klok = require('./lib/klok');
const { AsyncLocalStorage } = require('async_hooks');

const context = new AsyncLocalStorage();
const beurten = new Map(); // sleutel -> { vanaf, n }
const BEURT_VENSTER = 60000;

function beurtGrens() {
  const v = Number(process.env.RTG_AI_BEURTEN_PER_MINUUT);
  return Number.isFinite(v) && v >= 0 ? v : 60;
}

/* Wie doet deze aanroep. */
const wie = () => context.getStore() || null;
function inContext(sleutel, fn) { return context.run(String(sleutel || ''), fn); }

function magNogVoor(sleutel, nu) {
  const max = beurtGrens();
  if (!max) return true;
  const k = sleutel === undefined ? wie() : sleutel;
  if (!k) return true;
  const t = nu || klok.nu();
  const b = beurten.get(k) || { vanaf: t, n: 0 };
  if (t - b.vanaf > BEURT_VENSTER) { b.vanaf = t; b.n = 0; }
  if (b.n >= max) { beurten.set(k, b); return false; }
  b.n += 1; beurten.set(k, b);
  return true;
}

/* De middleware die de context zet. Meer doet hij niet: het tellen gebeurt pas
   als er echt een extern model wordt aangeroepen. */
function contextMiddleware() {
  return (req, res, next) => inContext(req.ip || '', () => next());
}

function nulstel() { beurten.clear(); }

const opruimer = setInterval(() => {
  const t = klok.nu();
  for (const [k, b] of beurten) if (t - b.vanaf > BEURT_VENSTER * 2) beurten.delete(k);
}, BEURT_VENSTER);
if (opruimer.unref) opruimer.unref();

module.exports = { magNogVoor, inContext, contextMiddleware, beurtGrens, wie, nulstel };
