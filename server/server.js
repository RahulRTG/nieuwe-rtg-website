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
  JETAG: [['Sophie Bakker', 'manager', 'Operations'], ['Lucas de Jong', 'staff', 'Crew']],
  // zelfstandigen: eenmanszaken, dus alleen een eigenaar met beheer-rechten
  AYAKA: [['Ayaka Nishimura', 'manager', 'Personal stylist']],
  KAITO: [['Kaito Tanabe', 'manager', 'Personal trainer']]
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
  // het zzp-genre: zelfstandige professionals (mode, health, fotografie...)
  // bieden diensten en producten aan; leden boeken met datum en tijd
  if (!db.data.supplierTypes.zzp)
    db.data.supplierTypes.zzp = { label: 'Zelfstandig professional', icon: '🧑‍🎨', caps: ['services', 'location', 'pricing'] };
  if (!db.data.boekingen) db.data.boekingen = [];
  if (!db.data.suppliers.find(s => s.code === 'AYAKA')) {
    db.data.suppliers.push({
      code: 'AYAKA', name: 'Studio Ayaka', type: 'zzp', city: 'Kyoto', vak: 'Mode & styling',
      loc: { lat: 35.006, lng: 135.772, label: 'Gion, Kyoto' }, rate: 0.1,
      menu: [], photos: [],
      services: [
        { id: 's1', name: 'Personal styling, seizoensgarderobe', desc: 'Twee uur aan huis of in de studio, incl. kleurenanalyse', price: 240, duurMin: 120, soort: 'dienst' },
        { id: 's2', name: 'Persoonlijke shopdag Kyoto', desc: 'Een dag langs ateliers en verborgen boetieks', price: 520, duurMin: 360, soort: 'dienst' },
        { id: 's3', name: 'Zijden pochet, handgemaakt', desc: 'Uit eigen atelier, geleverd op de suite', price: 85, soort: 'product' }
      ]
    });
  }
  if (!db.data.suppliers.find(s => s.code === 'KAITO')) {
    db.data.suppliers.push({
      code: 'KAITO', name: 'Kaito Health', type: 'zzp', city: 'Kyoto', vak: 'Health & wellness',
      loc: { lat: 35.011, lng: 135.768, label: 'Nakagyo, Kyoto' }, rate: 0.1,
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
  if (!sess || sess.tier === 'guest' || !db.data.memberDir) return;
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
      id: p.id, author: p.author, tier: p.tier, place: p.place, visual: p.visual,
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

app.get('/api/health', (req, res) => res.json({
  ok: true, ai: anthropic ? 'claude' : 'demo',
  server: Number(process.env.RTG_SERVER || 1), active: db.writable,
  pid: process.pid, up: Math.round(process.uptime())
}));

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

/* ================= SALON-CONNECTIES =================
   Leden voegen elkaar toe op codenaam, sturen elkaar berichten, delen
   Salon-posts en bellen elkaar (audio/video via WebRTC; de server is
   alleen het signaleringskanaal en ziet nooit beeld of geluid). */

function dmSleutel(a, b) { return [a, b].sort().join('|'); }
function connectieTussen(a, b) {
  return db.data.connections.find(c => (c.a === a && c.b === b) || (c.a === b && c.b === a));
}
function geenGast(req, res) {
  if (req.session.tier === 'guest') { res.status(403).json({ error: 'Alleen voor leden.' }); return true; }
  return false;
}

// leden zoeken op codenaam (nooit op echte naam)
app.post('/api/member/find', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const q = String(req.body.q || '').trim().toLowerCase();
  if (q.length < 2) return res.json({ results: [] });
  const results = Object.entries(db.data.memberDir)
    .filter(([key, m]) => key !== req.session.key && m.codename.toLowerCase().includes(q))
    .slice(0, 8)
    .map(([key, m]) => {
      const c = connectieTussen(req.session.key, key);
      return { key, codename: m.codename, tier: m.tier,
               status: c ? (c.status === 'accepted' ? 'verbonden' : (c.requestedBy === req.session.key ? 'aangevraagd' : 'wacht-op-u')) : 'geen' };
    });
  res.json({ results });
});

// verzoek sturen
app.post('/api/member/connect', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const key = String(req.body.key || '');
  if (key === req.session.key) return res.status(400).json({ error: 'Dat bent u zelf.' });
  if (!db.data.memberDir[key]) return res.status(404).json({ error: 'Dit lid kennen we niet.' });
  let c = connectieTussen(req.session.key, key);
  if (c && c.status === 'accepted') return res.json({ ok: true, status: 'verbonden' });
  if (c) return res.json({ ok: true, status: c.requestedBy === req.session.key ? 'aangevraagd' : 'wacht-op-u' });
  c = { a: req.session.key, b: key, requestedBy: req.session.key, status: 'pending', at: new Date().toISOString() };
  db.data.connections.push(c);
  save();
  sseToCustomer(key, 'social', { kind: 'request', from: liveCodename(req.session) });
  res.json({ ok: true, status: 'aangevraagd' });
});

// verzoek beantwoorden
app.post('/api/member/connect/respond', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const key = String(req.body.key || '');
  const c = connectieTussen(req.session.key, key);
  if (!c || c.status !== 'pending' || c.requestedBy === req.session.key)
    return res.status(404).json({ error: 'Geen openstaand verzoek van dit lid.' });
  if (req.body.action === 'accept') {
    c.status = 'accepted';
    c.acceptedAt = new Date().toISOString();
    save();
    sseToCustomer(key, 'social', { kind: 'accepted', by: liveCodename(req.session) });
    return res.json({ ok: true, status: 'verbonden' });
  }
  db.data.connections = db.data.connections.filter(x => x !== c);
  save();
  res.json({ ok: true, status: 'geen' });
});

// mijn connecties + openstaande verzoeken + ongelezen tellers
app.post('/api/member/connections', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const mij = req.session.key;
  const naam = k => (db.data.memberDir[k] || {}).codename || k;
  const conns = db.data.connections
    .filter(c => (c.a === mij || c.b === mij) && c.status === 'accepted')
    .map(c => {
      const ander = c.a === mij ? c.b : c.a;
      const chat = db.data.memberChats[dmSleutel(mij, ander)];
      const laatst = chat && chat.messages.length ? chat.messages[chat.messages.length - 1] : null;
      const gelezen = chat && chat.read && chat.read[mij] ? chat.read[mij] : '';
      const unread = chat ? chat.messages.filter(m => m.from !== mij && m.at > gelezen).length : 0;
      return { key: ander, codename: naam(ander), tier: (db.data.memberDir[ander] || {}).tier,
               unread, last: laatst ? (laatst.post ? '↗ Salon-post' : laatst.text.slice(0, 48)) : null, lastAt: laatst ? laatst.at : c.acceptedAt };
    })
    .sort((x, y) => String(y.lastAt).localeCompare(String(x.lastAt)));
  const verzoeken = db.data.connections
    .filter(c => (c.a === mij || c.b === mij) && c.status === 'pending' && c.requestedBy !== mij)
    .map(c => ({ key: c.requestedBy, codename: naam(c.requestedBy), at: c.at }));
  res.json({ me: mij, codename: liveCodename(req.session), connections: conns, requests: verzoeken });
});

// gesprek ophalen (en als gelezen markeren)
app.post('/api/member/dm', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const ander = String(req.body.withKey || '');
  const c = connectieTussen(req.session.key, ander);
  if (!c || c.status !== 'accepted') return res.status(403).json({ error: 'U bent nog niet verbonden met dit lid.' });
  const k = dmSleutel(req.session.key, ander);
  const chat = db.data.memberChats[k] = db.data.memberChats[k] || { messages: [], read: {} };
  chat.read[req.session.key] = new Date().toISOString();
  save();
  res.json({ messages: chat.messages.slice(-80), codename: (db.data.memberDir[ander] || {}).codename });
});

// bericht sturen; optioneel met een gedeelde Salon-post erbij
app.post('/api/member/dm/send', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const ander = String(req.body.toKey || '');
  const c = connectieTussen(req.session.key, ander);
  if (!c || c.status !== 'accepted') return res.status(403).json({ error: 'U bent nog niet verbonden met dit lid.' });
  const text = String(req.body.text || '').slice(0, 500).trim();
  let postDeel = null;
  if (req.body.postId != null) {
    const p = db.data.posts.find(x => x.id === Number(req.body.postId));
    if (p) postDeel = { id: p.id, author: p.author, place: p.place, text: String(p.text || '').slice(0, 120), photo: p.photo || null };
  }
  if (!text && !postDeel) return res.status(400).json({ error: 'Leeg bericht.' });
  const k = dmSleutel(req.session.key, ander);
  const chat = db.data.memberChats[k] = db.data.memberChats[k] || { messages: [], read: {} };
  const msg = { from: req.session.key, text, post: postDeel, at: new Date().toISOString() };
  chat.messages.push(msg);
  if (chat.messages.length > 300) chat.messages = chat.messages.slice(-300);
  chat.read[req.session.key] = msg.at;
  save();
  const mijnNaam = liveCodename(req.session);
  sseToCustomer(ander, 'social', { kind: 'dm', from: req.session.key, codename: mijnNaam, text: msg.text, post: msg.post, at: msg.at });
  res.json({ ok: true, message: msg });
});

// bel-signalering: pure doorgeefluik tussen twee verbonden leden
app.post('/api/member/call', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const ander = String(req.body.toKey || '');
  const c = connectieTussen(req.session.key, ander);
  if (!c || c.status !== 'accepted') return res.status(403).json({ error: 'U bent nog niet verbonden met dit lid.' });
  const kind = String(req.body.kind || '');
  if (!['ring', 'accept', 'offer', 'answer', 'ice', 'hangup', 'decline', 'busy'].includes(kind))
    return res.status(400).json({ error: 'Onbekend signaal.' });
  sseToCustomer(ander, 'call', {
    kind, from: req.session.key, codename: liveCodename(req.session),
    video: !!req.body.video, payload: req.body.payload || null
  });
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
    applications: (db.data.applications[s.code] || []).slice(0, 30),
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
  res.json({ supplier: { code: s.code, name: s.name, type: s.type }, staff: accounts.listStaff(s.code).map(accounts.publicStaff) });
});

// Manager voegt personeel toe (krijgt een PIN) of verwijdert het.
app.post('/api/supplier/staff/add', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan personeel toevoegen.' });
  const name = schoon(req.body.name, 60);
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
  const name = schoon(req.body.name, 60);
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
    author: req.supplier.name, tier: 'partner', partner: true, partnerCode: req.supplier.code,
    place: req.supplier.city, visual: null, photo,
    text, lang: req.body.lang === 'en' ? 'en' : 'nl',
    baseLikes: 0, likedBy: {}, comments: []
  };
  db.data.posts.unshift(post);
  db.data.posts = db.data.posts.slice(0, 60);
  save();
  logActivity(req.supplier.code, req.actor, 'publiceerde op De Salon');
  salonNaarVolgers(req.supplier, text);
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  sseToOffice('sync', { scope: 'salon' });
  res.json({ ok: true, postId: post.id });
});

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
app.post('/api/salon/volg', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.code);
  if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
  s.salon = s.salon || { bio: '', volgers: [], sinds: new Date().toISOString() };
  const i = s.salon.volgers.indexOf(req.session.key);
  if (i >= 0) s.salon.volgers.splice(i, 1);
  else s.salon.volgers.push(req.session.key);
  save();
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true, volgIk: i < 0, volgers: s.salon.volgers.length });
});

// exclusieve member-aanbieding plaatsen (klantbinding: claimen met een code)
app.post('/api/supplier/salon/deal', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const titel = schoon(req.body.titel, 80);
  const text = schoon(req.body.text, 400);
  if (!titel || !text) return res.status(400).json({ error: 'Geef de aanbieding een titel en een tekst.' });
  const geldigTot = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.geldigTot || '')) ? req.body.geldigTot : null;
  const post = {
    id: Date.now(),
    author: req.supplier.name, tier: 'partner', partner: true, partnerCode: req.supplier.code,
    place: req.supplier.city, visual: null, photo: null,
    text, lang: 'nl', baseLikes: 0, likedBy: {}, comments: [],
    deal: { titel, geldigTot, claims: [] }
  };
  db.data.posts.unshift(post);
  db.data.posts = db.data.posts.slice(0, 60);
  save();
  logActivity(req.supplier.code, req.actor, 'zette een aanbieding op De Salon: "' + titel + '"');
  salonNaarVolgers(req.supplier, '🎁 ' + titel);
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true, postId: post.id });
});

// lid claimt een aanbieding en krijgt een persoonlijke code voor aan de kassa
app.post('/api/salon/deal/claim', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const p = db.data.posts.find(x => x.id === Number(req.body.postId));
  if (!p || !p.deal) return res.status(404).json({ error: 'Aanbieding niet gevonden.' });
  if (p.deal.geldigTot && p.deal.geldigTot < new Date().toISOString().slice(0, 10))
    return res.status(410).json({ error: 'Deze aanbieding is verlopen.' });
  const al = p.deal.claims.find(c => c.key === req.session.key);
  if (al) return res.json({ ok: true, code: al.code, alGeclaimd: true });
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  const claim = { key: req.session.key, codename, code: 'RTG-D-' + crypto.randomBytes(3).toString('hex').toUpperCase(), at: new Date().toISOString(), used: false };
  p.deal.claims.push(claim);
  save();
  notifySupplier(p.partnerCode, { icon: '🎁', title: 'Aanbieding geclaimd', body: codename + ' claimde "' + p.deal.titel + '" (' + p.deal.claims.length + 'x totaal).' });
  res.json({ ok: true, code: claim.code });
});

// de zaak verzilvert een claimcode aan de kassa
app.post('/api/supplier/salon/deal/redeem', supplierAuth, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  for (const p of db.data.posts) {
    if (!p.deal || p.partnerCode !== req.supplier.code) continue;
    const claim = p.deal.claims.find(c => c.code === code);
    if (claim) {
      if (claim.used) return res.status(409).json({ error: 'Deze code is al verzilverd.' });
      claim.used = true;
      claim.usedAt = new Date().toISOString();
      save();
      logActivity(req.supplier.code, req.actor, 'verzilverde aanbiedingscode ' + code + ' (' + claim.codename + ')');
      return res.json({ ok: true, titel: p.deal.titel, codename: claim.codename });
    }
  }
  res.status(404).json({ error: 'Deze code kennen we hier niet.' });
});

// poll plaatsen: vraag de leden wat zij willen (marketinginzicht)
app.post('/api/supplier/salon/poll', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const vraag = schoon(req.body.vraag, 140);
  const opties = (Array.isArray(req.body.opties) ? req.body.opties : []).map(o => schoon(o, 60)).filter(Boolean).slice(0, 4);
  if (!vraag || opties.length < 2) return res.status(400).json({ error: 'Geef een vraag en minstens twee opties.' });
  const post = {
    id: Date.now(),
    author: req.supplier.name, tier: 'partner', partner: true, partnerCode: req.supplier.code,
    place: req.supplier.city, visual: null, photo: null,
    text: vraag, lang: 'nl', baseLikes: 0, likedBy: {}, comments: [],
    poll: { vraag, opties: opties.map(t2 => ({ tekst: t2, stemmen: [] })) }
  };
  db.data.posts.unshift(post);
  db.data.posts = db.data.posts.slice(0, 60);
  save();
  logActivity(req.supplier.code, req.actor, 'zette een poll op De Salon');
  salonNaarVolgers(req.supplier, '📊 ' + vraag);
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true, postId: post.id });
});

app.post('/api/salon/poll/stem', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const p = db.data.posts.find(x => x.id === Number(req.body.postId));
  if (!p || !p.poll) return res.status(404).json({ error: 'Poll niet gevonden.' });
  if (p.poll.opties.some(o => o.stemmen.includes(req.session.key))) return res.status(409).json({ error: 'U heeft al gestemd.' });
  const i = Number(req.body.optie);
  if (!p.poll.opties[i]) return res.status(400).json({ error: 'Onbekende optie.' });
  p.poll.opties[i].stemmen.push(req.session.key);
  save();
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true });
});

// het bedrijfsprofiel: bio instellen en de marketingcijfers van de zaak
app.post('/api/supplier/salon/bio', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  req.supplier.salon = req.supplier.salon || { bio: '', volgers: [], sinds: new Date().toISOString() };
  req.supplier.salon.bio = schoon(req.body.bio, 200);
  save();
  logActivity(req.supplier.code, req.actor, 'werkte het Salon-profiel bij');
  res.json({ ok: true, salon: { bio: req.supplier.salon.bio, volgers: req.supplier.salon.volgers.length } });
});

app.post('/api/supplier/salon/stats', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const s = req.supplier;
  const eigen = db.data.posts.filter(p => p.partnerCode === s.code);
  const likes = eigen.reduce((n, p) => n + p.baseLikes + Object.keys(p.likedBy).length, 0);
  const reacties = eigen.reduce((n, p) => n + p.comments.length, 0);
  res.json({
    volgers: (s.salon && s.salon.volgers.length) || 0,
    bio: (s.salon && s.salon.bio) || '',
    posts: eigen.length, likes, reacties,
    deals: eigen.filter(p => p.deal).map(p => ({
      titel: p.deal.titel, geldigTot: p.deal.geldigTot,
      claims: p.deal.claims.length, verzilverd: p.deal.claims.filter(c => c.used).length
    })),
    polls: eigen.filter(p => p.poll).map(p => ({
      vraag: p.poll.vraag,
      opties: p.poll.opties.map(o => ({ tekst: o.tekst, stemmen: o.stemmen.length }))
    }))
  });
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
  const name = schoon(req.body.name, 60);
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
  if (!optieAan(dest, 'deurenGast')) return res.status(409).json({ error: dest.name + ' heeft de digitale gastsleutel op dit moment uitstaan. Meld u bij de receptie.' });
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
  if (!optieAan(s, 'gastchat')) return res.status(409).json({ error: s.name + ' heeft de gastchat op dit moment uitstaan.' });
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
  const name = schoon(req.body.name, 60);
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

/* ---- events: het Kantoor maakt ze, leden melden zich aan, de deur checkt in ---- */
app.post('/api/supplier/event', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!Array.isArray(s.events)) return res.status(400).json({ error: 'Events zijn er voor restaurants, bars en clubs.' });
  const a = String(req.body.action || '');
  if (a === 'add') {
    const name = String((req.body.event || {}).name || '').trim().slice(0, 80);
    const date = String((req.body.event || {}).date || '').slice(0, 10);
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Vul minimaal een naam en datum in.' });
    const e = {
      id: crypto.randomBytes(4).toString('hex'),
      name, date,
      time: String((req.body.event || {}).time || '').slice(0, 5),
      desc: String((req.body.event || {}).desc || '').trim().slice(0, 200),
      capacity: Math.min(2000, Math.max(1, parseInt((req.body.event || {}).capacity, 10) || 50)),
      price: Math.max(0, Number((req.body.event || {}).price) || 0),
      published: false, guests: [], runsheet: [],
      catering: { mode: 'geen', itemIds: [], note: '' }, allergies: [],
      at: new Date().toISOString()
    };
    s.events.unshift(e);
    s.events = s.events.slice(0, 40);
    logActivity(s.code, req.actor, 'maakte event "' + name + '" aan');
  } else {
    const e = s.events.find(x => x.id === req.body.id);
    if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
    if (a === 'publish') { e.published = !e.published; logActivity(s.code, req.actor, (e.published ? 'publiceerde' : 'haalde offline') + ' event "' + e.name + '"'); }
    else if (a === 'remove') { s.events = s.events.filter(x => x.id !== req.body.id); logActivity(s.code, req.actor, 'verwijderde event "' + e.name + '"'); }
    else return res.status(400).json({ error: 'Onbekende actie.' });
  }
  save();
  broadcastSync(['rtg', 'lifestyle', 'business'], 'events');
  sseToSupplier(s.code, 'sync', { scope: 'events' });
  res.json({ ok: true, events: s.events });
});

// aan de deur: gast afvinken (elke medewerker mag dit, op eigen naam)
app.post('/api/supplier/event/checkin', supplierAuth, (req, res) => {
  const e = (req.supplier.events || []).find(x => x.id === req.body.eventId);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  const g = (e.guests || []).find(x => x.key === req.body.key);
  if (!g) return res.status(404).json({ error: 'Gast niet gevonden.' });
  g.checkedIn = !g.checkedIn;
  save();
  logActivity(req.supplier.code, req.actor, (g.checkedIn ? 'checkte ' : 'zette check-in terug voor ') + g.codename + ' in bij "' + e.name + '"');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e });
});

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
app.post('/api/supplier/event/runsheet', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  e.runsheet = e.runsheet || [];
  if (req.body.action === 'add') {
    const it = req.body.item || {};
    if (!String(it.text || '').trim()) return res.status(400).json({ error: 'Omschrijf wat er moet gebeuren.' });
    e.runsheet.push(runItem(it.time, it.station, it.text, it.daysBefore));
    if (e.runsheet.length > 60) e.runsheet = e.runsheet.slice(0, 60);
    sortRunsheet(e);
  } else if (req.body.action === 'remove') {
    e.runsheet = e.runsheet.filter(x => x.id !== req.body.itemId);
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e });
});

// afvinken op de werkvloer (elke medewerker, op eigen naam)
app.post('/api/supplier/event/runsheet/done', supplierAuth, (req, res) => {
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  const it = e && (e.runsheet || []).find(x => x.id === req.body.itemId);
  if (!it) return res.status(404).json({ error: 'Regel niet gevonden.' });
  it.done = !it.done;
  it.doneBy = it.done ? req.actor.name : null;
  save();
  if (it.done) logActivity(req.supplier.code, req.actor, 'vinkte af: ' + it.time + ' ' + it.text + ' (' + e.name + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e });
});

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
app.post('/api/supplier/event/runsheet/ai', supplierAuth, async (req, res) => {
  if (!managerOnly(req, res)) return;
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  const mode = req.body.mode === 'import' ? 'import' : 'suggest';
  let items = null;
  if (anthropic) {
    try {
      const prompt = mode === 'import'
        ? 'Zet dit geplakte draaiboek om naar JSON. Bron:\n' + String(req.body.text || '').slice(0, 4000)
        : 'Stel een professioneel horeca-draaiboek op voor dit event: "' + e.name + '" op ' + e.date + (e.time ? ' om ' + e.time : '') + (e.desc ? ' (' + e.desc + ')' : '') + ', capaciteit ' + e.capacity + '.';
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 1200,
        system: 'Je bent een horeca-draaiboekplanner. Antwoord UITSLUITEND met een JSON-array van objecten {"time":"HH:MM","station":"keuken|bar|bediening|party|alle","text":"..."}. Maximaal 20 regels, Nederlands, praktisch en concreet. party = de party manager/deur.',
        messages: [{ role: 'user', content: prompt }]
      });
      const raw = (msg.content[0].text.match(/\[[\s\S]*\]/) || [null])[0];
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) items = arr.slice(0, 20).map(x => runItem(x.time, x.station, x.text));
    } catch (err) { items = null; }
  }
  if (!items) items = mode === 'import' ? parseRunsheetText(req.body.text) : fallbackRunsheet(e);
  if (!items.length) return res.status(400).json({ error: 'Geen bruikbare regels gevonden. Zet per regel een tijd en een taak.' });
  e.runsheet = [...(e.runsheet || []), ...items].slice(0, 60);
  sortRunsheet(e);
  save();
  logActivity(req.supplier.code, req.actor, (mode === 'import' ? 'importeerde' : 'liet de AI een') + ' draaiboek ' + (mode === 'import' ? 'voor' : 'opstellen voor') + ' "' + e.name + '" (' + items.length + ' regels)');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e, added: items.length, ai: !!anthropic });
});

/* ---- event-keuken: menukeuze, allergenen met vervangend gerecht, en de
   mise en place die dagen vooruit wordt georganiseerd ---- */

// menukeuze: vast menu (gerechten van de kaart) of a la carte (Kantoor)
app.post('/api/supplier/event/catering', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  const mode = ['menu', 'alacarte', 'geen'].includes(req.body.mode) ? req.body.mode : 'geen';
  const ids = Array.isArray(req.body.itemIds) ? req.body.itemIds.filter(id => (req.supplier.menu || []).some(m => m.id === id)).slice(0, 20) : [];
  e.catering = { mode, itemIds: mode === 'menu' ? ids : [], note: String(req.body.note || '').slice(0, 200) };
  save();
  logActivity(req.supplier.code, req.actor, 'stelde de eventkeuken in voor "' + e.name + '" (' + (mode === 'menu' ? ids.length + ' gangen' : mode) + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e });
});

// allergenen registreren; per allergeen kan een vervangend gerecht worden bedacht
app.post('/api/supplier/event/allergy', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  e.allergies = e.allergies || [];
  if (req.body.action === 'add') {
    const allergen = String(req.body.allergen || '').trim().toLowerCase().slice(0, 30);
    if (!allergen) return res.status(400).json({ error: 'Vul het allergeen in.' });
    if (e.allergies.some(a => a.allergen === allergen)) return res.status(409).json({ error: 'Dit allergeen staat er al.' });
    e.allergies.push({ id: crypto.randomBytes(3).toString('hex'), allergen, count: Math.min(500, Math.max(1, parseInt(req.body.count, 10) || 1)), alternative: null });
  } else if (req.body.action === 'remove') {
    e.allergies = e.allergies.filter(a => a.id !== req.body.allergyId);
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e });
});

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
app.post('/api/supplier/event/allergy/alt', supplierAuth, async (req, res) => {
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  const al = e && (e.allergies || []).find(a => a.id === req.body.allergyId);
  if (!al) return res.status(404).json({ error: 'Allergeen niet gevonden.' });
  const dishes = cateringDishes(req.supplier, e);
  const geraakt = dishes.filter(d => (d.allergens || []).some(x => String(x).toLowerCase().includes(al.allergen)));
  let alt = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 400,
        system: 'Je bent een chef-kok. Antwoord UITSLUITEND met JSON: {"name":"...","desc":"..."}. Bedenk een volwaardig vervangend gerecht in de stijl van de kaart, veilig voor het allergeen, kort en concreet in het Nederlands.',
        messages: [{ role: 'user', content: 'Allergeen: ' + al.allergen + '. Getroffen gerecht(en): ' + (geraakt.map(d => d.name + ' (' + (d.desc || '') + ')').join('; ') || 'onbekend') + '. Keuken: ' + req.supplier.name + '.' }]
      });
      alt = JSON.parse((msg.content[0].text.match(/\{[\s\S]*\}/) || ['{}'])[0]);
      if (!alt.name) alt = null;
    } catch (err) { alt = null; }
  }
  if (!alt) {
    const idee = ALT_IDEE[al.allergen] || ['aangepaste bereiding zonder ' + al.allergen, 'veilig voor ' + al.allergen];
    const basis = geraakt[0] ? geraakt[0].name : 'het hoofdgerecht';
    alt = { name: basis + ', variant zonder ' + al.allergen, desc: 'Zelfde opbouw als ' + basis.toLowerCase() + ', met ' + idee[0] + '; ' + idee[1] + '.' };
  }
  al.alternative = { name: String(alt.name).slice(0, 80), desc: String(alt.desc || '').slice(0, 200) };
  save();
  logActivity(req.supplier.code, req.actor, 'vervangend gerecht voor ' + al.allergen + ': "' + al.alternative.name + '" (' + e.name + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e, alternative: al.alternative, ai: !!anthropic });
});

// de MEP-organisator: bouwt de complete mise en place voor het keukenteam,
// dagen vooruit, op basis van menu, aantallen en allergenen (keukenscherm/Kantoor)
app.post('/api/supplier/event/mep', supplierAuth, async (req, res) => {
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  const dishes = cateringDishes(req.supplier, e);
  if (!dishes.length && (!e.catering || e.catering.mode !== 'alacarte'))
    return res.status(409).json({ error: 'Stel eerst de eventkeuken in (vast menu of a la carte) in het Kantoor.' });
  const covers = eventCovers(e);
  let items = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 1400,
        system: 'Je bent een sous-chef die de mise en place plant. Antwoord UITSLUITEND met een JSON-array van {"daysBefore":0-3,"time":"HH:MM","task":"..."}. Maximaal 18 taken, Nederlands, concreet met aantallen. daysBefore 2 = twee dagen voor het event.',
        messages: [{ role: 'user', content: 'Event: ' + e.name + ' op ' + e.date + ', ' + covers + ' couverts. Gerechten: ' + (dishes.map(d => d.name).join('; ') || 'a la carte van de kaart') + '. Allergenen: ' + ((e.allergies || []).map(a => a.allergen + ' (' + a.count + 'x' + (a.alternative ? ', vervanger: ' + a.alternative.name : '') + ')').join('; ') || 'geen') + '.' }]
      });
      const arr = JSON.parse((msg.content[0].text.match(/\[[\s\S]*\]/) || ['[]'])[0]);
      if (Array.isArray(arr) && arr.length) items = arr.slice(0, 18).map(x => runItem(x.time, 'keuken', x.task, x.daysBefore, true));
    } catch (err) { items = null; }
  }
  if (!items) {
    items = [
      runItem('10:00', 'keuken', 'Bestellingen plaatsen en voorraad controleren voor ' + e.name + ' (' + covers + ' couverts)', 2, true),
      runItem('15:00', 'keuken', 'Fonds, sauzen en marinades opzetten die tijd nodig hebben', 2, true),
      runItem('09:00', 'keuken', 'Levering ontvangen en controleren op kwaliteit en aantallen', 1, true),
      runItem('11:00', 'keuken', 'Koeling indelen per gang, bakken labelen met datum en gerecht', 1, true)
    ];
    for (const d of dishes.slice(0, 8)) {
      items.push(runItem('13:00', 'keuken', 'Mise en place ' + d.name + ': snijwerk, portioneren (' + covers + ')', 1, true));
      items.push(runItem('14:00', 'keuken', 'Verse afwerking en garnituur ' + d.name + ', proeven met de chef', 0, true));
    }
    if (e.catering && e.catering.mode === 'alacarte')
      items.push(runItem('12:00', 'keuken', 'Parstock per station aanvullen voor a la carte (' + covers + ' couverts verwacht)', 1, true));
    for (const a of (e.allergies || [])) {
      items.push(runItem('12:00', 'keuken', 'Vervangend gerecht ' + (a.alternative ? '"' + a.alternative.name + '"' : 'voor ' + a.allergen) + ' voorbereiden, ' + a.count + 'x, strikt gescheiden werken (' + a.allergen + ')', 1, true));
      items.push(runItem('16:00', 'keuken', 'Aparte uitgifte klaarzetten voor gasten met ' + a.allergen + ' (' + a.count + 'x), pan en snijplank apart', 0, true));
    }
    items.push(runItem('10:00', 'keuken', 'MEP-briefing keukenteam: taken verdelen, tijden en allergenen doorspreken', 0, true));
  }
  // eerdere automatische MEP weggooien zodat opnieuw organiseren geen dubbels geeft
  e.runsheet = (e.runsheet || []).filter(x => !x.mep);
  e.runsheet = [...e.runsheet, ...items].slice(0, 90);
  sortRunsheet(e);
  save();
  logActivity(req.supplier.code, req.actor, 'organiseerde de mise en place voor "' + e.name + '" (' + items.length + ' taken, ' + covers + ' couverts)');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e, added: items.length, covers, ai: !!anthropic });
});

/* ---- recept/bereidingswijze per gerecht: uitklapbaar op de bon, zodat ook
   nieuwe mensen weten wat ze maken en hoe. De AI schrijft hem desgewenst. ---- */
app.post('/api/supplier/menu/recipe', supplierAuth, async (req, res) => {
  const m = (req.supplier.menu || []).find(x => x.id === req.body.itemId);
  if (!m) return res.status(404).json({ error: 'Gerecht niet gevonden.' });
  let recept = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 700,
        system: 'Je bent een chef-kok die werkinstructies schrijft voor nieuwe keukenkrachten. Antwoord in het Nederlands, platte tekst, maximaal 10 korte genummerde stappen: mise en place, bereiding, afwerking en bord. Concreet, geen inleiding.',
        messages: [{ role: 'user', content: 'Gerecht: ' + m.name + (m.desc ? ' (' + m.desc + ')' : '') + '. Keuken: ' + req.supplier.name + '. Allergenen: ' + ((m.allergens || []).join(', ') || 'geen') + '.' }]
      });
      recept = String(msg.content[0].text || '').trim().slice(0, 1500);
    } catch (err) { recept = null; }
  }
  if (!recept) {
    recept = '1. Mise en place: alle ingredienten voor ' + m.name + ' afwegen en klaarzetten.\n' +
      (m.desc ? '2. Basis: ' + m.desc + '\n' : '2. Basis volgens de huisreceptuur van ' + req.supplier.name + '.\n') +
      '3. Bereiden op de eigen sectie (' + (m.sectie || 'warm') + '); tussentijds proeven.\n' +
      ((m.allergens || []).length ? '4. LET OP allergenen: ' + m.allergens.join(', ') + '. Bij een allergie-bon strikt gescheiden werken.\n' : '') +
      '5. Afwerking en garnituur; bord vegen.\n' +
      '6. Doorgeven aan de pas; chef proeft steekproefsgewijs.\n' +
      '(Laat de manager dit recept aanscherpen in het Kantoor, of zet een ANTHROPIC_API_KEY voor een uitgewerkt recept.)';
  }
  m.recept = recept;
  save();
  logActivity(req.supplier.code, req.actor, 'zette het recept van ' + m.name + ' op de bon');
  // bewust geen sync-broadcast: het scherm dat het recept opvroeg werkt zijn
  // eigen menukopie bij, andere schermen zien het bij hun eerstvolgende refresh
  res.json({ ok: true, recept, ai: !!anthropic });
});

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
app.post('/api/supplier/kitchen/coach', supplierAuth, async (req, res) => {
  const s = req.supplier;
  const lang = req.body.lang === 'en' ? 'en' : 'nl';
  const open = db.data.orders.filter(o => o.supplierCode === s.code && ['nieuw', 'in bereiding'].includes(o.status) && sectiesForOrder(s, o).length);
  if (!open.length) return res.json({ ok: true, lines: [], ai: !!anthropic });
  const hash = crypto.createHash('sha1').update(lang + JSON.stringify(open.map(o => [o.ref, o.status, o.table, o.secties, Math.floor((Date.now() - new Date(o.at)) / 300000)]))).digest('hex');
  const cached = coachCache.get(s.code);
  if (cached && cached.hash === hash) return res.json({ ok: true, lines: cached.lines, ai: !!anthropic, cached: true });
  let lines = null;
  if (anthropic) {
    try {
      const beeld = open.map(o => ({ bon: o.pickup, tafel: o.table || null, min: Math.round((Date.now() - new Date(o.at)) / 60000), items: o.items.map(i => i.qty + 'x ' + i.name), kanten: o.secties || {} }));
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 600,
        system: lang === 'en'
          ? 'You are a sous-chef running the line. Reply ONLY with a JSON array of at most 6 short English instructions (strings): what to fire now, what to batch, which table leaves together, who gets priority.'
          : 'Je bent een sous-chef die de lijn aanstuurt. Antwoord UITSLUITEND met een JSON-array van maximaal 6 korte Nederlandse aanwijzingen (strings): wat nu maken, wat batchen, welke tafel samen uitgaat, wie voorrang krijgt.',
        messages: [{ role: 'user', content: JSON.stringify(beeld) }]
      });
      const arr = JSON.parse((msg.content[0].text.match(/\[[\s\S]*\]/) || ['[]'])[0]);
      if (Array.isArray(arr) && arr.length) lines = arr.slice(0, 6).map(x => String(x).slice(0, 160));
    } catch (err) { lines = null; }
  }
  if (!lines) lines = coachRules(s, open, lang);
  coachCache.set(s.code, { hash, lines, at: Date.now() });
  res.json({ ok: true, lines, ai: !!anthropic });
});

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
app.post('/api/supplier/mep/daily', supplierAuth, async (req, res) => {
  const s = req.supplier;
  if (!s.dailyMeps) return res.status(400).json({ error: 'De dagelijkse mise en place is er voor restaurants, bars en clubs.' });
  const menu = (s.menu || []).filter(m => m.station !== 'bar');
  if (!menu.length) return res.status(409).json({ error: 'Zet eerst gerechten op de kaart; daar rekent de voorspelling mee.' });
  const dagen = req.body.day === 'morgen' ? 1 : 0;
  const doel = new Date(Date.now() + dagen * 86400000);
  const date = doel.toISOString().slice(0, 10);
  const [factor, factorLabel] = weekdagFactor(doel);

  // historie: bestellingen van de afgelopen 21 dagen
  const sinds = Date.now() - 21 * 86400000;
  const hist = db.data.orders.filter(o => o.supplierCode === s.code && new Date(o.at).getTime() >= sinds && !['geweigerd', 'terugbetaald'].includes(o.status));
  const perGerecht = {}; let histQty = 0; const histDagen = new Set();
  for (const o of hist) {
    histDagen.add(String(o.at).slice(0, 10));
    for (const it of (o.items || [])) {
      const m = menu.find(x => x.id === it.id);
      if (m) { perGerecht[m.id] = (perGerecht[m.id] || 0) + it.qty; histQty += it.qty; }
    }
  }
  const stoelen = (s.tables || []).reduce((n, t) => n + (t.seats || 0), 0) || 24;
  const basis = Math.round(stoelen * 2 * factor);                 // twee zittingen
  const histGem = histDagen.size ? Math.round((histQty / histDagen.size) * factor) : 0;
  const covers = Math.max(basis, histGem);
  const portions = menu.map(m => {
    const aandeel = histQty ? (perGerecht[m.id] || 0) / histQty : 1 / menu.length;
    return { name: m.name, n: Math.max(5, Math.ceil((covers * aandeel) / 5) * 5) };
  });

  let tasks = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 900,
        system: 'Je bent een sous-chef. Antwoord UITSLUITEND met een JSON-array van {"time":"HH:MM","task":"..."}. Maximaal 10 taken voor de dagelijkse a la carte mise en place, Nederlands, concreet met aantallen.',
        messages: [{ role: 'user', content: 'Verwacht: ' + covers + ' couverts (' + factorLabel + '). Porties: ' + portions.map(p => p.name + ' ' + p.n + 'x').join('; ') + '.' }]
      });
      const arr = JSON.parse((msg.content[0].text.match(/\[[\s\S]*\]/) || ['[]'])[0]);
      if (Array.isArray(arr) && arr.length) tasks = arr.slice(0, 10).map(x => ({ id: crypto.randomBytes(3).toString('hex'), time: /^\d{2}:\d{2}$/.test(x.time) ? x.time : '12:00', task: String(x.task).slice(0, 160), done: false, doneBy: null }));
    } catch (err) { tasks = null; }
  }
  if (!tasks) {
    const t = (time, task) => ({ id: crypto.randomBytes(3).toString('hex'), time, task, done: false, doneBy: null });
    tasks = [
      t('09:00', 'Voorraad naast de voorspelling leggen (' + covers + ' couverts, ' + factorLabel + ') en bijbestellen'),
      t('10:30', 'Koeling checken, alles labelen; parstock per station bepalen'),
      ...portions.slice(0, 8).map(p => t('13:00', 'MEP ' + p.name + ': ' + p.n + ' porties (snijwerk, sauzen, portioneren)')),
      t('15:30', 'Garnituren en verse afwerking klaarzetten per station'),
      t('16:30', 'Lijn-check met de chef: proeven, aantallen aftekenen, briefing service')
    ];
  }
  s.dailyMeps[date] = { date, covers, factorLabel, portions, tasks, by: req.actor.name, at: new Date().toISOString() };
  // oude dagen opruimen
  const gisteren = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  for (const k of Object.keys(s.dailyMeps)) if (k < gisteren) delete s.dailyMeps[k];
  save();
  logActivity(s.code, req.actor, 'voorspelde de mise en place voor ' + date + ' (' + covers + ' couverts)');
  sseToSupplier(s.code, 'sync', { scope: 'events' });
  res.json({ ok: true, plan: s.dailyMeps[date], histDagen: histDagen.size, ai: !!anthropic });
});

app.post('/api/supplier/mep/daily/done', supplierAuth, (req, res) => {
  const plan = s => (s.dailyMeps || {})[req.body.date];
  const p = plan(req.supplier);
  const it = p && (p.tasks || []).find(x => x.id === req.body.taskId);
  if (!it) return res.status(404).json({ error: 'Taak niet gevonden.' });
  it.done = !it.done;
  it.doneBy = it.done ? req.actor.name : null;
  save();
  if (it.done) logActivity(req.supplier.code, req.actor, 'vinkte af: ' + it.time + ' ' + it.task.slice(0, 60));
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, plan: p });
});

// lid meldt zich aan voor een gepubliceerd event
app.post('/api/event/rsvp', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.supplierCode);
  const e = s && (s.events || []).find(x => x.id === req.body.eventId && x.published);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  if (!optieAan(s, 'events')) return res.status(409).json({ error: s.name + ' neemt op dit moment geen event-aanmeldingen aan.' });
  const qty = Math.min(8, Math.max(1, parseInt(req.body.qty, 10) || 1));
  const taken = (e.guests || []).reduce((n, g) => n + g.qty, 0);
  if (e.guests.some(g => g.key === req.session.key)) return res.status(409).json({ error: 'U staat al op de gastenlijst.' });
  if (taken + qty > e.capacity) return res.status(409).json({ error: 'Dit event is vol.' });
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  e.guests.push({ key: req.session.key, codename, qty, at: new Date().toISOString(), checkedIn: false });
  save();
  notifySupplier(s.code, { icon: '\uD83C\uDF9F', title: 'Aanmelding voor ' + e.name, body: codename + ', ' + qty + ' pers.' });
  notify(req.session.tier, { icon: '\uD83C\uDF9F', title: s.name, body: 'U staat op de gastenlijst van ' + e.name + ' (' + e.date + (e.time ? ', ' + e.time : '') + '), ' + qty + ' pers. Uw codenaam is uw toegang.', scope: 'events' });
  sseToSupplier(s.code, 'sync', { scope: 'events' });
  sseToOffice('sync', { scope: 'events' });
  res.json({ ok: true, spotsLeft: Math.max(0, e.capacity - taken - qty) });
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
      'log in als management met uw PIN en stel uw pagina, menukaart en team in.\n\n' +
      'Uw bedrijfsaccount op De Salon is direct aangemaakt; dit is een vast onderdeel van elk RTG-partnerschap. ' +
      'Via Kantoor, Marketing stelt u uw profiel in, plaatst u berichten, aanbiedingen en polls, en ziet u uw volgers en cijfers.\n\nRahul Travel Group');
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
/* ---- boekhouding per land en genre ----
   Een praktische samenvatting van btw-tarieven, werkgeverslasten en
   aangifteregels per land, als kennisbasis voor de AI-boekhouder.
   Voorlichting voor de demo-omgeving; geen bindend fiscaal advies. */
const LANDEN = {
  NL: { naam: 'Nederland', tarieven: { eten: 9, drank: 21, logies: 9, vervoer: 9, jet: 0, standaard: 21 },
    lasten: 0.28, vakantiegeld: 0.08, uurloonMin: 14.06,
    aangifte: 'Btw-aangifte per kwartaal (of maandelijks), loonaangifte maandelijks bij de Belastingdienst.',
    extra: 'Toeristenbelasting verschilt per gemeente (Amsterdam 12,5% op logies). Eten en niet-alcoholische dranken 9%, alcohol 21%.',
    zakelijk: { horeca: 'Btw op eten en drinken in een horecagelegenheid is NIET aftrekbaar; de kosten zelf zijn wel opvoerbaar.',
      logies: 'Btw op een zakelijke overnachting (9%) is aftrekbaar.',
      vervoer: 'Btw op taxi en openbaar vervoer (9%) is aftrekbaar bij zakelijk gebruik.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief; er is dus geen btw om terug te vorderen.' } },
  BE: { naam: 'Belgie', tarieven: { eten: 12, drank: 21, logies: 6, vervoer: 6, jet: 0, standaard: 21 },
    lasten: 0.27, vakantiegeld: 0.092, uurloonMin: 12.11,
    aangifte: 'Btw-aangifte per maand of kwartaal; DIMONA-melding voor elk personeelslid voor de eerste werkdag.',
    extra: 'Restaurantdiensten 12%, dranken 21%; de witte kassa (GKS) is verplicht in de horeca boven de omzetdrempel.',
    zakelijk: { horeca: 'Btw op restaurantkosten is niet aftrekbaar; de kosten zijn voor 69% aftrekbaar in de vennootschapsbelasting.',
      logies: 'Btw op een zakelijke hotelovernachting (6%) is aftrekbaar.',
      vervoer: 'Btw op personenvervoer (6%) is beperkt aftrekbaar.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  DE: { naam: 'Duitsland', tarieven: { eten: 19, drank: 19, logies: 7, vervoer: 7, jet: 0, standaard: 19 },
    lasten: 0.21, vakantiegeld: 0, uurloonMin: 12.82,
    aangifte: 'Umsatzsteuer-Voranmeldung per maand of kwartaal via ELSTER; loonaangifte maandelijks.',
    extra: 'Eten in het restaurant 19%, afhaal en bezorging 7%. Hotelovernachting 7%, maar het ontbijt 19%: gesplitst factureren.',
    zakelijk: { horeca: 'Bewirtungskosten: 70% aftrekbaar als kosten; de btw is volledig aftrekbaar met een correct Bewirtungsbeleg.',
      logies: 'Btw op de overnachting (7%) is aftrekbaar; het ontbijt staat apart op 19%.',
      vervoer: 'Btw op taxiritten tot 50 km (7%) is aftrekbaar.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  FR: { naam: 'Frankrijk', tarieven: { eten: 10, drank: 20, logies: 10, vervoer: 10, jet: 0, standaard: 20 },
    lasten: 0.42, vakantiegeld: 0, uurloonMin: 11.88,
    aangifte: 'TVA per maand (regime reel) of per kwartaal; taxe de sejour per overnachting per gemeente.',
    extra: 'Eten en niet-alcoholische dranken 10%, alcohol 20%. Werkgeverslasten horen bij de hoogste van Europa.',
    zakelijk: { horeca: 'TVA op zakelijke maaltijden is aftrekbaar met een factuur op bedrijfsnaam.',
      logies: 'TVA op hotelkosten voor eigen werknemers is NIET aftrekbaar; voor genodigden wel.',
      vervoer: 'TVA op personenvervoer is niet aftrekbaar.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  ES: { naam: 'Spanje', tarieven: { eten: 10, drank: 21, logies: 10, vervoer: 10, jet: 0, standaard: 21 },
    lasten: 0.30, vakantiegeld: 0, uurloonMin: 8.87,
    aangifte: 'IVA per kwartaal (modelo 303) met een jaaroverzicht (modelo 390); loonaangifte maandelijks.',
    extra: 'Horeca en hotels 10%; alcohol in de winkel 21%, als onderdeel van de horecadienst 10%.',
    zakelijk: { horeca: 'IVA op zakelijke maaltijden is aftrekbaar met een volledige factuur (factura completa).',
      logies: 'IVA op zakelijke overnachtingen is aftrekbaar.',
      vervoer: 'IVA op vervoer is aftrekbaar bij zakelijk gebruik.',
      jet: 'Internationaal personenvervoer valt onder het 0%-tarief.' } },
  JP: { naam: 'Japan', tarieven: { eten: 10, drank: 10, logies: 10, vervoer: 10, jet: 0, standaard: 10 },
    lasten: 0.16, vakantiegeld: 0, uurloonMin: 6.7,
    aangifte: 'Consumption tax (10%) jaarlijks of per kwartaal; sinds 2023 is een qualified invoice vereist voor aftrek.',
    extra: 'Ter plaatse eten 10%, afhaal 8%. Accommodation tax per stad (Kyoto heft per persoon per nacht).',
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

app.post('/api/supplier/settings', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const st = req.supplier.settings = req.supplier.settings || { ordersOpen: true, reservationsOpen: true };
  const changed = [];
  if (typeof req.body.ordersOpen === 'boolean' && st.ordersOpen !== req.body.ordersOpen) { st.ordersOpen = req.body.ordersOpen; changed.push('bestellingen ' + (st.ordersOpen ? 'open' : 'dicht')); }
  if (typeof req.body.reservationsOpen === 'boolean' && st.reservationsOpen !== req.body.reservationsOpen) { st.reservationsOpen = req.body.reservationsOpen; changed.push('reserveringen ' + (st.reservationsOpen ? 'open' : 'dicht')); }
  if (req.body.opties && typeof req.body.opties === 'object') {
    st.opties = st.opties || {};
    for (const k of Object.keys(ZAAK_OPTIES)) {
      if (typeof req.body.opties[k] === 'boolean' && st.opties[k] !== req.body.opties[k]) {
        st.opties[k] = req.body.opties[k];
        changed.push(ZAAK_OPTIES[k] + ' ' + (req.body.opties[k] ? 'aan' : 'uit'));
      }
    }
  }
  // boekhouding: het land bepaalt de tarieven en regels, het uurloon de personeelskosten
  if (typeof req.body.land === 'string' && LANDEN[req.body.land] && st.land !== req.body.land) {
    st.land = req.body.land;
    changed.push('het land op ' + LANDEN[req.body.land].naam);
  }
  if (req.body.uurloon != null) {
    const u = Number(req.body.uurloon);
    if (Number.isFinite(u) && u >= 0 && u <= 500) { st.uurloon = Math.round(u * 100) / 100; changed.push('het uurloon bij'); }
  }
  // vervoerders: het tarief dat elke nieuwe rit direct een vaste prijs geeft
  if (req.body.tarief && typeof req.body.tarief === 'object') {
    const t = st.tarief = st.tarief || {};
    for (const k of ['start', 'perKm', 'minimum']) {
      const v = Number(req.body.tarief[k]);
      if (Number.isFinite(v) && v >= 0 && v <= 100000) t[k] = Math.round(v * 100) / 100;
    }
    changed.push('het tarief bij');
  }
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
app.post('/api/staff/clock', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const lijst = db.data.klok[req.supplier.code] = db.data.klok[req.supplier.code] || [];
  const open = lijst.find(e => e.staffId === req.actor.staffId && !e.out);
  let actie;
  if (open) { open.out = new Date().toISOString(); actie = 'uit'; }
  else { lijst.unshift({ id: crypto.randomBytes(4).toString('hex'), staffId: req.actor.staffId, name: req.actor.name, in: new Date().toISOString(), out: null }); actie = 'in'; }
  db.data.klok[req.supplier.code] = lijst.slice(0, 4000);
  save();
  logActivity(req.supplier.code, req.actor, 'klokte ' + actie);
  sseToSupplier(req.supplier.code, 'sync', { scope: 'klok' });
  res.json({ ok: true, actie, klok: klokVan(req.supplier.code, req.actor.staffId) });
});

// eigen personeelszaken in een keer: klok, verlof en de vertrouwenslijn
app.post('/api/staff/mine', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  res.json({
    klok: klokVan(req.supplier.code, req.actor.staffId),
    verlof: (db.data.verlof[req.supplier.code] || []).filter(v => v.staffId === req.actor.staffId).slice(0, 10),
    trust: trustVan(req.supplier.code, req.actor.staffId)
  });
});

// verlof aanvragen of ziekmelden
app.post('/api/staff/leave/request', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const soort = req.body.soort === 'ziek' ? 'ziek' : 'verlof';
  const van = schoon(req.body.van, 10), tot = schoon(req.body.tot, 10);
  const geldig = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (soort === 'verlof' && (!geldig(van) || !geldig(tot) || tot < van))
    return res.status(400).json({ error: 'Kies een geldige begin- en einddatum.' });
  const lijst = db.data.verlof[req.supplier.code] = db.data.verlof[req.supplier.code] || [];
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    staffId: req.actor.staffId, name: req.actor.name, soort,
    van: soort === 'ziek' ? new Date().toISOString().slice(0, 10) : van,
    tot: soort === 'ziek' ? null : tot,
    reden: schoon(req.body.reden, 140),
    status: soort === 'ziek' ? 'gemeld' : 'nieuw',
    at: new Date().toISOString()
  };
  lijst.unshift(entry);
  db.data.verlof[req.supplier.code] = lijst.slice(0, 2000);
  save();
  if (soort === 'ziek') {
    logActivity(req.supplier.code, req.actor, 'meldde zich ziek');
    notifySupplier(req.supplier.code, { icon: '🤒', title: 'Ziekmelding', body: req.actor.name + ' heeft zich ziek gemeld. Denk aan de bezetting van vandaag.' });
  } else {
    logActivity(req.supplier.code, req.actor, 'vroeg verlof aan (' + entry.van + ' t/m ' + entry.tot + ')');
    notifySupplier(req.supplier.code, { icon: '🌴', title: 'Verlofaanvraag', body: req.actor.name + ': ' + entry.van + ' t/m ' + entry.tot + (entry.reden ? ' · ' + entry.reden : '') });
  }
  sseToSupplier(req.supplier.code, 'sync', { scope: 'verlof' });
  res.json({ ok: true, entry });
});

// manager beslist over een verlofaanvraag
app.post('/api/supplier/leave/decide', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const v = (db.data.verlof[req.supplier.code] || []).find(x => x.id === req.body.id);
  if (!v) return res.status(404).json({ error: 'Aanvraag niet gevonden.' });
  if (v.status !== 'nieuw') return res.status(409).json({ error: 'Deze aanvraag is al behandeld.' });
  v.status = req.body.action === 'goedkeuren' ? 'goedgekeurd' : 'afgewezen';
  v.decidedBy = req.actor.name;
  save();
  logActivity(req.supplier.code, req.actor, (v.status === 'goedgekeurd' ? 'keurde verlof goed van ' : 'wees verlof af van ') + v.name);
  sseToSupplier(req.supplier.code, 'sync', { scope: 'verlof' });
  res.json({ ok: true, entry: v });
});

/* Vertrouwenslijn: rechtstreeks en vertrouwelijk contact met de
   vertrouwenspersoon van RTG. De werkgever ziet hier niets van: geen
   activiteit, geen melding. Alleen de backoffice kan lezen en antwoorden. */
function trustVan(code, staffId) {
  const t = db.data.trustLine.find(x => x.code === code && x.staffId === staffId);
  return t ? { anon: t.anon, messages: t.messages.slice(-30) } : { anon: false, messages: [] };
}
app.post('/api/staff/trust/send', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const text = schoon(req.body.text, 800);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  let t = db.data.trustLine.find(x => x.code === req.supplier.code && x.staffId === req.actor.staffId);
  if (!t) {
    t = { id: crypto.randomBytes(4).toString('hex'), code: req.supplier.code, company: req.supplier.name,
          staffId: req.actor.staffId, anon: !!req.body.anon, name: req.actor.name, messages: [], open: true, lastAt: null };
    db.data.trustLine.unshift(t);
    db.data.trustLine = db.data.trustLine.slice(0, 2000);
  }
  if (req.body.anon != null) t.anon = !!req.body.anon;
  t.messages.push({ from: 'staff', text, at: new Date().toISOString() });
  t.messages = t.messages.slice(-60);
  t.open = true;
  t.lastAt = new Date().toISOString();
  save();
  // bewust GEEN logActivity en GEEN notifySupplier: dit blijft buiten de werkgever om
  sseToOffice('sync', { scope: 'trust' });
  res.json({ ok: true, trust: trustVan(req.supplier.code, req.actor.staffId) });
});
app.post('/api/staff/trust/thread', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  res.json({ trust: trustVan(req.supplier.code, req.actor.staffId) });
});

// backoffice: de vertrouwenspersoon leest en antwoordt
app.post('/api/office/trust', officeAuth, (req, res) => {
  res.json({ threads: db.data.trustLine.slice(0, 40).map(t => ({
    id: t.id, company: t.company, anon: t.anon,
    name: t.anon ? 'Anoniem' : t.name,
    open: t.open, lastAt: t.lastAt,
    messages: t.messages.slice(-30)
  })) });
});
app.post('/api/office/trust/reply', officeAuth, (req, res) => {
  const t = db.data.trustLine.find(x => x.id === req.body.id);
  if (!t) return res.status(404).json({ error: 'Gesprek niet gevonden.' });
  const text = schoon(req.body.text, 800);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  t.messages.push({ from: 'rtg', text, at: new Date().toISOString() });
  t.messages = t.messages.slice(-60);
  t.open = false;
  t.lastAt = new Date().toISOString();
  save();
  // alleen een seintje om te verversen; de inhoud gaat uitsluitend via de persoonlijke login
  sseToSupplier(t.code, 'sync', { scope: 'trust' });
  res.json({ ok: true });
});

/* ---- eigen backoffice per leverancier ----
   Elk bedrijf zijn eigen controlecentrum: dagcijfers, weektrend, toppers en
   een actiecentrum, met dezelfde patronen als de RTG-backoffice maar dan
   uitsluitend over de eigen zaak. */
app.post('/api/supplier/backoffice', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const s = req.supplier;
  const en = req.body.lang === 'en';
  const nu = Date.now();
  const dag = iso => String(iso || '').slice(0, 10);
  const vandaag = new Date().toISOString().slice(0, 10);
  const orders = db.data.orders.filter(o => o.supplierCode === s.code && o.paid && o.status !== 'geweigerd' && o.status !== 'terugbetaald');
  const ritten = db.data.rides.filter(r => r.supplierCode === s.code && r.paid && r.status !== 'geweigerd');
  const boekingen = db.data.boekingen.filter(b => b.supplierCode === s.code && b.paid && b.status !== 'geweigerd');
  // kassaverkopen zonder dubbeltellingen: RTG-codes zijn al app-omzet,
  // kamerlasten tellen pas bij het uitchecken
  const kassa = (db.data.posSales[s.code] || []).filter(v => v.method !== 'rtg' && v.method !== 'kamer');
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(nu - i * 86400000).toISOString().slice(0, 10);
    week.push({
      date: d,
      label: new Date(d + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'short' }),
      omzet: orders.filter(o => dag(o.paidAt || o.at) === d).reduce((x, o) => x + (o.total || 0), 0)
        + ritten.filter(r => dag(r.paidAt || r.at) === d).reduce((x, r) => x + (r.quote || 0), 0)
        + boekingen.filter(b => dag(b.paidAt || b.at) === d).reduce((x, b) => x + (b.price || 0), 0)
        + kassa.filter(v => dag(v.at) === d).reduce((x, v) => x + (v.total || 0), 0),
      aantal: orders.filter(o => dag(o.paidAt || o.at) === d).length
        + ritten.filter(r => dag(r.paidAt || r.at) === d).length
        + boekingen.filter(b => dag(b.paidAt || b.at) === d).length
        + kassa.filter(v => dag(v.at) === d).length
    });
  }
  // toppers: wat verkoopt het best, app, kassa en boekingen samen
  const teller = {};
  const telItems = lijst => { for (const it of (lijst || [])) { if (!it.name) continue; const t = teller[it.name] = teller[it.name] || { naam: it.name, aantal: 0, omzet: 0 }; t.aantal += it.qty || 1; t.omzet += (it.price || 0) * (it.qty || 1); } };
  for (const o of orders) telItems(o.items);
  for (const v of kassa) telItems(v.items);
  for (const b of boekingen) { const t2 = teller[b.service.name] = teller[b.service.name] || { naam: b.service.name, aantal: 0, omzet: 0 }; t2.aantal += 1; t2.omzet += b.price || 0; }
  const toppers = Object.values(teller).sort((a, b) => b.omzet - a.omzet).slice(0, 8);
  // actiecentrum van de zaak
  const alerts = [];
  const minGeleden = iso => Math.round((nu - new Date(iso)) / 60000);
  for (const o of db.data.orders) {
    if (o.supplierCode !== s.code || !o.paid || o.status !== 'nieuw') continue;
    const m = minGeleden(o.paidAt || o.at);
    if (m >= 10) alerts.push({ level: 'rood', text: en
      ? 'Order ' + o.ref + ' has been untouched for ' + m + ' min (' + o.customerCodename + ').'
      : 'Bestelling ' + o.ref + ' staat al ' + m + ' min onaangeroerd (' + o.customerCodename + ').' });
  }
  for (const r of db.data.rides) {
    if (r.supplierCode !== s.code || !r.paid || r.status !== 'aangevraagd' || r.driver) continue;
    const straks = r.plannedFor && (new Date(r.plannedFor) - nu) > 45 * 60000;
    if (!straks && minGeleden(r.paidAt || r.at) >= 10)
      alerts.push({ level: 'rood', text: en ? 'Ride ' + r.ref + ' is still waiting for a driver.' : 'Rit ' + r.ref + ' wacht nog op een chauffeur.' });
    else if (straks && (new Date(r.plannedFor) - nu) < 24 * 3600000)
      alerts.push({ level: 'amber', text: en
        ? 'Scheduled ride ' + r.ref + ' (' + String(r.plannedFor).slice(0, 16).replace('T', ' ') + ') has no driver yet.'
        : 'Geplande rit ' + r.ref + ' (' + String(r.plannedFor).slice(0, 16).replace('T', ' ') + ') heeft nog geen chauffeur.' });
  }
  for (const b of db.data.boekingen) {
    if (b.supplierCode !== s.code || !b.paid || b.status !== 'aangevraagd') continue;
    if (minGeleden(b.paidAt || b.at) >= 30) alerts.push({ level: 'amber', text: en
      ? 'Booking ' + b.ref + ' (' + b.service.name + ') is still waiting for your confirmation.'
      : 'Boeking ' + b.ref + ' (' + b.service.name + ') wacht nog op uw bevestiging.' });
  }
  const verlofN = (db.data.verlof[s.code] || []).filter(v => v.status === 'nieuw').length;
  if (verlofN) alerts.push({ level: 'amber', text: en ? verlofN + ' leave request(s) await your decision (HR & team).' : verlofN + ' verlofaanvraag/aanvragen wachten op uw besluit (HR & team).' });
  const sollN = (db.data.applications[s.code] || []).filter(a => a.status === 'nieuw').length;
  if (sollN) alerts.push({ level: 'info', text: en ? sollN + ' open application(s) (HR & team).' : sollN + ' open sollicitatie(s) (HR & team).' });
  const chatsN = Object.values(db.data.guestChats).filter(c => c.supplierCode === s.code && c.unreadPartner).length;
  if (chatsN) alerts.push({ level: 'amber', text: en ? chatsN + ' guest chat(s) waiting for a reply.' : chatsN + ' gastchat(s) wachten op een antwoord.' });
  const klussenN = (db.data.tickets[s.code] || []).filter(t => t.status !== 'klaar').length;
  if (klussenN) alerts.push({ level: 'info', text: en ? klussenN + ' open job(s) or maintenance.' : klussenN + ' open klus(sen) of onderhoud.' });
  const vuilN = (s.rooms || []).filter(r => r.hk && r.hk.status === 'vuil').length;
  if (vuilN) alerts.push({ level: 'amber', text: en ? vuilN + ' room(s) still to clean.' : vuilN + ' kamer(s) nog schoon te maken.' });
  const volg = { rood: 0, amber: 1, info: 2 };
  alerts.sort((a, b) => volg[a.level] - volg[b.level]);
  const kassaVandaag = kassa.filter(v => dag(v.at) === vandaag).reduce((x, v) => x + (v.total || 0), 0);
  const stats = {
    omzetVandaag: week[6].omzet,
    transactiesVandaag: week[6].aantal,
    kassaVandaag,
    omzetWeek: week.reduce((x, d2) => x + d2.omzet, 0),
    binnenNu: [...new Set((db.data.klok[s.code] || []).filter(e => e.in.slice(0, 10) === vandaag && !e.out).map(e => e.name))].length,
    openActies: alerts.length
  };
  // dagbriefing in gewone taal, altijd uit de echte cijfers
  const eurF = n => '€ ' + Number(n).toLocaleString(en ? 'en-US' : 'nl-NL');
  const zin = [];
  zin.push(en
    ? 'Today ' + s.name + ' processed ' + stats.transactiesVandaag + ' transaction(s) for ' + eurF(stats.omzetVandaag) + ' (of which ' + eurF(kassaVandaag) + ' at the register); this week stands at ' + eurF(stats.omzetWeek) + '.'
    : 'Vandaag verwerkte ' + s.name + ' ' + stats.transactiesVandaag + ' transactie(s), goed voor ' + eurF(stats.omzetVandaag) + ' (waarvan ' + eurF(kassaVandaag) + ' via de kassa); de week staat op ' + eurF(stats.omzetWeek) + '.');
  if (toppers[0]) zin.push(en
    ? 'Best seller: ' + toppers[0].naam + ' (' + toppers[0].aantal + 'x, ' + eurF(toppers[0].omzet) + ').'
    : 'Topper: ' + toppers[0].naam + ' (' + toppers[0].aantal + 'x, ' + eurF(toppers[0].omzet) + ').');
  zin.push(stats.binnenNu
    ? (en ? stats.binnenNu + ' colleague(s) are clocked in right now.' : stats.binnenNu + ' collega(s) zijn nu ingeklokt.')
    : (en ? 'Nobody is clocked in right now.' : 'Er is nu niemand ingeklokt.'));
  const rood = alerts.filter(a => a.level === 'rood').length;
  zin.push(rood
    ? (en ? rood + ' item(s) are stuck; see the action list.' : rood + ' zaak/zaken lopen vast; zie de actielijst.')
    : alerts.length
      ? (en ? 'Nothing is stuck; ' + alerts.length + ' routine item(s) remain.' : 'Niets loopt vast; nog ' + alerts.length + ' routinepunt(en).')
      : (en ? 'Everything is running smoothly.' : 'Alles loopt.'));
  zin.push(en ? 'RTG charges 0% commission: this revenue is fully yours.' : 'RTG rekent 0% commissie: deze omzet is volledig van u.');
  res.json({ stats, week, toppers, alerts: alerts.slice(0, 12), briefing: zin.join(' ') });
});

/* ---- zzp-boekingen: diensten en producten van zelfstandige professionals ----
   Leden boeken met datum en tijd; de zelfstandige bevestigt, levert en rondt
   af. Betalen-eerst geldt hier net zo (tenzij de zaak achteraf kiest). */
const BOEK_KETEN = ['aangevraagd', 'bevestigd', 'afgerond'];

app.post('/api/booking/request', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.supplierCode);
  const caps = s ? ((db.data.supplierTypes[s.type] || {}).caps || []) : [];
  if (!s || !caps.includes('services')) return res.status(404).json({ error: 'Geen zelfstandige professional gevonden.' });
  if (s.settings && s.settings.ordersOpen === false) return res.status(409).json({ error: s.name + ' neemt op dit moment geen boekingen aan.' });
  const dienst = (s.services || []).find(x => x.id === req.body.serviceId);
  if (!dienst) return res.status(404).json({ error: 'Deze dienst bestaat niet (meer).' });
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  const vooraf = optieAan(s, 'betaalVooraf');
  const d = schoon(req.body.date, 10), u = schoon(req.body.time, 5);
  const wanneer = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d + (/^\d{2}:\d{2}$/.test(u) ? ' ' + u : '') : null;
  const boeking = {
    ref: 'RTG-B-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    supplierCode: s.code, supplierName: s.name,
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    service: { id: dienst.id, name: dienst.name, soort: dienst.soort || 'dienst', duurMin: dienst.duurMin || null },
    price: dienst.price,
    wanneer, note: schoon(req.body.note, 140),
    betaalMoment: vooraf ? 'vooraf' : 'achteraf',
    status: vooraf ? 'wacht-op-betaling' : 'aangevraagd',
    paid: false, at: new Date().toISOString()
  };
  db.data.boekingen.unshift(boeking);
  db.data.boekingen = db.data.boekingen.slice(0, 50000);
  save();
  if (!vooraf) {
    notifySupplier(s.code, { icon: '🗓️', title: 'Nieuwe boeking (betaling achteraf)', body: codename + ': ' + dienst.name + (wanneer ? ' · ' + wanneer : '') + ' · € ' + dienst.price });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
  }
  res.json({ ok: true, boeking });
});

app.post('/api/booking/pay', auth, (req, res) => {
  const b = db.data.boekingen.find(x => x.ref === req.body.ref && (x.customerKey || x.customerTier) === req.session.key);
  if (!b) return res.status(404).json({ error: 'Boeking niet gevonden.' });
  if (b.paid) return res.status(409).json({ error: 'Al betaald.' });
  if (b.status === 'wacht-op-betaling' && Date.now() - new Date(b.at) > 30 * 60000)
    return res.status(410).json({ error: 'Deze aanvraag is verlopen. Boek opnieuw.' });
  b.paid = true;
  b.paidAt = new Date().toISOString();
  if (b.status === 'wacht-op-betaling') b.status = 'aangevraagd';
  save();
  notifySupplier(b.supplierCode, { icon: '🗓️', title: 'Nieuwe boeking (betaald)', body: b.customerCodename + ': ' + b.service.name + (b.wanneer ? ' · ' + b.wanneer : '') + ' · € ' + b.price });
  sseToSupplier(b.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true, boeking: b });
});

app.post('/api/bookings/mine', auth, (req, res) => {
  const mijn = db.data.boekingen.filter(b => (b.customerKey || b.customerTier) === req.session.key);
  res.json({ boekingen: mijn.slice(0, 25), total: mijn.length });
});

// de zelfstandige bevestigt, rondt af of weigert (alleen vooruit in de keten)
app.post('/api/supplier/booking/status', supplierAuth, (req, res) => {
  const b = db.data.boekingen.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!b) return res.status(404).json({ error: 'Boeking niet gevonden.' });
  if (b.status === 'wacht-op-betaling') return res.status(409).json({ error: 'Deze boeking is nog niet betaald.' });
  const status = String(req.body.status || '');
  if (status !== 'geweigerd') {
    if (!BOEK_KETEN.includes(status)) return res.status(400).json({ error: 'Onbekende status.' });
    if (BOEK_KETEN.indexOf(status) <= BOEK_KETEN.indexOf(b.status)) return res.status(409).json({ error: 'Deze boeking is al ' + b.status + '.' });
  } else if (b.status === 'afgerond') {
    return res.status(409).json({ error: 'Deze boeking is al afgerond.' });
  }
  b.status = status;
  if (status === 'afgerond') b.finishedAt = new Date().toISOString();
  save();
  const MELDING = { bevestigd: 'Uw afspraak is bevestigd.', afgerond: 'Dank u wel; uw afspraak is afgerond.', geweigerd: 'Uw aanvraag kon helaas niet worden bevestigd.' };
  notify(b.customerTier, { icon: '🗓️', title: req.supplier.name, body: MELDING[status] + (b.wanneer && status === 'bevestigd' ? ' (' + b.wanneer + ')' : ''), scope: 'orders' });
  sseToCustomer(b.customerKey || b.customerTier, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  logActivity(req.supplier.code, req.actor, 'zette boeking ' + b.ref + ' op "' + status + '"');
  res.json({ ok: true, boeking: b });
});

// dienstenbeheer: de zelfstandige is baas over het eigen aanbod
app.post('/api/supplier/service', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor de eigenaar.' });
  const s = req.supplier;
  s.services = s.services || [];
  const a = String(req.body.action || '');
  if (a === 'add') {
    const name = schoon(req.body.name, 80);
    const price = Math.round(Number(req.body.price) * 100) / 100;
    if (!name || !(price > 0)) return res.status(400).json({ error: 'Geef de dienst een naam en een prijs.' });
    s.services.push({
      id: 'sv' + Date.now().toString(36),
      name, desc: schoon(req.body.desc, 140), price,
      duurMin: Number(req.body.duurMin) > 0 ? Math.round(Number(req.body.duurMin)) : null,
      soort: req.body.soort === 'product' ? 'product' : 'dienst'
    });
  } else if (a === 'remove') {
    s.services = s.services.filter(x => x.id !== req.body.id);
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  save();
  logActivity(s.code, req.actor, 'werkte het aanbod bij');
  sseToSupplier(s.code, 'sync', { scope: 'settings' });
  broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  res.json({ ok: true, services: s.services });
});

/* ---- cadeaukaarten ----
   Kopen via de leden-app (Face ID) of verkopen aan de kassa; innen door de
   zaak op code. Boekhoudkundig correct: de verkoop is nog geen omzet (het
   saldo is een verplichting op de balans), de btw hoort bij de inwisseling. */
const gcCode = () => 'RTG-GC-' + crypto.randomBytes(3).toString('hex').toUpperCase();

app.post('/api/giftcard/buy', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.supplierCode);
  if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
  const bedrag = Math.round(Number(req.body.bedrag));
  if (!(bedrag >= 10 && bedrag <= 5000)) return res.status(400).json({ error: 'Kies een bedrag tussen € 10 en € 5.000.' });
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  const kaart = { code: gcCode(), supplierCode: s.code, supplierName: s.name, bedrag, saldo: bedrag,
    kocht: codename, customerKey: req.session.key, at: new Date().toISOString(), verzilveringen: [] };
  db.data.giftcards.unshift(kaart);
  db.data.giftcards = db.data.giftcards.slice(0, 20000);
  save();
  notifySupplier(s.code, { icon: '🎁', title: 'Cadeaukaart verkocht', body: codename + ' kocht via de app een cadeaukaart van € ' + bedrag + '.' });
  sseToSupplier(s.code, 'sync', { scope: 'pos' });
  res.json({ ok: true, kaart });
});

app.post('/api/giftcards/mine', auth, (req, res) => {
  res.json({ kaarten: (db.data.giftcards || []).filter(g => g.customerKey === req.session.key).slice(0, 20) });
});

app.post('/api/supplier/giftcard/sell', supplierAuth, (req, res) => {
  const bedrag = Math.round(Number(req.body.bedrag));
  if (!(bedrag >= 10 && bedrag <= 5000)) return res.status(400).json({ error: 'Kies een bedrag tussen € 10 en € 5.000.' });
  const kaart = { code: gcCode(), supplierCode: req.supplier.code, supplierName: req.supplier.name, bedrag, saldo: bedrag,
    kocht: req.actor.name + ' (kassa)', customerKey: null, at: new Date().toISOString(), verzilveringen: [] };
  db.data.giftcards.unshift(kaart);
  db.data.giftcards = db.data.giftcards.slice(0, 20000);
  save();
  logActivity(req.supplier.code, req.actor, 'verkocht een cadeaukaart van € ' + bedrag + ' (' + kaart.code + ')');
  res.json({ ok: true, kaart });
});

app.post('/api/supplier/giftcard/redeem', supplierAuth, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const g = (db.data.giftcards || []).find(x => x.code === code && x.supplierCode === req.supplier.code);
  if (!g) return res.status(404).json({ error: 'Deze cadeaukaart kennen we hier niet.' });
  const bedrag = Math.round(Number(req.body.bedrag) * 100) / 100;
  if (!(bedrag > 0)) return res.status(400).json({ error: 'Geen geldig bedrag.' });
  if (bedrag > g.saldo) return res.status(409).json({ error: 'Onvoldoende saldo: er staat nog € ' + g.saldo + ' op deze kaart.' });
  g.saldo = Math.round((g.saldo - bedrag) * 100) / 100;
  g.verzilveringen = g.verzilveringen || [];
  g.verzilveringen.push({ bedrag, at: new Date().toISOString(), actor: req.actor.name });
  save();
  logActivity(req.supplier.code, req.actor, 'inde € ' + bedrag + ' van cadeaukaart ' + g.code + ' (rest € ' + g.saldo + ')');
  res.json({ ok: true, saldo: g.saldo, kaart: { code: g.code, saldo: g.saldo } });
});

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
      'Indicatie minimumuurloon in ' + L.naam + ': € ' + L.uurloonMin + ' per uur. Reken bovenop het brutoloon ~' + Math.round(L.lasten * 100) + '% werkgeverslasten' + (L.vakantiegeld ? ' en ' + Math.round(L.vakantiegeld * 1000) / 10 + '% vakantiegeld' : '') + '.'
    ]
  };
}

app.post('/api/supplier/finance', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  res.json(financeVoor(req.supplier));
});

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

app.post('/api/supplier/accountant', supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const vraag = String(req.body.question || '').trim().slice(0, 400);
  if (!vraag) return res.status(400).json({ error: 'Stel een vraag.' });
  const fin = financeVoor(req.supplier);
  const L = LANDEN[fin.land];
  let answer = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 500,
        system: 'Je bent de AI-boekhouder van RTG voor ' + req.supplier.name + ' (' + req.supplier.type + ') in ' + L.naam + '. ' +
          'Regels: ' + fin.regels.join(' ') + ' Zakelijke aftrek: ' + Object.values(L.zakelijk).join(' ') + ' ' +
          'Cijfers deze maand: btw ' + JSON.stringify(fin.btw) + ', af te dragen € ' + fin.btwTotaal + '; personeel ' + JSON.stringify(fin.personeel) + '; cadeaukaarten ' + JSON.stringify(fin.giftcards) + '. ' +
          'Antwoord in het Nederlands, maximaal 130 woorden, praktisch en concreet. Sluit af met: dit is voorlichting, geen bindend fiscaal advies.',
        messages: [{ role: 'user', content: vraag }]
      });
      answer = msg.content[0].text;
    } catch (err) { answer = null; }
  }
  if (!answer) answer = cannedBoekhouder(vraag, fin, L);
  res.json({ answer, land: fin.land, ai: !!anthropic });
});

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

app.post('/api/member/zzp', auth, (req, res) => {
  if (req.session.tier !== 'business') return res.status(403).json({ error: 'De zzp-belastingtool is onderdeel van de Business Pass.' });
  const landCode = ZZP[req.body.land] ? req.body.land : 'NL';
  const Z = ZZP[landCode];
  const winst = Math.max(0, Math.min(5000000, Math.round(Number(req.body.winst) || 0)));
  if (!winst) return res.status(400).json({ error: 'Vul uw verwachte jaarwinst in.' });
  const out = { land: landCode, landNaam: LANDEN[landCode].naam, regime: Z.regime, winst, posten: [], regels: Z.regels.slice(), indicatie: true };
  let belasting = 0, belastbaar = winst;
  if (landCode === 'NL') {
    const uren = req.body.urencriterium !== false;
    const za = uren ? Math.min(Z.zelfstandigenaftrek, winst) : 0;
    const sa = uren && req.body.starter ? Z.startersaftrek : 0;
    const rest = Math.max(0, winst - za - sa);
    const mkb = centen(rest * Z.mkbVrijstelling);
    belastbaar = centen(rest - mkb);
    out.posten.push(za ? { label: 'Zelfstandigenaftrek', bedrag: -za }
                       : { label: 'Zelfstandigenaftrek (urencriterium niet gehaald)', bedrag: 0 });
    if (sa) out.posten.push({ label: 'Startersaftrek', bedrag: -sa });
    out.posten.push({ label: 'MKB-winstvrijstelling (12,7%)', bedrag: -mkb });
    let vorige = 0, ib = 0;
    for (const [grens, tarief] of Z.schijven) {
      const deel = Math.max(0, Math.min(belastbaar, grens) - vorige);
      ib += deel * tarief;
      vorige = grens;
      if (belastbaar <= grens) break;
    }
    const ahk = Math.max(0, Z.ahk.max - Math.max(0, belastbaar - Z.ahk.afbouwVanaf) * Z.ahk.afbouw);
    const ak = Math.max(0, Z.arbeidskorting.max - Math.max(0, belastbaar - Z.arbeidskorting.afbouwVanaf) * Z.arbeidskorting.afbouw);
    const korting = Math.min(ib, ahk + ak);
    belasting = Math.max(0, centen(ib - korting));
    out.posten.push({ label: 'Inkomstenbelasting (schijven)', bedrag: centen(ib) });
    out.posten.push({ label: 'Heffingskortingen (indicatie)', bedrag: -centen(korting) });
    if (winst < Z.korGrens) out.regels.unshift('Met deze omzet komt u waarschijnlijk in aanmerking voor de KOR (btw-vrijstelling): minder administratie, geen btw-aangifte.');
  } else {
    belasting = centen(winst * Z.simpel);
    out.posten.push({ label: 'Indicatieve heffing (~' + Math.round(Z.simpel * 100) + '% effectief, incl. sociale lasten)', bedrag: belasting });
  }
  out.belastbaar = centen(belastbaar);
  out.belasting = belasting;
  out.netto = centen(winst - belasting);
  out.reserveerPct = Math.max(20, Math.min(50, Math.round(belasting / winst * 100) + 5));
  out.perMaand = centen(belasting / 12);
  res.json(out);
});

// AI-boekhouder voor het Business Pass-lid: wat is per land terug te vorderen
app.post('/api/member/accountant', auth, async (req, res) => {
  if (req.session.tier !== 'business') return res.status(403).json({ error: 'De AI-boekhouder is onderdeel van de Business Pass.' });
  const landCode = LANDEN[req.body.land] ? req.body.land : 'NL';
  const L = LANDEN[landCode];
  const vraag = String(req.body.question || '').trim().slice(0, 400);
  if (!vraag) return res.status(400).json({ error: 'Stel een vraag.' });
  const key = req.session.key;
  const horeca = db.data.orders.filter(o => (o.customerKey || o.customerTier) === key && o.paid).reduce((x, o) => x + o.total, 0);
  const vervoer = db.data.rides.filter(r => (r.customerKey || r.customerTier) === key && r.paid).reduce((x, r) => x + (r.quote || 0), 0);
  let answer = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 450,
        system: 'Je bent de AI-boekhouder van de RTG Business Pass. Het lid reist zakelijk; het gekozen land is ' + L.naam + '. ' +
          'Aftrekregels daar: horeca: ' + L.zakelijk.horeca + ' logies: ' + L.zakelijk.logies + ' vervoer: ' + L.zakelijk.vervoer + ' jet: ' + L.zakelijk.jet + ' ' +
          'Voor zelfstandigen geldt daar het regime ' + ZZP[landCode].regime + ': ' + ZZP[landCode].regels.join(' ') + ' Er is een zzp-rekentool in de app voor een indicatie van belasting en nettowinst. ' +
          'Uitgaven via RTG: horeca € ' + horeca + ', vervoer € ' + vervoer + '. Facturen staan boekhoudklaar in het portaal met afboekcode en btw-specificatie. ' +
          'Antwoord in het Nederlands, maximaal 120 woorden, praktisch. Sluit af met: dit is voorlichting, geen bindend fiscaal advies.',
        messages: [{ role: 'user', content: vraag }]
      });
      answer = msg.content[0].text;
    } catch (err) { answer = null; }
  }
  if (!answer) {
    const v = vraag.toLowerCase();
    if (/zzp|zelfstandig|eenmanszaak|freelan|kor\b|urencriterium|autonomo|micro-?entre|freiberuf/.test(v))
      answer = 'Voor zelfstandigen in ' + L.naam + ' (' + ZZP[landCode].regime + '): ' + ZZP[landCode].regels.join(' ') + ' Gebruik de zzp-rekentool hieronder voor een indicatie van uw belasting, nettowinst en hoeveel u maandelijks opzij zet.';
    else if (/hotel|overnacht|logies|slapen/.test(v)) answer = L.naam + ': ' + L.zakelijk.logies;
    else if (/taxi|vervoer|rit|jet|vlieg/.test(v)) answer = L.naam + ': ' + L.zakelijk.vervoer + ' ' + L.zakelijk.jet + ' Via RTG gaf u € ' + vervoer + ' uit aan vervoer.';
    else if (/eten|diner|restaurant|horeca|lunch|terugvorder|aftrek|btw/.test(v)) answer = L.naam + ': ' + L.zakelijk.horeca + ' Via RTG gaf u € ' + horeca + ' uit in de horeca. Uw facturen staan boekhoudklaar in het portaal, met afboekcode en btw-specificatie.';
    else answer = 'Voor ' + L.naam + ' geldt: ' + L.zakelijk.horeca + ' ' + L.zakelijk.logies + ' ' + L.zakelijk.vervoer + ' Vraag me gerust naar een specifieke uitgave.';
    answer += ' Dit is voorlichting, geen bindend fiscaal advies.';
  }
  res.json({ answer, land: landCode, landen: Object.entries(LANDEN).map(([k, v2]) => ({ code: k, naam: v2.naam })), ai: !!anthropic });
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
    cat: schoon(m.cat || 'Overig', 40),
    name: schoon(m.name, 80),
    desc: schoon(m.desc, 200),
    price: Math.max(0, Number(m.price) || 0),
    allergens: Array.isArray(m.allergens) ? m.allergens.slice(0, 12).map(a => String(a).slice(0, 20)) : [],
    station: m.station === 'bar' ? 'bar' : 'keuken',
    sectie: ['warm', 'koud', 'snack', 'dessert'].includes(m.sectie) ? m.sectie : 'warm',
    recept: String(m.recept || '').slice(0, 1500)
  }));
  save();
  logActivity(req.supplier.code, req.actor, 'werkte de menukaart bij');
  res.json({ ok: true, menu: req.supplier.menu });
});

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
app.post('/api/supplier/order/table', supplierAuth, (req, res) => {
  const o = db.data.orders.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  o.table = String(req.body.table || '').slice(0, 24);
  save();
  logActivity(req.supplier.code, req.actor, 'zette ' + o.ref + ' op ' + (o.table || 'geen tafel'));
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  res.json({ ok: true, order: o });
});

// keukensectie (warme kant, koude kant, snacks, dessert) meldt bezig of klaar
app.post('/api/supplier/order/sectie', supplierAuth, (req, res) => {
  const o = db.data.orders.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  const sectie = String(req.body.sectie || '');
  if (!['warm', 'koud', 'snack', 'dessert'].includes(sectie)) return res.status(400).json({ error: 'Onbekende sectie.' });
  const phase = req.body.phase === 'klaar' ? 'klaar' : 'bezig';
  o.secties = o.secties || {};
  o.secties[sectie] = phase;
  if (o.status === 'nieuw') o.status = 'in bereiding';
  const nodig = sectiesForOrder(req.supplier, o);
  const wasKlaar = o.status === 'klaar';
  if (nodig.length && nodig.every(x => o.secties[x] === 'klaar')) {
    o.stations = o.stations || {};
    o.stations.keuken = 'klaar';                            // de hele keuken is klaar
    const stNodig = stationsForOrder(req.supplier, o);
    if (stNodig.every(st => o.stations[st] === 'klaar')) o.status = 'klaar';
  }
  save();
  broadcastSync([o.customerTier], 'orders');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  if (o.status === 'klaar' && !wasKlaar)
    notify(o.customerTier, { icon: '\u2705', title: req.supplier.name, body: 'Uw bestelling is klaar. Ophaalcode: ' + o.pickup + '.', scope: 'orders' });
  logActivity(req.supplier.code, req.actor, sectie + ': ' + o.ref + ' ' + (phase === 'klaar' ? 'klaar' : 'in bereiding'));
  res.json({ ok: true, order: o });
});

// ---- werkplekken: keuken- en barscherm melden hun deel bezig of klaar ----
app.post('/api/supplier/order/station', supplierAuth, (req, res) => {
  const o = db.data.orders.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  const station = req.body.station === 'bar' ? 'bar' : 'keuken';
  const phase = req.body.phase === 'klaar' ? 'klaar' : 'bezig';
  o.stations = o.stations || {};
  o.stations[station] = phase;
  if (o.status === 'nieuw') o.status = 'in bereiding';
  const needed = stationsForOrder(req.supplier, o);
  const wasKlaar = o.status === 'klaar';
  if (needed.every(st => o.stations[st] === 'klaar')) o.status = 'klaar';
  save();
  broadcastSync([o.customerTier], 'orders');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  if (o.status === 'klaar' && !wasKlaar)
    notify(o.customerTier, { icon: '\u2705', title: req.supplier.name, body: 'Uw bestelling is klaar. Ophaalcode: ' + o.pickup + '.', scope: 'orders' });
  logActivity(req.supplier.code, req.actor, (station === 'bar' ? 'bar' : 'keuken') + ': ' + o.ref + ' ' + (phase === 'klaar' ? 'klaar' : 'in bereiding'));
  res.json({ ok: true, order: o });
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
app.post('/api/supplier/ride/status', supplierAuth, (req, res) => {
  const r = db.data.rides.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!r) return res.status(404).json({ error: 'Rit niet gevonden.' });
  if (r.status === 'wacht-op-betaling') return res.status(409).json({ error: 'Deze rit is nog niet betaald.' });
  let status = String(req.body.status || '');
  if (RIT_LEGACY[status]) status = RIT_LEGACY[status];
  if (status !== 'geweigerd') {
    if (!RIT_KETEN.includes(status)) return res.status(400).json({ error: 'Onbekende status.' });
    // de keten mag alleen vooruit (overslaan mag, teruggaan niet)
    const nu = RIT_KETEN.indexOf(RIT_LEGACY[r.status] || r.status);
    const straks = RIT_KETEN.indexOf(status);
    if (straks <= nu) return res.status(409).json({ error: 'Deze rit is al ' + r.status + '.' });
  } else if (['aan-boord', 'afgerond'].includes(RIT_LEGACY[r.status] || r.status)) {
    return res.status(409).json({ error: 'Een lopende of afgeronde rit kan niet meer geweigerd worden.' });
  }
  ritVerder(req, res, r, status);
});

/* Slimme toewijzing: de eerste vrije chauffeur en een passend, vrij voertuig. */
function ritBezetting(code) {
  const actief = db.data.rides.filter(r => r.supplierCode === code && ['geaccepteerd', 'onderweg', 'aangekomen', 'aan-boord'].includes(RIT_LEGACY[r.status] || r.status));
  return {
    drukkeChauffeurs: new Set(actief.filter(r => r.driver).map(r => r.driver.staffId)),
    bezetteVoertuigen: new Set(actief.filter(r => r.vehicle).map(r => r.vehicle.id))
  };
}
app.post('/api/supplier/ride/suggest', supplierAuth, (req, res) => {
  const r = db.data.rides.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!r) return res.status(404).json({ error: 'Rit niet gevonden.' });
  const { drukkeChauffeurs, bezetteVoertuigen } = ritBezetting(req.supplier.code);
  const staff = accounts.listStaff(req.supplier.code);
  const rijders = staff.filter(m => /chauffeur|piloot|pilot|crew|centrale|operations/i.test(m.func || ''));
  const pool = rijders.length ? rijders : staff;
  const chauffeur = pool.find(m => !drukkeChauffeurs.has(m.id)) || null;
  const voertuig = (req.supplier.fleet || []).find(v => v.active && v.seats >= (r.passengers || 1) && !bezetteVoertuigen.has(v.id))
    || (req.supplier.fleet || []).find(v => v.active && !bezetteVoertuigen.has(v.id)) || null;
  res.json({ ok: true,
    staffId: chauffeur ? chauffeur.id : null, staffName: chauffeur ? chauffeur.name : null,
    vehicleId: voertuig ? voertuig.id : null, vehicleName: voertuig ? voertuig.name : null });
});

/* Toewijzen: het kantoor wijst toe, of een chauffeur neemt de rit zelf. */
app.post('/api/supplier/ride/assign', supplierAuth, (req, res) => {
  const r = db.data.rides.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!r) return res.status(404).json({ error: 'Rit niet gevonden.' });
  if (r.status === 'wacht-op-betaling') return res.status(409).json({ error: 'Deze rit is nog niet betaald.' });
  if (['afgerond', 'geweigerd'].includes(RIT_LEGACY[r.status] || r.status)) return res.status(409).json({ error: 'Deze rit is al afgerond.' });
  const staff = accounts.listStaff(req.supplier.code);
  const wilZelf = req.body.self === true;
  const staffId = wilZelf ? req.actor.staffId : Number(req.body.staffId);
  const m = staff.find(x => x.id === staffId);
  if (!m) return res.status(404).json({ error: 'Deze medewerker kennen we niet.' });
  if (!wilZelf && !req.actor.manager && req.actor.staffId !== staffId)
    return res.status(403).json({ error: 'Alleen een manager wijst ritten aan anderen toe.' });
  const v = (req.supplier.fleet || []).find(x => x.id === String(req.body.vehicleId || '')) || null;
  r.driver = { staffId: m.id, name: m.name };
  r.vehicle = v ? { id: v.id, name: v.name, plate: v.plate, seats: v.seats } : null;
  if ((RIT_LEGACY[r.status] || r.status) === 'aangevraagd') r.status = 'geaccepteerd';
  save();
  broadcastSync([r.customerTier], 'orders');
  sseToCustomer(r.customerKey || r.customerTier, 'sync', { scope: 'live' });
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  notify(r.customerTier, { icon: r.type === 'jet' ? '✈️' : '🚗', title: req.supplier.name,
    body: m.name.split(' ')[0] + ' komt u halen' + (v ? ' in de ' + v.name + ' (' + v.plate + ')' : '') + '.', scope: 'orders' });
  logActivity(req.supplier.code, req.actor, 'wees rit ' + r.ref + ' toe aan ' + m.name + (v ? ' met ' + v.name : ''));
  res.json({ ok: true, ride: r });
});

/* Vlootbeheer (kantoor, alleen management) */
// Ritgeschiedenis, schaalvast: gepagineerd en doorzoekbaar, met het omzettotaal
// over de volledige historie (dus ook wat niet op deze pagina staat).
app.post('/api/supplier/ride/history', supplierAuth, (req, res) => {
  const q = String(req.body.q || '').trim().toLowerCase().slice(0, 60);
  const alle = db.data.rides
    .filter(r => r.supplierCode === req.supplier.code && (r.status === 'afgerond' || r.status === 'gearriveerd'))
    .filter(r => !q || [r.customerCodename, r.ref, r.from, r.to, r.driver && r.driver.name, r.vehicle && r.vehicle.name].join(' ').toLowerCase().includes(q))
    .sort((a, b) => String(b.finishedAt || b.at).localeCompare(String(a.finishedAt || a.at)));
  const per = 25;
  const pages = Math.max(1, Math.ceil(alle.length / per));
  const page = Math.min(pages, Math.max(1, Number(req.body.page) || 1));
  res.json({
    items: alle.slice((page - 1) * per, page * per),
    total: alle.length, page, pages,
    omzet: alle.reduce((s2, r) => s2 + (r.quote || 0), 0)
  });
});

// Volledige ritgeschiedenis als CSV, op de server opgebouwd zodat de export
// compleet is hoe groot de historie ook wordt (token via query voor de download).
app.get('/api/supplier/rides.csv', (req, res) => {
  const sess = sessionFor(String(req.query.token || ''));
  if (!sess || sess.role !== 'supplier') return res.status(401).end();
  const alle = db.data.rides
    .filter(r => r.supplierCode === sess.code && (r.status === 'afgerond' || r.status === 'gearriveerd'))
    .sort((a, b) => String(b.finishedAt || b.at).localeCompare(String(a.finishedAt || a.at)));
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ritten-' + sess.code.toLowerCase() + '-' + new Date().toISOString().slice(0, 10) + '.csv"');
  res.write('\uFEFF' + ['datum', 'referentie', 'gast', 'van', 'naar', 'km', 'personen', 'prijs', 'chauffeur', 'voertuig'].join(';') + '\n');
  for (const r of alle) {
    res.write([
      String(r.finishedAt || r.at).slice(0, 16).replace('T', ' '), r.ref, r.customerCodename,
      r.from || '', r.to || '', r.km || '', r.passengers || 1,
      (r.quote || 0).toFixed(2).replace('.', ','),
      r.driver ? r.driver.name : '', r.vehicle ? r.vehicle.name : ''
    ].map(esc).join(';') + '\n');
  }
  res.end();
});

app.post('/api/supplier/fleet', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const s = req.supplier;
  s.fleet = s.fleet || [];
  const a = String(req.body.action || '');
  if (a === 'add') {
    const name = schoon(req.body.name, 50), plate = schoon(req.body.plate, 16);
    if (!name) return res.status(400).json({ error: 'Geef het voertuig een naam.' });
    s.fleet.push({ id: 'v' + Date.now().toString(36), name, plate, seats: Math.min(20, Math.max(1, Number(req.body.seats) || 4)), active: true });
  } else if (a === 'remove') {
    s.fleet = s.fleet.filter(v => v.id !== req.body.id);
  } else if (a === 'toggle') {
    const v = s.fleet.find(x => x.id === req.body.id);
    if (v) v.active = !v.active;
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  save();
  sseToSupplier(s.code, 'sync', { scope: 'settings' });
  logActivity(s.code, req.actor, 'werkte de vloot bij');
  res.json({ ok: true, fleet: s.fleet });
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
  // de zaak kiest het betaalmoment: vooraf (standaard, pas zichtbaar na
  // afrekenen) of achteraf (direct zichtbaar, betalen via de app volgt)
  const vooraf = optieAan(s, 'betaalVooraf');
  const order = {
    ref: 'RTG-O-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    pickup: pickupCode(),
    supplierCode: s.code, supplierName: s.name, type: s.type,
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    items, total,
    table: schoon(req.body.table, 24),
    allergyNote: schoon(req.body.allergyNote, 200),
    tagSalon: !!req.body.tagSalon,
    betaalMoment: vooraf ? 'vooraf' : 'achteraf',
    status: vooraf ? 'wacht-op-betaling' : 'nieuw', paid: false, at: new Date().toISOString()
  };
  db.data.orders.unshift(order);
  save();
  if (!vooraf) {
    notifySupplier(s.code, { icon: '\u{1F6CE}️', title: 'Nieuwe bestelling (betaling achteraf)', body: codename + ', ' + items.reduce((n, i) => n + i.qty, 0) + ' item(s), € ' + total + (order.allergyNote ? ' · allergie: ' + order.allergyNote : '') });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
  }
  res.json({ ok: true, order });
});

// bestelling betalen (Face ID op het toestel)
app.post('/api/order/pay', auth, (req, res) => {
  const o = db.data.orders.find(x => x.ref === req.body.ref && (x.customerKey || x.customerTier) === req.session.key);
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  if (o.paid) return res.status(409).json({ error: 'Al betaald.' });
  // de verloopgrens geldt alleen voor vooraf betalen; achteraf mag later
  if (o.status === 'wacht-op-betaling' && Date.now() - new Date(o.at) > 30 * 60000) return res.status(410).json({ error: 'Deze bestelling is verlopen. Plaats hem opnieuw.' });
  o.paid = true;
  o.paidAt = new Date().toISOString();
  if (o.status === 'wacht-op-betaling') o.status = 'nieuw';
  save();
  // nu pas hoort de zaak ervan: betaald = definitief
  notifySupplier(o.supplierCode, { icon: '\u{1F6CE}\uFE0F', title: 'Nieuwe bestelling (betaald)', body: o.customerCodename + ', ' + o.items.reduce((n, i) => n + i.qty, 0) + ' item(s), \u20AC ' + o.total + (o.allergyNote ? ' \u00B7 allergie: ' + o.allergyNote : '') });
  sseToSupplier(o.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true, order: o });
});

app.post('/api/orders/mine', auth, (req, res) => {
  // schaalvast: de laatste 25 bestellingen plus het eerlijke totaal
  const mijn = db.data.orders.filter(o => (o.customerKey || o.customerTier) === req.session.key);
  res.json({ orders: mijn.slice(0, 25), total: mijn.length });
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
  if (!optieAan(s, 'ritten')) return res.status(409).json({ error: s.name + ' neemt op dit moment geen ritaanvragen aan.' });
  const dest = req.body.toCode ? findSupplier(req.body.toCode) : null;
  const codename = liveCodename(req.session);
  // slimme offerte: afstand uit de live-locatie en de bestemming, anders een
  // realistisch stadsgemiddelde; prijs volgt het tarief van de vervoerder
  const pax = Math.min(9, Math.max(1, Number(req.body.passengers) || 1));
  const koffers = Math.min(9, Math.max(0, Number(req.body.luggage) || 0));
  const L = db.data.live[req.session.key];
  const van = (L && Number.isFinite(L.lat)) ? { lat: L.lat, lng: L.lng } : (s.loc || null);
  const naar = dest && dest.loc ? dest.loc : null;
  let km = s.type === 'jet' ? 350 : 9;
  const meters = haversine(van, naar);
  if (meters != null && meters > 200) km = Math.max(1, meters / 1000);
  const t = (s.settings && s.settings.tarief) || {};
  const quote = Math.round(Math.max(t.minimum || 0, (t.start || 0) + (t.perKm || 2.5) * km));
  const ride = {
    ref: 'RTG-R-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    supplierCode: s.code, supplierName: s.name, type: s.type,
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    from: schoon(req.body.from || 'Huidige locatie', 80),
    to: schoon(req.body.to || (dest && dest.name) || '', 80),
    toCode: dest ? dest.code : null,
    when: schoon(req.body.when || 'Zo snel mogelijk', 40),
    // vooruit plannen: datum en tijd geven een geplande rit (taxi en jet)
    plannedFor: (() => {
      const d = schoon(req.body.date, 10), u = schoon(req.body.time, 5);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
      const iso = d + 'T' + (/^\d{2}:\d{2}$/.test(u) ? u : '12:00') + ':00';
      return isNaN(new Date(iso)) ? null : iso;
    })(),
    passengers: pax, luggage: koffers, note: schoon(req.body.note, 140),
    km: Math.round(km * 10) / 10, quote,
    driver: null, vehicle: null,
    // de vervoerder kiest het betaalmoment: vooraf (standaard) of achteraf
    betaalMoment: optieAan(s, 'betaalVooraf') ? 'vooraf' : 'achteraf',
    status: optieAan(s, 'betaalVooraf') && quote > 0 ? 'wacht-op-betaling' : 'aangevraagd',
    paid: quote === 0, at: new Date().toISOString()
  };
  if (ride.plannedFor) ride.when = 'Gepland: ' + ride.plannedFor.slice(0, 16).replace('T', ' ');
  db.data.rides.unshift(ride);
  save();
  if (ride.status === 'aangevraagd') {
    notifySupplier(s.code, { icon: '\u{1F697}', title: 'Nieuwe ritaanvraag', body: codename + ': ' + ride.from + ' naar ' + (ride.to || 'bestemming') + ' \u00B7 ' + pax + 'p \u00B7 \u20AC ' + quote });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
  }
  pushLive(req.session.key);
  res.json({ ok: true, ride });
});

// rit betalen: hiermee wordt hij definitief en gaat hij naar de vervoerder
app.post('/api/ride/pay', auth, (req, res) => {
  const r = db.data.rides.find(x => x.ref === req.body.ref && (x.customerKey || x.customerTier) === req.session.key);
  if (!r) return res.status(404).json({ error: 'Rit niet gevonden.' });
  if (r.paid) return res.status(409).json({ error: 'Al betaald.' });
  // de verloopgrens geldt alleen voor vooraf betalen; achteraf mag later
  if (r.status === 'wacht-op-betaling' && Date.now() - new Date(r.at) > 30 * 60000) return res.status(410).json({ error: 'Deze aanvraag is verlopen. Vraag de rit opnieuw aan.' });
  r.paid = true;
  r.paidAt = new Date().toISOString();
  if (r.status === 'wacht-op-betaling') r.status = 'aangevraagd';
  save();
  notifySupplier(r.supplierCode, { icon: r.type === 'jet' ? '\u2708\uFE0F' : '\u{1F697}', title: 'Nieuwe ritaanvraag (betaald)', body: r.customerCodename + ': ' + r.from + ' naar ' + (r.to || 'bestemming') + ' \u00B7 ' + r.passengers + 'p \u00B7 \u20AC ' + r.quote + (r.plannedFor ? ' \u00B7 ' + r.when : '') });
  sseToSupplier(r.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  pushLive(req.session.key);
  res.json({ ok: true, ride: r });
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
app.post('/api/office/timeline', officeAuth, (req, res) => {
  const q = String(req.body.q || '').trim().toLowerCase().slice(0, 60);
  const past = tekst => !q || tekst.toLowerCase().includes(q);
  const alles = db.data.orders
    .filter(o => o.status !== 'wacht-op-betaling' && past([o.supplierName, o.customerCodename, o.ref, o.status].join(' ')))
    .map(o => ({ soort: 'order', at: o.at, ref: o.ref, supplierName: o.supplierName, customerCodename: o.customerCodename,
      status: o.status, paid: !!o.paid, bedrag: o.total || 0, sub: o.items.reduce((n, i) => n + i.qty, 0) + ' item(s)' }))
    .concat(db.data.rides
      .filter(r => r.status !== 'wacht-op-betaling' && past([r.supplierName, r.customerCodename, r.ref, r.from, r.to, r.status].join(' ')))
      .map(r => ({ soort: r.type === 'jet' ? 'jet' : 'taxi', at: r.at, ref: r.ref, supplierName: r.supplierName, customerCodename: r.customerCodename,
        status: r.status, paid: !!r.paid, bedrag: r.quote || 0, sub: (r.from || '') + ' → ' + (r.to || '?'), when: r.plannedFor ? r.when : null })))
    .concat(db.data.boekingen
      .filter(b => b.status !== 'wacht-op-betaling' && past([b.supplierName, b.customerCodename, b.ref, b.service.name, b.status].join(' ')))
      .map(b => ({ soort: 'dienst', at: b.at, ref: b.ref, supplierName: b.supplierName, customerCodename: b.customerCodename,
        status: b.status, paid: !!b.paid, bedrag: b.price || 0, sub: b.service.name, when: b.wanneer || null })));
  alles.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const per = 25;
  const pages = Math.max(1, Math.ceil(alles.length / per));
  const page = Math.min(pages, Math.max(1, Number(req.body.page) || 1));
  res.json({ items: alles.slice((page - 1) * per, page * per), total: alles.length, page, pages });
});

// Volledige export voor de boekhouding, op de server opgebouwd.
app.get('/api/office/export.csv', (req, res) => {
  const sess = sessionFor(String(req.query.token || ''));
  if (!sess || sess.role !== 'office') return res.status(401).end();
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="rtg-backoffice-' + new Date().toISOString().slice(0, 10) + '.csv"');
  res.write('\uFEFF' + ['datum', 'soort', 'partner', 'gast', 'omschrijving', 'status', 'betaald', 'bedrag'].join(';') + '\n');
  for (const o of db.data.orders) {
    if (o.status === 'wacht-op-betaling') continue;
    res.write([String(o.at).slice(0, 16).replace('T', ' '), 'bestelling', o.supplierName, o.customerCodename,
      o.items.map(i => i.qty + 'x ' + i.name).join(', '), o.status, o.paid ? 'ja' : 'nee',
      (o.total || 0).toFixed(2).replace('.', ',')].map(esc).join(';') + '\n');
  }
  for (const r of db.data.rides) {
    if (r.status === 'wacht-op-betaling') continue;
    res.write([String(r.at).slice(0, 16).replace('T', ' '), r.type === 'jet' ? 'jetrit' : 'taxirit', r.supplierName, r.customerCodename,
      (r.from || '') + ' naar ' + (r.to || '?'), r.status, r.paid ? 'ja' : 'nee',
      (r.quote || 0).toFixed(2).replace('.', ',')].map(esc).join(';') + '\n');
  }
  for (const b of db.data.boekingen) {
    if (b.status === 'wacht-op-betaling') continue;
    res.write([String(b.at).slice(0, 16).replace('T', ' '), 'boeking', b.supplierName, b.customerCodename,
      b.service.name + (b.wanneer ? ' (' + b.wanneer + ')' : ''), b.status, b.paid ? 'ja' : 'nee',
      (b.price || 0).toFixed(2).replace('.', ',')].map(esc).join(';') + '\n');
  }
  res.end();
});

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

// Backoffice port een partner: een vriendelijke herinnering bij een blijven-liggen
// bestelling of rit. Maximaal een keer per tien minuten per regel.
app.post('/api/office/nudge', officeAuth, (req, res) => {
  const kind = req.body.kind === 'ride' ? 'ride' : 'order';
  const lijst = kind === 'ride' ? db.data.rides : db.data.orders;
  const x = lijst.find(i => i.ref === req.body.ref);
  if (!x) return res.status(404).json({ error: 'Niet gevonden.' });
  if (x.nudgedAt && Date.now() - new Date(x.nudgedAt) < 10 * 60000)
    return res.status(409).json({ error: 'Er is net al een herinnering gestuurd. Geef de zaak even de tijd.' });
  x.nudgedAt = new Date().toISOString();
  save();
  notifySupplier(x.supplierCode, { icon: '⏰', title: 'Herinnering van RTG',
    body: (kind === 'ride' ? 'Rit ' : 'Bestelling ') + x.ref + ' van ' + x.customerCodename + ' wacht nog op actie. Kunt u er even naar kijken?' });
  sseToSupplier(x.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true });
});

// Dagbriefing: een leesbare samenvatting van de dag, opgebouwd uit de echte
// cijfers (geen AI-sleutel nodig, dus altijd beschikbaar en altijd juist).
app.post('/api/office/briefing', officeAuth, (req, res) => {
  const en = req.body.lang === 'en';
  const st = officeState();
  const s = st.stats;
  const eurF = n => '€ ' + Number(n).toLocaleString(en ? 'en-US' : 'nl-NL');
  const zinnen = [];
  zinnen.push(en
    ? 'Today the partners processed ' + s.aantalVandaag + ' paid order(s) and ride(s) for ' + eurF(s.omzetVandaag) + ' in net revenue; this week stands at ' + eurF(s.omzetWeek) + '.'
    : 'Vandaag verwerkten de partners ' + s.aantalVandaag + ' betaalde bestelling(en) en rit(ten), goed voor ' + eurF(s.omzetVandaag) + ' nettomzet; de week staat op ' + eurF(s.omzetWeek) + '.');
  const top = (st.performance || []).find(p => p.omzet > 0);
  if (top) zinnen.push(en
    ? 'Best performing partner: ' + top.name + ' (' + eurF(top.omzet) + ', ' + top.aantal + ' transaction(s)).'
    : 'Best presterende partner: ' + top.name + ' (' + eurF(top.omzet) + ', ' + top.aantal + ' transactie(s)).');
  zinnen.push(en
    ? (s.liveNu ? s.liveNu + ' member(s) are on the move right now.' : 'No members are on the move at the moment.')
    : (s.liveNu ? s.liveNu + ' lid/leden zijn nu onderweg.' : 'Er is nu niemand onderweg.'));
  const rood = (st.alerts || []).filter(a => a.level === 'rood').length;
  const rest = (st.alerts || []).length - rood;
  if (rood) zinnen.push(en
    ? rood + ' item(s) are stuck and need immediate attention; see the action centre.'
    : rood + ' zaak/zaken lopen vast en vragen nu aandacht; zie het actiecentrum.');
  else if (rest) zinnen.push(en
    ? 'Nothing is stuck; ' + rest + ' routine item(s) are waiting in the action centre.'
    : 'Niets loopt vast; er wachten nog ' + rest + ' routinepunt(en) in het actiecentrum.');
  else zinnen.push(en ? 'The action centre is empty: everything is running smoothly.' : 'Het actiecentrum is leeg: alles loopt.');
  zinnen.push(en
    ? 'The RTFoundation received ' + eurF(s.foundation) + ' so far (30% of paid member contributions).'
    : 'De RTFoundation ontving tot nu toe ' + eurF(s.foundation) + ' (30% van de betaalde ledenbijdragen).');
  res.json({ briefing: zinnen.join(' ') });
});

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
  if (!db.writable) return; // standby-servers maken geen backups, dat doet de actieve
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
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
});
