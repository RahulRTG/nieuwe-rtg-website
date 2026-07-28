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

const express = require('./web');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const { db, load, save, DATA_DIR, STORE, opslagKlaar, pgPoolStatus, startGedeeld, startSqliteSync, startPostgres, flushBijAfsluiten, onExternalChange, grootSupplierSync, grootAantal,
  ledenGidsActief, ledenGidsHaal, ledenGidsAantal, ledenGidsZet, ledenGidsExact, ledenGidsZoek,
  orderMetRef, ordersVanKlant, ordersVanZaak, ordersVoegToe,
  boekingMetRef, boekingenVanKlant, boekingenVanZaak, boekingenVoegToe,
  txLedgerActief, txLedgerVanKlant, txLedgerVanZaak, txLedgerTel, txLedgerAantal } = require('./db');
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
const { maakLidboard } = require('./kern/lidboard');
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

/* Fout-aggregatie zit ALTIJD aan in server/log.js (in-memory, zichtbaar op het
   techniekbord: ERR-01 + de storingslijst) -- dat dekt het groeperen en tonen.
   Daarbovenop kan optioneel EXTERNE bezorging via de eigen fout-melder
   (server/foutmelder.js): een dunne webhook-POST, aan te zetten met
   ERR_WEBHOOK_URL. Zonder blijft de eigen aggregatie gewoon draaien. */
if (process.env.ERR_WEBHOOK_URL) {
  try {
    const melder = require('./foutmelder').maakFoutmelder({ url: process.env.ERR_WEBHOOK_URL });
    log.onError((err, ctx) => melder.melden(err, ctx));
    log.info('Fout-tracker: eigen webhook-melder actief.');
  } catch (e) {
    log.warn('ERR_WEBHOOK_URL gezet maar de fout-melder kon niet starten (' + (e && e.message) + ').');
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

/* Is het eigenaarschap ooit overgedragen vanuit de boardroom, dan staat de
   opvolger in de database. Dat zetten we hier meteen terug in de eigenaar-
   module, VOOR de routers geladen worden. Anders zou het platform na een
   herstart terugvallen op het startadres en zou de vorige eigenaar er weer
   doorheen komen, terwijl de nieuwe buiten staat. */
try {
  const bewaard = db.data && db.data.techniek && db.data.techniek.eigenaarEmail;
  if (bewaard && eigenaar.zetEigenaarEmail(bewaard)) {
    console.log('[eigenaar] overgedragen eigenaarschap hersteld: ' + eigenaar.eigenaarEmail());
  }
} catch (e) {}
accounts.init();
// Demo-modus: alleen buiten productie, of expliciet met RTG_DEMO=1. Zo staan de
// demo-inlog en het demo-account (Rahul/Imran) nooit per ongeluk open op productie.
const DEMO = process.env.NODE_ENV !== 'production' || process.env.RTG_DEMO === '1';
// Het eigenaarsaccount (Rahul Imran Ismail), zodat Rahul/Imran ook via de
// echte accountlogin werkt. Bestaat het account al (een oudere lokale
// database), dan krijgt het hier de juiste naam; de kluis blijft de bron.
// Sync-varianten: de seed draait voor 'listen', dus blokkeren kan geen kwaad
// en zodra de poort opengaat bestaan de accounts gegarandeerd (geen race in tests).
if (DEMO) {
  const DEMO_WACHTWOORD = process.env.DEMO_PASS || 'Imran';
  let u = accounts.findByLogin(eigenaar.OWNER_EMAIL);
  if (!u) {
    /* Nog geen account op het eigenaarsadres. Op een verse database maken we er
       een; op een database die al demoleden bevat draagt de seed-persona de
       naam Rahul al, en verhuizen we die naar het eigenaarsadres. Anders zou
       de inlognaam botsen en bleef de eigenaar buiten de boardroom staan. */
    const bestaand = accounts.findByLogin('Rahul');
    if (bestaand) {
      u = accounts.renameUser(bestaand.id, { username: 'Rahul', realName: 'Rahul Imran Ismail', email: eigenaar.OWNER_EMAIL });
      accounts.setPasswordSync(u.id, DEMO_WACHTWOORD);
      accounts.setVerification(u.id, 'verified');
    } else {
      u = accounts.createUserSync({ username: 'Rahul', email: eigenaar.OWNER_EMAIL, password: DEMO_WACHTWOORD, tier: 'business', realName: 'Rahul Imran Ismail', phone: '+31612345678' });
      accounts.saveMemberState(u.id, memberTemplate());
      accounts.setVerification(u.id, 'verified'); // demo-account is al geverifieerd
    }
  } else if (accounts.realNameOf(u) !== 'Rahul Imran Ismail') {
    u = accounts.renameUser(u.id, { username: 'Rahul', realName: 'Rahul Imran Ismail' });
  }
  /* De sleutelbos van de eigenaar: alles zien en alles doen met het ene
     account. De kantoor- en zaak-rol staan er standaard aan gekoppeld, dus
     na de leden-inlog is elke werkplek een rolkeuze, geen tweede inlog. */
  if (u) {
    if (!db.data.accountRollen || typeof db.data.accountRollen !== 'object') db.data.accountRollen = {};
    const sleutelbos = db.data.accountRollen['user-' + u.id] =
      Array.isArray(db.data.accountRollen['user-' + u.id]) ? db.data.accountRollen['user-' + u.id] : [];
    if (!sleutelbos.some(r => r.rol === 'kantoor')) sleutelbos.push({ rol: 'kantoor', at: new Date().toISOString() });
    if (!sleutelbos.some(r => r.rol === 'zaak')) {
      const zc = (process.env.DEMO_SUPPLIER || 'KIKUNOI').toUpperCase();
      const zaak = (db.data.suppliers || []).find(s => s.code === zc);
      sleutelbos.push({ rol: 'zaak', code: zc, zaakNaam: zaak ? zaak.name : zc, naam: 'Beheer', at: new Date().toISOString() });
    }
    save();
  }
}

/* Het demopersoneel per leverancier staat als pure data in een kern-module. */
const STAFF_SEED = Object.assign({}, require('./kern/staffseed').STAFF_SEED, require('./kern/staffseed2').STAFF_SEED);
// demopersoneel bestaat alleen in demostand; in productie komt personeel
// uitsluitend via de eigen zaak binnen (uitnodiging + eigen pincode)
if (DEMO) {
  /* Later toegevoegde demo-zaken (zoals De Ibiza Bode) ook op bestaande
     demo-databases aanvullen; de verse seed draait immers maar een keer. */
  for (const s of require('./seed/leveranciers').suppliers) {
    if (!db.data.suppliers.some(x => x.code === s.code)) db.data.suppliers.push(JSON.parse(JSON.stringify(s)));
  }
  for (const [code, people] of Object.entries(STAFF_SEED)) {
    /* heling: bij een allereerste start kunnen de drie werkers tegelijk
       countStaff 0 zien en elk seeden; dubbele seed-rijen (zelfde naam+rol)
       worden hier bij elke start weer opgeruimd */
    const seedNamen = new Set(people.map(p => p[0] + '|' + p[1]));
    const gezien = new Set();
    for (const st of accounts.listStaff(code)) {
      const k = st.name + '|' + st.role;
      if (seedNamen.has(k) && gezien.has(k)) accounts.deactivateStaff(st.id); else gezien.add(k);
    }
    if (accounts.countStaff(code) === 0) {
      people.forEach(([name, role, func], i) => accounts.createStaffSync({ supplierCode: code, name, role, func, pin: i === 0 ? '1234' : '5678' }));
    }
  }
  // het restaurant en de beachclub zijn verbonden in het personeelsnetwerk,
  // zodat het wisselen van afdeling (geaccrediteerd personeel) te proberen is
  const net = db.data.supplierNet = db.data.supplierNet || { links: [], gesprek: {} };
  if (!Array.isArray(net.links)) net.links = [];
  if (!net.links.some(l => [String(l.a), String(l.b)].sort().join('|') === 'KIKUNOI|VORA')) {
    net.links.push({ a: 'KIKUNOI', b: 'VORA', status: 'akkoord', doorCode: 'KIKUNOI', at: new Date().toISOString(), beslistAt: new Date().toISOString() });
  }
  // Demo van de "1x aanmelden"-inlog: een RTG-lid dat bij twee bedrijven op het
  // rooster staat. Log in de personeels-app in met nora@rtg.example / werk en je
  // landt meteen bij Sal de Mar, met Vora Beach Club als tweede werkplek om naar
  // te wisselen. De personeelsrijen bestaan al (Nora Prins); we koppelen ze aan
  // dit account via member_id, zodat de inlog ze allebei vindt.
  try {
    let nora = accounts.findByLogin('nora@rtg.example');
    if (!nora) {
      nora = accounts.createUserSync({ username: 'nora', email: 'nora@rtg.example', password: process.env.DEMO_STAFF_PASS || 'werk', tier: 'rtg', realName: 'Nora Prins', phone: '+31600000002' });
      accounts.setVerification(nora.id, 'verified');
    }
    for (const c of ['KIKUNOI', 'VORA']) {
      const rij = accounts.listStaff(c).find(m => m.name === 'Nora Prins');
      if (rij && rij.member_id == null) accounts.setStaffMember(rij.id, nora.id, nora.tier);
    }
  } catch (e) { /* demo-koppeling is optioneel */ }
}

const app = express();

/* ---------- De Zaakdoos (RTG_DOOS_CLOUD gezet) ----------
   Dit proces draait dan op een kastje in de zaak. Online is het een
   doorgeefluik naar de cloud; valt de lijn weg, dan draait alles hier lokaal
   verder en wordt elke zaak-schrijfactie gejournald en later nagespeeld.
   Deze middleware staat bewust voor de body-parsers: het doorgeefluik stuurt
   de rauwe bytes een-op-een door. */
const zaakdoos = require('./kern/zaakdoos')({ db, save, log, dataDir: DATA_DIR }).doos;
if (zaakdoos.actief) {
  app.use((req, res, next) => {
    if (zaakdoos.modusVan() !== 'cloud' || !zaakdoos.magProxy(req.path)) return next();
    zaakdoos.proxy(req, res).then(gelukt => { if (!gelukt) next(); }).catch(() => next());
  });
  // de randcache: media die eerder over de lijn kwam, serveert de doos zelf
  // zodra het doorgeefluik hem niet kan leveren (de lijn is weg)
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.path.startsWith('/media/') || zaakdoos.modusVan() === 'cloud') return next();
    const hit = zaakdoos.kasLees(req.originalUrl);
    if (!hit) return next();
    res.set('Content-Type', hit.type);
    res.set('X-Content-Type-Options', 'nosniff');
    res.end(hit.buf);
  });
  console.log('[doos] zaakdoos-modus: doorgeefluik naar', process.env.RTG_DOOS_CLOUD);
}

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

/* Het schild voor de voordeur (kern/schild.js): applicatie-WAF + DDoS-rem.
   Altijd aan; localhost (health-checks, tests, poortwachter) slaat hij over.
   Treffers en bans landen als melding op het beveiligingsbord (techniek). */
/* De Wacht (kern/wacht.js) wordt verderop gebouwd (na db + beveilig), maar het
   schild raadpleegt hem nu al voor de quarantaine - laat-gebonden via deze
   verwijzing zodat een afgesneden indringer er ook echt niet meer in komt. */
const ssrf = require('./kern/ssrf'); // SSRF-afweer voor client-bepaalde uitgaande doelen
let wacht = null;
const schild = require('./kern/schild').maakSchild({
  meld: (type, ernst, tekst, meta) => { if (beveilig) beveilig.meld(type, ernst, tekst, meta); },
  logboek: log,
  quarantaine: (ip) => !!(wacht && wacht.inQuarantaine(ip))
});
app.use(schild.middleware);

/* De Wacht, voordeur-reflex (laat-gebonden; `wacht` wordt verderop gebouwd):
   1. RAND-STATUS. Komt dit verzoek via de rand (Cloudflare/edge) binnen, dan
      draagt het CF-Ray / CF-Connecting-IP. We noteren dat als live signaal zodat
      de boardroom ziet of de eerste linie staat -- eerlijk, want het is wat we
      echt kunnen waarnemen, geen bevoorrechte inkijk in Cloudflare zelf.
   2. AUTOMATISCHE LASTAFWORP. Trip De Wacht bij een L7-piek zelf een zekering,
      dan serveren we hier 503 "kom zo terug" (met Retry-After) zolang die dicht
      staat. Localhost slaan we over (health-checks, tests, poortwachter), net als
      het schild. De zekering dooft vanzelf; een mens kan hem eerder opheffen. */
app.use((req, res, next) => {
  if (wacht) {
    const ray = req.get('cf-ray'); const cfip = req.get('cf-connecting-ip');
    if (ray || cfip) { try { wacht.randGezien({ ray, provider: ray ? 'cloudflare' : 'edge' }); } catch (e) {} }
    const ip = String(req.ip || '');
    const lokaal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (!lokaal) {
      try {
        if (wacht.lastAfworpActief()) {
          res.set('Retry-After', '30');
          return res.status(503).json({ error: 'De Wacht heeft even de deur op een kier gezet wegens grote drukte. Kom zo terug.' });
        }
      } catch (e) {}
    }
  }
  next();
});

/* Security-headers op elk antwoord. De CSP staat inline scripts/styles toe
   (de apps zijn bewust self-contained), maar verbiedt elk ander extern
   verkeer dan de Google Fonts en blokkeert framing en MIME-sniffing. */
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  // SAMEORIGIN i.p.v. DENY: het RTG-bureaublad (zelfde origin) mag onze eigen
  // apps schermvullend insluiten; andere sites kunnen ons nog steeds niet
  // framen (clickjacking-bescherming blijft tegen derden overeind).
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // 9+-hardening: eigen vensters delen geen proces met vreemden (COOP), onze
  // bestanden zijn niet als bron voor andere sites bruikbaar (CORP), de
  // browser lekt geen DNS-voorkennis, en gevoelige browser-API's staan
  // expliciet dicht behalve wat de apps zelf nodig hebben.
  res.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.set('Cross-Origin-Resource-Policy', 'same-origin');
  res.set('X-DNS-Prefetch-Control', 'off');
  res.set('X-Permitted-Cross-Domain-Policies', 'none');
  res.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=(), midi=()');
  res.set('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
    "font-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; " +
    "connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'");
  next();
});

/* De meelees-laag van de RTG AI (kern/rtgai.js): telt alleen mee met het
   verkeer en doet verder niets; de kern wordt verderop aangesloten. */
let rtgaiMeelezer = null;
app.use((req, res, next) => {
  res.on('finish', () => { try { if (rtgaiMeelezer) rtgaiMeelezer.lees(req.method, req.path, res.statusCode); } catch (e) {} });
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

/* Grenswacht tegen pathologisch diep geneste invoer. Een echte API-body is
   een handvol niveaus diep; een 20.000-diep geneste array is geen gebruiker
   maar een aanval: elke String()/Number()-coercie erop laat de stack
   overlopen (Array.toString -> join -> recursie). We keuren de diepte hier
   ITERATIEF (met een eigen stack, dus zelf niet te laten overlopen) en
   weigeren te diep met een nette 400, voordat een route de body aanraakt. */
const MAX_DIEPTE = 40;
function teDiep(wortel) {
  const stapel = [[wortel, 1]];
  while (stapel.length) {
    const [v, d] = stapel.pop();
    if (!v || typeof v !== 'object') continue;
    if (d > MAX_DIEPTE) return true;
    for (const k in v) if (Object.prototype.hasOwnProperty.call(v, k)) stapel.push([v[k], d + 1]);
  }
  return false;
}
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && teDiep(req.body))
    return res.status(400).json({ error: 'Ongeldige invoer: te diep genest.' });
  next();
});

/* Zaakdoos, lokale modus: elke geslaagde zaak-schrijfactie komt in het
   journaal, zodat hij na herstel van de lijn wordt nagespeeld naar de cloud.
   Inloggen en de livestream horen bij de doos zelf en spelen we niet na. */
if (zaakdoos.actief) {
  app.use((req, res, next) => {
    if (zaakdoos.modusVan() !== 'lokaal' || req.method !== 'POST') return next();
    if (!req.path.startsWith('/api/supplier/') || req.path === '/api/supplier/login' || req.path.startsWith('/api/supplier/stream')) return next();
    const echteJson = res.json.bind(res);
    res.json = (d) => { if (res.statusCode < 300) zaakdoos.schrijfJournaal(req.path, req.body, d); return echteJson(d); };
    next();
  });
}

/* ---------- de poortwachters voor de routers (server/middleware/) ----------
   Drie remmen, de functieschakelaars, de compressie en de voordeur. Ze staan
   in deze volgorde omdat elke laag werk bespaart voor de laag erna: eerst
   weigeren wat we sowieso weigeren, dan pas comprimeren en serveren. */
const { remOpDeDeur, opslagPoort, hoofdzekering } = require('./middleware/remmen');
const { schakelaars } = require('./middleware/functieschakelaars');
const { jsonGzip, statischGzip } = require('./middleware/compressie');
const { bureaublad, cspNonce } = require('./middleware/voordeur');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CSP_NONCE = process.env.RTG_CSP_NONCE !== '0';
const functies = require('./functies');

remOpDeDeur(app, PRODUCTION || process.env.RTG_RATELIMIT === '1');
app.use(opslagPoort(opslagKlaar));
app.use(hoofdzekering({ db, accounts, eigenaar }));
// sessionFor en findSupplier staan verderop in dit bestand; ze worden pas bij
// een echt verzoek geraadpleegd, dus geven we ze lui door in plaats van hier
// hun waarde te lezen (die er op dit punt nog niet is).
app.use(schakelaars({ db, accounts, functies,
  sessionFor: t => sessionFor(t),
  findSupplier: c => findSupplier(c) }));
app.use(jsonGzip());

// RTFoundation-app: gratis, open onderwijs voor gezinnen met weinig geld
// (live schoolbord + leerling-schrift + AI-bijles). Aparte router-module,
// draait mee op dezelfde database en failover.
const rtf = require('./foundation');
app.use('/api/foundation', rtf.router);
// een gezinsmelding voor een gekoppelde oppas/familie ook als telefoonmelding (web-push)
rtf.setPushHook((userId, note) => { try { sendPushToUser(userId, note); } catch (e) {} });

bureaublad(app);
app.use(cspNonce(PUBLIC_DIR, CSP_NONCE));
app.get(/\.(?:js|css|svg|json|webmanifest)$/, statischGzip(PUBLIC_DIR));
app.use(express.static(PUBLIC_DIR));

/* ---------- Claude API (optioneel) ---------- */

let anthropic = null;
try {
  // De AI-uitwijk (server/ai.js): Claude eerst, dan OpenAI, dan Gemini; valt
  // een aanbieder uit (storing/429/5xx), dan neemt de volgende het over. Alleen
  // aanbieders met een sleutel doen mee; zonder enige sleutel blijft het demo.
  anthropic = require('./ai').maakAI({ log });
  if (anthropic) {
    i18n.setAnthropic(anthropic);
    console.log('Persoonlijke AI actief; aanbieders (op volgorde): ' + anthropic.aanbieders.join(', ') + '.');
  } else {
    console.log('Persoonlijke AI: demo-antwoorden (zet ANTHROPIC_API_KEY, OPENAI_API_KEY of GEMINI_API_KEY voor echte AI).');
  }
} catch (e) {
  console.warn('AI-client kon niet starten (' + (e && e.message) + '); demo-antwoorden actief.');
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

// Onze eigen web-push (server/webpush.js): VAPID + RFC 8291-payloadversleuteling
// op Node's crypto, i.p.v. het pakket `web-push`. Zelfde API, geen dependency.
let webpush = null;
try { webpush = require('./webpush'); } catch (e) { /* zonder push: alleen SSE */ }

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
  maakLive({ db, bus, nextSseId, PERSONAS, sseToSupplier, sseToOffice, findSupplier, haversine, etaMinutes, i18n, ordersVanKlant });
/* De ledengids (sleutel -> codenaam + pas) staat in server/kern/gids.js:
   dirTouch, ledental, opzoeken en zoeken op codenaam, met of zonder Postgres. */
const { GIDS_SEED_TIERS, dirTouch, ledenAantal, ledenAantalVerversen, gidsHaal, gidsZoekCodenaam, keyVanCodenaam } =
  require('./kern/gids')({ db, save, liveCodename, ledenGidsActief, ledenGidsHaal, ledenGidsZet, ledenGidsExact, ledenGidsZoek, ledenGidsAantal });
// Bij gedeelde data (Redis): na een externe wijziging de sessie-index opnieuw
// vullen, zodat een lezersproces tokens kent die de schrijver net aanmaakte.
onExternalChange(() => {
  ledenAantalVerversen(); // externe wijziging: ledental opnieuw bepalen
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

const ensureSupplierDefaults = require('./kern/supplierdefaults')({ db, ledenPrijs });

/* ---- De Salon is verplicht: elke partner doet zijn marketing, producten en
   folders via De Salon (niet in de leden-app). Een partner met een onvolledig
   Salon-profiel wordt NIET aan leden getoond en kan niets publiceren. Compleet =
   een bio en minstens een profielfoto (of een foto op de bedrijfspagina). */
function salonProfielCompleet(s) {
  const bio = ((s.salon && s.salon.bio) || '').trim();
  const heeftFoto = !!(s.salon && s.salon.foto) || (Array.isArray(s.photos) && s.photos.length > 0);
  return bio.length >= 15 && heeftFoto;
}
// De ondernemer-poort: de klaar-checklist en de online-schakelaar per zaak. Een
// zaak is pas zichtbaar/boekbaar voor leden als de Salon-pagina compleet is EN
// de zaak online staat (bestaande zaken zijn online tenzij expliciet uitgezet).
const ondernemerpoort = require('./kern/ondernemerpoort')({ salonProfielCompleet });
function salonZichtbaar(s) { return salonProfielCompleet(s) && s.online !== false; }
// hoeveel Salon-items (posts/folders/deals/polls) deze partner al plaatste
function salonItemsVan(code) { return db.data.posts.filter(p => p.partnerCode === code).length; }

function initRealtime() {
  require('./kern/initdata')({ db, save, crypto, sessions, tokenHash, ensureSupplierDefaults, webpush, DEMO, PERSONAS, GIDS_SEED_TIERS });
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
  // Hetzelfde adres als de boardroom- en kantoorpoort gebruiken (kern/eigenaar.js).
  // Stond hier eerder een eigen voorbeeldadres, waardoor de meldingen bij een
  // ander account uitkwamen dan de poort als eigenaar herkende.
  try { return accounts.findByLogin(eigenaar.eigenaarEmail()); } catch (e) { return null; }
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

/* De Wacht (kern/wacht.js): het immuunsysteem + de raadkamer. Leest zijn meters
   uit het schild (verzoeken, bans, actieve IP's, aanvalstreffers) en uit de
   beveiligingsmeldingen; de quarantaine wordt door het schild afgedwongen. Elke
   ~10 s een momentopname voor de grafiek. `wacht` is hierboven al gedeclareerd
   (het schild raadpleegt hem voor de quarantaine). */
wacht = require('./kern/wacht')({ db, save, beveilig, lees: schild.signalen });
// RTMAIL: het interne postsysteem (de rail voor de automatiseringen)
const rtmail = require('./kern/rtmail')({ db, save, crypto });
/* Teams: een adres dat meerderen samen lezen (receptie@partner.rtg). Krijgt de
   codenaam-lijst en het zaakregister mee om te toetsen of een adres nog vrij
   is -- een team mag nooit het postvak van een persoon of zaak kapen. */
const rtmailTeam = require('./kern/rtmail-team')({ db, save, crypto, rtmail, findSupplier,
  CODENAMES: require('./accounts/kluis').CODENAMES });
// De automatiseringen (draaiboeken) lopen over de RTMAIL-rail
const automatisering = require('./kern/automatisering')({ rtmail });
// Werkmail: het zakelijke adresboek per zaak boven op RTMAIL (domein <naam>.rtg,
// eigenaar- en managementadressen, rahul@<domein>, de buitenpost en -poort)
const { werkmail } = require('./kern/werkmail')({ db, save, crypto, rtmail, mail, accounts });
const atelierweb = require('./kern/atelierweb')({ db, save, crypto, schoon });
// de persoonlijke naamlaag: eigen etiketten op codenamen, alleen in het eigen account
const naamlaag = require('./kern/naamlaag')({ db, save, schoon });
const webmaker = require('./kern/webmaker')({ db, save, crypto, schoon });
// het welkom-draaiboek ook voor nieuwe RTF-profielen (foundation, eigen router)
try { rtf.setAutomatisering(automatisering); } catch (e) {}
{
  const t = setInterval(() => { try { wacht.meet(); } catch (e) {} }, 10000);
  if (t.unref) t.unref();
}

/* De Ontsmetter (kern/antivirus.js): de platform-malware-scanner. Elk bestand
   dat RTG binnenkomt wordt gescand (handtekeningen + heuristiek + entropie);
   besmette inhoud wordt geweigerd, gemeld op het bord, en de bron wordt via De
   Wacht ter afsnijding voorgesteld. */
const antivirus = require('./kern/antivirus')({ db, save, beveilig, wacht });

/* Universeel scan-net: elke schrijf-aanvraag wordt door De Ontsmetter gehaald.
   Zit er een BESMETTE beeld-/PDF-data-URL in de body (waar dan ook, hoe diep
   ook), dan weigeren we hem hier -- zo zijn ALLE upload-plekken (snaps, De Salon,
   markt, clips, en alles wat later bijkomt) in één klap gedekt zonder elke route
   apart aan te raken. Verdacht mag door (staat wel op het bord). /api/verify/*
   scant al expliciet; /api/techniek/* en health blijven ongemoeid. */
app.use((req, res, next) => {
  const m = req.method;
  if (m !== 'POST' && m !== 'PUT' && m !== 'PATCH') return next();
  const p = req.path || '';
  if (p.startsWith('/api/techniek') || p.startsWith('/api/verify') || p === '/api/health' || p === '/api/ready') return next();
  if (!req.body || (typeof req.body !== 'object' && typeof req.body !== 'string')) return next();
  try {
    const raak = antivirus.scanBody(req.body, { bron: req.ip, naam: p });
    if (raak) return res.status(422).json({ error: 'Dit bestand is geweigerd door de beveiliging (mogelijke malware).' });
  } catch (e) { /* een scanfout mag nooit een verzoek breken */ }
  next();
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
  // Alleen leden-sessies horen hier: een echt account, of een demo-pas met een
  // bekende persona-tier. Leverancier- en kantoor-sessies (met een eigen auth
  // en zonder tier) worden geweigerd i.p.v. verderop de ledengids te laten
  // crashen op een ontbrekende codenaam.
  if (!sess.account && !PERSONAS[sess.tier]) return res.status(401).json({ error: 'Niet ingelogd als lid.' });
  req.session = sess;
  // Handhaving van de eigen boardroom: heeft het lid (of, via de kind-sleutel,
  // de ouder) deze functie uitgezet, dan gaat de API ook echt dicht. Alles staat
  // standaard aan, dus dit raakt pas iets zodra iemand bewust iets omzet.
  const _fid = lidPadFunctie(req.path);
  if (_fid && sess.key && lidBoardUit(sess.key, _fid)) {
    return res.status(403).json({ error: 'Deze functie staat uit in je boardroom.', functieUit: _fid });
  }
  dirTouch(sess);
  next();
}

/* Schoonmaakhulp voor vrije tekstvelden: knipt op lengte en haalt < en >
   weg, zodat door gebruikers ingevoerde namen en berichten nooit als
   opmaak in andermans scherm kunnen belanden. */

/* De ledengids (dirTouch, ledenAantal, gidsHaal, gidsZoekCodenaam,
   keyVanCodenaam) staat in server/kern/gids.js en is hierboven, direct na de
   live-laag, opgezet. */

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
// De leden-kern wordt vóór de sociale laag gebouwd; deps.zijnVrienden wordt
// hieronder laat-gebonden gevuld zodra de vriendenlaag bestaat (voor de
// Salon-zichtbaarheid: van een vriend zie je een bericht altijd).
const lidDeps = { db, accounts, PERSONAS, findSupplier, i18n, rtf, talen, leeftijdVan, leeftijdsgroepVan, geborenVan };
const { hasContact, addContact, canEngage, engageError, registerContact, stateFor, myApplications } =
  maakLid(lidDeps);

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

/* De satelliet-ping en de /api/doos/-vloot (sleutelwacht, kloon, status,
   meting, buurmelding, rapport) staan in server/routes/doos.js en worden
   verderop met de andere routers gemount, nadat kern klaar is. De proxy- en
   journaallagen die elke aanvraag omhullen, staan hierboven. */

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
  // Echt klaar = de duurzame opslag is geladen. In Postgres-modus telt "geladen"
  // pas als de gedeelde data binnen is en het RAM-venster uit het grootboek is
  // bijgewerkt; zo krijgt een nog warmdraaiende instance nog geen verkeer van de
  // load balancer (het boot-bottleneck-risico bij een herstart onder druk).
  let klaar = dataOk;
  try { klaar = opslagKlaar(); } catch (e) { klaar = false; }
  let pool = null;
  try { pool = pgPoolStatus(); } catch (e) { pool = null; }
  res.status(klaar ? 200 : 503).json({
    ready: klaar, data: dataOk, writable: !!db.writable, store: STORE,
    ...(pool ? { pool } : {}),
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
// Het Journalistiek-genre (kern/journalistiek.js): redactie + eigen krantsite.
const journalistiek = require('./kern/journalistiek')({ db, save, crypto, schoon, findSupplier });
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
const facturatie = require('./kern/facturatie').maakFacturatie({ db, save, crypto, findSupplier, keyVanCodenaam, notify, notifySupplier, sseToCustomer, sseToSupplier, factuur, anthropic, schoon, automatisering });
// De marktplaats (kern/markt.js): één gedeelde motor voor de RTFoundation-app
// (gezinnen kopen/verkopen) en voor leveranciers die er ook op willen verkopen.
const markt = require('./kern/markt').maakMarkt({ db, save, crypto, anthropic, schoon, notify, notifySupplier, haversine, betaal });
rtf.setMarkt(markt);
const {
  dmSleutel, connectieTussen, isRtf, codeExists, codenaamVan, soortVan, isKindHandle, verbActief, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, sociaalRate, kindContacten, kindVerwijder, statusVan, socialZoek, socialVerbind, socialAntwoord, socialConnecties, socialDm, socialDmSend, zijnVrienden, socialTeKeuren, socialGoedkeur, geldigeFoto, opschonenSnaps, snapSturen, snapsVoor, snapOpenen, verhaalPlaatsen, verhalenVoor, verhaalBekijken
} = sociaal;
// laat-gebonden: de leden-kern (De Salon) mag nu de vriendschap tussen kijker en
// auteur nakijken, zodat je een bericht van een vriend altijd ziet
lidDeps.zijnVrienden = zijnVrienden;
/* De pro-laag over de agenda (kern/agenda-pro.js): kalenderbereik met
   herhalingen, uitnodigen op codenaam, herinneringen, ICS-export en de
   alleen-lezen laag met eigen RTG-boekingen. Ligt hier omdat hij
   codenaamVan uit de sociale kern nodig heeft. */
Object.assign(agenda, require('./kern/agenda-pro').maakAgendaPro({
  db, save, crypto, schoon, keyVanCodenaam, codenaamVan, sseToCustomer, boekingenVanKlant }));
/* Notities & Taken (kern/notities.js): het bord met notities en lijstjes.
   Krijgt de agenda mee, want een notitie met datum en tijd wordt een
   gekoppelde afspraak -- een wekkerlaag, niet drie. */
const notities = require('./kern/notities').maakNotities({
  db, save, crypto, schoon, keyVanCodenaam, codenaamVan, sseToCustomer }, agenda);
/* RTG Bestanden (kern/bestanden.js): de kluis. Bytes versleuteld op schijf
   (zelfde aanpak als media.js), alleen verwijzingen in de database. */
const bestanden = require('./kern/bestanden').maakBestanden({
  db, save, crypto, schoon, keyVanCodenaam, codenaamVan, sseToCustomer, dir: DATA_DIR });
/* RTG Meet (kern/meet.js): vergaderkamers op codenaam; de server geeft
   alleen WebRTC-seinen door, beeld en geluid lopen peer-to-peer. */
const meet = require('./kern/meet').maakMeet({
  db, save, crypto, schoon, keyVanCodenaam, codenaamVan, sseToCustomer });
/* RTG Galerij (kern/galerij.js): leest De Salon en RTG Bestanden; albums
   en favorieten zijn verwijzingen, nooit kopieen van de bytes. */
const galerij = require('./kern/galerij').maakGalerij({ db, save, crypto, schoon });
const boeken = require('./kern/boeken').maakBoeken({ db, save });
const onderwijs = require('./kern/onderwijs').maakOnderwijs({ db, save, schoon });
const leerstof = require('./kern/leerstof').maakLeerstof({ db, save, onderwijs });
const bijles = require('./kern/bijles').maakBijles({ winkel: () => (db.data.bijles = db.data.bijles || {}), save, schoon });
const vervolg = require('./kern/leerstof-vervolg').maakVervolg({ db, save, onderwijs });
/* RTG Klok (kern/klok.js): wekkers en timers die op de server aftellen,
   zoals de Thuiswacht -- en daardoor ook door Rahul te zetten. */
const klok = require('./kern/klok').maakKlok({
  db, save, crypto, schoon, sseToCustomer, sendPushToUser });
function geenGast(req, res) {
  // vrienden toevoegen, chatten en bellen kan met elk echt account, ook de
  // gratis laag (met paspoort). Alleen een anonieme demo-gast zonder account niet.
  if (req.session.tier === 'guest' && !req.session.account) { res.status(403).json({ error: 'Maak een gratis account (met paspoort) om vrienden toe te voegen en te chatten.' }); return true; }
  return false;
}
/* Is de identiteit RTG-geverifieerd? Een GRATIS account mag pas reserveren
   (en telt pas als volwassene) nadat RTG het paspoort echt gecontroleerd
   heeft; tot die tijd geldt de standaard "onder de 18". De betaalde passen
   lopen door de ballotage (aanmelden met paspoort) en houden hun bestaande
   rechten; een anonieme demo-gast zonder account telt nooit als bekend. */
function idGeverifieerd(sess) {
  if (!sess) return false;
  if (sess.tier !== 'guest') return true; // pas-leden: met paspoort geballoteerd
  if (!sess.account) return false;        // anonieme demo-gast
  const u = accounts.getUserById(sess.account.id);
  return !!u && u.verified === 'verified';
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
  // SSRF-afweer: het endpoint komt van de client en de server POST daar later
  // naartoe. Alleen https naar bekende push-diensten; anders weigeren en melden
  // (een intern/metadata-adres hier is een SSRF-poging).
  if (!ssrf.pushEndpointOk(sub.endpoint)) {
    if (beveilig) beveilig.meld('ssrf-push', 'kritiek',
      'Push-subscription met een niet-vertrouwd endpoint geweigerd (mogelijke SSRF): ' + String(sub.endpoint).slice(0, 120),
      { bron: 'user:' + (req.session.account ? req.session.account.id : req.ip) });
    return res.status(400).json({ error: 'Ongeldig push-endpoint.' });
  }
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
// Publiek en voor iedereen gelijk (alleen Boardroom-schakelaars sturen het), en
// bij elke app-boot geraakt: een response-cache haalt dit uit de staart. De
// sleutel is de handtekening van de actieve set, dus een taal aan/uit zetten
// verandert de sleutel en de cache is meteen ongeldig (geen staleness).
const talenCache = require('./lib/cache').antwoordCache({ ttl: 3600000, max: 8, sleutel: () => 'talen:' + talen.handtekening() });
// talen: de actieve set (voor autodetectie + vertaling) en de VOLLEDIGE wereld
// (alle 114, met een aan/uit-vlag) zodat de taalkiezer alle landvlaggen toont.
app.post('/api/talen', talenCache, (req, res) => res.json({ talen: talen.actieve(), alle: talen.alle() }));

/* ---------- RTG Zegel: bewijs zonder tonen (offline verifieerbaar) ----------
   Een lid bewijst een FEIT aan een partner (18+, geldig lid, welke pas) zonder
   de onderliggende data te tonen. Het zegel is een Ed25519-token dat de partner-
   /PDA-app met alleen de publieke sleutel controleert -- dus offline. Het
   onderwerp is een paarsgewijs pseudoniem: twee venues kunnen een lid niet
   matchen. Zie server/lib/zegel.js. */
const zegel = require('./lib/zegel').maakZegel({ dataDir: DATA_DIR });
// de publieke sleutel: hiermee verifieert een partner-app een zegel zonder server.
app.get('/api/zegel/sleutel', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ sleutel: zegel.publiekeSleutel(), alg: 'ed25519' });
});
// een lid maakt een momentbewijs voor een partner: alleen de GEVRAAGDE en WARE
// feiten gaan mee (selectieve onthulling); ruwe gegevens komen er nooit in.
app.post('/api/zegel/maak', auth, (req, res) => {
  const sess = req.session;
  const partner = typeof req.body.partner === 'string' ? req.body.partner.slice(0, 64) : null;
  const gevraagd = Array.isArray(req.body.claims) && req.body.claims.length ? req.body.claims : ['lid'];
  const lft = leeftijdVan(geborenVan(sess));
  const feiten = {
    lid: true,
    leeftijd18: lft != null && lft >= 18,
    leeftijd21: lft != null && lft >= 21,
    pas: sess.tier || (sess.account && sess.account.tier) || null,
    zakelijk: sess.tier === 'business'
  };
  const claims = {};
  for (const k of gevraagd) if (Object.prototype.hasOwnProperty.call(feiten, k) && feiten[k]) claims[k] = feiten[k];
  const seed = sess.key || (sess.account && sess.account.id) || 'onbekend';
  const geldigMin = Math.max(1, Math.min(60, Number(req.body.geldigMin) || 5));
  const token = zegel.zegel({ codenaam: seed, partner, claims, geldigMin });
  res.json({ token, claims, sub: zegel.pseudoniem(seed, partner), geldigMin });
});
// een partner/PDA controleert een zegel (kan ook offline met de publieke sleutel).
app.post('/api/zegel/controleer', (req, res) => {
  res.json(zegel.controleer(String((req.body && req.body.token) || '')));
});
// een leverancier voert een officiele ID-/leeftijdscontrole uit met het Zegel:
// de server verifieert opnieuw (vertrouwt de client niet) en legt de controle
// vast in het activiteitenlog. Nooit de echte naam, alleen het bewezen feit en
// het paarsgewijze pseudoniem; RTG staat er met de handtekening garant voor.
app.post('/api/supplier/zegel/check', supplierAuth, (req, res) => {
  const r = zegel.controleer(String((req.body && req.body.token) || ''));
  const claims = r.geldig ? (r.claims || {}) : {};
  const samenvatting = r.geldig
    ? (Object.keys(claims).map(k => k === 'pas' ? 'pas ' + claims[k] : k).join(', ') || 'geen claims')
    : ('afgewezen (' + (r.reden || 'ongeldig') + ')');
  logActivity(req.supplier.code, req.actor, 'ID-/leeftijdscheck via Zegel: ' + (r.geldig ? 'geldig · ' + samenvatting : samenvatting));
  res.json(r);
});
/* Aanwezigheid: elke receptie/entree ziet hoeveel mensen er binnen zijn en de
   verdeling man/vrouw. Bewust alleen GEAGGREGEERD -- nooit per persoon, nooit
   een naam. De deur telt op en af; bij het sluiten leeg je de teller. */
function aanwezigVan(code) { const a = db.data.aanwezig = db.data.aanwezig || {}; return a[code] = a[code] || { man: 0, vrouw: 0, onbekend: 0, updated: null }; }
function aanwezigTel(a) { return { man: a.man || 0, vrouw: a.vrouw || 0, onbekend: a.onbekend || 0, binnen: (a.man || 0) + (a.vrouw || 0) + (a.onbekend || 0), updated: a.updated }; }
app.post('/api/supplier/aanwezig', supplierAuth, (req, res) => res.json({ aanwezig: aanwezigTel(aanwezigVan(req.supplier.code)) }));
app.post('/api/supplier/aanwezig/pas', supplierAuth, (req, res) => {
  const a = aanwezigVan(req.supplier.code);
  const groep = ['man', 'vrouw', 'onbekend'].includes(req.body.groep) ? req.body.groep : null;
  if (!groep) return res.status(400).json({ error: 'Kies man, vrouw of onbekend.' });
  const delta = Math.max(-1, Math.min(1, parseInt(req.body.delta, 10) || 0));
  a[groep] = Math.max(0, (a[groep] || 0) + delta);
  a.updated = new Date().toISOString();
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'aanwezig' });
  res.json({ aanwezig: aanwezigTel(a) });
});
app.post('/api/supplier/aanwezig/leeg', supplierAuth, (req, res) => {
  const a = aanwezigVan(req.supplier.code);
  a.man = 0; a.vrouw = 0; a.onbekend = 0; a.updated = new Date().toISOString();
  save();
  logActivity(req.supplier.code, req.actor, 'zette de aanwezigheidsteller op nul');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'aanwezig' });
  res.json({ aanwezig: aanwezigTel(a) });
});
/* Het UI-woordenboek van een pagina in een keer naar een ACTIEVE wereldtaal:
   zo draait de hele app (elke pagina, elk scherm) in elke taal die de
   boardroom aanzet. Publiek maar begrensd (max 400 teksten van 300 tekens)
   en zwaar gecachet in de vertaallaag; met een AI-sleutel vertaalt Claude
   volledig, zonder sleutel valt hij terug op het woordenboek (nooit kapot). */
app.post('/api/vertaal/ui', async (req, res) => {
  try {
    const naar = talen.taalVan(req.body && req.body.naar);
    const teksten = (Array.isArray(req.body && req.body.teksten) ? req.body.teksten : []).slice(0, 400)
      .map(t => String(t == null ? '' : t).slice(0, 300));
    const uit = [];
    for (const t of teksten) uit.push((await i18n.translate(t, naar)).text);
    res.json({ ok: true, naar, teksten: uit });
  } catch (e) { res.status(500).json({ error: 'Vertalen lukte even niet. Probeer het opnieuw.' }); }
});

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
  req.actor = { name: sess.actor || 'Beheer', role: sess.staffRole || 'manager', staffId: sess.staffId || null, manager: !!sess.manager, lid: sess.lid || null, lidKey: sess.lidKey || null };
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
  tafelplanning, reserveringTafel, reserveringKomst, walkIn,
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
  verkoopTerug: retailVerkoopTerug,
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
  db, save, crypto, findSupplier, notify, notifySupplier, sseToSupplier, sseToCustomer, sseToOffice, anthropic,
  // geleverd bij een zaak: het keukenbrein boekt de regels als levering in
  // (kern.keuken bestaat op aanroepmoment; de kern-bag wordt verderop gevuld)
  bijGeleverd: (o) => {
    const zaak = findSupplier(o.klant.id);
    if (zaak && kern.keuken) kern.keuken.leverBinnen(zaak, o.regels, 'groothandel ' + o.groothandelNaam);
  }
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

/* De eigen boardroom per lid (kern/lidboard.js): elk lid zet zijn eigen
   functies aan/uit; een ouder/beheerder stuurt via dezelfde motor de boardroom
   van zijn beschermde kind bij (de route bewaakt het gezinsverband). */
const { LIDBOARD_CAPS, lidBoard, lidBoardZet, lidBoardAan, lidPadFunctie, lidBoardUit } = maakLidboard({ db, save });

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
  sseToSupplier, sseToOffice, leesUploadDataUrl, leeftijdVan, gidsHaal
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
const { financeVoor, cannedBoekhouder, dagrapport, shiftSamenvatting } = maakFiscaal({ db, centen, btwSplit });


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
/* De stemming van Rahul (kern/rahul/stemming.js) en de geloofslaag
   (kern/geloof/). Allebei nodig voordat de promptlaag wordt opgebouwd, want
   die draagt ze mee in elke system prompt. */
const stemming = require('./kern/rahul/stemming')({ db, save, crypto });
const geloof = require('./kern/geloof')({ accounts });
const { aiSystemPrompt, cannedAnswer, generateAiReply, convOf, memberSays, noteerBeurt, conciergeInbox } =
  maakAi({ db, PERSONAS, anthropic, accounts, broadcastSync, sseToOffice, i18n,
    stemmingVoor: (c) => stemming.stemmingVoor(c), geloofRegel: (key) => {
      const m = /^user-(\d+)$/.exec(String(key || ''));
      return m ? geloof.promptRegel(Number(m[1]), null) : null;
    } });

// De backoffice-laag draagt de AI-kern (conciergeInbox) mee, dus staat hij na maakAi.
const { officeAuth, boardroomAuth, boardroomLijst, boardroomBaas, boardroomWie, magBoardroom, officeState, pendingVerifications } = maakKantoor({
  db, sessionFor, eigenaar, accounts, findSupplier, connectedSupplierCodes,
  publicSupplier, conciergeInbox, beveilig, archief, grootAantal, ledenAantal
});

/* ================= DOORLOPEND GESPREK IN DE APP =================
   Elk lid heeft één doorlopend gesprek, volledig binnen de beveiligde RTG-app.
   RTG Pass wordt beantwoord door Rahul (AI); Lifestyle en Business gaan naar
   een menselijke concierge, die in de backoffice antwoordt. Er zijn geen externe
   berichtenkoppelingen (WhatsApp/Meta) meer: alle communicatie loopt via de app
   en de push-/e-maillaag van RTG zelf. */

/* ---------- domeinmodules: aparte routers op de gedeelde kern ----------
   Elk domein is een los bestand dat zijn routes op dezelfde app registreert en
   uitsluitend via deze kern met de gedeelde data en realtime praat. Zo kan een
   domein later als eigen proces draaien zonder de routecode te veranderen. */
const kern = {
  orderMetRef, ordersVanKlant, ordersVanZaak, ordersVoegToe,
  boekingMetRef, boekingenVanKlant, boekingenVanZaak, boekingenVoegToe,
  txLedgerActief, txLedgerVanKlant, txLedgerVanZaak, txLedgerTel, txLedgerAantal,
  AI_TONE, ALT_IDEE, AUTHOR_TIER, BOEK_KETEN, CLUSTER_KEY, CSP_NONCE, DATA_DIR, DEMO,
  DEMO_PASS, DEMO_SUPPLIER, DEMO_USER, DOOR_RELOCK_MS, FIN_CAT, FISCAAL_PEILJAAR, HK_STATUSES, LANDEN,
  OFFICE_CODE, PERSONAS, POS_METHODS, PRODUCTION, PUBLIC_DIR, RIT_KETEN, RIT_LEGACY, RIT_MELDING,
  RUN_STATIONS, SHIFT_NAMES, SSE_BUFFER_TTL, STAFF_SEED, TABLE_STATUSES, TOKEN_TTL_MS, UPLOAD_DIR, VAC_SOORTEN,
  ZAAK_OPTIES, ZZP, accounts, addContact, addTicket, aiFindDoor, aiFindRoom, archief, beveilig, wacht, rtmail, rtmailTeam, automatisering, werkmail, antivirus, atelierweb, webmaker, eigenaar, zaakdoos, naamlaag,
  aiSystemPrompt, alcoholGrensVan, anthropic, app, appUrl, applyChatPubliek, applyChatVertaald, auth, betaal, broadcastSync,
  bufferEvent, bus, canEngage, cannedAnswer, cannedBoekhouder, cateringDishes, centen, chatApplicant,
  chatKeyOf, chatStuur, checkCred, coachCache, coachRules, conciergeInbox, connectedSupplierCodes, convOf,
  crypto, cvReady, db, deptsFor, dirTouch, eisAccount, engageError, ensureApplyChat,
  ensureSupplierDefaults, etaMinutes, eventCovers, express, fallbackRunsheet, financeVoor, dagrapport, shiftSamenvatting, findPartner, findStaffPartner,
  findSupplier, forgetSession, fs, gcCode, geborenVan, geenGast, idGeverifieerd, generateAiReply, getChat,
  guestsFor, hasContact, hasCred, haversine, i18n, initRealtime, klokVan, ledenPrijs,
  leeftijdVan, leeftijdsgroepVan, leverSse, liveCodename, liveStateFor, load, logActivity, loginFails,
  mail, makeSupplierCode, managerOnly, media, meldWerkgever, memberSays, noteerBeurt, memberTemplate, myApplications, nextSseId, onboarding, boerderij, journalistiek, creator, samenwerking, agenda, notities, bestanden, meet, galerij, klok, boeken, onderwijs, leerstof, bijles, vervolg, facturatie, markt,
  noteFailedTry, notify, notifyApplicant, notifySupplier, officeAuth, boardroomAuth, boardroomLijst, boardroomBaas, boardroomWie, magBoardroom, officeState, openVacatures, optieAan,
  entreeCode, keyVanCodenaam, gidsHaal, gidsZoekCodenaam, magBezorgen, parseRunsheetText, path, pendingVerifications, pickupCode, pinFails, posDay, publicPartner, publicSupplier, ticketsVoorSlot,
  publicTrip, pushLive, registerContact, rememberSession, resolveSession, ritBezetting, ritVerder, rtf,
  runItem, runKey, salonNaarVolgers, salonProfielCompleet, salonZichtbaar, salonItemsVan, ...ondernemerpoort, save, scheduleFor, schoon, sectiesForOrder, sendPush,
  sendPushToUser, sessionFor, sessions, setRoomHk, sortRunsheet, speelOpnieuw, sseBuffer, sseClients,
  sseSend, sseToCustomer, sseToOffice, sseToSupplier, stateFor, stationsForOrder, supplierAuth, supplierState,
  toRad, tokenHash, tooManyTries, totpOk, trChat, trustVan, unlockDoor, urenVan, validDept, veiligGelijk, logInlog,
  zorgContact, klantSalon,
  // de stemming van Rahul + de geloofslaag (kern/rahul/stemming.js, kern/geloof/)
  geloof, stemmingToon: stemming.stemmingToon, stemmingZet: stemming.stemmingZet,
  stemmingVoor: stemming.stemmingVoor,
  webpush, weekdagFactor, werkgeverSollicitatie,
  // de ervaring-laag (kern/ervaring.js)
  MELDING_SCOPES, reserveerTafel, mijnReserveringen, annuleerReservering, beslisReservering,
  tafelplanning, reserveringTafel, reserveringKomst, walkIn,
  annuleerItem, plaatsReview, reviewsVoor, ratingVan, reviewReageer, toggleFavoriet, favorietenVan, isFavoriet,
  fooiUit, agendaVoor, maakSplits, mijnSplitsen, betaalSplits, zetOpWachtlijst, mijnWachtlijst,
  meldWachtlijst, rsvpAnnuleer, puntenVan, verdienPunten, verzilverPunten, pasTegoedToe,
  voorkeurVan, zetVoorkeur,
  // de retail-/mode-laag (kern/retail.js)
  RETAIL_MATEN, RETAIL_SEIZOENEN, retailIsRetail, zetCollectie, zetArtikel, pasVoorraad, releaseDrop,
  klantProfiel, zetKlantMaten, voegKlantnotitie, wishlistToggle, legApart, mijnApart,
  vraagPaskamer, paskamerBreng, stuurStyling, mijnStyling, retailVerkoop, retailVerkoopTerug, voorraadZoek,
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
  LIDBOARD_CAPS, lidBoard, lidBoardZet, lidBoardAan,
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
/* Tafelticket (kern/tafelticket.js): de bonnen van dezelfde tafel op een
   gezegeld ticket (HMAC), met verse controle bij het afrekenen. De AI en de
   kassa lopen over dezelfde /api/supplier/tafelticket-route. */
Object.assign(kern, { tafelticket: require('./kern/tafelticket')({ crypto, dataDir: DATA_DIR, findSupplier, ordersVanZaak }) });
// De dynamische, gesloten RTG-code: HMAC-ondertekende, kort houdbare tokens die
// alleen ons systeem maakt en verifieert (dyncode.key, 0600, in .gitignore).
Object.assign(kern, { dyncode: require('./kern/dyncode')({ crypto, dataDir: DATA_DIR }) });
/* Spellen (kern/spellen.js): mens-erger-je-niet, schaken, woordduel en het
   Sneek-scorebord op de vriendenlaag; RTF- en RTG-leden spelen tegen elkaar. */
Object.assign(kern, require('./kern/spellen')({
  db, save, crypto, zijnVrienden: kern.zijnVrienden, codenaamVan: kern.codenaamVan, sseToCustomer,
  isGeblokkeerd: kern.isGeblokkeerd, socialZoek: kern.socialZoek, sociaalRate: kern.sociaalRate,
  // Rahul als spelmaatje: praat met een echte sleutel, valt anders terug op vaste tips
  anthropic,
  // 18+ (voor Proost): alleen een echt account met paspoort-geboortedatum telt;
  // RTF-gezinsprofielen hebben geen geverifieerde leeftijd en doen nooit mee
  volwassen: (handle) => {
    const m = /^user-(.+)$/.exec(String(handle || ''));
    const geboren = m ? ((accounts.getMemberState(m[1]) || {}).geboren || null) : ((PERSONAS[handle] || {}).geboren || null);
    const lft = leeftijdVan(geboren);
    return lft != null && lft >= 18;
  }
}));
/* RTG Veilig (kern/veilig/): de ruggengraat onder vier apps -- Thuiswacht
   ("ik ben over X minuten thuis"), het stille Codewoord, de Vitale check-in
   en Thuisrust ("niet storen tot thuis").

   De dodemansknop telt op de klok van DEZE server, niet in de app. Dat is de
   hele reden dat het werkt als de telefoon uitvalt: geen levensteken is zelf
   het signaal. Zie kern/veilig/wacht.js. */
function meldAan(handle, note) {
  if (!handle) return null;
  const n = { id: crypto.randomBytes(4).toString('hex'), read: false, at: new Date().toISOString(), ...note };
  /* De veiligheidsbaan: een rust-stand ("niet storen") mag een
     veiligheidsmelding NOOIT tegenhouden. Daarom vraagt deze poort het
     expliciet, in plaats van de gewone meldingsvoorkeuren te volgen. */
  if (kern.rustMagDoor && !kern.rustMagDoor(handle, n)) return n;
  db.data.notifications[handle] = (db.data.notifications[handle] || []);
  db.data.notifications[handle].unshift(n);
  db.data.notifications[handle] = db.data.notifications[handle].slice(0, 40);
  save();
  sseToCustomer(handle, 'notify', n);
  sseToCustomer(handle, 'veilig', n);          // de vier apps luisteren hierop
  try { sendPush(handle, n); } catch (e) { /* push mag een alarm nooit tegenhouden */ }
  const m = /^user-(.+)$/.exec(String(handle));
  if (m) { try { sendPushToUser(m[1], n); } catch (e) {} }
  return n;
}
Object.assign(kern, require('./kern/veiligheid')({
  db, save, crypto, schoon, mail,
  kluis: require('./accounts/kluis'),
  sociaal: { codenaamVan: kern.codenaamVan, zijnVrienden: kern.zijnVrienden },
  meldAan,
  appUrl: () => process.env.APP_URL || ''
}));
kern.meldAan = meldAan;

/* Rahul kijkt mee (kern/kijken.js): een foto van iets, en hij zegt wat het is.
   De foto wordt nergens bewaard; zie de kop van die module. */
Object.assign(kern, require('./kern/kijken').maakKijken({ anthropic }));

/* Het salongesprek (kern/kletspraat/): de Rahul van het ene lid kletst met de
   Rahul van een vriend over hoe hun dag was. Een gimmick met drie sloten:
   alleen tussen vrienden, alleen als beiden het aan hebben staan, en altijd
   met verzonnen plaatsnamen. Zie de kop van die module. */
Object.assign(kern, require('./kern/kletspraat')({
  db, save, crypto,
  sociaal: { codenaamVan: kern.codenaamVan, zijnVrienden: kern.zijnVrienden },
  ordersVanKlant, boekingenVanKlant, anthropic,
  dagContext: require('./kern/context').dagContext, sseToCustomer
}));
/* De sweep: elke halve minuut kijken of er een wacht is afgelopen. Dit is de
   klok die doortikt terwijl de telefoon van het lid uit staat. De overgangen
   zijn idempotent (elke stap kijkt eerst naar de huidige status), dus een
   dubbele sweep levert hooguit een dubbele melding op, nooit een dubbele
   toestand. */
setInterval(() => { try { kern.veiligSweep(); } catch (e) { console.error('[veilig] sweep:', e.message); } }, 30 * 1000).unref();

/* De leerlaag (kern/leren.js): overhoorlijsten, het overhoorduel, samen aan
   projecten en schrijven met buddy-feedback; RTF- en RTG-leden doen samen mee. */
Object.assign(kern, require('./kern/leren')({
  db, save, crypto, codenaamVan: kern.codenaamVan, zijnVrienden: kern.zijnVrienden, socialZoek: kern.socialZoek,
  isGeblokkeerd: kern.isGeblokkeerd, sociaalRate: kern.sociaalRate, sseToCustomer, anthropic, leeftijdInstr: rtf.leeftijdInstr
}));
/* Het babyboekje (kern/baby.js): het dagboek van de allerkleinsten, met
   gezinsnamen en AI-gezinsmomenten; foto's gaan naar de mediastore. */
Object.assign(kern, require('./kern/baby')({ save, crypto, media, anthropic }));
/* De welzijnslaag (kern/welzijn.js): het prive-gevoelsdagboek van een kind;
   niemand leest mee, het scherm wijst zelf warm de weg naar hulp. */
Object.assign(kern, require('./kern/welzijn')({ save }));
/* De RTG-kantoren (kern/afdelingen.js): twaalf afdelingskamers en de
   boardroom die alles ziet en het functieschakelbord bedient. */
Object.assign(kern, require('./kern/afdelingen')({ db, save, crypto, anthropic, ledenAantal, accounts, keyVanCodenaam }));
/* RTG Atelier (kern/atelier.js): het besloten ontwerpbureau van de kantoren
   voor mode en alles wat je aan het lijf draagt. AI tekent concepten uit,
   levert tech packs en de blik van de creatief directeur; het palet komt als
   naam + hex mee zodat het scherm een moodboard toont. */
Object.assign(kern, require('./kern/atelier').maakAtelier({ db, save, crypto, anthropic, schoon }));
/* RTG Ontwerpstudio (kern/studio.js): de tegenhanger van het Atelier voor
   alles wat je beweegt: automotive, jachten & boten, luchtvaart en
   helikopters. AI tekent het concept uit, levert een specsheet en de blik
   van de chef-ontwerper. */
Object.assign(kern, require('./kern/studio').maakStudio({ db, save, crypto, anthropic, schoon }));
/* RTG Hardwarelab (kern/hardwarelab.js): de derde ontwerptak, voor de eigen
   apparaten: PDA's en tablets, schermen, sensoren, de zaakdoos-familie en
   accessoires. AI tekent het concept uit, levert een stuklijst en de blik
   van de chef-engineer. */
Object.assign(kern, require('./kern/hardwarelab').maakHardwarelab({ db, save, crypto, anthropic, schoon }));
/* RTG Architectenbureau (kern/architect.js): de vierde ontwerptak, voor het
   gebouwde: villa's, penthouses, landgoederen, chalets en paviljoens. AI tekent
   het concept uit, levert een bouwstaat en de blik van de chef-architect. */
Object.assign(kern, require('./kern/architect').maakArchitect({ db, save, crypto, anthropic, schoon }));
/* RTG Werkplaats (kern/werkplaats.js): het app-bureau van de kantoren. Bedenkt
   nieuwe apps en verbetert bestaande apps, de Bibliotheek en de App Store met AI
   (advies; een mens beslist en bouwt). */
Object.assign(kern, require('./kern/werkplaats').maakWerkplaats({ db, save, crypto, anthropic, schoon }));
/* De RTG Mall (kern/mall.js): de luxe shoppingmall in de leden-app; een
   gecureerde etagelijst van de retail-partners, elk met een eigen catalogus. */
Object.assign(kern, require('./kern/mall').maakMall({ db, save, crypto, isRetail: kern.retailIsRetail }));
/* De App-Bibliotheek (kern/appbieb.js): 20.000 professionele apps in de Mall,
   elk rond de duizend euro winkelwaarde, voor leden inbegrepen bij de pas. */
Object.assign(kern, require('./kern/appbieb').maakAppbieb({ db, save }));
/* De Reis-Bibliotheek (kern/reisbieb): echte, leesbare bestemmingsgidsen van
   eigen redactie; open voor iedereen die is aangemeld. */
Object.assign(kern, require('./kern/reisbieb').maakReisBieb({ db, save }));
/* De RTF App-Bibliotheek (kern/rtfbieb.js): de echte, gratis kind- en
   gezinsapps van de stichting; de kern staat hier al zodat de Mall
   (routes/member) hem ook kan tonen. */
Object.assign(kern, require('./kern/rtfbieb').maakRtfBieb({ db, save }));
/* De Geloof & Wijsheid-Bibliotheek (kern/geloofbieb.js): een miljoen boeken en
   apps over alle religies en levensbeschouwingen, als gelijken naast elkaar,
   respectvol en gratis; met dezelfde leeftijdspoort als de app-bibliotheek. */
Object.assign(kern, require('./kern/geloofbieb').maakGeloofBieb({ db, save }));
/* Het RTF-kantoor (kern/rtfkantoor.js): het eigen kantoor van de stichting,
   een spiegel van de RTG-kantoorstructuur; met de Clubs & steden-afdeling
   (kern/rtfclubs.js: samenwerking met grote (sport)clubs per stad) en het
   RTG Onderzoekslab (kern/onderzoekslab.js: hardware, software, dorpshulp,
   landbouw en onderzoek naar onderzoek, met een menselijke veiligheidstoets). */
Object.assign(kern, require('./kern/rtfkantoor')({ db, save, crypto, anthropic }));
Object.assign(kern, require('./kern/rtfclubs')({ db, save, crypto }));
Object.assign(kern, require('./kern/onderzoekslab')({ db, save, crypto, anthropic }));
// De Stadsraad: per stad een invloedrijke partner die in het gezamenlijke
// foundation-kantoor mee beslist over de lab-uitslagen
Object.assign(kern, require('./kern/stadsraad')({ db, save, crypto }));
/* RTG Payroll (kern/payroll.js): het loonkantoor draait op wat het platform
   al weet -- de klok, de rollen en de fiscale landtabellen. */
Object.assign(kern, require('./kern/payroll')({ db, save, crypto, accounts, LANDEN, klokVan, openVacatures, findSupplier }));
Object.assign(kern, require('./kern/labfonds')({ db, save, crypto, anthropic }));
/* De werkplek (kern/werkplek.js): RTG en RTF als twee aparte huizen om in te
   werken. Ze delen het platform, maar niet hun cijfers, hun bezetting of hun
   takenlijst; wie binnenkomt kiest eerst een huis. */
Object.assign(kern, require('./kern/werkplek')({ db, save, crypto }));
/* Aanmeldingen (kern/aanmeldingen.js): de aanmelding per pas is geheel
   geautomatiseerd (berichten, onboarding, rondleiding, RTF, veiligheid, privacy);
   alleen het accepteren of afwijzen blijft mensenwerk. De AI kent nooit zelf
   Lifestyle/Business toe. */
Object.assign(kern, require('./kern/aanmeldingen')({ db, save, crypto, schoon, accounts,
  // laat gebonden: de geld-regie wordt verderop gemount; bij het accepteren
  // (request-tijd) is kern.geldPasprijzen al beschikbaar voor het betaalschema.
  geldPasprijzen: () => (kern.geldPasprijzen ? kern.geldPasprijzen() : null) }));
/* De pestgrens (kern/pestgrens.js): drie waarschuwingen bij pesten, dan een
   vurig slotantwoord en 24 uur weg; daarna opent alleen een excuus de deur. */
Object.assign(kern, require('./kern/pestgrens')({ db, save }));
/* De RTG Food Court (kern/foodcourt.js): alle restaurants op een rij, in de
   stijl van een reserveerplatform; kies datum en gezelschap en zie de vrije
   tijdsloten. Reserveren loopt via het bestaande /api/reserveer. */
Object.assign(kern, require('./kern/foodcourt').maakFoodcourt({ db, save, crypto }));
/* Het RTG-reisbureau (kern/reisbureau.js): een echt reisbureau in de leden-app;
   leden bladeren door de samengestelde reizen en vragen er een aan tegen de
   nettoprijs. De aanvraag landt bij een RTG-reisadviseur (aangevraagd, mens
   bevestigt). */
Object.assign(kern, require('./kern/reisbureau').maakReisbureau({ db, save, crypto, anthropic }));
/* De losse verblijf-pagina (kern/logies.js): hotels, appartementen en villa's
   op een rij met hun vrije kamers; boeken loopt via /api/verblijf. */
Object.assign(kern, require('./kern/logies').maakLogies({ db }));
/* De losse uitgaan-pagina (kern/uitgaan.js): bars, clubs en beachclubs met hun
   avonden; aanmelden loopt via /api/event/rsvp. */
Object.assign(kern, require('./kern/uitgaan').maakUitgaan({ db, save, crypto }));
/* RTG Gemeente (kern/gemeente.js): het civiele systeem als partner-genre.
   Vier pijlers (meldingen openbare ruimte, burgerzaken/afspraken, vergunningen,
   afval/belasting/bestuur) voor inwoners, gemeente-medewerkers en partners. */
Object.assign(kern, require('./kern/gemeente').maakGemeente({ db, save, crypto, anthropic,
  findSupplier, notify, notifySupplier, sseToSupplier }));
// de gemeente-partner en zijn config bestaan meteen bij het opstarten, zodat een
// medewerker kan inloggen ook zonder dat er eerst een inwoner iets deed
kern.gemeente.seed();
/* De Overheid (kern/overheid.js): de landelijke laag naast de gemeente ·
   Berichtenbox, Belastingdienst (aangifte + toeslagen), RDW (voertuig +
   rijbewijs), KVK-ondernemersloket, sociale zekerheid (UWV/SVB) en een
   referendum, voor inwoners, ondernemers en rijksambtenaren. */
Object.assign(kern, require('./kern/overheid').maakOverheid({ db, save, crypto, anthropic,
  findSupplier, notify, notifySupplier, sseToSupplier }));
kern.overheid.seed();
// de RTG-vloot (autoverhuur, tweewielers) meteen in het RDW-register, zodat een
// kenteken-check op een huurauto de APK-status teruggeeft
kern.overheid.registreerVloot();
/* RTG Airport (kern/luchthaven.js): de gehele luchthavenoperatie ·
   vluchtleiding, passagiersketen (boeken/inchecken op codenaam), de draai op
   het platform, de toren (baanklaring), de bagagekelder en security. */
Object.assign(kern, require('./kern/luchthaven').maakLuchthaven({ db, save, crypto, anthropic }));
kern.lucht.seed();
/* De Brigade RTG Airport (kern/marechaussee.js): de Koninklijke Marechaussee
   op het veld · grensbalie (passagierslijst op codenaam), patrouilles,
   incidenten en de AI-wachtcommandant. */
Object.assign(kern, require('./kern/marechaussee').maakMarechaussee({ db, save, crypto, anthropic }));
kern.kmar.seed();
/* De documentenuitgifte (kern/uitgifte.js): officiele documentatie met een
   druk op de knop overschrijven naar oude apparatuur of een harde schijf,
   altijd achter het vier- of zes-ogenprincipe (zaak, RTG-kantoor, rijk). */
Object.assign(kern, require('./kern/uitgifte').maakUitgifte({ db, save, crypto }));
/* RTG Sportclub (kern/sportclub.js): het stadion met eigen plattegrond,
   tickets met horeca en wc's, teams van jeugd tot eerste, veldbeheer,
   trainingskampen (RTG beslist), sponsors, momenten en de financien. */
Object.assign(kern, require('./kern/sportclub').maakSportclub({ db, save, crypto, anthropic }));
kern.sport.seed();
/* RTG contentbescherming (kern/drm.js): de DRM-route (Encrypted Media
   Extensions, Clear Key door RTG zelf bediend) voor de beschermde media. */
Object.assign(kern, require('./kern/drm').maakDrm({ db, save, crypto }));
/* De Ideeenkamer (kern/ideeen.js): de gedeelde werkbank van de vier
   ontwerpbureaus; een idee kan als concept naar elk bureau (spin-off), dus de
   bureaus gaan als referenties mee. */
/* RTG Redactie (kern/redactie.js): het persbureau -- krant, magazine en
   drukkerij, met de AI-hoofdredacteur en de nieuwstips uit het hele platform.
   Doet als volwaardig bureau mee in de Ideeenkamer hieronder. */
Object.assign(kern, require('./kern/redactie').maakRedactie({ db, save, crypto, anthropic, schoon }));
Object.assign(kern, require('./kern/ideeen').maakIdeeen({ db, save, crypto, anthropic, schoon,
  bureaus: { atelier: kern.atelier, studio: kern.studio, hardware: kern.hardware, architect: kern.architect, redactie: kern.redactie } }));
/* Dezelfde zes bureaus nog een keer, nu voor de RTFoundation. De modules
   blijven onaangeraakt; ze krijgen via kern/huisdb.js alleen een andere bril op
   waardoor hun opslagsleutel naar een eigen la wijst (atelier -> atelierRtf).
   Zo ontwerpt de stichting in haar eigen atelier, studio, hardwarelab,
   architectenbureau, redactie en ideeenkamer, zonder dat het werk van RTG en
   dat van de stichting op een hoop belandt. */
const { huisDb, RTF_OMLEIDING, huisNaam } = require('./kern/huisdb');
const rtfBureauCtx = { db: huisDb(db, RTF_OMLEIDING), save, crypto, anthropic, schoon };
Object.assign(kern, huisNaam(require('./kern/atelier').maakAtelier(rtfBureauCtx), 'Rtf'));
Object.assign(kern, huisNaam(require('./kern/studio').maakStudio(rtfBureauCtx), 'Rtf'));
Object.assign(kern, huisNaam(require('./kern/hardwarelab').maakHardwarelab(rtfBureauCtx), 'Rtf'));
Object.assign(kern, huisNaam(require('./kern/architect').maakArchitect(rtfBureauCtx), 'Rtf'));
Object.assign(kern, huisNaam(require('./kern/redactie').maakRedactie(rtfBureauCtx), 'Rtf'));
Object.assign(kern, huisNaam(require('./kern/ideeen').maakIdeeen(Object.assign({}, rtfBureauCtx, {
  bureaus: { atelier: kern.atelierRtf, studio: kern.studioRtf, hardware: kern.hardwareRtf,
    architect: kern.architectRtf, redactie: kern.redactieRtf } })), 'Rtf'));
/* De hulpdiensten (kern/hulpdienst.js): zes korpsen met een meldkamer,
   eenheden over land, water en door de lucht, bijstand tussen korpsen en
   de zorgketen ambulance -> ziekenhuis -> huisarts. */
Object.assign(kern, require('./kern/hulpdienst')({ db, save, crypto, anthropic, findSupplier }));
/* De zorgketen (kern/zorgketen.js): recepten naar de apotheek, de eerste
   hulp met triagekleuren, verwijzingen en de agenda's van de specialist en
   beauty medical. */
Object.assign(kern, require('./kern/zorgketen')({ db, save, crypto, findSupplier }));
/* De ketenchat (kern/ketenchat.js): korpsen verbinden eenmalig, delen een
   ketenkanaal en maken besloten deelgroepen waar de meldkamer meekijkt. */
Object.assign(kern, require('./kern/ketenchat')({ db, save, crypto, findSupplier }));
/* De defensie-toren (kern/defensie.js): paraatheid, materieel en onderhoud,
   bevoorrading en oefeningen. Logistiek en organisatie, uitdrukkelijk GEEN
   wapensysteem, vuurleiding of doelselectie. */
Object.assign(kern, require('./kern/defensie')({ db, save, crypto, anthropic, findSupplier }));
/* Het gezamenlijke rampbeeld (kern/rampbeeld.js): korpsen, zorg en defensie
   delen tijdens een calamiteit hun paraatheid, vrije bedden en eenheden in
   een overzicht, met een coordinatieniveau. */
Object.assign(kern, require('./kern/rampbeeld')({ db, save, findSupplier, anthropic }));
/* Vakwerk (kern/vakwerk.js): het slimme dashboard voor de dienstverlenende
   genres (zzp, chef, wellness). Zelfde aanbod-/boekingsmodel als voorheen,
   maar met een vandaag-bord, KPI's en een genre-bewuste AI-assistent, zodat
   deze apps op het niveau van de horeca- en hoteltorens komen. */
Object.assign(kern, require('./kern/vakwerk').maakVakwerk({ db, save, anthropic, findSupplier, boekingenVanZaak, schoon,
  crypto, notify, notifySupplier, sseToCustomer, sseToSupplier, boekingenVoegToe }));
/* RTG Pay (kern/pay.js): de interne betaallaag met wallet, grootboek,
   tikkies, kassacode en automatisch bijladen via de betaal-naad. */
Object.assign(kern, require('./kern/pay')({ db, save, crypto, betaal, keyVanCodenaam, sseToCustomer, schoon,
  // de geld-regie bepaalt het tarief; als thunk zodat de mount-volgorde niet uitmaakt
  betaaldienstKosten: c => (kern.betaaldienstKosten ? kern.betaaldienstKosten(c) : 0) }));
/* Het keukenbrein (kern/keuken.js): recepten per gerecht, automatische
   voorraad-afboeking bij elke verkoop, telling/verspilling/levering met
   logboek, marges en het inkoopadvies. */
Object.assign(kern, require('./kern/keuken')({ db, save, crypto, schoon, notifySupplier }));
/* De verblijf-laag (kern/verblijf.js): echte verblijven met datums, het
   receptiebord en de check-in/check-out-keten; logies als kamerlast. */
Object.assign(kern, require('./kern/verblijf')({ db, save, crypto, schoon, findSupplier, notify, notifySupplier, sseToSupplier, sseToCustomer }));
/* Het hoteldorp (kern/hoteldorp.js): negen afdelingen met hetzelfde lichte
   gereedschap: postenlijsten met een eigen statusketen, en het dorpsplein. */
Object.assign(kern, require('./kern/hoteldorp')({ db, save, crypto, schoon, sseToSupplier, notifySupplier, haversine }));
// de zorgvolle keten: zorgprofiel van de gast + live meekijken met toestemming
Object.assign(kern, require('./kern/gastzorg')({ db, save, crypto, schoon, notify, notifySupplier, sseToSupplier, sseToCustomer, findSupplier, haversine, etaMinutes }));
// Toren 3, RTG Shared Assets: 300 tickets per object, Access en Asset
Object.assign(kern, require('./kern/assets')({ db, save, crypto, schoon, notify, pay: kern.pay }));
// De Rechterhand: de premium Lifestyle Pass-suite (concierge, bezittingen, gezondheid)
Object.assign(kern, require('./kern/lifestyle')({ db, save, crypto, anthropic, liveCodename, notify }));
// De extra premium ROS-apps van de Lifestyle Pass: Reisboek, Cellier, Table, Maison
Object.assign(kern, require('./kern/rechterhand')({ db, save, crypto, liveCodename, anthropic, DATA_DIR }));
/* Het Huis: het reisdossier achter de hoofdingang. Leest alleen wat er al is --
   de eigen reis van het lid, en de papieren die Entourage al bewaakt. Die grens
   wordt daar berekend en hier niet nog een keer: een limiet hoort op één plek. */
kern.huis = require('./kern/huis')({
  reisVan: (sess) => (sess && sess.account
    ? (accounts.getMemberState(sess.account.id) || {}).trip
    : (sess && sess.tier !== 'guest' ? db.data.trip : null)) || null,
  entourageVan: (sess) => { try { return kern.entourage(sess.key); } catch (e) { return null; } }
});
// Rendez-vous: de besloten AI-datingapp van de Lifestyle Pass (match -> jetset-date)
Object.assign(kern, require('./kern/rendezvous')({ db, save, crypto, liveCodename, anthropic, notify }));
// De wauw-laag: stemming, verjaardagsglans en De Terugblik over alle socials
Object.assign(kern, require('./kern/wauw')({ db, save, accounts, socialConnecties: kern.socialConnecties }));
// RTG Pulse: het eigen 9+-microblog (chronologisch, zonder verslavende trucs)
Object.assign(kern, require('./kern/pulse')({ db, save, crypto, liveCodename, notify,
  stemmingVan: kern.stemmingVan, jarigVan: kern.jarigVan }));
/* De Salon als volwaardige app: leden die zelf plaatsen (karrousel, onderwerpen),
   een feed met echte paginering in plaats van het oude plafond van 60, profielen
   op codenaam met volgen tussen leden, reacties met antwoorden en vermeldingen,
   bewaren, de veiligheidsknoppen, en drie AI-taken die voorstellen maar nooit
   plaatsen. De zichtbaarheidspoort blijft kern/salonviraal.js. */
kern.salon = require('./kern/salon')({ db, save, media, liveCodename, codenaamVan: kern.codenaamVan,
  crypto, broadcastSync });
kern.salonProfiel = require('./kern/salon/profiel')({ db, save, codenaamVan: kern.codenaamVan,
  keyVanCodenaam: kern.keyVanCodenaam, liveCodename, salon: kern.salon });
kern.salonReacties = require('./kern/salon/reacties')({ db, save, liveCodename, codenaamVan: kern.codenaamVan,
  keyVanCodenaam: kern.keyVanCodenaam, zijnVrienden: kern.zijnVrienden, salon: kern.salon, notify });
kern.salonAI = require('./kern/salon/ai')({ anthropic, salon: kern.salon });
kern.salonInzicht = require('./kern/salon/inzicht')({ db, save, salon: kern.salon });

/* Métier (kern/metier/): de beroepskant. Het profiel draait op de codenaam, RTG
   bevestigt alleen wat het echt zag (de bewezen rollen komen uit de sleutelbos
   van kern/eenaccount.js) en de echte naam geeft het lid per werkgever vrij uit
   de kluis -- intrekbaar, met een eigen inzagelog. Zie kern/metier/bewijs.js. */
kern.metier = require('./kern/metier')({ db, save, liveCodename, codenaamVan: kern.codenaamVan, findSupplier });
kern.metierZoek = require('./kern/metier/zoek')({ codenaamVan: kern.codenaamVan, metier: kern.metier, PAGINA: kern.metier.PAGINA });
kern.metier.zoek = kern.metierZoek.zoek;
kern.metierBewijs = require('./kern/metier/bewijs')({ db, save, accounts, codenaamVan: kern.codenaamVan,
  keyVanCodenaam, findSupplier, notifySupplier, notify });
kern.metierNetwerk = require('./kern/metier/netwerk')({ db, save, codenaamVan: kern.codenaamVan,
  keyVanCodenaam, zijnVrienden: kern.zijnVrienden, liveCodename, notify, metier: kern.metier });
kern.metierAI = require('./kern/metier/ai')({ anthropic, metier: kern.metier, netwerk: kern.metierNetwerk });
kern.metierLoon = require('./kern/metier/loon')({ db });

/* Genootschap (kern/genootschap/): besloten groepen van leden, met een prikbord
   en bijeenkomsten. Bewust een EIGEN app en geen verbouwing van Cercle (het
   register van je societeiten) of Rendez-vous (de datingdienst van de Lifestyle
   Pass); zie de kop van kern/genootschap/index.js voor waarom. */
kern.genootschap = require('./kern/genootschap')({ db, save, codenaamVan: kern.codenaamVan,
  keyVanCodenaam, liveCodename, notify, zijnVrienden: kern.zijnVrienden });
kern.genootschapBeheer = require('./kern/genootschap/beheer')({ save, codenaamVan: kern.codenaamVan,
  keyVanCodenaam, genootschap: kern.genootschap });
kern.prikbord = require('./kern/genootschap/prikbord')({ db, save, codenaamVan: kern.codenaamVan,
  liveCodename, notify, genootschap: kern.genootschap });
kern.bijeenkomst = require('./kern/genootschap/bijeenkomst')({ db, save, codenaamVan: kern.codenaamVan,
  notify, genootschap: kern.genootschap });
kern.genootschapAI = require('./kern/genootschap/ai')({ anthropic, genootschap: kern.genootschap,
  prikbord: kern.prikbord, bijeenkomst: kern.bijeenkomst });
kern.genootschapInzicht = require('./kern/genootschap/inzicht')({ db, save, genootschap: kern.genootschap,
  prikbord: kern.prikbord, bijeenkomst: kern.bijeenkomst });
kern.genootschapUitvoer = require('./kern/genootschap/uitvoer')({ genootschap: kern.genootschap,
  codenaamVan: kern.codenaamVan });
/* De Berichten-app: zoeken over alle kanalen, gesprekken vastzetten/stilzetten/
   archiveren, en de drie AI-taken (samenvatten, een antwoord opstellen, de
   afspraken eruit halen). De AI stelt op, de mens verstuurt. */
kern.berichten = require('./kern/berichten')({ db, save, socialConnecties: kern.socialConnecties,
  dmSleutel: kern.dmSleutel, codenaamVan: kern.codenaamVan, rtmail, overheid: kern.overheid, anthropic });
// Toren 4: RTG Care (zorg & welzijn). Behandelingen boeken met het zorgprofiel
// dat meereist en een aparte, veilige intake-deling per aanbieder.
Object.assign(kern, require('./kern/care')({ db, save, crypto, schoon, notify, zorgVoor: kern.zorgVoor }));
// Fluister: de persoonlijke assistent met geheugen (weetjes + focus)
/* Geldregie (kern/geldregie.js): RTG bepaalt de geldkant vanuit de boardroom:
   pasprijzen (publiek zichtbaar), de interne partnervergoeding per genre of
   zaak, en het RTG-ledenvoordeel per genre (RTG legt bij; de nettoprijzen-
   belofte uit de voorwaarden blijft intact). Voor lidacties gemount, want
   de betaal-seams rekenen het voordeel mee. */
Object.assign(kern, require('./kern/geldregie').maakGeldregie({ db, save }));
/* Ledenregister (kern/ledenregister.js): het kantooroverzicht van alle leden op
   codenaam, gesplitst per stad/land/alfabet/geslacht en pas, met de omzet per pas
   en de 30%-foundationsplit (20% lokaal, 10% RTF). Na de geldregie gemount, want
   het leunt op de pasprijzen daaruit. */
Object.assign(kern, require('./kern/ledenregister')({ accounts, onboarding, geldPasprijzen: kern.geldPasprijzen, ledenAantal }));
/* Bankregie (kern/bankregie.js): de geldinfrastructuur-knop van de boardroom --
   een schakelaar met DRIE standen (partner -> hybride -> eigen) die bepaalt hoe
   RTG Bank clearet: via de externe kaart-naad, als eigen emissie, of allebei.
   Eerst gemount zodat de bank en de kantoor-routes dezelfde regie delen. */
const bankregie = require('./kern/bankregie').maakBankregie({ db, save });
Object.assign(kern, bankregie);
/* RTG Bank (kern/bank): de eigen bank, gebouwd OP het RTG Pay-grootboek en met
   dezelfde dubbele-boekhoud-tucht -- rekeningen met een echt IBAN, storten (langs
   de 3-standen knop), overboeken, de brug van/naar de wallet, uitgaande SEPA achter
   de betaal-naad, en sparen met rente. Klaar om met een knop de eigen bank te worden. */
Object.assign(kern, require('./kern/bank')({ db, save, crypto, schoon, betaal, pay: kern.pay, bankregie, keyVanCodenaam, accounts, sseToCustomer, sseToOffice, anthropic }));
/* De Reiswijzer (kern/reis.js): alle reisregels van elk land -- visum,
   rijrichting, alarmnummer, water, fooi, let-op -- in place op de gedeelde
   LANDEN-tabel gezet, VOOR de Regelwacht zodat de overlay er bovenop komt. */
Object.assign(kern, require('./kern/reis')({ LANDEN }));
/* De Regelwacht (kern/fiscaal/regelwacht.js): belastingen en regels worden
   automatisch bijgewerkt -- een gevalideerde overlay op de gedeelde
   LANDEN-tabel, herstart-vast, met een dagelijkse bron-check. */
Object.assign(kern, require('./kern/fiscaal/regelwacht')({ db, save, LANDEN, peiljaar: FISCAAL_PEILJAAR }));
kern.regelwacht.herstelOverlay();
const regelTimer = setInterval(() => { kern.regelwacht.check().catch(() => {}); }, Number(process.env.FISCAAL_CHECK_MS || 86400000));
if (regelTimer.unref) regelTimer.unref();
/* RTG Thuis (kern/thuis): thuisverhuur van lid aan lid -- ons antwoord op
   Airbnb, met alle premium functies gratis en de Reiswijzer aan boord. */
Object.assign(kern, require('./kern/thuis')({ db, save, crypto, schoon, reiswijzer: kern.reiswijzer, landVind: kern.landVind, findSupplier }));
/* De werkvormen (kern/werkvormen.js): elke zaak krijgt automatisch elke
   gereedschapskist die bij haar past -- een zzp'er die ritten rijdt heeft
   de vervoerstools EN de zzp-tools. De afleiding zelf hangt al aan db
   (db.capsVan); dit is de kern-ingang voor de route. */
Object.assign(kern, require('./kern/werkvormen')({ db }));
/* De Opvang-afdeling (AZC/COA), het Regeringskantoor van de
   minister-president en het eigen hotel van elke afdeling -- alle drie
   kamers van RTG Kantoren. */
Object.assign(kern, require('./kern/opvang')({ db, save, crypto }));
Object.assign(kern, require('./kern/afdelingshotel')({ db, save, crypto }));
Object.assign(kern, require('./kern/regering')({ db, save, crypto, LANDEN,
  regelwacht: kern.regelwacht, bank: kern.bank, opvang: kern.opvang, afdelingen: kern.afdelingen, ledenAantal }));
/* Pay draait op de eigen bank zodra die live is: een saldotekort in de wallet
   wordt eerst gedekt vanaf de eigen betaalrekening (eigen rails), en pas
   daarna via de kaart-naad. Late binding, want de bank bouwt op pay. */
kern.pay.koppelBank(({ codenaam, centen }) => bankregie.bankLedenAan()
  ? kern.bank.bankDekWallet({ codenaam, centen })
  : { status: 403, error: 'De leden-bank is niet live.' });
/* Cutover-reconcile: draait de wallet in motor-modus (RTG_MOTOR_GELD=motor), dan
   is de Rust-motor de autoriteit -- neem bij het opstarten de saldi-spiegel over
   uit de motor-snapshot, zodat we altijd in lockstep starten (ook na een crash of
   nadat de motor los is bijgewerkt). No-op in de standaard schaduw-modus. */
if (kern.pay.geldModus === 'motor') {
  Promise.resolve(kern.pay.reconcileVanMotor())
    .then(r => {
      if (r && r.ok && !r.overgeslagen) log.info('motor-reconcile', { rekeningen: r.rekeningen, som: r.som });
      else if (r && r.error) log.warn('motor-reconcile mislukt', { fout: r.error });
    })
    .catch(e => log.warn('motor-reconcile uitzondering', { fout: e.message }));
}
// Zelfde herstart-reconcile voor het BANK-grootboek (tweede motor-ledger).
if (kern.bank.geldModus === 'motor') {
  Promise.resolve(kern.bank.reconcileVanMotor())
    .then(r => {
      if (r && r.ok && !r.overgeslagen) log.info('motor-reconcile bank', { rekeningen: r.rekeningen, som: r.som });
      else if (r && r.error) log.warn('motor-reconcile bank mislukt', { fout: r.error });
    })
    .catch(e => log.warn('motor-reconcile bank uitzondering', { fout: e.message }));
}
/* De RTFoundation-afdracht over de eigen rails: staat de knop effectief op
   "eigen" (en niet in nood), dan boekt de 30% als grootboekboeking van de
   reserve naar de foundation-tegenrekening. Anders geeft de naad null terug
   en volgt fonds.js gewoon de bestaande betaal-naad. Late binding, want het
   fonds is eerder gemount dan de bank. */
fonds.koppelBank(async ({ centen, referentie, oms }) => {
  const c = bankregie.bankClearing();
  if (c.modus !== 'eigen') return null;
  return kern.bank.boekAsync({ van: 'rtg:reserve', naar: 'extern:foundation', centen, soort: 'afdracht', oms, ref: referentie });
});
/* RTG Stad (kern/stad): het slimme-stad-platform op EIGEN hardware (de
   Stadsdoos-vloot, dezelfde familie als de Zaakdoos) en eigen software --
   domeinen met regimes, een scenario-knop in de boardroom en een
   AI-stadsregisseur. Privacy by design: de stad meet dingen, geen mensen. */
Object.assign(kern, require('./kern/stad')({ db, save, crypto, schoon, anthropic, sseToOffice, beveilig, keyVanCodenaam, sseToCustomer }));
/* De stad in het gezamenlijke rampbeeld: tijdens een calamiteit ziet de hele
   keten (korpsen, zorg, defensie, boardroom) ook het stadsscenario, de
   bord-waarschuwingen en de vloot -- operationele toestand, geen
   persoonsgegevens. Late binding, want het rampbeeld is eerder gemount. */
kern.rampbeeld.koppelStad(() => {
  const b = kern.stad.stadBeeld();
  return { scenario: b.scenario, alerts: b.alerts, vloot: b.vloot };
});
/* En andersom kijkt het verkeersdomein van de stad naar de eigen OV-vloot:
   het aantal voertuigen dat NU met een verse positie onderweg is. Alleen een
   telling -- geen routes, geen reizigers, geen personen. */
kern.stad.stadKoppelVerkeer(() => ({
  ovOnderweg: (db.data.ovVoertuigen || []).filter(v => Date.now() - new Date(v.at).getTime() < (kern.VOERTUIG_TTL_MS || 120000)).length
}));
/* De eigen-AI-dataset (kern/aidata.js): een boardroom-knop verzamelt alle logs
   (Rahul-gesprekken, ballotage, audit, transacties, kantoorchat) als JSONL om
   later een eigen model te trainen -- op codenamen, de kluis blijft dicht. */
Object.assign(kern, require('./kern/aidata').maakAidata({ db, accounts }));
/* Lidacties (kern/lidacties.js): de transactiefuncties van het lid, als
   kern-module met expliciete afhankelijkheden. Ze bedienen de app-routes
   EN vullen de acties-registry van Rahul, volgens het contract
   (session, body) -> { ok, ... } | { status, error }. */
Object.assign(kern, require('./kern/lidacties')({
  db, save, crypto, schoon, PERSONAS, findSupplier, ledenPrijs, optieAan,
  leeftijdVan, geborenVan, idGeverifieerd, alcoholGrensVan, pickupCode, entreeCode, ticketsVoorSlot,
  fooiUit, pasTegoedToe, verdienPunten, liveCodename, haversine, pushLive,
  notifySupplier, sseToSupplier, sseToOffice,
  zorgVoor: kern.zorgVoor, zorgContact, keuken: kern.keuken,
  ledenvoordeelVoor: kern.ledenvoordeelVoor
}));
kern.rahulActies = {
  plaatsOrder: kern.plaatsOrderVoor, betaalOrder: kern.betaalOrderVoor,
  // de rekening in een keer afrekenen (betalen na het eten)
  betaalRekening: kern.betaalRekeningVoor,
  koopTicket: kern.koopTicketVoor, betaalBoeking: kern.betaalBoekingVoor,
  vraagRit: kern.vraagRitVoor, betaalRit: kern.betaalRitVoor,
  // Toren 4: een behandeling boeken en direct afrekenen, via exact dezelfde
  // functies als de app-knoppen (het zorgprofiel reist mee)
  careOverzicht: kern.careOverzicht, careBoek: kern.careBoek,
  boekBehandeling: (session, body) => kern.boekBehandelingActie(session, body, verdienPunten)
};
Object.assign(kern, require('./kern/fluister')({
  db, save, schoon, anthropic, notify,
  reserveerTafel, annuleerReservering, assetGebruik: kern.assetGebruik, zorgVoor: kern.zorgVoor, pay: kern.pay,
  acties: kern.rahulActies,
  // de reislaag van Rahul: een hele reis op een vraag, kleding apart
  // leggen en voorspellen -- via exact dezelfde functies als de app-knoppen
  verblijfBoek: (session, body) => kern.verblijfBoek(session, liveCodename(session), body),
  retailLegApart: legApart, retailKlantProfiel: klantProfiel
}));
// nieuwe seintjes worden vanzelf een melding op het toestel; de sweep loopt
// elk half uur, bouwt een index (een datapass voor alle gebruikers) en
// fluisterPush zelf zorgt dat niets twee keer piept
setInterval(() => { try { kern.fluisterPushAlle(); } catch (e) {} try { kern.sparSweepAlle && kern.sparSweepAlle(); } catch (e) {} }, 30 * 60 * 1000).unref();
/* De tiener-tools (kern/tiener.js): toetsplanner met leerplan en het
   zakgeldpotje met spaardoelen; eigen spullen van het profiel. */
Object.assign(kern, require('./kern/tiener')({ save, crypto }));
/* Salon-ontmoetingen (kern/ontmoeting.js): wederzijdse connecties die vlakbij
   elkaar zijn kiezen samen een activiteit, tekenen een veiligheidscontract en
   RTG-kantoor kijkt live mee tot de afspraak klaar is. Draait op de sociale
   kern (connecties) en geo, dus na Object.assign(kern, sociaal). */
Object.assign(kern, maakOntmoeting({
  db, save, crypto, accounts, leeftijdVan, notify, sseToCustomer, sseToOffice,
  connectieTussen: kern.connectieTussen, verbActief: kern.verbActief,
  zijnVrienden: kern.zijnVrienden, codenaamVan: kern.codenaamVan, haversine
}));
/* RTG Podium (kern/podium.js): het eigen live-kanaal van De Salon. Strikt 18+
   achter dezelfde paspoortpoort als de ontmoetingen; een kanaal gaat pas open
   na menselijke goedkeuring door kantoor; cadeautjes en abonnementen lopen
   via RTG Pay. Na pay en sociaal gemount (gebruikt beide). */
Object.assign(kern, require('./kern/podium').maakPodium({
  db, save, crypto, accounts, leeftijdVan, codenaamVan: kern.codenaamVan,
  sseToCustomer, sseToOffice, notify, pay: kern.pay, schoon
}));
/* RTG Eye (kern/oog.js): de camerabril van de werkvloer. Het kijken gebeurt
   op het toestel; hier landen alleen compacte schouw-/uitgifteregels
   (gecodeerd, geen beeld), die via een Zaakdoos-proxy vanzelf in het
   doos-journaal terechtkomen. */
Object.assign(kern, require('./kern/oog').maakOog({ db, save, crypto, schoon, sseToSupplier, logActivity }));
/* De Ghost Driver (kern/ghost.js): de vooruitkijkende verkeersleider. Rijdt
   per knooppunt de komende twaalf uur alvast (dagritme, evenement-uitloop uit
   verkochte tickets, eigen rittenhistorie, demo-weerbeeld) en adviseert de
   vloot uren van tevoren. Na de boekingslaag gemount (leest tickets). */
Object.assign(kern, require('./kern/ghost').maakGhost({
  db, findSupplier, boekingenVanZaak: kern.boekingenVanZaak, haversine
}));
/* RTG Flits (kern/flits.js): de rijhulp van het netwerk: meldingen op
   codenaam (flitser/file/ongeval/object/wegwerk) met houdbaarheid, dedupe
   als bevestiging, klopt/weg-stemmen en landregels. Bewust zonder
   spelmechaniek. Na ghost gemount (gebruikt de vooruitblik-motor). */
Object.assign(kern, require('./kern/flits').maakFlits({
  db, save, crypto, haversine, ghostSimuleer: kern.ghostSimuleer
}));
/* RTG OV (kern/ov.js): al het vervoer in een app. Lijnen met haltes, live
   voertuigen via de PDA, twee snelle check-ins (oplichtende code of GPS) en
   uitchecken met eerlijke km-prijs via RTG Pay. Na pay en sociaal gemount. */
Object.assign(kern, require('./kern/ov').maakOv({
  db, save, crypto, schoon, codenaamVan: kern.codenaamVan, haversine, etaMinutes, pay: kern.pay, notify
}));
/* RTG Navigatie (kern/navigatie.js): het huiseigen navigatiesysteem. Een eigen
   wegennet met A*-route, bocht-voor-bocht en ETA per vervoerwijze; bestemmingen
   uit onze leveranciers, het OV, de loketten en de POI-lagen (tank/laad), en RTG
   Flits op de route. Niets naar derden. Na flits en ov gemount (koppelt eraan). */
Object.assign(kern, require('./kern/navigatie').maakNavigatie({
  db, save, crypto, haversine, flitsRond: kern.flitsRond, flitsMeld: kern.flitsMeld
}));
/* RTG Clips (kern/clips.js): korte verticale video's die alleen op het
   toestel van de maker staan (OPFS); RTG bewaart enkel titel, affiche en
   het signaal-doorgeefluik. De feed is een eindige dagselectie, bewust
   zonder oneindige scroll. Na sociaal gemount (codenamen). */
/* RTG Studio: zelf muziek maken. Alles wordt opgewekt, niets gesampled -- zie
   kern/muziek-instrumenten.js. Daardoor zit er geen licentie van een ander in
   wat een lid maakt, en mag zijn eigen stuk wel onder zijn eigen clip. */
/* De studio is in drie lagen bedraad, en de volgorde is nodig: samen levert de
   makers-lijst waar muziek zijn toegang op baseert, en uitgave heeft beide. */
kern.muziekSamen = null;
Object.assign(kern, require('./kern/muziek')({ db, save, crypto, schoon,
  magBij: (t, key) => (kern.muziekSamen ? kern.muziekSamen.muziekMagBij(t, key) : t.key === key),
  stempel: (t, key) => { if (kern.muziekSamen) kern.muziekSamen.muziekStempel(t, key); } }));
kern.muziekSamen = require('./kern/muziek-samen')({ save,
  trackMet: kern.muziekTrackMet, codenaamVan: kern.codenaamVan });
Object.assign(kern, kern.muziekSamen);
Object.assign(kern, require('./kern/muziek-uitgave')({ db, save, crypto, schoon,
  trackMet: kern.muziekTrackMet, codenaamVan: kern.codenaamVan,
  makersVan: kern.muziekMakersVan, notify }));
kern.muziekRahul = require('./kern/muziek-rahul')({ schoonTrack: kern.muziekSchoonTrack });
Object.assign(kern, require('./kern/clips').maakClips({
  db, save, crypto, schoon, codenaamVan: kern.codenaamVan, sseToCustomer, sseToOffice,
  // eigen muziek mag onder een eigen clip; de muziekmodule toetst het eigendom
  eigenTrack: kern.muziekEigenTrack
}));
/* RTG Office (kern/office.js): het eigen kantoorpakket. Documenten
   (tekstdocument of rekenblad) op het account, alleen-lezen te delen op
   codenaam. Na sociaal gemount (codenamen en de codenaam-opzoeker). */
Object.assign(kern, require('./kern/office').maakOffice({
  db, save, crypto, schoon, codenaamVan: kern.codenaamVan, keyVanCodenaam, sseToCustomer, anthropic
}));
/* Het AI-stuur (kern/stuur.js): Rahul voert acties uit op elk toegestaan
   API-pad, als interne aanroep met de eigen inlog van de gebruiker. Een
   codepad, dezelfde rechten en dezelfde schakelkast als de app-knoppen. */
Object.assign(kern, require('./kern/stuur').maakStuur({ log, anthropic, app }));
/* Passkeys (kern/webauthn.js): inloggen met vingerafdruk/gezicht/sleutel.
   De verificatie draait op de eigen WebAuthn-laag (server/webauthn.js) op Node's
   crypto; wij bewaren alleen publieke sleutels per account, challenges leven kort
   en in RAM. Voor de auth-routes gemount (die geven de passkey-login een sessie). */
Object.assign(kern, require('./kern/webauthn').maakWebauthn({ db, save, accounts, schoon }));
/* Wie betaalt wat (kern/wbw.js): het gedeelde uitgavenlijstje van een groep
   Salon-vrienden, met sluitende centenverdeling en verrekenen via RTG Pay.
   Na pay en sociaal gemount (gebruikt beide). */
Object.assign(kern, require('./kern/wbw').maakWbw({
  db, save, crypto, schoon, codenaamVan: kern.codenaamVan,
  connectieTussen: kern.connectieTussen, verbActief: kern.verbActief, pay: kern.pay, notify
}));
/* Het aanmeldgesprek (kern/aanmeldgesprek.js): Rahul vervangt het ouderwetse
   aanmeldformulier met een menselijk gesprek dat de velden voor de ene
   registratieroute oplevert (en op "waarom?" eerlijk uitlegt waarvoor iets
   dient). */
/* Sleutelwoorden (kern/sleutelwoorden.js): inloggen door een gesprek met
   Rahul en vier onthouden woorden, drie per keer (roterend, scrypt, met een
   slot). Moet VOOR het aanmeldgesprek staan, want dat gebruikt swStart/swZeg. */
Object.assign(kern, require('./kern/sleutelwoorden').maakSleutelwoorden({ db, save, crypto, accounts }));
Object.assign(kern, require('./kern/aanmeldgesprek').maakAanmeldgesprek({ db, schoon, leeftijdVan, swStart: kern.swStart, swZeg: kern.swZeg }));
/* De algemene pin (kern/algpin.js): een pincode van het lid die de
   privacygevoelige apps op het OS beschermt en waarmee de werk-apps openen
   (het ene account = bevoegdheid, de pin = bewijs). */
Object.assign(kern, require('./kern/algpin').maakAlgPin({ db, save, crypto }));
/* Het werkvenster (kern/werkvenster.js): de werkgever bepaalt wanneer
   personeel op de werkpagina en de PDA mag; de server dwingt dat af bij elke
   ingang naar een personeelssessie. Rahul adviseert los daarvan (agenda,
   uren, zorgprofiel) maar blokkeert nooit. */
Object.assign(kern, require('./kern/werkvenster').maakWerkvenster({
  db, save, klokVan, zorgVan: kern.zorgVan, haversine
}));
/* Een account voor alles (kern/eenaccount.js): mensen registreren zich een
   keer; personeel, zaak en kantoor zijn daarna koppelingen aan dat ene
   account (na bewijs van de werk-inlog), en accStart munt exact dezelfde
   sessies als de losse logins. */
Object.assign(kern, require('./kern/eenaccount').maakEenAccount({
  db, save, crypto, accounts, findSupplier, checkCred: kern.checkCred, hasCred: kern.hasCred,
  DEMO: kern.DEMO, DEMO_SUPPLIER: kern.DEMO_SUPPLIER, OFFICE_CODE: kern.OFFICE_CODE,
  veiligGelijk: kern.veiligGelijk, totpOk: kern.totpOk, rememberSession, logInlog: kern.logInlog,
  logActivity, supplierState, officeState: kern.officeState, magWerken: kern.magWerken,
  pinInfo: kern.pinInfo, pinCheck: kern.pinCheck
}));
/* RTG Vonk (kern/vonk.js): dating op codenaam met de Salon-veiligheidslat
   (18+ en KYC via de podium-poort), een eindige dagselectie, en bij een
   match automatisch een tafel bij een partner rond het midden van de twee
   woonplaatsen (EUR 10 p.p. vooraf: EUR 5 RTG, EUR 5 aanbetaling zaak). */
Object.assign(kern, require('./kern/vonk').maakVonk({
  db, save, crypto, schoon, accounts, leeftijdVan, codenaamVan: kern.codenaamVan, keyVanCodenaam,
  haversine, findSupplier, reserveerTafel: kern.reserveerTafel, pay: kern.pay, notify, sseToCustomer, sseToOffice
}));
/* De voorspeller (kern/voorspel.js): leert het ritme van elk lid en elke
   zaak uit het RTG Pay-grootboek (de ene bron waar elke app in boekt) en
   zet verwachtingen klaar voor de apps en voor Rahul. */
Object.assign(kern, require('./kern/voorspel').maakVoorspel({ db, findSupplier }));

/* RTG Synergie (kern/synergie.js): zaken maken samen deals en pakketten;
   pas als elke deelnemer heeft getekend staat het pakket live, en RTG Pay
   splitst elke aankoop exact volgens de afgesproken aandelen. */
Object.assign(kern, require('./kern/synergie').maakSynergie({
  db, save, crypto, schoon, findSupplier, notifySupplier, pay: kern.pay
}));

/* RTG Balans (kern/balans.js): Rahul kijkt naar agenda, rooster en
   eetpatroon en adviseert ook eens niks: rust, hobby's, ontprikkelen;
   zonder dwang en zonder iets nieuws over het lid vast te leggen. */
Object.assign(kern, require('./kern/balans').maakBalans({
  db, zorgVan: kern.zorgVan, klokVan
}));

/* De AI-regie: de boardroom kan Rahuls karakter en verhaal aanvullen
   (kern/rahul.js leest het profiel live uit de database; de vaste kern
   blijft in de code en wordt door de drift-tests bewaakt). */
require('./kern/rahul').zetRahulBron(() => db.data.rahulProfiel || null);

/* De omgangsvormen van Rahul (kern/rahul.js, rahulLeadVoor): het geslacht van
   het lid komt uit het eigen profiel (v/m/x). Volwassen leden krijgen de
   vrouw-/man-vorm; minderjarige leden (15-17) krijgen het kind-hart (het grote
   luisterende oor); onbekend geeft null en dan blijft Rahul neutraal. */
/* Hoe Rahul zich verhoudt tot dit lid. Dit liep op GESLACHT en loopt nu op
   wat het lid ZELF heeft gekozen (kern/rahul-omgang.js legt uit waarom).
   Leeftijd telt nog wel: onder de 18 het kind-hart, en de plagerige stand
   bestaat alleen voor volwassenen. */
require('./kern/rahul').zetGeslachtBron((key) => {
  const m = /^user-(\d+)$/.exec(String(key || ''));
  if (!m) return null;
  let md = null;
  try { md = accounts.getMemberState(Number(m[1])); } catch (e) { return null; }
  if (!md) return null;
  let lft = null;
  if (md.geboren) {
    const g = new Date(md.geboren), nu2 = new Date();
    lft = nu2.getFullYear() - g.getFullYear();
    if (nu2 < new Date(nu2.getFullYear(), g.getMonth(), g.getDate())) lft -= 1;
  }
  /* De levensfase (kern/rahul-fases.js) bepaalt in welke ROL Rahul staat:
     kind, scholier, student, volwassen of senior. De leeftijd geeft de
     standaard, het lid mag hem bijstellen, en faseVoor() bewaakt dat een
     minderjarige alleen tussen kind en scholier kan kiezen. */
  const fase = require('./kern/rahul-fases').faseVoor(lft, md.fase);
  return {
    fase,
    soort: (fase === 'kind' || fase === 'scholier') ? 'kind' : 'volwassen',
    omgang: md.omgang || 'maatje',
    voornaamwoord: md.voornaamwoord || '',
    aanhef: md.aanhef || '',
    // Bij een onbekende leeftijd is het antwoord nee: geen plagerige stand.
    volwassen: lft != null && lft >= 18
  };
});

/* RTG Theater (kern/theater.js): de videobibliotheek op bioscoopniveau.
   Kanalen na menselijke goedkeuring; de bytes blijven origineel (geen
   hercompressie) en staan als bestanden in de datamap, nooit in git. */
Object.assign(kern, require('./kern/theater').maakTheater({
  db, save, crypto, schoon, codenaamVan: kern.codenaamVan, notify, sseToOffice, sseToCustomer,
  mediaDir: path.join(process.env.RTG_DATA_DIR || path.join(__dirname, 'data'), 'theater')
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
require('./routes/aanmeldgesprek')(kern);
require('./routes/algpin')(kern);
require('./routes/sleutelwoorden')(kern);
require('./routes/agenda')(kern);
require('./routes/notities')(kern);
require('./routes/bestanden')(kern);
require('./routes/meet')(kern);
require('./routes/galerij')(kern);
require('./routes/klok')(kern);
require('./routes/vertaal')(kern);
require('./routes/memo')(kern);
require('./routes/boeken')(kern);
require('./routes/onderwijs')(kern);
require('./routes/leerstof')(kern);
require('./routes/bijles')(kern);
require('./routes/facturatie')(kern);
require('./routes/rtmail')(kern);
require('./routes/rtmail-team')(kern);
require('./routes/werkmail')(kern);
require('./routes/payroll')(kern);
require('./routes/huis')(kern);
require('./routes/muziek')(kern);
require('./routes/muziek-samen')(kern);
require('./routes/atelierweb')(kern);
require('./routes/webmaker')(kern);
require('./routes/journalistiek')(kern);
require('./routes/markt')(kern);
require('./routes/borden')(kern);
require('./routes/spellen')(kern);
require('./routes/leren')(kern);
/* De RTF-bieb-routes (de kern staat al bij de Mall-bibliotheken). */
require('./routes/rtfbieb')(kern);
/* De Geloof & Wijsheid-Bibliotheek-routes (kern staat al hierboven). */
require('./routes/geloofbieb')(kern);
/* Het RTF-kantoor, Clubs & steden en het Onderzoekslab (kern staat al hierboven). */
require('./routes/rtfkantoor')(kern);
/* De twee werkplekken RTG en RTF (kern staat al hierboven). */
require('./routes/werkplek')(kern);
require('./routes/labfonds')(kern);
require('./routes/aanmeldingen')(kern);
require('./routes/ledenregister')(kern);
/* De School-Bibliotheek (kern/schoolbieb.js): per leeftijdsgroep 10.000
   school-apps, van kleuter tot universiteit; plus Samen voor de gezinsapps
   (kern/samenrtf.js): kindveilig meekijken binnen gezin en vrienden. */
Object.assign(kern, require('./kern/schoolbieb').maakSchoolBieb({ db, save }));
/* De Beroepen-Bibliotheek (kern/beroepenbieb): twee werelden van elk een
   miljoen leer-apps (technisch/agrarisch + bedrijfsleven), altijd gratis. */
Object.assign(kern, require('./kern/beroepenbieb').maakBeroepenBieb({ db, save }));
/* De bibliothecaris (kern/bibliothecaris.js): de AI-assistent van de echte
   RTG Bibliotheek; adviseert alleen apps die echt in de catalogi staan. */
Object.assign(kern, require('./kern/bibliothecaris')({ appbieb: kern.appbieb, reisbieb: kern.reisbieb,
  rtfbieb: kern.rtfbieb, schoolbieb: kern.schoolbieb, beroepenbieb: kern.beroepenbieb, geloofbieb: kern.geloofbieb, anthropic, schoon }));
require('./routes/bieb')(kern);
Object.assign(kern, require('./kern/samenrtf')({ db, save, crypto, schoon, zijnVrienden: kern.zijnVrienden }));
require('./routes/rtfschool')(kern);
/* Samen (kern/samen.js): met vrienden meekijken en samen doen door het hele
   leden-OS; kamers op code, live seintjes via de SSE-stroom. */
Object.assign(kern, require('./kern/samen')({ db, save, crypto, sseToCustomer, schoon }));
/* De Residence (kern/residentie): het virtuele grandhotel -- zalen en eigen
   suites waar leden als pionnen op codenaam rondlopen en praten, live over
   het bestaande SSE-kanaal. */
Object.assign(kern, require('./kern/residentie').maakResidentie({ db, save, schoon, sseToCustomer }));
require('./routes/samen')(kern);
require('./routes/baby')(kern);
require('./routes/tiener')(kern);
require('./routes/welzijn')(kern);
/* De zelfzorg (kern/zelfzorg): de code ruimt zichzelf op, beschermt zichzelf,
   repareert zichzelf en upgradet zichzelf. De knoppen staan in de boardroom en
   de kamers Intern & IT en Ingenieurs; de veilige delen draaien ook als stille
   automaat. Geld en klantdata blijven altijd mensenwerk (advies, geen ingreep). */
Object.assign(kern, require('./kern/zelfzorg')({
  db, save, accounts, sessions: kern.sessions, beveilig, pay: kern.pay, bank: kern.bank,
  log: logboek.log, fs, path, DATA_DIR
}));
kern.zelfzorg.autoStart();
/* De RTG AI van het RTG Kantoor (kern/rtgai.js): leest mee, traint zichzelf
   en meldt wanneer hij klaar is; het roer geven blijft een menselijke knop. */
Object.assign(kern, require('./kern/rtgai')({ db, save, zelfzorgVan: () => kern.zelfzorg }));
rtgaiMeelezer = kern.rtgai;
kern.rtgai.autoStart();
/* De Onderzoeker (kern/rtgonderzoeker.js): de tweede AI van het RTG Kantoor,
   door de RTG AI gebouwd; doet agentisch onderzoek en adviseert alleen. */
Object.assign(kern, require('./kern/rtgonderzoeker')({ db, save, crypto, schoon, anthropic }));
require('./routes/rtgkantoor')(kern);
require('./routes/kantoren')(kern);
require('./routes/gemeente')(kern);
/* De Rijks-Bibliotheek (kern/rijksbieb.js): 10.000 werk-apps voor elke
   overheidsafdeling, inbegrepen voor rijksambtenaren; routes in overheid. */
Object.assign(kern, require('./kern/rijksbieb').maakRijksBieb({ db, save }));
require('./routes/overheid')(kern);
require('./routes/luchthaven')(kern);
require('./routes/marechaussee')(kern);
require('./routes/uitgifte')(kern);
require('./routes/sportclub')(kern);
require('./routes/drm')(kern);
require('./routes/pay')(kern);
require('./routes/bank')(kern);
require('./routes/bankhart')(kern);
require('./routes/reis')(kern);
require('./routes/thuis')(kern);
require('./routes/regering')(kern);
require('./routes/stad')(kern);
require('./routes/podium')(kern);
require('./routes/ghost')(kern);
require('./routes/flits')(kern);
require('./routes/theater')(kern);
require('./routes/wbw')(kern);
require('./routes/ov')(kern);
require('./routes/navigatie')(kern);
require('./routes/clips')(kern);
require('./routes/kantoorpakket')(kern);
/* RTG iD (kern/rtgid.js): de DigiD-vervanger op de eigen identiteitskluis;
   koppelcode-inlog met bevestiging in de app, selectieve gegevensdeling,
   inzagelog met intrekken en herroepbare machtigingen. */
Object.assign(kern, require('./kern/rtgid').maakRtgid({ db, save, crypto, accounts, schoon, leeftijdVan, gidsHaal, keyVanCodenaam }));
require('./routes/rtgid')(kern);
/* RTG Wallet (kern/wallet.js) en de zorgtak van de verzekeraar
   (kern/zorgpolis.js): de zorgpas op codenaam ligt direct in de wallet. */
Object.assign(kern, require('./kern/wallet').maakWallet({ db, save, crypto, schoon }));
Object.assign(kern, require('./kern/zorgpolis').maakZorgpolis({ db, save, crypto, schoon, keyVanCodenaam,
  walletVoeg: kern.walletVoeg, walletWegBron: kern.walletWegBron }));
require('./routes/zorgwallet')(kern);
require('./routes/stuur')(kern);
require('./routes/vonk')(kern);
require('./routes/voorspel')(kern);
require('./routes/synergie')(kern);
require('./routes/balans')(kern);
require('./routes/account')(kern);
/* De app-gids (kern/appgids.js): de leerlaag achter het ?-knopje dat de
   gedeelde basis-laag op elke app-pagina zet; openbare uitleg, geen data. */
kern.appgids = require('./kern/appgids');
require('./routes/gids')(kern);
/* De RTG Home Kit (kern/homekit.js): alle elektronica van het lid op een
   plek, met AI-scenes; sloten blijven altijd handwerk van het lid zelf. */
Object.assign(kern, require('./kern/homekit')({ db, save, crypto, schoon, anthropic }));
Object.assign(kern, require('./kern/homemerken')({ db, save, schoon }));
require('./routes/home')(kern);
/* RTG Vracht (kern/vracht.js): internationale vracht voor expediteurs, over
   lucht, water en land; publiek volgen op volgcode zonder klantgegevens. */
Object.assign(kern, require('./kern/vracht')({ db, save, crypto, schoon }));
require('./routes/vracht')(kern);
/* RTG Enterprise (kern/gebouw.js): het complete kantoorgebouw-systeem met
   receptie, zalen, badges, facilitair, valet en de luxe jetset-laag. */
Object.assign(kern, require('./kern/gebouw')({ db, save, crypto, schoon }));
require('./routes/gebouw')(kern);
/* RTG Clubs (kern/clubs.js): de golf- en countryclub (teetimes, pro's,
   maandbeker) en de sport- en fitnessclub (leden, lessen, banen, PT). */
Object.assign(kern, require('./kern/clubs')({ db, save, crypto, schoon }));
require('./routes/clubs')(kern);
/* RTG Verzorging (kern/verzorging.js): de beauty-salon en barbier, petcare
   en de kinderopvang met nanny-service (mens bevestigt, alleen voornamen). */
Object.assign(kern, require('./kern/verzorging')({ db, save, crypto, schoon }));
require('./routes/verzorging')(kern);
/* RTG Marina (kern/marina.js): de jachthaven met ligplaatsen, passanten,
   de brandstofsteiger, service/helling en de marina-concierge op het water. */
Object.assign(kern, require('./kern/marina')({ db, save, crypto, schoon }));
require('./routes/marina')(kern);
/* RTG Planners & Advies (kern/planners.js): weddings en prive-events,
   professionele diensten en verzekeringen; de mens houdt het laatste woord. */
Object.assign(kern, require('./kern/planners')({ db, save, crypto, schoon }));
require('./routes/planners')(kern);
/* RTG Alpine (kern/alpine.js): het wintersport- en seizoensresort met
   pistes, liften, het lawineniveau van de berggids, skischool en chalets. */
Object.assign(kern, require('./kern/alpine')({ db, save, crypto, schoon }));
require('./routes/alpine')(kern);
/* De Lesmaker (kern/lesmaker.js): leraren maken met AI lesstof uit de
   bibliotheken en zetten die live op de klas-PDA van de kinderen. */
Object.assign(kern, require('./kern/lesmaker')({ db, save, crypto, schoon, anthropic, leeftijdInstr: rtf.leeftijdInstr }));
require('./routes/lesmaker')(kern);
// De Zaakdoos-vloot (satelliet-ping + /api/doos/*); altijd-aan, achter de
// gedeelde sleutel. Na kern gemount omdat de meting-route kern.afdelingen leest.
require('./routes/doos')(kern);
require('./routes/code')(kern);
// RTG Veilig: Thuiswacht, Codewoord, Vitale check-in en Thuisrust.
require('./routes/veiligheid')(kern);
// Wie ben ik voor Rahul: omgang, voornaamwoorden en de eigen geloofskeuze.
require('./routes/ik')(kern);
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
  const status = err && err.type === 'entity.too.large' ? 413 : ((err && err.status) || 500);
  // 5xx is een ECHTE serverfout (geen client-invoerfout zoals 400/413): apart
  // gemarkeerd zodat de strenge testpoort er hard op faalt en de productie-logs
  // de twee soorten uit elkaar houden.
  log.uitzondering(err instanceof Error ? err : new Error(String(err)),
    { id: req && req.id, p: req && req.path, status, ...(status >= 500 ? { serverfout: true } : {}) });
  if (res.headersSent) return next(err);
  res.status(status).json({ error: 'Er ging iets mis. Probeer het opnieuw.', id: req && req.id });
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
// Eigen STUN-server (RFC 5389) voor (video)bellen: geen leun meer op de publieke
// STUN van Google. Draait op UDP (STUN_PORT, standaard 3478); STUN_UIT=1 zet uit.
// De socket is unref'd, dus dit houdt het afsluiten nooit tegen.
const stunServer = require('./stun').start({ log });
/* Satellietvriendelijk: op hoge-latency verbindingen (satelliet, traag mobiel)
   duurt een nieuwe TLS-handshake al snel seconden. Houd bestaande verbindingen
   daarom ruim open, dan wordt hij hergebruikt in plaats van opnieuw opgezet.
   headersTimeout hoort boven keepAliveTimeout te blijven (Node-vereiste). */
server.keepAliveTimeout = 75000;
server.headersTimeout = 90000;

/* Native TLS + eigen ACME: als de app zelf TLS termineert (RTG_TLS=1) EN ACME aan
   staat (RTG_ACME=1 + RTG_TLS_DOMAIN + RTG_TLS_EMAIL), haalt en vernieuwt ze zelf
   een echt Let's Encrypt-certificaat en laadt dat live in -- geen certbot, geen
   reverse proxy. Volledig gated; standaard uit, en het mag de app nooit laten
   vallen (mislukt de uitgifte, dan blijven we op het self-signed cert draaien).
   Zet RTG_ACME_STAGING=1 om eerst tegen de staging-CA te oefenen (geen rate-limit). */
if (process.env.RTG_TLS === '1' && process.env.RTG_ACME === '1' && server && typeof server.herlaadCert === 'function') {
  const domeinen = String(process.env.RTG_TLS_DOMAIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const email = String(process.env.RTG_TLS_EMAIL || '').trim();
  if (domeinen.length && email) {
    require('./lib/tls-acme').startAcme({ server, domains: domeinen, email, dataDir: DATA_DIR, staging: process.env.RTG_ACME_STAGING === '1', log: (m) => log.info(m) })
      .then(() => log.info('[tls] ACME actief voor ' + domeinen.join(', ')))
      .catch((e) => log.warn('[tls] ACME-start mislukt; app draait door op het self-signed cert: ' + e.message));
  } else {
    log.warn('[tls] RTG_ACME=1 maar RTG_TLS_DOMAIN/RTG_TLS_EMAIL ontbreekt; ACME overgeslagen.');
  }
}

// Netjes afsluiten: data wegschrijven, verbindingen sluiten, dan pas stoppen.
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  console.log(`[stop] ${sig} ontvangen, data wordt bewaard...`);
  try { save(); } catch (e) {}
  // Bij Postgres: nog een laatste flush zodat niets in de write-behind hangt.
  Promise.allSettled([Promise.resolve(flushBijAfsluiten()), Promise.resolve(accounts.flushBijAfsluiten())]).finally(() => {
    server.close(() => process.exit(0));
  });
  // Vangnet als de flush hangt. Bij write-behind (Postgres) kan een laatste
  // flush op grote schaal seconden duren; 3 s kapte hem af en verloor de laatste
  // write-behind-staat. Ruimer nu, zodat een normale afsluit-flush kan afronden;
  // de klein-eerst-volgorde (server/pg/sync.js) borgt dat geld sowieso als eerste
  // landt, ook als dit vangnet toch nog vuurt.
  setTimeout(() => process.exit(0), Number(process.env.RTG_STOP_GRACE_MS || 20000)).unref();
});

/* Naar buiten toe is dit een startscript, geen module: niets require't
   server.js. Toch geven we de app mee, zodat een gereedschap (scripts/
   routekaart.js) de ECHT geregistreerde routes kan uitlezen in plaats van ze
   uit de broncode te raden. Alleen lezen; de app draait al. */
module.exports = { app, server };
