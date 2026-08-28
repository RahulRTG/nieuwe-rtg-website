#!/usr/bin/env node
/* Maakt uit de dagelijkse Rijkswaterstaat/NWB-GeoPackage een eigen, compacte
   RTG-routegraaf. De bron is CC0; de grote databestanden blijven bewust in
   RTG_DATA_DIR en komen nooit in Git. */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { DatabaseSync } = require('node:sqlite');
const { puntenUit, lengteRd, grens } = require('../server/kern/navigatie/nwb-geo');

const BRON_URL = 'https://downloads.rijkswaterstaatdata.nl/nwb-wegen/geogegevens/geopackage/NWB-dagelijks/Wegvakken/Wegvakken.gpkg';
const DATA_DIR = process.env.RTG_DATA_DIR || path.join(__dirname, '..', 'server', 'data');
const waarde = naam => { const i = process.argv.indexOf(naam); return i >= 0 ? process.argv[i + 1] : ''; };
const uitPad = path.resolve(waarde('--uit') || path.join(DATA_DIR, 'navigatie', 'nederland.sqlite'));
let bronPad = waarde('--bron') ? path.resolve(waarde('--bron')) : '';
let tijdelijkeBron = false;

async function download() {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-nwb-'));
  const doel = path.join(map, 'Wegvakken.gpkg');
  console.log('[NWB] dagelijkse Rijkswaterstaat-bron ophalen...');
  const r = await fetch(BRON_URL);
  if (!r.ok || !r.body) throw new Error('NWB-download mislukt: HTTP ' + r.status);
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(doel));
  tijdelijkeBron = true;
  return doel;
}

function snelheid(frc) {
  return [36.1, 30.6, 25, 22.2, 19.4, 16.7, 11.1, 8.3][Math.max(0, Math.min(7, Number(frc) || 7))];
}
function toegang(code) {
  const c = String(code || '').toUpperCase();
  if (c === 'VP') return 4;
  if (c === 'FP' || c === 'PC' || c === 'PR') return 6;
  return 7;
}
function wegref(r) {
  if (r.WEGNR_FRML) return String(r.WEGNR_FRML).trim();
  if (r.ROUTENR) return String(r.ROUTELTR || '').trim() + String(r.ROUTENR);
  return '';
}
function tel(stat, naam, punt) {
  const n = String(naam || '').trim();
  if (!n) return;
  const s = stat.get(n) || { lat: 0, lng: 0, n: 0 };
  s.lat += punt.lat; s.lng += punt.lng; s.n++;
  stat.set(n, s);
}

function schema(db) {
  db.exec(`PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA temp_store=MEMORY; PRAGMA cache_size=-250000;
    CREATE TABLE meta (sleutel TEXT PRIMARY KEY, waarde TEXT NOT NULL) WITHOUT ROWID;
    CREATE TABLE nodes (id INTEGER PRIMARY KEY, lat REAL NOT NULL, lng REAL NOT NULL);
    CREATE TABLE roads (id INTEGER PRIMARY KEY, lengte REAL NOT NULL, hoofd INTEGER NOT NULL,
      naam TEXT, ref TEXT, geom BLOB NOT NULL, minLat REAL, maxLat REAL, minLng REAL, maxLng REAL);
    CREATE TABLE edges (van INTEGER NOT NULL, naar INTEGER NOT NULL, road_id INTEGER NOT NULL,
      kost REAL NOT NULL, lengte REAL NOT NULL, hoofd INTEGER NOT NULL, toegang INTEGER NOT NULL,
      omgekeerd INTEGER NOT NULL, naam TEXT, ref TEXT);
    CREATE INDEX edges_van ON edges(van);
    CREATE TABLE plaatsen (id INTEGER PRIMARY KEY, naam TEXT NOT NULL, extra TEXT, soort TEXT NOT NULL,
      lat REAL NOT NULL, lng REAL NOT NULL, gewicht INTEGER NOT NULL DEFAULT 1);
    CREATE UNIQUE INDEX plaatsen_uniek ON plaatsen(naam, extra, soort);
    CREATE VIRTUAL TABLE node_rtree USING rtree(id, minLng, maxLng, minLat, maxLat);
    CREATE VIRTUAL TABLE road_rtree USING rtree(id, minLng, maxLng, minLat, maxLat);`);
}

function schrijfArray(map, naam, rij) {
  fs.writeFileSync(path.join(map, naam), Buffer.from(rij.buffer, rij.byteOffset, rij.byteLength));
}

function bouwGraaf(db, doelBestand) {
  console.log('[NWB] binaire routegraaf bouwen...');
  db.exec(`DROP TABLE IF EXISTS node_seq; DROP TABLE IF EXISTS node_seq_rtree;
    CREATE TABLE node_seq (idx INTEGER PRIMARY KEY,id INTEGER NOT NULL UNIQUE,lat REAL NOT NULL,lng REAL NOT NULL);
    INSERT INTO node_seq(idx,id,lat,lng) SELECT row_number() OVER(ORDER BY id)-1,id,lat,lng FROM nodes ORDER BY id;
    CREATE VIRTUAL TABLE node_seq_rtree USING rtree(id,minLng,maxLng,minLat,maxLat);
    INSERT INTO node_seq_rtree SELECT idx,lng,lng,lat,lat FROM node_seq;
    ANALYZE;`);
  const knopen = Number(db.prepare('SELECT count(*) AS n FROM node_seq').get().n);
  const kanten = Number(db.prepare('SELECT count(*) AS n FROM edges').get().n);
  const coords = new Float64Array(knopen * 2), offsets = new Uint32Array(knopen + 1);
  let i = 0;
  for (const n of db.prepare('SELECT idx,lat,lng FROM node_seq ORDER BY idx').iterate()) {
    coords[i * 2] = n.lat; coords[i * 2 + 1] = n.lng; i++;
  }
  const doelen = new Uint32Array(kanten), kosten = new Float32Array(kanten), lengtes = new Float32Array(kanten);
  const wegen = new Uint32Array(kanten), vlaggen = new Uint8Array(kanten);
  const q = `SELECT a.idx AS van,b.idx AS naar,e.road_id,e.kost,e.lengte,e.hoofd,e.toegang
    FROM edges e JOIN node_seq a ON a.id=e.van JOIN node_seq b ON b.id=e.naar ORDER BY e.van`;
  let rand = 0, huidig = 0;
  for (const e of db.prepare(q).iterate()) {
    while (huidig < e.van) offsets[++huidig] = rand;
    doelen[rand] = e.naar; kosten[rand] = e.kost; lengtes[rand] = e.lengte; wegen[rand] = e.road_id;
    vlaggen[rand] = (e.toegang & 7) | (e.hoofd ? 8 : 0); rand++;
    if (rand % 500000 === 0) console.log('[NWB] ' + rand.toLocaleString('nl-NL') + ' routekanten verpakt');
  }
  while (huidig < knopen) offsets[++huidig] = rand;
  const map = path.join(path.dirname(doelBestand), 'nederland-graaf.nieuw');
  const vast = path.join(path.dirname(doelBestand), 'nederland-graaf');
  fs.rmSync(map, { recursive: true, force: true }); fs.mkdirSync(map, { recursive: true });
  schrijfArray(map, 'coords.f64', coords); schrijfArray(map, 'offsets.u32', offsets);
  schrijfArray(map, 'doelen.u32', doelen); schrijfArray(map, 'kosten.f32', kosten);
  schrijfArray(map, 'lengtes.f32', lengtes); schrijfArray(map, 'wegen.u32', wegen); schrijfArray(map, 'vlaggen.u8', vlaggen);
  fs.writeFileSync(path.join(map, 'graaf.json'), JSON.stringify({ versie: 1, knopen, kanten,
    bron: 'Rijkswaterstaat Nationaal Wegenbestand (NWB)', licentie: 'CC0 1.0', gebouwdAt: new Date().toISOString() }));
  fs.rmSync(vast, { recursive: true, force: true }); fs.renameSync(map, vast);
  console.log('[NWB] binaire graaf klaar: ' + Math.round((coords.byteLength + offsets.byteLength + doelen.byteLength + kosten.byteLength + lengtes.byteLength + wegen.byteLength + vlaggen.byteLength) / 1048576) + ' MB.');
}

function bouw(bronBestand, doelBestand) {
  fs.mkdirSync(path.dirname(doelBestand), { recursive: true });
  const tijdelijk = doelBestand + '.nieuw';
  fs.rmSync(tijdelijk, { force: true });
  const bron = new DatabaseSync(bronBestand, { readOnly: true });
  const db = new DatabaseSync(tijdelijk);
  schema(db);
  const knoop = db.prepare('INSERT OR IGNORE INTO nodes(id,lat,lng) VALUES(?,?,?)');
  const weg = db.prepare('INSERT INTO roads VALUES(?,?,?,?,?,?,?,?,?,?)');
  const kant = db.prepare('INSERT INTO edges VALUES(?,?,?,?,?,?,?,?,?,?)');
  const plek = db.prepare('INSERT OR IGNORE INTO plaatsen(naam,extra,soort,lat,lng,gewicht) VALUES(?,?,?,?,?,?)');
  const steden = new Map(), gemeenten = new Map();
  const sql = `SELECT WVK_ID,JTE_ID_BEG,JTE_ID_END,RIJRICHTNG,BST_CODE,FRC,WEGBEHSRT,
    WEGNR_FRML,ROUTELTR,ROUTENR,STT_NAAM,WPSNAAM,GME_NAAM,geom FROM Wegvakken`;
  let n = 0, over = 0;
  db.exec('BEGIN');
  for (const r of bron.prepare(sql).iterate()) {
    let punten;
    try { punten = puntenUit(r.geom); } catch (_) { over++; continue; }
    if (punten.length < 2 || !r.JTE_ID_BEG || !r.JTE_ID_END) { over++; continue; }
    const a = punten[0], b = punten[punten.length - 1];
    const lengte = Math.max(1, lengteRd(punten)), v = snelheid(r.FRC), hoofd = Number(r.FRC) <= 3 || r.WEGBEHSRT === 'R';
    const naam = String(r.STT_NAAM || '').trim(), ref = wegref(r), g = grens(punten), mask = toegang(r.BST_CODE);
    knoop.run(r.JTE_ID_BEG, a.lat, a.lng); knoop.run(r.JTE_ID_END, b.lat, b.lng);
    weg.run(r.WVK_ID, lengte, hoofd ? 1 : 0, naam, ref, r.geom, g.minLat, g.maxLat, g.minLng, g.maxLng);
    const voeg = (van, naar, omgekeerd) => kant.run(van, naar, r.WVK_ID, lengte / v, lengte, hoofd ? 1 : 0, mask, omgekeerd, naam, ref);
    if (r.RIJRICHTNG !== 'T') voeg(r.JTE_ID_BEG, r.JTE_ID_END, 0);
    if (r.RIJRICHTNG !== 'H') voeg(r.JTE_ID_END, r.JTE_ID_BEG, 1);
    const midden = punten[Math.floor(punten.length / 2)];
    if (naam) plek.run(naam, String(r.WPSNAAM || r.GME_NAAM || '').trim(), 'straat', midden.lat, midden.lng, 1);
    tel(steden, r.WPSNAAM, midden); tel(gemeenten, r.GME_NAAM, midden);
    n++;
    if (n % 25000 === 0) { db.exec('COMMIT; BEGIN'); console.log('[NWB] ' + n.toLocaleString('nl-NL') + ' wegvakken'); }
  }
  for (const [naam, s] of steden) plek.run(naam, 'Nederland', 'woonplaats', s.lat / s.n, s.lng / s.n, s.n);
  for (const [naam, s] of gemeenten) plek.run('Gemeente ' + naam, 'Nederland', 'gemeente', s.lat / s.n, s.lng / s.n, s.n);
  db.exec('COMMIT');
  console.log('[NWB] ruimtelijke en zoekindex bouwen...');
  db.exec(`INSERT INTO node_rtree SELECT id,lng,lng,lat,lat FROM nodes;
    INSERT INTO road_rtree SELECT id,minLng,maxLng,minLat,maxLat FROM roads;
    CREATE VIRTUAL TABLE plaatsen_fts USING fts5(naam,extra,content='plaatsen',content_rowid='id',tokenize='unicode61 remove_diacritics 2');
    INSERT INTO plaatsen_fts(plaatsen_fts) VALUES('rebuild');
    CREATE INDEX plaatsen_soort_gewicht ON plaatsen(soort,gewicht DESC);
    INSERT INTO meta VALUES('bron','Rijkswaterstaat Nationaal Wegenbestand (NWB)');
    INSERT INTO meta VALUES('licentie','CC0 1.0');
    INSERT INTO meta VALUES('bron_url','${BRON_URL}');
    INSERT INTO meta VALUES('gebouwd_at','${new Date().toISOString()}');
    INSERT INTO meta VALUES('wegvakken','${n}');
    INSERT INTO meta VALUES('overgeslagen','${over}');
    ANALYZE; PRAGMA journal_mode=DELETE;`);
  const nodes = db.prepare('SELECT count(*) AS n FROM nodes').get().n;
  const edges = db.prepare('SELECT count(*) AS n FROM edges').get().n;
  bouwGraaf(db, tijdelijk);
  db.close(); bron.close();
  fs.renameSync(tijdelijk, doelBestand);
  console.log('[NWB] klaar: ' + n.toLocaleString('nl-NL') + ' wegvakken, ' + Number(nodes).toLocaleString('nl-NL') + ' knopen, ' + Number(edges).toLocaleString('nl-NL') + ' gerichte kanten.');
  console.log('[NWB] ' + doelBestand);
}

(async () => {
  try {
    if (process.argv.includes('--alleen-graaf')) {
      const db = new DatabaseSync(uitPad); bouwGraaf(db, uitPad); db.close(); return;
    }
    if (!bronPad) bronPad = await download();
    bouw(bronPad, uitPad);
  } finally {
    if (tijdelijkeBron && bronPad) fs.rmSync(path.dirname(bronPad), { recursive: true, force: true });
  }
})().catch(e => { console.error('[NWB] ' + e.message); process.exitCode = 1; });
