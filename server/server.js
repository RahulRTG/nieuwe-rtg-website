/* RTG Ledenportaal, backend.
   Start: npm start (of node server/server.js). Draait op http://localhost:3000.
   Zet ANTHROPIC_API_KEY in de omgeving om de persoonlijke AI op de echte
   Claude API te laten draaien; zonder key vallen we terug op demo-antwoorden. */

/* De accountsdatabase gebruikt de ingebouwde SQLite van Node, die nog achter
   een vlag zit. Wordt de server zonder die vlag gestart, dan herstarten we
   onszelf ermee, zodat zowel `npm start` als `node server/server.js` werkt. */
if (!process.execArgv.some(a => a.includes('experimental-sqlite'))) {
  const r = require('child_process').spawnSync(
    process.execPath,
    ['--experimental-sqlite', __filename, ...process.argv.slice(2)],
    { stdio: 'inherit' }
  );
  process.exit(r.status == null ? 1 : r.status);
}

/* Wachtwoord-hashing (scrypt) rekent in de libuv-threadpool, die standaard
   maar 4 draden heeft, ongeacht de machine. scrypt is puur rekenwerk, dus de
   juiste maat is: evenveel draden als CPU-kernen (gemeten: op een 4-kernen
   machine brengt meer dan 4 niets, op een 16-kernen machine wel ~4x meer
   gelijktijdige logins). Dit moet gezet zijn VOOR het eerste asynchrone
   crypto/fs-werk, dus hier bovenaan; een expliciete UV_THREADPOOL_SIZE uit
   de omgeving wint altijd. */
if (!process.env.UV_THREADPOOL_SIZE) {
  const kernen = require('os').availableParallelism();
  process.env.UV_THREADPOOL_SIZE = String(Math.max(4, kernen));
}

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { db, load, save, DATA_DIR, startGedeeld, startSqliteSync, startPostgres, flushBijAfsluiten, onExternalChange, grootSupplierSync, grootAantal,
  ledenGidsActief, ledenGidsHaal, ledenGidsAantal, ledenGidsZet, ledenGidsKeyVanCodenaam, ledenGidsZoek } = require('./db');
const i18n = require('./translate');
const accounts = require('./accounts');
const eigenaar = require('./eigenaar');
const mail = require('./mail');
const logboek = require('./log');
const log = logboek.log;
const betaal = require('./betaal');
const { schoon, ledenPrijs, centen, entreeCode, pickupCode } = require('./kern/util');
const { publicPartner, weekdagFactor, cvReady, btwSplit } = require('./kern/afgeleid');
const { FISCAAL_PEILJAAR, LANDEN, FIN_CAT, ZZP, maakFiscaal } = require('./kern/fiscaal');
const { RUN_STATIONS, ALT_IDEE, coachCache, maakEvents } = require('./kern/events');
const { maakLive } = require('./kern/live');
const { RIT_KETEN, RIT_LEGACY, RIT_MELDING, maakVervoer } = require('./kern/vervoer');
const { VAC_SOORTEN, maakWerk } = require('./kern/werk');

/* Optionele fout-tracker (Sentry): alleen actief als SENTRY_DSN is gezet én het
   pakket is geinstalleerd. Zonder allebei verandert er niets. Zo is productie-
   monitoring een kwestie van configuratie, niet van codewijziging. */
if (process.env.SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES || 0) });
    log.onError((err, ctx) => Sentry.captureException(err, { extra: ctx }));
    log.info('Fout-tracker: Sentry actief.');
  } catch (e) {
    log.warn('SENTRY_DSN gezet maar @sentry/node ontbreekt; fout-tracker uit.');
  }
}

// Vangnet: een niet-afgevangen belofte-afwijzing (bijv. een externe AI- of
// vertaalaanroep die faalt) beeindigt in Node 22 standaard het proces. Voor een
// webserver is dat een crash-DoS: een enkel verzoek zou de actieve server
// kunnen platleggen. We loggen zo'n afwijzing en laten de server doordraaien;
// het verzoek dat hem veroorzaakte krijgt geen antwoord, maar de rest wel.
process.on('unhandledRejection', reason => {
  log.uitzondering(reason instanceof Error ? reason : new Error(String(reason)), { bron: 'unhandledRejection' });
});
// Een niet-afgevangen synchrone uitzondering laat de staat mogelijk half klaar
// achter; we loggen hem mét stack en stoppen netjes, zodat de proces-manager
// (Docker/systemd) ons herstart in plaats van door te draaien op kapotte staat.
process.on('uncaughtException', err => {
  log.uitzondering(err, { bron: 'uncaughtException', fataal: true });
  try { save(); } catch (e) {}
  setTimeout(() => process.exit(1), 200).unref();
});

function appUrl(req) {
  return process.env.APP_URL || req.headers.origin || (req.protocol + '://' + req.get('host'));
}

// Fail-fast: weiger te starten als productie onveilig is ingesteld (demo aan,
// geen versleutelingssleutel, standaard-geheimen). Dit stopt het proces vóór
// er ook maar één verzoek binnenkomt.
require('./config').pasToe(process.env, log);

load();
accounts.init();
// Demo-modus: alleen buiten productie, of expliciet met RTG_DEMO=1. Zo staan de
// demo-inlog en het demo-account (Rahul/Imran) nooit per ongeluk open op productie.
const DEMO = process.env.NODE_ENV !== 'production' || process.env.RTG_DEMO === '1';
// Demo-account zodat Rahul/Imran ook via de echte accountlogin werkt.
// Sync-varianten: de seed draait voor 'listen', dus blokkeren kan geen kwaad
// en zodra de poort opengaat bestaan de accounts gegarandeerd (geen race in tests).
if (DEMO && accounts.count() === 0) {
  const u = accounts.createUserSync({ username: 'Roellie', email: require('./eigenaar').OWNER_EMAIL, password: process.env.DEMO_PASS || 'Imran', tier: 'business', realName: 'Roellie I', phone: '+31612345678' });
  accounts.saveMemberState(u.id, memberTemplate());
  accounts.setVerification(u.id, 'verified'); // demo-account is al geverifieerd
}

// Demo-personeel per leverancier: een manager (PIN 1234) en een medewerker (PIN 5678).
const STAFF_SEED = {
  SAKURA: [['Marc Bosch', 'manager', 'Beheer'], ['Rosa Torres', 'staff', 'Onderhoud']],
  KIKUNOI: [['Mateo Ferrer', 'manager', 'Keuken'], ['Nora Prins', 'staff', 'Bediening']],
  PONTO: [['Diego Serra', 'manager', 'Bar'], ['Lisa Groen', 'staff', 'Bediening']],
  HOSHI: [['Carla Vidal', 'manager', 'Receptie'], ['Ibrahim Yildiz', 'staff', 'Housekeeping']],
  MKKX: [['Paolo Mendez', 'manager', 'Taxi centrale'], ['Yara El Idrissi', 'staff', 'Chauffeur']],
  JETAG: [['Sophie Bakker', 'manager', 'Operations'], ['Lucas de Jong', 'staff', 'Crew']],
  // zelfstandigen: eenmanszaken, dus alleen een eigenaar met beheer-rechten
  AYAKA: [['Livia Bergkamp', 'manager', 'Goudsmid']],
  KAITO: [['Milan de Wit', 'manager', 'Personal trainer']],
  // activiteiten: beheer plus de mensen aan de deur en op de boot
  ESVEDRA: [['Marta Salas', 'manager', 'Beheer'], ['Joel Ferrer', 'staff', 'Gids']],
  MACE: [['Elena Costa', 'manager', 'Beheer'], ['Dani Ruiz', 'staff', 'Security']],
  ISLAREN: [['Carmen Vidal', 'manager', 'Beheer'], ['Pau Riera', 'staff', 'Balie']],
  IBIZALIV: [['Sofia Marin', 'manager', 'Makelaar'], ['Bram Kessler', 'staff', 'Bezichtigingen']],
  IBIZAIR: [['Nadia Fischer', 'manager', 'Operations'], ['Tomas Weller', 'staff', 'Piloot']]
};
for (const [code, people] of Object.entries(STAFF_SEED)) {
  if (accounts.countStaff(code) === 0) {
    people.forEach(([name, role, func], i) => accounts.createStaffSync({ supplierCode: code, name, role, func, pin: i === 0 ? '1234' : '5678' }));
  }
}

const app = express();

/* ---------- foutisolatie per verzoek ----------
   Een bug in EEN route mag nooit het proces (en dus alle andere apps) raken.
   Express 4 vangt een gegooide fout in een async handler niet zelf op: het
   verzoek blijft hangen en de fout wordt een unhandledRejection. Daarom
   omhullen we elke route-handler: een (async) fout wordt netjes next(err),
   de centrale foutafhandelaar geeft die ENE aanvraag een 500, en de rest
   van het systeem merkt er niets van. */
for (const methode of ['get', 'post', 'put', 'delete', 'patch', 'all']) {
  const orig = app[methode].bind(app);
  app[methode] = (...args) => orig(...args.map(f => {
    if (typeof f !== 'function') return f; // paden en opties ongemoeid laten
    return (req, res, next) => {
      try {
        const r = f(req, res, next);
        if (r && typeof r.catch === 'function') r.catch(next);
      } catch (e) { next(e); }
    };
  }));
}
app.disable('x-powered-by');
const PRODUCTION = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1); // achter een reverse proxy (hosting) klopt req.secure dan
app.use(logboek.middleware()); // correlatie-id + verzoeklog (methode, pad, status, duur)

// In productie: alles naar https, en HSTS zodat browsers het onthouden.
app.use((req, res, next) => {
  if (PRODUCTION) {
    if (!req.secure) return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

/* Security-headers op elk antwoord. De CSP staat inline scripts/styles toe
   (de apps zijn bewust self-contained), maar verbiedt elk ander extern
   verkeer dan de Google Fonts en blokkeert framing en MIME-sniffing. */
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
  res.set('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' data: blob:; " +
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
  next();
});

/* Betaal-webhook: de provider (Stripe) bevestigt hier een betaling. Dit MOET
   vóór de JSON-parser staan én de ruwe body houden, want de handtekening wordt
   over de onbewerkte bytes berekend. Een ongeldige handtekening -> 400. */
app.post('/api/betaal/webhook', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
  let evt;
  try {
    evt = betaal.verifieerWebhook(req.body, req.get('stripe-signature') || req.get('x-rtg-signature'));
  } catch (e) {
    log.warn('betaal-webhook geweigerd', { fout: e.message, id: req.id });
    return res.status(400).json({ error: 'Ongeldige handtekening.' });
  }
  try {
    // De betaalstatus komt hier binnen als geverifieerde waarheid. Het routeren
    // van evt.type naar de juiste factuur is domeinlogica die de member-routes
    // oppakken; we loggen de gebeurtenis zodat ze traceerbaar is.
    log.info('betaal-webhook', { type: (evt && evt.type) || 'onbekend', id: evt && evt.id });
  } catch (e) { log.uitzondering(e, { bron: 'betaal-webhook' }); }
  res.json({ ok: true });
});

app.use(express.json({ limit: '8mb' }));

/* Hoofdzekering: staat de onderhouds-zekering uit (gesprongen), dan is de app in
   onderhoud. Alle API's geven dan 503, behalve de technische pagina en de
   health/ready-checks, en behalve verzoeken van de eigenaar (met geldig token).
   Zo kan de eigenaar de app bewust "spanningsloos" maken en er zelf bij blijven
   om de zekering er weer in te doen. */
app.use((req, res, next) => {
  const z = db.data && db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen.onderhoud;
  if (!z || z.aan !== false) return next(); // normaal: stroom staat erop
  const p = req.path;
  if (p.startsWith('/api/techniek') || p === '/api/health' || p === '/api/ready') return next();
  try {
    const tok = (req.get('authorization') || '').replace(/^Bearer\s+/i, '') || req.query.token;
    const u = tok ? accounts.verifyToken(tok) : null;
    if (eigenaar.isEigenaar(accounts, u)) return next(); // de eigenaar mag er wel bij
  } catch (e) {}
  if (p.startsWith('/api/')) return res.status(503).json({ error: 'De app is in onderhoud. Probeer het later opnieuw.' });
  next();
});

/* Functieschakelaars: per functionaliteit een bewuste aan/uit-knop (beheerd op
   de technische pagina). Staat een functie uit, dan geeft zijn API 503. De
   technische pagina zelf en de health/ready-checks blijven altijd bereikbaar,
   zodat de eigenaar alles weer aan kan zetten. */
const functies = require('./functies');
app.use((req, res, next) => {
  const p = req.path;
  if (!p.startsWith('/api/')) return next();
  if (p.startsWith('/api/techniek') || p === '/api/health' || p === '/api/ready') return next();
  const staat = db.data && db.data.techniek && db.data.techniek.functies;
  if (!staat) return next(); // niets uitgezet: alles staat aan
  // De doelgroep van dit verzoek: uit het pad (leverancier/personeel/intern/
  // foundation) of uit de pas van het ingelogde lid (RTG/Lifestyle/Business).
  let user = null;
  try {
    const tok = (req.get('authorization') || '').replace(/^Bearer\s+/i, '') || (req.body && req.body.token) || req.query.token;
    if (tok) user = accounts.verifyToken(tok);
  } catch (e) {}
  const doelgroep = functies.doelgroepVanVerzoek(p, user);
  const dicht = functies.padGeblokkeerd(p, staat, doelgroep);
  if (dicht) {
    const globaalUit = !functies.functieAan(dicht.id, staat);
    return res.status(503).json({
      error: globaalUit ? 'Deze functie is tijdelijk uitgeschakeld door de beheerder.'
        : 'Deze functie is voor jouw profiel uitgeschakeld door de beheerder.',
      functie: dicht.id, naam: dicht.naam, doelgroep: doelgroep || undefined
    });
  }
  next();
});

// RTFoundation-app: gratis, open onderwijs voor gezinnen met weinig geld
// (live schoolbord + leerling-schrift + AI-bijles). Aparte router-module,
// draait mee op dezelfde database en failover.
const rtf = require('./foundation');
app.use('/api/foundation', rtf.router);
// een gezinsmelding voor een gekoppelde oppas/familie ook als telefoonmelding (web-push)
rtf.setPushHook((userId, note) => { try { sendPushToUser(userId, note); } catch (e) {} });

/* Strengere CSP voor de app-pagina's: geen 'unsafe-inline' voor scripts, maar
   een per-antwoord nonce. We lezen het .html-bestand, geven elke <script> die
   nonce mee en zetten de CSP navenant. De apps gebruiken addEventListener (geen
   inline on-handlers), dus dit werkt zonder ze om te bouwen en sluit de deur
   voor ingespoten scripts. Uit te zetten met RTG_CSP_NONCE=0. Losse statische
   pagina's (bijv. 404) vallen terug op de gewone CSP hierboven. */
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CSP_NONCE = process.env.RTG_CSP_NONCE !== '0';
app.use((req, res, next) => {
  if (!CSP_NONCE || req.method !== 'GET') return next();
  let rel = req.path;
  if (rel.endsWith('/')) rel += 'index.html';
  if (!rel.endsWith('.html')) return next();
  const bestand = path.join(PUBLIC_DIR, rel);
  if (!bestand.startsWith(PUBLIC_DIR + path.sep)) return next(); // geen path traversal
  fs.readFile(bestand, 'utf8', (err, html) => {
    if (err) return next(); // bestaat niet: laat de statische laag/404 het doen
    const nonce = crypto.randomBytes(16).toString('base64');
    html = html.replace(/<script(?![^>]*\bnonce=)/g, '<script nonce="' + nonce + '"');
    res.set('Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'nonce-" + nonce + "'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' data: blob:; " +
      "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
    res.type('html').send(html);
  });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

/* ---------- Claude API (optioneel) ---------- */

let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropic = new Anthropic();
    i18n.setAnthropic(anthropic);
    console.log('Persoonlijke AI: Claude API actief (claude-opus-4-8).');
  } catch (e) {
    console.warn('ANTHROPIC_API_KEY gevonden maar @anthropic-ai/sdk ontbreekt, demo-antwoorden actief.');
  }
} else {
  console.log('Persoonlijke AI: demo-antwoorden (zet ANTHROPIC_API_KEY voor echte Claude).');
}

/* ---------- personas & sessies ---------- */

/* Codenaam: elke klant krijgt een pseudoniem. Reserveringen, betalingen en
   reisdata staan in onze systemen op de codenaam; de echte naam ligt in een
   gescheiden kluis en wordt pas bij ticketing/check-in eenmalig gekoppeld.
   Wordt reisdata ooit gestolen, dan heeft de aanvaller nooit de juiste naam. */
const PERSONAS = {
  guest:     { name: 'Gast',         full: 'Gast',               since: null,             number: null,                codename: 'GAST' },
  rtg:       { name: 'K. Kiss',    full: 'Katja Kiss',    since: 'Maart 2026',     number: 'RTG · 2026 · 8841', codename: 'Amberen Vos',      geboren: '1994-09-14' },
  lifestyle: { name: 'F. Johanna', full: 'Fleur Johanna', since: 'Augustus 2025',  number: 'LSP · 2025 · 0217', codename: 'Gouden Ibis',      geboren: '1957-02-20' },
  business:  { name: 'R. Imran',   full: 'Rahul Imran',   since: 'November 2025',  number: 'BSP · 2025 · 1104', codename: 'Noordelijke Ster', geboren: '1992-11-30' }
};

/* ---------- leeftijd uit het paspoort ----------
   Elke pas wordt met paspoort aangevraagd, dus de leeftijd van een lid is
   geverifieerd. Die stuurt functies: 15-17 (jeugdlid: geen alcohol, geen
   privejet, altijd vooraf betalen), 18-21 (alcohol volgt de landsgrens van de
   zaak, bijvoorbeeld 20 in Japan) en 21+. Partners zien nooit de
   geboortedatum, hooguit dat de leeftijd geverifieerd is. */
// Zuivere leeftijdshulp zit nu in server/lib/leeftijd.js.
const leeftijdlib = require('./lib/leeftijd');
const leeftijdVan = leeftijdlib.leeftijdVan;
const leeftijdsgroepVan = leeftijdlib.leeftijdsgroepVan;
function geborenVan(sess) {
  if (!sess) return null;
  // een echt account (ook de gratis laag) heeft een paspoort-geboortedatum
  if (sess.account) return (accounts.getMemberState(sess.account.id) || {}).geboren || null;
  if (sess.tier === 'guest') return null; // anonieme demo-gast heeft geen paspoort
  return (PERSONAS[sess.tier] || {}).geboren || null;
}
// de alcoholgrens volgt het land van de zaak (LANDEN staat verderop)
function alcoholGrensVan(s) {
  const land = LANDEN[(s.settings && s.settings.land) || 'NL'] || LANDEN.NL;
  return { grens: land.alcoholLeeftijd || 18, land: land.naam };
}

// sha256(token) -> { tier, key }. In-memory voor snelheid, gespiegeld in
// db.json zodat ingelogde gebruikers een serverherstart overleven.
// Alleen de hash wordt bewaard: wie db.json in handen krijgt, heeft daarmee
// nog geen bruikbare tokens. Sessies verlopen na 30 dagen zonder gebruik.
// De sessie-opslag (Map + hash + remember/forget/lookup) zit in een
// maak…(state)-fabriek; de Map komt terug zodat het herstel-/migratiepad in
// initRealtime er ongewijzigd op blijft werken.
const { maakSessies } = require('./kern/sessies');
const { sessions, tokenHash, rememberSession, forgetSession, sessionFor, TOKEN_TTL_MS } =
  maakSessies({ db, save, crypto });

/* Inlogpogingen afremmen: per bron en doel hooguit tien mislukkingen,
   daarna vijf minuten wachten. Geldt voor wachtwoorden en toegangscodes. */
const loginFails = new Map(); // bucket -> { n, until }
function tooManyTries(res, bucket) {
  const f = loginFails.get(bucket);
  if (f && f.until > Date.now()) {
    res.status(429).json({ error: 'Te veel pogingen. Probeer het over een paar minuten opnieuw.' });
    return true;
  }
  return false;
}
function noteFailedTry(bucket) {
  const f = loginFails.get(bucket) || { n: 0, until: 0 };
  f.n += 1;
  if (f.n >= 10) {
    f.until = Date.now() + 5 * 60000; f.n = 0;
    // de rate-limit sloeg aan: dit ziet eruit als brute force op een inlog
    if (beveilig) beveilig.meld('brute-force', 'kritiek',
      'Te veel mislukte inlogpogingen (' + String(bucket).split(':')[0] + '). De inlog is tijdelijk op slot gezet; mogelijk een brute-force-aanval.',
      { bron: bucket });
  }
  loginFails.set(bucket, f);
}

/* ---------- demo-account: één inlog (Rahul / Imran) voor elk kanaal ----------
   Zo kunt u het klantportaal, de leverancier-app en het personeelskanaal met
   dezelfde gebruikersnaam en wachtwoord uitproberen. De gebruikersnaam is
   hoofdletterongevoelig, het wachtwoord niet. */
const DEMO_USER = (process.env.DEMO_USER || 'rahul').trim().toLowerCase();
const DEMO_PASS = process.env.DEMO_PASS || 'Imran';
const DEMO_SUPPLIER = process.env.DEMO_SUPPLIER || 'KIKUNOI';
function hasCred(body) { return !!body && (body.username != null || body.password != null); }
function checkCred(username, password) {
  return String(username || '').trim().toLowerCase() === DEMO_USER && String(password || '') === DEMO_PASS;
}

/* ---------- live updates (SSE) + notificaties + web-push ----------
   Elk open scherm (website-portaal of app) houdt een SSE-verbinding open.
   Bij elke wijziging sturen we:
   - 'sync'   → betrokken schermen herladen hun data zonder page-refresh
   - 'notify' → een notificatie voor de eigenaar van een post/betaling,
     ook als web-push wanneer het scherm dicht is. */

let webpush = null;
try { webpush = require('web-push'); } catch (e) { /* zonder push: alleen SSE */ }

// welke persona hoort bij een auteursnaam (voor gerichte notificaties)
const AUTHOR_TIER = {
  'Katja Kiss': 'rtg',
  'Fleur Johanna': 'lifestyle',
  'Rahul Imran': 'business'
};

/* Realtime-bus: zonder REDIS_URL in-proces (huidig gedrag), met REDIS_URL via
   Redis pub/sub zodat live-events ook gebruikers op een ander domeinproces
   bereiken. Elke sseTo*-functie publiceert; elk proces levert de events af aan
   zijn eigen open verbindingen. */
const bus = require('./bus').maakBus();

/* De realtime-afleverlaag (open verbindingen + terugspeelbuffer + id-teller)
   zit in een maak…(state)-fabriek; de fabriek abonneert leverSse zelf op de bus
   en geeft dezelfde clients-array/buffer-Map terug, zodat de routes en het
   onderhoudslus er ongewijzigd op werken. */
const { maakSse } = require('./kern/sse');
const { sseClients, sseBuffer, nextSseId, bufferEvent, speelOpnieuw, leverSse, sseSend, ruimBuffer, SSE_BUFFER_TTL } =
  maakSse({ bus });

// Geo-rekenhulp zit in een eigen, zuivere module (server/lib/geo.js).
const geo = require('./lib/geo');
const toRad = geo.toRad;
const haversine = geo.haversine;
const etaMinutes = geo.etaMinutes;

/* De live-/geo-laag (sseToCustomer, liveCodename, connectedSupplierCodes,
   pushLive, liveStateFor, guestsFor) staat in server/kern/live.js. Vroeg
   opgezet omdat de sociale kern hieronder al sseToCustomer nodig heeft. De
   functies dragen db, de bus, de SSE-routers, geo-helpers en i18n;
   sseToSupplier, sseToOffice en findSupplier zijn hoisted functies. */
const { sseToCustomer, liveCodename, connectedSupplierCodes, pushLive, liveStateFor, guestsFor } =
  maakLive({ db, bus, nextSseId, PERSONAS, sseToSupplier, sseToOffice, findSupplier, haversine, etaMinutes, i18n });
// Bij gedeelde data (Redis): na een externe wijziging de sessie-index opnieuw
// vullen, zodat een lezersproces tokens kent die de schrijver net aanmaakte.
onExternalChange(() => {
  _ledenAantalCache = null; // externe wijziging: ledental opnieuw bepalen
  if (!db.data || !db.data.sessions) return;
  for (const [t, s] of Object.entries(db.data.sessions)) sessions.set(t, s);
});

/* Alles wat elk partnerbedrijf standaard nodig heeft; wordt gebruikt voor
   bestaande bedrijven (migratie bij opstarten) en voor nieuwe partners die
   via de onboarding worden goedgekeurd. */
/* Ledenprijsgarantie (partnervoorwaarden): een lid betaalt bij een partner nooit
   meer dan de eigen publieke prijs van die partner. De publieke prijs is de
   referentie (het plafond); de ledenprijs wordt daar altijd op afgekapt. Dit
   wordt op drie plekken afgedwongen: bij het normaliseren van een menukaart,
   bij het opslaan ervan, en nog eens bij het plaatsen van een bestelling. */

function ensureSupplierDefaults(s) {
  if (!Array.isArray(s.menu)) s.menu = [];
  // De ophaal/bezorgdienst: horeca en zelfstandigen kunnen een eigen
  // bezorg-assortiment voeren, los van de menukaart ter plaatse.
  if (!s.bezorg || typeof s.bezorg !== 'object') s.bezorg = { aan: false, ophalen: true, bezorgen: true, producten: [] };
  if (s.type === 'activiteit' && !Array.isArray(s.activiteiten)) s.activiteiten = [];
  // de eigen transferdienst: prijs 0 = inclusief bij het ticket, anders het
  // afgesproken vaste bedrag per rit
  if (s.type === 'activiteit' && (!s.transfer || typeof s.transfer !== 'object')) s.transfer = { aan: false, prijs: 0 };
  if (s.type === 'verhuur' && !Array.isArray(s.autos)) s.autos = [];
  if (s.type === 'vastgoed' && !Array.isArray(s.panden)) s.panden = [];
  if (!Array.isArray(s.bezorg.producten)) s.bezorg.producten = [];
  if (!Array.isArray(s.photos)) s.photos = [];
  if ((s.type === 'hotel' || s.type === 'apartment') && !Array.isArray(s.rooms)) s.rooms = [];
  if (s.type === 'apartment' && !Array.isArray(s.doors)) s.doors = [];
  if ((s.type === 'hotel' || s.type === 'apartment') && !Array.isArray(s.minibar))
    s.minibar = [
      { id: 'mb1', name: 'Mineraalwater', price: 5 },
      { id: 'mb2', name: 'Frisdrank', price: 6 },
      { id: 'mb3', name: 'Mini-drank', price: 12 },
      { id: 'mb4', name: 'Snack', price: 7 }
    ];
  for (const r of (s.rooms || [])) if (!r.hk) r.hk = { status: 'schoon' };
  if (!s.settings) s.settings = { ordersOpen: true, reservationsOpen: true };
  // land van het bedrijf (voor btw, alcoholgrens en het zoeken op land in de
  // RTFoundation-vacatures). RTG is internationaal; onze demopartners staan op
  // Ibiza en horen dus bij Spanje.
  if (!s.settings.land) s.settings.land = /ibiza|spanje|spain|españa/i.test(s.city || '') ? 'ES' : 'NL';
  const caps = ((db.data.supplierTypes || {})[s.type] || {}).caps || [];
  if (caps.includes('menu') && !Array.isArray(s.tables))
    s.tables = [1, 2, 3, 4, 5, 6].map(n => ({ id: 't' + n, name: 'Tafel ' + n, seats: n % 3 === 0 ? 6 : n % 2 === 0 ? 4 : 2, status: 'vrij' }));
  // horecazaken kunnen events organiseren (het Kantoor maakt ze, leden melden zich aan)
  if (['restaurant', 'bar', 'club'].includes(s.type) && !Array.isArray(s.events)) s.events = [];
  if (['restaurant', 'bar', 'club'].includes(s.type) && !s.dailyMeps) s.dailyMeps = {}; // dagelijkse mise en place (a la carte)
  for (const e of (s.events || [])) {
    if (!Array.isArray(e.runsheet)) e.runsheet = [];
    for (const it of e.runsheet) if (typeof it.daysBefore !== 'number') it.daysBefore = 0;
    if (!e.catering) e.catering = { mode: 'geen', itemIds: [], note: '' };
    if (!Array.isArray(e.allergies)) e.allergies = [];
  }
  // elk gerecht hoort bij een werkplek: de keuken of de bar; de manager kan
  // dit per item omzetten onder Menu. Bars/clubs bereiden standaard aan de bar.
  for (const m of (s.menu || [])) {
    // ledenprijsgarantie: publieke prijs als referentie, ledenprijs nooit hoger
    if (typeof m.publiekePrijs !== 'number' || m.publiekePrijs < 0) m.publiekePrijs = Math.max(0, Number(m.price) || 0);
    m.price = ledenPrijs(m.publiekePrijs, m.price);
    if (m.station !== 'keuken' && m.station !== 'bar')
      m.station = (s.type === 'bar' || s.type === 'club') ? 'bar' : 'keuken';
    // binnen de keuken: de sectie (warme kant, koude kant, snacks, dessert)
    if (m.station === 'keuken' && !['warm', 'koud', 'snack', 'dessert'].includes(m.sectie)) {
      const t = ((m.cat || '') + ' ' + (m.name || '') + ' ' + (m.desc || '')).toLowerCase();
      m.sectie = /dessert|zoet|wagashi|matcha|ijs|patisserie|sweet|taart/.test(t) ? 'dessert'
        : /sashimi|salade|koud|tartaar|carpaccio|oester|ceviche/.test(t) ? 'koud'
        : /snack|bites|friet|fries|nacho|bitterbal|kroket/.test(t) ? 'snack' : 'warm';
    }
  }
  if (typeof s.rate !== 'number') s.rate = 0.12;
  // vervoerders: een vloot en een tarief, zodat elke rit direct een vaste
  // nettoprijs krijgt en het kantoor voertuigen aan chauffeurs kan koppelen
  const caps2 = (db.data.supplierTypes[s.type] || {}).caps || [];
  if (caps2.includes('rides')) {
    if (!Array.isArray(s.fleet)) s.fleet = s.type === 'jet'
      ? [{ id: 'v1', name: 'Cessna Citation XLS', plate: 'PH-RTG', seats: 8, active: true },
         { id: 'v2', name: 'Embraer Phenom 300', plate: 'PH-RTE', seats: 9, active: true }]
      : [{ id: 'v1', name: 'Mercedes S-klasse', plate: 'RT-01-GX', seats: 3, active: true },
         { id: 'v2', name: 'Mercedes V-klasse', plate: 'RT-02-GX', seats: 6, active: true }];
    s.settings = s.settings || {};
    if (!s.settings.tarief) s.settings.tarief = s.type === 'jet'
      ? { start: 0, perKm: 9, minimum: 7500 }
      : { start: 15, perKm: 2.4, minimum: 25 };
  }
  // verplicht onderdeel van elk RTG-partnerschap: een bedrijfsaccount op De
  // Salon, met volgers en marketinggereedschap (aanbiedingen, polls, cijfers)
  if (!s.salon) s.salon = { bio: '', volgers: [], sinds: new Date().toISOString() };
  if (!Array.isArray(s.salon.volgers)) s.salon.volgers = [];
}

function initRealtime() {
  if (!db.data.sessions) db.data.sessions = {};
  // migratie: sessies van voor de token-hashing (ruwe tokens, 48 tekens)
  // worden eenmalig omgezet naar hun sha256-sleutel, zodat niemand uitlogt
  let migrated = false;
  for (const [t, s] of Object.entries(db.data.sessions)) {
    if (t.length !== 64) { db.data.sessions[tokenHash(t)] = s; delete db.data.sessions[t]; migrated = true; }
  }
  if (migrated) save();
  for (const [t, s] of Object.entries(db.data.sessions)) if (!sessions.has(t)) sessions.set(t, s);
  if (!db.data.notifications) db.data.notifications = { rtg: [], lifestyle: [], business: [] };
  if (!db.data.pushSubs) db.data.pushSubs = { rtg: [], lifestyle: [], business: [] };
  if (!db.data.pushSubsUser) db.data.pushSubsUser = {}; // per account: userId -> [subscriptions]
  if (!db.data.supplierNotifications) db.data.supplierNotifications = {};
  if (!db.data.supplierActivity) db.data.supplierActivity = {};   // wie deed wat, per bedrijf
  if (!db.data.supplierTeam) db.data.supplierTeam = {};           // interne teamchat, per bedrijf
  if (!db.data.live) db.data.live = {};                           // live "onderweg"-toestand per lid (customerKey)
  if (!db.data.partnerApplications) db.data.partnerApplications = []; // bedrijven die partner willen worden
  // sector-features: elke partner een fotopagina, hotels/appartementen kamers
  for (const s of db.data.suppliers) ensureSupplierDefaults(s);
  if (!db.data.minibarCounts) db.data.minibarCounts = {};          // minibartellingen per bedrijf
  if (!db.data.tickets) db.data.tickets = {};                      // klussen/onderhoud per bedrijf
  if (!db.data.lostfound) db.data.lostfound = {};                  // gevonden voorwerpen per bedrijf
  // (kamers, instellingen en tafels zitten in ensureSupplierDefaults)
  // oudere databases: appartement-partner en doors-cap toevoegen
  if (db.data.supplierTypes.apartment && !db.data.supplierTypes.apartment.caps.includes('doors'))
    db.data.supplierTypes.apartment.caps.splice(1, 0, 'doors');
  if (!db.data.suppliers.find(s => s.code === 'SAKURA')) {
    db.data.suppliers.push({
      code: 'SAKURA', name: 'Villa Bahia Ibiza', type: 'apartment', city: 'Ibiza',
      loc: { lat: 38.876, lng: 1.325, label: 'Cala Jondal, Ibiza' }, rate: 0.12,
      menu: [], photos: [],
      rooms: [
        { id: 'a1', name: 'Casa Mar, zeezijde', desc: '65 m², eigen entree, plunge pool', price: 430, available: true },
        { id: 'a2', name: 'Casa Jardin, tuinzijde', desc: '90 m², twee slaapkamers, terras', price: 560, available: true }
      ],
      doors: [
        { id: 'd1', name: 'Voordeur (oprit)', locked: true },
        { id: 'd2', name: 'Casa Mar', locked: true },
        { id: 'd3', name: 'Casa Jardin', locked: true },
        { id: 'd4', name: 'Poolhouse', locked: true }
      ]
    });
  }
  if (!db.data.posSales) db.data.posSales = {};                   // kassaverkopen per bedrijf
  // het zzp-genre: zelfstandige professionals (mode, health, fotografie...)
  // bieden diensten en producten aan; leden boeken met datum en tijd
  if (!db.data.supplierTypes.zzp)
    db.data.supplierTypes.zzp = { label: 'Zelfstandig professional', icon: '🧑‍🎨', caps: ['services', 'location', 'pricing'] };
  if (!db.data.boekingen) db.data.boekingen = [];
  if (!db.data.suppliers.find(s => s.code === 'AYAKA')) {
    db.data.suppliers.push({
      code: 'AYAKA', name: 'Atelier Marfil', type: 'zzp', city: 'Ibiza', vak: 'Sieraden & goudsmid',
      loc: { lat: 38.909, lng: 1.435, label: 'Dalt Vila, Ibiza' }, rate: 0.1,
      menu: [], photos: [],
      services: [
        { id: 's1', name: 'Sieraad op maat, ontwerpsessie', desc: 'Twee uur in het atelier of op de suite, incl. schetsontwerp', price: 240, duurMin: 120, soort: 'dienst' },
        { id: 's2', name: 'Gouden ring, handgesmeed', desc: 'Op maat gesmeed, binnen de vakantie geleverd', price: 520, duurMin: 360, soort: 'dienst' },
        { id: 's3', name: 'Zilveren hanger, uit voorraad', desc: 'Uit eigen atelier, geleverd op de suite', price: 85, soort: 'product' }
      ]
    });
  }
  if (!db.data.suppliers.find(s => s.code === 'KAITO')) {
    db.data.suppliers.push({
      code: 'KAITO', name: 'Studio Milan', type: 'zzp', city: 'Ibiza', vak: 'Health & wellness',
      loc: { lat: 38.972, lng: 1.416, label: 'Ibiza-stad, haven' }, rate: 0.1,
      menu: [], photos: [],
      services: [
        { id: 's1', name: 'Personal training, privesessie', desc: 'In de hotelgym of buiten, incl. programma op maat', price: 110, duurMin: 60, soort: 'dienst' },
        { id: 's2', name: 'Sportmassage, 60 minuten', desc: 'Op de kamer; tafel en olien inbegrepen', price: 95, duurMin: 60, soort: 'dienst' },
        { id: 's3', name: 'Voedingsplan op maat, per week', desc: 'Afgestemd op reisschema en de keukens onderweg', price: 150, soort: 'product' }
      ]
    });
  }
  // het activiteiten-genre: tours, musea en experiences verkopen tickets met
  // tijdsloten en capaciteit; personeel (gids/security/balie) checkt de
  // entreecode af aan de deur, op eigen naam
  if (!db.data.supplierTypes.activiteit)
    db.data.supplierTypes.activiteit = { label: 'Activiteiten & musea', icon: '\u{1F39F}\uFE0F', caps: ['tickets', 'rides', 'location', 'pricing'] };
  // eigen transferdienst: activiteitenzaken rijden ook (migratie voor bestaande kasten)
  if (db.data.supplierTypes.activiteit && !db.data.supplierTypes.activiteit.caps.includes('rides'))
    db.data.supplierTypes.activiteit.caps.push('rides');
  if (!db.data.suppliers.find(s => s.code === 'ESVEDRA')) {
    db.data.suppliers.push({
      code: 'ESVEDRA', name: 'Es Vedra Cruises', type: 'activiteit', city: 'Ibiza',
      loc: { lat: 38.867, lng: 1.196, label: 'Cala d\'Hort, Ibiza' }, rate: 0.14,
      menu: [], photos: [],
      activiteiten: [
        { id: 'a1', name: 'Sunset cruise met cava', desc: 'Twee uur varen langs Es Vedra, cava en tapas aan boord.', prijs: 79, capaciteit: 24, duur: '2 uur', tijden: ['17:30', '19:30'] },
        { id: 'a2', name: 'Snorkeltocht drie baaien', desc: 'Kleine boot, maximaal tien gasten, materiaal inbegrepen.', prijs: 55, capaciteit: 10, duur: '3 uur', tijden: ['10:00', '14:00'] }
      ]
    });
  }
  if (!db.data.suppliers.find(s => s.code === 'MACE')) {
    db.data.suppliers.push({
      code: 'MACE', name: 'MACE Museum Eivissa', type: 'activiteit', city: 'Ibiza',
      loc: { lat: 38.907, lng: 1.436, label: 'Dalt Vila, Ibiza' }, rate: 0.12,
      menu: [], photos: [],
      activiteiten: [
        { id: 'a1', name: 'Entree museum', desc: 'Hedendaagse kunst in het hart van Dalt Vila.', prijs: 12, capaciteit: 80, duur: 'vrij bezoek', tijden: ['10:00', '12:00', '14:00', '16:00'] },
        { id: 'a2', name: 'Rondleiding met gids', desc: 'Een uur langs de hoogtepunten, kleine groep.', prijs: 24, capaciteit: 15, duur: '1 uur', tijden: ['11:00', '15:00'] }
      ]
    });
  }
  // het autoverhuur-genre: eerlijk huren tegenover de schimmige verhuurders.
  // De staat van de auto wordt VOOR en NA de huur met foto's vastgelegd (door
  // beide partijen, onveranderbaar), er is een SOS-knop tijdens de huur, en de
  // huurder kan vrijwillig zijn live locatie delen. Vaste dagprijs, geen
  // verrassingen aan de balie.
  if (!db.data.supplierTypes.verhuur)
    db.data.supplierTypes.verhuur = { label: 'Autoverhuur', icon: '\u{1F697}', caps: ['huur', 'location', 'pricing'] };
  if (!db.data.suppliers.find(s => s.code === 'ISLAREN')) {
    db.data.suppliers.push({
      code: 'ISLAREN', name: 'Isla Rent Ibiza', type: 'verhuur', city: 'Ibiza',
      loc: { lat: 38.912, lng: 1.442, label: 'Ibiza-stad, haven' }, rate: 0.12,
      menu: [], photos: [],
      autos: [
        { id: 'c1', name: 'Fiat 500 Cabrio', plate: 'IB-501-C', dagprijs: 49, actief: true,
          categorie: 'Compact cabrio', transmissie: 'handgeschakeld', brandstof: 'benzine', stoelen: 4, deuren: 2,
          airco: true, bagage: 1, kmPerDag: 200, meerKm: 0.25, borg: 300, minLeeftijd: 21, icoon: '\uD83D\uDE97' },
        { id: 'c2', name: 'Mini Cooper Cabrio', plate: 'IB-207-M', dagprijs: 69, actief: true,
          categorie: 'Premium cabrio', transmissie: 'automaat', brandstof: 'benzine', stoelen: 4, deuren: 2,
          airco: true, bagage: 2, kmPerDag: 250, meerKm: 0.30, borg: 500, minLeeftijd: 23, icoon: '\uD83D\uDE99' },
        { id: 'c3', name: 'Jeep Wrangler', plate: 'IB-330-J', dagprijs: 95, actief: true,
          categorie: 'SUV 4x4', transmissie: 'automaat', brandstof: 'diesel', stoelen: 5, deuren: 4,
          airco: true, bagage: 3, kmPerDag: 0, meerKm: 0, borg: 800, minLeeftijd: 25, icoon: '\uD83D\uDE99' }
      ]
    });
  }
  // het helikopter-genre: premium transfers en scenic vluchten met eigen
  // helikopters en piloten. Verloopt via dezelfde ritketen (aanvraag, toewijzen,
  // onderweg, gearriveerd) met slimme toewijzing van piloot en toestel; 18+ zoals
  // de privejet, en de piloot bevestigt weer en helipad voor het opstijgen.
  if (!db.data.supplierTypes.helikopter)
    db.data.supplierTypes.helikopter = { label: 'Helikopter transfers', icon: '\u{1F681}', caps: ['rides', 'fleet', 'location', 'pricing'] };
  if (!db.data.suppliers.find(s => s.code === 'IBIZAIR')) {
    db.data.suppliers.push({
      code: 'IBIZAIR', name: 'Ibiza Sky Charter', type: 'helikopter', city: 'Ibiza',
      loc: { lat: 38.872, lng: 1.373, label: 'Aeropuerto de Ibiza, helipad' }, rate: 0.1,
      menu: [], photos: [],
      settings: { tarief: { start: 900, perKm: 28, minimum: 1200 }, ritten: true, betaalVooraf: true },
      fleet: [
        { id: 'h1', name: 'Airbus H125 Ecureuil', model: 'H125', plate: 'EC-IBZ', seats: 5, active: true, thuisbasis: 'Ibiza Airport', bereikKm: 600, icoon: '\u{1F681}' },
        { id: 'h2', name: 'Bell 429', model: 'B429', plate: 'EC-SKY', seats: 6, active: true, thuisbasis: 'Marina Botafoch', bereikKm: 720, icoon: '\u{1F681}' }
      ],
      helipads: [
        { id: 'p-air', naam: 'Ibiza Airport helipad', plaats: 'Sant Josep' },
        { id: 'p-mar', naam: 'Marina Botafoch', plaats: 'Ibiza-stad' },
        { id: 'p-form', naam: 'Formentera (La Savina)', plaats: 'Formentera' }
      ]
    });
  }
  if (!db.data.huurFotos) db.data.huurFotos = {};       // ref -> { voor: [], na: [] } (los van de boeking: fotodata blijft uit de staat)
  if (!db.data.huurLocaties) db.data.huurLocaties = {}; // ref -> { aan, lat, lng, at } (vrijwillig gedeeld door de huurder)
  // contracten: elke zaak kan een contract (verhuur/personeel/algemeen) opstellen
  // en aan een lid of personeelslid sturen; beide partijen tekenen digitaal
  if (!db.data.contracten) db.data.contracten = [];
  // het vastgoed-genre: makelaars bieden hun aanbod aan, gericht aan gekozen
  // leden (via de Salon of prive), met biedingen, bezichtigingen en keyless
  // toegang, en snelle contracten via het contractsysteem
  if (!db.data.supplierTypes.vastgoed)
    db.data.supplierTypes.vastgoed = { label: 'Vastgoed & makelaar', icon: '\u{1F3E1}', caps: ['vastgoed', 'location', 'pricing'] };
  if (!db.data.suppliers.find(s => s.code === 'IBIZALIV')) {
    db.data.suppliers.push({
      code: 'IBIZALIV', name: 'Ibiza Living Estates', type: 'vastgoed', city: 'Ibiza',
      loc: { lat: 38.906, lng: 1.433, label: 'Vara de Rey, Ibiza' }, rate: 0.03,
      menu: [], photos: [],
      panden: [
        { id: 'p1', titel: 'Villa Can Blau, zeezicht', soort: 'villa', transactie: 'koop', prijs: 3450000,
          plaats: 'Cala Jondal, Ibiza', adres: 'Carrer de Cala Jondal 8', slaapkamers: 5, badkamers: 4, oppervlakte: 420, perceel: 1800,
          tuin: true, zwembad: true, garage: 2, energielabel: 'A', status: 'beschikbaar',
          omschrijving: 'Moderne villa met infinity pool, gastenverblijf en panoramisch zeezicht over Es Vedra.', fotos: [], keyless: true },
        { id: 'p2', titel: 'Penthouse Marina Botafoch', soort: 'appartement', transactie: 'koop', prijs: 1290000,
          plaats: 'Marina Botafoch, Ibiza', adres: 'Passeig Joan Carles I 21', slaapkamers: 3, badkamers: 2, oppervlakte: 165, perceel: 0,
          tuin: false, zwembad: true, garage: 1, energielabel: 'B', status: 'beschikbaar',
          omschrijving: 'Penthouse met dakterras, gemeenschappelijk zwembad en jachthavenzicht.', fotos: [], keyless: true },
        { id: 'p3', titel: 'Finca met olijfgaard', soort: 'woning', transactie: 'huur', prijs: 8500,
          plaats: 'Santa Gertrudis, Ibiza', adres: 'Cami de Sa Vinya 4', slaapkamers: 4, badkamers: 3, oppervlakte: 300, perceel: 12000,
          tuin: true, zwembad: true, garage: 0, energielabel: 'C', status: 'beschikbaar',
          omschrijving: 'Authentieke finca, per maand te huur, midden in het groen met eigen olijfgaard.', fotos: [], keyless: false }
      ]
    });
  }
  if (!db.data.vastgoedAanbod) db.data.vastgoedAanbod = [];   // { ref, supplierCode, pandId, aanKeys:[], publiek, at }
  if (!db.data.bezichtigingen) db.data.bezichtigingen = [];   // { ref, supplierCode, pandId, key, codename, wens, status, moment, keyless, at }
  if (!db.data.biedingen) db.data.biedingen = [];             // { ref, supplierCode, pandId, key, codename, bedrag, status, tegenbod, at }

  // Salon-connecties: leden vinden elkaar op codenaam, chatten en bellen 1-op-1
  if (!db.data.connections) db.data.connections = [];              // { a, b, requestedBy, status, at }
  if (!db.data.memberChats) db.data.memberChats = {};              // 'sleutelA|sleutelB' -> { messages, read }
  if (!db.data.memberDir) db.data.memberDir = {};                  // sleutel -> { codename, tier }
  for (const t of GIDS_SEED_TIERS)
    if (!db.data.memberDir[t]) db.data.memberDir[t] = { codename: PERSONAS[t].codename, tier: t };
  if (!db.data.guestChats) db.data.guestChats = {};               // gastchats: lid <-> partner (roomservice, eigenaar)
  if (!db.data.trustLine) db.data.trustLine = [];                  // vertrouwenslijn: staflid <-> RTG-vertrouwenspersoon (werkgever ziet niets)
  if (!db.data.giftcards) db.data.giftcards = [];                  // cadeaukaarten per zaak (btw pas bij inwisseling)
  if (!db.data.verlof) db.data.verlof = {};                        // verlofaanvragen en ziekmeldingen per bedrijf
  if (!db.data.klok) db.data.klok = {};                            // in- en uitkloktijden per bedrijf
  if (!db.data.applications) db.data.applications = {};            // sollicitaties per bedrijf
  if (!db.data.vacatures) db.data.vacatures = {};                  // openstaande vacatures per bedrijf (ook zichtbaar in de RTFoundation)
  if (!db.data.applyChats) db.data.applyChats = {};                // chat tussen sollicitant en werkgever (na uitnodigen/aannemen)
  if (!db.data.snaps) db.data.snaps = [];                          // Snapchat-achtige snaps: foto die na bekijken verdwijnt
  if (!db.data.stories) db.data.stories = [];                      // 24-uurs verhalen, zichtbaar voor vrienden
  if (!db.data.blocks) db.data.blocks = [];                        // { door, doel, at } geblokkeerde codenamen (beide kanten dicht)
  if (!db.data.reports) db.data.reports = [];                      // { door, doel, reden, at } meldingen van misbruik voor de backoffice
  if (!db.data.cvs) db.data.cvs = {};                               // cv per lid (cv-builder in de leden-app)
  if (webpush) {
    if (!db.data.vapid) {
      db.data.vapid = webpush.generateVAPIDKeys();
      save();
    }
    webpush.setVapidDetails('mailto:leden@rahultravelgroup.example', db.data.vapid.publicKey, db.data.vapid.privateKey);
  }
}

// stuur een sync-signaal naar één of meer tiers (open schermen herladen data)
function broadcastSync(tiers, scope) {
  bus.publish('sse', { doel: 'tier', match: [...tiers], event: 'sync', data: { scope } });
}

// notificeer één tier: opslaan, naar open schermen sturen én web-push
function notify(tier, note) {
  const n = { id: crypto.randomBytes(4).toString('hex'), read: false, at: new Date().toISOString(), ...note };
  db.data.notifications[tier] = (db.data.notifications[tier] || []);
  db.data.notifications[tier].unshift(n);
  db.data.notifications[tier] = db.data.notifications[tier].slice(0, 40);
  save();
  bus.publish('sse', { doel: 'tier', match: [tier], event: 'notify', data: n });
  sendPush(tier, n);
  return n;
}

// push naar één specifiek account (voor persoonlijke meldingen, bijv. van de RTFoundation)
function sendPushToUser(userId, note) {
  if (!webpush || userId == null) return;
  const subs = (db.data.pushSubsUser[userId] || []).slice();
  if (!subs.length) return;
  const payload = JSON.stringify({ title: note.title, body: note.body, icon: '/icon.svg', tag: note.tag });
  for (const sub of subs) {
    webpush.sendNotification(sub, payload).catch(err => {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        db.data.pushSubsUser[userId] = (db.data.pushSubsUser[userId] || []).filter(s => s.endpoint !== sub.endpoint);
        save();
      }
    });
  }
}

function sendPush(tier, note) {
  if (!webpush) return;
  const subs = db.data.pushSubs[tier] || [];
  const payload = JSON.stringify({ title: note.title, body: note.body, icon: '/icon.svg', tag: note.id });
  for (const sub of subs.slice()) {
    webpush.sendNotification(sub, payload).catch(err => {
      // verlopen/ongeldige subscription opruimen
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        db.data.pushSubs[tier] = (db.data.pushSubs[tier] || []).filter(s => s.endpoint !== sub.endpoint);
        save();
      }
    });
  }
}

/* Beveiligingsmeldingen (inbraakdetectie) voor het technische bord. Een kritieke
   melding gaat meteen naar de eigenaar: web-push op zijn telefoon en een e-mail. */
function eigenaarAccount() {
  try { return accounts.findByLogin(process.env.RTG_OWNER_EMAIL || 'rahul@rtg.example'); } catch (e) { return null; }
}
/* De archiefkast: houdt de levende kast klein door afgeronde tickets ouder
   dan een afgesloten kwartaal naar append-only maandbestanden te verhuizen. */
const archief = require('./archief')({ db, save, DATA_DIR });

const beveilig = require('./beveiliging')({
  db, save,
  notifyOwner: (note) => {
    const o = eigenaarAccount();
    if (!o) return;
    try { sendPushToUser(o.id, { title: note.title, body: note.body, tag: 'beveiliging' }); } catch (e) {}
    try { mail.send(accounts.emailOf(o), note.title,
      'Beste ' + accounts.realNameOf(o) + ',\n\n' + note.body +
      '\n\nOpen de technische pagina (Beveiliging) om te zien wat er speelt.\n\nRahul Travel Group'); } catch (e) {}
  }
});

/* Een token kan een demo-sessie zijn (in-memory) of een echt account-token
   (ondertekend, staatloos). Beide leveren een sessie met tier + unieke key. */
function resolveSession(token) {
  if (!token) return null;
  const demo = sessionFor(token);
  if (demo) return demo;
  const user = accounts.verifyToken(token);
  if (user) return { tier: user.tier, key: 'user-' + user.id, account: user };
  return null;
}

function auth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const sess = resolveSession(token);
  if (!sess) return res.status(401).json({ error: 'Niet ingelogd.' });
  req.session = sess;
  dirTouch(sess);
  next();
}

/* Schoonmaakhulp voor vrije tekstvelden: knipt op lengte en haalt < en >
   weg, zodat door gebruikers ingevoerde namen en berichten nooit als
   opmaak in andermans scherm kunnen belanden. */

/* Ledengids voor Salon-connecties: sleutel -> codenaam. Wordt bijgehouden
   zodra een lid iets doet; zo kunnen leden elkaar op codenaam vinden
   zonder dat er ooit een echte naam over de lijn gaat. */
function dirTouch(sess) {
  // echte accounts (ook de gratis laag) staan in de codenaam-gids en kunnen
  // elkaar vinden; alleen een anonieme demo-gast zonder account niet
  if (!sess) return;
  if (sess.tier === 'guest' && !sess.account) return;
  const cn = liveCodename(sess);
  // Met Postgres gaat het lid naar de geindexeerde ledengids (member_dir) en
  // NIET naar db.data.memberDir: zo groeit de gids buiten het geheugen en staan
  // er bij miljoenen leden geen miljoenen rijen in het proces.
  if (ledenGidsActief()) {
    const cur = ledenGidsHaal(sess.key);
    if (!cur || cur.codename !== cn || cur.tier !== sess.tier) ledenGidsZet(sess.key, cn, sess.tier).catch(() => {});
    return;
  }
  if (!db.data.memberDir) return;
  const cur = db.data.memberDir[sess.key];
  if (!cur || cur.codename !== cn || cur.tier !== sess.tier) {
    if (!cur && _ledenAantalCache != null) _ledenAantalCache++; // nieuw lid: teller ophogen
    db.data.memberDir[sess.key] = { codename: cn, tier: sess.tier };
    save();
  }
}

// Goedkoop ledental voor de kantoor-totalen. Object.keys(memberDir).length is
// O(N) en materialiseert een array van alle sleutels: bij miljoenen leden kost
// dat seconden per kantoorverzoek. We cachen het aantal, hogen het op bij een
// nieuw lid (zie dirTouch) en verversen alleen bij een externe datawijziging.
// De demo-persona's die bij opstart in memberDir worden gezet (zie de init):
// dit zijn geen echte leden en tellen dus niet mee in het ledental.
const GIDS_SEED_TIERS = ['rtg', 'lifestyle', 'business'];
let _ledenAantalCache = null;
function ledenAantal() {
  // Met Postgres komt het ledental uit de geindexeerde gids (O(1), telt ook de
  // leden die niet in het geheugen staan). Zonder Postgres: de onderhouden
  // lokale teller, met de seed-persona's eraf.
  if (ledenGidsActief()) return ledenGidsAantal();
  if (_ledenAantalCache == null) {
    const dir = db.data.memberDir || {};
    _ledenAantalCache = Object.keys(dir).length - GIDS_SEED_TIERS.filter(k => dir[k]).length;
  }
  return _ledenAantalCache;
}

// Eenpuntstoegang tot de ledengids. Met Postgres komt een lid uit de
// geindexeerde tabel (cache + backfill), zonder Postgres uit db.data.memberDir.
// Zo hoeft de gids bij miljoenen leden niet in het geheugen te staan, terwijl de
// lezers hetzelfde blijven aanroepen.
function gidsHaal(key) {
  if (ledenGidsActief()) return ledenGidsHaal(key) || null;
  return db.data.memberDir[key] || null;
}
// Zoeken op (deel van) een codenaam. Met Postgres geindexeerd; anders een scan
// over het geheugen. exact=true eist een exacte codenaam.
async function gidsZoekCodenaam(q, exact) {
  const ql = String(q || '').trim().toLowerCase();
  if (!ql) return [];
  if (ledenGidsActief()) {
    const rows = await ledenGidsZoek(ql, 50);
    return exact ? rows.filter(r => String(r.codename || '').toLowerCase() === ql) : rows;
  }
  const out = [];
  for (const [key, m] of Object.entries(db.data.memberDir || {})) {
    const cl = String(m.codename || '').toLowerCase();
    if (cl && (exact ? cl === ql : cl.includes(ql))) out.push({ key, codename: m.codename, tier: m.tier });
  }
  return out;
}

/* Een lid opzoeken op codenaam (voor contracten, uitnodigingen): de gids
   koppelt de sleutel aan de codenaam, nooit aan een echte naam. Async: met
   Postgres een geindexeerde opzoeking i.p.v. een scan door het geheugen. */
async function keyVanCodenaam(codenaam) {
  const c = String(codenaam || '').trim();
  if (!c) return null;
  // een exacte codenaam-treffer; met Postgres geindexeerd. We nemen codenaam en
  // pas rechtstreeks uit de treffer (geen tweede opzoeking, dus geen cache-miss).
  const treffers = await gidsZoekCodenaam(c, true);
  return treffers.length ? { key: treffers[0].key, tier: treffers[0].tier, codename: treffers[0].codename } : null;
}

/* ---------- Salon-rechten (server-side afgedwongen) ----------
   gast: alleen liken; RTG: reageren/dm'en met RTG-leden;
   Lifestyle & Business: volledige interactie met alle leden.
   Wederkerigheid: spreekt een hoger lid een RTG-lid aan (reactie of DM
   op diens post), dan mag dat RTG-lid bij die persoon terugpraten. */
function hasContact(higherFull, rtgFull) {
  return db.data.contacts.some(c => c.higher === higherFull && c.rtg === rtgFull);
}

function addContact(higherFull, rtgFull) {
  if (!hasContact(higherFull, rtgFull)) {
    db.data.contacts.push({ higher: higherFull, rtg: rtgFull });
  }
}

function canEngage(sess, post) {
  if (sess.tier === 'guest') return false;
  if (sess.tier === 'rtg') {
    if (post.tier === 'rtg') return true;
    return hasContact(post.author, PERSONAS.rtg.full);
  }
  return true;
}

function engageError(viewerTier) {
  if (viewerTier === 'guest') return 'Zonder pas kunt u alleen liken. Reageren en berichten zijn voor leden.';
  return 'Met de RTG Pass reageert en dm’t u alleen met andere RTG-leden, tenzij dit lid u eerst heeft aangesproken.';
}

/* Na een reactie/DM van een hoger lid op een RTG-post: leg het contact vast. */
function registerContact(sess, post) {
  if ((sess.tier === 'lifestyle' || sess.tier === 'business') && post.tier === 'rtg') {
    addContact(PERSONAS[sess.tier].full, post.author);
  }
}

/* ---------- state per gebruiker ---------- */

/* Startinhoud voor een nieuw account: een eigen kopie van de voorbeeldreis en
   -facturen, zodat elk lid zijn eigen boekingen/betalingen heeft (wat de één
   betaalt, verandert niets bij de ander). */
function memberTemplate() {
  return {
    invoices: JSON.parse(JSON.stringify(db.data.invoices)),
    trip: JSON.parse(JSON.stringify(db.data.trip)),
    creatorCredit: 0,
    creatorLikes: 0
  };
}

function stateFor(sess, lang) {
  lang = lang === 'en' ? 'en' : 'nl';
  // Echte accounts tonen hun eigen identiteit (naam, codenaam); demo-sessies
  // vallen terug op de vaste persona's.
  const persona = sess.account ? accounts.publicUser(sess.account) : PERSONAS[sess.tier];
  // Systeeminhoud (facturen, reis, menu) wordt gelokaliseerd. Berichten van
  // leden (posts, reacties) houden hun originele tekst + de taal van de auteur,
  // zodat de ontvanger ze in zijn eigen taal vertaald kan lezen.
  const posts = db.data.posts.map(p => {
    const sup = p.partnerCode ? findSupplier(p.partnerCode) : null;
    const claim = p.deal ? (p.deal.claims || []).find(c => c.key === sess.key) : null;
    return {
      id: p.id, author: p.author, tier: p.tier, place: p.place, visual: p.visual, at: p.at || null,
      photo: p.photo || null, partner: !!p.partner,
      text: p.text, lang: p.lang || 'nl', reward: p.reward, featured: !!p.featured,
      likes: p.baseLikes + Object.keys(p.likedBy).length,
      liked: !!p.likedBy[sess.key],
      comments: p.comments.map(c => ({ who: c.who, tier: c.tier, text: c.text, lang: c.lang || 'nl' })),
      canEngage: canEngage(sess, p),
      // bedrijfslaag: volgen, exclusieve aanbiedingen en polls
      partnerCode: p.partnerCode || null,
      volgIk: sup && sup.salon ? sup.salon.volgers.includes(sess.key) : false,
      volgers: sup && sup.salon ? sup.salon.volgers.length : undefined,
      deal: p.deal ? { titel: p.deal.titel, geldigTot: p.deal.geldigTot || null,
        claims: (p.deal.claims || []).length, mijnCode: claim ? claim.code : null } : null,
      poll: p.poll ? {
        vraag: p.poll.vraag,
        totaal: p.poll.opties.reduce((n, o) => n + o.stemmen.length, 0),
        opties: p.poll.opties.map((o, i) => ({ tekst: o.tekst, stemmen: o.stemmen.length, mijn: o.stemmen.includes(sess.key) })),
        gestemd: p.poll.opties.some(o => o.stemmen.includes(sess.key))
      } : null
    };
  });
  const state = { user: { tier: sess.tier, ...persona }, posts, creatorCredit: 0, creatorLikes: 0, lang };
  // Ook gratis gebruikers (zonder pas) mogen solliciteren en hun sollicitaties
  // met status terugzien; de rest van het ledenpaneel blijft voor leden.
  state.myApplications = myApplications(sess.key);
  if (sess.tier !== 'guest') {
    // Echte accounts hebben hun eigen boekingen/betalingen; demo-sessies delen
    // de vaste demo-inhoud.
    const md = sess.account ? (accounts.getMemberState(sess.account.id) || memberTemplate()) : db.data;
    // Elke factuur krijgt een afboekcode (grootboeksuggestie) en de btw die in
    // de ledenbijdrage is begrepen. Business-leden zien de volledige specificatie.
    // De maandbijdrage volgt het prijsmodel per pas: 65 (RTG) of 20.000
    // (Lifestyle) ex 21% btw; Business is prijs op maat (demo-bedrag hieronder).
    const MAANDBIJDRAGE_EX = { rtg: 65, lifestyle: 20000, business: 7500 };
    const PASNAAM = { rtg: 'RTG Pass', lifestyle: 'Lifestyle Pass', business: 'Business Pass' };
    state.invoices = (md.invoices || []).map(inv => {
      const contrib = /lidmaatschap|jaarbijdrage|maandbijdrage/i.test(inv.desc);
      if (contrib && MAANDBIJDRAGE_EX[sess.tier]) {
        const ex = MAANDBIJDRAGE_EX[sess.tier];
        inv = {
          ...inv,
          desc: (lang === 'en' ? 'Monthly contribution ' : 'Maandbijdrage ') + PASNAAM[sess.tier] +
                (sess.tier === 'business' ? (lang === 'en' ? ' (bespoke)' : ' (prijs op maat)') : '') +
                (lang === 'en' ? ' \u00b7 July 2026' : ' \u00b7 juli 2026'),
          netto: 0,
          bijdrage: Math.round(ex * 1.21 * 100) / 100
        };
      }
      return {
        ...inv, desc: contrib ? inv.desc : i18n.localize(inv.desc, lang), date: i18n.localize(inv.date, lang),
        afboekcode: contrib ? '4560' : '4510',
        afboeklabel: lang === 'en'
          ? (contrib ? 'subscriptions and memberships' : 'travel and lodging expenses')
          : (contrib ? 'contributies en abonnementen' : 'reis- en verblijfkosten'),
        btw: Math.round((inv.bijdrage - inv.bijdrage / 1.21) * 100) / 100
      };
    });
    if (md.trip) {
      state.trip = {
        ...md.trip,
        dates: i18n.localize(md.trip.dates, lang),
        items: (md.trip.items || []).map(it => ({
          ...it, when: i18n.localize(it.when, lang), title: i18n.localize(it.title, lang), sub: i18n.localize(it.sub, lang)
        }))
      };
    }
    state.creatorCredit = sess.account ? (md.creatorCredit || 0) : (db.data.creatorCredit[sess.tier] || 0);
    state.creatorLikes = sess.account ? (md.creatorLikes || 0) : (db.data.creatorLikes[sess.tier] || 0);
    // RTFoundation: gezinnen die dit lid als oppas/familie koppelde + hun meldingen
    if (sess.account) {
      state.foundation = { gekoppeld: rtf.gekoppeldeGezinnen(sess.account.id), meldingen: md.foundationMeldingen || [] };
    }
    // leeftijd uit het paspoort: het lid ziet de eigen groep; partners nooit
    const lft = leeftijdVan(geborenVan(sess));
    if (lft != null) { state.user.leeftijd = lft; state.user.leeftijdsgroep = leeftijdsgroepVan(lft); }
  }
  return state;
}

// De sollicitaties van dit lid, over alle partners heen, nieuwste eerst.
function myApplications(key) {
  const out = [];
  for (const [code, list] of Object.entries(db.data.applications || {})) {
    const s = findSupplier(code);
    for (const a of list) if (a.key === key) {
      const chat = (db.data.applyChats || {})[a.id];
      out.push({ company: s ? s.name : code, func: a.func, status: a.status, at: a.at, chatId: chat ? a.id : null });
    }
  }
  return out.sort((x, y) => new Date(y.at) - new Date(x.at)).slice(0, 10);
}

/* ---------- endpoints ---------- */

// Liveness: draait het proces? (Voor de load balancer/monitor, altijd 200 als
// het proces leeft.)
app.get('/api/health', (req, res) => res.json({
  ok: true, ai: anthropic ? 'claude' : 'demo',
  server: Number(process.env.RTG_SERVER || 1), active: db.writable,
  domeinen: process.env.RTG_DOMAINS || 'alle',
  pid: process.pid, up: Math.round(process.uptime())
}));

/* Alleen in de testsuite: twee opzettelijke storingen om de foutisolatie te
   BEWIJZEN. /api/test/bug gooit een async fout (die ene aanvraag krijgt 500,
   het proces leeft door); /api/test/crash laat dit proces echt sterven (de
   vloot-toezichthouder moet hem herstarten, de andere apps merken niets). */
if (process.env.NODE_ENV === 'test') {
  app.post('/api/test/bug', async () => { throw new Error('opzettelijke testbug'); });
  app.post('/api/test/crash', (req, res) => { res.json({ ok: true, doei: true }); setTimeout(() => process.exit(1), 50); });
}

// Readiness: mag deze instance verkeer krijgen? Controleert dat de datalaag
// echt bruikbaar is (kan lezen). Een standby- of half-gestarte server geeft 503,
// zodat de load balancer hem overslaat tot hij klaar is.
app.get('/api/ready', (req, res) => {
  let dataOk = false;
  try { dataOk = !!db.data && typeof db.data === 'object'; } catch (e) { dataOk = false; }
  const klaar = dataOk;
  res.status(klaar ? 200 : 503).json({
    ready: klaar, data: dataOk, writable: !!db.writable,
    redis: process.env.REDIS_URL ? 'geconfigureerd' : 'uit', up: Math.round(process.uptime())
  });
});

/* ---- failover-cluster (server/trio.js): drie servers, een actief ----
   De poortwachter promoveert of degradeert een server via deze endpoints.
   Alleen bereikbaar met de clustersleutel die het trio bij de start deelt;
   draait de server los (zonder sleutel), dan bestaan ze feitelijk niet. */
const CLUSTER_KEY = process.env.RTG_CLUSTER_KEY || null;
app.post('/api/cluster/:actie', (req, res) => {
  if (!CLUSTER_KEY || req.get('x-rtg-cluster') !== CLUSTER_KEY) return res.status(404).json({ error: 'Onbekend.' });
  const nr = process.env.RTG_SERVER || '1';
  if (req.params.actie === 'promote') {
    // Eerst schrijfrecht, dan de verse data van schijf laden (bestaat er nog
    // geen database, dan wordt de seed nu ook echt bewaard) en tot slot de
    // realtime-tabellen (sessies, notificaties) opnieuw opbouwen.
    db.writable = true;
    try { load(); initRealtime(); } catch (e) {
      db.writable = false;
      return res.status(500).json({ error: 'Data laden mislukte: ' + e.message });
    }
    console.log('[cluster] server ' + nr + ' neemt over en is nu actief');
  } else if (req.params.actie === 'demote') {
    db.writable = false;
    console.log('[cluster] server ' + nr + ' gaat terug naar standby');
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  res.json({ ok: true, active: db.writable });
});



/* ---------- echte accounts (registreren / inloggen) ---------- */








/* ---------- identiteitsverificatie (tegen nepaccounts) ----------
   Een lid uploadt een foto van zijn identiteitsbewijs; RTG keurt die goed in de
   backoffice. Zo weet je zeker dat er een echt mens achter een account zit, en
   kan een geverifieerd lid daarna in één tik boeken.
   Let op (AVG): een ID-document is een bijzonder persoonsgegeven. Het bestand
   wordt buiten de repo bewaard (server/data/uploads, gitignored) en is alleen
   voor de backoffice zichtbaar. Voor productie: versleutel het bestand, bewaar
   het zo kort mogelijk, en gebruik bij voorkeur een gecertificeerde KYC-dienst. */
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');




/* Live-verbinding. EventSource kan geen Authorization-header sturen, dus het
   token gaat als query-parameter. */
app.get('/api/stream', (req, res) => {
  const sess = resolveSession(req.query.token);
  if (!sess) return res.status(401).end();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive'
  });
  res.write('retry: 3000\n\n');
  const client = { tier: sess.tier, key: sess.key, res };
  sseClients.push(client);
  // gemiste persoonlijke events opnieuw afspelen (na een korte verbroken verbinding)
  const sinds = Number(req.headers['last-event-id'] || req.query.since || 0);
  if (sinds) speelOpnieuw(res, sess.key, sinds);
  // onopgehaalde notificaties meteen meesturen
  const unread = (db.data.notifications[sess.tier] || []).filter(n => !n.read);
  sseSend(res, 'hello', { unread });
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(ping);
    const i = sseClients.indexOf(client);
    if (i >= 0) sseClients.splice(i, 1);
  });
});

// notificaties ophalen / als gelezen markeren
app.post('/api/notifications', auth, (req, res) => {
  res.json({ notifications: db.data.notifications[req.session.tier] || [] });
});
app.post('/api/notifications/read', auth, (req, res) => {
  (db.data.notifications[req.session.tier] || []).forEach(n => n.read = true);
  save();
  res.json({ ok: true });
});

/* ---------- RTFoundation-koppeling: een lid (oppas, opa/oma, familie) koppelt
   met zijn RTG-pas een gezinsprofiel, zodat de meldingen uit dat gezin hier in
   de RTG-app binnenkomen. Zo hoeft hij de RTFoundation-app niet te installeren. */
function eisAccount(req, res) {
  if (!req.session.account) { res.status(403).json({ error: 'Log in met je eigen RTG-account om een gezin te koppelen.' }); return false; }
  return true;
}
// alle gast-gegevens (belangrijke info, agenda, waar iedereen is) van de
// gezinnen waaraan dit lid gekoppeld is, om in de RTG-app te lezen
// het chat-/belkanaal van een gekoppeld gezin (profieltoken + leden) voor de RTG-app
// terugberichten naar het gezin (bijv. de oppas antwoordt op een oproep)

/* ================= SALON-CONNECTIES =================
   Leden voegen elkaar toe op codenaam, sturen elkaar berichten, delen
   Salon-posts en bellen elkaar (audio/video via WebRTC; de server is
   alleen het signaleringskanaal en ziet nooit beeld of geluid). */

// De sociale kern (vrienden, veiligheid, snaps) zit in server/kern/sociaal.js.
const sociaal = require('./kern/sociaal')({ db, save, sseToCustomer, rtf, crypto, gidsHaal, gidsZoekCodenaam });
const {
  dmSleutel, connectieTussen, isRtf, codeExists, codenaamVan, soortVan, isKindHandle, verbActief, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, sociaalRate, kindContacten, kindVerwijder, statusVan, socialZoek, socialVerbind, socialAntwoord, socialConnecties, socialDm, socialDmSend, zijnVrienden, socialTeKeuren, socialGoedkeur, geldigeFoto, opschonenSnaps, snapSturen, snapsVoor, snapOpenen, verhaalPlaatsen, verhalenVoor, verhaalBekijken
} = sociaal;
function geenGast(req, res) {
  // vrienden toevoegen, chatten en bellen kan met elk echt account, ook de
  // gratis laag (met paspoort). Alleen een anonieme demo-gast zonder account niet.
  if (req.session.tier === 'guest' && !req.session.account) { res.status(403).json({ error: 'Maak een gratis account (met paspoort) om vrienden toe te voegen en te chatten.' }); return true; }
  return false;
}

/* ---------- gedeelde vriendenlaag over RTG en RTFoundation ----------
   Iedereen (RTG-lid, gratis account, RTFoundation-gezinslid) heeft een codenaam
   en een "handle". RTG: de sessiesleutel (user-<id> of tier). RTFoundation:
   rtf:<GEZINSCODE>:<profielId>. Zo kunnen RTF en RTG elkaar op codenaam vinden,
   toevoegen, chatten, bellen en snappen. Kinderprofielen hebben ouderakkoord
   nodig voordat een vriendschap actief wordt. */

app.post('/api/push/subscribe', auth, (req, res) => {
  if (!webpush) return res.status(501).json({ error: 'Push niet beschikbaar.' });
  const sub = req.body.subscription;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Ongeldige subscription.' });
  const list = db.data.pushSubs[req.session.tier] = (db.data.pushSubs[req.session.tier] || []);
  if (!list.some(s => s.endpoint === sub.endpoint)) list.push(sub);
  // echte accounts krijgen ook een persoonlijke push-lijst (voor o.a. RTFoundation-meldingen)
  if (req.session.account) {
    const uid = req.session.account.id;
    const ulist = db.data.pushSubsUser[uid] = (db.data.pushSubsUser[uid] || []);
    if (!ulist.some(s => s.endpoint === sub.endpoint)) ulist.push(sub);
  }
  save();
  res.json({ ok: true });
});

/* Eén tik betaalt: één factuur ({invoiceId}) of alles wat openstaat ({all:true}).
   De echte Face ID-/Apple Pay-verificatie gebeurt op het toestel; de server
   verwerkt de betaling in één aanroep. */




/* Vertaal een bericht naar de taal van de ontvanger. Iedereen schrijft in de
   eigen taal; de lezer krijgt het in de zijne (en andersom). */
app.post('/api/translate', async (req, res) => {
  const text = String(req.body.text || '').slice(0, 1500);
  const to = req.body.to === 'en' ? 'en' : 'nl';
  const from = (req.body.from === 'en' || req.body.from === 'nl') ? req.body.from : undefined;
  try {
    const out = await i18n.translate(text, to, from);
    res.json(out);
  } catch (e) {
    res.json({ text, translated: false });
  }
});

/* ---------- partnerkanaal: boeken zonder pas ----------
   Publieke endpoints (geen login): partner opzoeken, reizen ophalen en
   boeken via een partnercode. De service (15% boven nettoprijs) wordt
   gedeeld tussen partner en RTG. */

/* De klant ziet alleen totaalprijzen. Nettoprijs, service en de verdeling
   tussen partner en RTG blijven interne administratie (db.json). */

function findPartner(code) {
  code = String(code || '').trim().toUpperCase();
  return db.data.partners.find(p => p.code === code) || null;
}

function findStaffPartner(staffCode) {
  staffCode = String(staffCode || '').trim().toUpperCase();
  return db.data.partners.find(p => p.staff && p.staff.code === staffCode) || null;
}

function publicTrip(t, staffRate, lang) {
  const out = {
    id: t.id, dest: t.dest, visual: t.visual, title: i18n.localize(t.title, lang),
    dates: i18n.localize(t.dates, lang), desc: i18n.localize(t.desc, lang), includes: i18n.localizeList(t.includes, lang),
    price: Math.round(t.netto * (1 + db.data.partnerService))
  };
  if (staffRate != null) out.staffPrice = Math.round(t.netto * (1 + staffRate));
  return out;
}




/* ================= LEVERANCIER-KANAAL =================
   Eén app voor alle leverancierstypes. Communiceert live (SSE) met de
   klanten-app, de website en de backoffice. Leveranciers gebruiken de app
   gratis; in ruil bieden ze RTG hun beste dynamische prijs. */

// SSE-routering naar een specifieke leverancier of naar de backoffice
function sseToSupplier(code, event, data) {
  bus.publish('sse', { doel: 'sup', match: code, event, data });
}
function sseToOffice(event, data) {
  bus.publish('sse', { doel: 'office', event, data });
}

function notifySupplier(code, note) {
  const n = { id: crypto.randomBytes(4).toString('hex'), read: false, at: new Date().toISOString(), ...note };
  db.data.supplierNotifications[code] = (db.data.supplierNotifications[code] || []);
  db.data.supplierNotifications[code].unshift(n);
  db.data.supplierNotifications[code] = db.data.supplierNotifications[code].slice(0, 40);
  save();
  sseToSupplier(code, 'notify', n);
  return n;
}

/* Leverancier opzoeken op code. Met miljoenen zaken in de kast is een lineaire
   scan (Array.find) per verzoek te duur: elke kassahandeling, elke bestelling
   en elke inlog zoekt een zaak op. Daarom een index (code -> zaak) die zichzelf
   herbouwt zodra het aantal zaken verandert (nieuwe partner erbij). Zo is elke
   opzoeking O(1), ook bij miljoenen restaurants. */
let _supIndex = null, _supIndexLen = -1;
function supplierIndex() {
  if (!_supIndex || _supIndexLen !== db.data.suppliers.length) {
    _supIndex = new Map();
    for (const s of db.data.suppliers) _supIndex.set(s.code, s);
    _supIndexLen = db.data.suppliers.length;
  }
  return _supIndex;
}
function findSupplier(code) {
  const c = String(code || '').trim().toUpperCase();
  // eerst de kleine, actieve kast in het geheugen (O(1)); anders het grootboek
  // in Postgres (miljoenen bulk-zaken, op aanvraag ingeladen met cache).
  return supplierIndex().get(c) || grootSupplierSync(c) || null;
}
function supplierAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const sess = token && sessionFor(token);
  if (!sess || sess.role !== 'supplier') return res.status(401).json({ error: 'Niet ingelogd als leverancier.' });
  req.supplier = findSupplier(sess.code);
  if (!req.supplier) return res.status(401).json({ error: 'Leverancier niet gevonden.' });
  // Wie is er aan het werk (voor toeschrijving van activiteiten).
  req.actor = { name: sess.actor || 'Beheer', role: sess.staffRole || 'manager', staffId: sess.staffId || null, manager: !!sess.manager };
  next();
}

// Legt vast wie wat deed binnen het bedrijf; live zichtbaar in de team-tab.
function logActivity(code, actor, text) {
  const list = db.data.supplierActivity[code] = (db.data.supplierActivity[code] || []);
  list.unshift({ who: actor ? actor.name : 'Beheer', text, at: new Date().toISOString() });
  db.data.supplierActivity[code] = list.slice(0, 80);
  save();
  sseToSupplier(code, 'sync', { scope: 'team' });
}

// publieke weergave van een leverancier (voor de klant)
function publicSupplier(s, lang) {
  const t = db.data.supplierTypes[s.type] || {};
  const loc = s.loc ? { ...s.loc, label: i18n.localize(s.loc.label, lang) } : s.loc;
  return { code: s.code, name: s.name, type: s.type, typeLabel: t.label, icon: t.icon,
           city: s.city, caps: t.caps || [], loc, hasMenu: (s.menu || []).length > 0,
           depts: deptsFor(s),
           ordersOpen: !s.settings || s.settings.ordersOpen !== false,
           reservationsOpen: !s.settings || s.settings.reservationsOpen !== false,
           tablesFree: (s.tables || []).filter(x => x.status === 'vrij').length,
           tableNames: (s.tables || []).map(t => t.name),
           photos: s.photos || [],
           events: (s.events || []).filter(e => e.published).map(e => ({
             id: e.id, name: e.name, date: e.date, time: e.time, desc: e.desc, price: e.price,
             capacity: e.capacity,
             spotsLeft: Math.max(0, e.capacity - (e.guests || []).reduce((n, g) => n + g.qty, 0))
           })),
           rooms: (s.rooms || []).filter(r => r.available).map(r => ({ id: r.id, name: r.name, desc: i18n.localize(r.desc, lang), price: r.price })),
           // zelfstandigen: het vak en de boekbare diensten/producten
           vak: s.vak || null,
           services: (t.caps || []).includes('services')
             ? (s.services || []).map(x => ({ id: x.id, name: x.name, desc: x.desc, price: x.price, duurMin: x.duurMin || null, soort: x.soort || 'dienst' }))
             : undefined };
}

// dashboarddata voor de ingelogde leverancier
// Schaalvast: de schermen krijgen alleen het werk van nu plus een korte staart;
// alles daarbuiten loopt via gepagineerde endpoints en totalen.
function supplierState(s, actor) {
  const t = db.data.supplierTypes[s.type] || {};
  const vandaag = new Date().toISOString().slice(0, 10);
  const ORDER_KLAAR = { 'geserveerd': 1, 'geweigerd': 1, 'terugbetaald': 1, 'bezorgd': 1, 'opgehaald': 1 };
  const alleOrders = db.data.orders.filter(o => o.supplierCode === s.code && o.status !== 'wacht-op-betaling');
  const zichtOrders = alleOrders.filter(o => !ORDER_KLAAR[o.status] || String(o.at).slice(0, 10) === vandaag).slice(0, 80);
  const RIDE_KLAAR = { 'afgerond': 1, 'gearriveerd': 1, 'geweigerd': 1 };
  const alleRitten = db.data.rides.filter(r => r.supplierCode === s.code && r.status !== 'wacht-op-betaling');
  const klaarAll = alleRitten.filter(r => r.status === 'afgerond' || r.status === 'gearriveerd');
  const zichtRitten = alleRitten.filter(r => !RIDE_KLAAR[r.status] || String(r.finishedAt || r.at).slice(0, 10) === vandaag).slice(0, 80);
  const BOEK_KLAAR = { 'afgerond': 1, 'geweigerd': 1 };
  const alleBoekingen = db.data.boekingen.filter(b => b.supplierCode === s.code && b.status !== 'wacht-op-betaling');
  const zichtBoekingen = alleBoekingen.filter(b => !BOEK_KLAAR[b.status] || String(b.finishedAt || b.at).slice(0, 10) === vandaag).slice(0, 80);
  return {
    supplier: { code: s.code, name: s.name, type: s.type, typeLabel: t.label, icon: t.icon, city: s.city, caps: t.caps || [], loc: s.loc, rate: s.rate, vak: s.vak || null },
    activiteiten: s.activiteiten || null,
    transfer: s.type === 'activiteit' ? (s.transfer || { aan: false, prijs: 0 }) : null,
    autos: s.type === 'verhuur' ? (s.autos || []) : null,
    panden: s.type === 'vastgoed' ? (s.panden || []) : null,
    // de ophaal/bezorgdienst: alleen voor horeca en zelfstandigen
    bezorg: magBezorgen(s) ? {
      aan: !!(s.bezorg && s.bezorg.aan),
      ophalen: !s.bezorg || s.bezorg.ophalen !== false,
      bezorgen: !s.bezorg || s.bezorg.bezorgen !== false,
      producten: (s.bezorg && s.bezorg.producten) || [],
      lopend: alleOrders.filter(o => o.levering && !ORDER_KLAAR[o.status]).slice(0, 40),
      vandaagKlaar: alleOrders.filter(o => o.levering && (o.status === 'bezorgd' || o.status === 'opgehaald') && String(o.finishedAt || o.at).slice(0, 10) === vandaag).length
    } : null,
    services: s.services || null,
    boekingen: zichtBoekingen,
    rooms: s.rooms || null,
    doors: s.doors || null,
    tables: s.tables || null,
    settings: s.settings || { ordersOpen: true, reservationsOpen: true },
    fleet: s.fleet || null,
    minibar: Array.isArray(s.minibar) ? {
      catalog: s.minibar,
      countedToday: [...new Set((db.data.minibarCounts[s.code] || []).filter(e => e.at.slice(0, 10) === new Date().toISOString().slice(0, 10)).map(e => e.room))],
      recent: (db.data.minibarCounts[s.code] || []).slice(0, 12)
    } : null,
    photos: s.photos || [],
    pos: posDay(s.code),
    tickets: (db.data.tickets[s.code] || []).slice(0, 40),
    lostfound: (db.data.lostfound[s.code] || []).slice(0, 40),
    guestChats: Object.entries(db.data.guestChats)
      .filter(([, c]) => c.supplierCode === s.code && c.messages.length)
      .map(([k, c]) => ({ key: k, codename: c.codename, dept: c.dept || 'Team', unread: c.unreadPartner, last: c.messages[c.messages.length - 1].text.slice(0, 60), lastFrom: c.messages[c.messages.length - 1].from, lastAt: c.lastAt }))
      .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''))
      .slice(0, 30),
    // leden die nu live onderweg zijn maar nog niet met dit bedrijf verbonden
    nearbyGuests: Object.values(db.data.live)
      .filter(L => L.active && !connectedSupplierCodes(L.key).includes(s.code))
      .slice(0, 12)
      .map(L => { const d = L.destCode ? findSupplier(L.destCode) : null; return { codename: L.codename, dest: d ? d.name : null }; }),
    menu: s.menu || [],
    orders: zichtOrders.map(o => {
      const L = db.data.live[o.customerKey || o.customerTier];
      const enroute = L && L.active && connectedSupplierCodes(o.customerKey || o.customerTier).includes(s.code);
      const me = enroute && Number.isFinite(L.lat) ? { lat: L.lat, lng: L.lng } : null;
      return { ...o, guestEtaMin: me && s.loc ? etaMinutes(haversine(me, s.loc), L.mode) : null, guestArrived: !!(L && L.arrived && L.destCode === s.code) };
    }),
    rides: zichtRitten.map(r => {
      const L = db.data.live[r.customerKey || r.customerTier];
      const guest = L && L.active && Number.isFinite(L.lat) ? { lat: L.lat, lng: L.lng } : null;
      const toS = r.toCode ? findSupplier(r.toCode) : null;
      return { ...r, guestLoc: guest, pickupEtaMin: guest && s.loc ? etaMinutes(haversine(s.loc, guest), 'driving') : null, dropEtaMin: guest && toS && toS.loc ? etaMinutes(haversine(guest, toS.loc), 'driving') : null };
    }),
    totals: {
      orders: alleOrders.length,
      rides: alleRitten.length,
      historie: klaarAll.length,
      ritOmzet: klaarAll.reduce((s2, r) => s2 + (r.quote || 0), 0),
      boekingen: alleBoekingen.length
    },
    // personeelszaken voor het kantoor: verlofaanvragen en wie er nu binnen is
    verlof: (db.data.verlof[s.code] || []).slice(0, 30),
    klok: (() => {
      const entries = (db.data.klok[s.code] || []).filter(e => e.in.slice(0, 10) === vandaag).slice(0, 60);
      return { vandaag: entries, binnen: [...new Set(entries.filter(e => !e.out).map(e => e.name))] };
    })(),
    guests: guestsFor(s.code).slice(0, 30),
    prices: db.data.supplierPrices.filter(p => p.supplierCode === s.code).slice(0, 20),
    notifications: db.data.supplierNotifications[s.code] || [],
    staff: accounts.listStaff(s.code).map(accounts.publicStaff),
    applications: (db.data.applications[s.code] || []).slice(0, 30).map(werkgeverSollicitatie),
    vacatures: (db.data.vacatures[s.code] || []).slice(0, 40),
    events: s.events || null,
    dailyMeps: (() => {
      if (!s.dailyMeps) return null;
      const vandaag = new Date().toISOString().slice(0, 10);
      const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const out = {};
      if (s.dailyMeps[vandaag]) out[vandaag] = s.dailyMeps[vandaag];
      if (s.dailyMeps[morgen]) out[morgen] = s.dailyMeps[morgen];
      return out;
    })(),
    activity: (db.data.supplierActivity[s.code] || []).slice(0, 40),
    team: (db.data.supplierTeam[s.code] || []).slice(-60),
    actor: actor || { name: 'Beheer', role: 'manager', manager: true }
  };
}

// ---- leverancier: inloggen, live-stream, dashboard ----

// Bescherming tegen PIN-raden: na 5 foute pogingen een minuut wachten.
const pinFails = new Map(); // 'CODE:staffId' -> { n, until }

// Roster van het bedrijf (voor het personeel-inlogscherm; geen PINs).

// Manager voegt personeel toe (krijgt een PIN) of verwijdert het.

/* ---- sector-slimmigheden ----
   Ophaalcodes voor bars/restaurants, kamerbeheer voor hotels, een eigen
   fotopagina voor elke partner en rechtstreeks publiceren op De Salon. */

// korte, ondubbelzinnige ophaalcode (geen 0/O, 1/I)
/* Welke zaken mogen een ophaal/bezorgdienst voeren: horeca (orders-caps)
   en zelfstandigen. Hotels/vervoer hebben hun eigen kanalen al. */
function magBezorgen(s) {
  const caps = (db.data.supplierTypes[s.type] || {}).caps || [];
  return caps.includes('orders') || s.type === 'zzp';
}
/* Tickets (activiteiten/musea) leven als boekingen met soort 'ticket', zodat
   betalen, boekhouding, timeline en export automatisch meedoen. Deze helper
   geeft de tickets van een tijdslot; verlopen onbetaalde (ouder dan 30 min)
   tellen niet mee voor de capaciteit. */
function ticketsVoorSlot(code, activiteitId, datum, tijd) {
  const nu = Date.now();
  return db.data.boekingen.filter(b => b.kind === 'ticket' && b.supplierCode === code &&
    b.activiteitId === activiteitId && b.datum === datum && b.tijd === tijd &&
    b.status !== 'geweigerd' &&
    (b.paid || (nu - new Date(b.at).getTime()) < 30 * 60000));
}

// ---- kamers (hotel/appartement): aan/uit, toevoegen, verwijderen ----
/* ---- housekeeping: status per kamer ----
   schoon / vuil / bezig / bezet / defect. Defect maakt de kamer direct
   onboekbaar en zet automatisch een klus voor onderhoud klaar. */
const HK_STATUSES = ['schoon', 'vuil', 'bezig', 'bezet', 'defect'];
function addTicket(code, actor, text, room) {
  const t = {
    id: crypto.randomBytes(4).toString('hex'),
    text: String(text).slice(0, 160), room: room || null,
    status: 'open', by: actor ? actor.name : 'Systeem', at: new Date().toISOString()
  };
  const list = db.data.tickets[code] = (db.data.tickets[code] || []);
  list.unshift(t);
  db.data.tickets[code] = list.slice(0, 120);
  return t;
}
function setRoomHk(s, room, status, note, actor) {
  const wasDefect = room.hk && room.hk.status === 'defect';
  room.hk = { status, note: status === 'defect' ? note : '', by: actor.name, at: new Date().toISOString() };
  if (status === 'defect') {
    // direct uit de verkoop en een klus voor onderhoud
    if (room.available) { room.available = false; room.hkDisabledAvail = true; }
    addTicket(s.code, actor, 'Kamer defect: ' + (note || room.name), room.name);
    logActivity(s.code, actor, 'meldde ' + room.name + ' defect' + (note ? ': ' + note : ''));
  } else {
    if (wasDefect && room.hkDisabledAvail) { room.available = true; delete room.hkDisabledAvail; }
    logActivity(s.code, actor, 'zette ' + room.name + ' op "' + status + '"');
  }
  save();
  broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  sseToSupplier(s.code, 'sync', { scope: 'rooms' });
}

// ---- klussen (onderhoud): melden, oppakken, afronden ----

// ---- gevonden voorwerpen ----


// ---- fotopagina: foto's die gasten zien bij de partner ----

// ---- rechtstreeks publiceren op De Salon (als RTG-partner) ----

/* ---- De Salon voor bedrijven: volgers, aanbiedingen, polls en cijfers ----
   Het Salon-profiel is een verplicht onderdeel van elk partnerschap; deze
   endpoints geven de zaak marketinggereedschap en klantbinding. */
function salonNaarVolgers(s, tekst) {
  // volgers krijgen een melding zodra hun zaak iets nieuws plaatst
  const volgers = (s.salon && s.salon.volgers) || [];
  const tiers = [...new Set(volgers.map(k => (gidsHaal(k) || {}).tier).filter(Boolean))];
  for (const tier of tiers) notify(tier, { icon: '✦', title: 'De Salon · ' + s.name, body: String(tekst).slice(0, 90), scope: 'salon' });
  for (const k of volgers) sseToCustomer(k, 'sync', { scope: 'salon' });
}

// lid volgt of ontvolgt een zaak

// exclusieve member-aanbieding plaatsen (klantbinding: claimen met een code)

// lid claimt een aanbieding en krijgt een persoonlijke code voor aan de kassa

// de zaak verzilvert een claimcode aan de kassa

// poll plaatsen: vraag de leden wat zij willen (marketinginzicht)


// het bedrijfsprofiel: bio instellen en de marketingcijfers van de zaak


// ---- kassa: verkopen registreren, per sector (bon, kamer, rit) ----
const POS_METHODS = ['pin', 'contant', 'kamer'];

// dagoverzicht (Z-rapport): ontvangen vandaag, per betaalmethode en medewerker.
// Kamerlasten tellen pas mee als omzet bij het uitchecken (anders dubbel).
function posDay(code) {
  const today = new Date().toISOString().slice(0, 10);
  const all = db.data.posSales[code] || [];
  const sales = all.filter(s => s.at.slice(0, 10) === today);
  const byMethod = {}, byActor = {};
  let total = 0;
  for (const s of sales) {
    byActor[s.actor] = (byActor[s.actor] || 0) + s.total;
    if (s.method === 'kamer') continue;
    total += s.total;
    byMethod[s.method] = (byMethod[s.method] || 0) + s.total;
  }
  // open kamerrekeningen (alle dagen): nog niet uitgecheckte kamerlasten
  const openRooms = {};
  for (const s of all) {
    if (s.method !== 'kamer' || s.settled || !s.room) continue;
    const r = openRooms[s.room] = openRooms[s.room] || { total: 0, count: 0 };
    r.total += s.total;
    r.count += 1;
  }
  return { total, count: sales.length, byMethod, byActor, openRooms, sales: sales.slice(0, 25) };
}

// ---- RTG-ophaalcode innen aan de kassa ----
// De gast toont het oplichtende scherm; het personeel slaat de code aan.
// De bestelling wordt gekoppeld, zo nodig betaald en als uitgegeven gemarkeerd.

// ---- uitchecken: alle open kamerlasten van een kamer in één keer afrekenen ----

/* ---- minibar-telling: personeel telt per kamer, kosten gaan automatisch
   op de kamerrekening en de aanvulling staat meteen op papier ---- */

// catalogusbeheer: artikelen toevoegen of verwijderen

/* ---- slimme deuren (appartementen): op afstand openen via de app ----
   Openen is tijdelijk: na 10 seconden vergrendelt de deur zichzelf weer,
   zoals een echt smart lock. Elke handeling komt in de activiteitenfeed. */
const DOOR_RELOCK_MS = 10000;
function unlockDoor(s, door, who) {
  door.locked = false;
  door.lastBy = who;
  door.lastAt = new Date().toISOString();
  save();
  sseToSupplier(s.code, 'sync', { scope: 'doors' });
  setTimeout(() => {
    const cur = (s.doors || []).find(d => d.id === door.id);
    if (cur && !cur.locked) {
      cur.locked = true;
      save();
      sseToSupplier(s.code, 'sync', { scope: 'doors' });
    }
  }, DOOR_RELOCK_MS);
}


// De gearriveerde gast opent de voordeur vanuit de leden-app (digitale sleutel).

/* ---- gastchat: rechtstreeks appen met roomservice of de eigenaar ----
   Een gesprek per lid per partner, op codenaam. De gast begint vanuit de
   leden-app; het personeel antwoordt vanuit de Gastchat-tab. Beide kanten
   live via SSE, met notificaties over en weer. */
// afdelingen per sector: de gast kiest met wie hij spreekt
function deptsFor(s) {
  if (s.type === 'hotel') return ['Receptie', 'Roomservice', 'Housekeeping', 'Onderhoud', 'Security'];
  if (s.type === 'apartment') return ['Beheer', 'Onderhoud', 'Security'];
  return ['Team'];
}
function chatKeyOf(supplierCode, customerKey, dept) { return supplierCode + '|' + customerKey + '|' + dept; }
function getChat(s, customerKey, codename, tier, dept) {
  const k = chatKeyOf(s.code, customerKey, dept);
  if (!db.data.guestChats[k]) {
    db.data.guestChats[k] = { supplierCode: s.code, customerKey, codename, tier, dept, messages: [], unreadGuest: 0, unreadPartner: 0, lastAt: null };
  }
  return db.data.guestChats[k];
}
function validDept(s, dept) {
  const list = deptsFor(s);
  return list.includes(dept) ? dept : list[0];
}

/* De werk-laag (vacatures, sollicitatiechat en chatvertaling) staat in
   server/kern/werk.js. VAC_SOORTEN komt daar rechtstreeks vandaan; de functies
   dragen db, i18n, mail, LANDEN en de leverancier-/realtime-helpers.
   findSupplier, sseToSupplier, notifySupplier en notify zijn hoisted functies. */
const { trChat, chatApplicant, ensureApplyChat, applyChatPubliek, chatStuur, meldWerkgever, openVacatures, werkgeverSollicitatie, notifyApplicant } =
  maakWerk({ db, save, i18n, mail, LANDEN, findSupplier, sseToSupplier, sseToCustomer, notifySupplier, notify });

// gast stuurt een bericht aan een partner (per afdeling een eigen gesprek)

// gast opent het gesprek met een afdeling (en markeert het als gelezen)

// personeel antwoordt (onder eigen naam, uit het persoonlijke account)

// personeel opent een gesprek (en markeert het als gelezen)

/* ---- verbinding maken met een gast (hotel/appartement) ----
   Het hotel ziet welke leden nu live onderweg zijn en kan verbinden: de gast
   krijgt een melding, het hotel verschijnt in het onderweg-scherm van de
   gast, en het hotel volgt de aankomst live (positie en ETA). */

/* ---- solliciteren: bij elk bedrijf op dezelfde manier ----
   Openbaar formulier per bedrijf; de manager ziet de sollicitatie in de app
   en neemt aan (dan ontstaat direct een personeelsaccount met pincode) of
   wijst af. Zo wordt personeel zoeken voor elk bedrijf gelijk en simpel. */
/* De sollicitatie- en vacaturelogica (chatApplicant, ensureApplyChat,
   applyChatPubliek, chatStuur, meldWerkgever, openVacatures,
   werkgeverSollicitatie, notifyApplicant) staat in server/kern/werk.js en is
   hierboven al opgezet via maakWerk(). VAC_SOORTEN komt uit dezelfde module.
   Privacy: wie via de RTFoundation solliciteert, is voor de werkgever niet als
   zodanig herkenbaar (werkgeverSollicitatie verwijdert de interne velden). */

/* ---- AVG-rechten: inzage en vergetelheid, rechtstreeks vanuit de app ----
   Export levert alles wat op deze persoon herleidbaar is in een JSON;
   verwijderen wist of anonimiseert het en logt alle sessies van dit lid uit. */


/* ---- events: het Kantoor maakt ze, leden melden zich aan, de deur checkt in ---- */

// aan de deur: gast afvinken (elke medewerker mag dit, op eigen naam)

/* ---- het draaiboek, de event-keuken en de keukencoach ----
   De runsheet-, catering- en coach-logica staat in server/kern/events.js
   (RUN_STATIONS, ALT_IDEE en coachCache komen daar rechtstreeks vandaan). De
   rekenende functies dragen crypto (voor id's) en sectiesForOrder (voor de
   coach). sectiesForOrder is een hoisted functie en dus hier al beschikbaar. */
const { runItem, runKey, sortRunsheet, fallbackRunsheet, parseRunsheetText, cateringDishes, eventCovers, coachRules } = maakEvents({ crypto, sectiesForOrder });

/* ---- dagelijkse mise en place (a la carte, geen event) ----
   De keuken voorspelt de dag: verwachte couverts uit de verkoophistorie van de
   afgelopen drie weken, de tafelcapaciteit en de weekdag; per gerecht een
   portie-aantal en een MEP-takenlijst voor het team. */


// lid meldt zich aan voor een gepubliceerd event

/* ---- partner-onboarding: bedrijven melden zichzelf aan ----
   Publiek formulier -> aanvraag in de backoffice -> bij goedkeuring maakt de
   server het bedrijf aan met een leverancierscode en een manager-PIN, en
   mailt die naar de aanvrager. Vanaf dat moment werkt de hele partner-app. */
function makeSupplierCode(name) {
  let base = String(name).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'PARTNER';
  let code = base, n = 2;
  while (db.data.suppliers.find(s => s.code === code)) code = base + n++;
  return code;
}



/* ---- cv-builder (leden-app): het cv is de sleutel tot solliciteren ---- */

// De openstaande vacatures voor een ingelogd lid: dezelfde vacatures als in de
// RTFoundation, gefilterd op de paspoortleeftijd van het lid, met de landenlijst
// om ook in het buitenland te zoeken.

// RTG-lid solliciteert bij een partner; kan pas met een afgerond cv. Solliciteren
// op een gestructureerde vacature (vacatureId) is de nieuwe, gelijke weg; het
// oude vrije functieveld blijft werken voor open sollicitaties.

/* ---- beheer: alleen managers/chefs passen instellingen, tafels en menu aan ---- */
function managerOnly(req, res) {
  if (!req.actor.manager) { res.status(403).json({ error: 'Alleen een manager kan dit aanpassen.' }); return false; }
  return true;
}

// bestellingen en reserveringen open of dicht; leden merken het direct
/* ---- boekhouding per land en genre ----
   De fiscale tabellen (LANDEN, ZZP, FIN_CAT), het peiljaar en de rekenende
   laag (financeVoor, cannedBoekhouder) staan in server/kern/fiscaal.js. Werk
   het peiljaar en de tabellen daar elk jaar bij en laat ze fiscaal toetsen. */

/* Elke zaak is baas over de eigen opties. Alles kan aan of uit, met een
   principiele uitzondering: betalen via de app staat altijd aan (daar is
   bewust geen sleutel voor). Wel kiest de zaak het moment: vooraf of achteraf. */
const ZAAK_OPTIES = {
  betaalVooraf: 'vooraf betalen',
  gastchat: 'de gastchat',
  ritten: 'ritaanvragen',
  deurenGast: 'de digitale gastsleutel',
  events: 'event-aanmeldingen'
};
function optieAan(s, naam) {
  return !s.settings || !s.settings.opties || s.settings.opties[naam] !== false;
}


// ---- tafelindeling (horeca): status door iedereen, indeling door de manager ----
const TABLE_STATUSES = ['vrij', 'bezet', 'gereserveerd', 'dicht'];

// ---- team oproepen: een collega of het hele bedrijf, gericht via SSE ----

// ---- security-alarm: melding met locatie naar het hele bedrijf en RTG ----

/* ---- personeelszaken: klok, verlof/ziek en de vertrouwenslijn ----
   Kennis en kunde in de zak van elk staflid: administratie die het bedrijf en
   de medewerker allebei helpt, en een vertrouwelijke lijn naar RTG. */

const urenVan = ms => Math.round(ms / 360000) / 10; // uren met een decimaal

function klokVan(code, staffId) {
  const nu = Date.now();
  const week = new Date(nu - 6 * 86400000).toISOString().slice(0, 10);
  const vandaag = new Date().toISOString().slice(0, 10);
  const mijn = (db.data.klok[code] || []).filter(e => e.staffId === staffId);
  const duur = e => (e.out ? new Date(e.out) : new Date()) - new Date(e.in);
  return {
    open: !!mijn.find(e => !e.out),
    vandaagUren: urenVan(mijn.filter(e => e.in.slice(0, 10) === vandaag).reduce((s, e) => s + duur(e), 0)),
    weekUren: urenVan(mijn.filter(e => e.in.slice(0, 10) >= week).reduce((s, e) => s + duur(e), 0))
  };
}

// in- of uitklokken met een tik

// eigen personeelszaken in een keer: klok, verlof en de vertrouwenslijn

// verlof aanvragen of ziekmelden

// manager beslist over een verlofaanvraag

/* Vertrouwenslijn: rechtstreeks en vertrouwelijk contact met de
   vertrouwenspersoon van RTG. De werkgever ziet hier niets van: geen
   activiteit, geen melding. Alleen de backoffice kan lezen en antwoorden. */
function trustVan(code, staffId) {
  const t = db.data.trustLine.find(x => x.code === code && x.staffId === staffId);
  return t ? { anon: t.anon, messages: t.messages.slice(-30) } : { anon: false, messages: [] };
}

// backoffice: de vertrouwenspersoon leest en antwoordt

/* ---- eigen backoffice per leverancier ----
   Elk bedrijf zijn eigen controlecentrum: dagcijfers, weektrend, toppers en
   een actiecentrum, met dezelfde patronen als de RTG-backoffice maar dan
   uitsluitend over de eigen zaak. */

/* ---- zzp-boekingen: diensten en producten van zelfstandige professionals ----
   Leden boeken met datum en tijd; de zelfstandige bevestigt, levert en rondt
   af. Betalen-eerst geldt hier net zo (tenzij de zaak achteraf kiest). */
const BOEK_KETEN = ['aangevraagd', 'bevestigd', 'afgerond'];




// de zelfstandige bevestigt, rondt af of weigert (alleen vooruit in de keten)

// dienstenbeheer: de zelfstandige is baas over het eigen aanbod

/* ---- cadeaukaarten ----
   Kopen via de leden-app (Face ID) of verkopen aan de kassa; innen door de
   zaak op code. Boekhoudkundig correct: de verkoop is nog geen omzet (het
   saldo is een verplichting op de balans), de btw hoort bij de inwisseling. */
const gcCode = () => 'RTG-GC-' + crypto.randomBytes(3).toString('hex').toUpperCase();





/* De fiscale rekenlaag komt uit kern/fiscaal.js en draagt db + de reken-helpers.
   financeVoor: de maandboekhouding van de zaak; cannedBoekhouder: de AI-antwoorden. */
const { financeVoor, cannedBoekhouder } = maakFiscaal({ db, centen, btwSplit });


// AI-boekhouder voor het Business Pass-lid: wat is per land terug te vorderen

/* ---- AI-assistent voor de leverancier-app ----
   Begrijpt vragen EN voert acties uit: kamers op status zetten, deuren
   openen, klussen melden, dagomzet, gasten onderweg, open chats, minibar.
   Zonder API-key werkt de intent-motor; met key beantwoordt Claude ook
   vrije vragen met de bedrijfscontext. */
function aiFindRoom(s, ql) {
  return (s.rooms || []).find(r => ql.includes(r.name.toLowerCase())) ||
         (s.rooms || []).find(r => r.name.toLowerCase().split(/[ ,]+/).some(w => w.length > 3 && ql.includes(w)));
}
function aiFindDoor(s, ql) {
  return (s.doors || []).find(d => ql.includes(d.name.toLowerCase())) ||
         (s.doors || []).find(d => d.name.toLowerCase().split(/[ (]+/).some(w => w.length > 3 && ql.includes(w))) ||
         ((ql.includes('deur') || ql.includes('door')) ? (s.doors || [])[0] : null);
}

/* ---- weekrooster: deterministisch gegenereerd per personeelslid ---- */
const SHIFT_NAMES = ['Ochtend 07:00-15:00', 'Avond 15:00-23:00', 'Vrij'];
function scheduleFor(code) {
  const staff = accounts.listStaff(code).map(accounts.publicStaff);
  const days = [];
  const now = new Date();
  const dayNames = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  for (let d = 0; d < 7; d++) {
    const date = new Date(now.getTime() + d * 86400000);
    const doy = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    days.push({
      date: date.toISOString().slice(0, 10),
      label: (d === 0 ? 'Vandaag' : d === 1 ? 'Morgen' : dayNames[date.getDay()]),
      staff: staff.map((m, i) => ({
        id: m.id, name: m.name, role: m.role,
        // managers vaker overdag; iedereen om de paar dagen vrij
        shift: SHIFT_NAMES[(m.id * 3 + doy + (m.role === 'manager' ? 0 : i)) % 3]
      }))
    });
  }
  return { days, shifts: SHIFT_NAMES };
}

// Interne teamchat binnen het bedrijf (tekst of spraakmemo).




// ---- dynamische prijs aan RTG (backoffice) ----

// ---- menukaart bijwerken (restaurant/bar/club) ----

// Welke werkplekken (keuken/bar) heeft deze bestelling nodig?
function stationsForOrder(s, o) {
  const set = new Set();
  for (const it of (o.items || [])) {
    const m = (s.menu || []).find(x => x.id === it.id);
    set.add(m && m.station === 'bar' ? 'bar' : 'keuken');
  }
  return [...set];
}

// welke keukensecties heeft deze bestelling nodig?
function sectiesForOrder(s, o) {
  const set = new Set();
  for (const it of (o.items || [])) {
    const m = (s.menu || []).find(x => x.id === it.id);
    if (m && m.station !== 'bar') set.add(m.sectie || 'warm');
  }
  return [...set];
}

// tafel op een bon zetten of aanpassen (bediening, keuken)

// keukensectie (warme kant, koude kant, snacks, dessert) meldt bezig of klaar

// ---- werkplekken: keuken- en barscherm melden hun deel bezig of klaar ----

// ---- leverancier werkt orderstatus bij → klant live op de hoogte ----

// ---- leverancier stort terug → klant krijgt melding ----

// ---- leverancier deelt live locatie → klanten met actieve rit/bestelling ----

// ---- vervoerspartner werkt de ritstatus bij → lid live op de hoogte ----
/* De vervoerslaag (ritstatusketen + slimme toewijzing) staat in
   server/kern/vervoer.js. RIT_KETEN/RIT_LEGACY/RIT_MELDING komen daar
   rechtstreeks vandaan; ritVerder en ritBezetting dragen db + de realtime-
   helpers. logActivity, broadcastSync, notify en de SSE-routers zijn al gezet. */
const { ritVerder, ritBezetting } = maakVervoer({
  db, etaMinutes, haversine, save, broadcastSync, sseToCustomer, sseToOffice, notify, logActivity
});

/* Toewijzen: het kantoor wijst toe, of een chauffeur neemt de rit zelf. */

/* Vlootbeheer (kantoor, alleen management) */
// Ritgeschiedenis, schaalvast: gepagineerd en doorzoekbaar, met het omzettotaal
// over de volledige historie (dus ook wat niet op deze pagina staat).

// Volledige ritgeschiedenis als CSV, op de server opgebouwd zodat de export
// compleet is hoe groot de historie ook wordt (token via query voor de download).


/* ================= KLANTZIJDE (leden-app) ================= */

// leveranciers voor de huidige stad/reis van het lid


// bestelling plaatsen (restaurant/bar/club), klant verschijnt onder codenaam

// bestelling betalen (Face ID op het toestel)


/* ================= LIVE REIS (onderweg) =================
   Koppelt een reizend lid en al zijn partners realtime. Het lid deelt zijn
   positie, de partners de hunne. Zo staan pre-orders klaar op het moment dat
   het lid aankomt, weet de taxi precies waar en wanneer op te halen, en ziet
   het lid live waar zijn vervoer is. Alles op codenaam, nooit op echte naam. */

// Lid start "onderweg" naar een bestemming (optioneel een partner).

// Lid deelt een nieuwe positie; partners en backoffice zien het live.



// Lid vraagt een rit aan bij een vervoerspartner (taxi/jet).

// rit betalen: hiermee wordt hij definitief en gaat hij naar de vervoerder

/* ================= BACKOFFICE (RTG) =================
   De backoffice ziet alle binnenkomende dynamische prijzen, bestellingen en
   ritten live. Demo-toegang met een vaste code. */
// In productie mag de demo-backofficecode ('RTG-OFFICE') nooit werken: zonder een
// eigen OFFICE_CODE wordt hij onraadbaar willekeurig, zodat de deur dichtblijft
// tot er een echte code is gezet. Buiten productie houden we de demo-code.
const OFFICE_CODE = process.env.OFFICE_CODE || (PRODUCTION ? crypto.randomBytes(18).toString('hex') : 'RTG-OFFICE');


function officeAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const sess = token && sessionFor(token);
  if (sess && sess.role === 'office') return next();
  // de eigenaar komt ook met zijn eigen accountlogin binnen (geen aparte code nodig)
  try { if (token && eigenaar.isEigenaar(accounts, accounts.verifyToken(token))) { req.eigenaar = true; return next(); } } catch (e) {}
  return res.status(401).json({ error: 'Geen backoffice-sessie.' });
}

function officeState() {
  // live overzicht: welke leden zijn nu onderweg, waarheen en met welke partners
  const live = Object.keys(db.data.live).map(key => {
    const L = db.data.live[key];
    if (!L || !L.active) return null;
    const dest = L.destCode ? findSupplier(L.destCode) : null;
    return {
      codename: L.codename, tier: L.tier, mode: L.mode, arrived: !!L.arrived,
      dest: dest ? { code: dest.code, name: dest.name } : null,
      partners: connectedSupplierCodes(key).map(c => { const s = findSupplier(c); return s ? s.name : c; }),
      updatedAt: L.updatedAt
    };
  }).filter(Boolean);
  const applications = [];
  for (const [code, list] of Object.entries(db.data.applications || {})) {
    const sup = findSupplier(code);
    for (const a of list) applications.push({ company: sup ? sup.name : code, name: a.name, func: a.func, status: a.status, viaRTG: !!a.viaRTG, at: a.at });
  }
  applications.sort((x, y) => (y.at || '').localeCompare(x.at || ''));
  // slimme laag: dagcijfers, weektrend, partnerprestaties en een actiecentrum
  const nu = Date.now();
  const dagVan = iso => String(iso || '').slice(0, 10);
  const betaaldeOrders = db.data.orders.filter(o => o.paid && o.status !== 'geweigerd' && o.status !== 'terugbetaald');
  const betaaldeRitten = db.data.rides.filter(r => r.paid && r.status !== 'geweigerd');
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(nu - i * 86400000).toISOString().slice(0, 10);
    const dagOrders = betaaldeOrders.filter(o => dagVan(o.paidAt || o.at) === d);
    const dagRitten = betaaldeRitten.filter(r => dagVan(r.paidAt || r.at) === d);
    week.push({
      date: d,
      label: new Date(d + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'short' }),
      omzet: dagOrders.reduce((s2, o) => s2 + (o.total || 0), 0) + dagRitten.reduce((s2, r) => s2 + (r.quote || 0), 0),
      aantal: dagOrders.length + dagRitten.length
    });
  }
  const fonds = db.data.invoices
    .filter(i => i.status === 'paid' || i.status === 'betaald')
    .reduce((s2, i) => s2 + Math.round((i.bijdrage || 0) * 0.3), 0);
  const stats = {
    omzetVandaag: week[6].omzet, aantalVandaag: week[6].aantal,
    omzetWeek: week.reduce((s2, d) => s2 + d.omzet, 0),
    foundation: fonds, liveNu: live.length
  };
  /* Partnerprestaties: NIET per zaak over alle orders filteren (dat is
     O(zaken x orders) en loopt met miljoenen restaurants volledig vast).
     In plaats daarvan tellen we de orders/ritten EEN keer op per code, en
     bouwen we alleen prestaties voor zaken die vandaag/deze week echt iets
     deden. O(orders + ritten + actieve zaken). */
  const perCode = new Map();
  // naam/type uit het order/rit-record zelf halen (die staan erop), zodat we
  // NIET per code findSupplier hoeven te doen: bij miljoenen bulk-zaken zou dat
  // het grootboek overspoelen met losse queries.
  const aggCode = (code, naam, type) => { let a = perCode.get(code); if (!a) { a = { naam: naam || code, type: type || '', omzet: 0, aantal: 0, openNu: 0, dur: 0, durN: 0 }; perCode.set(code, a); } return a; };
  for (const o of betaaldeOrders) { const a = aggCode(o.supplierCode, o.supplierName, o.type); a.omzet += (o.total || 0); a.aantal += 1; }
  for (const r of betaaldeRitten) { const a = aggCode(r.supplierCode, r.supplierName, r.type); a.omzet += (r.quote || 0); a.aantal += 1; if (r.finishedAt) { a.dur += (new Date(r.finishedAt) - new Date(r.at)) / 60000; a.durN += 1; } }
  for (const o of db.data.orders) if (o.paid && (o.status === 'nieuw' || o.status === 'in bereiding')) aggCode(o.supplierCode, o.supplierName, o.type).openNu += 1;
  for (const r of db.data.rides) if (r.paid && !['afgerond', 'gearriveerd', 'geweigerd', 'wacht-op-betaling'].includes(r.status)) aggCode(r.supplierCode, r.supplierName, r.type).openNu += 1;
  const performance = [...perCode.entries()].map(([code, a]) => ({ code, name: a.naam, type: a.type, omzet: a.omzet, aantal: a.aantal, openNu: a.openNu,
    gemMin: a.durN ? Math.round(a.dur / a.durN) : null })).sort((a, b) => b.omzet - a.omzet);
  // actiecentrum: alles wat nu een oog van RTG nodig heeft, belangrijkste eerst
  const alerts = [];
  // open SOS van huurders: altijd rood en bovenaan, tot de zaak hem afhandelt
  for (const h of db.data.boekingen) {
    if (h.kind !== 'huur' || !Array.isArray(h.sos)) continue;
    for (const sos of h.sos) {
      if (sos.ok) continue;
      alerts.push({ level: 'rood', kind: 'sos', ref: h.ref, supplierCode: h.supplierCode,
        text: 'SOS van ' + h.customerCodename + ' (' + h.supplierName + ', ' + (h.autoNaam || 'huurauto') + '): ' +
          String(sos.bericht || 'noodsignaal').slice(0, 120) +
          (Number.isFinite(sos.lat) ? ' \u00B7 locatie bekend' : '') });
    }
  }
  const minGeleden = iso => Math.round((nu - new Date(iso)) / 60000);
  for (const o of db.data.orders) {
    if (!o.paid || o.status !== 'nieuw') continue;
    const m = minGeleden(o.paidAt || o.at);
    if (m >= 10) alerts.push({ level: 'rood', kind: 'order', ref: o.ref, supplierCode: o.supplierCode, nudgedAt: o.nudgedAt || null,
      text: 'Bestelling ' + o.ref + ' bij ' + o.supplierName + ' staat al ' + m + ' min onaangeroerd (gast ' + o.customerCodename + ').' });
  }
  for (const r of db.data.rides) {
    if (!r.paid || r.status !== 'aangevraagd' || r.driver) continue;
    const straks = r.plannedFor && (new Date(r.plannedFor) - nu) > 45 * 60000;
    const m = minGeleden(r.paidAt || r.at);
    if (!straks && m >= 10) alerts.push({ level: 'rood', kind: 'ride', ref: r.ref, supplierCode: r.supplierCode, nudgedAt: r.nudgedAt || null,
      text: 'Rit ' + r.ref + ' bij ' + r.supplierName + ' wacht al ' + m + ' min op een chauffeur (gast ' + r.customerCodename + ').' });
    else if (straks && (new Date(r.plannedFor) - nu) < 24 * 3600000) alerts.push({ level: 'amber', kind: 'ride', ref: r.ref, supplierCode: r.supplierCode, nudgedAt: r.nudgedAt || null,
      text: 'Geplande rit ' + r.ref + ' (' + String(r.plannedFor).slice(0, 16).replace('T', ' ') + ') bij ' + r.supplierName + ' heeft nog geen chauffeur.' });
  }
  const verif = accounts.listByVerification('pending').length;
  if (verif) alerts.push({ level: 'amber', kind: 'verify', text: verif + ' identiteitsverificatie(s) wachten op beoordeling.' });
  const wachtend = conciergeInbox().filter(c => c.needsConcierge).length;
  if (wachtend) alerts.push({ level: 'amber', kind: 'concierge', text: wachtend + ' lid/leden wachten op een antwoord van de concierge.' });
  const trustOpen = (db.data.trustLine || []).filter(t => t.open).length;
  if (trustOpen) alerts.push({ level: 'amber', kind: 'trust', text: trustOpen + ' bericht(en) op de vertrouwenslijn wachten op de vertrouwenspersoon.' });
  const nieuwePartners = (db.data.partnerApplications || []).filter(p => p.status === 'nieuw').length;
  if (nieuwePartners) alerts.push({ level: 'info', kind: 'partner', text: nieuwePartners + ' nieuwe partner-aanvraag/aanvragen om te beoordelen.' });
  const wachtScholen = Object.values(((db.data.foundation || {}).scholen) || {}).filter(s => (s.status || 'actief') === 'wacht');
  if (wachtScholen.length) alerts.push({ level: 'info', kind: 'school', text: wachtScholen.length + ' schoolaanmelding(en) voor RTF School om te beoordelen.' });
  const openFuncties = ((db.data.techniek || {}).functieVerzoeken || []).filter(v => v.status === 'wacht').length;
  if (openFuncties) alerts.push({ level: 'amber', kind: 'functie',
    text: openFuncties + ' functieaanvraag/-aanvragen wachten op bevestiging van de eigenaar. Accepteren of weigeren kan alleen op de technische pagina.' });
  const kritiekeBeveiliging = beveilig.openKritiek();
  if (kritiekeBeveiliging) alerts.push({ level: 'rood', kind: 'beveiliging',
    text: kritiekeBeveiliging + ' kritieke beveiligingsmelding(en). Bekijk ze op de technische pagina onder Beveiliging.' });
  const nieuweSollicitaties = applications.filter(a => a.status === 'nieuw').length;
  if (nieuweSollicitaties) alerts.push({ level: 'info', kind: 'apps', text: nieuweSollicitaties + ' open sollicitatie(s) bij partners.' });
  const volgorde = { rood: 0, amber: 1, info: 2 };
  alerts.sort((a, b) => volgorde[a.level] - volgorde[b.level]);
  return {
    prices: db.data.supplierPrices.slice(0, 60),
    orders: db.data.orders.filter(o => o.status !== 'wacht-op-betaling').slice(0, 60),
    rides: db.data.rides.filter(r => r.status !== 'wacht-op-betaling').slice(0, 60),
    live: live.slice(0, 40),
    applications: applications.slice(0, 40),
    // de zaken-lijst is begrensd (het echte aantal staat in totals.partners);
    // een rauwe dump van miljoenen zaken zou het antwoord onbruikbaar maken
    suppliers: db.data.suppliers.slice(0, 1000).map(publicSupplier),
    partnerApplications: (db.data.partnerApplications || []).slice(0, 40),
    pendingSchools: wachtScholen.map(s => ({ code: s.code, naam: s.naam, plaats: s.plaats, at: s.at,
      personeel: Object.keys(s.personeel || {}).length })).slice(0, 40),
    stats, week, performance: performance.slice(0, 12), alerts: alerts.slice(0, 20),
    // totalen over de volledige data, zodat de schermen eerlijk blijven
    // vertellen hoeveel er echt is, hoe groot de lijsten ook worden
    totals: {
      // levend plus archief: het totaal blijft eerlijk, hoe oud tickets ook worden
      orders: db.data.orders.filter(o => o.status !== 'wacht-op-betaling').length + archief.stat().aantal,
      rides: db.data.rides.filter(r => r.status !== 'wacht-op-betaling').length,
      leden: ledenAantal(),
      // actieve zaken in het geheugen plus de bulk-zaken in het grootboek (Postgres)
      partners: db.data.suppliers.length + (grootAantal ? grootAantal() : 0),
      live: live.length
    }
  };
}

// De volledige tijdlijn van bestellingen en ritten: gepagineerd en doorzoekbaar
// over alles wat er ooit was, niet alleen de laatste zestig regels.

// Volledige export voor de boekhouding, op de server opgebouwd.



// Backoffice port een partner: een vriendelijke herinnering bij een blijven-liggen
// bestelling of rit. Maximaal een keer per tien minuten per regel.

// Dagbriefing: een leesbare samenvatting van de dag, opgebouwd uit de echte
// cijfers (geen AI-sleutel nodig, dus altijd beschikbaar en altijd juist).

/* Backoffice: identiteitsverificaties beoordelen. */
function pendingVerifications() {
  // De backoffice mag voor de KYC-controle de echte naam/e-mail uit de kluis zien.
  return accounts.listByVerification('pending').map(u => ({
    id: u.id, name: accounts.realNameOf(u), email: accounts.emailOf(u), codename: u.codename,
    tier: u.tier, doc: u.id_doc, at: u.created_at
  }));
}


// Het geüploade document bekijken (alleen backoffice; token via query voor <img>).

/* ---------- persoonlijke AI ---------- */

const AI_TONE = {
  rtg: 'Je bent "de Butler": rustig, ingetogen, old money kalmte. Je tutoyeert niet, je vousvoyeert.',
  lifestyle: 'Je werkt naast de persoonlijke concierge: warm, voorkomend en persoonlijk. U-vorm.',
  business: 'Je bent een uitvoerende AI voor een zakelijk lid: kort, precies, to the point. U-vorm, geen overbodige woorden.'
};

function aiSystemPrompt(tier) {
  const persona = PERSONAS[tier];
  const trip = db.data.trip;
  const openInvoices = db.data.invoices.filter(i => i.status === 'open');
  return [
    'Je bent de exclusieve persoonlijke reis-AI van Rahul Travel Group (RTG), een membership-reisclub die tegen inkoopprijs boekt en 30% van elke ledenbijdrage aan de RTFoundation doneert.',
    AI_TONE[tier] || AI_TONE.rtg,
    'Je bent de frictieloze vriend van het lid: je wacht niet op vragen maar denkt vooruit. Signaleer zelf wat geregeld moet worden (openstaande betalingen, aanvragen die nog niet bevestigd zijn, vergeten voorbereidingen) en sluit elk antwoord af met één concreet voorstel dat het lid met een enkel "ja" kan afdoen. Betalingen gaan in het portaal met één tik (Face ID of Apple Pay), verwijs daarnaar, vraag nooit om betaalgegevens.',
    'Zegt het lid "ja" of iets vergelijkbaars, dan bevestig je kort dat het geregeld is en noem je wat je vervolgens in de gaten houdt.',
    'Je helpt het lid met reisvoorbereiding: paklijsten, documenten en visa, weer, dagplanning, restaurants en wijzigingen aan geboekte diensten. Antwoord in het Nederlands, beknopt (maximaal ~120 woorden), zonder opsmuk.',
    `Het lid: ${persona.full} (${tier === 'rtg' ? 'RTG Pass' : tier === 'lifestyle' ? 'Lifestyle Pass' : 'Business Pass'}), lid sinds ${persona.since}.`,
    `Komende reis: ${trip.dest}, ${trip.dates} (over ${trip.days} dagen). Geboekte diensten: ${trip.items.map(i => `${i.title} [${i.label}]`).join('; ')}.`,
    openInvoices.length
      ? `Openstaande betalingen: ${openInvoices.map(i => `${i.desc} (€ ${i.netto + i.bijdrage})`).join('; ')}. Wijs daar alleen op als het relevant is.`
      : 'Er staan geen betalingen open.',
    'Verzin geen boekingen of prijzen die hierboven niet staan. Als je iets niet weet of niet kunt regelen, zeg dat eerlijk en bied aan het uit te zoeken.'
  ].join('\n');
}

/* Demo-antwoorden wanneer er geen Claude API-key is. */
function cannedAnswer(q) {
  const l = q.toLowerCase().trim();
  if (/^(ja|graag|ja graag|doe maar|prima|goed|regel het|ja, regel het)\b/.test(l))
    return 'Geregeld. De paklijst staat klaar in uw reisoverzicht (lichte kleding, zwemkleding, zonnebescherming, een lichte trui voor de avond) en het dagplan voor 20 juli is ingepland: 10:00 privéboot naar Formentera, lunch aan boord, en om 21:00 uw tafel bij Sal de Mar.\n\nVolgende dat ik in de gaten houd: de bevestiging van Sal de Mar. U hoeft niets te doen.';
  if (l.includes('inpak') || l.includes('paklijst') || l.includes('koffer'))
    return 'Voor Ibiza in juli (25-31°C, zonnig):\n• Lichte kleding + zwemkleding\n• Zonnebrand en een hoed\n• Nette outfit voor Sal de Mar\n• Een lichte trui voor de avonden aan zee\n\nZal ik hier een afvinklijst van maken in uw reisoverzicht?';
  if (l.includes('visum') || l.includes('paspoort') || l.includes('document'))
    return 'Voor Ibiza (Spanje, EU) heeft u als Nederlander geen visum nodig; een geldige ID-kaart of paspoort volstaat. Ik zet uw boekingsbevestigingen alvast klaar in de app, mocht ernaar gevraagd worden.';
  if (l.includes('weer'))
    return 'Ibiza medio juli: gemiddeld 25-31°C, veel zon en warme avonden. De beste tijd voor de boot naar Formentera is vroeg in de ochtend, vóór de drukte; zal ik het vertrek op 10:00 laten aanhouden?';
  if (l.includes('plan') || l.includes('dag') || l.includes('doen'))
    return 'Voorstel voor 20 juli:\n• 10:00 privéboot naar Formentera\n• 13:00 lunch aan boord of op het strand\n• 18:00 terug, borrel bij Sunset Ibiza\n• 21:00 diner bij Sal de Mar (staat in aanvraag)\n\nZal ik de strandlunch laten reserveren?';
  if (l.includes('restaurant') || l.includes('eten') || l.includes('diner'))
    return 'Uw tafel bij Sal de Mar (19 jul, 21:00) is in aanvraag, bevestiging volgt doorgaans binnen 48 uur. Wilt u een reservelijst? Ik denk aan een strandrestaurant in Cala Jondal of een adres in Marina Botafoch, beide via ons netwerk tegen normale prijs.';
  return 'Daar zoek ik het fijne van uit en ik kom er vandaag nog op terug. Voor uw reis naar Ibiza kan ik alvast helpen met de paklijst, documenten, het weer of een dagplanning, zeg het maar.';
}


/* ================= GEKOPPELD GESPREK: WhatsApp + app in één thread =================
   Elk lid heeft één doorlopend gesprek. Of ze nu via WhatsApp of in de app
   schrijven, het komt in dezelfde thread. RTG Pass wordt beantwoord door de
   Butler (AI); Lifestyle en Business gaan naar een menselijke concierge, die in
   de backoffice antwoordt. In productie loopt WhatsApp via de WhatsApp Business
   API (Meta/Twilio); hier is de webhook gesimuleerd. */

async function generateAiReply(tier, convo) {
  const history = convo
    .filter(m => m.from === 'member' || m.from === 'butler')
    .map(m => ({ role: m.from === 'member' ? 'user' : 'assistant', content: String(m.text).slice(0, 2000) }))
    .slice(-12);
  while (history.length && history[0].role !== 'user') history.shift();
  const last = history.length ? history[history.length - 1].content : '';
  if (anthropic && history.length && history[history.length - 1].role === 'user') {
    try {
      const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 1024, system: aiSystemPrompt(tier), messages: history });
      const reply = r.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      if (reply) return reply;
    } catch (e) { console.error('Claude-fout (butler):', e.message); }
  }
  return cannedAnswer(last);
}

function convOf(userId) { const md = accounts.getMemberState(userId) || {}; return md.conversation || []; }

async function memberSays(user, text, channel) {
  const md = accounts.getMemberState(user.id) || {};
  md.conversation = md.conversation || [];
  md.conversation.push({ from: 'member', text: String(text).slice(0, 1000), at: new Date().toISOString(), channel });
  if (user.tier === 'rtg') {
    // De Butler (AI) antwoordt meteen.
    const reply = await generateAiReply(user.tier, md.conversation);
    md.conversation.push({ from: 'butler', text: reply, at: new Date().toISOString(), channel: 'butler' });
    md.needsConcierge = false;
  } else {
    // Lifestyle/Business: een mens (concierge) reageert via de backoffice.
    md.needsConcierge = true;
  }
  md.conversation = md.conversation.slice(-120);
  accounts.saveMemberState(user.id, md);
  broadcastSync([user.tier], 'chat');
  if (user.tier !== 'rtg') sseToOffice('sync', { scope: 'concierge' });
}



/* Inkomend WhatsApp-bericht. In productie de door Meta ondertekende webhook;
   hier een eenvoudige { from, text } om de koppeling te demonstreren. */
app.post('/api/whatsapp/webhook', async (req, res) => {
  const from = req.body.from || (((req.body.entry || [])[0]?.changes || [])[0]?.value?.messages || [])[0]?.from;
  const text = req.body.text || (((req.body.entry || [])[0]?.changes || [])[0]?.value?.messages || [])[0]?.text?.body;
  if (!from || !text) return res.status(400).json({ error: 'Nummer of tekst ontbreekt.' });
  const user = accounts.findByPhone(from);
  if (!user) return res.json({ ok: true, matched: false }); // onbekend nummer: negeren
  try {
    await memberSays(user, text, 'whatsapp');
    res.json({ ok: true, matched: true });
  } catch (e) {
    console.error('[whatsapp]', e && e.message);
    res.status(200).json({ ok: true, matched: true, deferred: true }); // webhook nooit laten falen
  }
});

/* Backoffice: concierge-inbox voor Lifestyle/Business-leden. */
function conciergeInbox() {
  return accounts.conversations()
    .filter(c => c.tier === 'lifestyle' || c.tier === 'business')
    .map(c => {
      const last = c.conversation[c.conversation.length - 1] || {};
      return { userId: c.id, codename: c.codename, tier: c.tier, needsConcierge: c.needsConcierge,
        last: last.text || '', lastAt: last.at || null, lastFrom: last.from || '', messages: c.conversation };
    })
    .sort((a, b) => (b.needsConcierge - a.needsConcierge) || (new Date(b.lastAt) - new Date(a.lastAt)));
}


/* ---------- domeinmodules: aparte routers op de gedeelde kern ----------
   Elk domein is een los bestand dat zijn routes op dezelfde app registreert en
   uitsluitend via deze kern met de gedeelde data en realtime praat. Zo kan een
   domein later als eigen proces draaien zonder de routecode te veranderen. */
const kern = {
  AI_TONE, ALT_IDEE, AUTHOR_TIER, BOEK_KETEN, CLUSTER_KEY, CSP_NONCE, DATA_DIR, DEMO,
  DEMO_PASS, DEMO_SUPPLIER, DEMO_USER, DOOR_RELOCK_MS, FIN_CAT, FISCAAL_PEILJAAR, HK_STATUSES, LANDEN,
  OFFICE_CODE, PERSONAS, POS_METHODS, PRODUCTION, PUBLIC_DIR, RIT_KETEN, RIT_LEGACY, RIT_MELDING,
  RUN_STATIONS, SHIFT_NAMES, SSE_BUFFER_TTL, STAFF_SEED, TABLE_STATUSES, TOKEN_TTL_MS, UPLOAD_DIR, VAC_SOORTEN,
  ZAAK_OPTIES, ZZP, accounts, addContact, addTicket, aiFindDoor, aiFindRoom, archief, beveilig, eigenaar,
  aiSystemPrompt, alcoholGrensVan, anthropic, app, appUrl, applyChatPubliek, auth, betaal, broadcastSync,
  bufferEvent, bus, canEngage, cannedAnswer, cannedBoekhouder, cateringDishes, centen, chatApplicant,
  chatKeyOf, chatStuur, checkCred, coachCache, coachRules, conciergeInbox, connectedSupplierCodes, convOf,
  crypto, cvReady, db, deptsFor, dirTouch, eisAccount, engageError, ensureApplyChat,
  ensureSupplierDefaults, etaMinutes, eventCovers, express, fallbackRunsheet, financeVoor, findPartner, findStaffPartner,
  findSupplier, forgetSession, fs, gcCode, geborenVan, geenGast, generateAiReply, getChat,
  guestsFor, hasContact, hasCred, haversine, i18n, initRealtime, klokVan, ledenPrijs,
  leeftijdVan, leeftijdsgroepVan, leverSse, liveCodename, liveStateFor, load, logActivity, loginFails,
  mail, makeSupplierCode, managerOnly, meldWerkgever, memberSays, memberTemplate, myApplications, nextSseId,
  noteFailedTry, notify, notifyApplicant, notifySupplier, officeAuth, officeState, openVacatures, optieAan,
  entreeCode, keyVanCodenaam, gidsHaal, gidsZoekCodenaam, magBezorgen, parseRunsheetText, path, pendingVerifications, pickupCode, pinFails, posDay, publicPartner, publicSupplier, ticketsVoorSlot,
  publicTrip, pushLive, registerContact, rememberSession, resolveSession, ritBezetting, ritVerder, rtf,
  runItem, runKey, salonNaarVolgers, save, scheduleFor, schoon, sectiesForOrder, sendPush,
  sendPushToUser, sessionFor, sessions, setRoomHk, sortRunsheet, speelOpnieuw, sseBuffer, sseClients,
  sseSend, sseToCustomer, sseToOffice, sseToSupplier, stateFor, stationsForOrder, supplierAuth, supplierState,
  toRad, tokenHash, tooManyTries, trChat, trustVan, unlockDoor, urenVan, validDept,
  webpush, weekdagFactor, werkgeverSollicitatie
};
Object.assign(kern, sociaal); // de sociale kern-helpers erbij
/* Welke domeinen dit proces bedient. Standaard alle (een proces, gedeeld
   geheugen, zoals nu). Met RTG_DOMAINS=member,social draait dit proces alleen
   die domeinen; een gateway (server/poort.js) stuurt de padprefixen dan naar
   het juiste domeinproces. De infra-endpoints (health, stream, push, cluster,
   translate) en de foundation-mount zitten in de kern en draaien altijd mee. */
const ALLE_DOMEINEN = ['auth', 'member', 'supplier', 'office', 'staff', 'social', 'techniek', 'zakelijk'];
const gekozenDomeinen = (process.env.RTG_DOMAINS || ALLE_DOMEINEN.join(','))
  .split(',').map(s => s.trim()).filter(s => s && s !== '-'); // '-' = bewust geen domeinen (vloot)
for (const naam of gekozenDomeinen) {
  if (!ALLE_DOMEINEN.includes(naam)) { console.warn('[start] onbekend domein overgeslagen:', naam); continue; }
  require('./routes/' + naam)(kern);
}
console.log('[start] domeinen actief:', gekozenDomeinen.join(', '));

/* Archiveren gebeurt bij het opstarten en daarna elk uur. In vloot-modus doet
   alleen het office-domein dit, zodat niet twee processen tegelijk aan de
   orders-collectie trekken. */
if (gekozenDomeinen.includes('office')) {
  try { archief.archiveerNu(); } catch (e) { console.warn('[archief] ronde mislukt:', e.message); }
  const archiefTimer = setInterval(() => {
    try { archief.archiveerNu(); } catch (e) { console.warn('[archief] ronde mislukt:', e.message); }
  }, 3600000);
  if (archiefTimer.unref) archiefTimer.unref();
}

/* ---------- afsluiters: nette 404 en centrale foutafhandeling ---------- */

app.use('/api', (req, res) => res.status(404).json({ error: 'Onbekend eindpunt.' }));
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '..', 'public', 'site', '404.html'));
});
app.use((err, req, res, next) => {
  log.uitzondering(err instanceof Error ? err : new Error(String(err)), { id: req && req.id, p: req && req.path });
  if (res.headersSent) return next(err);
  res.status(err && err.type === 'entity.too.large' ? 413 : (err.status || 500))
     .json({ error: 'Er ging iets mis. Probeer het opnieuw.', id: req && req.id });
});

/* ---------- dagelijkse back-up van de data ---------- */

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
function backupData() {
  if (!db.writable) return; // standby-servers maken geen backups, dat doet de actieve
  try {
    const day = new Date().toISOString().slice(0, 10);
    const dir = path.join(BACKUP_DIR, day);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(dir, 0o700); } catch (e) {}
    for (const f of ['db.json', 'rtg.db', 'store.db']) {
      const from = path.join(DATA_DIR, f);
      if (fs.existsSync(from)) { const doel = path.join(dir, f); fs.copyFileSync(from, doel); try { fs.chmodSync(doel, 0o600); } catch (e) {} }
    }
    // hooguit 14 dagen bewaren
    const days = fs.readdirSync(BACKUP_DIR).sort();
    for (const d of days.slice(0, Math.max(0, days.length - 14)))
      fs.rmSync(path.join(BACKUP_DIR, d), { recursive: true, force: true });
    // extra kopie naar een tweede schijf/mount (RTG_BACKUP_DIR), zodat een
    // backup ook een crash van de app-schijf overleeft.
    if (process.env.RTG_BACKUP_DIR) {
      const off = path.join(process.env.RTG_BACKUP_DIR, day);
      fs.mkdirSync(off, { recursive: true });
      for (const f of ['db.json', 'rtg.db', 'store.db']) {
        const from = path.join(DATA_DIR, f);
        if (fs.existsSync(from)) fs.copyFileSync(from, path.join(off, f));
      }
    }
  } catch (e) { console.warn('[backup] mislukt:', e.message); }
}

/* ---------- start ---------- */

initRealtime();
// Gedeelde data via Redis aanzetten (JSON-opslag, lees-replica's).
startGedeeld().catch(e => console.warn('[db] gedeelde data mislukt:', e.message));
// Kruisproces-synchronisatie voor de SQLite-opslag (echt losse schrijvende servers).
startSqliteSync();
// PostgreSQL-opslag aanzetten (gedeelde, duurzame database over meerdere instances).
startPostgres().catch(e => log.uitzondering(e instanceof Error ? e : new Error(String(e)), { bron: 'startPostgres' }));
// Accounts eveneens delen via PostgreSQL (zodat een registratie op instance A ook
// op instance B werkt); zonder DATABASE_URL blijft dit inert.
accounts.startPostgres().catch(e => log.uitzondering(e instanceof Error ? e : new Error(String(e)), { bron: 'accounts.startPostgres' }));
// Periodiek onderhoud: verlopen snelheidslimiet-tellers en oude event-buffers
// opruimen, zodat het geheugen niet langzaam volloopt bij veel unieke bezoekers.
setInterval(() => {
  const nu = Date.now();
  for (const [k, f] of loginFails) if (f.until < nu) loginFails.delete(k);
  for (const [k, f] of pinFails) if (f.until < nu) pinFails.delete(k);
  ruimBuffer();
}, 5 * 60 * 1000).unref();
backupData();
setInterval(backupData, 24 * 60 * 60 * 1000);

// Eerlijke opstartcontrole: waarschuw als demo-instellingen mee naar productie gaan.
if (PRODUCTION) {
  if (!process.env.OFFICE_CODE) console.warn('[start] LET OP: OFFICE_CODE staat op de demo-waarde. Zet een eigen code in de omgeving.');
  if (DEMO) console.warn('[start] LET OP: de demo-inlog (universeel account) is AAN in productie (RTG_DEMO=1). Zet hem uit voor een echte lancering.');
  if (!process.env.SMTP_URL) console.warn('[start] LET OP: geen SMTP_URL; e-mail gaat naar de outbox in plaats van naar klanten.');
  if (!process.env.ANTHROPIC_API_KEY) console.warn('[start] Info: geen ANTHROPIC_API_KEY; AI en chatvertaling draaien in demo-stand.');
}

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  if (process.env.RTG_SERVER) {
    console.log(`klaar op poort ${PORT}, rol: ${db.writable ? 'actief' : 'standby'}`);
  } else {
    console.log(`RTG-portaal draait op http://localhost:${PORT}, open http://localhost:${PORT}/apps/app.html`);
  }
  console.log(`Live updates (SSE) actief${webpush ? ', web-push actief' : ' (web-push niet geladen)'}.`);
});

// Netjes afsluiten: data wegschrijven, verbindingen sluiten, dan pas stoppen.
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  console.log(`[stop] ${sig} ontvangen, data wordt bewaard...`);
  try { save(); } catch (e) {}
  // Bij Postgres: nog een laatste flush zodat niets in de write-behind hangt.
  Promise.allSettled([Promise.resolve(flushBijAfsluiten()), Promise.resolve(accounts.flushBijAfsluiten())]).finally(() => {
    server.close(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 3000).unref();
});
