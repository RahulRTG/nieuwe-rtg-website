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
  // Meld een echte uitzondering (met stack) en geef hem door aan de fout-tracker.
  uitzondering(err, context) {
    const veld = Object.assign({ fout: (err && err.message) || String(err), stack: err && err.stack }, context || {});
    schrijf('error', 'uitzondering', veld);
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
