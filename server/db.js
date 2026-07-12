const fs = require('fs');
const path = require('path');
const seed = require('./seed');

// De datamap is instelbaar met RTG_DATA_DIR (handig voor tests en om data en
// sleutels op productie los van de app-schijf te zetten). Standaard server/data.
const DATA_DIR = process.env.RTG_DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

/* writable: in de failover-opstelling (server/trio.js) en bij losse
   domeinprocessen schrijft er altijd maar EEN server naar de data. De anderen
   lezen mee, maar bewaren niets; bij promotie laden ze eerst de verse data en
   gaan dan pas schrijven. */
const db = { data: null, writable: process.env.RTG_ROL !== 'standby' };

/* Optioneel: gedeelde data via Redis. Zonder REDIS_URL werkt alles zoals altijd
   met een lokaal db.json. Met REDIS_URL delen meerdere processen dezelfde
   db.data: de schrijver spiegelt elke wijziging naar Redis, de lezers krijgen
   die live door. Zo ziet een los draaiend domeinproces dezelfde data. Precies
   een proces schrijft (db.writable), net als bij het failover-trio. */
const REDIS_URL = process.env.REDIS_URL;
let rPub = null, rSub = null, versie = 0, externCb = null;

function load() {
  if (fs.existsSync(DB_FILE)) {
    db.data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db.data = seed();
    save();
  }
}

function save() {
  if (!db.writable) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // Atomisch wegschrijven: eerst een tijdelijk bestand, dan hernoemen.
  // Valt de server midden in een save uit, dan blijft het oude bestand heel.
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db.data, null, 2));
  fs.renameSync(tmp, DB_FILE);
  spiegelNaarRedis();
}

// Zet de huidige data (met een oplopend versienummer) in Redis en seint de
// lezers. Vuurt-en-vergeet: een trage Redis houdt het verzoek niet op.
function spiegelNaarRedis() {
  if (!rPub) return;
  versie++;
  const v = versie;
  rPub.set('rtg:db', JSON.stringify(db.data)).then(() => rPub.publish('rtg:db:versie', String(v))).catch(() => {});
}

/* Start de gedeelde data. Roep dit na load() aan, zodra de kern zijn
   onExternalChange-hook heeft gezet. De schrijver deelt zijn data als startpunt;
   een lezer leest de verse data uit Redis en luistert daarna op wijzigingen. */
async function startGedeeld() {
  if (!REDIS_URL) return false;
  let redis;
  try { redis = require('redis'); } catch (e) { console.warn('[db] redis ontbreekt, alleen lokale data.'); return false; }
  rPub = redis.createClient({ url: REDIS_URL });
  rSub = redis.createClient({ url: REDIS_URL });
  rPub.on('error', e => console.warn('[db] redis:', e.message));
  rSub.on('error', e => console.warn('[db] redis:', e.message));
  await rPub.connect();
  await rSub.connect();
  await rSub.subscribe('rtg:db:versie', async (vStr) => {
    const v = Number(vStr);
    if (v <= versie) return; // eigen of oudere wijziging: negeren
    try {
      const raw = await rPub.get('rtg:db');
      if (raw) { db.data = JSON.parse(raw); versie = v; if (externCb) externCb(); }
    } catch (e) {}
  });
  if (db.writable) {
    spiegelNaarRedis();                          // schrijver deelt zijn huidige data
  } else {
    const raw = await rPub.get('rtg:db');
    if (raw) { db.data = JSON.parse(raw); if (externCb) externCb(); }
  }
  console.log('[db] gedeelde data via Redis actief, rol:', db.writable ? 'schrijver' : 'lezer');
  return true;
}

// De kern zet hier een functie neer die na een externe wijziging draait (bijv.
// de sessie-index opnieuw vullen). db.data zelf is dan al ververst.
function onExternalChange(cb) { externCb = cb; }

module.exports = { db, load, save, DATA_DIR, startGedeeld, onExternalChange };
