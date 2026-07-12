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

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { db, load, save, DATA_DIR, startGedeeld, startSqliteSync, startPostgres, flushBijAfsluiten, onExternalChange } = require('./db');
const i18n = require('./translate');
const accounts = require('./accounts');
const mail = require('./mail');
const logboek = require('./log');
const log = logboek.log;
const betaal = require('./betaal');

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
if (DEMO && accounts.count() === 0) {
  const u = accounts.createUser({ username: 'Rahul', email: 'rahul@rtg.example', password: process.env.DEMO_PASS || 'Imran', tier: 'business', realName: 'Rahul Imran', phone: '+31612345678' });
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
  KAITO: [['Milan de Wit', 'manager', 'Personal trainer']]
};
for (const [code, people] of Object.entries(STAFF_SEED)) {
  if (accounts.countStaff(code) === 0) {
    people.forEach(([name, role, func], i) => accounts.createStaff({ supplierCode: code, name, role, func, pin: i === 0 ? '1234' : '5678' }));
  }
}

const app = express();
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
    const owner = accounts.findByLogin(process.env.RTG_OWNER_EMAIL || 'rahul@rtg.example');
    if (u && owner && u.id === owner.id) return next(); // de eigenaar mag er wel bij
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
  const dicht = functies.padGeblokkeerd(p, staat);
  if (dicht) return res.status(503).json({ error: 'Deze functie is tijdelijk uitgeschakeld door de beheerder.', functie: dicht.id, naam: dicht.naam });
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
const sessions = new Map();
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
function tokenHash(token) { return crypto.createHash('sha256').update(String(token)).digest('hex'); }
function rememberSession(token, sess) {
  sess.at = new Date().toISOString();
  const h = tokenHash(token);
  sessions.set(h, sess);
  db.data.sessions[h] = sess;
  const toks = Object.keys(db.data.sessions);
  if (toks.length > 400) {
    toks.sort((a, b) => new Date(db.data.sessions[a].at || 0) - new Date(db.data.sessions[b].at || 0));
    for (const t of toks.slice(0, toks.length - 400)) { delete db.data.sessions[t]; sessions.delete(t); }
  }
  save();
}
// hash is de map-sleutel (zie rememberSession); aanroepers geven de hash door
function forgetSession(hash) {
  sessions.delete(hash);
  if (db.data.sessions) { delete db.data.sessions[hash]; save(); }
}
// Centrale sessie-opzoeking: hasht het token, controleert het verloop en
// schuift het venster op bij actief gebruik (hooguit eens per uur wegschrijven).
function sessionFor(token) {
  if (!token) return null;
  const h = tokenHash(token);
  const sess = sessions.get(h);
  if (!sess) return null;
  const age = Date.now() - new Date(sess.at || 0).getTime();
  if (age > TOKEN_TTL_MS) { forgetSession(h); return null; }
  if (age > 60 * 60 * 1000) { sess.at = new Date().toISOString(); save(); }
  return sess;
}

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
  if (f.n >= 10) { f.until = Date.now() + 5 * 60000; f.n = 0; }
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

const sseClients = []; // { tier, res }

/* Realtime-bus: zonder REDIS_URL in-proces (huidig gedrag), met REDIS_URL via
   Redis pub/sub zodat live-events ook gebruikers op een ander domeinproces
   bereiken. Elke sseTo*-functie publiceert; elk proces levert de events af aan
   zijn eigen open verbindingen. */
const bus = require('./bus').maakBus();

/* Betrouwbaarheid: persoonlijke events (dm, snap, belsignaal) krijgen een
   oplopend id en worden kort bewaard per ontvanger. Verbreekt een verbinding
   even (mobiel netwerk, Redis-hik), dan stuurt EventSource bij het herstellen
   zijn laatste id mee (Last-Event-ID) en spelen we de gemiste events opnieuw af.
   Zo gaat een oproep- of chatsignaal niet stil verloren. */
const SSE_BUFFER_TTL = 2 * 60 * 1000; // twee minuten terugspelen is ruim genoeg
const sseBuffer = new Map();          // key -> [{ id, event, data, at }]
let _sseMs = 0, _sseSeq = 0;
function nextSseId() { const t = Date.now(); if (t > _sseMs) { _sseMs = t; _sseSeq = 0; } else { _sseSeq++; } return _sseMs * 1000 + _sseSeq; }
function bufferEvent(key, id, event, data) {
  const nu = Date.now();
  let lijst = sseBuffer.get(key);
  if (!lijst) { lijst = []; sseBuffer.set(key, lijst); }
  lijst.push({ id, event, data, at: nu });
  // opschonen: hooguit 50 per ontvanger en niets ouder dan de TTL
  const vers = lijst.filter(e => nu - e.at < SSE_BUFFER_TTL);
  sseBuffer.set(key, vers.slice(-50));
}
function speelOpnieuw(res, key, sinds) {
  const lijst = sseBuffer.get(key);
  if (!lijst || !sinds) return;
  for (const e of lijst) if (e.id > sinds) sseSend(res, e.event, e.data, e.id);
}
function leverSse(m) {
  if (m.doel === 'key' && m.id) bufferEvent(m.match, m.id, m.event, m.data);
  for (const c of sseClients) {
    let raak = false;
    if (m.doel === 'key') raak = c.key === m.match;
    else if (m.doel === 'sup') raak = c.sup === m.match;
    else if (m.doel === 'office') raak = !!c.office;
    else if (m.doel === 'tier') raak = m.match.includes(c.tier);
    if (raak) sseSend(c.res, m.event, m.data, m.doel === 'key' ? m.id : undefined);
  }
}
bus.subscribe('sse', leverSse);
// Bij gedeelde data (Redis): na een externe wijziging de sessie-index opnieuw
// vullen, zodat een lezersproces tokens kent die de schrijver net aanmaakte.
onExternalChange(() => {
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
function ledenPrijs(publiek, ledenprijs) {
  const p = Math.max(0, Number(publiek) || 0);
  const l = Math.max(0, Number(ledenprijs != null ? ledenprijs : publiek) || 0);
  return Math.min(l, p);
}

function ensureSupplierDefaults(s) {
  if (!Array.isArray(s.menu)) s.menu = [];
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
  // Salon-connecties: leden vinden elkaar op codenaam, chatten en bellen 1-op-1
  if (!db.data.connections) db.data.connections = [];              // { a, b, requestedBy, status, at }
  if (!db.data.memberChats) db.data.memberChats = {};              // 'sleutelA|sleutelB' -> { messages, read }
  if (!db.data.memberDir) db.data.memberDir = {};                  // sleutel -> { codename, tier }
  for (const t of ['rtg', 'lifestyle', 'business'])
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

function sseSend(res, event, data, id) {
  if (id != null) res.write('id: ' + id + '\n');
  res.write('event: ' + event + '\n');
  res.write('data: ' + JSON.stringify(data) + '\n\n');
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
function schoon(v, n) {
  return String(v == null ? '' : v).replace(/[<>]/g, '').slice(0, n || 120).trim();
}

/* Ledengids voor Salon-connecties: sleutel -> codenaam. Wordt bijgehouden
   zodra een lid iets doet; zo kunnen leden elkaar op codenaam vinden
   zonder dat er ooit een echte naam over de lijn gaat. */
function dirTouch(sess) {
  // echte accounts (ook de gratis laag) staan in de codenaam-gids en kunnen
  // elkaar vinden; alleen een anonieme demo-gast zonder account niet
  if (!sess || !db.data.memberDir) return;
  if (sess.tier === 'guest' && !sess.account) return;
  const cn = liveCodename(sess);
  const cur = db.data.memberDir[sess.key];
  if (!cur || cur.codename !== cn || cur.tier !== sess.tier) {
    db.data.memberDir[sess.key] = { codename: cn, tier: sess.tier };
    save();
  }
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
  pid: process.pid, up: Math.round(process.uptime())
}));

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
const sociaal = require('./kern/sociaal')({ db, save, sseToCustomer, rtf, crypto });
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

function publicPartner(p) {
  return { code: p.code, name: p.name, type: p.type, handle: p.handle, hasStaff: !!p.staff };
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

function findSupplier(code) {
  return db.data.suppliers.find(s => s.code === String(code || '').trim().toUpperCase()) || null;
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
  const ORDER_KLAAR = { 'geserveerd': 1, 'geweigerd': 1, 'terugbetaald': 1 };
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
function pickupCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += chars[crypto.randomInt(chars.length)];
  return c;
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
  const tiers = [...new Set(volgers.map(k => (db.data.memberDir[k] || {}).tier).filter(Boolean))];
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

/* Elk gastgesprek is meertalig: ieder schrijft in de eigen taal en de
   ontvanger leest het in de zijne. Vertalingen worden per bericht gecachet. */
async function trChat(messages, to) {
  const out = [];
  for (const m of messages) {
    const from = m.lang || 'nl';
    if (from === to || !m.text) { out.push({ ...m, orig: null }); continue; }
    m.tr = m.tr || {};
    if (!m.tr[to]) {
      try {
        const r = await i18n.translate(m.text, to, from);
        m.tr[to] = (r && typeof r === 'object') ? (r.text || m.text) : String(r || m.text);
        save();
      } catch (e) { m.tr[to] = m.text; }
    }
    out.push({ ...m, text: m.tr[to], orig: m.text, tr: undefined });
  }
  return out;
}

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
/* ---- chat tussen sollicitant en werkgever ----
   Zodra de werkgever een sollicitant uitnodigt of aanneemt, komen beiden in een
   chat om samen een afspraak te maken (langskomen, eerste werkdag). Werkt voor
   RTG-leden en RTFoundation-leden; de app vertaalt de berichten automatisch naar
   ieders eigen taal. Een anonieme sollicitant (zonder account) krijgt e-mail. */
function chatApplicant(a) {
  if (a.viaRTF && a.rtf) return { kind: 'rtf', gezinCode: a.rtf.code, profielId: a.rtf.profielId, naam: a.name };
  if (a.key) return { kind: 'rtg', key: a.key, naam: a.name };
  return null; // anoniem: geen in-app chat
}
function ensureApplyChat(supplierCode, a) {
  if (db.data.applyChats[a.id]) return db.data.applyChats[a.id];
  const applicant = chatApplicant(a);
  if (!applicant) return null;
  const s = findSupplier(supplierCode);
  const chat = { id: a.id, supplierCode, func: a.func, bedrijf: s ? s.name : supplierCode, applicant, berichten: [], at: new Date().toISOString() };
  db.data.applyChats[a.id] = chat;
  return chat;
}
function applyChatPubliek(chat) {
  return { id: chat.id, func: chat.func, bedrijf: chat.bedrijf, metWie: chat.applicant.naam,
    berichten: (chat.berichten || []).map(m => ({ van: m.van, wie: m.wie, tekst: m.tekst, at: m.at })) };
}
// stuur een chatbericht; 'van' is 'werkgever' of 'sollicitant'
function chatStuur(chat, van, wie, tekst) {
  const t = String(tekst || '').trim().slice(0, 1000);
  if (!t) return null;
  const bericht = { van, wie: String(wie || '').slice(0, 60), tekst: t, at: new Date().toISOString() };
  chat.berichten.push(bericht);
  chat.berichten = chat.berichten.slice(-200);
  save();
  // live seintje naar de andere kant
  sseToSupplier(chat.supplierCode, 'sync', { scope: 'team' });
  if (chat.applicant.kind === 'rtg' && chat.applicant.key) sseToCustomer(chat.applicant.key, 'sync', { scope: 'apply' });
  return bericht;
}


// werkgever leest/schrijft in de sollicitatiechat

// een bericht van de sollicitant laat de werkgever meteen iets weten
function meldWerkgever(chat, tekst) {
  notifySupplier(chat.supplierCode, { icon: '💬', title: 'Bericht van ' + chat.applicant.naam, body: String(tekst).slice(0, 80) });
}

// RTG-lid: mijn sollicitatiechats

// RTFoundation-lid: mijn sollicitatiechat (met gezin-token)

/* ---- vacatures: het bedrijf plaatst openstaande functies ----
   Deze vacatures verschijnen ook in de RTFoundation, zodat leden van arme
   gezinnen (vanaf 16 jaar, met een verplicht cv) er in een tik op solliciteren.
   De leeftijdsgrens sluit aan op de RTF-leeftijdsgroepen: standaard 16 jaar. */
const VAC_SOORTEN = ['bijbaan', 'fulltime', 'parttime', 'stage', 'vrijwilliger', 'vakantiewerk'];

/* ---- vacatures voor de RTFoundation ----
   Openbare lijst met alle openstaande vacatures over alle partners heen. De
   RTF-app filtert op de leeftijdsgroep van het profiel (vanaf 16 jaar). */
function openVacatures(minLeeftijd, land) {
  const uit = [];
  for (const [code, list] of Object.entries(db.data.vacatures || {})) {
    const s = findSupplier(code);
    if (!s) continue;
    const t = db.data.supplierTypes[s.type] || {};
    const landCode = (s.settings && LANDEN[s.settings.land]) ? s.settings.land : 'NL';
    if (land && landCode !== land) continue;
    for (const v of list) {
      if (!v.open) continue;
      if (minLeeftijd != null && v.minLeeftijd > minLeeftijd) continue;
      uit.push({
        id: v.id, supplierCode: code, bedrijf: s.name, soort: v.soort,
        type: s.type || null, typeLabel: t.label || null, icon: t.icon || '🏢',
        func: v.func, omschrijving: v.omschrijving, plaats: v.plaats, uren: v.uren,
        minLeeftijd: v.minLeeftijd, at: v.at,
        // land van het bedrijf: RTG is internationaal, dus je solliciteert ook
        // gerust in het buitenland
        land: landCode, landNaam: LANDEN[landCode].naam,
        // locatie van het bedrijf, zodat de app de afstand kan tonen
        loc: s.loc ? { lat: s.loc.lat, lng: s.loc.lng, label: s.loc.label } : null,
        stad: s.city || null
      });
    }
  }
  uit.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  return uit;
}

/* Een RTF-lid solliciteert met het cv uit de RTFoundation-cv-maker. Het cv is
   verplicht vanaf 16 jaar; jonger dan 16 kan niet solliciteren. Het bedrijf
   ziet de sollicitatie in dezelfde lijst als alle andere, zonder RTF-markering.
   We controleren het gezin-token (lichte beveiliging + terugkoppeling), remmen
   spam af en weren dubbele sollicitaties. */

/* Wat de werkgever van een sollicitatie te zien krijgt. Een sollicitant uit de
   RTFoundation mag NOOIT als zodanig herkenbaar zijn: wie via de foundation
   solliciteert, verschijnt bij het bedrijf precies als een gewoon RTG-lid, met
   hetzelfde cv en dezelfde markering. Dat de herkomst de foundation is, houden
   wij alleen intern bij (het veld viaRTF blijft in onze eigen administratie).
   Zo maakt het voor de kans op werk geen enkel verschil waar iemand vandaan komt. */
function werkgeverSollicitatie(a) {
  if (!a) return a;
  // interne velden verlaten nooit onze administratie richting de werkgever:
  // de RTFoundation-herkomst, de sessiesleutel en de gezinsverwijzing
  const { viaRTF, key, rtf, ...rest } = a;
  if (viaRTF) rest.viaRTG = true; // RTF-sollicitant lijkt op een gewoon RTG-lid
  return rest;
}

// Solliciteerde een RTG-lid, dan hoort het lid direct van het besluit:
// live in de app en (bij demo-profielen) als notificatie met push.
function notifyApplicant(a, supplier) {
  const hired = a.status === 'aangenomen';
  // e-mail werkt voor iedereen met een e-mailadres als contact, ook zonder RTG-account
  if (/@/.test(a.contact || '')) {
    mail.send(a.contact, hired ? 'U bent aangenomen bij ' + supplier.name : 'Uw sollicitatie bij ' + supplier.name,
      'Beste ' + a.name + ',\n\n' + supplier.name + ' heeft uw sollicitatie als ' + a.func +
      (hired ? ' geaccepteerd. Het bedrijf neemt contact met u op over uw eerste werkdag.' : ' helaas afgewezen.') +
      '\n\nRahul Travel Group');
  }
  if (!a.key) return;
  if (db.data.notifications[a.key]) {
    notify(a.key, {
      icon: hired ? '🎉' : '📝',
      title: hired ? 'U bent aangenomen!' : 'Sollicitatie afgerond',
      body: supplier.name + ' heeft uw sollicitatie als ' + a.func + (hired ? ' geaccepteerd. Het bedrijf neemt contact met u op.' : ' helaas afgewezen.')
    });
  }
  sseToCustomer(a.key, 'sync', { scope: 'apply' });
}

/* ---- AVG-rechten: inzage en vergetelheid, rechtstreeks vanuit de app ----
   Export levert alles wat op deze persoon herleidbaar is in een JSON;
   verwijderen wist of anonimiseert het en logt alle sessies van dit lid uit. */


/* ---- events: het Kantoor maakt ze, leden melden zich aan, de deur checkt in ---- */

// aan de deur: gast afvinken (elke medewerker mag dit, op eigen naam)

/* ---- het draaiboek: wie doet wat en wanneer, per werkplek ----
   De manager vult het in het Kantoor (handmatig, geplakt of door de AI
   voorgesteld); elke regel verschijnt op het scherm van de juiste werkplek:
   keuken, bar, bediening of de party manager (het Events-scherm). */
const RUN_STATIONS = ['keuken', 'bar', 'bediening', 'party', 'alle'];
function runItem(time, station, text, daysBefore, mep) {
  return {
    id: crypto.randomBytes(3).toString('hex'),
    time: /^\d{2}:\d{2}$/.test(time) ? time : '00:00',
    station: RUN_STATIONS.includes(station) ? station : 'alle',
    text: String(text || '').trim().slice(0, 160),
    daysBefore: Math.min(14, Math.max(0, parseInt(daysBefore, 10) || 0)),
    mep: !!mep,
    done: false, doneBy: null
  };
}
// draaiboeken lopen vaak over middernacht heen: 01:00 afbouw hoort NA 23:00,
// dus alles voor 06:00 telt als "die nacht" en sorteert achteraan
function runKey(t) { const [h, m] = String(t).split(':').map(Number); return ((h < 6 ? h + 24 : h) * 60 + (m || 0)); }
function sortRunsheet(e) { e.runsheet.sort((a, b) => ((b.daysBefore || 0) - (a.daysBefore || 0)) || (runKey(a.time) - runKey(b.time))); }

// handmatig: regel toevoegen of verwijderen (Kantoor)

// afvinken op de werkvloer (elke medewerker, op eigen naam)

// AI-hulp: een draaiboek voorstellen, of geplakte/geuploade tekst omzetten
function fallbackRunsheet(e) {
  // zonder Claude-sleutel: een gedegen standaard-draaiboek rond de starttijd
  const start = /^\d{2}:\d{2}$/.test(e.time || '') ? e.time : '20:00';
  const [h, m] = start.split(':').map(Number);
  const at = min => { const t = h * 60 + m + min; const hh = Math.floor(((t % 1440) + 1440) % 1440 / 60), mm = ((t % 1440) + 1440) % 1440 % 60; return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
  return [
    runItem(at(-180), 'keuken', 'Mise en place voor ' + e.name + ', voorraad controleren'),
    runItem(at(-120), 'bar', 'Bar bevoorraden, koeling vullen, ijs en garnering klaar'),
    runItem(at(-90), 'bediening', 'Zaal en tafels inrichten volgens de indeling'),
    runItem(at(-60), 'party', 'Techniek en muziek testen, licht instellen'),
    runItem(at(-30), 'alle', 'Briefing met het hele team: verloop, allergieen, vips'),
    runItem(at(-15), 'party', 'Gastenlijst openen op het Events-scherm, deurpost bemannen'),
    runItem(at(0), 'party', 'Deuren open, welkom door de party manager'),
    runItem(at(30), 'bediening', 'Eerste ronde langs alle tafels'),
    runItem(at(90), 'keuken', 'Bijvullen en tweede uitgifte voorbereiden'),
    runItem(at(150), 'bar', 'Voorraad peilen, bijbestellen indien nodig'),
    runItem(at(240), 'party', 'Laatste ronde aankondigen, afrekenen voorbereiden'),
    runItem(at(270), 'alle', 'Afbouw: zaal, bar en keuken volgens sluitlijst')
  ];
}
function parseRunsheetText(text) {
  // geplakte regels zoals "18:00 keuken mise en place" of "18.00 - Bar - koeling"
  const items = [];
  for (const line of String(text || '').split('\n')) {
    const l = line.trim(); if (!l) continue;
    const tm = l.match(/(\d{1,2})[:.](\d{2})/);
    const time = tm ? String(tm[1]).padStart(2, '0') + ':' + tm[2] : '00:00';
    const lower = l.toLowerCase();
    const station = /keuken|kitchen|chef/.test(lower) ? 'keuken'
      : /\bbar\b|dranken/.test(lower) ? 'bar'
      : /bediening|service|zaal|tafel/.test(lower) ? 'bediening'
      : /party|deur|dj|muziek|licht|host/.test(lower) ? 'party' : 'alle';
    let txt = l.replace(/(\d{1,2})[:.](\d{2})/, '').replace(/^[\s\-\u00b7:,]+/, '').trim();
    txt = txt.replace(/^(keuken|bar|bediening|party|alle|service)\b[\s\-\u00b7:,]*/i, '').trim();
    if (txt) items.push(runItem(time, station, txt));
    if (items.length >= 40) break;
  }
  return items;
}

/* ---- event-keuken: menukeuze, allergenen met vervangend gerecht, en de
   mise en place die dagen vooruit wordt georganiseerd ---- */

// menukeuze: vast menu (gerechten van de kaart) of a la carte (Kantoor)

// allergenen registreren; per allergeen kan een vervangend gerecht worden bedacht

// gerechten die het event serveert (vast menu, of de hele keukenkaart bij a la carte)
function cateringDishes(s, e) {
  const menu = s.menu || [];
  if (e.catering && e.catering.mode === 'menu')
    return e.catering.itemIds.map(id => menu.find(m => m.id === id)).filter(Boolean);
  if (e.catering && e.catering.mode === 'alacarte')
    return menu.filter(m => m.station !== 'bar');
  return [];
}
function eventCovers(e) {
  const aangemeld = (e.guests || []).reduce((n, g) => n + g.qty, 0);
  return Math.max(aangemeld, Math.ceil(e.capacity * 0.6));
}

// vervangend gerecht verzinnen voor een allergeen (Claude, anders vakkundige fallback)
const ALT_IDEE = {
  noten: ['krokant van geroosterde pompoen- en zonnebloempitten', 'zonder noten, met dezelfde textuur'],
  pinda: ['sesam-soja dressing in plaats van satesaus', 'vrij van pinda'],
  gluten: ['glutenvrije variant met rijstbloem en boekweit', 'volledig glutenvrij bereid'],
  lactose: ['romige basis van kokosmelk en cashewcreme', 'zonder zuivel'],
  melk: ['romige basis van kokosmelk', 'zonder zuivel'],
  vis: ['gegrilde groente met dashi van kombu', 'zonder vis, zelfde umami'],
  schaaldieren: ['knapperige tofu met yuzu-glaze', 'vrij van schaal- en schelpdieren'],
  soja: ['dressing op basis van miso-vrije bouillon en citrus', 'sojavrij'],
  ei: ['binding met aquafaba', 'zonder ei'],
  sesam: ['topping van geroosterde quinoa', 'sesamvrij']
};

// de MEP-organisator: bouwt de complete mise en place voor het keukenteam,
// dagen vooruit, op basis van menu, aantallen en allergenen (keukenscherm/Kantoor)

/* ---- recept/bereidingswijze per gerecht: uitklapbaar op de bon, zodat ook
   nieuwe mensen weten wat ze maken en hoe. De AI schrijft hem desgewenst. ---- */

/* ---- de keukenhulp: AI-coach die zegt wat er nu moet gebeuren ----
   Kijkt naar alle open bonnen: voorrang voor oude bonnen, dezelfde gerechten
   in een keer maken, en per tafel alles tegelijk laten uitgaan. */
const coachCache = new Map(); // code -> { hash, lines, at }
function coachRules(s, open, lang) {
  const en = lang === 'en';
  const lines = [];
  const nu = Date.now();
  const age = o => Math.round((nu - new Date(o.at)) / 60000);
  const tafel = o => o.table ? o.table : null;
  // 1. voorrang: oudste onaangeroerde bon
  const vers = open.filter(o => !Object.keys(o.secties || {}).length && !Object.keys(o.stations || {}).length);
  if (vers.length) {
    const oudste = vers.reduce((a, b) => new Date(a.at) < new Date(b.at) ? a : b);
    const wie = oudste.pickup + (tafel(oudste) ? ' (' + tafel(oudste) + ')' : '');
    lines.push(en ? '\u25b6 Pick up first: ticket ' + wie + ', waiting ' + age(oudste) + ' min.'
                  : '\u25b6 Eerst oppakken: bon ' + wie + ', wacht ' + age(oudste) + ' min.');
  }
  // 2. te laat
  for (const o of open) if (age(o) >= 12 && o.status !== 'klaar') {
    const wie = o.pickup + (tafel(o) ? ' (' + tafel(o) + ')' : '');
    lines.push(en ? '\u26a0 Ticket ' + wie + ' has been waiting ' + age(o) + ' min, give it priority.'
                  : '\u26a0 Bon ' + wie + ' wacht al ' + age(o) + ' min, geef voorrang.');
  }
  // 3. batchen: hetzelfde gerecht op meerdere bonnen tegelijk maken
  const per = {};
  for (const o of open) for (const it of (o.items || [])) {
    const m = (s.menu || []).find(x => x.id === it.id);
    if (!m || m.station === 'bar') continue;
    const sec = m.sectie || 'warm';
    if ((o.secties || {})[sec] === 'klaar') continue;
    per[it.id] = per[it.id] || { name: it.name, qty: 0, bonnen: [] };
    per[it.id].qty += it.qty; per[it.id].bonnen.push(o.pickup);
  }
  for (const p of Object.values(per)) if (p.bonnen.length >= 2)
    lines.push(en ? '\uD83C\uDF73 Make ' + p.qty + '\u00d7 ' + p.name + ' in one go (tickets ' + p.bonnen.join(', ') + ').'
                  : '\uD83C\uDF73 Maak ' + p.qty + '\u00d7 ' + p.name + ' in \u00e9\u00e9n keer (bonnen ' + p.bonnen.join(', ') + ').');
  // 4. samen uitsturen: binnen een bon is een kant klaar terwijl een andere nog niet gestart is
  for (const o of open) {
    const nodig = sectiesForOrder(s, o);
    const klaarK = nodig.filter(x => (o.secties || {})[x] === 'klaar');
    const nietGestart = nodig.filter(x => !(o.secties || {})[x]);
    if (klaarK.length && nietGestart.length) {
      const wie = o.pickup + (tafel(o) ? ' (' + tafel(o) + ')' : '');
      lines.push(en ? '\u23f1 Ticket ' + wie + ': ' + klaarK.join('/') + ' is done, start ' + nietGestart.join(' and ') + ' so everything leaves together.'
                    : '\u23f1 Bon ' + wie + ': ' + klaarK.join('/') + ' is klaar, start ' + nietGestart.join(' en ') + ' zodat alles samen uitgaat.');
    }
  }
  // 5. tafels: meerdere bonnen voor dezelfde tafel gelijktrekken
  const perTafel = {};
  for (const o of open) if (o.table) { perTafel[o.table] = perTafel[o.table] || []; perTafel[o.table].push(o); }
  for (const [t, os] of Object.entries(perTafel)) if (os.length >= 2)
    lines.push(en ? '\uD83E\uDE91 ' + t + ' has ' + os.length + ' tickets (' + os.map(o => o.pickup).join(', ') + '): line up the sections so the table leaves in one go.'
                  : '\uD83E\uDE91 ' + t + ' heeft ' + os.length + ' bonnen (' + os.map(o => o.pickup).join(', ') + '): stem de kanten af zodat de tafel in \u00e9\u00e9n keer uitgaat.');
  return lines.slice(0, 6);
}

/* ---- dagelijkse mise en place (a la carte, geen event) ----
   De keuken voorspelt de dag: verwachte couverts uit de verkoophistorie van de
   afgelopen drie weken, de tafelcapaciteit en de weekdag; per gerecht een
   portie-aantal en een MEP-takenlijst voor het team. */
function weekdagFactor(d) {
  const wd = d.getDay(); // 0 = zondag
  if (wd === 5 || wd === 6) return [1.25, 'vrijdag/zaterdag, druk'];
  if (wd === 0) return [1.0, 'zondag, gemiddeld'];
  return [0.85, 'doordeweeks, rustiger'];
}


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
function cvReady(cv) {
  return !!(cv && cv.name && cv.contact && ((cv.experience || []).length || (cv.skills || []).length));
}

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
   Een praktische samenvatting van btw-tarieven, werkgeverslasten en
   aangifteregels per land, als kennisbasis voor de AI-boekhouder.
   Voorlichting voor de demo-omgeving; geen bindend fiscaal advies.
   PEILJAAR: het jaar waarvoor de tarieven en bedragen hieronder zijn
   nagelopen. Tarieven, aftrekposten en heffingskortingen wijzigen jaarlijks;
   werk dit getal en de tabellen (LANDEN en ZZP) elk jaar bij en laat ze
   fiscaal toetsen. Het peiljaar gaat mee in elke fiscale API-uitkomst, zodat
   de gebruiker altijd ziet op welk jaar een berekening is gebaseerd. */
const FISCAAL_PEILJAAR = 2025;
const LANDEN = {
  NL: { naam: 'Nederland', alcoholLeeftijd: 18, tarieven: { eten: 9, drank: 21, logies: 9, vervoer: 9, jet: 0, standaard: 21 },
    lasten: 0.28, vakantiegeld: 0.08, uurloonMin: 14.06,
    aangifte: 'Btw-aangifte per kwartaal (of maandelijks), loonaangifte maandelijks bij de Belastingdienst.',
    extra: 'Toeristenbelasting verschilt per gemeente (Amsterdam 12,5% op logies). Eten en niet-alcoholische dranken 9%, alcohol 21%.',
    zakelijk: { horeca: 'Btw op eten en drinken in een horecagelegenheid is NIET aftrekbaar; de kosten zelf zijn wel opvoerbaar.',
      logies: 'Btw op een zakelijke overnachting (9%) is aftrekbaar.',
      vervoer: 'Btw op taxi en openbaar vervoer (9%) is aftrekbaar bij zakelijk gebruik.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief; er is dus geen btw om terug te vorderen.' } },
  BE: { naam: 'Belgie', alcoholLeeftijd: 18, tarieven: { eten: 12, drank: 21, logies: 6, vervoer: 6, jet: 0, standaard: 21 },
    lasten: 0.27, vakantiegeld: 0.092, uurloonMin: 12.11,
    aangifte: 'Btw-aangifte per maand of kwartaal; DIMONA-melding voor elk personeelslid voor de eerste werkdag.',
    extra: 'Restaurantdiensten 12%, dranken 21%; de witte kassa (GKS) is verplicht in de horeca boven de omzetdrempel.',
    zakelijk: { horeca: 'Btw op restaurantkosten is niet aftrekbaar; de kosten zijn voor 69% aftrekbaar in de vennootschapsbelasting.',
      logies: 'Btw op een zakelijke hotelovernachting (6%) is aftrekbaar.',
      vervoer: 'Btw op personenvervoer (6%) is beperkt aftrekbaar.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  DE: { naam: 'Duitsland', alcoholLeeftijd: 18, tarieven: { eten: 19, drank: 19, logies: 7, vervoer: 7, jet: 0, standaard: 19 },
    lasten: 0.21, vakantiegeld: 0, uurloonMin: 12.82,
    aangifte: 'Umsatzsteuer-Voranmeldung per maand of kwartaal via ELSTER; loonaangifte maandelijks.',
    extra: 'Eten in het restaurant 19%, afhaal en bezorging 7%. Hotelovernachting 7%, maar het ontbijt 19%: gesplitst factureren.',
    zakelijk: { horeca: 'Bewirtungskosten: 70% aftrekbaar als kosten; de btw is volledig aftrekbaar met een correct Bewirtungsbeleg.',
      logies: 'Btw op de overnachting (7%) is aftrekbaar; het ontbijt staat apart op 19%.',
      vervoer: 'Btw op taxiritten tot 50 km (7%) is aftrekbaar.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  FR: { naam: 'Frankrijk', alcoholLeeftijd: 18, tarieven: { eten: 10, drank: 20, logies: 10, vervoer: 10, jet: 0, standaard: 20 },
    lasten: 0.42, vakantiegeld: 0, uurloonMin: 11.88,
    aangifte: 'TVA per maand (regime reel) of per kwartaal; taxe de sejour per overnachting per gemeente.',
    extra: 'Eten en niet-alcoholische dranken 10%, alcohol 20%. Werkgeverslasten horen bij de hoogste van Europa.',
    zakelijk: { horeca: 'TVA op zakelijke maaltijden is aftrekbaar met een factuur op bedrijfsnaam.',
      logies: 'TVA op hotelkosten voor eigen werknemers is NIET aftrekbaar; voor genodigden wel.',
      vervoer: 'TVA op personenvervoer is niet aftrekbaar.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  ES: { naam: 'Spanje', alcoholLeeftijd: 18, tarieven: { eten: 10, drank: 21, logies: 10, vervoer: 10, jet: 0, standaard: 21 },
    lasten: 0.30, vakantiegeld: 0, uurloonMin: 8.87,
    aangifte: 'IVA per kwartaal (modelo 303) met een jaaroverzicht (modelo 390); loonaangifte maandelijks.',
    extra: 'Horeca en hotels 10%; alcohol in de winkel 21%, als onderdeel van de horecadienst 10%.',
    zakelijk: { horeca: 'IVA op zakelijke maaltijden is aftrekbaar met een volledige factuur (factura completa).',
      logies: 'IVA op zakelijke overnachtingen is aftrekbaar.',
      vervoer: 'IVA op vervoer is aftrekbaar bij zakelijk gebruik.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  JP: { naam: 'Japan', alcoholLeeftijd: 20, tarieven: { eten: 10, drank: 10, logies: 10, vervoer: 10, jet: 0, standaard: 10 },
    lasten: 0.16, vakantiegeld: 0, uurloonMin: 6.7,
    aangifte: 'Consumption tax (10%) jaarlijks of per kwartaal; sinds 2023 is een qualified invoice vereist voor aftrek.',
    extra: 'Ter plaatse eten 10%, afhaal 8%. Accommodation tax per stad (sommige steden heffen per persoon per nacht).',
    zakelijk: { horeca: 'Consumption tax op zakelijke maaltijden is aftrekbaar met een qualified invoice.',
      logies: 'Consumption tax op het hotel is aftrekbaar; de accommodation tax is een kostenpost.',
      vervoer: 'Consumption tax op taxiritten is aftrekbaar met een qualified invoice.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } }
};

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





/* ---- de boekhouding van de zaak: btw per genre, personeelskosten, cadeaukaarten ---- */
function centen(n) { return Math.round(n * 100) / 100; }
const FIN_CAT = { eten: 'Eten (keuken)', drank: 'Dranken (bar)', logies: 'Logies', vervoer: 'Personenvervoer', jet: 'Internationaal vervoer', dienst: 'Diensten & producten' };

function financeVoor(s) {
  const landCode = (s.settings && LANDEN[s.settings.land]) ? s.settings.land : 'NL';
  const L = LANDEN[landCode];
  const maand = new Date().toISOString().slice(0, 7);
  const inMaand = iso => String(iso || '').slice(0, 7) === maand;
  const caps = (db.data.supplierTypes[s.type] || {}).caps || [];
  const basisCat = caps.includes('rides') ? (s.type === 'jet' ? 'jet' : 'vervoer') : caps.includes('rooms') ? 'logies' : 'eten';
  // omzet per belastingcategorie: bar-items zijn drank, keuken-items eten
  const potten = {};
  const tel = (cat, bedrag) => { if (bedrag > 0) potten[cat] = (potten[cat] || 0) + bedrag; };
  const catVan = naam => { const m = (s.menu || []).find(x => x.name === naam); return m && m.station === 'bar' ? 'drank' : basisCat === 'eten' ? 'eten' : basisCat; };
  for (const o of db.data.orders) {
    if (o.supplierCode !== s.code || !o.paid || !inMaand(o.paidAt || o.at)) continue;
    for (const it of o.items || []) tel(catVan(it.name), (it.price || 0) * (it.qty || 1));
  }
  for (const v of db.data.posSales[s.code] || []) {
    if (v.method === 'rtg' || v.method === 'kamer' || !inMaand(v.at)) continue;
    if (v.items && v.items.length) for (const it of v.items) tel(catVan(it.name), (it.price || 0) * (it.qty || 1));
    else tel(basisCat, v.total || 0);
  }
  for (const r of db.data.rides) {
    if (r.supplierCode !== s.code || !r.paid || !inMaand(r.paidAt || r.at)) continue;
    tel(s.type === 'jet' ? 'jet' : 'vervoer', r.quote || 0);
  }
  for (const b of db.data.boekingen) {
    if (b.supplierCode !== s.code || !b.paid || b.status === 'geweigerd' || !inMaand(b.paidAt || b.at)) continue;
    tel('dienst', b.price || 0);
  }
  // cadeaukaarten (meervoudig inwisselbaar): btw-moment is de inwisseling
  const kaarten = (db.data.giftcards || []).filter(g => g.supplierCode === s.code);
  const gcVerkocht = kaarten.filter(g => inMaand(g.at)).reduce((x, g) => x + g.bedrag, 0);
  let gcIngewisseld = 0;
  for (const g of kaarten) for (const w of g.verzilveringen || []) if (inMaand(w.at)) gcIngewisseld += w.bedrag;
  if (gcIngewisseld) tel(basisCat, gcIngewisseld);
  const gcOpen = centen(kaarten.reduce((x, g) => x + g.saldo, 0));
  const btw = Object.entries(potten).map(([cat, omzet]) => {
    const t = L.tarieven[cat] != null ? L.tarieven[cat] : L.tarieven.standaard;
    const grondslag = centen(omzet / (1 + t / 100));
    return { cat, label: FIN_CAT[cat] || cat, tarief: t, omzet: centen(omzet), grondslag, btw: centen(omzet - grondslag) };
  }).sort((a, b) => b.omzet - a.omzet);
  // personeelskosten uit de klokuren van deze maand
  const uurloon = (s.settings && Number(s.settings.uurloon)) || 16;
  const duurUur = e => ((e.out ? new Date(e.out) : new Date()) - new Date(e.in)) / 3600000;
  const uren = (db.data.klok[s.code] || []).filter(e => String(e.in).slice(0, 7) === maand).reduce((x, e) => x + duurUur(e), 0);
  const bruto = centen(uren * uurloon);
  return {
    land: landCode, landNaam: L.naam,
    landen: Object.entries(LANDEN).map(([k, v]) => ({ code: k, naam: v.naam })),
    peiljaar: FISCAAL_PEILJAAR,
    maand,
    btw, btwTotaal: centen(btw.reduce((x, r2) => x + r2.btw, 0)),
    personeel: {
      uren: Math.round(uren * 10) / 10, uurloon, bruto,
      lasten: centen(bruto * L.lasten), lastenPct: Math.round(L.lasten * 100),
      vakantiegeld: centen(bruto * L.vakantiegeld), vakantiegeldPct: Math.round(L.vakantiegeld * 1000) / 10,
      totaal: centen(bruto * (1 + L.lasten + L.vakantiegeld)),
      uurloonMin: L.uurloonMin
    },
    giftcards: { verkocht: centen(gcVerkocht), ingewisseld: centen(gcIngewisseld), open: gcOpen, aantal: kaarten.length },
    regels: [
      L.aangifte,
      L.extra,
      'Cadeaukaarten zijn bij verkoop nog geen omzet: het saldo (€ ' + gcOpen + ') staat als verplichting op de balans en de btw hoort bij de inwisseling.',
      'Indicatie minimumuurloon in ' + L.naam + ': € ' + L.uurloonMin + ' per uur. Reken bovenop het brutoloon ~' + Math.round(L.lasten * 100) + '% werkgeverslasten' + (L.vakantiegeld ? ' en ' + Math.round(L.vakantiegeld * 1000) / 10 + '% vakantiegeld' : '') + '.',
      'Dit overzicht is voorlichting (peiljaar ' + FISCAAL_PEILJAAR + '), geen fiscaal advies; de aangifte en afdracht blijven de verantwoordelijkheid van de onderneming.'
    ]
  };
}


// AI-boekhouder van de zaak: kent het land, de regels en de eigen cijfers
function cannedBoekhouder(vraag, fin, L) {
  const v = vraag.toLowerCase();
  if (/btw|vat|tarief|belasting|afdra/.test(v))
    return 'In ' + L.naam + ' gelden voor u deze tarieven: ' + fin.btw.map(r => r.label + ' ' + r.tarief + '%').join(', ') + '. Deze maand is de af te dragen btw € ' + fin.btwTotaal + ' over € ' + centen(fin.btw.reduce((x, r) => x + r.grondslag, 0)) + ' grondslag. ' + L.aangifte;
  if (/personeel|loon|salaris|lasten|vakantiegeld|kost/.test(v))
    return 'Deze maand: ' + fin.personeel.uren + ' geklokte uren tegen € ' + fin.personeel.uurloon + ' = € ' + fin.personeel.bruto + ' bruto. Daar komt ~' + fin.personeel.lastenPct + '% werkgeverslasten (€ ' + fin.personeel.lasten + ')' + (fin.personeel.vakantiegeld ? ' en ' + fin.personeel.vakantiegeldPct + '% vakantiegeldreserve (€ ' + fin.personeel.vakantiegeld + ')' : '') + ' bij: totaal € ' + fin.personeel.totaal + '. Indicatie minimumuurloon in ' + L.naam + ': € ' + fin.personeel.uurloonMin + '.';
  if (/cadeau|bon|kaart|voucher|gift/.test(v))
    return 'Uw cadeaukaarten zijn meervoudig inwisselbaar: de verkoop (deze maand € ' + fin.giftcards.verkocht + ') is nog geen omzet en kent geen btw. Pas bij inwisseling (deze maand € ' + fin.giftcards.ingewisseld + ') boekt u omzet met btw. Het openstaande saldo van € ' + fin.giftcards.open + ' staat als verplichting op de balans.';
  if (/aangifte|deadline|wanneer|termijn/.test(v))
    return L.aangifte + ' ' + L.extra;
  return 'Uw maand in ' + L.naam + ': af te dragen btw € ' + fin.btwTotaal + ', personeelskosten € ' + fin.personeel.totaal + ' (' + fin.personeel.uren + ' uur), cadeaukaarten € ' + fin.giftcards.open + ' open. Vraag me naar btw, personeelskosten, cadeaukaarten of aangiftetermijnen. Dit is voorlichting, geen bindend fiscaal advies.';
}


/* ---- zzp-belastingtool (Business Pass) ----
   Indicatieve berekening voor zelfstandigen per land. Nederland volledig
   (ondernemersaftrek, MKB-vrijstelling, schijven, heffingskortingen, KOR);
   overige landen met het regime en een indicatieve effectieve heffing. */
const ZZP = {
  NL: { regime: 'Eenmanszaak / zzp',
    zelfstandigenaftrek: 2470, startersaftrek: 2123, mkbVrijstelling: 0.127,
    schijven: [[38441, 0.3582], [76817, 0.3748], [Infinity, 0.495]],
    ahk: { max: 3068, afbouwVanaf: 24813, afbouw: 0.06337 },
    arbeidskorting: { max: 5599, afbouwVanaf: 43071, afbouw: 0.0651 },
    korGrens: 20000,
    regels: ['Urencriterium: minimaal 1.225 uur per jaar ondernemen geeft recht op de zelfstandigenaftrek.',
      'MKB-winstvrijstelling: 12,7% van de winst na ondernemersaftrek is vrijgesteld.',
      'KOR: onder € 20.000 omzet per jaar kunt u vrijstelling van btw aanvragen.',
      'Reserveer daarnaast voor de inkomensafhankelijke bijdrage Zvw (~5,26% tot het maximum).'] },
  BE: { regime: 'Zelfstandige in hoofdberoep', simpel: 0.42,
    regels: ['Sociale bijdragen: ~20,5% van het netto belastbaar inkomen, per kwartaal vooruit.',
      'Progressieve personenbelasting van 25% tot 50%, belastingvrije som ~€ 10.910.'] },
  DE: { regime: 'Freiberufler / Einzelunternehmen', simpel: 0.35,
    regels: ['Grundfreibetrag € 12.096; daarboven progressief 14% tot 42% (45% Spitzensteuersatz).',
      'Freiberufler betalen geen Gewerbesteuer; een Gewerbe boven € 24.500 winst wel.'] },
  FR: { regime: 'Micro-entrepreneur (BNC)', simpel: 0.30,
    regels: ['Micro-regime tot € 77.700 omzet voor diensten: sociale lasten ~21,2% van de omzet.',
      'Optioneel versement liberatoire: inkomstenbelasting als vast percentage direct bij de bron.'] },
  ES: { regime: 'Autonomo', simpel: 0.32,
    regels: ['Maandelijkse cuota op basis van de werkelijke inkomsten (tabel per tranche).',
      'IRPF progressief 19% tot 47%; kwartaalvoorschot van 20% via modelo 130.'] },
  JP: { regime: 'Kojin jigyo (eenmanszaak)', simpel: 0.25,
    regels: ['De blauwe aangifte (aoiro shinkoku) geeft tot ¥ 650.000 extra aftrek.',
      'Nationale inkomstenbelasting 5% tot 45%, plus ~10% lokale inkomstenbelasting.'] }
};


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
/* Ritstatus: een vaste, logische keten met nette meldingen naar de gast.
   Oude statusnamen (rijdt/gearriveerd) blijven werken voor bestaande data. */
const RIT_KETEN = ['aangevraagd', 'geaccepteerd', 'onderweg', 'aangekomen', 'aan-boord', 'afgerond'];
const RIT_LEGACY = { rijdt: 'aan-boord', gearriveerd: 'afgerond' };
const RIT_MELDING = {
  geaccepteerd: 'Uw rit is bevestigd.',
  onderweg: 'Uw chauffeur is onderweg naar u.',
  aangekomen: 'Uw chauffeur staat voor.',
  'aan-boord': 'Goede reis!',
  afgerond: 'U bent gearriveerd. Dank voor het reizen met RTG.',
  geweigerd: 'De rit kon helaas niet worden aangenomen.'
};
function ritVerder(req, res, r, status) {
  r.status = status;
  const gastLoc = (() => { const L = db.data.live[r.customerKey || r.customerTier]; return L && Number.isFinite(L.lat) ? { lat: L.lat, lng: L.lng } : null; })();
  if (status === 'onderweg') r.pickupEtaMin = etaMinutes(haversine(req.supplier.loc, gastLoc), 'driving') || 6;
  if (status === 'aan-boord') { r.boardedAt = new Date().toISOString(); r.dropEtaMin = r.km ? etaMinutes(r.km * 1000, r.type === 'jet' ? 'flying' : 'driving') : 12; }
  if (status === 'afgerond') r.finishedAt = new Date().toISOString();
  save();
  broadcastSync([r.customerTier], 'orders');
  sseToCustomer(r.customerKey || r.customerTier, 'sync', { scope: 'live' });
  sseToOffice('sync', { scope: 'orders' });
  notify(r.customerTier, { icon: r.type === 'jet' ? '✈️' : '🚗', title: req.supplier.name, body: RIT_MELDING[status] || ('Uw rit is nu: ' + status + '.'), scope: 'orders' });
  logActivity(req.supplier.code, req.actor, 'zette rit ' + r.ref + ' op "' + status + '"');
  res.json({ ok: true, ride: r });
}

/* Slimme toewijzing: de eerste vrije chauffeur en een passend, vrij voertuig. */
function ritBezetting(code) {
  const actief = db.data.rides.filter(r => r.supplierCode === code && ['geaccepteerd', 'onderweg', 'aangekomen', 'aan-boord'].includes(RIT_LEGACY[r.status] || r.status));
  return {
    drukkeChauffeurs: new Set(actief.filter(r => r.driver).map(r => r.driver.staffId)),
    bezetteVoertuigen: new Set(actief.filter(r => r.vehicle).map(r => r.vehicle.id))
  };
}

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

// Geo-rekenhulp zit nu in een eigen, zuivere module (server/lib/geo.js).
const geo = require('./lib/geo');
const toRad = geo.toRad;
const haversine = geo.haversine;
const etaMinutes = geo.etaMinutes;
function sseToCustomer(key, event, data) {
  bus.publish('sse', { doel: 'key', match: key, event, data, id: nextSseId() });
}
function liveCodename(session) {
  return session.account ? session.account.codename : PERSONAS[session.tier].codename;
}

// Partners die op dit moment met dit reizende lid te maken hebben: de bestemming,
// plus elke partner met een lopende bestelling of rit.
function connectedSupplierCodes(key) {
  const set = new Set();
  const L = db.data.live[key];
  if (L && L.destCode) set.add(L.destCode);
  if (L) for (const c of (L.connected || [])) set.add(c);
  for (const o of db.data.orders)
    if ((o.customerKey || o.customerTier) === key && !['terugbetaald', 'geserveerd', 'geweigerd'].includes(o.status)) set.add(o.supplierCode);
  for (const r of db.data.rides)
    if ((r.customerKey || r.customerTier) === key && !['gearriveerd', 'afgerond', 'geweigerd'].includes(r.status)) set.add(r.supplierCode);
  return [...set];
}

// Duw een live-signaal naar het lid zelf, naar alle betrokken partners en de backoffice.
function pushLive(key) {
  sseToCustomer(key, 'sync', { scope: 'live' });
  for (const code of connectedSupplierCodes(key)) sseToSupplier(code, 'sync', { scope: 'live' });
  sseToOffice('sync', { scope: 'live' });
}

// Volledige live-toestand voor het lid: eigen positie plus elke partner met afstand en ETA.
function liveStateFor(key, lang) {
  const L = db.data.live[key];
  const active = !!(L && L.active);
  const me = L && Number.isFinite(L.lat) ? { lat: L.lat, lng: L.lng, at: L.updatedAt } : null;
  const mode = (L && L.mode) || 'driving';
  const partners = connectedSupplierCodes(key).map(code => {
    const s = findSupplier(code); if (!s) return null;
    const t = db.data.supplierTypes[s.type] || {};
    const dist = me && s.loc ? haversine(me, s.loc) : null;
    const order = db.data.orders.find(o => (o.customerKey || o.customerTier) === key && o.supplierCode === code && !['terugbetaald', 'geserveerd', 'geweigerd'].includes(o.status));
    const ride = db.data.rides.find(r => (r.customerKey || r.customerTier) === key && r.supplierCode === code && r.status !== 'gearriveerd' && r.status !== 'geweigerd');
    return {
      code: s.code, name: s.name, type: s.type, typeLabel: t.label, icon: t.icon,
      loc: s.loc ? { ...s.loc, label: i18n.localize(s.loc.label, lang) } : null,
      hasDoors: (s.doors || []).length > 0,
      isDest: !!(L && L.destCode === code),
      distance: dist,
      etaMin: etaMinutes(dist, mode),
      // voor een rit telt de ETA van het voertuig naar het lid
      taxiEtaMin: ride && me && s.loc ? etaMinutes(haversine(s.loc, me), 'driving') : null,
      order: order ? { ref: order.ref, status: order.status, items: order.items.reduce((n, i) => n + i.qty, 0), total: order.total, paid: order.paid } : null,
      ride: ride ? { ref: ride.ref, status: ride.status, to: ride.to, quote: ride.quote, km: ride.km,
                     passengers: ride.passengers, driver: ride.driver ? ride.driver.name : null,
                     vehicle: ride.vehicle ? ride.vehicle.name + (ride.vehicle.plate ? ' · ' + ride.vehicle.plate : '') : null,
                     paid: !!ride.paid,
                     pickupEtaMin: ride.pickupEtaMin, dropEtaMin: ride.dropEtaMin } : null
    };
  }).filter(Boolean);
  const destCode = L && L.destCode ? L.destCode : null;
  return { active, mode, me, arrived: !!(L && L.arrived), destCode, dest: destCode ? (partners.find(p => p.code === destCode) || null) : null, partners };
}

// Reizende leden die op dit moment met deze partner te maken hebben (voor de leverancier-app).
function guestsFor(code) {
  const out = [];
  const s = findSupplier(code);
  for (const key of Object.keys(db.data.live)) {
    const L = db.data.live[key];
    if (!L || !L.active) continue;
    if (!connectedSupplierCodes(key).includes(code)) continue;
    const me = Number.isFinite(L.lat) ? { lat: L.lat, lng: L.lng } : null;
    const dist = me && s && s.loc ? haversine(me, s.loc) : null;
    const order = db.data.orders.find(o => (o.customerKey || o.customerTier) === key && o.supplierCode === code && !['terugbetaald', 'geserveerd', 'geweigerd'].includes(o.status));
    const ride = db.data.rides.find(r => (r.customerKey || r.customerTier) === key && r.supplierCode === code && r.status !== 'gearriveerd' && r.status !== 'geweigerd');
    out.push({
      codename: L.codename, distance: dist, etaMin: etaMinutes(dist, L.mode),
      loc: me, mode: L.mode,
      heading: L.destCode === code, arrived: !!L.arrived,
      orderRef: order ? order.ref : null, rideRef: ride ? ride.ref : null
    });
  }
  return out.sort((a, b) => (a.etaMin == null ? 999 : a.etaMin) - (b.etaMin == null ? 999 : b.etaMin));
}

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
  if (!sess || sess.role !== 'office') return res.status(401).json({ error: 'Geen backoffice-sessie.' });
  next();
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
  const performance = db.data.suppliers.map(s => {
    const or = betaaldeOrders.filter(o => o.supplierCode === s.code);
    const ri = betaaldeRitten.filter(r => r.supplierCode === s.code);
    const openNu = db.data.orders.filter(o => o.supplierCode === s.code && o.paid && (o.status === 'nieuw' || o.status === 'in bereiding')).length
      + db.data.rides.filter(r => r.supplierCode === s.code && r.paid && !['afgerond', 'gearriveerd', 'geweigerd', 'wacht-op-betaling'].includes(r.status)).length;
    const duur = ri.filter(r => r.finishedAt).map(r => (new Date(r.finishedAt) - new Date(r.at)) / 60000);
    return {
      code: s.code, name: s.name, type: s.type,
      omzet: or.reduce((x, o) => x + (o.total || 0), 0) + ri.reduce((x, r) => x + (r.quote || 0), 0),
      aantal: or.length + ri.length, openNu,
      gemMin: duur.length ? Math.round(duur.reduce((x, y) => x + y, 0) / duur.length) : null
    };
  }).sort((a, b) => b.omzet - a.omzet);
  // actiecentrum: alles wat nu een oog van RTG nodig heeft, belangrijkste eerst
  const alerts = [];
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
    suppliers: db.data.suppliers.map(publicSupplier),
    partnerApplications: (db.data.partnerApplications || []).slice(0, 40),
    pendingSchools: wachtScholen.map(s => ({ code: s.code, naam: s.naam, plaats: s.plaats, at: s.at,
      personeel: Object.keys(s.personeel || {}).length })).slice(0, 40),
    stats, week, performance: performance.slice(0, 12), alerts: alerts.slice(0, 20),
    // totalen over de volledige data, zodat de schermen eerlijk blijven
    // vertellen hoeveel er echt is, hoe groot de lijsten ook worden
    totals: {
      orders: db.data.orders.filter(o => o.status !== 'wacht-op-betaling').length,
      rides: db.data.rides.filter(r => r.status !== 'wacht-op-betaling').length,
      leden: Object.keys(db.data.memberDir || {}).length,
      partners: db.data.suppliers.length,
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
  ZAAK_OPTIES, ZZP, _sseMs, accounts, addContact, addTicket, aiFindDoor, aiFindRoom,
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
  parseRunsheetText, path, pendingVerifications, pickupCode, pinFails, posDay, publicPartner, publicSupplier,
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
const ALLE_DOMEINEN = ['auth', 'member', 'supplier', 'office', 'staff', 'social', 'techniek'];
const gekozenDomeinen = (process.env.RTG_DOMAINS || ALLE_DOMEINEN.join(','))
  .split(',').map(s => s.trim()).filter(Boolean);
for (const naam of gekozenDomeinen) {
  if (!ALLE_DOMEINEN.includes(naam)) { console.warn('[start] onbekend domein overgeslagen:', naam); continue; }
  require('./routes/' + naam)(kern);
}
console.log('[start] domeinen actief:', gekozenDomeinen.join(', '));

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
  for (const [k, lijst] of sseBuffer) {
    const vers = lijst.filter(e => nu - e.at < SSE_BUFFER_TTL);
    if (!vers.length) sseBuffer.delete(k); else if (vers.length !== lijst.length) sseBuffer.set(k, vers);
  }
}, 5 * 60 * 1000).unref();
backupData();
setInterval(backupData, 24 * 60 * 60 * 1000);

// Eerlijke opstartcontrole: waarschuw als demo-instellingen mee naar productie gaan.
if (PRODUCTION) {
  if (!process.env.OFFICE_CODE) console.warn('[start] LET OP: OFFICE_CODE staat op de demo-waarde. Zet een eigen code in de omgeving.');
  if (!process.env.DEMO_PASS) console.warn('[start] LET OP: het demo-account (Rahul/Imran) is actief. Zet DEMO_USER/DEMO_PASS of schakel het uit.');
  if (!process.env.SMTP_URL) console.warn('[start] LET OP: geen SMTP_URL; e-mail gaat naar de outbox in plaats van naar klanten.');
  if (!process.env.ANTHROPIC_API_KEY) console.warn('[start] Info: geen ANTHROPIC_API_KEY; AI en chatvertaling draaien in demo-stand.');
}

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  if (process.env.RTG_SERVER) {
    console.log(`klaar op poort ${PORT}, rol: ${db.writable ? 'actief' : 'standby'}`);
  } else {
    console.log(`RTG-portaal draait op http://localhost:${PORT}, open http://localhost:${PORT}/apps/portaal.html`);
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
