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
  KIKUNOI: [['Yuki Tanaka', 'manager'], ['Kenji Mori', 'staff']],
  PONTO: [['Aiko Sato', 'manager'], ['Ren Kimura', 'staff']],
  HOSHI: [['Haruki Ito', 'manager'], ['Mei Kobayashi', 'staff']],
  MKKX: [['Daisuke Yamamoto', 'manager']],
  JETAG: [['Sophie Bakker', 'manager']]
};
for (const [code, people] of Object.entries(STAFF_SEED)) {
  if (accounts.countStaff(code) === 0) {
    people.forEach(([name, role], i) => accounts.createStaff({ supplierCode: code, name, role, pin: i === 0 ? '1234' : '5678' }));
  }
}

const app = express();
app.use(express.json({ limit: '64kb' }));
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

// token -> { tier, key } (in-memory; verdwijnt bij herstart, data blijft in db.json)
const sessions = new Map();

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

function initRealtime() {
  if (!db.data.notifications) db.data.notifications = { rtg: [], lifestyle: [], business: [] };
  if (!db.data.pushSubs) db.data.pushSubs = { rtg: [], lifestyle: [], business: [] };
  if (!db.data.supplierNotifications) db.data.supplierNotifications = {};
  if (!db.data.supplierActivity) db.data.supplierActivity = {};   // wie deed wat, per bedrijf
  if (!db.data.supplierTeam) db.data.supplierTeam = {};           // interne teamchat, per bedrijf
  if (!db.data.supplierInvites) db.data.supplierInvites = {};     // open personeelsuitnodigingen, per uitnodigingscode
  if (!db.data.live) db.data.live = {};                           // live "onderweg"-toestand per lid (customerKey)
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
  const demo = sessions.get(token);
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
    state.invoices = (md.invoices || []).map(inv => ({
      ...inv, desc: i18n.localize(inv.desc, lang), date: i18n.localize(inv.date, lang)
    }));
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
  }
  return state;
}

/* ---------- endpoints ---------- */

app.get('/api/health', (req, res) => res.json({ ok: true, ai: anthropic ? 'claude' : 'demo' }));

app.post('/api/login', (req, res) => {
  let tier = String(req.body.tier || '');
  if (hasCred(req.body)) {
    if (!checkCred(req.body.username, req.body.password))
      return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord.' });
    tier = 'business'; // het demo-account is een volledig lidmaatschap
  }
  if (!PERSONAS[tier]) return res.status(400).json({ error: 'Onbekende pas.' });
  const token = crypto.randomBytes(24).toString('hex');
  const sess = { tier, key: tier === 'guest' ? 'guest-' + token.slice(0, 8) : tier };
  sessions.set(token, sess);
  res.json({ token, state: stateFor(sess, req.body.lang) });
});

app.post('/api/logout', auth, (req, res) => {
  for (const [token, sess] of sessions) if (sess === req.session) sessions.delete(token);
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
  const user = accounts.findByLogin(login);
  if (!user || !accounts.verifyPassword(req.body.password, user.password_hash)) {
    return res.status(401).json({ error: 'Onjuiste inloggegevens.' });
  }
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
  const sess = token && sessions.get(token);
  if (!sess || sess.role !== 'supplier') return res.status(401).json({ error: 'Niet ingelogd als leverancier.' });
  req.supplier = findSupplier(sess.code);
  if (!req.supplier) return res.status(401).json({ error: 'Leverancier niet gevonden.' });
  // Wie is er aan het werk (voor toeschrijving van activiteiten).
  req.actor = { name: sess.actor || 'Beheer', role: sess.staffRole || 'manager', staffId: sess.staffId || null, manager: !!sess.manager, perms: sess.perms || null };
  next();
}

// Mag deze medewerker deze functie gebruiken? Managers en bestaande accounts
// zonder rechtenlijst mogen alles; anders bepaalt de lijst van de uitnodiging het.
function actorCan(actor, cap) {
  if (!actor || actor.manager) return true;
  if (!actor.perms || !actor.perms.length) return true;
  return actor.perms.includes(cap);
}
function requireCap(cap) {
  return (req, res, next) => {
    if (!actorCan(req.actor, cap)) return res.status(403).json({ error: 'Je account heeft geen toegang tot deze functie. Vraag je manager om toegang.' });
    next();
  };
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
           city: s.city, caps: t.caps || [], loc, hasMenu: (s.menu || []).length > 0 };
}

// Slimme dagbriefing: de app signaleert zelf wat nu aandacht nodig heeft.
// Gestructureerd (type + gegevens), de app-kant maakt er tekst van in de juiste taal.
function supplierInsights(s) {
  const t = db.data.supplierTypes[s.type] || {};
  const caps = t.caps || [];
  const out = [];
  const orders = db.data.orders.filter(o => o.supplierCode === s.code);
  const open = orders.filter(o => !['geserveerd', 'geweigerd', 'terugbetaald'].includes(o.status));
  const fresh = open.filter(o => o.status === 'nieuw');
  if (fresh.length) {
    const oldestMin = Math.max(1, Math.round((Date.now() - Math.min(...fresh.map(o => +new Date(o.at)))) / 60000));
    out.push({ type: 'neworders', kind: caps.includes('bookings') ? 'bookings' : 'orders', n: fresh.length, min: oldestMin, tab: 'orders', icon: '🔔', urgent: oldestMin >= 10 });
  }
  const allergy = open.filter(o => o.allergyNote);
  if (allergy.length) out.push({ type: 'allergy', n: allergy.length, who: allergy[0].customerCodename, note: allergy[0].allergyNote, tab: 'orders', icon: '⚠️', urgent: true });
  const soon = guestsFor(s.code).filter(g => !g.arrived && g.etaMin != null && g.etaMin <= 12);
  if (soon.length) out.push({ type: 'arriving', n: soon.length, min: Math.min(...soon.map(g => g.etaMin)), tab: 'home', icon: '📍', urgent: true });
  if (caps.includes('rides')) {
    const waiting = db.data.rides.filter(r => r.supplierCode === s.code && r.status === 'aangevraagd');
    if (waiting.length) out.push({ type: 'rides', n: waiting.length, tab: 'rides', icon: '🚘', urgent: true });
  }
  if (caps.includes('pricing')) {
    const last = db.data.supplierPrices.find(p => p.supplierCode === s.code);
    const days = last ? Math.floor((Date.now() - new Date(last.at)) / 86400000) : null;
    if (days == null || days >= 7) out.push({ type: 'price', days, tab: 'price', icon: '💶' });
  }
  if (caps.includes('menu')) {
    const missing = (s.menu || []).filter(m => !String(m.desc || '').trim()).length;
    if (missing) out.push({ type: 'menudesc', n: missing, tab: 'menu', icon: '📖' });
  }
  if (!accounts.countStaff(s.code)) out.push({ type: 'noteam', tab: 'team', icon: '👥' });
  return out.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0)).slice(0, 4);
}

// Open uitnodigingen van dit bedrijf (alleen voor de manager zichtbaar).
function openInvites(code) {
  return Object.values(db.data.supplierInvites)
    .filter(i => i.supplierCode === code && !i.usedBy && i.expiresAt > Date.now())
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

// dashboarddata voor de ingelogde leverancier
function supplierState(s, actor) {
  const t = db.data.supplierTypes[s.type] || {};
  return {
    supplier: { code: s.code, name: s.name, type: s.type, typeLabel: t.label, icon: t.icon, city: s.city, caps: t.caps || [], loc: s.loc, rate: s.rate },
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
    activity: (db.data.supplierActivity[s.code] || []).slice(0, 40),
    team: (db.data.supplierTeam[s.code] || []).slice(-60),
    insights: supplierInsights(s),
    invites: (actor && actor.manager) ? openInvites(s.code) : [],
    actor: actor || { name: 'Beheer', role: 'manager', manager: true }
  };
}

// ---- leverancier: inloggen, live-stream, dashboard ----

app.post('/api/supplier/login', (req, res) => {
  let s, actor;
  if (req.body.staffId != null) {
    // Persoonlijke personeelslogin met PIN, binnen het bedrijfsaccount.
    s = findSupplier(req.body.code);
    if (!s) return res.status(404).json({ error: 'Deze leverancierscode kennen we niet.' });
    const staff = accounts.verifyStaffPin(Number(req.body.staffId), req.body.pin);
    if (!staff || String(staff.supplier_code).toUpperCase() !== s.code) return res.status(401).json({ error: 'Onjuiste PIN.' });
    actor = { name: staff.name, role: staff.role, staffId: staff.id, manager: staff.role === 'manager', perms: accounts.staffPerms(staff) };
  } else if (hasCred(req.body)) {
    if (!checkCred(req.body.username, req.body.password))
      return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord.' });
    s = findSupplier(DEMO_SUPPLIER);
    actor = { name: 'Beheer', role: 'manager', manager: true };
  } else {
    s = findSupplier(req.body.code);
    actor = { name: 'Beheer', role: 'manager', manager: true };
  }
  if (!s) return res.status(404).json({ error: 'Deze leverancierscode kennen we niet.' });
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { role: 'supplier', code: s.code, actor: actor.name, staffId: actor.staffId, staffRole: actor.role, manager: actor.manager, perms: actor.perms || null });
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
  const staff = accounts.createStaff({ supplierCode: req.supplier.code, name, role: req.body.role === 'manager' ? 'manager' : 'staff', pin });
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

/* ---- personeel uitnodigen via een link ----
   De manager maakt een uitnodiging met rol + functierechten en deelt de link.
   De genodigde opent de link, kiest een naam en eigen pincode, en zit direct
   in de app — met precies de functies die het bedrijf heeft opengezet. */

const INVITE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dagen geldig

app.post('/api/supplier/invite/create', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan personeel uitnodigen.' });
  const t = db.data.supplierTypes[req.supplier.type] || {};
  const valid = (t.caps || []).concat(['location']);
  const perms = Array.isArray(req.body.perms) ? req.body.perms.map(String).filter(p => valid.includes(p)).slice(0, 12) : [];
  const invite = {
    code: crypto.randomBytes(4).toString('hex').toUpperCase(),
    supplierCode: req.supplier.code,
    role: req.body.role === 'manager' ? 'manager' : 'staff',
    perms: req.body.role === 'manager' ? [] : perms, // manager = altijd alles
    invitedBy: req.actor.name,
    at: new Date().toISOString(),
    expiresAt: Date.now() + INVITE_TTL,
    usedBy: null
  };
  db.data.supplierInvites[invite.code] = invite;
  save();
  logActivity(req.supplier.code, req.actor, 'maakte een uitnodiging aan (' + (invite.role === 'manager' ? 'manager' : 'medewerker') + ')');
  res.json({ ok: true, invite, link: '/apps/leverancier.html?invite=' + invite.code });
});

app.post('/api/supplier/invite/revoke', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan uitnodigingen intrekken.' });
  const inv = db.data.supplierInvites[String(req.body.code || '').toUpperCase()];
  if (inv && inv.supplierCode === req.supplier.code) {
    delete db.data.supplierInvites[inv.code];
    save();
    logActivity(req.supplier.code, req.actor, 'trok een uitnodiging in');
  }
  res.json({ ok: true, invites: openInvites(req.supplier.code) });
});

// Publiek: de genodigde bekijkt waarvoor de uitnodiging is (geen login nodig).
app.post('/api/supplier/invite/info', (req, res) => {
  const inv = db.data.supplierInvites[String(req.body.code || '').trim().toUpperCase()];
  if (!inv) return res.status(404).json({ error: 'Deze uitnodiging bestaat niet (meer).' });
  if (inv.usedBy) return res.status(410).json({ error: 'Deze uitnodiging is al gebruikt.' });
  if (inv.expiresAt <= Date.now()) return res.status(410).json({ error: 'Deze uitnodiging is verlopen.' });
  const s = findSupplier(inv.supplierCode);
  if (!s) return res.status(404).json({ error: 'Bedrijf niet gevonden.' });
  const t = db.data.supplierTypes[s.type] || {};
  res.json({ supplier: { name: s.name, icon: t.icon, typeLabel: t.label, city: s.city }, role: inv.role, perms: inv.perms, invitedBy: inv.invitedBy });
});

// Publiek: uitnodiging accepteren → eigen account met zelfgekozen PIN, direct ingelogd.
app.post('/api/supplier/invite/accept', (req, res) => {
  const inv = db.data.supplierInvites[String(req.body.code || '').trim().toUpperCase()];
  if (!inv || inv.usedBy || inv.expiresAt <= Date.now()) return res.status(410).json({ error: 'Deze uitnodiging is niet (meer) geldig.' });
  const s = findSupplier(inv.supplierCode);
  if (!s) return res.status(404).json({ error: 'Bedrijf niet gevonden.' });
  const name = String(req.body.name || '').trim().slice(0, 60);
  const pin = String(req.body.pin || '');
  if (name.length < 2) return res.status(400).json({ error: 'Vul je naam in.' });
  if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'Kies een pincode van 4 cijfers.' });
  const staff = accounts.createStaff({ supplierCode: s.code, name, role: inv.role, pin, perms: inv.perms });
  inv.usedBy = { name, at: new Date().toISOString() };
  save();
  const actor = { name: staff.name, role: staff.role, staffId: staff.id, manager: staff.role === 'manager', perms: accounts.staffPerms(staff) };
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { role: 'supplier', code: s.code, actor: actor.name, staffId: actor.staffId, staffRole: actor.role, manager: actor.manager, perms: actor.perms || null });
  logActivity(s.code, actor, name + ' accepteerde de uitnodiging van ' + inv.invitedBy + ' en zit in het team');
  notifySupplier(s.code, { icon: '🤝', title: 'Nieuw teamlid', body: name + ' heeft de uitnodiging geaccepteerd.' });
  res.json({ token, state: supplierState(s, actor) });
});

// Interne teamchat binnen het bedrijf.
app.post('/api/supplier/team/message', supplierAuth, (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  const list = db.data.supplierTeam[req.supplier.code] = (db.data.supplierTeam[req.supplier.code] || []);
  list.push({ who: req.actor.name, role: req.actor.role, text, at: new Date().toISOString() });
  db.data.supplierTeam[req.supplier.code] = list.slice(-100);
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
  res.json({ ok: true });
});

app.get('/api/supplier/stream', (req, res) => {
  const sess = sessions.get(req.query.token);
  if (!sess || sess.role !== 'supplier') return res.status(401).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' });
  res.write('retry: 3000\n\n');
  const client = { sup: sess.code, res };
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
app.post('/api/supplier/price', supplierAuth, requireCap('pricing'), (req, res) => {
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
app.post('/api/supplier/menu', supplierAuth, requireCap('menu'), (req, res) => {
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
app.post('/api/supplier/order/status', supplierAuth, requireCap('orders'), (req, res) => {
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
app.post('/api/supplier/refund', supplierAuth, requireCap('orders'), (req, res) => {
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
app.post('/api/supplier/location', supplierAuth, requireCap('location'), (req, res) => {
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
app.post('/api/supplier/ride/status', supplierAuth, requireCap('rides'), (req, res) => {
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

/* ---- AI-copiloot voor de leverancier ----
   Eén assistent per bedrijf die de live werkelijkheid kent: open orders,
   allergieën, gasten onderweg, omzet, prijshistorie en het team. Met een
   ANTHROPIC_API_KEY draait dit op Claude; zonder key geeft de copiloot
   demo-antwoorden op basis van dezelfde echte cijfers. */

function supplierAiContext(s) {
  const t = db.data.supplierTypes[s.type] || {};
  const orders = db.data.orders.filter(o => o.supplierCode === s.code);
  const open = orders.filter(o => !['geserveerd', 'geweigerd', 'terugbetaald'].includes(o.status));
  const revenue = orders.filter(o => o.paid).reduce((sum, o) => sum + o.total, 0);
  const rides = db.data.rides.filter(r => r.supplierCode === s.code && !['gearriveerd', 'geweigerd'].includes(r.status));
  const prices = db.data.supplierPrices.filter(p => p.supplierCode === s.code).slice(0, 5);
  const guests = guestsFor(s.code);
  return {
    caps: t.caps || [], typeLabel: t.label, open, revenue, rides, prices, guests,
    staffCount: accounts.countStaff(s.code),
    menuCount: (s.menu || []).length,
    menuNoDesc: (s.menu || []).filter(m => !String(m.desc || '').trim()).length
  };
}

/* Vakkennis per bedrijfstak: de copiloot denkt mee in de taal van het vak. */
const BRANCH_HINTS = {
  restaurant: 'Denk mee als een ervaren keuken- en zaalmanager: mise-en-place, allergieën eerst, timing afstemmen op gasten die eraan komen (ETA), en een menukaart die verleidt. Denk in services en couverts.',
  bar: 'Denk mee als een barmanager: voorraad en mise-en-place voor de avond, allergieën bij cocktails en snacks, piekmomenten voorzien wanneer gasten onderweg zijn.',
  club: 'Denk mee als een clubmanager: gastenlijst en aankomsttijden, tafels en bottle service voorbereiden, de avondplanning strak houden.',
  hotel: 'Denk mee als een hotel-operations manager: aankomsten en boekingen vandaag eerst, kamers op tijd gereed, voorkeuren van gasten doorgeven, en een scherpe dynamische prijs per seizoen.',
  apartment: 'Denk mee als een verhuurmanager: check-ins voorbereiden, sleuteloverdracht en schoonmaak-timing, en een scherpe dynamische prijs per periode.',
  taxi: 'Denk mee als een fleet-dispatcher: nieuwe ritaanvragen direct oppakken, aanrijtijden bewaken, slim positioneren bij gasten die onderweg zijn.',
  jet: 'Denk mee als een flight-ops coördinator: aanvragen snel bevestigen, slots en vliegtijden bewaken, catering en voorkeuren van de gast voorbereiden.'
};

function supplierAiSystem(s, actor, lang) {
  const c = supplierAiContext(s);
  const orderLines = c.open.slice(0, 8).map(o =>
    `- ${o.ref}: gast ${o.customerCodename}, € ${o.total}, status "${o.status}"${o.paid ? ', betaald' : ', onbetaald'}${o.allergyNote ? ', ALLERGIE: ' + o.allergyNote : ''}`
  ).join('\n');
  const rideLines = c.rides.slice(0, 6).map(r => `- ${r.ref}: ${r.from || '?'} → ${r.to || 'open bestemming'}, status "${r.status}"`).join('\n');
  const priceLines = c.prices.map(p => `- ${p.service}: € ${p.price} (${p.at.slice(0, 10)})`).join('\n');
  const guestLines = c.guests.map(g => `- ${g.codename}: ${g.arrived ? 'gearriveerd' : (g.etaMin != null ? '~' + g.etaMin + ' min onderweg' : 'onderweg')}`).join('\n');
  return [
    `Je bent de AI-copiloot van "${s.name}" (${c.typeLabel}, ${s.city}) in de RTG Partners-app van Rahul Travel Group.`,
    BRANCH_HINTS[s.type] || '',
    `Je praat met ${actor.name} (${actor.manager ? 'manager' : 'medewerker'}). Wees een efficiënte, zakelijke rechterhand: kort, concreet, vooruitdenkend. Sluit af met één concreet voorstel waar de gebruiker met "ja" op kan reageren, als dat past.`,
    `Het bedrijf levert RTG zijn beste dynamische prijs (marge-afspraak: ${Math.round((s.rate || 0) * 100)}%); RTG brengt de gasten. Gasten heten uitsluitend bij hun codenaam (privacy by design), gebruik nooit echte namen.`,
    `Live situatie van nu:`,
    `Ontvangen omzet: € ${c.revenue}. Open orders: ${c.open.length}.${orderLines ? '\n' + orderLines : ''}`,
    c.caps.includes('rides') ? `Actieve ritten: ${c.rides.length}.${rideLines ? '\n' + rideLines : ''}` : '',
    guestLines ? `Gasten onderweg naar het bedrijf:\n${guestLines}` : 'Er zijn nu geen gasten onderweg.',
    priceLines ? `Laatst doorgegeven prijzen:\n${priceLines}` : 'Nog geen dynamische prijzen doorgegeven.',
    c.caps.includes('menu') ? `Menukaart: ${c.menuCount} items${c.menuNoDesc ? ', waarvan ' + c.menuNoDesc + ' zonder beschrijving (help daar desgevraagd mee: verfijnde, korte beschrijvingen in de stijl van het bedrijf)' : ''}.` : '',
    `Team: ${c.staffCount} persoonlijke accounts. Managers kunnen personeel uitnodigen via de Team-tab (uitnodigingslink met functierechten).`,
    `Regels: verzin geen orders, gasten, boekingen of partnerschappen die hierboven niet staan. Je kunt zelf niets uitvoeren in de systemen; verwijs naar de juiste tab in de app ("Orders", "Ritten", "Menu", "Prijs", "Locatie", "Team"). Beloof nooit RTG-lidmaatschappen of toegang namens RTG. Bedragen zijn interne administratie, nooit met gasten delen.`,
    lang === 'en' ? 'Answer in English.' : 'Antwoord in het Nederlands.',
    'Maximaal ~120 woorden per antwoord, geen opsmuk.'
  ].filter(Boolean).join('\n');
}

/* Demo-antwoorden zonder API-key: dezelfde echte cijfers, vaste formuleringen. */
function cannedSupplierAnswer(q, s, lang) {
  const c = supplierAiContext(s);
  const l = String(q).toLowerCase();
  const en = lang === 'en';
  if (l.includes('omzet') || l.includes('verdien') || l.includes('revenue') || l.includes('earn'))
    return en
      ? `You have received € ${c.revenue} in paid orders, and ${c.open.length} order(s) are still open. See the Orders tab for which ones are unpaid.`
      : `U heeft € ${c.revenue} aan betaalde orders ontvangen; er staan nog ${c.open.length} order(s) open. In de Orders-tab ziet u welke nog onbetaald zijn.`;
  if (l.includes('allergi') || l.includes('allerg')) {
    const a = c.open.filter(o => o.allergyNote);
    return a.length
      ? (en ? `Attention: ${a.length} open order(s) with an allergy note. ${a.map(o => o.customerCodename + ': ' + o.allergyNote).join('; ')}. Brief the kitchen now.` : `Let op: ${a.length} open order(s) met een allergiemelding. ${a.map(o => o.customerCodename + ': ' + o.allergyNote).join('; ')}. Informeer de keuken direct.`)
      : (en ? 'No allergy notes in the open orders right now.' : 'Op dit moment geen allergiemeldingen in de open orders.');
  }
  if (l.includes('order') || l.includes('bestell'))
    return en
      ? `${c.open.length} open order(s)${c.open.length ? ': ' + c.open.map(o => `${o.ref} (${o.status})`).join(', ') : ''}. Update the status in the Orders tab so the guest sees it live.`
      : `${c.open.length} open order(s)${c.open.length ? ': ' + c.open.map(o => `${o.ref} (${o.status})`).join(', ') : ''}. Werk de status bij in de Orders-tab; de gast ziet het live.`;
  if (l.includes('prijs') || l.includes('price')) {
    const last = c.prices[0];
    return en
      ? `Your margin agreement with RTG is ${Math.round((s.rate || 0) * 100)}%. ${last ? `Last submitted: ${last.service} at € ${last.price}.` : 'You have not submitted a price yet.'} A fresh dynamic price keeps you at the top of RTG's proposals — submit one in the Price tab.`
      : `Uw marge-afspraak met RTG is ${Math.round((s.rate || 0) * 100)}%. ${last ? `Laatst doorgegeven: ${last.service} voor € ${last.price}.` : 'U heeft nog geen prijs doorgegeven.'} Een verse dynamische prijs houdt u bovenaan in de RTG-voorstellen — geef er een door in de Prijs-tab.`;
  }
  if (l.includes('rit') || l.includes('ride'))
    return c.rides.length
      ? (en ? `${c.rides.length} active ride(s): ${c.rides.map(r => `${r.ref} (${r.status})`).join(', ')}. Accept or update them in the Rides tab — the guest follows you live.` : `${c.rides.length} actieve rit(ten): ${c.rides.map(r => `${r.ref} (${r.status})`).join(', ')}. Accepteer of werk bij in de Ritten-tab; de gast volgt u live.`)
      : (en ? 'No open ride requests right now. New requests appear live, with pickup location and ETA.' : 'Geen open ritaanvragen op dit moment. Nieuwe aanvragen verschijnen hier live, met ophaallocatie en aanrijtijd.');
  if (l.includes('boeking') || l.includes('aankomst') || l.includes('booking') || l.includes('arrival') || l.includes('check'))
    return (c.open.length || c.guests.length)
      ? (en ? `${c.open.length} open booking(s)${c.guests.length ? ` and ${c.guests.length} guest(s) on their way (${c.guests.map(g => g.codename + (g.etaMin != null ? ` ~${g.etaMin} min` : '')).join(', ')})` : ''}. Have everything ready before they arrive.` : `${c.open.length} open boeking(en)${c.guests.length ? ` en ${c.guests.length} gast(en) onderweg (${c.guests.map(g => g.codename + (g.etaMin != null ? ` ~${g.etaMin} min` : '')).join(', ')})` : ''}. Zorg dat alles klaarstaat vóór aankomst.`)
      : (en ? 'No open bookings or arrivals right now. New RTG bookings appear here live.' : 'Geen open boekingen of aankomsten op dit moment. Nieuwe RTG-boekingen verschijnen hier live.');
  if (l.includes('gast') || l.includes('guest') || l.includes('onderweg'))
    return c.guests.length
      ? (en ? `${c.guests.length} guest(s) heading your way: ${c.guests.map(g => g.codename + (g.arrived ? ' (arrived)' : g.etaMin != null ? ` (~${g.etaMin} min)` : '')).join(', ')}. Make sure everything is ready.` : `${c.guests.length} gast(en) onderweg: ${c.guests.map(g => g.codename + (g.arrived ? ' (gearriveerd)' : g.etaMin != null ? ` (~${g.etaMin} min)` : '')).join(', ')}. Zorg dat alles klaarstaat.`)
      : (en ? 'No guests on their way right now.' : 'Er zijn nu geen gasten naar u onderweg.');
  if (l.includes('menu'))
    return en
      ? `Your menu has ${c.menuCount} items${c.menuNoDesc ? `, ${c.menuNoDesc} without a description. Guests order more when dishes are described — with the full AI enabled I draft those texts for you.` : '.'}`
      : `Uw menukaart telt ${c.menuCount} items${c.menuNoDesc ? `, waarvan ${c.menuNoDesc} zonder beschrijving. Gasten bestellen meer bij beschreven gerechten — met de volledige AI help ik met tekstvoorstellen.` : '.'}`;
  if (l.includes('team') || l.includes('personeel') || l.includes('staff') || l.includes('uitnodig') || l.includes('invite'))
    return en
      ? `Your team has ${c.staffCount} personal account(s). In the Team tab a manager can create an invite link and choose exactly which functions the new colleague gets.`
      : `Uw team telt ${c.staffCount} persoonlijke account(s). In de Team-tab maakt een manager een uitnodigingslink en bepaalt precies welke functies de nieuwe collega krijgt.`;
  // Slotantwoord in het register van de bedrijfstak.
  if (c.caps.includes('rides'))
    return en
      ? `Right now: ${c.rides.length} active ride(s), € ${c.revenue} received${c.guests.length ? `, ${c.guests.length} guest(s) waiting` : ''}. Ask me about rides, revenue, prices or the team.`
      : `Stand van nu: ${c.rides.length} actieve rit(ten), € ${c.revenue} ontvangen${c.guests.length ? `, ${c.guests.length} gast(en) wachtend` : ''}. Vraag me naar ritten, omzet, prijzen of het team.`;
  if (c.caps.includes('bookings'))
    return en
      ? `Right now: ${c.open.length} open booking(s), € ${c.revenue} received${c.guests.length ? `, ${c.guests.length} guest(s) on the way` : ''}. Ask me about bookings, arrivals, revenue, prices or the team.`
      : `Stand van nu: ${c.open.length} open boeking(en), € ${c.revenue} ontvangen${c.guests.length ? `, ${c.guests.length} gast(en) onderweg` : ''}. Vraag me naar boekingen, aankomsten, omzet, prijzen of het team.`;
  return en
    ? `Right now: ${c.open.length} open order(s), € ${c.revenue} received${c.guests.length ? `, ${c.guests.length} guest(s) on the way` : ''}. Ask me about revenue, orders, allergies, prices, your menu or the team.`
    : `Stand van nu: ${c.open.length} open order(s), € ${c.revenue} ontvangen${c.guests.length ? `, ${c.guests.length} gast(en) onderweg` : ''}. Vraag me naar omzet, orders, allergieën, prijzen, het menu of het team.`;
}

app.post('/api/supplier/ai', supplierAuth, async (req, res) => {
  const lang = req.body.lang === 'en' ? 'en' : 'nl';
  const history = (Array.isArray(req.body.messages) ? req.body.messages : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-12);
  while (history.length && history[0].role !== 'user') history.shift();
  if (!history.length || history[history.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Geen vraag ontvangen.' });
  }
  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: supplierAiSystem(req.supplier, req.actor, lang),
        messages: history
      });
      const reply = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      if (reply) return res.json({ reply, source: 'claude' });
    } catch (e) { console.error('Claude-fout (copiloot):', e.message); }
  }
  res.json({ reply: cannedSupplierAnswer(history[history.length - 1].content, req.supplier, lang), source: 'demo' });
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
  if (String(req.body.code || '').trim().toUpperCase() !== OFFICE_CODE) {
    return res.status(401).json({ error: 'Onjuiste backoffice-code.' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { role: 'office' });
  res.json({ token, state: officeState() });
});

function officeAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const sess = token && sessions.get(token);
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
  return {
    prices: db.data.supplierPrices.slice(0, 60),
    orders: db.data.orders.slice(0, 60),
    rides: db.data.rides.slice(0, 60),
    live,
    suppliers: db.data.suppliers.map(publicSupplier)
  };
}

app.get('/api/office/stream', (req, res) => {
  const sess = sessions.get(req.query.token);
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
  notify(user.tier, { icon: status === 'verified' ? '✅' : '⚠',
    title: status === 'verified' ? 'Identiteit geverifieerd' : 'Verificatie afgewezen',
    body: status === 'verified' ? 'U kunt nu in één tik boeken.' : 'Probeer een duidelijkere foto van uw document.' });
  res.json({ ok: true, status, pending: pendingVerifications() });
});

// Het geüploade document bekijken (alleen backoffice; token via query voor <img>).
app.get('/api/office/doc', (req, res) => {
  const sess = sessions.get(req.query.token);
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

/* ---------- start ---------- */

initRealtime();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RTG-portaal draait op http://localhost:${PORT}, open http://localhost:${PORT}/apps/portaal.html`);
  console.log(`Live updates (SSE) actief${webpush ? ', web-push actief' : ' (web-push niet geladen)'}.`);
});
