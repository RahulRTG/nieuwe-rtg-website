/* ============================================================================
   DE METER OP DE MODELKRAAN: WAT ER OMGAAT, EN WAAR HET STOPT.

   WAT ER NIET WAS. Honderd aanroepplekken sturen werk naar een extern model, en
   nergens werd geteld wat dat kostte: `usage.output_tokens` kwam wel binnen bij
   de drie aanbieders, maar niemand deed er iets mee. De eerste keer dat je het
   merkte was op de factuur -- een maand later.

   WAT DAT WAARD IS. De rem aan de deur (middleware/remmen.js) laat 300
   API-verzoeken per minuut per IP toe. Die grens is verstandig gekozen voor een
   endpoint dat een tiende cent kost, maar hij ziet geen verschil tussen dat
   endpoint en een Opus-aanroep. Gemeten aan de systeemprompts die hier echt
   staan (mediaan ~215 invoer-tokens, ~500 uitvoer) is een Opus-aanroep
   $0,0136. Een IP dat die grens een uur lang volloopt op zo'n route komt uit op
   ongeveer $244 -- zonder in te breken, gewoon binnen de regels.

   TWEE DINGEN DUS, EN OP DEZE PLEK. server/ai.js is het enige punt waar elke
   aanroep langskomt en waar bekend is wie hem beantwoordde. Hier wordt geteld,
   en hier staat de hoofdkraan.

   WAT HET PLAFOND WEL EN NIET DOET. Het slaat alleen EXTERNE aanbieders af. Een
   eigen modelserver (LOCAL_AI_URL) kost niets en blijft draaien; is die er niet,
   dan valt de keten terug op geen-model, en dat is een stand die dit huis al
   kent en draagt: "zonder model blijven alle kernprocessen in handmatige
   werkmodus beschikbaar". Het plafond maakt dus niets stuk, het maakt een
   bestaande terugvalstand aan.

   DE PRIJZEN ZIJN EEN TABEL EN GEEN WAARHEID. Ze staan hieronder met een datum
   erbij, in dollar per miljoen tokens, en ze verouderen. Ze zijn er om een
   ORDE VAN GROOTTE te bewaken en een kraan dicht te draaien -- niet om je
   boekhouding op te baseren. Een model dat hier niet in staat wordt geteld
   tegen het duurste tarief dat we kennen: liever te vroeg dicht dan te laat.
   ========================================================================== */
'use strict';

/* Prijzen per miljoen tokens, in dollar. Peildatum 2026-08-19.
   Te overschrijven met RTG_AI_PRIJZEN (JSON), zodat een prijswijziging geen
   codewijziging hoeft te zijn. */
const PRIJZEN_PEILDATUM = '2026-08-19';
const PRIJZEN = {
  'claude-opus-5': { in: 5, uit: 25 },
  'claude-opus-4-8': { in: 5, uit: 25 },
  'claude-opus-4-7': { in: 5, uit: 25 },
  'claude-opus-4-6': { in: 5, uit: 25 },
  'claude-fable-5': { in: 10, uit: 50 },
  'claude-sonnet-5': { in: 3, uit: 15 },
  'claude-sonnet-4-6': { in: 3, uit: 15 },
  'claude-haiku-4-5': { in: 1, uit: 5 },
  'claude-haiku-4-5-20251001': { in: 1, uit: 5 }
};
/* Het duurste dat we kennen: het tarief voor een model dat niet in de tabel
   staat. Zo leidt een nieuw of onbekend model nooit tot een te lage schatting. */
const ONBEKEND = { in: 10, uit: 50 };

/* Een cache-LEESBEURT kost een tiende van de invoerprijs, een cache-SCHRIJF
   1,25x. Dat verschil is de hele reden dat verrijkMetCache in ./anthropic.js
   bestaat, dus de meter hoort het ook te kennen -- anders lijkt caching duurder
   dan het is en gaat iemand hem uitzetten. */
const CACHE_LEES = 0.1;
const CACHE_SCHRIJF = 1.25;

function tabel() {
  if (!process.env.RTG_AI_PRIJZEN) return PRIJZEN;
  try { return Object.assign({}, PRIJZEN, JSON.parse(process.env.RTG_AI_PRIJZEN)); }
  catch (e) { return PRIJZEN; }
}

/* Wat kost dit antwoord. Alle vier de soorten tokens apart, want ze hebben
   alle vier een andere prijs. */
function kostenVan(model, usage) {
  const p = tabel()[String(model || '')] || ONBEKEND;
  const u = usage || {};
  const inv = Number(u.input_tokens) || 0;
  const uit = Number(u.output_tokens) || 0;
  const lees = Number(u.cache_read_input_tokens) || 0;
  const schrijf = Number(u.cache_creation_input_tokens) || 0;
  return ((inv * p.in) + (lees * p.in * CACHE_LEES) + (schrijf * p.in * CACHE_SCHRIJF) + (uit * p.uit)) / 1e6;
}

/* De stand van vandaag. Bewust in het geheugen en niet in de database: dit is
   een kraan en een teller, geen grootboek. Na een herstart begint de dag
   opnieuw -- dat is een bewuste keuze en staat ook zo in de uitleg hieronder,
   zodat niemand denkt dat hier een boekhouding staat. */
/* Twee emmers, want het zijn twee verschillende dingen.

   EXTERN kost geld: daar hoort een bedrag bij en een kraan.

   INTERN (LOCAL_AI_URL) kost geen geld maar CAPACITEIT -- je eigen ijzer, je
   eigen wachttijd. Die telt hier dus wel mee, maar zonder bedrag; een euro
   naast een lokale aanroep zetten zou een verzinsel zijn.

   En dan is er nog een derde getal dat pas ontstaat doordat er twee emmers
   zijn, en dat is misschien wel het nuttigste van alle drie: de VERHOUDING.
   De keten is lokaal-eerst (server/ai.js), dus een externe aanroep gebeurt
   alleen als de lokale laag iets niet kan of uitvalt. Loopt het aandeel extern
   op, dan is dat geen kostenpost maar een SIGNAAL: de eigen modelserver haakt
   af, en de rekening merkt het eerder dan een mens. */
const LEEG = () => ({ dag: '', aanroepen: 0, gefaald: 0, tokensIn: 0, tokensUit: 0, cacheLees: 0, kosten: 0, perModel: {},
  lokaal: { aanroepen: 0, gefaald: 0, tokensIn: 0, tokensUit: 0, perModel: {} } });
let staat = LEEG();

const vandaag = (nu) => new Date(nu || Date.now()).toISOString().slice(0, 10);
function huidig(nu) {
  const d = vandaag(nu);
  if (staat.dag !== d) { staat = LEEG(); staat.dag = d; }
  return staat;
}

/* Het dagplafond in dollar. Niet gezet (of 0) = geen plafond; dat is de stand
   waarin dit huis vandaag draait, en het blijft zo tenzij iemand hem zet. */
function plafond() {
  const v = Number(process.env.RTG_AI_DAGPLAFOND);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/* Mag er nog een EXTERNE aanroep uit? Een lokale aanbieder kost niets en vraagt
   het niet eens. */
function magNog(nu) {
  const max = plafond();
  if (!max) return true;
  return huidig(nu).kosten < max;
}

function boek(model, usage, nu) {
  const s = huidig(nu);
  const u = usage || {};
  const k = kostenVan(model, u);
  s.aanroepen += 1;
  s.tokensIn += (Number(u.input_tokens) || 0) + (Number(u.cache_creation_input_tokens) || 0);
  s.tokensUit += Number(u.output_tokens) || 0;
  s.cacheLees += Number(u.cache_read_input_tokens) || 0;
  s.kosten += k;
  const m = String(model || 'onbekend');
  const pm = s.perModel[m] || (s.perModel[m] = { aanroepen: 0, kosten: 0 });
  pm.aanroepen += 1; pm.kosten += k;
  return k;
}

function boekFout(nu) { huidig(nu).gefaald += 1; }

/* De interne AI. Zelfde telwerk, geen bedrag. */
function boekLokaal(model, usage, nu) {
  const l = huidig(nu).lokaal;
  const u = usage || {};
  l.aanroepen += 1;
  l.tokensIn += (Number(u.input_tokens) || 0) + (Number(u.cache_creation_input_tokens) || 0);
  l.tokensUit += Number(u.output_tokens) || 0;
  const m = String(model || 'onbekend');
  l.perModel[m] = (l.perModel[m] || 0) + 1;
}
function boekLokaalFout(nu) { huidig(nu).lokaal.gefaald += 1; }

function stand(nu) {
  const s = huidig(nu);
  const max = plafond();
  return {
    dag: s.dag,
    aanroepen: s.aanroepen,
    gefaald: s.gefaald,
    tokensIn: s.tokensIn,
    tokensUit: s.tokensUit,
    cacheLees: s.cacheLees,
    kostenUsd: Math.round(s.kosten * 10000) / 10000,
    /* De uitsplitsing per model is de hele reden dat dit er is: een totaalbedrag
       vertelt je dat het duur is, deze regel vertelt je waardoor. */
    perModel: Object.fromEntries(Object.entries(s.perModel).map(([m, v]) =>
      [m, { aanroepen: v.aanroepen, kosten: Math.round(v.kosten * 10000) / 10000 }])),
    plafondUsd: max || null,
    ruimte: max ? Math.max(0, Math.round((max - s.kosten) * 10000) / 10000) : null,
    dicht: max ? s.kosten >= max : false,
    /* De interne AI: aantallen en tokens, geen bedrag -- die draait op eigen
       ijzer. Zie de kop bij LEEG(). */
    lokaal: { aanroepen: s.lokaal.aanroepen, gefaald: s.lokaal.gefaald,
      tokensIn: s.lokaal.tokensIn, tokensUit: s.lokaal.tokensUit,
      perModel: Object.assign({}, s.lokaal.perModel) },
    /* Het aandeel dat naar buiten ging. De keten is lokaal-eerst, dus dit hoort
       laag te zijn; loopt het op, dan haakt de eigen modelserver af. null als er
       nog niets gedraaid heeft, want 0% van niets zegt niets. */
    aandeelExtern: (s.aanroepen + s.lokaal.aanroepen)
      ? Math.round(s.aanroepen / (s.aanroepen + s.lokaal.aanroepen) * 100) : null,
    peildatum: PRIJZEN_PEILDATUM,
    /* Zodat een scherm dat dit toont niet suggereert dat het een grootboek is. */
    let: 'schatting op basis van een lokale prijstabel; nulstand bij herstart'
  };
}

function nulstel() { staat = LEEG(); beurten.clear(); }

/* ---- DE REM, EN WAAROM HIJ OP DE AANROEP ZIT EN NIET OP DE ROUTE ----

   De verleiding is een lijst met AI-paden en daar een rem voor hangen. Dat
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
   ongeveer $49. Te zetten met RTG_AI_BEURTEN_PER_MINUUT; 0 zet hem uit. */
const { AsyncLocalStorage } = require('async_hooks');
const context = new AsyncLocalStorage();
const beurten = new Map(); // sleutel -> { vanaf, n }
const BEURT_VENSTER = 60000;

function beurtGrens() {
  const v = Number(process.env.RTG_AI_BEURTEN_PER_MINUUT);
  return Number.isFinite(v) && v >= 0 ? v : 60;
}
/* Wie doet deze aanroep. Geen context (een achtergrondtaak, een script, de
   opstart) betekent geen rem: die komen niet van buiten en horen niet stil te
   vallen doordat een bezoeker druk was. */
const wie = () => context.getStore() || null;
function inContext(sleutel, fn) { return context.run(String(sleutel || ''), fn); }

function magNogVoor(sleutel, nu) {
  const max = beurtGrens();
  if (!max) return true;
  const k = sleutel === undefined ? wie() : sleutel;
  if (!k) return true;
  const t = nu || Date.now();
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

const opruimer = setInterval(() => {
  const t = Date.now();
  for (const [k, b] of beurten) if (t - b.vanaf > BEURT_VENSTER * 2) beurten.delete(k);
}, BEURT_VENSTER);
if (opruimer.unref) opruimer.unref();

module.exports = { boek, boekFout, boekLokaal, boekLokaalFout, magNog, stand, nulstel, kostenVan, plafond, PRIJZEN, PRIJZEN_PEILDATUM,
  magNogVoor, inContext, contextMiddleware, beurtGrens, wie };
