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
const { schoon, ledenPrijs, centen, entreeCode, pickupCode, veiligGelijk } = require('./kern/util');
const { totpOk } = require('./kern/totp');
const { publicPartner, weekdagFactor, cvReady, btwSplit } = require('./kern/afgeleid');
const { FISCAAL_PEILJAAR, LANDEN, FIN_CAT, ZZP, maakFiscaal } = require('./kern/fiscaal');
const { RUN_STATIONS, ALT_IDEE, coachCache, maakEvents } = require('./kern/events');
const { maakLive } = require('./kern/live');
const { RIT_KETEN, RIT_LEGACY, RIT_MELDING, maakVervoer } = require('./kern/vervoer');
const { VAC_SOORTEN, maakWerk } = require('./kern/werk');
const { AI_TONE, maakAi } = require('./kern/ai');
const { maakKantoor } = require('./kern/kantoor');
const { SHIFT_NAMES, maakPersoneel } = require('./kern/personeel');
const { HK_STATUSES, POS_METHODS, DOOR_RELOCK_MS, TABLE_STATUSES, ZAAK_OPTIES, maakLeverancier } = require('./kern/leverancier');
const { maakLid } = require('./kern/lid');
const { MELDING_SCOPES, maakErvaring } = require('./kern/ervaring');
const { RETAIL_MATEN, RETAIL_SEIZOENEN, maakRetail } = require('./kern/retail');
const { maakGroothandel } = require('./kern/groothandel');
const { maakModebezorg } = require('./kern/modebezorg');
const { maakZaak } = require('./kern/zaak');
const { maakAutoverkoop } = require('./kern/autoverkoop');
const { maakBeveiliging } = require('./kern/beveiliging');
const { maakDirectpay } = require('./kern/directpay');
const { maakFonds } = require('./kern/fonds');
const { maakMunten } = require('./kern/munten');
const muntbetaal = require('./muntbetaal');
const factuur = require('./kern/factuur');
const boekhoudkennis = require('./kern/boekhoudkennis');
const { maakTalen } = require('./talen');
const { PASPOORT_NIVEAUS, maakPaspoort } = require('./kern/paspoort');
const { maakOntmoeting } = require('./kern/ontmoeting');

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
  // boerderij: een bedrijfsleider en twee knechten voor het land en de dieren
  CANFERRER: [['Aina Torres', 'manager', 'Bedrijfsleider'], ['Marc Prats', 'staff', 'Veehouderij'], ['Lucia Roig', 'staff', 'Akker & kas']],
  // content creator: vaak solo; de creator zelf plus een editor
  LUMINA: [['Nora Vidal', 'manager', 'Creator'], ['Tim Bakker', 'staff', 'Editor']],
  IBIZAIR: [['Nadia Fischer', 'manager', 'Operations'], ['Tomas Weller', 'staff', 'Piloot']],
  // charter: een vlootbeheerder en een schipper aan boord
  AZUL: [['Nerea Costa', 'manager', 'Charterbeheer'], ['Marco Silva', 'staff', 'Schipper']],
  // mode & retail: een store manager en een verkoper/stylist op de winkelvloer
  MAISON: [['Camille Moreau', 'manager', 'Store manager'], ['Théo Blanc', 'staff', 'Verkoop & styling']],
  // groothandel: een inkoopmanager en een orderpicker/chauffeur
  MERCABIZA: [['Rosa Bennasar', 'manager', 'Inkoop & beheer'], ['Joan Tur', 'staff', 'Orderpicking & bezorging']],
  // beveiliging: een operationeel leider (commandocentrum) en een ploeg bewakers voor de PDA
  AEGIS: [['Viktor Novak', 'manager', 'Operationeel leider'], ['Samir Haddad', 'staff', 'Beveiliger'],
    ['Elena Ruiz', 'staff', 'Beveiliger'], ['Marcus Kane', 'staff', 'Beveiliger'], ['Nadia Petrova', 'staff', 'Beveiliger']],
  // de negen nieuwe sectoren: elk een manager en vloerpersoneel voor de PDA
  VORA: [['Ines Ferrer', 'manager', 'Club manager'], ['Diego Ramos', 'staff', 'Bediening strand'], ['Yara Klein', 'staff', 'Bar']],
  BRISA: [['Marta Colom', 'manager', 'Eigenaar'], ['Leo Duran', 'staff', 'Barista']],
  FUEGO: [['Alba Fuego', 'manager', 'Chef-eigenaar'], ['Nico Serra', 'staff', 'Sous-chef']],
  LUNARA: [['Claudia Mas', 'manager', 'Villamanager'], ['Pere Joan', 'staff', 'Huismeester'], ['Rosa Vives', 'staff', 'Housekeeping']],
  MOTOISLA: [['Jordi Pons', 'manager', 'Verhuurmanager'], ['Mia Sastre', 'staff', 'Uitgifte & inname']],
  FESTA: [['Luz Romero', 'manager', 'Eventproducent'], ['Sam Ortega', 'staff', 'Crew & entree'], ['Vera Lind', 'staff', 'VIP-host']],
  SERENA: [['Anouk Visser', 'manager', 'Spa manager'], ['Carla Nunez', 'staff', 'Therapeut'], ['Iris Blom', 'staff', 'Therapeut']],
  ORODOR: [['Esteban Oro', 'manager', 'Meester-juwelier'], ['Lia Costa', 'staff', 'Salon & taxatie']],
  LIENZO: [['Valeria Pinto', 'manager', 'Galeriehouder'], ['Hugo Ram', 'staff', 'Exposities & entree']]
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
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
    "font-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; " +
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

/* Munt-webhook: de munt-aanbieder bevestigt hier dat de munten binnen zijn en
   omgezet naar euro. Net als de betaal-webhook: ruwe body, handtekening over de
   onbewerkte bytes. Een bevestigde ontvangst settelt de bijbehorende factuur. */
app.post('/api/munt/webhook', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  let evt;
  try {
    evt = muntbetaal.verifieerWebhook(req.body, req.get('x-munt-signature'));
  } catch (e) {
    log.warn('munt-webhook geweigerd', { fout: e.message, id: req.id });
    return res.status(400).json({ error: 'Ongeldige handtekening.' });
  }
  try {
    if (evt && (evt.status === 'ontvangen' || evt.type === 'ontvangst.voltooid') && evt.id) {
      const entry = munten.bevestig({ id: evt.id, euroCenten: evt.euroCenten });
      if (entry && !entry.herhaald) await settleMuntFactuur(entry);
    }
    log.info('munt-webhook', { id: evt && evt.id, status: evt && evt.status });
  } catch (e) { log.uitzondering(e, { bron: 'munt-webhook' }); }
  res.json({ ok: true });
});

app.use(express.json({ limit: '8mb' }));

/* ---------- rem op de deur (rate-limiter) ----------
   In productie (of met RTG_RATELIMIT=1) mag een IP maximaal 300 API-verzoeken
   per minuut; daarboven 429. Ruim genoeg voor elk normaal gebruik, en het
   haalt de scherpte van scripts en scrapers. De live-streams (SSE) tellen
   niet mee: dat zijn langlopende verbindingen, geen verzoeken. */
const rateBakken = new Map();
if (PRODUCTION || process.env.RTG_RATELIMIT === '1') {
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/') || req.path.endsWith('/stream')) return next();
    const nu = Date.now();
    const b = rateBakken.get(req.ip) || { vanaf: nu, n: 0 };
    if (nu - b.vanaf > 60000) { b.vanaf = nu; b.n = 0; }
    b.n += 1;
    rateBakken.set(req.ip, b);
    if (b.n > 300) return res.status(429).json({ error: 'Even rustig aan: te veel verzoeken. Probeer het over een minuut opnieuw.' });
    next();
  });
  setInterval(() => { const nu = Date.now(); for (const [ip, b] of rateBakken) if (nu - b.vanaf > 120000) rateBakken.delete(ip); }, 60000).unref();
}

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
/* Landcode van een lid voor de "per land"-regels van de Boardroom: het bij
   registratie gekozen land wint, anders leiden we het af uit de nationaliteit
   op het geverifieerde paspoort (bijv. "Duitse" -> DE). */
function natieNaarLand(nat) {
  const s = String(nat || '').toLowerCase();
  if (!s) return null;
  if (/nederland|dutch|holland/.test(s)) return 'NL';
  if (/belg/.test(s)) return 'BE';
  if (/duits|german|deutsch/.test(s)) return 'DE';
  if (/frans|french|franc/.test(s)) return 'FR';
  if (/spaan|spanish|espa/.test(s)) return 'ES';
  if (/japan/.test(s)) return 'JP';
  return null;
}
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
  // land van het lid (alleen opzoeken als er ergens land-regels staan) en de
  // persoonssleutel (voor per-persoon uitschakelen): 'user-<id>'.
  let land = null, persoon = null;
  if (user) {
    persoon = 'user-' + user.id;
    if (functies.heeftLandRegels(staat)) {
      try { const md = accounts.getMemberState(user.id) || {}; land = md.land || natieNaarLand(md.nationaliteit) || null; } catch (e) {}
    }
  }
  const dicht = functies.padGeblokkeerd(p, staat, { doelgroep, land, persoon });
  if (dicht) {
    const zin = { globaal: 'Deze functie is tijdelijk uitgeschakeld door de beheerder.',
      pas: 'Deze functie is voor jouw pas uitgeschakeld door de beheerder.',
      land: 'Deze functie is in jouw land uitgeschakeld door de beheerder.',
      persoon: 'Deze functie is voor jouw account uitgeschakeld door de beheerder.' };
    return res.status(503).json({
      error: zin[dicht.reden] || zin.globaal,
      functie: dicht.id, naam: dicht.naam, reden: dicht.reden, doelgroep: doelgroep || undefined
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
      "default-src 'self'; script-src 'self' 'nonce-" + nonce + "'; style-src 'self' 'unsafe-inline'; " +
      "font-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; " +
      "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
    res.type('html').send(html);
  });
});

/* Lichte gzip voor statische tekstassets (js/css/svg/json/webmanifest), met een
   in-memory cache op pad + mtime. De grote app-scripts (leverancier.js ~5000
   regels, app-main.js ~4400) gaan zo ~75% kleiner over de lijn, zonder extra
   dependency (ingebouwde zlib) en zonder per-verzoek opnieuw te comprimeren.
   Valt netjes terug op express.static bij range-verzoeken of onbekende paden. */
const zlib = require('zlib');
const PUBLIC_DIR_STATIC = path.join(__dirname, '..', 'public');
const GZIP_TYPE = { '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const MIN_DIR_STATIC = path.join(PUBLIC_DIR_STATIC, 'dist', 'min');
const gzipCache = new Map(); // absoluut pad -> { mtimeMs, minMtimeMs, gz }
app.get(/\.(?:js|css|svg|json|webmanifest)$/, (req, res, next) => {
  if (req.headers.range) return next(); // range-verzoeken: laat express.static het doen
  if (!/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) return next();
  let rel; try { rel = decodeURIComponent(req.path); } catch (e) { return next(); }
  if (rel.indexOf('..') !== -1) return next();
  const bestand = path.join(PUBLIC_DIR_STATIC, rel);
  if (!bestand.startsWith(PUBLIC_DIR_STATIC)) return next();
  const type = GZIP_TYPE[path.extname(bestand)]; if (!type) return next();
  let st; try { st = fs.statSync(bestand); } catch (e) { return next(); }
  if (!st.isFile()) return next();
  // Is er een verse geminificeerde versie (npm run build)? Dan die serveren,
  // anders de bron. Vers = gebouwd na de laatste bronwijziging (mtime-controle),
  // zodat een lokaal bewerkt bronbestand nooit een oude minify uitserveert.
  let minPad = null, minMtimeMs = 0;
  if (type.indexOf('javascript') !== -1) {
    const kandidaat = path.join(MIN_DIR_STATIC, rel);
    if (kandidaat.startsWith(MIN_DIR_STATIC)) {
      try {
        const mst = fs.statSync(kandidaat);
        if (mst.isFile() && mst.mtimeMs >= st.mtimeMs) { minPad = kandidaat; minMtimeMs = mst.mtimeMs; }
      } catch (e) { /* geen minify aanwezig: bron gebruiken */ }
    }
  }
  let hit = gzipCache.get(bestand);
  if (!hit || hit.mtimeMs !== st.mtimeMs || hit.minMtimeMs !== minMtimeMs) {
    try {
      const bron = fs.readFileSync(minPad || bestand);
      hit = { mtimeMs: st.mtimeMs, minMtimeMs, gz: zlib.gzipSync(bron, { level: 6 }) };
    }
    catch (e) { return next(); }
    if (gzipCache.size > 300) gzipCache.clear();
    gzipCache.set(bestand, hit);
  }
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.end(hit.gz);
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
// tijd-veilig vergeleken: een gewone !== lekt via de reactietijd hoeveel klopt
function checkCred(username, password) {
  const userOk = veiligGelijk(String(username || '').trim().toLowerCase(), DEMO_USER);
  const passOk = veiligGelijk(String(password || ''), DEMO_PASS);
  return userOk && passOk;
}

/* ---------- het inlog-auditlog ----------
   Elke inlogpoging (gelukt of mislukt, op elk kanaal) komt in een afgeschermd
   log: wie, waar vandaan, wanneer. Zo is een aanval of een gestolen code
   achteraf altijd te reconstrueren; het kantoor leest het log in RTG HQ. */
function logInlog(kanaal, ok, wie, req) {
  const lijst = db.data.securityLog = db.data.securityLog || [];
  lijst.unshift({ at: new Date().toISOString(), kanaal, ok: !!ok, wie: schoon(wie, 60) || null, ip: String((req && req.ip) || '') });
  if (lijst.length > 5000) lijst.length = 5000;
  save();
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
  if (s.type === 'charter' && !Array.isArray(s.boten)) s.boten = [];
  if (s.type === 'vastgoed' && !Array.isArray(s.panden)) s.panden = [];
  if (s.type === 'groothandel' && (!s.groothandel || typeof s.groothandel !== 'object')) s.groothandel = { functies: {}, producten: [] };
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
  // Salon, met volgers en marketinggereedschap (folders, aanbiedingen, polls)
  if (!s.salon) s.salon = { bio: '', foto: null, volgers: [], sinds: new Date().toISOString() };
  if (!Array.isArray(s.salon.volgers)) s.salon.volgers = [];
}

/* ---- De Salon is verplicht: elke partner doet zijn marketing, producten en
   folders via De Salon (niet in de leden-app). Een partner met een onvolledig
   Salon-profiel wordt NIET aan leden getoond en kan niets publiceren. Compleet =
   een bio en minstens een profielfoto (of een foto op de bedrijfspagina). */
function salonProfielCompleet(s) {
  const bio = ((s.salon && s.salon.bio) || '').trim();
  const heeftFoto = !!(s.salon && s.salon.foto) || (Array.isArray(s.photos) && s.photos.length > 0);
  return bio.length >= 15 && heeftFoto;
}
function salonZichtbaar(s) { return salonProfielCompleet(s); }
// hoeveel Salon-items (posts/folders/deals/polls) deze partner al plaatste
function salonItemsVan(code) { return db.data.posts.filter(p => p.partnerCode === code).length; }

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
  // de ervaring-laag (kern/ervaring.js): reserveringen, reviews, favorieten,
  // punten, splitsen, wachtlijsten en meldingsvoorkeuren
  if (!db.data.reserveringen) db.data.reserveringen = [];          // tafelreserveringen
  if (!db.data.reviews) db.data.reviews = [];                      // beoordelingen (1-5)
  if (!db.data.reviewStats) db.data.reviewStats = {};              // code -> { som, aantal } (O(1)-gemiddelde)
  if (!db.data.favorieten) db.data.favorieten = {};                // sleutel -> [leverancierscodes]
  if (!db.data.punten) db.data.punten = {};                        // sleutel -> { saldo, tegoed, historie }
  if (!db.data.splitsen) db.data.splitsen = [];                    // gesplitste rekeningen (betaalverzoeken)
  if (!db.data.wachtlijsten) db.data.wachtlijsten = [];            // wachtlijsten voor volle events/tijdsloten
  if (!db.data.meldingVoorkeur) db.data.meldingVoorkeur = {};      // sleutel/tier -> { scope: bool }
  // de retail-/mode-laag (kern/retail.js): apart gelegde artikelen, paskamer-
  // verzoeken en stylingvoorstellen (collecties, artikelen en clienteling staan
  // op de leverancier zelf: s.collecties/s.artikelen/s.klanten)
  if (!db.data.retailApart) db.data.retailApart = [];             // apart gelegde varianten per klant
  if (!db.data.paskamerVerzoeken) db.data.paskamerVerzoeken = []; // maat naar een paskamer brengen
  if (!db.data.stylingVoorstellen) db.data.stylingVoorstellen = []; // stylist -> app van de klant
  if (!db.data.paspoortVerzoeken) db.data.paspoortVerzoeken = [];   // identiteitsverzoeken van partners
  if (!db.data.paspoortIncidenten) db.data.paspoortIncidenten = []; // opgeeiste inzage bij incidenten (RTG beoordeelt)
  if (!db.data.paspoortLog) db.data.paspoortLog = [];               // volledig audit-log van alle inzages
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
      ],
      // 5-sterren autoverkoop: een exclusieve showroom naast de verhuur
      verkoop: { aan: true, showroom: [
        { id: 'v1', merk: 'Porsche', model: '911 Carrera S', jaar: 2023, km: 12400, prijs: 149500, brandstof: 'Benzine',
          transmissie: 'PDK automaat', kleur: 'GT-zilver', vermogenPk: 450, opties: ['Sport Chrono', 'Panoramadak', 'Bose'],
          garantieMnd: 24, historie: 'Volledige Porsche-onderhoudshistorie, eerste eigenaar, ongevalvrij.', fotos: [], vip: true, status: 'te koop' },
        { id: 'v2', merk: 'Mercedes-Benz', model: 'G 400d AMG Line', jaar: 2022, km: 28900, prijs: 138000, brandstof: 'Diesel',
          transmissie: 'Automaat', kleur: 'Obsidiaanzwart', vermogenPk: 330, opties: ['Burmester', 'Nachtpakket', 'Trekhaak'],
          garantieMnd: 24, historie: 'Dealeronderhouden, tweede eigenaar.', fotos: [], vip: true, status: 'te koop' },
        { id: 'v3', merk: 'Tesla', model: 'Model 3 Long Range', jaar: 2024, km: 8600, prijs: 46900, brandstof: 'Elektrisch',
          transmissie: 'Automaat', kleur: 'Parelwit', vermogenPk: 498, opties: ['Autopilot', 'Trekhaak'],
          garantieMnd: 36, historie: 'Fabrieksgarantie, als nieuw.', fotos: [], vip: false, status: 'te koop' },
        { id: 'v4', merk: 'Volkswagen', model: 'Golf GTI', jaar: 2021, km: 41200, prijs: 32750, brandstof: 'Benzine',
          transmissie: 'DSG', kleur: 'Tornado-rood', vermogenPk: 245, opties: ['Digital Cockpit', 'Trekhaak'],
          garantieMnd: 12, historie: 'Nette staat, dealeronderhouden.', fotos: [], vip: false, status: 'te koop' }
      ] }
    });
  }
  if (!Array.isArray(db.data.verkoopDeals)) db.data.verkoopDeals = [];
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
  // het charter-genre: boten en jachten verhuren, met of zonder schipper. Zelfde
  // eerlijke mechaniek als autoverhuur (vaste prijs vooraf, staat met foto's voor
  // en na, borg, SOS en live positie op het water), aangevuld met vaartuig-specifieke
  // zaken: motoruren, brandstof, ligplaats, en bemand (crewed) of bareboat varen.
  if (!db.data.supplierTypes.charter)
    db.data.supplierTypes.charter = { label: 'Boten & jachten', icon: '\u{26F5}', caps: ['charter', 'location', 'pricing'] };
  if (!db.data.suppliers.find(s => s.code === 'AZUL')) {
    const vaartuig = (id, o) => Object.assign({ id, actief: true, type: 'Motorjacht', lengte: 12, bouwjaar: 2022,
      gasten: 8, hutten: 2, slaapplaatsen: 4, brandstof: 'diesel', snelheidKn: 25, ligplaats: 'Marina Botafoch',
      dagprijs: 900, borg: 2000, skipperVerplicht: false, skipperPrijsPerDag: 300, vaarbewijsVereist: true,
      icoon: '\u{1F6E5}️', foto: null }, o);
    db.data.suppliers.push({
      code: 'AZUL', name: 'Azul Yacht Charter', type: 'charter', city: 'Ibiza',
      loc: { lat: 38.918, lng: 1.449, label: 'Marina Botafoch, Ibiza' }, rate: 0.12,
      menu: [], photos: [],
      boten: [
        vaartuig('b1', { naam: 'Serenidad', type: 'Motorjacht', lengte: 16, gasten: 12, hutten: 3, slaapplaatsen: 6,
          snelheidKn: 32, dagprijs: 1850, borg: 3500, skipperVerplicht: true, skipperPrijsPerDag: 380 }),
        vaartuig('b2', { naam: 'Tramontana', type: 'Zeiljacht', lengte: 13, gasten: 8, hutten: 3, slaapplaatsen: 6,
          snelheidKn: 9, dagprijs: 680, borg: 1500, skipperVerplicht: false, skipperPrijsPerDag: 260 }),
        vaartuig('b3', { naam: 'Levante', type: 'RIB', lengte: 9, gasten: 10, hutten: 0, slaapplaatsen: 0,
          brandstof: 'benzine', snelheidKn: 42, dagprijs: 520, borg: 1200, skipperVerplicht: false, skipperPrijsPerDag: 240 }),
        vaartuig('b4', { naam: 'Aura', type: 'Catamaran', lengte: 14, gasten: 12, hutten: 4, slaapplaatsen: 8,
          snelheidKn: 12, dagprijs: 1300, borg: 2800, skipperVerplicht: true, skipperPrijsPerDag: 320 })
      ]
    });
  }
  if (!db.data.charterFotos) db.data.charterFotos = {};   // ref -> { voor: [], na: [] }
  if (!db.data.charterLocaties) db.data.charterLocaties = {}; // ref -> { aan, lat, lng, at } (positie op het water)
  // De Salon-verplichting voor de demo-partners wordt onderaan initRealtime gezet
  // (na alle genre-seeds), zodat elke geseede partner een compleet profiel krijgt.
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
  // --- retail/mode: modehuizen, merken en winkels ---
  if (!db.data.supplierTypes.retail)
    db.data.supplierTypes.retail = { label: 'Mode & retail', icon: '🛍️', caps: ['retail', 'location', 'pricing'] };
  if (!db.data.suppliers.find(s => s.code === 'MAISON')) {
    const c1 = crypto.randomBytes(4).toString('hex'), c2 = crypto.randomBytes(4).toString('hex');
    const va = (sku, kleuren, maten, v) => { const out = []; for (const k of kleuren) for (const m of maten) out.push({ vsku: sku + '-' + k.slice(0, 3).toUpperCase() + '-' + m, kleur: k, maat: m, voorraad: v }); return out; };
    db.data.suppliers.push({
      code: 'MAISON', name: 'Maison Solène', type: 'retail', city: 'Ibiza',
      loc: { lat: 38.907, lng: 1.435, label: 'Carrer Bisbe Azara, Ibiza' }, rate: 0.10,
      menu: [], photos: [],
      settings: { retailDrempel: 3 },
      modebezorg: { aan: true, straalKm: 15, kosten: 6.5, gratisVanaf: 150, waardegrensId: 250, retourAanDeur: true },
      collecties: [
        { id: c1, naam: 'Riviera', seizoen: 'SS', jaar: 2026, actief: true, at: new Date().toISOString() },
        { id: c2, naam: 'Atelier Noir', seizoen: 'AW', jaar: 2026, actief: true, at: new Date().toISOString() }
      ],
      artikelen: [
        { id: crypto.randomBytes(4).toString('hex'), sku: 'SOL-LIN01', naam: 'Linnen overhemd', collectieId: c1, categorie: 'Overhemden',
          materiaal: '100% Europees linnen', omschrijving: 'Luchtig zomeroverhemd, mother-of-pearl knopen.', foto: null,
          publiekePrijs: 320, price: 320, drop: null, at: new Date().toISOString(),
          varianten: va('SOL-LIN01', ['Ecru', 'Zeeblauw'], ['S', 'M', 'L', 'XL'], 6) },
        { id: crypto.randomBytes(4).toString('hex'), sku: 'SOL-SLIP', naam: 'Zijden slipdress', collectieId: c1, categorie: 'Jurken',
          materiaal: 'Sandwashed zijde', omschrijving: 'Bias-cut jurk met verstelbare bandjes.', foto: null,
          publiekePrijs: 690, price: 690, drop: null, at: new Date().toISOString(),
          varianten: va('SOL-SLIP', ['Champagne', 'Onyx'], ['XS', 'S', 'M', 'L'], 4) },
        { id: crypto.randomBytes(4).toString('hex'), sku: 'SOL-TRENCH', naam: 'Atelier trenchcoat', collectieId: c2, categorie: 'Jassen',
          materiaal: 'Waterafstotend gabardine', omschrijving: 'Dubbele rij knopen, afneembare ceintuur.', foto: null,
          publiekePrijs: 1450, price: 1450, drop: { datum: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), tijd: '11:00', gereleased: false }, at: new Date().toISOString(),
          varianten: va('SOL-TRENCH', ['Camel', 'Zwart'], ['S', 'M', 'L'], 2) }
      ],
      klanten: {}
    });
  }
  if (!db.data.retailApart) db.data.retailApart = [];
  if (!Array.isArray(db.data.modeBezorg)) db.data.modeBezorg = [];   // veilige mode-bezorgingen
  // --- groothandel & markt: B2B naar horeca, boodschappen naar leden, doorverkoop ---
  if (!db.data.supplierTypes.groothandel)
    db.data.supplierTypes.groothandel = { label: 'Groothandel & markt', icon: '📦', caps: ['groothandel', 'bezorgen', 'location', 'pricing'] };
  if (!Array.isArray(db.data.groothandelOrders)) db.data.groothandelOrders = [];
  if (!db.data.suppliers.find(s => s.code === 'MERCABIZA')) {
    const gp = (naam, categorie, eenheid, inkoop, cons, voorraad, minB, herkomst) => ({
      id: crypto.randomBytes(4).toString('hex'), naam, categorie, eenheid,
      inkoopPrijs: inkoop, consumentPrijs: cons, voorraad, minBestel: minB, btw: 9, herkomst: herkomst || '', allergenen: '', actief: true
    });
    db.data.suppliers.push({
      code: 'MERCABIZA', name: 'Mercabiza Groothandel', type: 'groothandel', city: 'Ibiza',
      loc: { lat: 38.906, lng: 1.421, label: "Poligono Montecristo, Ibiza" }, rate: 0.08,
      menu: [], photos: [],
      groothandel: {
        functies: {},   // wordt met de standaard (alles aan) gevuld door de kern
        producten: [
          gp('Verse tonijn (loin)', 'Vlees & vis', 'kg', 22, 32, 40, 2, 'Middellandse Zee'),
          gp('Zeebaars heel', 'Vlees & vis', 'kg', 14, 21, 30, 2, 'Spanje'),
          gp('Iberico secreto', 'Vlees & vis', 'kg', 18, 27, 25, 2, 'Spanje'),
          gp('Manchego 12 mnd', 'Zuivel', 'stuk', 9, 14, 60, 1, 'La Mancha'),
          gp('Roomboter', 'Zuivel', 'pak', 3, 4.5, 120, 4, 'NL'),
          gp('Trostomaten', 'Groente & fruit', 'kg', 2.2, 3.4, 90, 3, 'Almería'),
          gp('Citroenen', 'Groente & fruit', 'net', 1.8, 2.9, 80, 2, 'Valencia'),
          gp('Olijfolie extra vergine 5L', 'Droog & houdbaar', 'can', 28, 39, 45, 1, 'Andalusië'),
          gp('Cava brut', 'Dranken', 'fles', 6, 11, 200, 6, 'Penedès'),
          gp('Mineraalwater 1,5L', 'Dranken', 'krat', 4.5, 7, 150, 4, 'ES'),
          gp('Diepvriesfriet 2,5kg', 'Diepvries', 'zak', 4.2, 6.5, 70, 3, 'NL'),
          gp('Servetten (pak 500)', 'Non-food', 'pak', 5, 8, 100, 2, '')
        ]
      }
    });
  }
  // --- beveiliging: een commandocentrum + PDA voor topbeveiligingsteams ---
  if (!db.data.supplierTypes.beveiliging)
    db.data.supplierTypes.beveiliging = { label: 'Beveiliging & security', icon: '🛡️', caps: ['beveiliging', 'location'] };
  if (!Array.isArray(db.data.bevDiensten)) db.data.bevDiensten = [];
  if (!Array.isArray(db.data.bevAanvragen)) db.data.bevAanvragen = [];
  if (!Array.isArray(db.data.bevIncidenten)) db.data.bevIncidenten = [];
  if (!Array.isArray(db.data.bevRondes)) db.data.bevRondes = [];
  if (!db.data.suppliers.find(s => s.code === 'AEGIS')) {
    db.data.suppliers.push({
      code: 'AEGIS', name: 'Aegis Elite Security', type: 'beveiliging', city: 'Ibiza',
      loc: { lat: 38.909, lng: 1.432, label: 'Passeig de Vara de Rey, Ibiza' }, rate: 0.10,
      menu: [], photos: [],
      beveiliging: {
        functies: {},   // wordt met de standaard (alles aan) door de kern gevuld
        budget: { periodeUren: 720, tariefUur: 55 },
        posten: [
          { id: crypto.randomBytes(4).toString('hex'), naam: 'Villa Cala Jondal', adres: 'Cala Jondal, Ibiza', klant: 'Privé-residentie', lat: 38.876, lng: 1.383, minMan: 2, shifts: ['dag', 'avond', 'nacht'], orders: 'Toegang alleen op gastenlijst. Ronde elk uur langs het strandhek.', actief: true },
          { id: crypto.randomBytes(4).toString('hex'), naam: 'Marina Botafoch VIP', adres: 'Marina Botafoch, Ibiza', klant: 'Jachthaven', lat: 38.918, lng: 1.451, minMan: 1, shifts: ['avond', 'nacht'], orders: 'Steiger 3 t/m 7. Let op onbevoegden bij de jachten.', actief: true },
          { id: crypto.randomBytes(4).toString('hex'), naam: 'Event Ushuaïa', adres: 'Platja d\'en Bossa, Ibiza', klant: 'Evenement', lat: 38.884, lng: 1.408, minMan: 3, shifts: ['avond', 'nacht'], orders: 'Fouilleren bij de hoofdingang. Backstage streng afgeschermd.', actief: true }
        ]
      }
    });
  }
  // --- boerderij: boeren en tuinders met een slim bedrijfssysteem + AI-adviseur ---
  if (!db.data.supplierTypes.boerderij)
    db.data.supplierTypes.boerderij = { label: 'Boerderij & landbouw', icon: '\u{1F69C}', caps: ['boerderij', 'location', 'pricing'] };
  if (!db.data.suppliers.find(s => s.code === 'CANFERRER')) {
    const dag = n => new Date(Date.now() - n * 86400000).toISOString();
    db.data.suppliers.push({
      code: 'CANFERRER', name: 'Finca Can Ferrer', type: 'boerderij', city: 'Ibiza',
      loc: { lat: 39.033, lng: 1.435, label: 'Santa Agnes de Corona, Ibiza' }, rate: 0.05,
      menu: [], photos: [],
      boerderij: {
        type: 'gemengd', opgezet: true, instel: {},
        percelen: [
          { id: 'pc-tarwe', naam: 'Bovenveld', ha: 6.5, gewas: 'tarwe', gezaaidOp: dag(200), oogstVerwacht: new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10), geoogstOp: null, opbrengst: 0 },
          { id: 'pc-mais', naam: 'Rivierakker', ha: 4, gewas: 'mais', gezaaidOp: dag(155), oogstVerwacht: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), geoogstOp: null, opbrengst: 0 },
          { id: 'pc-kas', naam: 'Kasblok 1', ha: 0.8, gewas: 'tomaat', gezaaidOp: dag(40), oogstVerwacht: new Date(Date.now() + 50 * 86400000).toISOString().slice(0, 10), geoogstOp: null, opbrengst: 0, laatsteWater: dag(3) },
          { id: 'pc-braak', naam: 'Onderveld', ha: 3.2, gewas: null, gezaaidOp: null, oogstVerwacht: null, geoogstOp: null, opbrengst: 0 }
        ],
        dieren: [
          { id: 'dr-koe', soort: 'melkkoe', aantal: 42, stal: 'Stal A', gezondheid: 'goed', laatsteVoer: dag(1) },
          { id: 'dr-kip', soort: 'legkip', aantal: 180, stal: 'Kippenren', gezondheid: 'goed' },
          { id: 'dr-schaap', soort: 'schaap', aantal: 25, stal: 'Weide zuid', gezondheid: 'aandacht' }
        ],
        taken: [
          { id: 'tk-1', wat: 'Rivierakker maisoogst starten', waar: 'Rivierakker', voor: new Date().toISOString().slice(0, 10), klaar: false, at: dag(2) },
          { id: 'tk-2', wat: 'Dierenarts bellen voor de schapen', waar: 'Weide zuid', voor: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), klaar: false, at: dag(1) }
        ]
      }
    });
  }
  // --- content creators: influencers/videomakers met een carriere-app ---
  if (!db.data.supplierTypes.creator)
    db.data.supplierTypes.creator = { label: 'Content creator', icon: '\u{1F3AC}', caps: ['creator', 'location', 'pricing'] };
  if (!db.data.suppliers.find(s => s.code === 'LUMINA')) {
    db.data.suppliers.push({
      code: 'LUMINA', name: 'Lumina Media', type: 'creator', city: 'Ibiza',
      loc: { lat: 38.909, lng: 1.434, label: 'Ibiza' }, rate: 0.10, menu: [], photos: [],
      creator: {
        opgezet: true, niche: 'Reizen & lifestyle', bio: 'Ik maak cinematische reiscontent over Ibiza en het eiland-leven.',
        platforms: [
          { id: 'pf1', platform: 'instagram', handle: '@lumina.travels', volgers: 84000 },
          { id: 'pf2', platform: 'tiktok', handle: '@luminatravels', volgers: 152000 },
          { id: 'pf3', platform: 'youtube', handle: 'Lumina Media', volgers: 41000 }
        ],
        tarieven: [
          { id: 'tr1', soort: 'reel', prijs: 850 },
          { id: 'tr2', soort: 'video', prijs: 2400 },
          { id: 'tr3', soort: 'story', prijs: 300 }
        ],
        portfolio: [
          { id: 'po1', titel: 'Sunset sailing Ibiza', link: null, soort: 'video' },
          { id: 'po2', titel: 'Beach club reel', link: null, soort: 'reel' }
        ],
        ideeen: [
          { id: 'id1', tekst: 'Verborgen strandjes van Ibiza', status: 'productie', voor: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), script: null, at: new Date().toISOString() },
          { id: 'id2', tekst: 'Een dag met een lokale visser', status: 'idee', voor: null, script: null, at: new Date().toISOString() }
        ]
      }
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
  if (!db.data.onboarding) db.data.onboarding = { scopes: {}, profielen: {} }; // verplichte intake + contract per scope (platform 'rtg' of leverancier-code)
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
  /* ---- de negen nieuwe sectoren: elke sector een eigen app-ingang op
     dezelfde motor. De types wijzen naar bestaande vermogens (caps), zodat
     kassa, personeel, facturen, contracten, borden en AI overal meteen
     werken; per sector een demopartner om mee te spelen. ---- */
  const NIEUWE_TYPES = {
    beachclub:   { label: 'Beachclub', icon: '\u{1F3D6}️', caps: ['menu', 'orders', 'reservations', 'location', 'pricing'] },
    koffie:      { label: 'Koffie & patisserie', icon: '☕', caps: ['menu', 'orders', 'location', 'pricing'] },
    chef:        { label: 'Privéchef & catering', icon: '\u{1F468}‍\u{1F373}', caps: ['services', 'location', 'pricing'] },
    villa:       { label: "Villa's & fincas", icon: '\u{1F334}', caps: ['bookings', 'doors', 'location', 'pricing'] },
    tweewielers: { label: 'Tweewielers & quads', icon: '\u{1F6F5}', caps: ['huur', 'location', 'pricing'] },
    events:      { label: 'Events & festivals', icon: '\u{1F3AA}', caps: ['tickets', 'rides', 'location', 'pricing'] },
    wellness:    { label: 'Wellness & spa', icon: '\u{1F9D6}', caps: ['services', 'bookings', 'location', 'pricing'] },
    juwelier:    { label: 'Juwelier & horloges', icon: '\u{1F48E}', caps: ['retail', 'services', 'location', 'pricing'] },
    galerie:     { label: 'Kunst & galerie', icon: '\u{1F5BC}️', caps: ['tickets', 'retail', 'location', 'pricing'] }
  };
  for (const [t, def] of Object.entries(NIEUWE_TYPES)) if (!db.data.supplierTypes[t]) db.data.supplierTypes[t] = def;
  const NIEUWE_PARTNERS = [
    { code: 'VORA', name: 'Vora Beach Club', type: 'beachclub', city: 'Ibiza',
      loc: { lat: 38.995, lng: 1.535, label: 'Cala Nova, Ibiza' }, rate: 0.16, photos: [],
      menu: [
        { id: 'v1', cat: 'Bowls', name: 'Tuna poke bowl', desc: 'Verse tonijn, sushirijst, avocado.', price: 24, allergens: ['vis', 'soja'] },
        { id: 'v2', cat: 'Dranken', name: 'Cava rose, fles', desc: 'Gekoeld aan uw bed geserveerd.', price: 58, allergens: [], station: 'bar' },
        { id: 'v3', cat: 'Snacks', name: 'Nachos del mar', desc: 'Voor bij het bed, om te delen.', price: 14, allergens: ['melk'] }
      ] },
    { code: 'BRISA', name: 'Cafe Brisa', type: 'koffie', city: 'Ibiza',
      loc: { lat: 38.908, lng: 1.432, label: 'Vara de Rey, Ibiza-stad' }, rate: 0.15, photos: [],
      menu: [
        { id: 'k1', cat: 'Koffie', name: 'Flat white', desc: 'Dubbele shot, huisgebrande bonen.', price: 4.5, allergens: ['melk'], station: 'bar' },
        { id: 'k2', cat: 'Patisserie', name: 'Ensaimada', desc: 'Vers uit de eigen oven.', price: 5, allergens: ['gluten', 'ei'] },
        { id: 'k3', cat: 'Patisserie', name: 'Taart van de dag', desc: 'Vraag naar de smaak; hele taarten op bestelling.', price: 6.5, allergens: ['gluten', 'melk', 'ei'] }
      ] },
    { code: 'FUEGO', name: 'Chef Fuego', type: 'chef', city: 'Ibiza', vak: 'Privéchef & catering',
      loc: { lat: 38.92, lng: 1.44, label: 'heel het eiland, op locatie' }, rate: 0.1, menu: [], photos: [],
      services: [
        { id: 's1', name: 'Privédiner op de villa, 4 gangen', desc: 'Chef en bediening aan huis; menu op maat, boodschappen inbegrepen.', price: 145, duurMin: 240, soort: 'dienst' },
        { id: 's2', name: 'Catering aan boord, per gast', desc: 'Koude en warme catering voor charters en jets.', price: 65, soort: 'product' },
        { id: 's3', name: 'Paella-workshop, groep', desc: 'Twee uur samen koken en daarna samen eten.', price: 480, duurMin: 120, soort: 'dienst' }
      ] },
    { code: 'LUNARA', name: 'Casa Lunara', type: 'villa', city: 'Ibiza',
      loc: { lat: 38.887, lng: 1.29, label: 'Es Cubells, Ibiza' }, rate: 0.12, menu: [], photos: [],
      rooms: [
        { id: 'w1', name: 'Villa Lunara, 6 gasten', desc: 'Eigen chef-keuken, infinity pool, drie suites', price: 1450, available: true },
        { id: 'w2', name: 'Finca Vella, 8 gasten', desc: 'Historische finca met wijngaard en gastenverblijf', price: 1850, available: true }
      ],
      doors: [
        { id: 'd1', name: 'Poort (oprit)', locked: true },
        { id: 'd2', name: 'Villa Lunara', locked: true },
        { id: 'd3', name: 'Finca Vella', locked: true }
      ] },
    { code: 'MOTOISLA', name: 'Moto Isla', type: 'tweewielers', city: 'Ibiza',
      loc: { lat: 38.906, lng: 1.42, label: 'Ibiza-stad, ringweg' }, rate: 0.12, menu: [], photos: [],
      autos: [
        { id: 'm1', name: 'Vespa Primavera 125', plate: 'IB-88-VP', dagprijs: 35, actief: true,
          categorie: 'Scooter', transmissie: 'automaat', brandstof: 'benzine', stoelen: 2, deuren: 0,
          airco: false, bagage: 1, kmPerDag: 0, meerKm: 0, borg: 150, minLeeftijd: 18, icoon: '\u{1F6F5}' },
        { id: 'm2', name: 'Yamaha MT-07', plate: 'IB-70-MT', dagprijs: 79, actief: true,
          categorie: 'Motor (A2)', transmissie: 'handgeschakeld', brandstof: 'benzine', stoelen: 2, deuren: 0,
          airco: false, bagage: 1, kmPerDag: 250, meerKm: 0.2, borg: 500, minLeeftijd: 21, icoon: '\u{1F3CD}️' },
        { id: 'm3', name: 'CFMOTO CForce quad', plate: 'IB-44-QD', dagprijs: 95, actief: true,
          categorie: 'Quad', transmissie: 'automaat', brandstof: 'benzine', stoelen: 2, deuren: 0,
          airco: false, bagage: 1, kmPerDag: 150, meerKm: 0.3, borg: 600, minLeeftijd: 21, icoon: '\u{1F69C}' }
      ] },
    { code: 'FESTA', name: 'Festa Ibiza Events', type: 'events', city: 'Ibiza',
      loc: { lat: 38.955, lng: 1.23, label: 'Cala Comte, Ibiza' }, rate: 0.14, menu: [], photos: [],
      activiteiten: [
        { id: 'e1', name: 'Sunset Sessions, dagticket', desc: 'Live acts op het strand, van middag tot middernacht.', prijs: 65, capaciteit: 400, duur: 'hele dag', tijden: ['14:00'] },
        { id: 'e2', name: 'VIP-deck met host', desc: 'Eigen deck, host en fles-service voor uw groep.', prijs: 240, capaciteit: 40, duur: 'hele avond', tijden: ['18:00'] }
      ] },
    { code: 'SERENA', name: 'Serena Spa', type: 'wellness', city: 'Ibiza',
      loc: { lat: 38.98, lng: 1.53, label: 'Santa Eularia, Ibiza' }, rate: 0.12, menu: [], photos: [],
      services: [
        { id: 'w1', name: 'Deep tissue massage, 60 min', desc: 'In een van onze cabines of op uw suite.', price: 95, duurMin: 60, soort: 'dienst' },
        { id: 'w2', name: 'Spa-dag voor twee', desc: 'Hammam, sauna, behandeling en lunch.', price: 260, duurMin: 300, soort: 'dienst' },
        { id: 'w3', name: 'Gua sha thuisset', desc: 'Onze eigen lijn, geleverd op de kamer.', price: 45, soort: 'product' }
      ],
      rooms: [
        { id: 'c1', name: 'Cabine Mar', desc: 'Behandelcabine met zeezicht', price: 0, available: true },
        { id: 'c2', name: 'Cabine Bosc', desc: 'Behandelcabine aan de tuin', price: 0, available: true }
      ] },
    { code: 'ORODOR', name: "Casa d'Oro", type: 'juwelier', city: 'Ibiza',
      loc: { lat: 38.909, lng: 1.435, label: 'Dalt Vila, Ibiza' }, rate: 0.1, menu: [], photos: [],
      services: [
        { id: 'j1', name: 'Privé-afspraak in de salon', desc: 'Een uur met onze meester-juwelier, op afspraak.', price: 0, duurMin: 60, soort: 'dienst' },
        { id: 'j2', name: 'Taxatie met certificaat', desc: 'Voor verzekering of verkoop, klaar terwijl u wacht.', price: 85, duurMin: 45, soort: 'dienst' },
        { id: 'j3', name: 'Ontwerp op maat, aanbetaling', desc: 'Eigen ontwerp, gesmeed in ons atelier.', price: 500, soort: 'product' }
      ] },
    { code: 'LIENZO', name: 'Galeria Lienzo', type: 'galerie', city: 'Ibiza',
      loc: { lat: 38.907, lng: 1.434, label: 'Dalt Vila, Ibiza' }, rate: 0.1, menu: [], photos: [],
      activiteiten: [
        { id: 'g1', name: 'Expositie-entree', desc: 'Hedendaagse eilandkunst, wisselende collectie.', prijs: 10, capaciteit: 60, duur: 'vrij bezoek', tijden: ['11:00', '14:00', '17:00'] },
        { id: 'g2', name: 'Vernissage met de kunstenaar', desc: 'Besloten avond, cava en rondleiding.', prijs: 35, capaciteit: 30, duur: '2 uur', tijden: ['19:00'] }
      ] }
  ];
  for (const p of NIEUWE_PARTNERS) if (!db.data.suppliers.find(s => s.code === p.code)) { db.data.suppliers.push(p); ensureSupplierDefaults(p); }

  // De Salon is verplicht: geef elke geseede partner een compleet profiel (bio +
  // foto), zodat ze aan leden worden getoond. Dit draait NA alle genre-seeds,
  // zodat ook vastgoed, retail en charter meelopen. Een echte partner vult dit
  // zelf in via de leverancier-app.
  const SALON_BIO = {
    restaurant: 'Fijn dineren met verse, seizoensgebonden gerechten. Reserveer via De Salon.',
    bar: 'Cocktails en sunset-sessies aan het water. Volg ons voor de line-up.',
    hotel: 'Boutiquehotel met zeezicht, spa en persoonlijke service.',
    apartment: 'Stijlvolle appartementen en villa’s met slimme deuren en privacy.',
    taxi: 'Comfortabel privevervoer over het eiland, dag en nacht.',
    jet: 'Privejets op maat, van transfer tot dagtrip, wereldwijd.',
    helikopter: 'Scenic vluchten en snelle transfers per helikopter.',
    zzp: 'Zelfstandig vakmanschap op afspraak, met oog voor detail.',
    activiteit: 'Tours, cruises en experiences om het eiland te beleven.',
    verhuur: 'Auto’s huren zonder verrassingen: vaste prijs en eerlijke staat.',
    charter: 'Boten en jachten charteren, met of zonder schipper, veilig op zee.',
    vastgoed: 'Exclusief vastgoed, discreet aangeboden aan RTG-leden.',
    retail: 'Mode en accessoires uit onze nieuwste collecties.',
    groothandel: 'Groothandel en versmarkt: aan horeca, leden en collega-groothandels, met AI-bijbestellen.',
    beachclub: 'Ligbedden aan zee, keuken en bar aan uw bed. Reserveer uw plek via De Salon.',
    koffie: 'Koffie, patisserie en taarten op bestelling; voorbestellen via de app.',
    chef: 'Privéchef en catering aan huis, op de villa of aan boord.',
    villa: 'Luxe villa’s en fincas met personeel, keyless toegang en conciërge.',
    tweewielers: 'Scooters, motoren en quads: eerlijke staat, vaste prijs, SOS onderweg.',
    events: 'Events en festivals: tickets, VIP-decks en de crew die alles regelt.',
    wellness: 'Wellness en spa: behandelingen op afspraak, in de cabine of op uw suite.',
    juwelier: 'Juwelen en horloges, privé-afspraken en ontwerp op maat.',
    galerie: 'Hedendaagse kunst: exposities, vernissages en stille verkoop.'
  };
  const salonFotoVoor = (s) => {
    const t = db.data.supplierTypes[s.type] || {};
    const kleur = ['#1b3a5b', '#5b2540', '#3a5b2e', '#5b4a1b', '#2e4a5b', '#4a2e5b'][(s.code.charCodeAt(0) + s.code.length) % 6];
    const letters = s.name.replace(/[^A-Za-z ]/g, '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'RTG';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="' + kleur + '"/>' +
      '<text x="160" y="118" font-family="Georgia,serif" font-size="64" fill="#ffffff" text-anchor="middle" opacity="0.92">' + letters + '</text>' +
      '<text x="160" y="160" font-family="Arial,sans-serif" font-size="16" fill="#ffffff" text-anchor="middle" opacity="0.7">' + (t.label || '') + '</text></svg>';
    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  };
  for (const s of db.data.suppliers) {
    if (!s.salon) s.salon = { bio: '', foto: null, volgers: [], sinds: new Date().toISOString() };
    if (!s.salon.bio) s.salon.bio = SALON_BIO[s.type] || 'RTG-partner. Volg ons op De Salon voor aanbod en folders.';
    if (!s.salon.foto && !(s.photos && s.photos.length)) s.salon.foto = salonFotoVoor(s);
  }
}

// stuur een sync-signaal naar één of meer tiers (open schermen herladen data)
function broadcastSync(tiers, scope) {
  bus.publish('sse', { doel: 'tier', match: [...tiers], event: 'sync', data: { scope } });
}

// notificeer één tier: opslaan, naar open schermen sturen én web-push
function notify(tier, note) {
  const n = { id: crypto.randomBytes(4).toString('hex'), read: false, at: new Date().toISOString(), ...note };
  // meldingsvoorkeuren (kern/ervaring.js): een uitgezette scope wordt niet
  // opgeslagen en niet gepusht; zonder voorkeur staat alles aan
  const vk = (db.data.meldingVoorkeur || {})[tier];
  if (n.scope && vk && vk[n.scope] === false) return n;
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
/* De leden-laag (contactregels, memberTemplate, de leden-app-state en de
   eigen sollicitaties) staat in server/kern/lid.js. findSupplier en geborenVan
   zijn hoisted functies en dus hier al bruikbaar. */
/* Wereldtalen (server/talen.js): de Boardroom zet per taal een schakelaar aan of
   uit; iedereen chat in de eigen taal en de ander leest alles in de zijne. Vroeg
   opgezet zodat de leden-laag (en alles daarna) taalVan kan gebruiken. */
const talen = maakTalen({ db, save });
const { hasContact, addContact, canEngage, engageError, registerContact, stateFor, myApplications } =
  maakLid({ db, accounts, PERSONAS, findSupplier, i18n, rtf, talen, leeftijdVan, leeftijdsgroepVan, geborenVan });

/* Startinhoud voor een nieuw account: een eigen kopie van de voorbeeldreis en
   -facturen. Hoisted en dus ook bruikbaar door de demo-seed hierboven (die vóór
   de leden-kern draait); de lid-module heeft intern zijn eigen kopie. */
function memberTemplate() {
  return {
    invoices: JSON.parse(JSON.stringify(db.data.invoices)),
    trip: JSON.parse(JSON.stringify(db.data.trip)),
    creatorCredit: 0,
    creatorLikes: 0
  };
}




/* Na een reactie/DM van een hoger lid op een RTG-post: leg het contact vast. */

/* ---------- state per gebruiker ---------- */

/* Startinhoud voor een nieuw account: een eigen kopie van de voorbeeldreis en
   -facturen, zodat elk lid zijn eigen boekingen/betalingen heeft (wat de één
   betaalt, verandert niets bij de ander). */


// De sollicitaties van dit lid, over alle partners heen, nieuwste eerst.

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

/* Mediastore: Salon-foto's en snaps staan als losse (versleutelde) bestanden op
   schijf, niet als base64 in db.data. Zo blijft het werkgeheugen en elke snapshot
   klein, hoeveel er ook gepost wordt. De publieke Salon-foto's worden via de
   /media-route uitgeserveerd; snaps komen alleen eenmalig als data-URL terug. */
const media = require('./media').maakMedia({ dir: DATA_DIR });
app.get('/media/:naam', (req, res) => { media.serveer(req, res).catch(() => { if (!res.headersSent) res.status(500).end(); }); });
// Eenmalige verhuizing van al bestaande base64-foto's (Salon + snaps) naar de
// mediastore, zodat ook oude data het geheugen niet meer belast. Alleen de
// schrijver migreert; idempotent, dus veilig bij elke start. Async (kan naar S3).
console.log('[media] opslag-backend:', media.backendNaam);
if (db.writable) {
  media.migreerDb(db)
    .then(n => { if (n > 0) { save(); console.log('[media] ' + n + ' bestaande foto(s) naar de mediastore verplaatst.'); } })
    .catch(e => console.warn('[media] migratie overgeslagen:', e.message));
}

/* Een versleuteld geupload bestand (identiteitsbewijs/selfie) ontsleutelen en
   als data-URL teruggeven, zodat de paspoortlaag een goedgekeurde inzage kan
   tonen. Geen padtraversal: alleen de kale bestandsnaam telt. */
function leesUploadDataUrl(fname) {
  try {
    const file = path.basename(String(fname || ''));
    const full = path.join(UPLOAD_DIR, file);
    if (!file || !full.startsWith(UPLOAD_DIR) || !fs.existsSync(full)) return null;
    const buf = require('./kluis').ontsleutelBuf(fs.readFileSync(full));
    const ext = (file.split('.').pop() || 'jpg').toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return 'data:' + mime + ';base64,' + buf.toString('base64');
  } catch (e) { return null; }
}



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
const sociaal = require('./kern/sociaal')({ db, save, sseToCustomer, rtf, crypto, gidsHaal, gidsZoekCodenaam, media });
// Verplichte intake (paspoort/e-mail/telefoon/adres/standaard) + contract voor elk
// account, per scope (platform 'rtg' of leverancier-code), AI-aanpasbaar.
const onboarding = require('./kern/onboarding').maakOnboarding({ db, save, crypto, accounts, anthropic, schoon });
// De slimme boerderij-laag (kern/boerderij.js): boerderijtypes, percelen+gewassen,
// dieren, takenbord, seizoensbriefing en een AI-adviseur die ook dingen doet.
const boerderij = require('./kern/boerderij').maakBoerderij({ db, save, crypto, findSupplier, anthropic, schoon });
// De content-creator-laag (kern/creator.js): carriere-profiel, platforms, tarieven,
// portfolio, content-kalender en een AI content/script-helper.
const creator = require('./kern/creator').maakCreator({ db, save, crypto, anthropic, schoon });
// De samenwerkingslaag (kern/samenwerking.js): EGn knop tussen creators en
// leveranciers, plus oproepen voor content creators.
const samenwerking = require('./kern/samenwerking').maakSamenwerking({ db, save, crypto, findSupplier, notifySupplier, sseToSupplier, schoon });
// De persoonlijke, interactieve AI-agenda (kern/agenda.js) voor leveranciers en
// leden, in de boardroom, met een ballon-badge op de voorkant.
const agenda = require('./kern/agenda').maakAgenda({ db, save, crypto, anthropic, schoon });
// De centrale facturatielaag (kern/facturatie.js): bij elke verkoop/dienst/verhuur
// automatisch EGn tweezijdige factuur die beide partijen in de app zien, plus een
// AI-factuurtool. Alle apps haken hierop in.
const facturatie = require('./kern/facturatie').maakFacturatie({ db, save, crypto, findSupplier, keyVanCodenaam, notify, notifySupplier, sseToCustomer, sseToSupplier, factuur, anthropic, schoon });
// De marktplaats (kern/markt.js): één gedeelde motor voor de RTFoundation-app
// (gezinnen kopen/verkopen) en voor leveranciers die er ook op willen verkopen.
const markt = require('./kern/markt').maakMarkt({ db, save, crypto, anthropic, schoon, notify, notifySupplier, haversine, betaal });
rtf.setMarkt(markt);
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
  const to = talen.taalVan(req.body.to); // elke actieve wereldtaal mag als doel
  const from = req.body.from || undefined; // translate valideert tegen het register
  try {
    const out = await i18n.translate(text, to, from);
    res.json(out);
  } catch (e) {
    res.json({ text, translated: false });
  }
});

/* Wereldtalen: de actieve talen voor de taalkiezers in alle apps (publiek;
   ook de inlogschermen tonen de kiezer al). De schakelaars zelf zitten in de
   RTG Boardroom (/api/boardroom/talen). */
app.post('/api/talen', (req, res) => res.json({ talen: talen.actieve() }));

/* ---------- partnerkanaal: boeken zonder pas ----------
   Publieke endpoints (geen login): partner opzoeken, reizen ophalen en
   boeken via een partnercode. RTG verdient niets aan een boeking; de gast
   betaalt de nettoprijs en een eventuele service gaat volledig naar de
   partner. RTG's enige inkomsten zijn de abonnementen. */

/* De klant ziet alleen totaalprijzen. Nettoprijs en service blijven interne
   administratie (db.json); RTG's aandeel is per definitie nul. */

function findPartner(code) {
  code = String(code || '').trim().toUpperCase();
  return db.data.partners.find(p => p.code === code) || null;
}

function findStaffPartner(staffCode) {
  staffCode = String(staffCode || '').trim().toUpperCase();
  return db.data.partners.find(p => p.staff && p.staff.code === staffCode) || null;
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

// dashboarddata voor de ingelogde leverancier
// Schaalvast: de schermen krijgen alleen het werk van nu plus een korte staart;
// alles daarbuiten loopt via gepagineerde endpoints en totalen.

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
/* Tickets (activiteiten/musea) leven als boekingen met soort 'ticket', zodat
   betalen, boekhouding, timeline en export automatisch meedoen. Deze helper
   geeft de tickets van een tijdslot; verlopen onbetaalde (ouder dan 30 min)
   tellen niet mee voor de capaciteit. */

// ---- kamers (hotel/appartement): aan/uit, toevoegen, verwijderen ----
/* ---- housekeeping: status per kamer ----
   schoon / vuil / bezig / bezet / defect. Defect maakt de kamer direct
   onboekbaar en zet automatisch een klus voor onderhoud klaar. */

// ---- klussen (onderhoud): melden, oppakken, afronden ----

// ---- gevonden voorwerpen ----


// ---- fotopagina: foto's die gasten zien bij de partner ----

// ---- rechtstreeks publiceren op De Salon (als RTG-partner) ----

/* ---- De Salon voor bedrijven: volgers, aanbiedingen, polls en cijfers ----
   Het Salon-profiel is een verplicht onderdeel van elk partnerschap; deze
   endpoints geven de zaak marketinggereedschap en klantbinding. */

// lid volgt of ontvolgt een zaak

// exclusieve member-aanbieding plaatsen (klantbinding: claimen met een code)

// lid claimt een aanbieding en krijgt een persoonlijke code voor aan de kassa

// de zaak verzilvert een claimcode aan de kassa

// poll plaatsen: vraag de leden wat zij willen (marketinginzicht)


// het bedrijfsprofiel: bio instellen en de marketingcijfers van de zaak


// ---- kassa: verkopen registreren, per sector (bon, kamer, rit) ----

// dagoverzicht (Z-rapport): ontvangen vandaag, per betaalmethode en medewerker.
// Kamerlasten tellen pas mee als omzet bij het uitchecken (anders dubbel).

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


// De gearriveerde gast opent de voordeur vanuit de leden-app (digitale sleutel).

/* ---- gastchat: rechtstreeks appen met roomservice of de eigenaar ----
   Een gesprek per lid per partner, op codenaam. De gast begint vanuit de
   leden-app; het personeel antwoordt vanuit de Gastchat-tab. Beide kanten
   live via SSE, met notificaties over en weer. */
// afdelingen per sector: de gast kiest met wie hij spreekt

/* De werk-laag (vacatures, sollicitatiechat en chatvertaling) staat in
   server/kern/werk.js. VAC_SOORTEN komt daar rechtstreeks vandaan; de functies
   dragen db, i18n, mail, LANDEN en de leverancier-/realtime-helpers.
   findSupplier, sseToSupplier, notifySupplier en notify zijn hoisted functies. */
const { trChat, chatApplicant, ensureApplyChat, applyChatPubliek, applyChatVertaald, chatStuur, meldWerkgever, openVacatures, werkgeverSollicitatie, notifyApplicant } =
  maakWerk({ db, save, i18n, mail, LANDEN, findSupplier, sseToSupplier, sseToCustomer, notifySupplier, notify });

/* De leverancier-laag (publieke weergave, dashboard/supplierState, kassa,
   gastchat, kamers/HK, deuren, tickets, De Salon, AI-zoekhulpjes, zaak-opties)
   staat in server/kern/leverancier.js. Draait na de werk-kern omdat
   supplierState werkgeverSollicitatie meeneemt; de primitieven (findSupplier,
   sse-routers, notifySupplier, logActivity, supplierAuth, ensureSupplierDefaults)
   blijven hierboven. HK_STATUSES, POS_METHODS, DOOR_RELOCK_MS, TABLE_STATUSES en
   ZAAK_OPTIES komen als directe export uit dezelfde module. */
const {
  publicTrip, deptsFor, chatKeyOf, getChat, validDept, zorgContact, klantSalon, publicSupplier, magBezorgen,
  ticketsVoorSlot, addTicket, setRoomHk, salonNaarVolgers, posDay, unlockDoor,
  makeSupplierCode, managerOnly, optieAan, aiFindRoom, aiFindDoor, supplierState
} = maakLeverancier({
  db, save, crypto, i18n, notify, broadcastSync, sseToSupplier, sseToCustomer,
  logActivity, findSupplier, connectedSupplierCodes, guestsFor, gidsHaal,
  etaMinutes, haversine, accounts, werkgeverSollicitatie
});

/* De ervaring-laag (kern/ervaring.js): tafelreserveringen, annuleren, reviews,
   favorieten, fooi, de reisagenda, rekening splitsen, wachtlijsten, RTG-punten
   en meldingsvoorkeuren. Draait na de leverancier- en sociaal-kern omdat hij
   ticketsVoorSlot, optieAan en zijnVrienden meeneemt. */
const {
  reserveerTafel, mijnReserveringen, annuleerReservering, beslisReservering,
  annuleerItem, plaatsReview, reviewsVoor, ratingVan, reviewReageer, toggleFavoriet,
  favorietenVan, isFavoriet, fooiUit, agendaVoor, maakSplits, mijnSplitsen,
  betaalSplits, zetOpWachtlijst, mijnWachtlijst, meldWachtlijst, rsvpAnnuleer,
  puntenVan, verdienPunten, verzilverPunten, pasTegoedToe, voorkeurVan, zetVoorkeur
} = maakErvaring({
  db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer,
  sseToSupplier, sseToOffice, zijnVrienden, ticketsVoorSlot, optieAan
});

/* De retail-/mode-laag (kern/retail.js): collecties, artikelen met varianten,
   voorraad, clienteling, apart leggen, paskamerverzoeken, drops, mobiele kassa,
   styling en analytics. Draait na de ervaring-kern omdat een drop-release de
   wachtlijst (meldWachtlijst) afgaat. */
const {
  isRetail: retailIsRetail, zetCollectie, zetArtikel, pasVoorraad, releaseDrop,
  klantProfiel, zetKlantMaten, voegKlantnotitie, wishlistToggle, legApart, mijnApart,
  vraagPaskamer, paskamerBreng, stuurStyling, mijnStyling, verkoop: retailVerkoop,
  voorraadZoek, retailStats, retailState, catalogus: retailCatalogus
} = maakRetail({
  db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer,
  sseToSupplier, sseToOffice, ledenPrijs, gidsHaal, meldWachtlijst
});

/* De groothandel-/marktlaag (kern/groothandel.js): een brede B2B/B2C-marktplaats.
   Een groothandel levert aan onze horeca (inkoopprijs), aan leden (boodschappen)
   en aan andere groothandels, zet zijn eigen functies aan/uit, en de AI stelt op
   basis van verkoop + mise-en-place een bijbestelling voor de horeca voor. */
const {
  GROOTHANDEL_FUNCTIES, GROOTHANDEL_CATEGORIEEN, ghIsGroothandel, ghDefaults, ghFunctieAan,
  ghFunctieLijst, ghZetFunctie, ghZetProduct, ghZetVoorraad, ghMarkt, ghPlaatsBestelling,
  ghOrderVerder, ghAnnuleer, ghMijnBestellingen, ghInkomend, ghBijbestelVoorstel
} = maakGroothandel({
  db, save, crypto, findSupplier, notify, notifySupplier, sseToSupplier, sseToCustomer, sseToOffice, anthropic
});

/* De AI-bedrijfsagent (kern/agent.js): vaste leverancier koppelen, AI-inkoop-
   voorstellen op verkoop + mise en place + verwachte drukte, en het AI-week-
   rooster; de gemachtigde (manager) keurt goed, past aan of wijst af. */
const { maakAgent } = require('./kern/agent');
const { agentKoppel, agentPubliek, agentVoorstel, agentBeslis, roosterVoorstel, roosterBeslis } = maakAgent({
  db, crypto, findSupplier, notifySupplier, ghBijbestelVoorstel, ghPlaatsBestelling,
  accounts, weekdagFactor, SHIFT_NAMES, save, logActivity
});

/* Mode-bezorging (kern/modebezorg.js): een modewinkel zet in een tik een slimme,
   veilige bezorgdienst op. Veilig voor beide kanten (bezorgcode, foto-bewijs,
   geverifieerde koerier, live volgen, ID bij dure stukken, retour aan de deur)
   en efficient (de koerier krijgt de kortste route). */
const {
  MODEBEZORG_KETEN, mbSetup, mbInstel, mbMagLeveren, mbAanvraag, mbWinkelOverzicht,
  mbRoute, mbNeem, mbGps, mbOverhandig, mbRetour, mbMijn
} = maakModebezorg({
  db, save, crypto, findSupplier, accounts, notify, notifySupplier, sseToCustomer,
  sseToSupplier, sseToOffice, haversine, etaMinutes, leesUploadDataUrl
});

/* De eigen mini-boardroom per zaak (kern/zaak.js): elke leverancier zet zijn
   eigen functies aan/uit en ziet een HR- en marketing-momentopname. */
const { ZAAK_CAPS, zaakFunctieAan, zaakFunctieLijst, zaakZet, zaakHr, zaakMarketing, zaakBoard } =
  maakZaak({ db, save, accounts });

/* De autoverkoop-laag (kern/autoverkoop.js): een 5-sterren, exclusieve
   autoverkoop bovenop het verhuurbedrijf. Showroom, proefrit, kopen met bod,
   inruil en concierge-aflevering, en een digitaal koopcontract. */
const {
  AUTOVERKOOP_BRANDSTOF, avMagVerkopen, avZetAan, avZetAuto, avVerwijderAuto, avShowroom,
  avAanbevolen, avProefrit, avKoop, avInruil, avBeslis, avTeken, avMijnDeals, avDealerInbox
} = maakAutoverkoop({ db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, media });

/* De beveiligings-laag (kern/beveiliging.js): een commandocentrum + PDA voor de
   meest geavanceerde beveiligingsteams. Rooster (met AI-overname), budget,
   posten, inzetaanvragen, patrouillerondes, incidenten en een SOS-noodknop. */
const {
  BEVEILIGING_FUNCTIES, BEVEILIGING_SHIFTS, BEVEILIGING_ERNST,
  bevIsBeveiliging, bevDefaults, bevFunctieAan, bevFunctieLijst, bevZetFunctie,
  bevPosten, bevZetPost, bevVerwijderPost, bevBudget, bevZetBudget,
  bevRooster, bevZetDienst, bevSchrapDienst, bevPlanAuto,
  bevAanvraag, bevAanvraagLijst, bevBeslisAanvraag,
  bevMijnDiensten, bevInklok, bevUitklok, bevRondeStart, bevRondeCheckpoint, bevRondeKlaar,
  bevMeldIncident, bevBeslisIncident, bevSos, bevCommand
} = maakBeveiliging({ db, save, crypto, accounts, findSupplier, notify, notifySupplier, sseToSupplier, sseToOffice, logActivity, haversine });

/* De idempotentie-administratie van de betaal-naad (server/betaal.js) durable
   maken: dezelfde idempotentiesleutel geeft ook NA een herstart hetzelfde
   resultaat terug, zodat een netwerk-herhaling of dubbeltik nooit dubbel kan
   afschrijven. Compact gehouden met een FIFO-cap; de sleutelvolgorde staat in
   _keys (echte sleutels zijn geprefixt, dus botsen daar nooit mee). */
if (!db.data.betaalIdem || typeof db.data.betaalIdem !== 'object') db.data.betaalIdem = { _keys: [] };
if (!Array.isArray(db.data.betaalIdem._keys)) db.data.betaalIdem._keys = [];
betaal.koppelStore({
  get: (k) => (k === '_keys' ? undefined : db.data.betaalIdem[k]),
  set: (k, v) => {
    if (k === '_keys') return;
    if (!(k in db.data.betaalIdem)) {
      db.data.betaalIdem._keys.push(k);
      if (db.data.betaalIdem._keys.length > 50000) {
        for (const weg of db.data.betaalIdem._keys.splice(0, db.data.betaalIdem._keys.length - 50000))
          delete db.data.betaalIdem[weg];
      }
    }
    db.data.betaalIdem[k] = v;
    try { save(); } catch (e) { /* het geheugen-resultaat blijft geldig */ }
  }
});

/* De directe-betaallaag (kern/directpay.js): elk betalend lid rekent alles met
   Face ID af via de AI en de Salon, en het geld gaat rechtstreeks van de klant
   naar de leverancier (in productie een Stripe destination charge). */
const {
  DP_MIN_CENTEN, DP_MAX_CENTEN, dpBetaalDirect, dpMijnBetalingen,
  dpVerzoekMaak, dpVerzoekenVoor, dpBetaalVerzoek, dpVerzoekIntrek, dpOntvangsten, dpRegistreerMunt
} = maakDirectpay({ db, save, crypto, findSupplier, betaal, notify, notifySupplier, sseToSupplier, sseToCustomer, sseToOffice, logActivity });

/* De RTFoundation-afdracht (kern/fonds.js): van elke bevestigde maandbetaling
   van een klant gaat automatisch 30% (ex btw) naar de foundation. De afdracht
   wordt op het betaalmoment geboekt en, zodra het IBAN in de omgeving staat,
   via de betaal-naad als uitbetaling ingepland. */
const fonds = maakFonds({ db, save, betaal, log, env: process.env });

/* Munt-ontvangst (server/muntbetaal.js + kern/munten.js): RTG accepteert
   cryptomunten voor zijn eigen diensten en zet ze via een vergunninghoudende
   aanbieder meteen om naar euro's. Durende idempotentie zodat een herhaald
   verzoek na een herstart hetzelfde adres teruggeeft. */
if (!db.data.muntIdem || typeof db.data.muntIdem !== 'object') db.data.muntIdem = { _keys: [] };
if (!Array.isArray(db.data.muntIdem._keys)) db.data.muntIdem._keys = [];
muntbetaal.koppelStore({
  get: (k) => (k === '_keys' ? undefined : db.data.muntIdem[k]),
  set: (k, v) => {
    if (k === '_keys') return;
    if (!(k in db.data.muntIdem)) {
      db.data.muntIdem._keys.push(k);
      if (db.data.muntIdem._keys.length > 50000) {
        for (const weg of db.data.muntIdem._keys.splice(0, db.data.muntIdem._keys.length - 50000))
          delete db.data.muntIdem[weg];
      }
    }
    db.data.muntIdem[k] = v;
    try { save(); } catch (e) { /* het geheugen-resultaat blijft geldig */ }
  }
});
const munten = maakMunten({ db, save, muntbetaal });

/* Een bevestigde munt-ontvangst settelt de bijbehorende factuur langs de gewone
   weg: gemarkeerd als betaald, en voor abonnementen de 30%-afdracht aan de
   RTFoundation geboekt. Zo maakt het niet uit of een lid met kaart of met munten
   betaalt: de rest van het systeem ziet hetzelfde. */
async function settleMuntFactuur(entry) {
  const ctx = entry && entry.context;
  if (!ctx) return;
  // Een rechtstreekse betaling aan een partner met munten: de leverancier wordt
  // gecrediteerd (het geld is al binnen en omgezet naar euro).
  if (ctx.soort === 'direct') {
    try { dpRegistreerMunt({ key: ctx.key, codename: ctx.codename, supplierCode: ctx.supplierCode, bedragCenten: entry.settledEuroCenten || entry.euroCenten, omschrijving: ctx.omschrijving }); }
    catch (e) { /* de afdracht mag de settlement nooit blokkeren */ }
    return;
  }
  if (ctx.soort !== 'factuur') return;
  const md = ctx.own ? accounts.getMemberState(ctx.accountId) : db.data;
  if (!md) return;
  const inv = (md.invoices || []).find(i => i.id === ctx.invoiceId);
  if (!inv || inv.status === 'paid') return;
  inv.status = 'paid';
  inv.date = 'Betaald met ' + String(entry.munt || '').toUpperCase();
  inv.betaalId = entry.id;
  if (fonds.isAbonnement(inv.desc)) {
    try { await fonds.boekAfdracht({ invoiceId: inv.id, wie: ctx.wie, bijdrage: inv.bijdrage, betaalId: entry.id, omschrijving: inv.desc }); }
    catch (e) { /* de afdracht mag de settlement nooit blokkeren */ }
  }
  if (ctx.own) accounts.saveMemberState(ctx.accountId, md); else save();
}

/* De paspoort-/identiteitslaag (kern/paspoort.js): een gecontroleerd, veilig
   en toestemmingsgestuurd kanaal waarlangs een partner de identiteit achter een
   codenaam kan opvragen (ja/nee, ID-kaart of volledige scan), met melding en
   weigering voor het lid, en RTG-beoordeelde vrijgave bij incidenten. */
const {
  mijnStatus: paspoortStatus, vraag: paspoortVraag, beslis: paspoortBeslis,
  trekIn: paspoortTrekIn, bekijk: paspoortBekijk, dienIncidentIn: paspoortIncident,
  beoordeelIncident: paspoortBeoordeel, mijnVerzoeken: paspoortMijn,
  partnerVerzoeken: paspoortPartner, incidentenVoorOffice: paspoortIncidenten
} = maakPaspoort({
  db, save, crypto, accounts, notify, notifySupplier, sseToCustomer,
  sseToSupplier, sseToOffice, leesUploadDataUrl, leeftijdVan
});

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



/* ---- cv-builder (leden-app): het cv is de sleutel tot solliciteren ---- */

// De openstaande vacatures voor een ingelogd lid: dezelfde vacatures als in de
// RTFoundation, gefilterd op de paspoortleeftijd van het lid, met de landenlijst
// om ook in het buitenland te zoeken.

// RTG-lid solliciteert bij een partner; kan pas met een afgerond cv. Solliciteren
// op een gestructureerde vacature (vacatureId) is de nieuwe, gelijke weg; het
// oude vrije functieveld blijft werken voor open sollicitaties.

/* ---- beheer: alleen managers/chefs passen instellingen, tafels en menu aan ---- */

// bestellingen en reserveringen open of dicht; leden merken het direct
/* ---- boekhouding per land en genre ----
   De fiscale tabellen (LANDEN, ZZP, FIN_CAT), het peiljaar en de rekenende
   laag (financeVoor, cannedBoekhouder) staan in server/kern/fiscaal.js. Werk
   het peiljaar en de tabellen daar elk jaar bij en laat ze fiscaal toetsen. */

/* Elke zaak is baas over de eigen opties. Alles kan aan of uit, met een
   principiele uitzondering: betalen via de app staat altijd aan (daar is
   bewust geen sleutel voor). Wel kiest de zaak het moment: vooraf of achteraf. */


// ---- tafelindeling (horeca): status door iedereen, indeling door de manager ----

// ---- team oproepen: een collega of het hele bedrijf, gericht via SSE ----

// ---- security-alarm: melding met locatie naar het hele bedrijf en RTG ----

/* ---- personeelszaken: klok, verlof/ziek en de vertrouwenslijn ----
   Kennis en kunde in de zak van elk staflid: administratie die het bedrijf en
   de medewerker allebei helpt, en een vertrouwelijke lijn naar RTG. */

/* De personeelslaag (klok, vertrouwenslijn, weekrooster) staat in
   server/kern/personeel.js. SHIFT_NAMES komt daar rechtstreeks vandaan; de
   functies dragen db + accounts. */
const { urenVan, klokVan, trustVan, scheduleFor } = maakPersoneel({ db, accounts });

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

/* ---- weekrooster: deterministisch gegenereerd per personeelslid ---- */
// (scheduleFor + SHIFT_NAMES staan in server/kern/personeel.js, hierboven opgezet.)

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


/* De backoffice-laag (officeAuth, officeState, pendingVerifications) staat in
   server/kern/kantoor.js en wordt verderop opgezet via maakKantoor(), na de
   AI-kern omdat officeState de conciergeInbox meeneemt. OFFICE_CODE blijft hier
   (nodig bij de startwaarschuwing en de kantoor-login). */

// De volledige tijdlijn van bestellingen en ritten: gepagineerd en doorzoekbaar
// over alles wat er ooit was, niet alleen de laatste zestig regels.

// Volledige export voor de boekhouding, op de server opgebouwd.



// Backoffice port een partner: een vriendelijke herinnering bij een blijven-liggen
// bestelling of rit. Maximaal een keer per tien minuten per regel.

// Dagbriefing: een leesbare samenvatting van de dag, opgebouwd uit de echte
// cijfers (geen AI-sleutel nodig, dus altijd beschikbaar en altijd juist).



// Het geüploade document bekijken (alleen backoffice; token via query voor <img>).

/* ---------- persoonlijke AI ----------
   De AI-laag (systeemprompt, demo-antwoorden, het Claude-antwoord en de
   doorlopende conversatie) staat in server/kern/ai.js. AI_TONE komt daar
   rechtstreeks vandaan; de functies dragen db, PERSONAS, de Claude-client,
   accounts en de realtime-helpers. broadcastSync en sseToOffice zijn hoisted. */
const { aiSystemPrompt, cannedAnswer, generateAiReply, convOf, memberSays, conciergeInbox } =
  maakAi({ db, PERSONAS, anthropic, accounts, broadcastSync, sseToOffice, i18n });

// De backoffice-laag draagt de AI-kern (conciergeInbox) mee, dus staat hij na maakAi.
const { officeAuth, officeState, pendingVerifications } = maakKantoor({
  db, sessionFor, eigenaar, accounts, findSupplier, connectedSupplierCodes,
  publicSupplier, conciergeInbox, beveilig, archief, grootAantal, ledenAantal
});

/* ================= DOORLOPEND GESPREK IN DE APP =================
   Elk lid heeft één doorlopend gesprek, volledig binnen de beveiligde RTG-app.
   RTG Pass wordt beantwoord door de Butler (AI); Lifestyle en Business gaan naar
   een menselijke concierge, die in de backoffice antwoordt. Er zijn geen externe
   berichtenkoppelingen (WhatsApp/Meta) meer: alle communicatie loopt via de app
   en de push-/e-maillaag van RTG zelf. */

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
  aiSystemPrompt, alcoholGrensVan, anthropic, app, appUrl, applyChatPubliek, applyChatVertaald, auth, betaal, broadcastSync,
  bufferEvent, bus, canEngage, cannedAnswer, cannedBoekhouder, cateringDishes, centen, chatApplicant,
  chatKeyOf, chatStuur, checkCred, coachCache, coachRules, conciergeInbox, connectedSupplierCodes, convOf,
  crypto, cvReady, db, deptsFor, dirTouch, eisAccount, engageError, ensureApplyChat,
  ensureSupplierDefaults, etaMinutes, eventCovers, express, fallbackRunsheet, financeVoor, findPartner, findStaffPartner,
  findSupplier, forgetSession, fs, gcCode, geborenVan, geenGast, generateAiReply, getChat,
  guestsFor, hasContact, hasCred, haversine, i18n, initRealtime, klokVan, ledenPrijs,
  leeftijdVan, leeftijdsgroepVan, leverSse, liveCodename, liveStateFor, load, logActivity, loginFails,
  mail, makeSupplierCode, managerOnly, media, meldWerkgever, memberSays, memberTemplate, myApplications, nextSseId, onboarding, boerderij, creator, samenwerking, agenda, facturatie, markt,
  noteFailedTry, notify, notifyApplicant, notifySupplier, officeAuth, officeState, openVacatures, optieAan,
  entreeCode, keyVanCodenaam, gidsHaal, gidsZoekCodenaam, magBezorgen, parseRunsheetText, path, pendingVerifications, pickupCode, pinFails, posDay, publicPartner, publicSupplier, ticketsVoorSlot,
  publicTrip, pushLive, registerContact, rememberSession, resolveSession, ritBezetting, ritVerder, rtf,
  runItem, runKey, salonNaarVolgers, salonProfielCompleet, salonZichtbaar, salonItemsVan, save, scheduleFor, schoon, sectiesForOrder, sendPush,
  sendPushToUser, sessionFor, sessions, setRoomHk, sortRunsheet, speelOpnieuw, sseBuffer, sseClients,
  sseSend, sseToCustomer, sseToOffice, sseToSupplier, stateFor, stationsForOrder, supplierAuth, supplierState,
  toRad, tokenHash, tooManyTries, totpOk, trChat, trustVan, unlockDoor, urenVan, validDept, veiligGelijk, logInlog,
  zorgContact, klantSalon,
  webpush, weekdagFactor, werkgeverSollicitatie,
  // de ervaring-laag (kern/ervaring.js)
  MELDING_SCOPES, reserveerTafel, mijnReserveringen, annuleerReservering, beslisReservering,
  annuleerItem, plaatsReview, reviewsVoor, ratingVan, reviewReageer, toggleFavoriet, favorietenVan, isFavoriet,
  fooiUit, agendaVoor, maakSplits, mijnSplitsen, betaalSplits, zetOpWachtlijst, mijnWachtlijst,
  meldWachtlijst, rsvpAnnuleer, puntenVan, verdienPunten, verzilverPunten, pasTegoedToe,
  voorkeurVan, zetVoorkeur,
  // de retail-/mode-laag (kern/retail.js)
  RETAIL_MATEN, RETAIL_SEIZOENEN, retailIsRetail, zetCollectie, zetArtikel, pasVoorraad, releaseDrop,
  klantProfiel, zetKlantMaten, voegKlantnotitie, wishlistToggle, legApart, mijnApart,
  vraagPaskamer, paskamerBreng, stuurStyling, mijnStyling, retailVerkoop, voorraadZoek,
  retailStats, retailState, retailCatalogus,
  // de groothandel-/marktlaag (kern/groothandel.js)
  GROOTHANDEL_FUNCTIES, GROOTHANDEL_CATEGORIEEN, ghIsGroothandel, ghDefaults, ghFunctieAan,
  ghFunctieLijst, ghZetFunctie, ghZetProduct, ghZetVoorraad, ghMarkt, ghPlaatsBestelling,
  ghOrderVerder, ghAnnuleer, ghMijnBestellingen, ghInkomend, ghBijbestelVoorstel,
  agentKoppel, agentPubliek, agentVoorstel, agentBeslis, roosterVoorstel, roosterBeslis,
  // de mode-bezorging (kern/modebezorg.js)
  mbSetup, mbInstel, mbMagLeveren, mbAanvraag, mbWinkelOverzicht, mbRoute, mbNeem, mbGps, mbOverhandig, mbRetour, mbMijn,
  // de eigen mini-boardroom per zaak (kern/zaak.js)
  ZAAK_CAPS, zaakFunctieAan, zaakFunctieLijst, zaakZet, zaakHr, zaakMarketing, zaakBoard,
  // de autoverkoop-laag (kern/autoverkoop.js)
  AUTOVERKOOP_BRANDSTOF, avMagVerkopen, avZetAan, avZetAuto, avVerwijderAuto, avShowroom,
  avAanbevolen, avProefrit, avKoop, avInruil, avBeslis, avTeken, avMijnDeals, avDealerInbox,
  // de beveiligings-laag (kern/beveiliging.js)
  BEVEILIGING_FUNCTIES, BEVEILIGING_SHIFTS, BEVEILIGING_ERNST,
  bevIsBeveiliging, bevDefaults, bevFunctieAan, bevFunctieLijst, bevZetFunctie,
  bevPosten, bevZetPost, bevVerwijderPost, bevBudget, bevZetBudget,
  bevRooster, bevZetDienst, bevSchrapDienst, bevPlanAuto,
  bevAanvraag, bevAanvraagLijst, bevBeslisAanvraag,
  bevMijnDiensten, bevInklok, bevUitklok, bevRondeStart, bevRondeCheckpoint, bevRondeKlaar,
  bevMeldIncident, bevBeslisIncident, bevSos, bevCommand,
  // de directe-betaallaag (kern/directpay.js)
  DP_MIN_CENTEN, DP_MAX_CENTEN, dpBetaalDirect, dpMijnBetalingen,
  dpVerzoekMaak, dpVerzoekenVoor, dpBetaalVerzoek, dpVerzoekIntrek, dpOntvangsten,
  // de RTFoundation-afdracht (kern/fonds.js)
  fonds,
  // de munt-ontvangst (kern/munten.js + server/muntbetaal.js)
  munten, muntbetaal,
  // facturen/overzichten als download (kern/factuur.js)
  factuur,
  // branchekennis voor de AI-boekhouder (kern/boekhoudkennis.js)
  boekhoudkennis,
  // wereldtalen (server/talen.js): actieve talen + taalVan voor alle chatpaden
  talen,
  PASPOORT_NIVEAUS, leesUploadDataUrl, paspoortStatus, paspoortVraag, paspoortBeslis,
  paspoortTrekIn, paspoortBekijk, paspoortIncident, paspoortBeoordeel, paspoortMijn,
  paspoortPartner, paspoortIncidenten
};
Object.assign(kern, sociaal); // de sociale kern-helpers erbij
/* Salon-ontmoetingen (kern/ontmoeting.js): wederzijdse connecties die vlakbij
   elkaar zijn kiezen samen een activiteit, tekenen een veiligheidscontract en
   RTG-kantoor kijkt live mee tot de afspraak klaar is. Draait op de sociale
   kern (connecties) en geo, dus na Object.assign(kern, sociaal). */
Object.assign(kern, maakOntmoeting({
  db, save, crypto, accounts, leeftijdVan, notify, sseToCustomer, sseToOffice,
  connectieTussen: kern.connectieTussen, verbActief: kern.verbActief,
  zijnVrienden: kern.zijnVrienden, codenaamVan: kern.codenaamVan, haversine
}));
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
// De verplichte onboarding + het contract raken leden, gasten, de eigenaar en
// leveranciers; net als de infra-endpoints draait dit altijd mee.
require('./routes/onboarding')(kern);
require('./routes/agenda')(kern);
require('./routes/facturatie')(kern);
require('./routes/markt')(kern);
require('./routes/borden')(kern);
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
