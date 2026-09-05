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
const { geheimVrij, veiligeWaarde, veiligeFout } = require('./log-redactie');

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
    const regel = Object.assign({ t: tijd, niveau, dienst: DIENST, bericht: geheimVrij(bericht) },
      veiligeWaarde(velden || {}));
    process.stdout.write(JSON.stringify(regel) + '\n');
  } else {
    const schoneVelden = veiligeWaarde(velden || {});
    const extra = Object.keys(schoneVelden).length ? ' ' + JSON.stringify(schoneVelden) : '';
    const stroom = niveau === 'error' || niveau === 'warn' ? process.stderr : process.stdout;
    stroom.write(`${KLEUR[niveau]}${tijd} ${niveau.toUpperCase().padEnd(5)}${KLEUR.reset} ${geheimVrij(bericht)}${extra}\n`);
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
  // aggregatie, tel hem in de meting, en geef hem door aan een optionele
  // externe tracker (Sentry).
  uitzondering(err, context) {
    const schoonErr = veiligeFout(err);
    const veiligContext = veiligeWaarde(Object.assign({}, context || {}));
    if (veiligContext.p != null) veiligContext.p = journaalPad(veiligContext.p);
    const veld = Object.assign({ fout: schoonErr.message, stack: schoonErr.stack }, veiligContext);
    schrijf('error', 'uitzondering', veld);
    try { noteerFout(schoonErr, veiligContext); } catch (e) {}
    try { require('./log-meting').telServerfout(schoonErr, veiligContext); } catch (e) {}
    if (foutHaak) { try { foutHaak(schoonErr, veiligContext); } catch (e) {} }
  }
};



/* Express-middleware: log elk verzoek met een correlatie-id, methode, pad,
   status en duur. Het id komt terug in de response-header (X-Request-Id) zodat
   een gebruiker of monitor een klacht aan een logregel kan koppelen. Gezondheid-
   checks loggen we op debug, zodat ze de productielog niet volspammen. */
/* Het pad in VORM, zoals het journaal het bewaart: /api/lid/42 wordt
   /api/lid/:id. Zo tellen honderd verzoeken naar honderd leden als een regel, en
   belandt er geen nummer in het journaal dat naar een persoon leidt. Uit het
   journaal zelf gehaald, want twee regexen die hetzelfde bedoelen lopen uiteen. */
/* EEN LATE require() IS NIET GRATIS. Allebei de modules hieronder worden LAAT
   binnengehaald -- doorgeefjournaal om de kringverwijzing met dit bestand te
   breken, journaalhaak omdat hij pas later gevuld wordt -- en dat is terecht.
   Wat niet klopte: de require stond IN de verzoekafhandeling. Node cachet de
   module wel, maar de RESOLUTIE ervoor niet, dus elke aanroep liep opnieuw langs
   internalModuleStat: stat-aanroepen op schijf, per verzoek, goed voor 5,3% van
   alle rekentijd (PRESTATIES.md). Het blijft laat, maar hooguit EEN keer laat;
   mislukt het, dan mag het de volgende keer opnieuw. */
let _journaal = null, _haak = null;
const journaalMod = () => _journaal || (_journaal = require('./kern/doorgeefjournaal'));
const haakMod = () => _haak || (_haak = require('./journaalhaak'));
const journaalPad = (p) => { try { return journaalMod().padVorm(p); } catch (e) { return String(p || ''); } };
let journaalStuk = false;   // een kapot journaal meldt zich een keer, niet bij elk verzoek

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
      const veiligPad = journaalPad(req.path);
      schrijf(niveau, 'verzoek', { id, m: req.method, p: veiligPad, s: res.statusCode, ms: Math.round(ms) });
      /* Ook naar het doorgeefjournaal, want een logbestand is geen scherm. Hier
         staat alles al klaar, dus dit kost niets extra's. Het pad gaat er in
         VORM in (/api/lid/:id) -- honderd verzoeken naar honderd leden tellen zo
         als een regel, en er belandt geen id in het journaal dat naar een
         persoon leidt. Zie kern/doorgeefjournaal.js. */
      try {
        const haak = haakMod();
        haak.meld({ richting: 'in', wat: veiligPad, methode: req.method,
          status: res.statusCode, ms: Math.round(ms), mislukt: res.statusCode >= 400 });
      } catch (e) {
        /* Een journaal mag nooit een verzoek raken -- maar het mag ook niet stil
           mislukken. Deze catch slikte een ReferenceError (journaalPad bestond
           niet) en daardoor kwam er weken niets in het journaal terwijl alles er
           goed uitzag. Precies de fout die dit journaal moet helpen vinden. Dus:
           EEN keer melden, en daarna zwijgen. */
        if (!journaalStuk) { journaalStuk = true; console.error('[journaal] melden mislukt, en dat blijft zo tot een herstart:', e.message); }
      }
    });
    next();
  };
}

/* Afsluitende foutafhandelaar voor Express: vangt fouten uit routes, logt ze
   mét stack, en geeft de client een nette, niet-lekkende JSON-fout terug. */
function foutMiddleware() {
  return (err, req, res, next) => {
    log.uitzondering(err, { id: req && req.id, p: req && journaalPad(req.path) });
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({ error: 'Er ging iets mis. Probeer het later opnieuw.', id: req && req.id });
  };
}

/* De drempel naar buiten, zodat de techniekcontrole LOG-01 kan zien OF er per
   verzoek gelogd wordt in plaats van dat te raden uit de omgeving. */
module.exports = { log, middleware, foutMiddleware, NIVEAU_WAARDE: DREMPEL };
