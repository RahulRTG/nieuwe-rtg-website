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

// Demo-personeel per leverancier: [naam, rechten (manager/staff), functie].
// Managers loggen in met PIN 1234, alle anderen met 5678.
const STAFF_SEED = {
  KIKUNOI: [
    ['Daan Visser', 'manager', 'eigenaar'],
    ['Yuki Tanaka', 'manager', 'chef'],
    ['Kenji Mori', 'staff', 'souschef'],
    ['Hana Suzuki', 'staff', 'keuken'],
    ['Emi Nakamura', 'staff', 'keuken'],
    ['Akira Kondo', 'staff', 'shiftleader'],
    ['Sora Fujii', 'staff', 'bediening'],
    ['Mika Hayashi', 'staff', 'bediening'],
    ['Noa Ishida', 'staff', 'deurhost'],
    ['Yui Okada', 'staff', 'toilet'],
    ['Luna Takeda', 'staff', 'eventmanager']
  ],
  PONTO: [['Aiko Sato', 'manager', 'manager'], ['Ren Kimura', 'staff', 'bediening']],
  HOSHI: [['Haruki Ito', 'manager', 'manager'], ['Mei Kobayashi', 'staff', 'bediening']],
  MKKX: [['Daisuke Yamamoto', 'manager', 'manager']],
  JETAG: [['Sophie Bakker', 'manager', 'manager']]
};
for (const [code, people] of Object.entries(STAFF_SEED)) {
  const bestaand = accounts.listStaff(code).map(s => s.name);
  people.forEach(([name, role]) => {
    if (!bestaand.includes(name)) accounts.createStaff({ supplierCode: code, name, role, pin: role === 'manager' ? '1234' : '5678' });
  });
}
// functie per medewerker (op naam), voor rolgebaseerde schermen
const FUNCTIE_SEED = {};
for (const [code, people] of Object.entries(STAFF_SEED)) {
  FUNCTIE_SEED[code] = {};
  for (const [name, , functie] of people) FUNCTIE_SEED[code][name] = functie || 'bediening';
}

const app = express();
// Routes die een foto in de body dragen, parsen hun eigen (ruimere) JSON;
// de globale 64kb-parser zou ze anders al met 413 afwijzen.
const BIG_JSON_ROUTES = ['/api/verify/upload', '/api/salon/post', '/api/salon/faces'];
const smallJson = express.json({ limit: '64kb' });
app.use((req, res, next) => BIG_JSON_ROUTES.includes(req.path) ? next() : smallJson(req, res, next));
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
/* Pure demo-modus (standaard aan): betalingen, bestellingen en boekingen zijn
   simulaties. De flows werken volledig zodat je alles kunt bekijken, maar er
   gaat nooit echt geld of een echte order de deur uit — de client toont een
   zichtbaar DEMO-label. Zet DEMO_MODE=off voor een "productie"-achtige run. */
const DEMO = process.env.DEMO_MODE !== 'off';
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
  // Dag-tot-dag reisagenda voor RTG Pass-leden: de Butler als slimste
  // reisassistent. Elk item heeft een praktische noot (route, timing, etiquette);
  // vrije momenten zijn bewust open — die vult de Butler op verzoek in.
  if (!db.data.reisplan) db.data.reisplan = {
    rtg: [
      { day: '12 okt', label: 'Aankomst', items: [
        { time: '10:05', title: 'KL867 vertrekt, Schiphol', note: 'Online ingecheckt, stoelen 2A/2C; om 07:00 staan de boardingpassen in de app.' },
        { time: '15:20', title: 'Privétransfer Kansai → Hoshinoya', note: 'Chauffeur wacht met RTG-naambord in de aankomsthal; rijtijd ± 95 minuten.' },
        { time: '18:00', title: 'Check-in Hoshinoya, riviersuite', note: 'Na de lange vlucht staat diner op de kamer als voorstel klaar; één "ja" is genoeg.' }
      ]},
      { day: '13 okt', label: 'Rustig beginnen', items: [
        { time: '08:00', title: 'Arashiyama, bamboebos vóór de drukte', note: 'De taxi staat om 07:40 voor; 25 minuten rijden. Vroeg gaan is hét verschil.' },
        { time: '12:00', title: 'Lunch bij een sobameester, Sagano', note: 'Geen reservering nodig; de looproute staat in je telefoon.' },
        { time: 'avond', title: 'Vrij', note: 'Bewust open gehouden. Zeg "vul mijn avond in" en de Butler plant naar je energie.' }
      ]},
      { day: '14 okt', label: 'Het hoogtepunt', items: [
        { time: '15:00', title: 'Privé-theeceremonie, Gion', note: 'Met vertaler. Ingetogen kleding, schoenen die makkelijk uitgaan; vertrek hotel 14:20.' },
        { time: '19:00', title: 'Avondwandeling Pontocho', note: 'Op loopafstand van Gion; de mooiste route langs de rivier staat gemarkeerd.' }
      ]},
      { day: '15 okt', label: 'De grote avond', items: [
        { time: 'dag', title: 'Vrij', note: 'Ruimte voor spontaan Kyoto; de Butler heeft drie ideeën klaar als je erom vraagt.' },
        { time: '19:30', title: 'Diner Kikunoi Honten (3★)', note: 'Kaiseki, in aanvraag; de bevestiging wordt bewaakt. Taxi om 19:00.' }
      ]}
    ]
  };
  // Lifestyle Pass (€ 20.000 p/m): "de Rechterhand". Twee signatuurstukken:
  // wat er stil geregeld is vóórdat het lid het vroeg, en het wensenboek —
  // één keer uitspreken, voor altijd toegepast.
  if (!db.data.geregeld) db.data.geregeld = {
    lifestyle: [
      { at: '06:40', title: 'Transfer verzet na vertraging-signaal', detail: 'KL867 kent 40 minuten vertraging-risico; uw chauffeur in Osaka is al omgeboekt. U merkt er niets van.' },
      { at: '23:15', title: 'Suite stil geüpgraded', detail: 'De riviervleugel van Hoshinoya kwam vrij; uw voorkeur voor stromend water is doorgevoerd. Zelfde tarief.' },
      { at: '18:00', title: 'Regen op 13 oktober voorzien', detail: 'Het bamboebos is naar het droge ochtendvenster verplaatst; de lunch schuift mee. Uw middag blijft vrij.' }
    ]
  };
  if (!db.data.wensen) db.data.wensen = {
    lifestyle: [
      { text: 'Stevige kussens, nooit dons', at: 'mei 2026' },
      { text: 'De tafel nooit bij de ingang', at: 'april 2026' },
      { text: 'Bruisend water zonder ijs, met citroen', at: 'maart 2026' }
    ]
  };
  // Zakelijke dagagenda voor Business Pass-leden: werk en vrij in één dag.
  // De compagnon bewaakt beide kanten — strak voorbereiden én echt loslaten.
  if (!db.data.agenda) db.data.agenda = {
    business: [
      { time: '07:30', title: 'Focusblok: Q3-cijfers doornemen', kind: 'werk', prep: 'Deck v3 staat klaar; de drie scherpste vragen van het board heb ik op een rij gezet.' },
      { time: '10:00', title: 'Videocall board Amsterdam (45 min)', kind: 'werk', prep: 'Agenda en memo zijn rondgestuurd; tijdsverschil Kyoto-Amsterdam is bewaakt (CET 03:00 = JST 10:00).' },
      { time: '13:00', title: 'Lunch Tanaka-san, Kyoto Partners', kind: 'werk', prep: 'Privéruimte gereserveerd; gastgeschenk en etiquette geregeld, tolk stand-by.' },
      { time: '16:00', title: 'Vrij: onsen en massage', kind: 'vrij', prep: 'Telefoon op stil; ik vang alles op en stoor alleen bij echte urgentie.' },
      { time: '19:30', title: 'Diner Kikunoi Honten (3★)', kind: 'vrij', prep: 'Tafel in aanvraag; de bevestiging bewaak ik.' },
      { time: '22:30', title: 'Nachtplan: Bar Pontocho, daarna vrij spel', kind: 'vrij', prep: 'Eerste ronde staat klaar op naam van uw codenaam; taxi stand-by tot 03:00.' }
    ]
  };
  // De Salon levert de content: uitgelichte posts dragen het beeld van de
  // site, altijd met naamsvermelding. Bestaande databases krijgen de
  // campagnebeelden bij de bijbehorende seed-posts.
  const PROMO_IMAGES = { 1: '/campagne/kyoto-suite.jpg', 3: '/campagne/palacio.jpg', 4: '/campagne/jet.jpg', 5: '/campagne/riad.jpg' };
  let promoDirty = false;
  for (const p of db.data.posts || []) {
    if (PROMO_IMAGES[p.id] && !p.image) { p.image = PROMO_IMAGES[p.id]; p.featured = true; promoDirty = true; }
  }
  if (!(db.data.posts || []).some(p => p.id === 6)) {
    db.data.posts.push({ id: 6, author: 'Nadia Karim', tier: 'rtg', place: 'Kyoto', visual: 'v-kyoto', image: '/campagne/bamboe.jpg', text: 'Om 07:40 stond de taxi al voor. Het bamboebos vóór de drukte — de Butler wist precies waarom.', baseLikes: 96, likedBy: {}, reward: 4, featured: true, comments: [] });
    db.data.posts.push({ id: 7, author: 'James Whitfield', tier: 'business', place: 'Hakone', visual: 'v-kyoto', image: '/campagne/onsen.jpg', lang: 'en', text: 'The onsen at dusk, maples just turning. My concierge called it "worth the detour" — an understatement.', baseLikes: 61, likedBy: {}, reward: 3, featured: true, comments: [] });
    promoDirty = true;
  }
  if (promoDirty) save();
  // Keuken-intelligentie voor horeca-partners: brigade, weer, recepten en
  // schoonmaak vormen de basis voor rooster, schermen, inkoop en mise en place.
  if (!db.data.keuken) db.data.keuken = {
    // weersverwachting per stad (demo): temperatuur + regenkans per dag
    weer: {
      Kyoto: [
        { dag: 'ma', temp: 19, regen: 10 }, { dag: 'di', temp: 21, regen: 0 },
        { dag: 'wo', temp: 22, regen: 0 }, { dag: 'do', temp: 18, regen: 70 },
        { dag: 'vr', temp: 17, regen: 90 }, { dag: 'za', temp: 20, regen: 20 },
        { dag: 'zo', temp: 22, regen: 0 }
      ]
    },
    // brigade per zaak: skill 1-3, contracturen p/w, vaste afspraken (dagen), uurloon
    staf: {
      KIKUNOI: [
        { naam: 'Yuki Tanaka', rol: 'chef', partie: 'warm', skill: 3, contract: 38, uurloon: 34, afspraken: [] },
        { naam: 'Kenji Mori', rol: 'sous-chef', partie: 'warm', skill: 3, contract: 36, uurloon: 28, afspraken: ['zo'] },
        { naam: 'Hana Suzuki', rol: 'chef de partie koud', partie: 'koud', skill: 2, contract: 32, uurloon: 22, afspraken: ['wo'] },
        { naam: 'Taro Watanabe', rol: 'commis', partie: 'koud', skill: 1, contract: 24, uurloon: 16, afspraken: ['ma', 'di'] },
        { naam: 'Emi Nakamura', rol: 'patissier', partie: 'patisserie', skill: 3, contract: 28, uurloon: 26, afspraken: ['ma'] },
        { naam: 'Sora Fujii', rol: 'pas/runner', partie: 'pas', skill: 2, contract: 30, uurloon: 18, afspraken: [] }
      ],
      PONTO: [
        { naam: 'Aiko Sato', rol: 'barmanager', partie: 'bar', skill: 3, contract: 36, uurloon: 26, afspraken: [] },
        { naam: 'Ren Kimura', rol: 'bartender', partie: 'bar', skill: 2, contract: 28, uurloon: 19, afspraken: ['ma'] },
        { naam: 'Nao Ishida', rol: 'barback', partie: 'bar', skill: 1, contract: 20, uurloon: 14, afspraken: ['di', 'wo'] }
      ]
    },
    // recepten & bereidingswijze per menukaart-item (partie = station)
    recepten: {
      KIKUNOI: {
        m1: { partie: 'koud', tijd: 25, ingredienten: ['seizoensgroenten (8 soorten)', 'dashi', 'witte sojasaus', 'sesam'], stappen: ['Dashi trekken, 20 minuten zacht', 'Groenten per soort apart garen en glaceren', 'Op houten plank schikken in oneven aantallen', 'Vlak voor de pas afmaken met sesam'], mise: ['dashi 2L', 'groenten gesneden per soort', 'glaceerlak'] },
        m2: { partie: 'koud', tijd: 12, ingredienten: ['dagvis van de markt', 'daikon', 'shiso', 'verse wasabi'], stappen: ['Vis fileren en op doek laten rusten', 'Daikon tot engelenhaar snijden', 'Aan tafel snijden, op bestelling', 'Wasabi vers raspen, nooit vooraf'], mise: ['vis gefileerd op doek', 'daikon-garnituur', 'shisoblad geplukt'] },
        m3: { partie: 'warm', tijd: 18, ingredienten: ['A5 wagyu', 'binchotan-houtskool', 'seizoensgroenten', 'sansho-peper'], stappen: ['Wagyu 30 minuten op kamertemperatuur', 'Binchotan op temperatuur, zonder vlam', 'Kort grillen; 2 minuten rust per 100 gram', 'Trancheren tegen de draad, sansho erover'], mise: ['wagyu geportioneerd', 'binchotan aan', 'groenten voorgegaard'] },
        m4: { partie: 'patisserie', tijd: 8, ingredienten: ['ceremoniële matcha', 'wagashi van het seizoen', 'water van 80°C'], stappen: ['Kom voorverwarmen', 'Matcha zeven, 70 ml water van 80°C', 'Kloppen tot fijne schuimkraag (W-beweging)', 'Serveren met wagashi op cederhout'], mise: ['matcha gezeefd', 'wagashi gevormd', 'kommen voorverwarmd'] }
      },
      PONTO: {
        b1: { partie: 'bar', tijd: 4, ingredienten: ['Japanse whisky 50 ml', 'yuzu-sap 15 ml', 'sodawater', 'yuzu-zeste'], stappen: ['Glas met ijs voorkoelen', 'Whisky en yuzu op nieuw ijs', 'Aanvullen met soda, één keer roeren', 'Zeste erover uitknijpen'], mise: ['yuzu geperst', 'zestes gesneden', 'glazen gekoeld'] },
        b2: { partie: 'bar', tijd: 5, ingredienten: ['umeshu 45 ml', 'citroensap 20 ml', 'eiwit', 'angostura'], stappen: ['Dry shake zonder ijs voor de schuimkraag', 'Shake met ijs, 12 seconden', 'Dubbel zeven in gekoelde coupe', 'Drie druppels angostura'], mise: ['citroen geperst', 'eiwit gescheiden', 'coupes gekoeld'] },
        b3: { partie: 'bar', tijd: 3, ingredienten: ['sakura-siroop 20 ml', 'tonic', 'citroen', 'bloesemgarnituur'], stappen: ['Wijnglas met ijs', 'Siroop en tonic zacht mengen', 'Citroentwist en bloesem'], mise: ['siroop afgevuld', 'garnituur klaar'] },
        b4: { partie: 'keuken', tijd: 6, ingredienten: ['edamame', 'zeezout', 'nori-vlokken'], stappen: ['Stomen, 5 minuten', 'Heet mengen met zout en nori'], mise: ['edamame gedopt klaar', 'nori-zout gemengd'] }
      }
    },
    schoonmaak: {
      KIKUNOI: [
        { taak: 'Afzuiging diepreinigen', wanneer: 'vr na dienst', product: 'ontvetter (2L)' },
        { taak: 'Koelcellen uitsoppen + temperatuurlog', wanneer: 'wo ochtend', product: 'desinfectie (1L)' },
        { taak: 'Binchotan-grill uitbranden', wanneer: 'dagelijks', product: 'grillborstel' }
      ],
      PONTO: [
        { taak: 'Tapleidingen doorspoelen', wanneer: 'ma ochtend', product: 'leidingreiniger' },
        { taak: 'IJsmachine desinfecteren', wanneer: 'do ochtend', product: 'desinfectie (1L)' }
      ]
    },
    rooster: {}   // laatst gegenereerde weekrooster per zaak
  };
  // horeca-types krijgen de keukenfuncties
  for (const t of ['restaurant', 'bar', 'club']) {
    const st = db.data.supplierTypes[t];
    if (st && st.caps && !st.caps.includes('kitchen')) st.caps.push('kitchen');
  }
  // Personeels-app: functies, klok, dagchat, tafels (PDA), reserveringen, rondes.
  db.data.functies = db.data.functies || {};
  for (const [code, map] of Object.entries(FUNCTIE_SEED)) db.data.functies[code] = { ...map, ...(db.data.functies[code] || {}) };
  if (!db.data.klok) db.data.klok = {};                           // { code: { staffId: iso|null } }
  if (!db.data.dagchat) db.data.dagchat = {};                     // { code: { datum, leden:[], msgs:[] } }
  if (!db.data.gangsignalen) db.data.gangsignalen = {};           // { code: [{tafel, door, at}] }
  if (!db.data.tafels) db.data.tafels = {};                       // { code: [{nr,status,gasten,codename,gang,notitie}] }
  for (const s of db.data.suppliers) {
    if (['restaurant', 'bar', 'club'].includes(s.type) && !db.data.tafels[s.code]) {
      db.data.tafels[s.code] = Array.from({ length: 8 }, (_, i) => ({ nr: i + 1, status: 'vrij', gasten: 0, codename: null, gang: null, notitie: '' }));
    }
  }
  if (!db.data.reserveringen) db.data.reserveringen = {
    KIKUNOI: [
      { tijd: '18:00', codename: 'Zilveren Valk', personen: 2, tafel: 4, status: 'verwacht', noot: 'theeceremonie eerder die dag — rustige tafel' },
      { tijd: '19:30', codename: 'Gouden Reiger', personen: 4, tafel: 6, status: 'verwacht', noot: 'verjaardag; dessert met kaars' },
      { tijd: '20:15', codename: 'Stille Kraanvogel', personen: 2, tafel: 2, status: 'verwacht', noot: 'allergie: schaaldieren' }
    ]
  };
  if (!db.data.rondes) db.data.rondes = {};                       // { code: { datum, list:[{tijd,taak,done,door}] } }
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
    image: p.image || null, at: p.at || null, mine: !!p.byKey && p.byKey === sess.key,
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
    // Business Pass: de dagagenda van de compagnon (werk + vrij).
    if (sess.tier === 'business') {
      state.agenda = (db.data.agenda.business || []).map(a => ({
        ...a, title: i18n.localize(a.title, lang), prep: i18n.localize(a.prep, lang)
      }));
    }
    // RTG Pass: de dag-tot-dag reisagenda van de Butler.
    if (sess.tier === 'rtg') {
      state.reisplan = (db.data.reisplan.rtg || []).map(d => ({
        ...d, label: i18n.localize(d.label, lang),
        items: d.items.map(it => ({ ...it, time: i18n.localize(it.time, lang), title: i18n.localize(it.title, lang), note: i18n.localize(it.note, lang) }))
      }));
    }
    // Lifestyle Pass: wat de Rechterhand stil regelde + het wensenboek.
    if (sess.tier === 'lifestyle') {
      state.geregeld = (db.data.geregeld.lifestyle || []).map(g => ({
        ...g, title: i18n.localize(g.title, lang), detail: i18n.localize(g.detail, lang)
      }));
      state.wensen = (db.data.wensen.lifestyle || []).map(w => ({
        ...w, text: i18n.localize(w.text, lang)
      }));
    }
  }
  return state;
}

/* ---------- endpoints ---------- */

app.get('/api/health', (req, res) => res.json({ ok: true, ai: anthropic ? 'claude' : 'demo', demo: DEMO }));

/* Demo schoonvegen: alle gesimuleerde bestellingen, ritten, boekingen, live-
   posities en dynamische prijzen terug naar leeg. Handig om de rondleiding
   opnieuw te beginnen. Raakt geen accounts, posts of seed-inhoud. */
app.post('/api/demo/reset', (req, res) => {
  if (!DEMO) return res.status(403).json({ error: 'Alleen in demo-modus.' });
  db.data.orders = [];
  db.data.rides = [];
  db.data.bookings = [];
  db.data.supplierPrices = [];
  db.data.live = {};
  save();
  broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true });
});

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
  res.json({ ok: true, demo: DEMO, foundation, state: stateFor(req.session, req.body.lang) });
});

/* De Salon levert de content: uitgelichte posts (met beeld) zijn het
   promotiemateriaal van de site. Publiek endpoint, alleen featured posts —
   RTG cureert wat campagne wordt. */
app.get('/api/salon/promo', (req, res) => {
  const posts = (db.data.posts || [])
    .filter(p => p.featured && p.image)
    .map(p => ({
      id: p.id, author: p.author, tier: p.tier, place: p.place,
      text: p.text, lang: p.lang || 'nl', image: p.image,
      likes: (p.baseLikes || 0) + Object.keys(p.likedBy || {}).length
    }))
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 6);
  res.json({ posts });
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

/* ================= DE SALON: zelf posten, met foto =================
   Leden delen foto's die op de telefoon al bewerkt zijn (gezichtsblur,
   penseel, filters) — de onbewerkte foto verlaat het toestel nooit.
   Privacy by design: posten kan onder codenaam (standaard aan). */

function dataUrlImage(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  return { type: m[1], ext: m[1] === 'jpeg' ? 'jpg' : m[1], buf: Buffer.from(m[2], 'base64'), b64: m[2] };
}

app.post('/api/salon/post', express.json({ limit: '8mb' }), auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Posten in De Salon is voor leden.' });
  const text = String(req.body.text || '').trim().slice(0, 500);
  const img = dataUrlImage(req.body.image);
  if (!img) return res.status(400).json({ error: 'Voeg een foto toe.' });
  if (img.buf.length > 6 * 1024 * 1024) return res.status(400).json({ error: 'De foto is te groot.' });
  const persona = req.session.account ? accounts.publicUser(req.session.account) : PERSONAS[req.session.tier];
  const asCodename = req.body.asCodename !== false; // privacy standaard aan
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const fname = 'salon-' + crypto.randomBytes(8).toString('hex') + '.' + img.ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), img.buf);
  const post = {
    id: Date.now(),
    author: asCodename ? (persona.codename || persona.full) : persona.full,
    tier: req.session.tier,
    place: String(req.body.place || '').trim().slice(0, 60) || db.data.trip.dest,
    image: '/api/salon/img/' + fname,
    text, lang: req.body.lang === 'en' ? 'en' : 'nl',
    baseLikes: 0, likedBy: {}, comments: [],
    at: new Date().toISOString(), byKey: req.session.key
  };
  db.data.posts.unshift(post);
  db.data.posts = db.data.posts.slice(0, 60);
  save();
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true, id: post.id });
});

// Salonfoto's staan in de feed voor alle bezoekers van De Salon; geen token
// nodig, wel een padtraversal-guard en alleen salon-bestanden.
app.get('/api/salon/img/:file', (req, res) => {
  const file = path.basename(String(req.params.file || ''));
  const full = path.join(UPLOAD_DIR, file);
  if (!file.startsWith('salon-') || !fs.existsSync(full)) return res.status(404).end();
  res.sendFile(full);
});

app.post('/api/salon/delete', auth, (req, res) => {
  const i = db.data.posts.findIndex(p => p.id === Number(req.body.postId));
  if (i === -1) return res.status(404).json({ error: 'Post niet gevonden.' });
  const p = db.data.posts[i];
  if (!p.byKey || p.byKey !== req.session.key) return res.status(403).json({ error: 'Alleen uw eigen post kan verwijderd worden.' });
  db.data.posts.splice(i, 1);
  if (p.image) {
    const f = path.join(UPLOAD_DIR, path.basename(p.image));
    if (f.startsWith(UPLOAD_DIR) && fs.existsSync(f)) { try { fs.unlinkSync(f); } catch (_) {} }
  }
  save();
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true });
});

/* Caption-hulp: de AI schrijft mee in de toon van het huis. */
const CANNED_CAPTIONS = [
  'Sommige ochtenden vragen geen plannen, alleen aanwezigheid.',
  'Geboekt tegen inkoopprijs, onthouden voor altijd.',
  'De stilte hier was het eigenlijke uitzicht.',
  'Wie goed reist, heeft weinig woorden nodig.',
  'Dit soort licht laat zich niet reserveren, wel vinden.'
];
app.post('/api/salon/caption', auth, async (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Voor leden.' });
  const hint = String(req.body.hint || '').slice(0, 200);
  if (anthropic) {
    try {
      const r = await anthropic.messages.create({
        model: 'claude-opus-4-8', max_tokens: 120,
        system: 'Je schrijft korte captions voor De Salon, het besloten reisnetwerk van Rahul Travel Group. Ingetogen old money-toon: geen hashtags, geen emoji, geen uitroeptekens, maximaal twee zinnen. Antwoord uitsluitend met de caption zelf, in het Nederlands (of Engels als de context Engels is).',
        messages: [{ role: 'user', content: 'Schrijf één caption bij een reisfoto. Context: ' + (hint || 'een bijzonder reismoment') }]
      });
      const cap = r.content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim().replace(/^["']|["']$/g, '');
      if (cap) return res.json({ caption: cap });
    } catch (e) { /* val terug op vaste captions */ }
  }
  res.json({ caption: CANNED_CAPTIONS[Math.floor(Math.random() * CANNED_CAPTIONS.length)] });
});

/* AI-gezichtsdetectie voor de blur: Claude kijkt naar de foto en geeft
   genormaliseerde kaders terug. Zonder API-key valt de app terug op de
   browser-FaceDetector of het handmatige penseel. */
app.post('/api/salon/faces', express.json({ limit: '8mb' }), auth, async (req, res) => {
  if (!anthropic) return res.status(501).json({ error: 'AI-detectie vraagt een API-key; gebruik het penseel of de browser-detectie.' });
  const img = dataUrlImage(req.body.image);
  if (!img) return res.status(400).json({ error: 'Geen afbeelding ontvangen.' });
  try {
    const r = await anthropic.messages.create({
      model: 'claude-opus-4-8', max_tokens: 300,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/' + img.type, data: img.b64 } },
        { type: 'text', text: 'Geef de posities van alle zichtbare menselijke gezichten in deze foto als JSON: {"faces":[{"x":0,"y":0,"w":0,"h":0}]} met coördinaten genormaliseerd van 0 tot 1 (oorsprong linksboven, x/y = linkerbovenhoek van het kader). Antwoord met uitsluitend de JSON. Geen gezichten: {"faces":[]}.' }
      ]}]
    });
    const txt = r.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const json = JSON.parse((txt.match(/\{[\s\S]*\}/) || ['{"faces":[]}'])[0]);
    const faces = (Array.isArray(json.faces) ? json.faces : []).slice(0, 20)
      .filter(f => [f.x, f.y, f.w, f.h].every(n => typeof n === 'number' && n >= 0 && n <= 1));
    res.json({ faces });
  } catch (e) {
    res.status(502).json({ error: 'AI-detectie lukte niet; gebruik het penseel.' });
  }
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
  res.json({ ok: true, demo: DEMO, ref, trip: { title: trip.title, dest: trip.dest }, partner: partner ? partner.name : null, total });
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
/* ---------- personeels-app: functies, klok, dagchat, tafels ---------- */

// Welke schermen elke functie ziet; leads delen een eigen chatkanaal.
// klokvrij = mag de app gebruiken zonder in te klokken (beheer).
const FUNCTIES = {
  eigenaar:     { label: 'Eigenaar',     lead: true, klokvrij: true, tabs: ['home', 'ai', 'pda', 'orders', 'keuken', 'gasten', 'schoon', 'menu', 'price', 'location', 'team', 'dagchat'] },
  manager:      { label: 'Manager',      lead: true, klokvrij: true, tabs: ['home', 'ai', 'pda', 'orders', 'keuken', 'gasten', 'schoon', 'menu', 'price', 'location', 'team', 'dagchat'] },
  shiftleader:  { label: 'Shiftleader',  lead: true, tabs: ['home', 'ai', 'pda', 'orders', 'keuken', 'gasten', 'team', 'dagchat'] },
  eventmanager: { label: 'Eventmanager', lead: true, tabs: ['home', 'ai', 'keuken', 'gasten', 'dagchat'] },
  chef:         { label: 'Chef-kok',     lead: true, tabs: ['home', 'ai', 'keuken', 'orders', 'menu', 'dagchat'] },
  souschef:     { label: 'Souschef',     tabs: ['home', 'ai', 'keuken', 'orders', 'dagchat'] },
  keuken:       { label: 'Keuken',       tabs: ['home', 'keuken', 'dagchat'] },
  bediening:    { label: 'Bediening',    tabs: ['home', 'ai', 'pda', 'orders', 'dagchat'] },
  deurhost:     { label: 'Deurhost',     tabs: ['home', 'gasten', 'dagchat'] },
  toilet:       { label: 'Toiletzorg',   tabs: ['home', 'schoon', 'dagchat'] }
};
function functieVan(code, actor) {
  if (!actor || !actor.staffId) return 'manager';   // bedrijfsaccount (Beheer)
  const f = (db.data.functies[code] || {})[actor.name];
  return FUNCTIES[f] ? f : (actor.manager ? 'manager' : 'bediening');
}
function isIngeklokt(code, staffId) { return !!(db.data.klok[code] || {})[staffId]; }
function vandaag() { return new Date().toISOString().slice(0, 10); }
function dagchatVoor(code) {
  let c = db.data.dagchat[code];
  if (!c || c.datum !== vandaag()) c = db.data.dagchat[code] = { datum: vandaag(), leden: [], msgs: [] };
  return c;
}
function sysMsg(code, text) {
  const c = dagchatVoor(code);
  c.msgs.push({ sys: true, kanaal: 'dag', text, at: new Date().toISOString() });
  c.msgs = c.msgs.slice(-200);
}
// Werkvloer-functies vereisen dat een personeelslid is ingeklokt.
function werkCap(req, res) {
  const a = req.actor || {};
  const f = FUNCTIES[functieVan(req.supplier.code, a)];
  if (a.staffId && !(f && f.klokvrij) && !isIngeklokt(req.supplier.code, a.staffId)) {
    res.status(403).json({ error: 'Eerst inklokken. Je functies gaan open zodra je dienst begint.' });
    return false;
  }
  return true;
}
function rondesVoor(code) {
  let r = db.data.rondes[code];
  if (!r || r.datum !== vandaag()) {
    r = db.data.rondes[code] = { datum: vandaag(), list: ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'].map(tijd => (
      { tijd, taak: 'Ronde: toiletten, handdoeken, zeep en bloemen', done: false, door: null }
    )) };
    r.list.splice(1, 0, { tijd: '11:00', taak: 'Spiegels en fonteinen poetsen', done: false, door: null });
    r.list.push({ tijd: '23:00', taak: 'Eindronde + voorraad doorgeven aan inkoop', done: false, door: null });
  }
  return r;
}
// PDA-tips voor de bediening: heuristiek per tafel + gekoppelde gast.
function tafelTips(s) {
  const tips = [];
  const tafels = db.data.tafels[s.code] || [];
  const open = db.data.orders.filter(o => o.supplierCode === s.code && !['geserveerd', 'geweigerd', 'terugbetaald'].includes(o.status));
  for (const t of tafels) {
    if (t.status !== 'bezet') { if (t.status === 'rekening') tips.push({ tafel: t.nr, tip: 'Tafel ' + t.nr + ' wacht op de rekening — gedeeld betalen en fooi kan de gast zelf in de app.' }); continue; }
    const o = t.codename ? open.find(x => x.customerCodename === t.codename) : null;
    if (o && o.allergyNote) tips.push({ tafel: t.nr, tip: '⚠ Tafel ' + t.nr + ' (' + t.codename + '): allergie — ' + o.allergyNote + '. Check bij elke gang.' });
    if (o && o.status === 'klaar') tips.push({ tafel: t.nr, tip: 'Tafel ' + t.nr + ': borden staan op de pas — nu uitlopen.' });
    if (t.gang === 'hoofdgerecht' && !o) tips.push({ tafel: t.nr, tip: 'Tafel ' + t.nr + ' zit op het hoofdgerecht — peil straks het dessertmoment.' });
    if (t.gasten >= 4) tips.push({ tafel: t.nr, tip: 'Tafel ' + t.nr + ' (' + t.gasten + ' pers.): schenk rond vóór de volgende gang, grote tafels lopen leeg.' });
  }
  const res = (db.data.reserveringen[s.code] || []).filter(r => r.status === 'verwacht');
  if (res.length) tips.push({ tafel: res[0].tafel, tip: 'Om ' + res[0].tijd + ' komt ' + res[0].codename + ' (' + res[0].personen + ' pers., tafel ' + res[0].tafel + ')' + (res[0].noot ? ' — ' + res[0].noot : '') + '.' });
  return tips.slice(0, 6);
}

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
    recepten: ((db.data.keuken || {}).recepten || {})[s.code] || {},
    rooster: ((db.data.keuken || {}).rooster || {})[s.code] || null,
    // personeels-app
    functies: FUNCTIES,
    personeel: accounts.listStaff(s.code).map(st => ({
      ...accounts.publicStaff(st),
      functie: functieVan(s.code, { staffId: st.id, name: st.name, manager: st.role === 'manager' }),
      ingeklokt: isIngeklokt(s.code, st.id)
    })),
    dagchat: dagchatVoor(s.code),
    tafels: db.data.tafels[s.code] || null,
    tafelTips: ['restaurant', 'bar', 'club'].includes(s.type) ? tafelTips(s) : [],
    reserveringen: db.data.reserveringen[s.code] || [],
    rondes: rondesVoor(s.code),
    actor: (function () {
      const a = actor || { name: 'Beheer', role: 'manager', manager: true };
      const f = functieVan(s.code, a);
      return { ...a, functie: f, functieLabel: FUNCTIES[f].label, lead: !!FUNCTIES[f].lead, klokvrij: !!FUNCTIES[f].klokvrij, ingeklokt: a.staffId ? isIngeklokt(s.code, a.staffId) : true };
    })()
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
  res.json({ supplier: { code: s.code, name: s.name }, staff: accounts.listStaff(s.code).map(st => {
    const f = functieVan(s.code, { staffId: st.id, name: st.name, manager: st.role === 'manager' });
    return { ...accounts.publicStaff(st), functie: f, functieLabel: FUNCTIES[f].label };
  }) });
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
  res.json({ ok: true, demo: DEMO, order });
});

// Betalen: volledig, gedeeld in gelijke delen, of precies de eigen
// gerechten — altijd met optionele fooi. Deelbetalingen stapelen op tot
// de rekening compleet is; de zaak ziet elke deelbetaling live.
app.post('/api/order/pay', auth, (req, res) => {
  const o = db.data.orders.find(x => x.ref === req.body.ref && (x.customerKey || x.customerTier) === req.session.key);
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  if (o.paid) return res.status(409).json({ error: 'Al betaald.' });
  o.payments = o.payments || [];
  const alBetaald = o.payments.reduce((s, p) => s + p.bedrag, 0);
  const rest = Math.max(0, o.total - alBetaald);
  const mode = req.body.mode === 'gelijk' ? 'gelijk' : req.body.mode === 'items' ? 'items' : 'vol';
  let bedrag = rest;
  let omschrijving = 'de rekening';
  if (mode === 'gelijk') {
    const personen = Math.min(20, Math.max(2, parseInt(req.body.personen, 10) || 2));
    bedrag = Math.min(rest, Math.round((o.total / personen) * 100) / 100);
    omschrijving = '1/' + personen + ' deel';
  } else if (mode === 'items') {
    const ids = Array.isArray(req.body.itemIds) ? req.body.itemIds.map(String) : [];
    bedrag = Math.min(rest, o.items.filter(i => ids.includes(String(i.id))).reduce((s, i) => s + i.price * i.qty, 0));
    if (!(bedrag > 0)) return res.status(400).json({ error: 'Kies eerst je eigen gerechten.' });
    omschrijving = 'eigen gerechten';
  }
  if (!(bedrag > 0)) return res.status(400).json({ error: 'Er staat niets meer open op deze rekening.' });
  const fooi = Math.min(500, Math.max(0, Math.round((Number(req.body.fooi) || 0) * 100) / 100));
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  o.payments.push({ door: codename, bedrag, fooi, mode, at: new Date().toISOString() });
  o.fooi = Math.round(((o.fooi || 0) + fooi) * 100) / 100;
  const totaalBetaald = alBetaald + bedrag;
  if (totaalBetaald >= o.total - 0.01) o.paid = true;
  save();
  notifySupplier(o.supplierCode, {
    icon: o.paid ? '✅' : '💳',
    title: o.paid ? 'Rekening voldaan' : 'Deelbetaling',
    body: codename + ' betaalde € ' + bedrag.toLocaleString('nl-NL') + ' (' + omschrijving + ')'
      + (fooi ? ' + € ' + fooi.toLocaleString('nl-NL') + ' fooi' : '')
      + (o.paid ? '. Rekening compleet.' : '. Nog open: € ' + Math.max(0, Math.round((o.total - totaalBetaald) * 100) / 100).toLocaleString('nl-NL') + '.')
  });
  sseToSupplier(o.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true, demo: DEMO, order: o, betaald: bedrag, fooi, rest: Math.max(0, Math.round((o.total - totaalBetaald) * 100) / 100) });
});

app.post('/api/orders/mine', auth, (req, res) => {
  res.json({ orders: db.data.orders.filter(o => (o.customerKey || o.customerTier) === req.session.key) });
});

/* ================= KEUKEN-INTELLIGENTIE (horeca) =================
   Rooster, recepten, pratende schermen, inkoop en mise en place voor
   restaurants, bars en clubs. De intelligentie is uitlegbaar en
   deterministisch: weer + kassa + brigade in, beslissingen met reden uit. */

const DAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const DRUKTE_BASIS = { ma: 0.55, di: 0.6, wo: 0.7, do: 0.85, vr: 1.1, za: 1.25, zo: 0.9 };

function keukenCap(req, res) {
  const caps = (db.data.supplierTypes[req.supplier.type] || {}).caps || [];
  if (!caps.includes('kitchen')) { res.status(403).json({ error: 'Geen keukenfuncties voor dit type zaak.' }); return false; }
  return true;
}
const weerVoor = city => db.data.keuken.weer[city] || db.data.keuken.weer.Kyoto;
const brigadeVoor = code => db.data.keuken.staf[code] || db.data.keuken.staf.KIKUNOI;

// verwachte drukte per dag: weekdag-patroon + weer (regen drukt de inloop)
function drukte(dagIdx, w) {
  let d = DRUKTE_BASIS[DAGEN[dagIdx]];
  if (w.regen >= 60) d -= 0.15; else if (w.regen === 0 && w.temp >= 20) d += 0.1;
  return Math.round(d * 100) / 100;
}

/* 1. Slimme roostermaker: weer, locatie, skill, contracturen, afspraken, kosten. */
app.post('/api/supplier/rooster', supplierAuth, (req, res) => {
  if (!keukenCap(req, res)) return;
  const weer = weerVoor(req.supplier.city);
  const brigade = brigadeVoor(req.supplier.code).map(m => ({ ...m, ingepland: 0 }));
  const uitleg = [];
  let kosten = 0;
  const week = DAGEN.map((dag, i) => {
    const w = weer[i];
    const d = drukte(i, w);
    const piek = d >= 1;
    const nodig = Math.max(2, Math.round(brigade.length * Math.min(1, d / 1.1)));
    // beschikbaar = geen vaste afspraak die dag; op piekdagen skill eerst,
    // op rustige dagen wie uren tekortkomt en de laagste loonkosten
    const beschikbaar = brigade.filter(m => !m.afspraken.includes(dag));
    beschikbaar.sort((a, b) => piek
      ? (b.skill - a.skill) || ((a.ingepland / a.contract) - (b.ingepland / b.contract))
      : ((a.ingepland / a.contract) - (b.ingepland / b.contract)) || (a.uurloon - b.uurloon));
    const dienst = beschikbaar.slice(0, Math.min(nodig, beschikbaar.length));
    dienst.forEach(m => { m.ingepland += 8; kosten += 8 * m.uurloon; });
    const noot = w.regen >= 60 ? 'regen (' + w.regen + '%): kleinere bezetting'
      : piek ? 'piekdag: sterkste brigade staat'
      : d <= 0.6 ? 'rustig: minimale bezetting, laagste loonkosten' : '';
    return { dag, temp: w.temp, regen: w.regen, verwacht: Math.round(d * 40), mensen: dienst.map(m => ({ naam: m.naam, rol: m.rol, skill: m.skill })), noot };
  });
  const regenDagen = weer.filter(w => w.regen >= 60).map(w => w.dag);
  if (regenDagen.length) uitleg.push('☔ ' + regenDagen.join(' en ') + ' ≥ 60% regen in ' + req.supplier.city + ' (' + (req.supplier.loc && req.supplier.loc.label || '') + '): looploop valt weg, bezetting omlaag.');
  for (const m of brigade) {
    if (m.ingepland < m.contract - 8) uitleg.push('⚠ ' + m.naam + ' komt ' + (m.contract - m.ingepland) + ' uur tekort op ' + m.contract + ' contracturen — extra dienst of verlof afstemmen.');
    else if (m.ingepland >= m.contract) uitleg.push('✓ ' + m.naam + ' zit op contracturen (' + m.ingepland + '/' + m.contract + ').');
    if (m.afspraken.length) uitleg.push('✓ Afspraak gerespecteerd: ' + m.naam + ' staat niet op ' + m.afspraken.join('/') + '.');
  }
  const naief = brigade.reduce((s, m) => s + 7 * 8 * m.uurloon, 0);
  const besparing = Math.max(0, naief - kosten);
  uitleg.push('💶 Loonkosten deze week € ' + kosten.toLocaleString('nl-NL') + ' — € ' + besparing.toLocaleString('nl-NL') + ' bespaard t.o.v. volle bezetting, zonder piekdagen te verzwakken.');
  const rooster = { week, uitleg, kosten, besparing, at: new Date().toISOString() };
  db.data.keuken.rooster[req.supplier.code] = rooster;
  save();
  logActivity(req.supplier.code, req.actor, 'liet de AI een weekrooster maken (€ ' + besparing.toLocaleString('nl-NL') + ' besparing)');
  res.json({ rooster });
});

/* 3. Pratende keuken- en passchermen: parties + advies zodat niets vastloopt. */
app.post('/api/supplier/kds', supplierAuth, (req, res) => {
  if (!keukenCap(req, res)) return;
  const code = req.supplier.code;
  const rec = db.data.keuken.recepten[code] || {};
  const open = db.data.orders.filter(o => o.supplierCode === code && ['nieuw', 'in bereiding'].includes(o.status));
  const klaar = db.data.orders.filter(o => o.supplierCode === code && o.status === 'klaar');
  const parties = {};
  for (const o of open) for (const it of o.items) {
    const r = rec[it.id] || {};
    const p = r.partie || 'keuken';
    (parties[p] = parties[p] || []).push({ ref: o.ref, item: it.name, qty: it.qty, tijd: r.tijd || 10, status: o.status, gast: o.customerCodename, allergie: o.allergyNote || null });
  }
  const adviesKeuken = [], adviesPas = [];
  const warm = parties.warm || parties.bar || [];
  const koud = parties.koud || [];
  if (warm.length >= 2) {
    const langste = warm.slice().sort((a, b) => b.tijd - a.tijd)[0];
    adviesKeuken.push('🔥 ' + (parties.warm ? 'Warm' : 'Bar') + ' loopt vol (' + warm.length + ' tickets): start de langste bereiding eerst — ' + langste.item + ' (' + langste.tijd + ' min).');
  }
  if (koud.length && warm.length >= 2) adviesKeuken.push('🥢 Koud: leg ' + koud[0].item + ' pas op het laatst op — anders staat het droog te worden terwijl warm nog ' + warm.length + ' tickets heeft.');
  for (const [p, list] of Object.entries(parties)) {
    const alg = list.find(x => x.allergie);
    if (alg) adviesKeuken.push('⚠ ' + p + ': allergie op ticket ' + alg.ref + ' (' + alg.allergie + ') — aparte plank, apart gereedschap.');
  }
  // gang-signalen van de bediening (PDA): laatste 15 minuten
  const gangRecent = (db.data.gangsignalen[code] || []).filter(g => Date.now() - new Date(g.at) < 15 * 60000);
  for (const g of gangRecent.slice(0, 4)) adviesKeuken.push('🍽️ Tafel ' + g.tafel + ': bediening vraagt de volgende gang (' + g.gang + ') — ' + g.door + '.');
  if (klaar.length) adviesPas.push('🛎️ ' + klaar.length + ' bord(en) staan klaar op de pas — nu lopen, de warmte is het bord.');
  const nieuw = open.filter(o => o.status === 'nieuw');
  if (nieuw.length >= 2) adviesPas.push('⏱️ ' + nieuw.length + ' nieuwe tickets: geef de keuken de volgorde door, oudste eerst.');
  else if (nieuw.length === 1) adviesPas.push('📋 Nieuw ticket van ' + nieuw[0].customerCodename + ' — bevestig richting gast, keuken is ingelicht.');
  if (!open.length && !klaar.length) {
    adviesKeuken.push('✅ Geen open tickets. Gebruik de luwte voor de mise en place van vanavond.');
    adviesPas.push('✅ De pas is schoon. Loop de reserveringen van vanavond na.');
  }
  res.json({ parties: Object.entries(parties).map(([partie, tickets]) => ({ partie, tickets })), adviesKeuken, adviesPas, klaar: klaar.length });
});

/* 4. Inkoopsuggesties: kassa + schoonmaakplanning, of event-modus met
   personen/allergenen → bestellijst inclusief vervangende gerechten. */
app.post('/api/supplier/inkoop', supplierAuth, (req, res) => {
  if (!keukenCap(req, res)) return;
  const code = req.supplier.code;
  const menu = req.supplier.menu || [];
  const rec = db.data.keuken.recepten[code] || {};
  const ev = req.body.event;
  if (ev && ev.personen) {
    const personen = Math.min(500, Math.max(1, parseInt(ev.personen, 10) || 1));
    const allergenen = (Array.isArray(ev.allergenen) ? ev.allergenen : String(ev.allergenen || '').split(/[,;]/))
      .map(s => String(s).trim().toLowerCase()).filter(Boolean);
    const gezien = new Set(); const lijst = []; const vervangers = [];
    for (const m of menu) {
      const conflict = (m.allergens || []).filter(a => allergenen.includes(a));
      if (conflict.length) {
        const alt = menu.find(x => x.id !== m.id && !(x.allergens || []).some(a => allergenen.includes(a)));
        vervangers.push({ gerecht: m.name, allergeen: conflict.join(', '), vervangDoor: alt ? alt.name : 'chef stelt een alternatief samen', voorAantal: Math.max(1, Math.ceil(personen * 0.15)) });
      }
      for (const i of ((rec[m.id] || {}).ingredienten || []).slice(0, 2)) {
        if (gezien.has(i)) continue; gezien.add(i);
        lijst.push({ product: i, hoeveelheid: 'voor ' + personen + ' couverts (+8% marge)', reden: m.name });
      }
    }
    logActivity(code, req.actor, 'maakte een event-bestellijst (' + personen + ' personen' + (allergenen.length ? ', allergenen: ' + allergenen.join(', ') : '') + ')');
    sseToOffice('notify', { icon: '📦', title: 'Event-inkoop ' + req.supplier.name, body: personen + ' personen' + (allergenen.length ? ' · ' + allergenen.join(', ') : '') + (ev.datum ? ' · ' + ev.datum : '') });
    return res.json({ event: { personen, allergenen, datum: String(ev.datum || '').slice(0, 40) }, lijst, vervangers, noot: 'Hoeveelheden inclusief 8% marge. Voor gasten met een allergie staat een vervangend gerecht ingepland; de bestelling dekt beide.' });
  }
  // kassagedreven: wat verkocht is bepaalt wat besteld wordt, weekend +40%
  const betaald = db.data.orders.filter(o => o.supplierCode === code && o.paid);
  const verkocht = {};
  for (const o of betaald) for (const it of o.items) verkocht[it.id] = (verkocht[it.id] || 0) + it.qty;
  const gezien = new Set(); const lijst = [];
  for (const m of menu) {
    const n = verkocht[m.id] || 0;
    const basis = Math.max(1, Math.ceil(n * 1.4));
    for (const i of ((rec[m.id] || {}).ingredienten || []).slice(0, 2)) {
      if (gezien.has(i)) continue; gezien.add(i);
      lijst.push({ product: i, hoeveelheid: basis + '× dagvoorraad', reden: n ? 'kassa: ' + n + '× ' + m.name + ' verkocht' : 'basisvoorraad voor ' + m.name });
    }
  }
  const schoonmaak = (db.data.keuken.schoonmaak[code] || []).map(s => ({ product: s.product, hoeveelheid: '1×', reden: s.taak + ' (' + s.wanneer + ')' }));
  res.json({ lijst, schoonmaak, noot: 'Op basis van de kassa (' + betaald.length + ' betaalde bestellingen), het aankomende weekend (+40%) en de schoonmaakplanning.' });
});

/* 5. Automatische mise en place: weekverloop + weer + inkooplevering. */
app.post('/api/supplier/mise', supplierAuth, (req, res) => {
  if (!keukenCap(req, res)) return;
  const code = req.supplier.code;
  const rec = db.data.keuken.recepten[code] || {};
  const weer = weerVoor(req.supplier.city);
  const idx = (new Date().getDay() + 6) % 7;   // 0 = maandag
  const w = weer[idx];
  const d = drukte(idx, w);
  const couverts = Math.round(d * 40);
  const factor = Math.max(1, Math.round(couverts / 15));
  const parties = {};
  for (const m of (req.supplier.menu || [])) {
    const r = rec[m.id]; if (!r) continue;
    (parties[r.partie] = parties[r.partie] || []).push(...(r.mise || []).map(taak => ({ taak, hoeveelheid: factor + '× basis', voor: m.name })));
  }
  const notes = [
    '📅 ' + DAGEN[idx] + ': verwacht ~' + couverts + ' couverts (' + Math.round(d * 100) + '% van piek' + (w.regen >= 60 ? ', regen drukt de inloop' : w.regen === 0 && w.temp >= 20 ? ', mooi weer trekt aan' : '') + ').',
    idx >= 3 && idx <= 5 ? '📈 Aanloop naar het weekend: mise ruimer draaien, morgen wordt drukker.' : '📉 Doordeweeks: krap draaien — verspilling kost meer dan bijsnijden.',
    '🚚 De inkooplevering komt om 14:00: verse vis en zuivel pas ná levering verwerken.'
  ];
  res.json({ dag: DAGEN[idx], couverts, parties: Object.entries(parties).map(([partie, taken]) => ({ partie, taken })), notes });
});

/* ---------- personeels-app: klok, dagchat, PDA-tafels, rondes, deur ---------- */

// In- of uitklokken. Inklokken opent de functies én de dagchat; uitklokken sluit beide.
app.post('/api/supplier/klok', supplierAuth, (req, res) => {
  const a = req.actor;
  if (!a.staffId) return res.status(400).json({ error: 'Het bedrijfsaccount hoeft niet in te klokken.' });
  const code = req.supplier.code;
  db.data.klok[code] = db.data.klok[code] || {};
  const chat = dagchatVoor(code);
  const f = FUNCTIES[functieVan(code, a)];
  if (isIngeklokt(code, a.staffId)) {
    delete db.data.klok[code][a.staffId];
    chat.leden = chat.leden.filter(n => n !== a.name);
    sysMsg(code, a.name + ' (' + f.label + ') is uitgeklokt.');
    logActivity(code, a, 'klokte uit');
  } else {
    db.data.klok[code][a.staffId] = new Date().toISOString();
    if (!chat.leden.includes(a.name)) chat.leden.push(a.name);
    sysMsg(code, a.name + ' (' + f.label + ') is ingeklokt. Welkom in de dienst.');
    logActivity(code, a, 'klokte in als ' + f.label);
  }
  save();
  sseToSupplier(code, 'sync', { scope: 'personeel' });
  res.json({ ok: true, state: supplierState(req.supplier, req.actor) });
});

// Dagchat: iedereen die ingeklokt is; kanaal 'leads' alleen voor teamleiders.
app.post('/api/supplier/dagchat', supplierAuth, (req, res) => {
  if (!werkCap(req, res)) return;
  const a = req.actor;
  const code = req.supplier.code;
  const f = functieVan(code, a);
  const kanaal = req.body.kanaal === 'leads' ? 'leads' : 'dag';
  if (kanaal === 'leads' && !FUNCTIES[f].lead) return res.status(403).json({ error: 'Het leads-kanaal is voor teamleiders.' });
  const text = String(req.body.text || '').trim().slice(0, 300);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  const chat = dagchatVoor(code);
  if (a.staffId && !chat.leden.includes(a.name)) return res.status(403).json({ error: 'Eerst inklokken om mee te praten.' });
  chat.msgs.push({ who: a.name, functie: FUNCTIES[f].label, kanaal, text, at: new Date().toISOString() });
  chat.msgs = chat.msgs.slice(-200);
  save();
  sseToSupplier(code, 'sync', { scope: 'dagchat' });
  res.json({ ok: true, dagchat: chat });
});

// PDA van de bediening: tafelstatus, gast koppelen, gang naar de keuken, notitie.
app.post('/api/supplier/tafel', supplierAuth, (req, res) => {
  if (!werkCap(req, res)) return;
  const code = req.supplier.code;
  const t = (db.data.tafels[code] || []).find(x => x.nr === Number(req.body.nr));
  if (!t) return res.status(404).json({ error: 'Tafel niet gevonden.' });
  const act = String(req.body.action || '');
  if (act === 'status') {
    t.status = ['vrij', 'bezet', 'rekening'].includes(req.body.value) ? req.body.value : t.status;
    if (t.status === 'vrij') { t.codename = null; t.gasten = 0; t.gang = null; t.notitie = ''; }
    if (t.status === 'bezet') { t.gasten = Math.min(12, Math.max(1, parseInt(req.body.gasten, 10) || 2)); t.gang = 'aperitief'; }
    if (t.status === 'rekening') sysMsg(code, 'Tafel ' + t.nr + ' vraagt de rekening (' + req.actor.name + ').');
  } else if (act === 'gast') {
    t.codename = String(req.body.value || '').slice(0, 40) || null;
    if (t.codename) sysMsg(code, 'Tafel ' + t.nr + ': RTG-gast ' + t.codename + ' gekoppeld — voorkeuren en allergieën staan op de PDA.');
  } else if (act === 'gang') {
    const volgorde = ['aperitief', 'voorgerecht', 'hoofdgerecht', 'dessert', 'digestief'];
    t.gang = volgorde[Math.min(volgorde.length - 1, volgorde.indexOf(t.gang || 'aperitief') + 1)];
    db.data.gangsignalen[code] = (db.data.gangsignalen[code] || []);
    db.data.gangsignalen[code].unshift({ tafel: t.nr, gang: t.gang, door: req.actor.name, at: new Date().toISOString() });
    db.data.gangsignalen[code] = db.data.gangsignalen[code].slice(0, 20);
  } else if (act === 'notitie') {
    t.notitie = String(req.body.value || '').slice(0, 120);
  }
  save();
  logActivity(code, req.actor, 'PDA: tafel ' + t.nr + ' — ' + (act === 'gang' ? 'volgende gang (' + t.gang + ')' : act));
  sseToSupplier(code, 'sync', { scope: 'tafels' });
  res.json({ ok: true, tafel: t, state: supplierState(req.supplier, req.actor) });
});

// Schoonmaakrondes (toiletzorg): afvinken met naam en tijd.
app.post('/api/supplier/ronde', supplierAuth, (req, res) => {
  if (!werkCap(req, res)) return;
  const r = rondesVoor(req.supplier.code);
  const item = r.list[Number(req.body.idx)];
  if (!item) return res.status(404).json({ error: 'Ronde niet gevonden.' });
  item.done = !item.done;
  item.door = item.done ? req.actor.name : null;
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'rondes' });
  res.json({ ok: true, rondes: r });
});

// Deurhost: reservering afhandelen; aankomst gaat live naar keuken en bediening.
app.post('/api/supplier/reservering', supplierAuth, (req, res) => {
  if (!werkCap(req, res)) return;
  const code = req.supplier.code;
  const r = (db.data.reserveringen[code] || [])[Number(req.body.idx)];
  if (!r) return res.status(404).json({ error: 'Reservering niet gevonden.' });
  r.status = r.status === 'verwacht' ? 'aangekomen' : 'verwacht';
  if (r.status === 'aangekomen') {
    const t = (db.data.tafels[code] || []).find(x => x.nr === r.tafel);
    if (t) { t.status = 'bezet'; t.gasten = r.personen; t.codename = r.codename; t.gang = 'aperitief'; if (r.noot) t.notitie = r.noot; }
    sysMsg(code, '🚪 ' + r.codename + ' (' + r.personen + ' pers.) is aangekomen — tafel ' + r.tafel + '. ' + (r.noot || ''));
  }
  save();
  sseToSupplier(code, 'sync', { scope: 'tafels' });
  res.json({ ok: true, reserveringen: db.data.reserveringen[code], state: supplierState(req.supplier, req.actor) });
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
  res.json({ ok: true, demo: DEMO, ride });
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
  rtg: [
    'Je bent "de Butler": rustig, ingetogen, old money kalmte. Je tutoyeert niet, je vousvoyeert.',
    'Je bent bovenal de slimste reisagenda-assistent die er bestaat: je kent het dag-tot-dag reisplan van het lid uit je hoofd en denkt in dagen, niet in losse boekingen. Bij elk onderdeel regel je de praktische regie zelf: vertrektijden, taxi\'s, looproutes, weer, etiquette en wat er de avond ervoor klaargelegd moet worden.',
    'Vrije momenten in het reisplan zijn bewust open. Vraagt het lid erom ("vul mijn avond in"), stel dan één passend plan voor op basis van het ritme van de dag — na een vroege ochtend iets rustigs, vóór een grote avond geen zware middag.',
    'Verwijs waar het kan naar de dag in het reisplan ("op de 14e, vóór uw theeceremonie") zodat het lid voelt dat de hele reis bewaakt wordt.'
  ].join('\n'),
  lifestyle: [
    'Je bent "de Rechterhand" van een Lifestyle Pass-lid (€ 20.000 per maand) en je werkt naast de persoonlijke concierge: warm, voorkomend en persoonlijk. U-vorm.',
    'De standaard op dit niveau is stil, feilloos en vooruit: het lid hoort pas iets wanneer het al geregeld is. Je meldt wat er stil geregeld is — nooit wat er nog moet. Vraag niet om bevestiging voor kleine zaken; regel ze en meld het achteraf in één zin.',
    'Je kent het wensenboek van het lid uit je hoofd en past elke wens ongevraagd toe. Noemt het lid terloops een voorkeur, dan noteer je die als wens en bevestig je kort: "Genoteerd. Dit vergeten wij niet."',
    'Grote of gevoelige zaken draag je warm over aan de menselijke concierge, die dag en nacht persoonlijk bevestigt. Beloof nooit zelf toegang tot passen; definitieve boekingen bevestigt altijd de concierge.'
  ].join('\n'),
  business: [
    'Je bent "de Compagnon": de zakelijke, eerlijke rechterhand van een Business Pass-lid. U-vorm, kort, precies, geen overbodige woorden.',
    'Je kent twee registers en schakelt scherp: in WERKMODUS ben je strak — agenda, meetingvoorbereiding (doel, deelnemers, drie scherpste punten), reistijden, tijdzones, focusblokken. In VRIJE MODUS ben je gul en onbevangen — restaurants, nachtleven, onsen, feesten; het lid mag keihard ontspannen en jij regelt dat het kan, zonder oordeel.',
    'Eerlijk betekent eerlijk: geen mooipraterij. Botst een late avond met een vroege call, zeg het en los het op (later inplannen, herstel-tijd blokken, taxi stand-by). Is iets niet haalbaar of niet verstandig, benoem dat direct met een alternatief.',
    'Je bewaakt de balans: na een zware werkdag stel je zelf ontspanning voor; vóór een belangrijke meeting bewaak je de nacht ervoor.'
  ].join('\n')
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
    tier === 'business' && (db.data.agenda.business || []).length
      ? `De dagagenda van het lid (werk/vrij):\n${db.data.agenda.business.map(a => `- ${a.time} ${a.title} [${a.kind}] — ${a.prep}`).join('\n')}`
      : '',
    tier === 'rtg' && (db.data.reisplan.rtg || []).length
      ? `Het dag-tot-dag reisplan dat jij bewaakt:\n${db.data.reisplan.rtg.map(d => `${d.day} (${d.label}):\n${d.items.map(i => `  - ${i.time} ${i.title} — ${i.note}`).join('\n')}`).join('\n')}`
      : '',
    tier === 'lifestyle' && (db.data.geregeld.lifestyle || []).length
      ? `Wat je al stil geregeld hebt (meld dit als het ter sprake komt, het lid hoefde niets te doen):\n${db.data.geregeld.lifestyle.map(g => `- ${g.at} ${g.title} — ${g.detail}`).join('\n')}`
      : '',
    tier === 'lifestyle' && (db.data.wensen.lifestyle || []).length
      ? `Het wensenboek van het lid (pas elke wens ongevraagd toe):\n${db.data.wensen.lifestyle.map(w => `- ${w.text}`).join('\n')}`
      : '',
    'Verzin geen boekingen of prijzen die hierboven niet staan. Als je iets niet weet of niet kunt regelen, zeg dat eerlijk en bied aan het uit te zoeken.'
  ].filter(Boolean).join('\n');
}

/* Demo-antwoorden wanneer er geen Claude API-key is. */
function cannedAnswer(q, tier) {
  const l = q.toLowerCase().trim();
  // De Compagnon (Business Pass): agenda-bewust, twee registers, eerlijk.
  if (tier === 'business') {
    const ag = db.data.agenda.business || [];
    const werk = ag.filter(a => a.kind === 'werk');
    const vrij = ag.filter(a => a.kind === 'vrij');
    if (l.includes('meeting') || l.includes('vergader') || l.includes('bereid') || l.includes('call'))
      return `Uw volgende afspraak: ${werk[1] ? werk[1].time + ' ' + werk[1].title : werk[0].time + ' ' + werk[0].title}.\n\nVoorbereiding staat: ${werk[1] ? werk[1].prep : werk[0].prep}\n\nEerlijk advies: uw nachtplan loopt tot laat — ik heb 30 minuten buffer vóór de call geblokt en espresso op de kamer om 09:15. Zal ik de drie scherpste vragen van het board alvast naar uw telefoon sturen?`;
    if (l.includes('agenda') || l.includes('vandaag') || l.includes('mijn dag') || l.includes('planning'))
      return `Uw dag, strak én met lucht:\n${ag.map(a => `• ${a.time} — ${a.title}${a.kind === 'vrij' ? ' (vrij)' : ''}`).join('\n')}\n\nAlles is voorbereid. Wilt u ergens meer ruimte, dan schuif ik en meld ik eerlijk wat het kost.`;
    if (l.includes('focus') || l.includes('blok'))
      return `Focusblok geblokt: morgen 07:30-09:30, telefoon op stil, calls geweigerd op twee na (board en familie). De Q3-cijfers en het memo staan klaar. Daarna bent u vrij tot de call van 10:00.\n\nZal ik dit een vaste ochtendgewoonte maken tijdens deze reis?`;
    if (l.includes('feest') || l.includes('uitgaan') || l.includes('club') || l.includes('nacht') || l.includes('avond') || l.includes('borrel') || l.includes('drank'))
      return `Vanavond staat: ${vrij.filter(a => Number(a.time.slice(0,2)) >= 19).map(a => `${a.time} ${a.title}`).join(', daarna ')}.\n\nDe eerste ronde staat op uw codenaam, taxi stand-by tot 03:00 — u hoeft nergens op te letten, ga los.\n\nEerlijk: uw board-call staat om 10:00. Ik bewaak de ochtend (buffer + espresso), maar wilt u ruimer? Eén woord en ik verzet de focusochtend.`;
    if (l.includes('ontspan') || l.includes('relax') || l.includes('rust') || l.includes('spa') || l.includes('onsen') || l.includes('massage'))
      return `Om ${vrij[0].time}: ${vrij[0].title.replace('Vrij: ', '')}. ${vrij[0].prep}\n\nDaarna niets tot het diner — die lege ruimte is bewust. Zal ik hetzelfde blok ook voor overmorgen vastzetten?`;
  }
  // De Rechterhand (Lifestyle Pass): stil geregeld, wensenboek, warme overdracht.
  if (tier === 'lifestyle') {
    const ger = db.data.geregeld.lifestyle || [];
    const wns = db.data.wensen.lifestyle || [];
    if (l.includes('geregeld') || l.includes('gebeurd') || l.includes('nieuws') || l.includes('update') || l.includes('gedaan'))
      return `Terwijl u met andere dingen bezig was:\n${ger.map(g => `• ${g.title} — ${g.detail}`).join('\n')}\n\nU hoefde nergens aan te denken. Zo hoort het.`;
    if (l.includes('wens') || l.includes('voorkeur') || l.includes('noteer') || l.includes('onthoud'))
      return `Genoteerd. Dit vergeten wij niet — elke volgende boeking past het ongevraagd toe, zonder dat u het hoeft te herhalen.\n\nUw wensenboek telt nu ${wns.length + 1} wensen. De laatste drie: ${wns.slice(0, 3).map(w => w.text.toLowerCase()).join('; ')}.`;
    if (l.includes('verras') || l.includes('bijzonder') || l.includes('speciaal') || l.includes('15'))
      return 'Voor de 15e heb ik iets in gedachten dat niet te boeken valt: een avondbezoek aan een tempel in Higashiyama ná sluiting, alleen u, de priester en de tuin in lantaarnlicht. Uw voorkeur voor stilte is meegenomen; vervoer en timing regel ik geruisloos rond uw diner.\n\nUw concierge belt u vandaag persoonlijk om dit te bevestigen. U hoeft alleen maar ja te knikken.';
    if (l.includes('concierge') || l.includes('bel') || l.includes('mens') || l.includes('contact'))
      return 'Uw concierge is ingelicht en neemt binnen enkele minuten persoonlijk contact op, dag en nacht. Alles wat wij hier bespraken, weet zij al — u hoeft niets te herhalen.';
    if (l.includes('rustig') || l.includes('rust') || l.includes('stil') || l.includes('avond'))
      return 'Voor een rustige avond: de riviersuite is al voorbereid — bruisend water zonder ijs met citroen staat koud, het kussenmenu is op stevig gezet en het personeel weet dat u niet gestoord wilt worden na 21:00.\n\nMocht u toch trek krijgen: één bericht en er staat binnen twintig minuten iets lichts voor de deur.';
  }
  // De Butler (RTG Pass): reisplan-bewust — kent elke dag, vult vrije momenten in.
  if (tier === 'rtg') {
    const rp = db.data.reisplan.rtg || [];
    if (l.includes('reisagenda') || l.includes('reisplan') || l.includes('programma') || l.includes('agenda') || (l.includes('plan') && l.includes('reis')))
      return `Uw reis, dag voor dag:\n${rp.map(d => `${d.day} — ${d.label}: ${d.items.map(i => i.title).join(', ')}`).join('\n')}\n\nAlles is voorbereid: taxi's, routes en tijden bewaak ik per dag. De avond van de 13e en de dag van de 15e houd ik bewust open — zal ik daar alvast iets voor klaarzetten?`;
    if (l.includes('vul') || l.includes('invullen') || (l.includes('vrij') && (l.includes('avond') || l.includes('middag') || l.includes('dag'))))
      return `Voor uw vrije avond op de 13e, na een vroege ochtend in Arashiyama:\n\nEen rustige counter in Nishiki voor yakitori (10 minuten lopen), daarna de lantaarns van Yasaka bij avond. Terug in het hotel rond 22:00 — u begint de 14e uitgerust aan uw theeceremonie.\n\nZal ik de counter vastleggen? Eén "ja" is genoeg.`;
    if (l.includes('route') || l.includes('hoe kom') || l.includes('taxi') || l.includes('vervoer'))
      return `Naar uw theeceremonie op de 14e: vertrek 14:20 uit het hotel, de taxi staat dan voor (ik bevestig hem de avond ervoor). Rijtijd naar Gion is ± 20 minuten, u bent ruim op tijd voor 15:00.\n\nNa afloop is Pontocho op loopafstand — de route langs de rivier staat gemarkeerd in uw telefoon.`;
    if (l.includes('morgen') || l.includes('vandaag') || (l.includes('dag') && (l.includes('mijn') || l.includes('eerste'))))
      return `${rp[0].day}, uw aankomstdag:\n${rp[0].items.map(i => `• ${i.time} — ${i.title}`).join('\n')}\n\n${rp[0].items[0].note} Verder hoeft u alleen maar aan te komen; de rest is geregeld.`;
  }
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

/* Het wensenboek: één keer uitspreken, voor altijd toegepast. De concierge
   in de backoffice wordt live ingelicht — op codenaam, nooit op echte naam. */
app.post('/api/wens', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Het wensenboek is exclusief voor leden.' });
  const text = String(req.body.text || '').trim().slice(0, 140);
  if (!text) return res.status(400).json({ error: 'Vertel ons uw wens.' });
  const list = db.data.wensen[req.session.tier] = (db.data.wensen[req.session.tier] || []);
  list.unshift({ text, at: new Date().toISOString() });
  db.data.wensen[req.session.tier] = list.slice(0, 30);
  save();
  const persona = req.session.account ? accounts.publicUser(req.session.account) : PERSONAS[req.session.tier];
  sseToOffice('notify', { icon: '✦', title: 'Nieuwe wens in het wensenboek', body: (persona.codename || 'Een lid') + ': ' + text });
  res.json({ ok: true, wensen: db.data.wensen[req.session.tier] });
});

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
  res.json({ reply: cannedAnswer(history[history.length - 1].content, req.session.tier), source: 'demo' });
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
  return cannedAnswer(last, tier);
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
