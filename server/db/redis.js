/* Opslag, deel "redis": de optionele gedeelde-data-mirror via Redis (alleen in
   de JSON-opslag, met REDIS_URL). Zonder REDIS_URL werkt alles zoals altijd met
   een lokaal db.json. Met REDIS_URL delen meerdere processen dezelfde db.data:
   de schrijver spiegelt elke wijziging naar Redis, de lezers krijgen die live
   door. Precies één proces schrijft (db.writable), net als bij het failover-trio.
   Afgesplitst uit db/index.js. */
const kluis = require('../kluis');
const state = require('./state');
const { REDIS_URL, STORE } = require('./opslag');
const db = state.db;

let rPub = null, rSub = null, versie = 0;

// Zet de huidige data (met een oplopend versienummer) in Redis en seint de
// lezers. Vuurt-en-vergeet: een trage Redis houdt het verzoek niet op.
function spiegelNaarRedis() {
  if (!rPub) return;
  versie++;
  const v = versie;
  rPub.set('rtg:db', kluis.versleutel(JSON.stringify(db.data))).then(() => rPub.publish('rtg:db:versie', String(v))).catch(() => {});
}

/* Start de gedeelde data. Roep dit na load() aan, zodra de kern zijn
   onExternalChange-hook heeft gezet. De schrijver deelt zijn data als startpunt;
   een lezer leest de verse data uit Redis en luistert daarna op wijzigingen. */
async function startGedeeld() {
  if (STORE === 'sqlite') return false; // SQLite deelt via de poll, niet via de Redis-mirror
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
      if (raw) { db.data = JSON.parse(kluis.ontsleutel(raw)); versie = v; const ext = state.getExternCb(); if (ext) ext(); }
    } catch (e) {}
  });
  if (db.writable) {
    spiegelNaarRedis();                          // schrijver deelt zijn huidige data
  } else {
    const raw = await rPub.get('rtg:db');
    if (raw) { db.data = JSON.parse(kluis.ontsleutel(raw)); const ext = state.getExternCb(); if (ext) ext(); }
  }
  console.log('[db] gedeelde data via Redis actief, rol:', db.writable ? 'schrijver' : 'lezer');
  return true;
}

module.exports = { spiegelNaarRedis, startGedeeld };
