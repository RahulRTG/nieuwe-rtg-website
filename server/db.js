const fs = require('fs');
const path = require('path');
const seed = require('./seed');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const db = { data: null };

function load() {
  if (fs.existsSync(DB_FILE)) {
    db.data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db.data = seed();
    save();
  }
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db.data, null, 2));
}

module.exports = { db, load, save };
