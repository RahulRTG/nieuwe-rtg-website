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
const { db, load, save } = require('./db');
const i18n = require('./translate');
const accounts = require('./accounts');
const mail = require('./mail');

function appUrl(req) {
  return process.env.APP_URL || req.headers.origin || (req.protocol + '://' + req.get('host'));
}

load();
accounts.init();
// Demo-account zodat Rahul/Imran ook via de echte accountlogin werkt.
if (accounts.count() === 0) {
  const u = accounts.createUser({ username: 'Rahul', email: 'rahul@rtg.example', password: process.env.DEMO_PASS || 'Imran', tier: 'business', realName: 'Rahul Imran', phone: '+31612345678' });
  accounts.saveMemberState(u.id, memberTemplate());
  accounts.setVerification(u.id, 'verified'); // demo-account is al geverifieerd
}

// Demo-personeel per leverancier: een manager (PIN 1234) en een medewerker (PIN 5678).
const STAFF_SEED = {
  SAKURA: [['Naomi Sato', 'manager', 'Beheer'], ['Ren Watanabe', 'staff', 'Onderhoud']],
  KIKUNOI: [['Yuki Tanaka', 'manager', 'Keuken'], ['Kenji Mori', 'staff', 'Bediening']],
  PONTO: [['Aiko Sato', 'manager', 'Bar'], ['Ren Kimura', 'staff', 'Bediening']],
  HOSHI: [['Haruki Ito', 'manager', 'Receptie'], ['Mei Kobayashi', 'staff', 'Housekeeping']],
  MKKX: [['Daisuke Yamamoto', 'manager', 'Taxi centrale'], ['Hana Suzuki', 'staff', 'Chauffeur']],
  JETAG: [['Sophie Bakker', 'manager', 'Operations'], ['Lucas de Jong', 'staff', 'Crew']]
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

app.use(express.json({ limit: '8mb' }));
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
  rtg:       { name: 'S. Janssen',   full: 'Sophie Janssen',     since: 'Maart 2026',     number: 'RTG · 2026 · 8841', codename: 'Zilveren Valk' },
  lifestyle: { name: 'I. van Rhijn', full: 'Isabelle van Rhijn', since: 'Augustus 2025',  number: 'LSP · 2025 · 0217', codename: 'Gouden Ibis' },
  business:  { name: 'A. de Vries',  full: 'Alexander de Vries', since: 'November 2025',  number: 'BSP · 2025 · 1104', codename: 'Noordelijke Ster' }
};

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
  'Sophie Janssen': 'rtg',
  'Isabelle van Rhijn': 'lifestyle',
  'Alexander de Vries': 'business'
};

const sseClients = []; // { tier, res }

/* Alles wat elk partnerbedrijf standaard nodig heeft; wordt gebruikt voor
   bestaande bedrijven (migratie bij opstarten) en voor nieuwe partners die
   via de onboarding worden goedgekeurd. */
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
  const caps = ((db.data.supplierTypes || {})[s.type] || {}).caps || [];
  if (caps.includes('menu') && !Array.isArray(s.tables))
    s.tables = [1, 2, 3, 4, 5, 6].map(n => ({ id: 't' + n, name: 'Tafel ' + n, seats: n % 3 === 0 ? 6 : n % 2 === 0 ? 4 : 2, status: 'vrij' }));
  if (typeof s.rate !== 'number') s.rate = 0.12;
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
      code: 'SAKURA', name: 'Sakura Machiya Residence', type: 'apartment', city: 'Kyoto',
      loc: { lat: 35.003, lng: 135.775, label: 'Gion, Kyoto' }, rate: 0.12,
      menu: [], photos: [],
      rooms: [
        { id: 'a1', name: 'Machiya 1, straatzijde', desc: '65 m², eigen entree, tuinbad', price: 430, available: true },
        { id: 'a2', name: 'Machiya 2, tuinzijde', desc: '80 m², twee slaapkamers, terras', price: 560, available: true }
      ],
      doors: [
        { id: 'd1', name: 'Voordeur (straat)', locked: true },
        { id: 'd2', name: 'Machiya 1', locked: true },
        { id: 'd3', name: 'Machiya 2', locked: true },
        { id: 'd4', name: 'Fietsenberging', locked: true }
      ]
    });
  }
  if (!db.data.posSales) db.data.posSales = {};                   // kassaverkopen per bedrijf
  if (!db.data.guestChats) db.data.guestChats = {};               // gastchats: lid <-> partner (roomservice, eigenaar)
  if (!db.data.applications) db.data.applications = {};            // sollicitaties per bedrijf
  if (!db.data.cvs) db.data.cvs = {};                               // cv per lid (cv-builder in de leden-app)
  if (webpush) {
    if (!db.data.vapid) {
      db.data.vapid = webpush.generateVAPIDKeys();
      save();
    }
    webpush.setVapidDetails('mailto:leden@rahultravelgroup.example', db.data.vapid.publicKey, db.data.vapid.privateKey);
  }
}

function sseSend(res, event, data) {
  res.write('event: ' + event + '\n');
  res.write('data: ' + JSON.stringify(data) + '\n\n');
}

// stuur een sync-signaal naar één of meer tiers (open schermen herladen data)
function broadcastSync(tiers, scope) {
  const set = new Set(tiers);
  for (const c of sseClients) if (set.has(c.tier)) sseSend(c.res, 'sync', { scope });
}

// notificeer één tier: opslaan, naar open schermen sturen én web-push
function notify(tier, note) {
  const n = { id: crypto.randomBytes(4).toString('hex'), read: false, at: new Date().toISOString(), ...note };
  db.data.notifications[tier] = (db.data.notifications[tier] || []);
  db.data.notifications[tier].unshift(n);
  db.data.notifications[tier] = db.data.notifications[tier].slice(0, 40);
  save();
  for (const c of sseClients) if (c.tier === tier) sseSend(c.res, 'notify', n);
  sendPush(tier, n);
  return n;
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
  next();
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
  const posts = db.data.posts.map(p => ({
    id: p.id, author: p.author, tier: p.tier, place: p.place, visual: p.visual,
    photo: p.photo || null, partner: !!p.partner,
    text: p.text, lang: p.lang || 'nl', reward: p.reward, featured: !!p.featured,
    likes: p.baseLikes + Object.keys(p.likedBy).length,
    liked: !!p.likedBy[sess.key],
    comments: p.comments.map(c => ({ who: c.who, tier: c.tier, text: c.text, lang: c.lang || 'nl' })),
    canEngage: canEngage(sess, p)
  }));
  const state = { user: { tier: sess.tier, ...persona }, posts, creatorCredit: 0, creatorLikes: 0, lang };
  if (sess.tier !== 'guest') {
    // Echte accounts hebben hun eigen boekingen/betalingen; demo-sessies delen
    // de vaste demo-inhoud.
    const md = sess.account ? (accounts.getMemberState(sess.account.id) || memberTemplate()) : db.data;
    // Elke factuur krijgt een afboekcode (grootboeksuggestie) en de btw die in
    // de ledenbijdrage is begrepen. Business-leden zien de volledige specificatie.
    state.invoices = (md.invoices || []).map(inv => {
      const contrib = /lidmaatschap|jaarbijdrage/i.test(inv.desc);
      return {
        ...inv, desc: i18n.localize(inv.desc, lang), date: i18n.localize(inv.date, lang),
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
    state.myApplications = myApplications(sess.key);
  }
  return state;
}

// De sollicitaties van dit lid, over alle partners heen, nieuwste eerst.
function myApplications(key) {
  const out = [];
  for (const [code, list] of Object.entries(db.data.applications || {})) {
    const s = findSupplier(code);
    for (const a of list) if (a.key === key) out.push({ company: s ? s.name : code, func: a.func, status: a.status, at: a.at });
  }
  return out.sort((x, y) => new Date(y.at) - new Date(x.at)).slice(0, 10);
}

/* ---------- endpoints ---------- */

app.get('/api/health', (req, res) => res.json({ ok: true, ai: anthropic ? 'claude' : 'demo' }));

app.post('/api/login', (req, res) => {
  let tier = String(req.body.tier || '');
  if (hasCred(req.body)) {
    const bucket = 'demo:' + req.ip;
    if (tooManyTries(res, bucket)) return;
    if (!checkCred(req.body.username, req.body.password)) {
      noteFailedTry(bucket);
      return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord.' });
    }
    loginFails.delete(bucket);
    tier = 'business'; // het demo-account is een volledig lidmaatschap
  }
  if (!PERSONAS[tier]) return res.status(400).json({ error: 'Onbekende pas.' });
  const token = crypto.randomBytes(24).toString('hex');
  const sess = { tier, key: tier === 'guest' ? 'guest-' + token.slice(0, 8) : tier };
  rememberSession(token, sess);
  res.json({ token, state: stateFor(sess, req.body.lang) });
});

app.post('/api/logout', auth, (req, res) => {
  for (const [token, sess] of sessions) if (sess === req.session) forgetSession(token);
  res.json({ ok: true });
});

/* ---------- echte accounts (registreren / inloggen) ---------- */

app.post('/api/auth/register', (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 80);
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim().slice(0, 30);
  const password = String(req.body.password || '');
  if (!name) return res.status(400).json({ error: 'Vul uw naam in.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Vul een geldig e-mailadres in.' });
  if (phone.replace(/\D/g, '').length < 8) return res.status(400).json({ error: 'Vul een geldig mobiel nummer in (voor uw WhatsApp-lijn).' });
  if (password.length < 6) return res.status(400).json({ error: 'Wachtwoord moet minstens 6 tekens zijn.' });
  if (accounts.findByLogin(email)) return res.status(409).json({ error: 'Er bestaat al een account met dit e-mailadres.' });
  let user;
  try {
    user = accounts.createUser({ email, username: req.body.username || null, password, tier: req.body.tier, realName: name, phone });
  } catch (e) {
    return res.status(409).json({ error: 'Dit account bestaat al.' });
  }
  accounts.saveMemberState(user.id, memberTemplate());
  // bevestigingsmail met een echte, werkende link
  const vtok = accounts.issueActionToken(user.id, 'verify-email', 3 * 86400000);
  const verifyUrl = appUrl(req) + '/apps/portaal.html?verify=' + vtok;
  mail.send(email, 'Bevestig uw e-mailadres bij Rahul Travel Group',
    'Welkom bij RTG. Bevestig uw e-mailadres via deze link:\n' + verifyUrl);
  const token = accounts.issueToken(user.id);
  const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
  res.json({ token, state: stateFor(sess, req.body.lang), needsEmailVerify: true, ...(mail.configured ? {} : { devVerifyUrl: verifyUrl }) });
});

app.post('/api/auth/verify-email', (req, res) => {
  const u = accounts.verifyActionToken(req.body.token, 'verify-email');
  if (!u) return res.status(400).json({ error: 'Ongeldige of verlopen bevestigingslink.' });
  accounts.setEmailVerified(u.id);
  res.json({ ok: true });
});

app.post('/api/auth/resend', auth, (req, res) => {
  if (!req.session.account) return res.status(403).json({ error: 'Alleen voor accounts.' });
  const u = req.session.account;
  const vtok = accounts.issueActionToken(u.id, 'verify-email', 3 * 86400000);
  const url = appUrl(req) + '/apps/portaal.html?verify=' + vtok;
  mail.send(accounts.emailOf(u), 'Bevestig uw e-mailadres', 'Bevestig uw e-mailadres via deze link:\n' + url);
  res.json({ ok: true, ...(mail.configured ? {} : { devVerifyUrl: url }) });
});

app.post('/api/auth/forgot', (req, res) => {
  const email = String(req.body.email || '').trim();
  const u = email ? accounts.findByLogin(email) : null;
  let devResetUrl;
  if (u) {
    const tok = accounts.createReset(u.id);
    const url = appUrl(req) + '/apps/portaal.html?reset=' + tok;
    mail.send(accounts.emailOf(u) || email, 'Wachtwoord herstellen bij Rahul Travel Group',
      'U vroeg een nieuw wachtwoord aan. Stel het in via deze link (1 uur geldig):\n' + url);
    if (!mail.configured) devResetUrl = url;
  }
  // Altijd hetzelfde antwoord: niet verklappen of een e-mailadres bestaat.
  res.json({ ok: true, ...(devResetUrl ? { devResetUrl } : {}) });
});

app.post('/api/auth/reset', (req, res) => {
  const u = accounts.findByReset(req.body.token);
  if (!u) return res.status(400).json({ error: 'Ongeldige of verlopen herstel-link.' });
  const pw = String(req.body.password || '');
  if (pw.length < 6) return res.status(400).json({ error: 'Wachtwoord moet minstens 6 tekens zijn.' });
  accounts.setPassword(u.id, pw);
  res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  const login = req.body.login || req.body.email || req.body.username;
  const bucket = 'auth:' + req.ip + ':' + String(login || '').toLowerCase().slice(0, 60);
  if (tooManyTries(res, bucket)) return;
  const user = accounts.findByLogin(login);
  if (!user || !accounts.verifyPassword(req.body.password, user.password_hash)) {
    noteFailedTry(bucket);
    return res.status(401).json({ error: 'Onjuiste inloggegevens.' });
  }
  loginFails.delete(bucket);
  const token = accounts.issueToken(user.id);
  const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
  res.json({ token, state: stateFor(sess, req.body.lang) });
});

app.post('/api/auth/me', auth, (req, res) => {
  res.json({ user: req.session.account ? accounts.publicUser(req.session.account) : stateFor(req.session, req.body.lang).user });
});

/* ---------- identiteitsverificatie (tegen nepaccounts) ----------
   Een lid uploadt een foto van zijn identiteitsbewijs; RTG keurt die goed in de
   backoffice. Zo weet je zeker dat er een echt mens achter een account zit, en
   kan een geverifieerd lid daarna in één tik boeken.
   Let op (AVG): een ID-document is een bijzonder persoonsgegeven. Het bestand
   wordt buiten de repo bewaard (server/data/uploads, gitignored) en is alleen
   voor de backoffice zichtbaar. Voor productie: versleutel het bestand, bewaar
   het zo kort mogelijk, en gebruik bij voorkeur een gecertificeerde KYC-dienst. */
const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads');

app.post('/api/verify/upload', express.json({ limit: '6mb' }), auth, (req, res) => {
  if (!req.session.account) return res.status(403).json({ error: 'Verificatie is voor echte accounts.' });
  const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.image || ''));
  if (!m) return res.status(400).json({ error: 'Upload een foto (JPG, PNG of WebP) van uw identiteitsbewijs.' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Bestand te groot (max 5 MB).' });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const fname = req.session.account.id + '-' + Date.now() + '.' + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), buf);
  accounts.setVerification(req.session.account.id, 'pending', fname);
  res.json({ ok: true, status: 'pending' });
});

app.post('/api/verify/status', auth, (req, res) => {
  res.json({ status: req.session.account ? req.session.account.verified : 'n/a' });
});

app.post('/api/state', auth, (req, res) => res.json({ state: stateFor(req.session, req.body.lang) }));

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

// web-push: publieke sleutel + subscription opslaan
app.get('/api/push/key', (req, res) => {
  res.json({ key: webpush && db.data.vapid ? db.data.vapid.publicKey : null });
});
app.post('/api/push/subscribe', auth, (req, res) => {
  if (!webpush) return res.status(501).json({ error: 'Push niet beschikbaar.' });
  const sub = req.body.subscription;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Ongeldige subscription.' });
  const list = db.data.pushSubs[req.session.tier] = (db.data.pushSubs[req.session.tier] || []);
  if (!list.some(s => s.endpoint === sub.endpoint)) list.push(sub);
  save();
  res.json({ ok: true });
});

/* Eén tik betaalt: één factuur ({invoiceId}) of alles wat openstaat ({all:true}).
   De echte Face ID-/Apple Pay-verificatie gebeurt op het toestel; de server
   verwerkt de betaling in één aanroep. */
app.post('/api/pay', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  // Echte accounts betalen hun eigen facturen; demo-sessies de gedeelde demo.
  const own = !!req.session.account;
  const md = own ? (accounts.getMemberState(req.session.account.id) || memberTemplate()) : db.data;
  const invoices = md.invoices || [];
  let targets;
  if (req.body.all) {
    targets = invoices.filter(i => i.status === 'open');
    if (!targets.length) return res.status(409).json({ error: 'Er staat niets open.' });
  } else {
    const inv = invoices.find(i => i.id === req.body.invoiceId);
    if (!inv) return res.status(404).json({ error: 'Factuur niet gevonden.' });
    if (inv.status === 'paid') return res.status(409).json({ error: 'Deze factuur is al betaald.' });
    targets = [inv];
  }
  let foundation = 0;
  for (const inv of targets) {
    inv.status = 'paid';
    inv.date = 'Zojuist betaald';
    foundation += Math.round(inv.bijdrage * 0.3);
    for (const item of (md.trip ? md.trip.items : [])) {
      if (item.invoiceId === inv.id) { item.status = 'paid'; item.label = 'Bevestigd'; }
    }
  }
  if (own) accounts.saveMemberState(req.session.account.id, md);
  else save();
  // ander open scherm van hetzelfde lid meteen bijwerken
  broadcastSync([req.session.tier], 'payments');
  res.json({ ok: true, foundation, state: stateFor(req.session, req.body.lang) });
});

app.post('/api/like', auth, (req, res) => {
  const post = db.data.posts.find(p => p.id === Number(req.body.postId));
  if (!post) return res.status(404).json({ error: 'Post niet gevonden.' });
  // Liken mag iedereen, ook zonder pas.
  if (req.body.liked) post.likedBy[req.session.key] = true;
  else delete post.likedBy[req.session.key];
  save();
  const likes = post.baseLikes + Object.keys(post.likedBy).length;
  // alle open Salon-schermen de nieuwe like-telling laten zien
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  // de eigenaar van de post een notificatie geven (niet bij eigen like)
  const ownerTier = AUTHOR_TIER[post.author];
  if (req.body.liked && ownerTier && ownerTier !== req.session.tier) {
    notify(ownerTier, { icon: '♥', title: 'Nieuwe like', body: PERSONAS[req.session.tier].full + ' vindt uw post over ' + post.place + ' mooi.', scope: 'salon' });
  }
  res.json({ ok: true, likes });
});

app.post('/api/comment', auth, (req, res) => {
  const post = db.data.posts.find(p => p.id === Number(req.body.postId));
  if (!post) return res.status(404).json({ error: 'Post niet gevonden.' });
  if (!canEngage(req.session, post)) {
    return res.status(403).json({ error: engageError(req.session.tier) });
  }
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Lege reactie.' });
  // Echte leden verschijnen in De Salon onder hun codenaam, nooit hun echte naam.
  const who = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].full;
  const clang = req.body.lang === 'en' ? 'en' : 'nl';
  const comment = { who, tier: req.session.tier, text, lang: clang };
  post.comments.push(comment);
  registerContact(req.session, post);
  save();
  // alle Salon-schermen tonen de nieuwe reactie live
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  // de eigenaar van de post krijgt een notificatie (niet bij eigen reactie)
  const ownerTier = AUTHOR_TIER[post.author];
  if (ownerTier && ownerTier !== req.session.tier) {
    notify(ownerTier, { icon: '💬', title: 'Nieuwe reactie', body: who + ': “' + text.slice(0, 80) + '”', scope: 'salon' });
  }
  res.json({ ok: true, comment });
});

app.post('/api/dm', auth, (req, res) => {
  const post = db.data.posts.find(p => p.id === Number(req.body.postId));
  if (!post) return res.status(404).json({ error: 'Post niet gevonden.' });
  if (!canEngage(req.session, post)) {
    return res.status(403).json({ error: engageError(req.session.tier) });
  }
  const text = String(req.body.text || '').trim().slice(0, 1000);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  registerContact(req.session, post);
  const fromName = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].full;
  db.data.dms.push({
    from: fromName,
    fromTier: req.session.tier,
    to: post.author,
    text,
    lang: req.body.lang === 'en' ? 'en' : 'nl',
    at: new Date().toISOString()
  });
  save();
  // de ontvanger krijgt een notificatie/push van het privébericht
  const ownerTier = AUTHOR_TIER[post.author];
  if (ownerTier && ownerTier !== req.session.tier) {
    notify(ownerTier, { icon: '✉', title: 'Nieuw bericht in De Salon', body: fromName + ' stuurde u een bericht.', scope: 'salon' });
  }
  res.json({ ok: true });
});

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

app.post('/api/partner', (req, res) => {
  const partner = findPartner(req.body.code);
  if (!partner) return res.status(404).json({ error: 'Deze partnercode kennen we niet.' });
  res.json({ partner: publicPartner(partner) });
});

app.post('/api/staff', (req, res) => {
  let partner;
  if (hasCred(req.body)) {
    if (!checkCred(req.body.username, req.body.password))
      return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord.' });
    partner = db.data.partners.find(p => p.staff) || null;
  } else {
    partner = findStaffPartner(req.body.staffCode);
  }
  if (!partner) return res.status(404).json({ error: 'Deze personeelscode kennen we niet.' });
  // De personeelscode gaat mee terug zodat de inlog verder werkt zoals de code-invoer.
  res.json({ ok: true, partner: publicPartner(partner), staffCode: partner.staff ? partner.staff.code : null });
});

app.post('/api/partnertrips', (req, res) => {
  let staffRate = null;
  if (req.body.staffCode) {
    const p = findStaffPartner(req.body.staffCode);
    if (p) staffRate = p.staff.serviceRate;
  }
  res.json({ trips: db.data.partnerTrips.map(t => publicTrip(t, staffRate, req.body.lang)) });
});

app.post('/api/book', (req, res) => {
  const trip = db.data.partnerTrips.find(t => t.id === req.body.tripId);
  if (!trip) return res.status(404).json({ error: 'Reis niet gevonden.' });

  let partner = null;
  let rate = db.data.partnerService;
  let channel = 'klant';
  if (req.body.staffCode) {
    partner = findStaffPartner(req.body.staffCode);
    if (!partner) return res.status(404).json({ error: 'Deze personeelscode kennen we niet.' });
    rate = partner.staff.serviceRate;
    channel = 'personeel';
  } else if (req.body.code) {
    partner = findPartner(req.body.code);
    if (!partner) return res.status(404).json({ error: 'Deze partnercode kennen we niet.' });
  }

  const name = String(req.body.name || '').trim().slice(0, 120);
  const email = String(req.body.email || '').trim().slice(0, 200);
  if (!name || !email.includes('@')) return res.status(400).json({ error: 'Vul een naam en geldig e-mailadres in.' });

  // Interne administratie: verdeling wordt opgeslagen, nooit meegestuurd.
  const service = Math.round(trip.netto * rate);
  const total = trip.netto + service;
  const partnerCut = partner ? Math.round(service * partner.share) : 0;
  const ref = 'RTG-B-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  db.data.bookings.push({
    ref, tripId: trip.id, channel, name, email,
    partnerCode: partner ? partner.code : null,
    netto: trip.netto, service, total, partnerCut, rtgCut: service - partnerCut,
    at: new Date().toISOString()
  });
  save();
  res.json({ ok: true, ref, trip: { title: trip.title, dest: trip.dest }, partner: partner ? partner.name : null, total });
});

/* ================= LEVERANCIER-KANAAL =================
   Eén app voor alle leverancierstypes. Communiceert live (SSE) met de
   klanten-app, de website en de backoffice. Leveranciers gebruiken de app
   gratis; in ruil bieden ze RTG hun beste dynamische prijs. */

// SSE-routering naar een specifieke leverancier of naar de backoffice
function sseToSupplier(code, event, data) {
  for (const c of sseClients) if (c.sup === code) sseSend(c.res, event, data);
}
function sseToOffice(event, data) {
  for (const c of sseClients) if (c.office) sseSend(c.res, event, data);
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
           photos: s.photos || [],
           rooms: (s.rooms || []).filter(r => r.available).map(r => ({ id: r.id, name: r.name, desc: i18n.localize(r.desc, lang), price: r.price })) };
}

// dashboarddata voor de ingelogde leverancier
function supplierState(s, actor) {
  const t = db.data.supplierTypes[s.type] || {};
  return {
    supplier: { code: s.code, name: s.name, type: s.type, typeLabel: t.label, icon: t.icon, city: s.city, caps: t.caps || [], loc: s.loc, rate: s.rate },
    rooms: s.rooms || null,
    doors: s.doors || null,
    tables: s.tables || null,
    settings: s.settings || { ordersOpen: true, reservationsOpen: true },
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
      .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || '')),
    // leden die nu live onderweg zijn maar nog niet met dit bedrijf verbonden
    nearbyGuests: Object.values(db.data.live)
      .filter(L => L.active && !connectedSupplierCodes(L.key).includes(s.code))
      .map(L => { const d = L.destCode ? findSupplier(L.destCode) : null; return { codename: L.codename, dest: d ? d.name : null }; }),
    menu: s.menu || [],
    orders: db.data.orders.filter(o => o.supplierCode === s.code).map(o => {
      const L = db.data.live[o.customerKey || o.customerTier];
      const enroute = L && L.active && connectedSupplierCodes(o.customerKey || o.customerTier).includes(s.code);
      const me = enroute && Number.isFinite(L.lat) ? { lat: L.lat, lng: L.lng } : null;
      return { ...o, guestEtaMin: me && s.loc ? etaMinutes(haversine(me, s.loc), L.mode) : null, guestArrived: !!(L && L.arrived && L.destCode === s.code) };
    }),
    rides: db.data.rides.filter(r => r.supplierCode === s.code).map(r => {
      const L = db.data.live[r.customerKey || r.customerTier];
      const guest = L && L.active && Number.isFinite(L.lat) ? { lat: L.lat, lng: L.lng } : null;
      const toS = r.toCode ? findSupplier(r.toCode) : null;
      return { ...r, guestLoc: guest, pickupEtaMin: guest && s.loc ? etaMinutes(haversine(s.loc, guest), 'driving') : null, dropEtaMin: guest && toS && toS.loc ? etaMinutes(haversine(guest, toS.loc), 'driving') : null };
    }),
    guests: guestsFor(s.code),
    prices: db.data.supplierPrices.filter(p => p.supplierCode === s.code),
    notifications: db.data.supplierNotifications[s.code] || [],
    staff: accounts.listStaff(s.code).map(accounts.publicStaff),
    applications: (db.data.applications[s.code] || []).slice(0, 30),
    activity: (db.data.supplierActivity[s.code] || []).slice(0, 40),
    team: (db.data.supplierTeam[s.code] || []).slice(-60),
    actor: actor || { name: 'Beheer', role: 'manager', manager: true }
  };
}

// ---- leverancier: inloggen, live-stream, dashboard ----

// Bescherming tegen PIN-raden: na 5 foute pogingen een minuut wachten.
const pinFails = new Map(); // 'CODE:staffId' -> { n, until }
app.post('/api/supplier/login', (req, res) => {
  let s, actor;
  if (req.body.staffId != null) {
    // Persoonlijke personeelslogin met PIN, binnen het bedrijfsaccount.
    s = findSupplier(req.body.code);
    if (!s) return res.status(404).json({ error: 'Deze leverancierscode kennen we niet.' });
    const fk = s.code + ':' + req.body.staffId;
    const fail = pinFails.get(fk);
    if (fail && fail.until > Date.now())
      return res.status(429).json({ error: 'Te veel foute pogingen. Wacht een minuut en probeer het opnieuw.' });
    const staff = accounts.verifyStaffPin(Number(req.body.staffId), req.body.pin);
    if (!staff || String(staff.supplier_code).toUpperCase() !== s.code) {
      const n = ((fail && fail.n) || 0) + 1;
      pinFails.set(fk, n >= 5 ? { n: 0, until: Date.now() + 60000 } : { n, until: 0 });
      return res.status(401).json({ error: 'Onjuiste PIN.' });
    }
    pinFails.delete(fk);
    actor = { name: staff.name, role: staff.role, staffId: staff.id, manager: staff.role === 'manager' };
  } else if (hasCred(req.body)) {
    const bucket = 'sup:' + req.ip;
    if (tooManyTries(res, bucket)) return;
    if (!checkCred(req.body.username, req.body.password)) {
      noteFailedTry(bucket);
      return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord.' });
    }
    loginFails.delete(bucket);
    s = findSupplier(DEMO_SUPPLIER);
    actor = { name: 'Beheer', role: 'manager', manager: true };
  } else {
    s = findSupplier(req.body.code);
    actor = { name: 'Beheer', role: 'manager', manager: true };
  }
  if (!s) return res.status(404).json({ error: 'Deze leverancierscode kennen we niet.' });
  const token = crypto.randomBytes(24).toString('hex');
  rememberSession(token, { role: 'supplier', code: s.code, actor: actor.name, staffId: actor.staffId, staffRole: actor.role, manager: actor.manager });
  logActivity(s.code, actor, actor.name + ' logde in');
  res.json({ token, state: supplierState(s, actor) });
});

// Roster van het bedrijf (voor het personeel-inlogscherm; geen PINs).
app.post('/api/supplier/roster', (req, res) => {
  const s = findSupplier(req.body.code);
  if (!s) return res.status(404).json({ error: 'Deze leverancierscode kennen we niet.' });
  res.json({ supplier: { code: s.code, name: s.name }, staff: accounts.listStaff(s.code).map(accounts.publicStaff) });
});

// Manager voegt personeel toe (krijgt een PIN) of verwijdert het.
app.post('/api/supplier/staff/add', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan personeel toevoegen.' });
  const name = String(req.body.name || '').trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: 'Vul een naam in.' });
  const pin = accounts.makePin();
  const staff = accounts.createStaff({ supplierCode: req.supplier.code, name, role: req.body.role === 'manager' ? 'manager' : 'staff', func: String(req.body.func || '').slice(0, 40) || null, pin });
  logActivity(req.supplier.code, req.actor, req.actor.name + ' voegde ' + name + ' toe aan het team');
  res.json({ ok: true, staff: accounts.publicStaff(staff), pin });
});
app.post('/api/supplier/staff/remove', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan personeel verwijderen.' });
  const st = accounts.getStaffById(Number(req.body.staffId));
  if (st && String(st.supplier_code).toUpperCase() === req.supplier.code) {
    accounts.deactivateStaff(st.id);
    logActivity(req.supplier.code, req.actor, req.actor.name + ' verwijderde ' + st.name + ' uit het team');
  }
  res.json({ ok: true, staff: accounts.listStaff(req.supplier.code).map(accounts.publicStaff) });
});

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
app.post('/api/supplier/room/add', supplierAuth, (req, res) => {
  if (!Array.isArray(req.supplier.rooms)) return res.status(400).json({ error: 'Kamers zijn er alleen voor hotels en appartementen.' });
  const name = String(req.body.name || '').trim().slice(0, 60);
  const price = Math.max(0, Number(req.body.price) || 0);
  if (!name || !price) return res.status(400).json({ error: 'Vul een kamernaam en prijs in.' });
  const room = { id: crypto.randomBytes(3).toString('hex'), name, desc: String(req.body.desc || '').slice(0, 120), price, available: true, hk: { status: 'schoon' } };
  req.supplier.rooms.push(room);
  save();
  logActivity(req.supplier.code, req.actor, 'voegde kamer "' + name + '" toe');
  broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  res.json({ ok: true, rooms: req.supplier.rooms });
});
app.post('/api/supplier/room/toggle', supplierAuth, (req, res) => {
  const room = (req.supplier.rooms || []).find(r => r.id === req.body.id);
  if (!room) return res.status(404).json({ error: 'Kamer niet gevonden.' });
  room.available = !room.available;
  save();
  logActivity(req.supplier.code, req.actor, 'zette kamer "' + room.name + '" ' + (room.available ? 'aan' : 'uit'));
  broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  res.json({ ok: true, rooms: req.supplier.rooms });
});
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
app.post('/api/supplier/room/hk', supplierAuth, (req, res) => {
  const room = (req.supplier.rooms || []).find(r => r.id === req.body.id);
  if (!room) return res.status(404).json({ error: 'Kamer niet gevonden.' });
  const status = String(req.body.status || '');
  if (!HK_STATUSES.includes(status)) return res.status(400).json({ error: 'Onbekende status.' });
  setRoomHk(req.supplier, room, status, String(req.body.note || '').trim().slice(0, 140), req.actor);
  res.json({ ok: true, rooms: req.supplier.rooms });
});

// ---- klussen (onderhoud): melden, oppakken, afronden ----
app.post('/api/supplier/ticket/add', supplierAuth, (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 160);
  if (!text) return res.status(400).json({ error: 'Omschrijf de klus.' });
  const t = addTicket(req.supplier.code, req.actor, text, String(req.body.room || '').slice(0, 60) || null);
  save();
  logActivity(req.supplier.code, req.actor, 'meldde een klus: ' + text.slice(0, 60));
  sseToSupplier(req.supplier.code, 'sync', { scope: 'rooms' });
  res.json({ ok: true, ticket: t });
});
app.post('/api/supplier/ticket/status', supplierAuth, (req, res) => {
  const t = (db.data.tickets[req.supplier.code] || []).find(x => x.id === req.body.id);
  if (!t) return res.status(404).json({ error: 'Klus niet gevonden.' });
  const status = ['open', 'bezig', 'klaar'].includes(req.body.status) ? req.body.status : 'open';
  t.status = status;
  if (status === 'bezig') { t.by = req.actor.name; }
  if (status === 'klaar') { t.doneBy = req.actor.name; t.doneAt = new Date().toISOString(); }
  save();
  logActivity(req.supplier.code, req.actor, (status === 'klaar' ? 'rondde een klus af: ' : status === 'bezig' ? 'pakte een klus op: ' : 'heropende een klus: ') + t.text.slice(0, 60));
  sseToSupplier(req.supplier.code, 'sync', { scope: 'rooms' });
  res.json({ ok: true, ticket: t });
});

// ---- gevonden voorwerpen ----
app.post('/api/supplier/lost/add', supplierAuth, (req, res) => {
  const item = String(req.body.item || '').trim().slice(0, 100);
  if (!item) return res.status(400).json({ error: 'Omschrijf het voorwerp.' });
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    item, room: String(req.body.room || '').slice(0, 60) || null,
    storage: String(req.body.storage || '').trim().slice(0, 80) || null,
    status: 'bewaard', by: req.actor.name, at: new Date().toISOString()
  };
  const list = db.data.lostfound[req.supplier.code] = (db.data.lostfound[req.supplier.code] || []);
  list.unshift(entry);
  db.data.lostfound[req.supplier.code] = list.slice(0, 120);
  save();
  logActivity(req.supplier.code, req.actor, 'registreerde een gevonden voorwerp: ' + item + (entry.room ? ' (' + entry.room + ')' : ''));
  sseToSupplier(req.supplier.code, 'sync', { scope: 'rooms' });
  res.json({ ok: true, entry });
});
app.post('/api/supplier/lost/done', supplierAuth, (req, res) => {
  const e = (db.data.lostfound[req.supplier.code] || []).find(x => x.id === req.body.id);
  if (e) {
    e.status = 'opgehaald'; e.doneBy = req.actor.name; e.doneAt = new Date().toISOString();
    save();
    logActivity(req.supplier.code, req.actor, 'gaf een gevonden voorwerp mee: ' + e.item);
    sseToSupplier(req.supplier.code, 'sync', { scope: 'rooms' });
  }
  res.json({ ok: true });
});

app.post('/api/supplier/room/remove', supplierAuth, (req, res) => {
  const i = (req.supplier.rooms || []).findIndex(r => r.id === req.body.id);
  if (i >= 0) {
    logActivity(req.supplier.code, req.actor, 'verwijderde kamer "' + req.supplier.rooms[i].name + '"');
    req.supplier.rooms.splice(i, 1);
    save();
    broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  }
  res.json({ ok: true, rooms: req.supplier.rooms || [] });
});

// ---- fotopagina: foto's die gasten zien bij de partner ----
app.post('/api/supplier/photo/add', express.json({ limit: '6mb' }), supplierAuth, (req, res) => {
  const img = String(req.body.image || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(img)) return res.status(400).json({ error: 'Alleen JPG, PNG of WebP.' });
  if (img.length > 1.5 * 1024 * 1024) return res.status(413).json({ error: 'Foto te groot (max ~1 MB).' });
  req.supplier.photos = req.supplier.photos || [];
  if (req.supplier.photos.length >= 6) return res.status(409).json({ error: 'Maximaal 6 foto\'s. Verwijder er eerst een.' });
  req.supplier.photos.push(img);
  save();
  logActivity(req.supplier.code, req.actor, 'plaatste een foto op de pagina');
  broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  res.json({ ok: true, count: req.supplier.photos.length });
});
app.post('/api/supplier/photo/remove', supplierAuth, (req, res) => {
  const i = parseInt(req.body.index, 10);
  if (req.supplier.photos && i >= 0 && i < req.supplier.photos.length) {
    req.supplier.photos.splice(i, 1);
    save();
    logActivity(req.supplier.code, req.actor, 'verwijderde een foto van de pagina');
    broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  }
  res.json({ ok: true, count: (req.supplier.photos || []).length });
});

// ---- rechtstreeks publiceren op De Salon (als RTG-partner) ----
app.post('/api/supplier/salon/post', express.json({ limit: '6mb' }), supplierAuth, (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 600);
  if (!text) return res.status(400).json({ error: 'Schrijf eerst een tekst.' });
  let photo = null;
  const pi = parseInt(req.body.photoIndex, 10);
  if (Number.isInteger(pi) && req.supplier.photos && req.supplier.photos[pi]) photo = req.supplier.photos[pi];
  else if (typeof req.body.image === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(req.body.image) && req.body.image.length <= 1.5 * 1024 * 1024) photo = req.body.image;
  const post = {
    id: Date.now(),
    author: req.supplier.name, tier: 'partner', partner: true,
    place: req.supplier.city, visual: null, photo,
    text, lang: req.body.lang === 'en' ? 'en' : 'nl',
    baseLikes: 0, likedBy: {}, comments: []
  };
  db.data.posts.unshift(post);
  db.data.posts = db.data.posts.slice(0, 60);
  save();
  logActivity(req.supplier.code, req.actor, 'publiceerde op De Salon');
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  sseToOffice('sync', { scope: 'salon' });
  res.json({ ok: true, postId: post.id });
});

// ---- kassa: verkopen registreren, per sector (bon, kamer, rit) ----
const POS_METHODS = ['pin', 'contant', 'kamer'];
app.post('/api/supplier/pos/sale', supplierAuth, (req, res) => {
  const total = Number(req.body.total);
  if (!(total > 0) || total > 100000) return res.status(400).json({ error: 'Geen geldig bedrag.' });
  const method = POS_METHODS.includes(req.body.method) ? req.body.method : 'pin';
  const items = Array.isArray(req.body.items)
    ? req.body.items.slice(0, 40).map(i => ({ name: String(i.name || '').slice(0, 80), qty: Math.max(1, parseInt(i.qty, 10) || 1), price: Math.max(0, Number(i.price) || 0) }))
    : null;
  const sale = {
    id: crypto.randomBytes(4).toString('hex'),
    bon: pickupCode(),
    actor: req.actor.name,
    desc: String(req.body.desc || '').slice(0, 140),
    room: req.body.room ? String(req.body.room).slice(0, 60) : null,
    items, total, method,
    at: new Date().toISOString()
  };
  const list = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
  list.unshift(sale);
  db.data.posSales[req.supplier.code] = list.slice(0, 300);
  save();
  logActivity(req.supplier.code, req.actor, 'rekende € ' + total + ' af (' + method + (sale.room ? ', ' + sale.room : '') + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  res.json({ ok: true, sale });
});

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
app.post('/api/supplier/pos/redeem', supplierAuth, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Voer een ophaalcode in.' });
  const o = db.data.orders.find(x => x.supplierCode === req.supplier.code && x.pickup === code);
  if (!o) return res.status(404).json({ error: 'Onbekende code voor dit bedrijf.' });
  if (o.refunded || o.status === 'geweigerd') return res.status(409).json({ error: 'Deze bestelling is geannuleerd.' });
  if (o.status === 'geserveerd') return res.status(409).json({ error: 'Code ' + code + ' is al uitgegeven.' });
  const wasPaid = o.paid;
  let sale = null;
  if (!o.paid) {
    // afrekenen via RTG-lidmaatschap; komt als omzet in het dagoverzicht
    o.paid = true;
    sale = {
      id: crypto.randomBytes(4).toString('hex'),
      bon: pickupCode(),
      actor: req.actor.name,
      desc: 'RTG-code ' + code + ' (' + o.ref + ')',
      room: null,
      items: o.items, total: o.total, method: 'rtg',
      at: new Date().toISOString()
    };
    const list = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
    list.unshift(sale);
    db.data.posSales[req.supplier.code] = list.slice(0, 300);
  }
  o.status = 'geserveerd';
  save();
  logActivity(req.supplier.code, req.actor, 'gaf bestelling ' + o.ref + ' uit op code ' + code + (wasPaid ? '' : ' en rekende € ' + o.total + ' af (RTG)'));
  broadcastSync([o.customerTier], 'orders');
  sseToCustomer(o.customerKey || o.customerTier, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  notify(o.customerTier, { icon: '✨', title: req.supplier.name, body: 'Uw bestelling is uitgegeven. Veel plezier.', scope: 'orders' });
  res.json({ ok: true, order: { ref: o.ref, codename: o.customerCodename, items: o.items, total: o.total, wasPaid }, sale });
});

// ---- uitchecken: alle open kamerlasten van een kamer in één keer afrekenen ----
app.post('/api/supplier/pos/checkout', supplierAuth, (req, res) => {
  const room = String(req.body.room || '').slice(0, 60);
  const method = ['pin', 'contant'].includes(req.body.method) ? req.body.method : 'pin';
  const list = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
  const open = list.filter(s => s.method === 'kamer' && !s.settled && s.room === room);
  if (!open.length) return res.status(404).json({ error: 'Geen open kamerlasten voor deze kamer.' });
  let total = 0;
  for (const s of open) { s.settled = true; total += s.total; }
  const sale = {
    id: crypto.randomBytes(4).toString('hex'),
    bon: pickupCode(),
    actor: req.actor.name,
    desc: 'Check-out ' + room + ' (' + open.length + ' post(en))',
    room, items: null, total, method,
    at: new Date().toISOString()
  };
  list.unshift(sale);
  db.data.posSales[req.supplier.code] = list.slice(0, 300);
  // na het uitchecken staat de kamer automatisch op "vuil" voor housekeeping
  const rm = (req.supplier.rooms || []).find(r => r.name === room);
  if (rm) rm.hk = { status: 'vuil', by: 'Systeem (check-out)', at: new Date().toISOString() };
  save();
  logActivity(req.supplier.code, req.actor, 'checkte ' + room + ' uit: € ' + total + ' (' + method + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  res.json({ ok: true, sale });
});

/* ---- minibar-telling: personeel telt per kamer, kosten gaan automatisch
   op de kamerrekening en de aanvulling staat meteen op papier ---- */
app.post('/api/supplier/minibar/count', supplierAuth, (req, res) => {
  if (!Array.isArray(req.supplier.minibar)) return res.status(400).json({ error: 'Minibar is er alleen voor hotels en appartementen.' });
  const room = String(req.body.room || '').slice(0, 60);
  if (!room) return res.status(400).json({ error: 'Kies een kamer.' });
  const wanted = Array.isArray(req.body.items) ? req.body.items : [];
  const items = [];
  let total = 0;
  for (const w of wanted) {
    const m = req.supplier.minibar.find(x => x.id === w.id);
    const qty = Math.min(20, Math.max(0, parseInt(w.qty, 10) || 0));
    if (m && qty > 0) { items.push({ name: m.name, qty, price: m.price }); total += m.price * qty; }
  }
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    room, actor: req.actor.name, items, total,
    at: new Date().toISOString()
  };
  const list = db.data.minibarCounts[req.supplier.code] = (db.data.minibarCounts[req.supplier.code] || []);
  list.unshift(entry);
  db.data.minibarCounts[req.supplier.code] = list.slice(0, 300);
  // verbruik automatisch als kamerlast op de rekening (komt mee bij check-out)
  if (total > 0) {
    const sale = {
      id: crypto.randomBytes(4).toString('hex'),
      bon: pickupCode(),
      actor: req.actor.name,
      desc: 'Minibar: ' + items.map(i => i.qty + 'x ' + i.name).join(', '),
      room, items, total, method: 'kamer',
      at: new Date().toISOString()
    };
    const sales = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
    sales.unshift(sale);
    db.data.posSales[req.supplier.code] = sales.slice(0, 300);
  }
  save();
  logActivity(req.supplier.code, req.actor, 'telde de minibar van ' + room + (total > 0 ? ': € ' + total + ' verbruik, aanvullen: ' + items.map(i => i.qty + 'x ' + i.name).join(', ') : ': niets gebruikt'));
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  res.json({ ok: true, entry, charged: total });
});

// catalogusbeheer: artikelen toevoegen of verwijderen
app.post('/api/supplier/minibar/item/add', supplierAuth, (req, res) => {
  if (!Array.isArray(req.supplier.minibar)) return res.status(400).json({ error: 'Minibar is er alleen voor hotels en appartementen.' });
  const name = String(req.body.name || '').trim().slice(0, 60);
  const price = Math.max(0, Number(req.body.price) || 0);
  if (!name || !price) return res.status(400).json({ error: 'Vul een artikel en prijs in.' });
  req.supplier.minibar.push({ id: crypto.randomBytes(3).toString('hex'), name, price });
  save();
  logActivity(req.supplier.code, req.actor, 'zette "' + name + '" in de minibar-catalogus');
  res.json({ ok: true, minibar: req.supplier.minibar });
});
app.post('/api/supplier/minibar/item/remove', supplierAuth, (req, res) => {
  const i = (req.supplier.minibar || []).findIndex(x => x.id === req.body.id);
  if (i >= 0) { req.supplier.minibar.splice(i, 1); save(); }
  res.json({ ok: true, minibar: req.supplier.minibar || [] });
});

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

app.post('/api/supplier/door/toggle', supplierAuth, (req, res) => {
  const door = (req.supplier.doors || []).find(d => d.id === req.body.id);
  if (!door) return res.status(404).json({ error: 'Deur niet gevonden.' });
  if (door.locked) {
    unlockDoor(req.supplier, door, req.actor.name);
    logActivity(req.supplier.code, req.actor, 'opende "' + door.name + '" op afstand');
  } else {
    door.locked = true;
    door.lastBy = req.actor.name;
    door.lastAt = new Date().toISOString();
    save();
    logActivity(req.supplier.code, req.actor, 'vergrendelde "' + door.name + '"');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'doors' });
  }
  res.json({ ok: true, doors: req.supplier.doors });
});

// De gearriveerde gast opent de voordeur vanuit de leden-app (digitale sleutel).
app.post('/api/live/door', auth, (req, res) => {
  const L = db.data.live[req.session.key];
  if (!L || !L.active) return res.status(409).json({ error: 'U bent niet onderweg.' });
  const dest = L.destCode ? findSupplier(L.destCode) : null;
  if (!dest || !(dest.doors || []).length) return res.status(404).json({ error: 'Deze bestemming heeft geen digitale deuren.' });
  if (!L.arrived) return res.status(409).json({ error: 'De deur opent pas als u bent aangekomen.' });
  const door = dest.doors[0];
  unlockDoor(dest, door, L.codename);
  logActivity(dest.code, { name: L.codename }, 'gast opende "' + door.name + '" via de app');
  notifySupplier(dest.code, { icon: '🔓', title: 'Deur geopend', body: L.codename + ' heeft "' + door.name + '" geopend via de app.' });
  res.json({ ok: true, door: { name: door.name, relockSec: DOOR_RELOCK_MS / 1000 } });
});

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
app.post('/api/partner/chat/send', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.supplierCode);
  if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  const dept = validDept(s, String(req.body.dept || ''));
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  const chat = getChat(s, req.session.key, codename, req.session.tier, dept);
  chat.codename = codename;
  chat.messages.push({ from: 'guest', who: codename, text, lang: req.body.lang === 'en' ? 'en' : 'nl', at: new Date().toISOString() });
  chat.messages = chat.messages.slice(-120);
  chat.unreadPartner += 1;
  chat.lastAt = new Date().toISOString();
  save();
  notifySupplier(s.code, { icon: '💬', title: codename + ' → ' + dept, body: text.slice(0, 90) });
  sseToSupplier(s.code, 'sync', { scope: 'gchat' });
  sseToCustomer(req.session.key, 'sync', { scope: 'gchat' });
  trChat(chat.messages, req.body.lang === 'en' ? 'en' : 'nl').then(messages => res.json({ ok: true, messages }));
});

// gast opent het gesprek met een afdeling (en markeert het als gelezen)
app.post('/api/partner/chat/history', auth, (req, res) => {
  const s = findSupplier(req.body.supplierCode);
  if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
  const dept = validDept(s, String(req.body.dept || ''));
  const chat = db.data.guestChats[chatKeyOf(s.code, req.session.key, dept)];
  if (chat && chat.unreadGuest) { chat.unreadGuest = 0; save(); }
  const to = req.body.lang === 'en' ? 'en' : 'nl';
  trChat(chat ? chat.messages : [], to).then(messages => res.json({ messages, dept }));
});

// personeel antwoordt (onder eigen naam, uit het persoonlijke account)
app.post('/api/supplier/chat/send', supplierAuth, (req, res) => {
  const chat = db.data.guestChats[String(req.body.key || '')];
  if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Gesprek niet gevonden.' });
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  chat.messages.push({ from: 'partner', who: req.actor.name, text, lang: req.body.lang === 'en' ? 'en' : 'nl', at: new Date().toISOString() });
  chat.messages = chat.messages.slice(-120);
  chat.unreadGuest += 1;
  chat.lastAt = new Date().toISOString();
  save();
  logActivity(req.supplier.code, req.actor, 'antwoordde ' + chat.codename + ' (' + (chat.dept || 'Team') + ')');
  notify(chat.tier, { icon: '💬', title: req.supplier.name + (chat.dept ? ' · ' + chat.dept : ''), body: text.slice(0, 90), scope: 'gchat' });
  sseToCustomer(chat.customerKey, 'sync', { scope: 'gchat' });
  sseToSupplier(req.supplier.code, 'sync', { scope: 'gchat' });
  trChat(chat.messages, req.body.lang === 'en' ? 'en' : 'nl').then(messages => res.json({ ok: true, messages }));
});

// personeel opent een gesprek (en markeert het als gelezen)
app.post('/api/supplier/chat/history', supplierAuth, (req, res) => {
  const chat = db.data.guestChats[String(req.body.key || '')];
  if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Gesprek niet gevonden.' });
  if (chat.unreadPartner) { chat.unreadPartner = 0; save(); }
  trChat(chat.messages, req.body.lang === 'en' ? 'en' : 'nl').then(messages => res.json({ messages, codename: chat.codename }));
});

/* ---- verbinding maken met een gast (hotel/appartement) ----
   Het hotel ziet welke leden nu live onderweg zijn en kan verbinden: de gast
   krijgt een melding, het hotel verschijnt in het onderweg-scherm van de
   gast, en het hotel volgt de aankomst live (positie en ETA). */
app.post('/api/supplier/guest/connect', supplierAuth, (req, res) => {
  const codename = String(req.body.codename || '').trim();
  const key = Object.keys(db.data.live).find(k => db.data.live[k].active && db.data.live[k].codename === codename);
  if (!key) return res.status(404).json({ error: 'Deze gast is nu niet live onderweg.' });
  const L = db.data.live[key];
  L.connected = [...new Set([...(L.connected || []), req.supplier.code])];
  save();
  logActivity(req.supplier.code, req.actor, 'verbond met gast ' + codename);
  notify(L.tier, { icon: '🤝', title: req.supplier.name, body: 'Volgt uw aankomst om alles voor u klaar te zetten.', scope: 'live' });
  pushLive(key);
  res.json({ ok: true, guests: guestsFor(req.supplier.code) });
});

/* ---- solliciteren: bij elk bedrijf op dezelfde manier ----
   Openbaar formulier per bedrijf; de manager ziet de sollicitatie in de app
   en neemt aan (dan ontstaat direct een personeelsaccount met pincode) of
   wijst af. Zo wordt personeel zoeken voor elk bedrijf gelijk en simpel. */
app.post('/api/supplier/apply', (req, res) => {
  const s = findSupplier(req.body.code);
  if (!s) return res.status(404).json({ error: 'Bedrijf niet gevonden.' });
  const name = String(req.body.name || '').trim().slice(0, 60);
  const func = String(req.body.func || '').trim().slice(0, 40);
  const contact = String(req.body.contact || '').trim().slice(0, 80);
  const note = String(req.body.note || '').trim().slice(0, 400);
  if (!name || !func || !contact) return res.status(400).json({ error: 'Vul uw naam, de functie en een telefoonnummer of e-mailadres in.' });
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    name, func, contact, note, status: 'nieuw',
    at: new Date().toISOString()
  };
  const list = db.data.applications[s.code] = (db.data.applications[s.code] || []);
  list.unshift(entry);
  db.data.applications[s.code] = list.slice(0, 100);
  save();
  notifySupplier(s.code, { icon: '📝', title: 'Nieuwe sollicitatie', body: name + ' solliciteert als ' + func + '.' });
  sseToSupplier(s.code, 'sync', { scope: 'team' });
  sseToOffice('sync', { scope: 'team' });
  res.json({ ok: true });
});
app.post('/api/supplier/apply/decide', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const a = (db.data.applications[req.supplier.code] || []).find(x => x.id === req.body.id);
  if (!a) return res.status(404).json({ error: 'Sollicitatie niet gevonden.' });
  if (req.body.action === 'aannemen') {
    const pin = accounts.makePin();
    const staff = accounts.createStaff({ supplierCode: req.supplier.code, name: a.name, role: 'staff', func: a.func, pin });
    a.status = 'aangenomen';
    save();
    logActivity(req.supplier.code, req.actor, 'nam ' + a.name + ' aan als ' + a.func);
    sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
    sseToOffice('sync', { scope: 'team' });
    notifyApplicant(a, req.supplier);
    return res.json({ ok: true, staff: accounts.publicStaff(staff), pin });
  }
  a.status = 'afgewezen';
  save();
  logActivity(req.supplier.code, req.actor, 'wees de sollicitatie van ' + a.name + ' af');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
  notifyApplicant(a, req.supplier);
  res.json({ ok: true });
});

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
app.post('/api/privacy/export', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const key = req.session.key;
  const chats = {};
  for (const [k, msgs] of Object.entries(db.data.guestChats || {})) {
    if (k.split('|')[1] === key) chats[k] = msgs;
  }
  const likes = db.data.posts.filter(p => p.likedBy && p.likedBy[key]).map(p => ({ postId: p.id, author: p.author }));
  const state = stateFor(req.session, req.body.lang);
  res.json({
    exportedAt: new Date().toISOString(),
    note: 'Alle gegevens die RTG over u bewaart, onder uw codenaam (pseudonimisering).',
    profile: state.user,
    cv: db.data.cvs[key] || null,
    applications: myApplications(key),
    invoices: state.invoices || [],
    trip: state.trip || null,
    live: db.data.live[key] || null,
    orders: db.data.orders.filter(o => (o.customerKey || o.customerTier) === key),
    guestChats: chats,
    likedPosts: likes,
    notifications: db.data.notifications[key] || []
  });
});

app.post('/api/privacy/delete', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const key = req.session.key;
  // cv en live-locatie weg, chats weg, likes weg
  delete db.data.cvs[key];
  delete db.data.live[key];
  for (const k of Object.keys(db.data.guestChats || {})) if (k.split('|')[1] === key) delete db.data.guestChats[k];
  for (const p of db.data.posts) if (p.likedBy) delete p.likedBy[key];
  // sollicitaties anonimiseren: het bedrijf houdt zijn administratie,
  // maar zonder iets dat naar deze persoon herleidbaar is
  for (const list of Object.values(db.data.applications || {})) {
    for (const a of list) if (a.key === key) {
      a.name = '(op verzoek verwijderd)'; a.contact = ''; a.note = '';
      a.cv = null; a.codename = null; a.key = null;
    }
  }
  // meldingen weg (bij demo-profielen is dit de gedeelde demo-bel)
  if (db.data.notifications[key]) db.data.notifications[key] = [];
  // echt account: verwijder het account zelf, inclusief documentupload
  if (req.session.account) {
    const doc = accounts.deleteUser(req.session.account.id);
    if (doc) { try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(doc))); } catch (e) {} }
  }
  // alle sessies van dit lid uitloggen
  for (const [h, sess] of sessions) if (sess.key === key) forgetSession(h);
  save();
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true });
});

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

app.post('/api/partner/apply', (req, res) => {
  const b = req.body || {};
  const company = String(b.company || '').trim().slice(0, 80);
  const type = String(b.type || '').trim();
  const city = String(b.city || '').trim().slice(0, 60);
  const contactName = String(b.contactName || '').trim().slice(0, 60);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 80);
  const phone = String(b.phone || '').trim().slice(0, 30);
  const note = String(b.note || '').trim().slice(0, 500);
  if (!db.data.supplierTypes[type]) return res.status(400).json({ error: 'Kies een geldig type bedrijf.' });
  if (!company || !city || !contactName) return res.status(400).json({ error: 'Vul de bedrijfsnaam, plaats en contactpersoon in.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Vul een geldig e-mailadres in.' });
  if (db.data.partnerApplications.some(a => a.status === 'nieuw' && a.email === email && a.company.toLowerCase() === company.toLowerCase()))
    return res.status(409).json({ error: 'Deze aanvraag staat al open. We nemen contact met u op.' });
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    company, type, city, contactName, email, phone, note,
    status: 'nieuw', at: new Date().toISOString()
  };
  db.data.partnerApplications.unshift(entry);
  db.data.partnerApplications = db.data.partnerApplications.slice(0, 200);
  save();
  mail.send(email, 'Uw partner-aanvraag bij Rahul Travel Group',
    'Beste ' + contactName + ',\n\nWe hebben uw aanvraag voor ' + company + ' (' + city + ') ontvangen. ' +
    'We beoordelen elke partner persoonlijk en komen binnen twee werkdagen bij u terug.\n\nRahul Travel Group');
  sseToOffice('sync', { scope: 'team' });
  res.json({ ok: true });
});

app.post('/api/office/partner/decide', officeAuth, (req, res) => {
  const a = db.data.partnerApplications.find(x => x.id === req.body.id);
  if (!a) return res.status(404).json({ error: 'Aanvraag niet gevonden.' });
  if (a.status !== 'nieuw') return res.status(409).json({ error: 'Deze aanvraag is al behandeld.' });
  if (req.body.action === 'goedkeuren') {
    const code = makeSupplierCode(a.company);
    const s = { code, name: a.company, type: a.type, city: a.city, loc: null, rate: 0.12, menu: [] };
    ensureSupplierDefaults(s);
    db.data.suppliers.push(s);
    const pin = accounts.makePin();
    accounts.createStaff({ supplierCode: code, name: a.contactName, role: 'manager', func: 'Beheer', pin });
    a.status = 'goedgekeurd'; a.code = code;
    save();
    const url = appUrl(req);
    mail.send(a.email, 'Welkom als partner van Rahul Travel Group',
      'Beste ' + a.contactName + ',\n\n' + a.company + ' is goedgekeurd als RTG-partner.\n\n' +
      'Uw leverancierscode: ' + code + '\nUw manager-PIN: ' + pin + ' (op naam van ' + a.contactName + ')\n\n' +
      'Open de partner-app op ' + url + '/apps/partners.html, kies uw bedrijf via de code, ' +
      'log in als management met uw PIN en stel uw pagina, menukaart en team in.\n\nRahul Travel Group');
    sseToOffice('sync', { scope: 'team' });
    return res.json({ ok: true, code, pin });
  }
  a.status = 'afgewezen';
  save();
  mail.send(a.email, 'Uw partner-aanvraag bij Rahul Travel Group',
    'Beste ' + a.contactName + ',\n\nNa beoordeling kunnen we ' + a.company + ' op dit moment helaas geen partnerplek aanbieden.\n\nRahul Travel Group');
  sseToOffice('sync', { scope: 'team' });
  res.json({ ok: true });
});

/* ---- cv-builder (leden-app): het cv is de sleutel tot solliciteren ---- */
function cvReady(cv) {
  return !!(cv && cv.name && cv.contact && ((cv.experience || []).length || (cv.skills || []).length));
}
app.post('/api/cv/get', auth, (req, res) => {
  const cv = db.data.cvs[req.session.key] || null;
  res.json({ cv, ready: cvReady(cv) });
});
app.post('/api/cv/save', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const b = req.body || {};
  const cv = {
    name: String(b.name || '').trim().slice(0, 60),
    contact: String(b.contact || '').trim().slice(0, 80),
    headline: String(b.headline || '').trim().slice(0, 80),
    experience: String(b.experience || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 12),
    skills: String(b.skills || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 15),
    languages: String(b.languages || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 8),
    about: String(b.about || '').trim().slice(0, 400),
    updatedAt: new Date().toISOString()
  };
  if (!cv.name || !cv.contact) return res.status(400).json({ error: 'Vul minimaal uw naam en contactgegevens in.' });
  db.data.cvs[req.session.key] = cv;
  save();
  res.json({ ok: true, cv, ready: cvReady(cv) });
});

// RTG-lid solliciteert bij een partner; kan pas met een afgerond cv
app.post('/api/member/apply', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.supplierCode);
  if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
  const cv = db.data.cvs[req.session.key];
  if (!cvReady(cv)) return res.status(409).json({ error: 'Maak eerst uw cv af in de cv-builder; daarmee solliciteert u bij elke RTG-partner in een tik.', needCv: true });
  const func = String(req.body.func || '').trim().slice(0, 40);
  if (!func) return res.status(400).json({ error: 'Kies een functie.' });
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    name: cv.name, func, contact: cv.contact,
    note: String(req.body.note || '').trim().slice(0, 400),
    viaRTG: true, codename, key: req.session.key,
    cv: { headline: cv.headline, experience: cv.experience, skills: cv.skills, languages: cv.languages, about: cv.about },
    status: 'nieuw', at: new Date().toISOString()
  };
  const list = db.data.applications[s.code] = (db.data.applications[s.code] || []);
  list.unshift(entry);
  db.data.applications[s.code] = list.slice(0, 100);
  save();
  notifySupplier(s.code, { icon: '📝', title: 'Sollicitatie via RTG', body: cv.name + ' (RTG-lid) solliciteert als ' + func + ', met cv.' });
  sseToSupplier(s.code, 'sync', { scope: 'team' });
  sseToOffice('sync', { scope: 'team' });
  res.json({ ok: true });
});

/* ---- beheer: alleen managers/chefs passen instellingen, tafels en menu aan ---- */
function managerOnly(req, res) {
  if (!req.actor.manager) { res.status(403).json({ error: 'Alleen een manager kan dit aanpassen.' }); return false; }
  return true;
}

// bestellingen en reserveringen open of dicht; leden merken het direct
app.post('/api/supplier/settings', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const st = req.supplier.settings = req.supplier.settings || { ordersOpen: true, reservationsOpen: true };
  const changed = [];
  if (typeof req.body.ordersOpen === 'boolean' && st.ordersOpen !== req.body.ordersOpen) { st.ordersOpen = req.body.ordersOpen; changed.push('bestellingen ' + (st.ordersOpen ? 'open' : 'dicht')); }
  if (typeof req.body.reservationsOpen === 'boolean' && st.reservationsOpen !== req.body.reservationsOpen) { st.reservationsOpen = req.body.reservationsOpen; changed.push('reserveringen ' + (st.reservationsOpen ? 'open' : 'dicht')); }
  save();
  if (changed.length) logActivity(req.supplier.code, req.actor, 'zette ' + changed.join(' en '));
  broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'settings' });
  res.json({ ok: true, settings: st });
});

// ---- tafelindeling (horeca): status door iedereen, indeling door de manager ----
const TABLE_STATUSES = ['vrij', 'bezet', 'gereserveerd', 'dicht'];
app.post('/api/supplier/table/status', supplierAuth, (req, res) => {
  const t = (req.supplier.tables || []).find(x => x.id === req.body.id);
  if (!t) return res.status(404).json({ error: 'Tafel niet gevonden.' });
  const status = String(req.body.status || '');
  if (!TABLE_STATUSES.includes(status)) return res.status(400).json({ error: 'Onbekende status.' });
  t.status = status;
  save();
  logActivity(req.supplier.code, req.actor, 'zette ' + t.name + ' op "' + status + '"');
  broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'tables' });
  res.json({ ok: true, tables: req.supplier.tables });
});
app.post('/api/supplier/table/add', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const name = String(req.body.name || '').trim().slice(0, 40);
  const seats = Math.min(20, Math.max(1, parseInt(req.body.seats, 10) || 2));
  if (!name) return res.status(400).json({ error: 'Geef de tafel een naam.' });
  req.supplier.tables = req.supplier.tables || [];
  req.supplier.tables.push({ id: crypto.randomBytes(3).toString('hex'), name, seats, status: 'vrij' });
  save();
  logActivity(req.supplier.code, req.actor, 'voegde ' + name + ' toe (' + seats + ' pers.)');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'tables' });
  res.json({ ok: true, tables: req.supplier.tables });
});
app.post('/api/supplier/table/remove', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const i = (req.supplier.tables || []).findIndex(x => x.id === req.body.id);
  if (i >= 0) {
    logActivity(req.supplier.code, req.actor, 'verwijderde ' + req.supplier.tables[i].name);
    req.supplier.tables.splice(i, 1);
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'tables' });
  }
  res.json({ ok: true, tables: req.supplier.tables || [] });
});

// ---- team oproepen: een collega of het hele bedrijf, gericht via SSE ----
app.post('/api/supplier/team/buzz', supplierAuth, (req, res) => {
  const all = req.body.all === true;
  const target = req.body.staffId == null ? null : Number(req.body.staffId);
  let name = 'Beheer';
  if (!all && target != null) {
    const st = accounts.getStaffById(target);
    if (!st || String(st.supplier_code).toUpperCase() !== req.supplier.code) return res.status(404).json({ error: 'Teamlid niet gevonden.' });
    name = st.name;
  }
  let reached = 0;
  for (const c of sseClients) {
    if (c.sup !== req.supplier.code) continue;
    if (all) {
      // iedereen behalve de oproeper zelf
      if (c.staffId === (req.actor.staffId != null ? req.actor.staffId : null)) continue;
      sseSend(c.res, 'buzz', { from: req.actor.name, all: true }); reached++;
    } else if (target == null ? c.staffId == null : c.staffId === target) {
      sseSend(c.res, 'buzz', { from: req.actor.name }); reached++;
    }
  }
  logActivity(req.supplier.code, req.actor, all ? 'riep het hele team op (tril)' : 'riep ' + name + ' op (tril)');
  res.json({ ok: true, reached, name: all ? 'het hele team' : name });
});

// ---- security-alarm: melding met locatie naar het hele bedrijf en RTG ----
app.post('/api/supplier/security', supplierAuth, (req, res) => {
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  const loc = (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng }
    : (req.supplier.loc ? { lat: req.supplier.loc.lat, lng: req.supplier.loc.lng } : null);
  const alarm = {
    from: req.actor.name,
    company: req.supplier.name,
    note: String(req.body.note || '').trim().slice(0, 140),
    loc, label: req.supplier.loc ? req.supplier.loc.label : null,
    at: new Date().toISOString()
  };
  logActivity(req.supplier.code, req.actor, 'SECURITY-ALARM' + (alarm.note ? ': ' + alarm.note : '') + (loc ? ' (locatie gedeeld)' : ''));
  notifySupplier(req.supplier.code, { icon: '🚨', title: 'NOODOPROEP ' + req.actor.name, body: (alarm.note || 'Directe assistentie nodig.') + (alarm.label ? ' Locatie: ' + alarm.label : '') });
  for (const c of sseClients) if (c.sup === req.supplier.code) sseSend(c.res, 'alarm', alarm);
  sseToOffice('notify', { icon: '🚨', title: 'Noodoproep bij ' + req.supplier.name, body: req.actor.name + (alarm.note ? ': ' + alarm.note : ' vraagt directe assistentie.') + (loc ? ' Locatie: ' + (alarm.label || lat.toFixed ? loc.lat.toFixed(4) + ', ' + loc.lng.toFixed(4) : '') : '') });
  res.json({ ok: true, alarm });
});

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
app.post('/api/supplier/ai', supplierAuth, async (req, res) => {
  const s = req.supplier;
  const q = String(req.body.q || '').trim().slice(0, 300);
  if (!q) return res.status(400).json({ error: 'Stel een vraag.' });
  const ql = q.toLowerCase();
  const A = (reply, did) => res.json({ reply, did: !!did });

  // ---- acties ----
  // kamerstatus: "zet <kamer> op schoon/vuil/bezig/bezet" of "meld <kamer> defect: reden"
  const hkWord = { schoon:'schoon', clean:'schoon', vuil:'vuil', dirty:'vuil', bezig:'bezig', bezet:'bezet', occupied:'bezet', defect:'defect', kapot:'defect', stuk:'defect' };
  const hkHit = Object.keys(hkWord).find(w => ql.includes(w));
  const room = aiFindRoom(s, ql);
  if (room && hkHit && /\b(zet|meld|maak|markeer|set|mark|is)\b/.test(ql)) {
    const status = hkWord[hkHit];
    const note = (q.split(/[:,]/)[1] || '').trim().slice(0, 140);
    setRoomHk(s, room, status, status === 'defect' ? (note || 'gemeld via AI') : '', req.actor);
    return A(status === 'defect'
      ? room.name + ' staat op defect: uit de verkoop en er staat een klus klaar voor onderhoud.'
      : room.name + ' staat nu op "' + status + '".', true);
  }
  // deuren: "open de voordeur" / "vergrendel machiya 1"
  if (/\b(open|vergrendel|lock|sluit)\b/.test(ql) && (s.doors || []).length) {
    const door = aiFindDoor(s, ql);
    if (door) {
      if (/\b(vergrendel|lock|sluit)\b/.test(ql)) {
        door.locked = true; door.lastBy = req.actor.name; door.lastAt = new Date().toISOString(); save();
        logActivity(s.code, req.actor, 'vergrendelde "' + door.name + '" via de AI-assistent');
        sseToSupplier(s.code, 'sync', { scope: 'doors' });
        return A(door.name + ' is vergrendeld.', true);
      }
      unlockDoor(s, door, req.actor.name);
      logActivity(s.code, req.actor, 'opende "' + door.name + '" via de AI-assistent');
      return A(door.name + ' is open en vergrendelt zichzelf over 10 seconden.', true);
    }
  }
  // klus melden: "meld klus: lamp kapot" / "nieuwe klus ..."
  const klusMatch = q.match(/(?:meld(?:\s+een)?\s+klus|nieuwe\s+klus|new\s+job)[:\s]+(.{3,})/i);
  if (klusMatch) {
    const t = addTicket(s.code, req.actor, klusMatch[1].trim(), room ? room.name : null);
    save();
    logActivity(s.code, req.actor, 'meldde een klus via de AI-assistent: ' + t.text.slice(0, 50));
    sseToSupplier(s.code, 'sync', { scope: 'rooms' });
    return A('Klus genoteerd' + (t.room ? ' voor ' + t.room : '') + ': "' + t.text + '". Onderhoud ziet hem in de klussenlijst.', true);
  }

  // ---- vragen ----
  if (/(omzet|dagtotaal|z.rapport|verdiend|revenue|kassa)/.test(ql)) {
    const p = posDay(s.code);
    const methods = Object.entries(p.byMethod).map(([m, v]) => m + ' € ' + v).join(', ');
    const open = Object.entries(p.openRooms || {}).map(([r, v]) => r + ' € ' + v.total).join(', ');
    return A('Vandaag ontvangen: € ' + p.total + ' over ' + p.count + ' bon(nen)' + (methods ? ' (' + methods + ')' : '') +
      (open ? '. Nog open op kamers: ' + open + '.' : '.'));
  }
  if (/(vuil|schoon|status|kamers?\b).*(kamer|room|status)|welke kamers/.test(ql) && (s.rooms || []).length) {
    const lines = s.rooms.map(r => r.name + ': ' + ((r.hk && r.hk.status) || 'schoon') + (r.available ? '' : ' (uit de verkoop)'));
    return A('Kamerstatus. ' + lines.join('. ') + '.');
  }
  if (/(klus|onderhoud|jobs?|tickets?)/.test(ql)) {
    const open = (db.data.tickets[s.code] || []).filter(t => t.status !== 'klaar');
    return A(open.length
      ? 'Er staan ' + open.length + ' klus(sen) open: ' + open.map(t => t.text + (t.room ? ' (' + t.room + ')' : '') + (t.status === 'bezig' ? ', wordt opgepakt' : '')).join('; ') + '.'
      : 'Er zijn geen openstaande klussen.');
  }
  if (/(onderweg|gast(en)?\b|eta|guests?)/.test(ql)) {
    const g = guestsFor(s.code);
    return A(g.length
      ? g.map(x => x.codename + (x.arrived ? ' is gearriveerd' : x.etaMin != null ? ' arriveert over ~' + x.etaMin + ' min' : ' is onderweg')).join('. ') + '.'
      : 'Er is nu geen gast live onderweg naar u.');
  }
  if (/(bericht|chat|onbeantwoord|messages?)/.test(ql)) {
    const chats = Object.values(db.data.guestChats).filter(c => c.supplierCode === s.code && c.unreadPartner > 0);
    return A(chats.length
      ? 'U heeft ' + chats.reduce((n, c) => n + c.unreadPartner, 0) + ' onbeantwoord(e) bericht(en): ' + chats.map(c => c.codename + ' (' + (c.dept || 'Team') + '): "' + c.messages[c.messages.length - 1].text.slice(0, 40) + '"').join('; ') + '.'
      : 'Alle gastberichten zijn beantwoord.');
  }
  if (/(minibar)/.test(ql) && Array.isArray(s.minibar)) {
    const today = new Date().toISOString().slice(0, 10);
    const counted = [...new Set((db.data.minibarCounts[s.code] || []).filter(e => e.at.slice(0, 10) === today).map(e => e.room))];
    const todo = (s.rooms || []).map(r => r.name).filter(n => !counted.includes(n));
    return A(todo.length ? 'Nog te tellen: ' + todo.join(', ') + '.' : 'Alle minibars zijn vandaag geteld.');
  }
  if (/(bestelling|orders?|bon(nen)?\b)/.test(ql)) {
    const open = db.data.orders.filter(o => o.supplierCode === s.code && !['geserveerd', 'geweigerd', 'terugbetaald'].includes(o.status));
    return A(open.length
      ? open.length + ' open bestelling(en): ' + open.map(o => o.customerCodename + ' € ' + o.total + ' (' + o.status + ', code ' + o.pickup + ')').join('; ') + '.'
      : 'Er zijn geen open bestellingen.');
  }
  if (/(rooster|dienst|schedule|shift)/.test(ql)) {
    const wk = scheduleFor(s.code);
    const today = wk.days[0];
    return A('Vandaag: ' + today.staff.map(x => x.name + ' ' + x.shift).join('; ') + '. Het volledige rooster staat in de personeels-app.');
  }

  // vrije vraag: Claude met bedrijfscontext, anders hulptekst
  if (anthropic) {
    try {
      const p = posDay(s.code);
      const ctx = 'Bedrijf: ' + s.name + ' (' + s.type + ', ' + s.city + '). Vandaag ontvangen: € ' + p.total + '. ' +
        'Kamers: ' + (s.rooms || []).map(r => r.name + '=' + ((r.hk && r.hk.status) || 'schoon')).join(', ') + '. ' +
        'Open klussen: ' + (db.data.tickets[s.code] || []).filter(t => t.status !== 'klaar').length + '.';
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 300,
        system: 'Je bent de AI-assistent van een RTG-partner. Antwoord kort en concreet in de taal van de vraag. Context: ' + ctx,
        messages: [{ role: 'user', content: q }]
      });
      return A(response.content[0].text);
    } catch (e) { /* val terug op hulptekst */ }
  }
  return A('Dat begrijp ik nog niet helemaal. U kunt mij bijvoorbeeld vragen: "dagomzet", "welke kamers zijn vuil", "zet Riverside suite op schoon", "meld Garden kamer defect: douche lekt", "open de voordeur", "meld klus: lamp vervangen", "wie is er onderweg", "onbeantwoorde berichten", "welke minibars nog tellen" of "open bestellingen".');
});

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
app.post('/api/supplier/schedule', supplierAuth, (req, res) => res.json(scheduleFor(req.supplier.code)));

// Interne teamchat binnen het bedrijf (tekst of spraakmemo).
app.post('/api/supplier/team/message', supplierAuth, (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 500);
  let audio = null;
  if (typeof req.body.audio === 'string' && /^data:audio\//.test(req.body.audio) && req.body.audio.length <= 2 * 1024 * 1024)
    audio = req.body.audio;
  if (!text && !audio) return res.status(400).json({ error: 'Leeg bericht.' });
  const list = db.data.supplierTeam[req.supplier.code] = (db.data.supplierTeam[req.supplier.code] || []);
  list.push({ who: req.actor.name, role: req.actor.role, text: text || (audio ? '' : text), audio, at: new Date().toISOString() });
  // walkie-talkie: spraakmemo's klinken direct bij iedereen die de app open heeft
  if (audio) {
    for (const c of sseClients) {
      if (c.sup !== req.supplier.code) continue;
      if (c.staffId === (req.actor.staffId != null ? req.actor.staffId : null)) continue;
      sseSend(c.res, 'ptt', { from: req.actor.name, audio });
    }
  }
  db.data.supplierTeam[req.supplier.code] = list.slice(-100);
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
  res.json({ ok: true });
});

app.get('/api/supplier/stream', (req, res) => {
  const sess = sessionFor(req.query.token);
  if (!sess || sess.role !== 'supplier') return res.status(401).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' });
  res.write('retry: 3000\n\n');
  const client = { sup: sess.code, staffId: sess.staffId != null ? sess.staffId : null, res };
  sseClients.push(client);
  sseSend(res, 'hello', { unread: (db.data.supplierNotifications[sess.code] || []).filter(n => !n.read) });
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); const i = sseClients.indexOf(client); if (i >= 0) sseClients.splice(i, 1); });
});

app.post('/api/supplier/state', supplierAuth, (req, res) => res.json({ state: supplierState(req.supplier, req.actor) }));

app.post('/api/supplier/notifications/read', supplierAuth, (req, res) => {
  (db.data.supplierNotifications[req.supplier.code] || []).forEach(n => n.read = true);
  save();
  res.json({ ok: true });
});

// ---- dynamische prijs aan RTG (backoffice) ----
app.post('/api/supplier/price', supplierAuth, (req, res) => {
  const service = String(req.body.service || '').trim().slice(0, 120);
  const price = Number(req.body.price);
  if (!service || !(price > 0)) return res.status(400).json({ error: 'Vul een dienst en geldige prijs in.' });
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    supplierCode: req.supplier.code, supplierName: req.supplier.name, type: req.supplier.type,
    service, price, at: new Date().toISOString()
  };
  db.data.supplierPrices.unshift(entry);
  db.data.supplierPrices = db.data.supplierPrices.slice(0, 200);
  save();
  // backoffice ziet het live binnenkomen
  sseToOffice('sync', { scope: 'prices' });
  sseToOffice('notify', { icon: '💶', title: 'Nieuwe dynamische prijs', body: req.supplier.name + ': ' + service + ', € ' + price });
  logActivity(req.supplier.code, req.actor, 'gaf een prijs door: ' + service + ' (€ ' + price + ')');
  res.json({ ok: true, entry });
});

// ---- menukaart bijwerken (restaurant/bar/club) ----
app.post('/api/supplier/menu', supplierAuth, (req, res) => {
  if (!Array.isArray(req.body.menu)) return res.status(400).json({ error: 'Menu ontbreekt.' });
  req.supplier.menu = req.body.menu.slice(0, 100).map(m => ({
    id: String(m.id || crypto.randomBytes(3).toString('hex')),
    cat: String(m.cat || 'Overig').slice(0, 40),
    name: String(m.name || '').slice(0, 80),
    desc: String(m.desc || '').slice(0, 200),
    price: Math.max(0, Number(m.price) || 0),
    allergens: Array.isArray(m.allergens) ? m.allergens.slice(0, 12).map(a => String(a).slice(0, 20)) : []
  }));
  save();
  logActivity(req.supplier.code, req.actor, 'werkte de menukaart bij');
  res.json({ ok: true, menu: req.supplier.menu });
});

// ---- leverancier werkt orderstatus bij → klant live op de hoogte ----
app.post('/api/supplier/order/status', supplierAuth, (req, res) => {
  const o = db.data.orders.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  const allowed = ['nieuw', 'in bereiding', 'klaar', 'geserveerd', 'geweigerd'];
  const status = String(req.body.status || '');
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Onbekende status.' });
  o.status = status;
  save();
  broadcastSync([o.customerTier], 'orders');
  sseToOffice('sync', { scope: 'orders' });
  notify(o.customerTier, { icon: '🍽️', title: req.supplier.name, body: 'Uw bestelling is nu: ' + status + '.', scope: 'orders' });
  logActivity(req.supplier.code, req.actor, 'zette ' + o.ref + ' op "' + status + '"');
  res.json({ ok: true, order: o });
});

// ---- leverancier stort terug → klant krijgt melding ----
app.post('/api/supplier/refund', supplierAuth, (req, res) => {
  const o = db.data.orders.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  if (!o.paid) return res.status(409).json({ error: 'Deze bestelling is niet betaald.' });
  o.paid = false;
  o.refunded = true;
  o.status = 'terugbetaald';
  save();
  logActivity(req.supplier.code, req.actor, 'stortte € ' + o.total + ' terug (' + o.ref + ')');
  broadcastSync([o.customerTier], 'orders');
  sseToOffice('sync', { scope: 'orders' });
  notify(o.customerTier, { icon: '↩️', title: req.supplier.name + ', terugstorting', body: 'U ontvangt € ' + o.total + ' retour.', scope: 'orders' });
  res.json({ ok: true, order: o });
});

// ---- leverancier deelt live locatie → klanten met actieve rit/bestelling ----
app.post('/api/supplier/location', supplierAuth, (req, res) => {
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    req.supplier.loc = { lat, lng, label: String(req.body.label || req.supplier.loc.label || '').slice(0, 80) };
    save();
    logActivity(req.supplier.code, req.actor, 'deelde de live locatie');
  }
  // klanten met een actieve rit bij deze leverancier live bijwerken
  const rides = db.data.rides.filter(r => r.supplierCode === req.supplier.code && r.status !== 'gearriveerd');
  for (const r of rides) { broadcastSync([r.customerTier], 'orders'); sseToCustomer(r.customerKey || r.customerTier, 'sync', { scope: 'live' }); }
  res.json({ ok: true, loc: req.supplier.loc });
});

// ---- vervoerspartner werkt de ritstatus bij → lid live op de hoogte ----
app.post('/api/supplier/ride/status', supplierAuth, (req, res) => {
  const r = db.data.rides.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!r) return res.status(404).json({ error: 'Rit niet gevonden.' });
  const allowed = ['aangevraagd', 'onderweg', 'aangekomen', 'rijdt', 'gearriveerd', 'geweigerd'];
  const status = String(req.body.status || '');
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Onbekende status.' });
  r.status = status;
  save();
  broadcastSync([r.customerTier], 'orders');
  sseToCustomer(r.customerKey || r.customerTier, 'sync', { scope: 'live' });
  sseToOffice('sync', { scope: 'orders' });
  notify(r.customerTier, { icon: '🚗', title: req.supplier.name, body: 'Uw rit is nu: ' + status + '.', scope: 'orders' });
  logActivity(req.supplier.code, req.actor, 'zette rit ' + r.ref + ' op "' + status + '"');
  res.json({ ok: true, ride: r });
});

/* ================= KLANTZIJDE (leden-app) ================= */

// leveranciers voor de huidige stad/reis van het lid
app.post('/api/suppliers', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const city = req.body.city;
  const list = db.data.suppliers.filter(s => !city || s.city === city).map(s => publicSupplier(s, req.body.lang));
  res.json({ suppliers: list, city: db.data.trip.dest });
});

app.post('/api/supplier/menu/get', auth, (req, res) => {
  const s = findSupplier(req.body.code);
  if (!s) return res.status(404).json({ error: 'Leverancier niet gevonden.' });
  const lang = req.body.lang;
  const menu = (s.menu || []).map(m => ({ ...m, name: i18n.localize(m.name, lang), desc: i18n.localize(m.desc, lang), cat: i18n.localize(m.cat, lang) }));
  res.json({ supplier: publicSupplier(s, lang), menu });
});

// bestelling plaatsen (restaurant/bar/club), klant verschijnt onder codenaam
app.post('/api/order', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.supplierCode);
  if (!s) return res.status(404).json({ error: 'Leverancier niet gevonden.' });
  if (s.settings && s.settings.ordersOpen === false) return res.status(409).json({ error: s.name + ' neemt op dit moment geen bestellingen aan.' });
  const wanted = Array.isArray(req.body.items) ? req.body.items : [];
  const items = [];
  let total = 0;
  for (const w of wanted) {
    const m = (s.menu || []).find(x => x.id === w.id);
    const qty = Math.min(20, Math.max(1, parseInt(w.qty, 10) || 1));
    if (m) { items.push({ id: m.id, name: m.name, qty, price: m.price }); total += m.price * qty; }
  }
  if (!items.length) return res.status(400).json({ error: 'Geen geldige gerechten gekozen.' });
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  const order = {
    ref: 'RTG-O-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    pickup: pickupCode(),
    supplierCode: s.code, supplierName: s.name, type: s.type,
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    items, total,
    allergyNote: String(req.body.allergyNote || '').slice(0, 200),
    tagSalon: !!req.body.tagSalon,
    status: 'nieuw', paid: false, at: new Date().toISOString()
  };
  db.data.orders.unshift(order);
  save();
  // leverancier + backoffice live
  notifySupplier(s.code, { icon: '🛎️', title: 'Nieuwe bestelling', body: codename + ', ' + items.reduce((n, i) => n + i.qty, 0) + ' item(s), € ' + total + (order.allergyNote ? ' · allergie: ' + order.allergyNote : '') });
  sseToSupplier(s.code, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true, order });
});

// bestelling betalen (Face ID op het toestel)
app.post('/api/order/pay', auth, (req, res) => {
  const o = db.data.orders.find(x => x.ref === req.body.ref && (x.customerKey || x.customerTier) === req.session.key);
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  if (o.paid) return res.status(409).json({ error: 'Al betaald.' });
  o.paid = true;
  save();
  notifySupplier(o.supplierCode, { icon: '✅', title: 'Betaald', body: o.customerCodename + ' heeft € ' + o.total + ' voldaan.' });
  sseToSupplier(o.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true, order: o });
});

app.post('/api/orders/mine', auth, (req, res) => {
  res.json({ orders: db.data.orders.filter(o => (o.customerKey || o.customerTier) === req.session.key) });
});

/* ================= LIVE REIS (onderweg) =================
   Koppelt een reizend lid en al zijn partners realtime. Het lid deelt zijn
   positie, de partners de hunne. Zo staan pre-orders klaar op het moment dat
   het lid aankomt, weet de taxi precies waar en wanneer op te halen, en ziet
   het lid live waar zijn vervoer is. Alles op codenaam, nooit op echte naam. */

function toRad(d) { return d * Math.PI / 180; }
function haversine(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return null;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}
function etaMinutes(meters, mode) {
  if (meters == null) return null;
  const kmh = mode === 'walking' ? 4.8 : mode === 'flying' ? 700 : 26; // lopen / vliegen / rijden in de stad
  return Math.max(1, Math.round((meters / 1000) / kmh * 60));
}
function sseToCustomer(key, event, data) {
  for (const c of sseClients) if (c.key === key) sseSend(c.res, event, data);
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
    if ((r.customerKey || r.customerTier) === key && r.status !== 'gearriveerd' && r.status !== 'geweigerd') set.add(r.supplierCode);
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
      ride: ride ? { ref: ride.ref, status: ride.status, to: ride.to } : null
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
app.post('/api/live/start', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const key = req.session.key;
  const destCode = req.body.destCode ? String(req.body.destCode).trim().toUpperCase() : null;
  const dest = destCode ? findSupplier(destCode) : null;
  const mode = ['walking', 'driving', 'flying'].includes(req.body.mode) ? req.body.mode : 'driving';
  // Startpositie: meegegeven, anders het hotel op de bestemming, anders vlakbij de bestemming.
  let start = (Number.isFinite(+req.body.lat) && Number.isFinite(+req.body.lng)) ? { lat: +req.body.lat, lng: +req.body.lng } : null;
  if (!start) { const hotel = db.data.suppliers.find(s => s.type === 'hotel' && s.city === db.data.trip.dest); if (hotel && hotel.loc) start = { lat: hotel.loc.lat, lng: hotel.loc.lng }; }
  if (!start && dest && dest.loc) start = { lat: dest.loc.lat + 0.012, lng: dest.loc.lng - 0.014 };
  db.data.live[key] = {
    key, tier: req.session.tier, codename: liveCodename(req.session),
    active: true, mode, destCode,
    lat: start ? start.lat : null, lng: start ? start.lng : null,
    updatedAt: new Date().toISOString(), startedAt: new Date().toISOString(), arrived: false
  };
  save();
  if (dest) notifySupplier(dest.code, { icon: '📍', title: 'Gast onderweg', body: db.data.live[key].codename + ' is naar u onderweg.' });
  pushLive(key);
  res.json({ ok: true, live: liveStateFor(key, req.body.lang) });
});

// Lid deelt een nieuwe positie; partners en backoffice zien het live.
app.post('/api/live/update', auth, (req, res) => {
  const key = req.session.key;
  const L = db.data.live[key];
  if (!L || !L.active) return res.status(409).json({ error: 'U bent niet onderweg.' });
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) { L.lat = lat; L.lng = lng; L.updatedAt = new Date().toISOString(); }
  // automatische aankomst binnen ~150 m van de bestemming
  const dest = L.destCode ? findSupplier(L.destCode) : null;
  if (dest && dest.loc && !L.arrived) {
    const d = haversine({ lat: L.lat, lng: L.lng }, dest.loc);
    if (d != null && d < 150) {
      L.arrived = true;
      notifySupplier(dest.code, { icon: '🎉', title: 'Gast gearriveerd', body: L.codename + ' is bij u aangekomen.' });
      notify(L.tier, { icon: '📍', title: 'Aangekomen', body: 'U bent bij ' + dest.name + '.', scope: 'live' });
    }
  }
  save();
  pushLive(key);
  res.json({ ok: true, live: liveStateFor(key, req.body.lang) });
});

app.post('/api/live/stop', auth, (req, res) => {
  const key = req.session.key;
  const L = db.data.live[key];
  if (L) { L.active = false; save(); pushLive(key); }
  res.json({ ok: true, live: liveStateFor(key, req.body.lang) });
});

app.post('/api/live/state', auth, (req, res) => {
  res.json({ live: liveStateFor(req.session.key, req.body.lang) });
});

// Lid vraagt een rit aan bij een vervoerspartner (taxi/jet).
app.post('/api/ride/request', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.supplierCode);
  const caps = s ? ((db.data.supplierTypes[s.type] || {}).caps || []) : [];
  if (!s || !caps.includes('rides')) return res.status(404).json({ error: 'Geen vervoerspartner gevonden.' });
  const dest = req.body.toCode ? findSupplier(req.body.toCode) : null;
  const codename = liveCodename(req.session);
  const ride = {
    ref: 'RTG-R-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    supplierCode: s.code, supplierName: s.name, type: s.type,
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    from: String(req.body.from || 'Huidige locatie').slice(0, 80),
    to: String(req.body.to || (dest && dest.name) || '').slice(0, 80),
    toCode: dest ? dest.code : null,
    when: String(req.body.when || 'Zo snel mogelijk').slice(0, 40),
    status: 'aangevraagd', at: new Date().toISOString()
  };
  db.data.rides.unshift(ride);
  save();
  notifySupplier(s.code, { icon: '🚗', title: 'Nieuwe ritaanvraag', body: codename + ': ' + ride.from + ' naar ' + (ride.to || 'bestemming') });
  sseToSupplier(s.code, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  pushLive(req.session.key);
  res.json({ ok: true, ride });
});

/* ================= BACKOFFICE (RTG) =================
   De backoffice ziet alle binnenkomende dynamische prijzen, bestellingen en
   ritten live. Demo-toegang met een vaste code. */
const OFFICE_CODE = process.env.OFFICE_CODE || 'RTG-OFFICE';

app.post('/api/office/login', (req, res) => {
  const bucket = 'office:' + req.ip;
  if (tooManyTries(res, bucket)) return;
  if (String(req.body.code || '').trim().toUpperCase() !== OFFICE_CODE) {
    noteFailedTry(bucket);
    return res.status(401).json({ error: 'Onjuiste backoffice-code.' });
  }
  loginFails.delete(bucket);
  const token = crypto.randomBytes(24).toString('hex');
  rememberSession(token, { role: 'office' });
  res.json({ token, state: officeState() });
});

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
  return {
    prices: db.data.supplierPrices.slice(0, 60),
    orders: db.data.orders.slice(0, 60),
    rides: db.data.rides.slice(0, 60),
    live,
    applications: applications.slice(0, 40),
    suppliers: db.data.suppliers.map(publicSupplier),
    partnerApplications: (db.data.partnerApplications || []).slice(0, 40)
  };
}

app.get('/api/office/stream', (req, res) => {
  const sess = sessionFor(req.query.token);
  if (!sess || sess.role !== 'office') return res.status(401).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' });
  res.write('retry: 3000\n\n');
  const client = { office: true, res };
  sseClients.push(client);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); const i = sseClients.indexOf(client); if (i >= 0) sseClients.splice(i, 1); });
});

app.post('/api/office/state', officeAuth, (req, res) => res.json({ state: officeState() }));

/* Backoffice: identiteitsverificaties beoordelen. */
function pendingVerifications() {
  // De backoffice mag voor de KYC-controle de echte naam/e-mail uit de kluis zien.
  return accounts.listByVerification('pending').map(u => ({
    id: u.id, name: accounts.realNameOf(u), email: accounts.emailOf(u), codename: u.codename,
    tier: u.tier, doc: u.id_doc, at: u.created_at
  }));
}
app.post('/api/office/verifications', officeAuth, (req, res) => res.json({ pending: pendingVerifications() }));

app.post('/api/office/verify', officeAuth, (req, res) => {
  const user = accounts.getUserById(Number(req.body.userId));
  if (!user) return res.status(404).json({ error: 'Account niet gevonden.' });
  const status = req.body.decision === 'approve' ? 'verified' : 'rejected';
  accounts.setVerification(user.id, status);
  mail.send(accounts.emailOf(user), status === 'verified' ? 'Uw identiteit is geverifieerd' : 'Uw verificatie is afgewezen',
    'Beste ' + accounts.realNameOf(user) + ',\n\n' +
    (status === 'verified' ? 'Uw identiteit is geverifieerd. U kunt nu in een tik boeken.' :
     'We konden uw document niet goedkeuren. Probeer het opnieuw met een duidelijkere foto.') +
    '\n\nRahul Travel Group');
  notify(user.tier, { icon: status === 'verified' ? '✅' : '⚠',
    title: status === 'verified' ? 'Identiteit geverifieerd' : 'Verificatie afgewezen',
    body: status === 'verified' ? 'U kunt nu in één tik boeken.' : 'Probeer een duidelijkere foto van uw document.' });
  res.json({ ok: true, status, pending: pendingVerifications() });
});

// Het geüploade document bekijken (alleen backoffice; token via query voor <img>).
app.get('/api/office/doc', (req, res) => {
  const sess = sessionFor(req.query.token);
  if (!sess || sess.role !== 'office') return res.status(401).end();
  const file = path.basename(String(req.query.file || '')); // geen padtraversal
  const full = path.join(UPLOAD_DIR, file);
  if (!file || !full.startsWith(UPLOAD_DIR) || !fs.existsSync(full)) return res.status(404).end();
  res.sendFile(full);
});

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
    return 'Geregeld. De paklijst staat klaar in uw reisoverzicht (lichte lagen, regenjas, nette schoenen die makkelijk uitgaan, adapter type A) en het dagplan voor 14 oktober is ingepland: Arashiyama om 08:00, lunch in Sagano, uw theeceremonie om 15:00 en een avondwandeling langs Pontocho.\n\nVolgende dat ik in de gaten houd: de bevestiging van Kikunoi Honten. U hoeft niets te doen.';
  if (l.includes('inpak') || l.includes('paklijst') || l.includes('koffer'))
    return 'Voor Kyoto in oktober (14-22°C, kans op regen):\n• Lichte lagen + een regenjas\n• Nette schoenen die makkelijk uitgaan (ryokan & tempels)\n• Ingetogen kleding voor Kikunoi Honten\n• Adapter type A\n\nZal ik hier een afvinklijst van maken in uw reisoverzicht?';
  if (l.includes('visum') || l.includes('paspoort') || l.includes('document'))
    return 'Voor Japan heeft u geen visum nodig bij verblijf tot 90 dagen. Uw paspoort moet geldig zijn tijdens het hele verblijf. Ik zet uw boekingsbevestigingen alvast klaar voor de douane-app (Visit Japan Web).';
  if (l.includes('weer'))
    return 'Kyoto medio oktober: gemiddeld 14-22°C, af en toe regen, en het begin van de herfstkleuren, de esdoorns in Arashiyama beginnen dan net te kleuren. De beste ochtend voor de bamboetuin is direct na zonsopgang; zal ik een vroege wandeling inplannen?';
  if (l.includes('plan') || l.includes('dag') || l.includes('doen'))
    return 'Voorstel voor 14 oktober:\n• 08:00 Arashiyama vóór de drukte\n• 11:30 lunch bij een sobameester in Sagano\n• 15:00 uw privé-theeceremonie in Gion (staat al vast)\n• 19:00 avondwandeling langs Pontocho\n\nZal ik de lunch laten reserveren?';
  if (l.includes('restaurant') || l.includes('eten') || l.includes('diner'))
    return 'Uw tafel bij Kikunoi Honten (15 okt, 19:30) is in aanvraag, bevestiging volgt doorgaans binnen 48 uur. Wilt u een reservelijst? Ik denk aan Gion Sasaki of een counter-kaiseki in Higashiyama, beide via ons netwerk tegen normale prijs.';
  return 'Daar zoek ik het fijne van uit en ik kom er vandaag nog op terug. Voor uw reis naar Kyoto kan ik alvast helpen met de paklijst, documenten, het weer of een dagplanning, zeg het maar.';
}

app.post('/api/ai', auth, async (req, res) => {
  if (req.session.tier === 'guest') {
    return res.status(403).json({ error: 'De persoonlijke AI is exclusief voor leden.' });
  }
  // Alleen role/content overnemen, geschiedenis begrensd op de laatste 12 beurten.
  const history = (Array.isArray(req.body.messages) ? req.body.messages : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-12);
  // De Claude API vereist dat het gesprek met een user-beurt begint; de
  // proactieve opener van de AI staat vooraan als assistant, knip die eraf.
  while (history.length && history[0].role !== 'user') history.shift();
  if (!history.length || history[history.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Geen vraag ontvangen.' });
  }

  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: aiSystemPrompt(req.session.tier),
        messages: history
      });
      const reply = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
      return res.json({ reply: reply || 'Excuses, ik heb geen antwoord kunnen formuleren.', source: 'claude' });
    } catch (e) {
      console.error('Claude API-fout, val terug op demo-antwoord:', e.message);
    }
  }
  res.json({ reply: cannedAnswer(history[history.length - 1].content), source: 'demo' });
});

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

app.post('/api/chat/history', auth, (req, res) => {
  if (!req.session.account) return res.json({ messages: [], mode: 'butler', demo: true });
  res.json({
    messages: convOf(req.session.account.id),
    mode: req.session.tier === 'rtg' ? 'butler' : 'concierge',
    phone: accounts.phoneOf(req.session.account)
  });
});

app.post('/api/chat/send', auth, async (req, res) => {
  if (!req.session.account) return res.status(403).json({ error: 'Alleen voor accounts.' });
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  await memberSays(req.session.account, text, 'app');
  res.json({ ok: true, messages: convOf(req.session.account.id), mode: req.session.tier === 'rtg' ? 'butler' : 'concierge' });
});

/* Inkomend WhatsApp-bericht. In productie de door Meta ondertekende webhook;
   hier een eenvoudige { from, text } om de koppeling te demonstreren. */
app.post('/api/whatsapp/webhook', async (req, res) => {
  const from = req.body.from || (((req.body.entry || [])[0]?.changes || [])[0]?.value?.messages || [])[0]?.from;
  const text = req.body.text || (((req.body.entry || [])[0]?.changes || [])[0]?.value?.messages || [])[0]?.text?.body;
  if (!from || !text) return res.status(400).json({ error: 'Nummer of tekst ontbreekt.' });
  const user = accounts.findByPhone(from);
  if (!user) return res.json({ ok: true, matched: false }); // onbekend nummer: negeren
  await memberSays(user, text, 'whatsapp');
  res.json({ ok: true, matched: true });
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
app.post('/api/office/conversations', officeAuth, (req, res) => res.json({ conversations: conciergeInbox() }));

app.post('/api/office/reply', officeAuth, (req, res) => {
  const u = accounts.getUserById(Number(req.body.userId));
  if (!u) return res.status(404).json({ error: 'Account niet gevonden.' });
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  const md = accounts.getMemberState(u.id) || {};
  md.conversation = md.conversation || [];
  md.conversation.push({ from: 'concierge', text: text.slice(0, 1000), at: new Date().toISOString(), channel: 'concierge' });
  md.needsConcierge = false;
  accounts.saveMemberState(u.id, md);
  broadcastSync([u.tier], 'chat');
  notify(u.tier, { icon: '💬', title: 'Uw concierge', body: text.slice(0, 80), scope: 'chat' });
  // In productie gaat dit antwoord ook via WhatsApp naar accounts.phoneOf(u).
  res.json({ ok: true, conversations: conciergeInbox() });
});

/* ---------- afsluiters: nette 404 en centrale foutafhandeling ---------- */

app.use('/api', (req, res) => res.status(404).json({ error: 'Onbekend eindpunt.' }));
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '..', 'public', 'site', '404.html'));
});
app.use((err, req, res, next) => {
  console.error('[fout]', err && err.message);
  if (res.headersSent) return next(err);
  res.status(err && err.type === 'entity.too.large' ? 413 : 500)
     .json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
});

/* ---------- dagelijkse back-up van de data ---------- */

const BACKUP_DIR = path.join(__dirname, 'data', 'backups');
function backupData() {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const dir = path.join(BACKUP_DIR, day);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ['db.json', 'rtg.db']) {
      const from = path.join(__dirname, 'data', f);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dir, f));
    }
    // hooguit 14 dagen bewaren
    const days = fs.readdirSync(BACKUP_DIR).sort();
    for (const d of days.slice(0, Math.max(0, days.length - 14)))
      fs.rmSync(path.join(BACKUP_DIR, d), { recursive: true, force: true });
  } catch (e) { console.warn('[backup] mislukt:', e.message); }
}

/* ---------- start ---------- */

initRealtime();
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
  console.log(`RTG-portaal draait op http://localhost:${PORT}, open http://localhost:${PORT}/apps/portaal.html`);
  console.log(`Live updates (SSE) actief${webpush ? ', web-push actief' : ' (web-push niet geladen)'}.`);
});

// Netjes afsluiten: data wegschrijven, verbindingen sluiten, dan pas stoppen.
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  console.log(`[stop] ${sig} ontvangen, data wordt bewaard...`);
  try { save(); } catch (e) {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
});
