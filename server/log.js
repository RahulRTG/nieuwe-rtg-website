/* Gestructureerd loggen zonder externe afhankelijkheid.
   In productie: één regel JSON per gebeurtenis (makkelijk te verzamelen door
   Loki/CloudWatch/Datadog). In ontwikkeling: leesbare, ingekleurde regels.
   Niveau instelbaar met LOG_LEVEL (debug|info|warn|error), standaard info.

   Er is een haak (onError) waar een externe fout-tracker (Sentry o.i.d.) op kan
   worden aangesloten zonder de rest van de code te wijzigen; ontbreekt die,
   dan gebeurt er niets bijzonders. Zo blijft observability een kwestie van
   configuratie, niet van codewijziging. */
const NIVEAUS = { debug: 10, info: 20, warn: 30, error: 40 };
const DREMPEL = NIVEAUS[(process.env.LOG_LEVEL || 'info').toLowerCase()] || NIVEAUS.info;
const JSON_UIT = process.env.NODE_ENV === 'production' || process.env.LOG_JSON === '1';
const DIENST = process.env.RTG_SERVICE || 'rtg';

let foutHaak = null; // (err, context) => void , bijv. Sentry.captureException
function onError(fn) { foutHaak = typeof fn === 'function' ? fn : null; }

/* Eigen fout-aggregatie (in-memory), zodat de eigenaar op het techniekbord
   meteen ziet wat er stuk is -- zonder een externe dienst zoals Sentry.
   Storingen worden gegroepeerd op een vingerafdruk (genormaliseerd bericht +
   bovenste stackframe): "order 123 mislukt" en "order 456 mislukt" vallen
   samen tot een groep met een teller. Bewust begrensd op RING groepen; loopt
   die vol, dan valt de groep weg die het langst niet meer opdook. Alles blijft
   in het RAM en verdwijnt bij een herstart -- geen persistente foutenopslag. */
const RING = 60;
const foutGroepen = new Map(); // vinger -> { vinger, bericht, waar, aantal, eerst, laatst, volg, bron }
let foutTotaal = 0;
let foutVolg = 0; // monotone teller: "recentst geraakt" ordenen we hierop, niet op
                  // de klok (twee storingen in dezelfde ms zouden anders willekeurig staan)

function vingerVan(err, context) {
  const bericht = ((err && err.message) || String(err)).slice(0, 200);
  let waar = '';
  const st = err && err.stack ? String(err.stack).split('\n') : [];
  const at = st.find(r => /^\s*at\s/.test(r));
  if (at) waar = at.trim().replace(/^at\s+/, '');
  else if (context && context.p) waar = String(context.p);
  // cijfers/ids wegnormaliseren zodat dezelfde fout met andere id's samenvalt
  const kern = bericht.replace(/\d+/g, '#');
  return { vinger: (kern + '|' + waar).slice(0, 260), bericht, waar: waar.slice(0, 200) };
}

function noteerFout(err, context) {
  foutTotaal++;
  const { vinger, bericht, waar } = vingerVan(err, context);
  const nu = Date.now();
  let g = foutGroepen.get(vinger);
  if (!g) {
    if (foutGroepen.size >= RING) { // ring vol: gooi de langst-stille groep weg
      let oudsteK = null, oudsteV = Infinity;
      for (const [k, v] of foutGroepen) if (v.volg < oudsteV) { oudsteV = v.volg; oudsteK = k; }
      if (oudsteK != null) foutGroepen.delete(oudsteK);
    }
    g = { vinger, bericht, waar, aantal: 0, eerst: nu, laatst: nu, volg: 0, bron: (context && (context.bron || context.p)) || null };
    foutGroepen.set(vinger, g);
  }
  g.aantal++; g.laatst = nu; g.volg = ++foutVolg; g.bericht = bericht; g.waar = waar;
}

// Samenvatting voor het techniekbord: totalen + de recentst geraakte groepen bovenaan.
function foutenSamenvatting(limiet) {
  const groepen = [...foutGroepen.values()].sort((a, b) => b.volg - a.volg)
    .slice(0, limiet || 12)
    .map(g => ({ bericht: g.bericht, waar: g.waar, aantal: g.aantal, eerst: g.eerst, laatst: g.laatst, bron: g.bron }));
  return { totaal: foutTotaal, distinct: foutGroepen.size, recent: groepen };
}
function foutenReset() { foutGroepen.clear(); foutTotaal = 0; foutVolg = 0; }

const KLEUR = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', reset: '\x1b[0m' };

function schrijf(niveau, bericht, velden) {
  if (NIVEAUS[niveau] < DREMPEL) return;
  const tijd = new Date().toISOString();
  if (JSON_UIT) {
    const regel = Object.assign({ t: tijd, niveau, dienst: DIENST, bericht }, velden || {});
    process.stdout.write(JSON.stringify(regel) + '\n');
  } else {
    const extra = velden && Object.keys(velden).length ? ' ' + JSON.stringify(velden) : '';
    const stroom = niveau === 'error' || niveau === 'warn' ? process.stderr : process.stdout;
    stroom.write(`${KLEUR[niveau]}${tijd} ${niveau.toUpperCase().padEnd(5)}${KLEUR.reset} ${bericht}${extra}\n`);
  }
}

const log = {
  debug: (m, v) => schrijf('debug', m, v),
  info: (m, v) => schrijf('info', m, v),
  warn: (m, v) => schrijf('warn', m, v),
  error: (m, v) => schrijf('error', m, v),
  onError,
  // De eigen in-memory fout-aggregatie (voor het techniekbord).
  foutenSamenvatting, foutenReset,
  // Meld een echte uitzondering (met stack): log hem, tel hem in de eigen
  // aggregatie, en geef hem door aan een optionele externe tracker (Sentry).
  uitzondering(err, context) {
    const veld = Object.assign({ fout: (err && err.message) || String(err), stack: err && err.stack }, context || {});
    schrijf('error', 'uitzondering', veld);
    try { noteerFout(err, context || {}); } catch (e) {}
    if (foutHaak) { try { foutHaak(err, context || {}); } catch (e) {} }
  }
};

/* Express-middleware: log elk verzoek met een correlatie-id, methode, pad,
   status en duur. Het id komt terug in de response-header (X-Request-Id) zodat
   een gebruiker of monitor een klacht aan een logregel kan koppelen. Gezondheid-
   checks loggen we op debug, zodat ze de productielog niet volspammen. */
function middleware() {
  const crypto = require('crypto');
  return (req, res, next) => {
    const id = req.headers['x-request-id'] || crypto.randomBytes(8).toString('hex');
    req.id = id;
    res.set('X-Request-Id', id);
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const stil = req.path === '/api/health' || req.path === '/api/ready';
      const niveau = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : (stil ? 'debug' : 'info');
      schrijf(niveau, 'verzoek', { id, m: req.method, p: req.path, s: res.statusCode, ms: Math.round(ms) });
    });
    next();
  };
}

/* Afsluitende foutafhandelaar voor Express: vangt fouten uit routes, logt ze
   mét stack, en geeft de client een nette, niet-lekkende JSON-fout terug. */
function foutMiddleware() {
  return (err, req, res, next) => {
    log.uitzondering(err, { id: req && req.id, p: req && req.path });
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({ error: 'Er ging iets mis. Probeer het later opnieuw.', id: req && req.id });
  };
}

module.exports = { log, middleware, foutMiddleware };
