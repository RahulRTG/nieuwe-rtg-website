/* PRIVETELLING -- wie staat er op deze installatie, en hoeveel privebeeld van
   wie lag er achter /media?

   Aanleiding: tot de /media-reparatie (#587) serveerde /media/:naam elk bestand
   aan iedereen die de naam kende. Voor het besluit wat dat betekent, wil de
   eigenaar niet AANNEMEN dat hij de enige gebruiker is. Dit script telt het.

   Draai (op de productiehost, in dezelfde omgeving als de app -- dus met
   dezelfde RTG_DATA_DIR, DATABASE_URL, RTG_ENC_KEY en RTG_VAULT_KEY):
     node scripts/privetelling.js            leesbaar
     node scripts/privetelling.js --json     als JSON

   ALLEEN LEZEN, en dat is de opzet en geen bijzaak:
   - geen accounts.init() (die migreert en maakt sleutels aan) en geen
     require van server/db (die opent de opslag schrijvend);
   - SQLite wordt geopend met readOnly, PostgreSQL in een READ ONLY-transactie
     die met ROLLBACK eindigt, db.json wordt alleen gelezen;
   - een ontbrekend sleutelbestand wordt NIET aangemaakt: dan staat er dat de
     eigenaar niet te herkennen is, met de reden.

   ER KOMT GEEN NAAM, ADRES OF CODENAAM UIT. Accounts worden geteld; de
   eigenaar wordt herkend door de e-mail-hash van het eigenaarsadres naast de
   kolom email_hash te leggen (dezelfde HMAC als het inloggen), zonder iets te
   ontsleutelen. Bestanden worden geteld per categorie en per kant (eigenaar of
   ander), niet per persoon.

   WAT HET NIET ZEGT: of een bestand ooit door een buitenstaander is OPGEVRAAGD
   (dat staat in geen register), en of het bestand op schijf of in de
   objectopslag nog bestaat -- er wordt alleen geteld waar de data naar
   VERWIJST. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const env = process.env;
const DATA_DIR = env.RTG_DATA_DIR || path.join(__dirname, '..', 'server', 'data');
const DATABASE_URL = env.DATABASE_URL || env.PG_URL || null;
const PRIVE_PUBLIEK = ['alleenik', 'vrienden', 'volgers'];

/* ---------- sleutels, zonder iets aan te maken ---------- */
function sleutelUit(omgevingsnaam, bestand) {
  const w = env[omgevingsnaam];
  if (w) return /^[0-9a-fA-F]{64}$/.test(w) ? Buffer.from(w, 'hex') : crypto.createHash('sha256').update(w).digest();
  const pad = path.join(DATA_DIR, bestand);
  if (!fs.existsSync(pad)) return null;
  const b = fs.readFileSync(pad);
  return b.length === 32 ? b : null;   // sleutelbestand.sleutel: precies 32 ruwe bytes
}
const kluis = require('../server/kluis'); // versleuteling-at-rest; puur, leest alleen RTG_ENC_KEY

/* ---------- de opslag ---------- */
const store = () => env.RTG_STORE || (DATABASE_URL ? 'postgres' : (fs.existsSync(path.join(DATA_DIR, 'db.json')) ? 'json' : 'sqlite'));
const COLLECTIES = ['posts', 'stories', 'snaps', 'foundation', 'huurFotos', 'charterFotos', 'boekingen', 'techniek'];

async function metPg(werk) {
  const { Pool } = require('../server/pgwire'); // de eigen client van de app, geen pakket
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  const c = await pool.connect();
  try {
    await c.query('BEGIN TRANSACTION READ ONLY');
    return await werk(c);
  } finally {
    try { await c.query('ROLLBACK'); } catch (e) { /* alleen lezen: niets terug te draaien */ }
    c.release(); await pool.end();
  }
}

async function leesData() {
  const s = store();
  const data = {};
  if (s === 'json') {
    Object.assign(data, JSON.parse(kluis.ontsleutel(fs.readFileSync(path.join(DATA_DIR, 'db.json'), 'utf8'))));
  } else if (s === 'sqlite') {
    const bestand = path.join(DATA_DIR, 'store.db');
    if (!fs.existsSync(bestand)) return { store: s, data, reden: 'geen store.db op ' + bestand };
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(bestand, { readOnly: true });
    try {
      for (const k of COLLECTIES) {
        const r = db.prepare('SELECT val, deleted FROM kv WHERE key = ?').get(k);
        if (r && !r.deleted && r.val != null) data[k] = JSON.parse(kluis.ontsleutel(r.val));
      }
    } finally { db.close(); }
  } else if (s === 'postgres') {
    await metPg(async (c) => {
      const { rows } = await c.query('SELECT key, val FROM kv WHERE NOT weg AND key IN (' +
        COLLECTIES.map((_, i) => '$' + (i + 1)).join(', ') + ')', COLLECTIES);
      for (const r of rows) data[r.key] = JSON.parse(kluis.ontsleutel(r.val));
    });
  } else {
    return { store: s, data, reden: 'opslag "' + s + '" kan dit script niet lezen' };
  }
  return { store: s, data, reden: null };
}

async function leesUsers() {
  const kolommen = 'SELECT id, email_hash, tier, created_at FROM users';
  if (DATABASE_URL) {
    return { bron: 'postgres', rijen: await metPg(async (c) => (await c.query(kolommen)).rows) };
  }
  const bestand = path.join(DATA_DIR, 'rtg.db');
  if (!fs.existsSync(bestand)) return { bron: 'rtg.db', rijen: [], reden: 'geen accountdatabase op ' + bestand };
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(bestand, { readOnly: true });
  try { return { bron: 'rtg.db', rijen: db.prepare(kolommen).all() }; } finally { db.close(); }
}

/* ---------- tellen ---------- */
const isBestand = v => typeof v === 'string' && v.length > 0 && !v.startsWith('data:');
const isInline = v => typeof v === 'string' && v.startsWith('data:');

function tel(data, eigenaarKey) {
  const cat = {};
  const voeg = (naam, eigenaarVan, refs) => {
    const c = cat[naam] = cat[naam] || { bestanden: 0, vanEigenaar: 0, vanAnder: 0, zonderAccount: 0, inline: 0, records: 0 };
    let raak = false;
    for (const r of new Set(refs)) {   // photo en media[0].src wijzen vaak naar hetzelfde bestand
      if (isInline(r)) { c.inline++; continue; }
      if (!isBestand(r)) continue;
      raak = true; c.bestanden++;
      if (eigenaarVan === null) c.zonderAccount++;
      else if (eigenaarKey && eigenaarVan === eigenaarKey) c.vanEigenaar++;
      else c.vanAnder++;
    }
    if (raak) c.records++;
  };
  const accountKey = k => (typeof k === 'string' && /^user-\d+$/.test(k) ? k : null);

  for (const p of data.posts || []) {
    if (!p || p.weg) continue;
    const refs = [p.photo, p.visual, ...((Array.isArray(p.media) ? p.media : []).map(m => m && m.src)),
      ...((p.folder && Array.isArray(p.folder.fotos)) ? p.folder.fotos : [])];
    const publiek = p.publiek == null ? 'salon' : String(p.publiek);
    const soort = PRIVE_PUBLIEK.includes(publiek) ? 'salon-' + publiek : (p.partner === true ? 'salon-zaak-' + publiek : 'salon-leden (' + publiek + ')');
    voeg(soort, accountKey(p.authorKey), refs);
  }
  for (const s of data.stories || []) if (s) voeg('verhalen', accountKey(s.van), [s.foto]);
  for (const s of data.snaps || []) if (s) voeg('snaps', accountKey(s.van), [s.foto]);
  const gezinnen = (data.foundation && data.foundation.gezinnen) || {};
  for (const g of Object.values(gezinnen)) {
    const entries = (g && g.babyboek && Array.isArray(g.babyboek.entries)) ? g.babyboek.entries : [];
    const eig = g && g.eigenaar && g.eigenaar.userId != null ? 'user-' + g.eigenaar.userId : null;
    for (const e of entries) voeg('babyboek', eig, [e && e.foto]);
  }
  const klant = new Map();
  for (const b of data.boekingen || []) if (b && b.ref) klant.set(String(b.ref), accountKey(b.customerKey));
  for (const [soort, map] of [['huurfotos', data.huurFotos], ['charterfotos', data.charterFotos]]) {
    for (const [ref, f] of Object.entries(map || {})) {
      const refs = ['voor', 'na'].flatMap(fase => ((f && f[fase]) || []).map(x => x && x.foto));
      voeg(soort, klant.has(ref) ? klant.get(ref) : null, refs);
    }
  }
  return cat;
}

async function main() {
  const json = process.argv.includes('--json');
  const { store: s, data, reden } = await leesData();
  const users = await leesUsers();

  const vault = sleutelUit('RTG_VAULT_KEY', 'vault.key');
  const eigenaarAdres = String((data.techniek && data.techniek.eigenaarEmail) || env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com').trim().toLowerCase();
  const hash = vault ? crypto.createHmac('sha256', vault).update(eigenaarAdres).digest('hex') : null;
  const eigenaarRij = hash ? users.rijen.find(r => r.email_hash === hash) : null;
  const eigenaarKey = eigenaarRij ? 'user-' + eigenaarRij.id : null;

  const nu = Date.now(), dertig = 30 * 86400000;
  const anderen = users.rijen.filter(r => r !== eigenaarRij);
  const perPas = {};
  for (const r of anderen) perPas[r.tier || 'onbekend'] = (perPas[r.tier || 'onbekend'] || 0) + 1;

  const uit = {
    opslag: s, opslagReden: reden, accountbron: users.bron, accountReden: users.reden || null,
    accounts: {
      totaal: users.rijen.length,
      eigenaarHerkend: !!eigenaarRij,
      eigenaarReden: eigenaarRij ? null : (!vault ? 'geen RTG_VAULT_KEY of vault.key: de e-mail-hash is niet te berekenen' : 'geen account met de e-mail-hash van het eigenaarsadres'),
      ander: anderen.length,
      anderPerPas: perPas,
      anderLaatste30Dagen: anderen.filter(r => r.created_at && nu - Date.parse(r.created_at) < dertig).length
    },
    bestanden: tel(data, eigenaarKey),
    let: 'Geteld wordt waar de data naar VERWIJST. "zonderAccount" = geen ledensleutel (een zaak, een demo-persona, of een gezin van voor 5 oktober zonder account). Of een bestand ooit door een buitenstaander is opgevraagd, staat in geen register.'
  };

  if (json) { console.log(JSON.stringify(uit, null, 2)); return; }
  console.log('Opslag: ' + s + (reden ? ' (' + reden + ')' : '') + ' -- accounts uit ' + users.bron + (users.reden ? ' (' + users.reden + ')' : ''));
  console.log('Accounts: ' + uit.accounts.totaal + ' totaal; eigenaar ' + (eigenaarRij ? 'herkend' : 'NIET herkend: ' + uit.accounts.eigenaarReden) +
    '; ander: ' + uit.accounts.ander + ' ' + JSON.stringify(perPas) + ', waarvan ' + uit.accounts.anderLaatste30Dagen + ' in de laatste 30 dagen');
  console.log('\nBestanden per categorie (eigenaar / ander / zonder account; inline = data-URL, geen bestand):');
  const rijen = Object.entries(uit.bestanden).sort((a, b) => a[0].localeCompare(b[0]));
  if (!rijen.length) console.log('  (geen)');
  for (const [k, c] of rijen) {
    console.log('  ' + k.padEnd(28) + String(c.bestanden).padStart(6) + ' bestanden in ' + c.records + ' records  ->  eigenaar ' + c.vanEigenaar +
      ', ander ' + c.vanAnder + ', zonder account ' + c.zonderAccount + (c.inline ? ', inline ' + c.inline : ''));
  }
  console.log('\n' + uit.let);
}

main().catch(e => { console.error('privetelling: ' + (e && e.message)); process.exit(2); });
