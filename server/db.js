const fs = require('fs');
const path = require('path');
const seed = require('./seed');

// De datamap is instelbaar met RTG_DATA_DIR (handig voor tests en om data en
// sleutels op productie los van de app-schijf te zetten). Standaard server/data.
const DATA_DIR = process.env.RTG_DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

/* writable: in de failover-opstelling (server/trio.js) schrijft alleen de
   actieve server naar schijf. Standby-servers lezen wel, maar bewaren niets;
   bij promotie laden ze eerst de verse data en gaan dan pas schrijven. */
const db = { data: null, writable: process.env.RTG_ROL !== 'standby' };

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
}

module.exports = { db, load, save, DATA_DIR };
