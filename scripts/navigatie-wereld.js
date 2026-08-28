#!/usr/bin/env node
/* Bouwt uit ieder standaard .osm.pbf-bestand een zelfstandig RTG World Graph-
   regiopakket. Een land, continent of de planeet gebruikt exact hetzelfde
   formaat; productie kiest continentpakketten voor snelle, gerichte updates. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { leesPbf } = require('./lib/osm-pbf');
const { schrijfLijn, grens } = require('../server/kern/navigatie/wereld-geo');

const DATA = process.env.RTG_DATA_DIR || path.join(__dirname, '..', 'server', 'data');
const arg = naam => { const i = process.argv.indexOf(naam); return i >= 0 ? process.argv[i + 1] : ''; };
const bron = arg('--bron') && path.resolve(arg('--bron'));
const id = String(arg('--regio') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
const naam = arg('--naam') || id;
const map = path.resolve(arg('--uit') || path.join(DATA, 'navigatie', 'wereld'));
if (!bron || !id) { console.error('Gebruik: npm run navigatie:wereld -- --bron regio.osm.pbf --regio europa --naam Europa'); process.exit(2); }

const haversine = (a, b) => { const r = Math.PI / 180, p1 = a.lat * r, p2 = b.lat * r;
  const dlat = (b.lat - a.lat) * r, dlng = (b.lng - a.lng) * r;
  const x = Math.sin(dlat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); };
function snelheid(tags) {
  const m = String(tags.maxspeed || '').match(/\d+/); if (m) return Math.max(5, Math.min(140, +m[0] * (/mph/i.test(tags.maxspeed) ? 1.60934 : 1))) / 3.6;
  const k = { motorway: 110, motorway_link: 70, trunk: 90, trunk_link: 60, primary: 70, primary_link: 50,
    secondary: 60, tertiary: 50, residential: 30, unclassified: 40, service: 20, living_street: 15,
    cycleway: 18, footway: 6, pedestrian: 6, path: 10, steps: 4 };
  return (k[tags.highway] || 30) / 3.6;
}
function toegang(t) {
  let m = ['motorway', 'motorway_link'].includes(t.highway) ? 1
    : ['footway', 'pedestrian', 'steps'].includes(t.highway) ? 4
      : ['cycleway', 'path'].includes(t.highway) ? 6 : 7;
  if (t.access === 'no') m = 0; if (['no', 'private'].includes(t.motor_vehicle)) m &= ~1;
  if (['no', 'private'].includes(t.bicycle)) m &= ~2; if (['no', 'private'].includes(t.foot)) m &= ~4;
  if (['yes', 'designated', 'permissive'].includes(t.motor_vehicle)) m |= 1;
  if (['yes', 'designated', 'permissive'].includes(t.bicycle)) m |= 2;
  if (['yes', 'designated', 'permissive'].includes(t.foot)) m |= 4; return m;
}
const hoofdweg = h => ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary'].includes(h);
function schema(db) { db.exec(`PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA temp_store=MEMORY; PRAGMA cache_size=-250000;
  CREATE TABLE meta(sleutel TEXT PRIMARY KEY,waarde TEXT NOT NULL) WITHOUT ROWID;
  CREATE TABLE nodes(id INTEGER PRIMARY KEY,lat REAL NOT NULL,lng REAL NOT NULL);
  CREATE TABLE roads(id INTEGER PRIMARY KEY,osm_id INTEGER,lengte REAL NOT NULL,hoofd INTEGER NOT NULL,naam TEXT,ref TEXT,geom BLOB NOT NULL,minLat REAL,maxLat REAL,minLng REAL,maxLng REAL);
  CREATE TABLE edges(van INTEGER NOT NULL,naar INTEGER NOT NULL,road_id INTEGER NOT NULL,kost REAL NOT NULL,lengte REAL NOT NULL,hoofd INTEGER NOT NULL,toegang INTEGER NOT NULL);
  CREATE INDEX edges_van ON edges(van);
  CREATE TABLE plaatsen(id INTEGER PRIMARY KEY,naam TEXT NOT NULL,extra TEXT,soort TEXT NOT NULL,lat REAL NOT NULL,lng REAL NOT NULL,gewicht INTEGER NOT NULL DEFAULT 1);
  CREATE UNIQUE INDEX plaatsen_uniek ON plaatsen(naam,extra,soort);
  CREATE VIRTUAL TABLE road_rtree USING rtree(id,minLng,maxLng,minLat,maxLat);`); }
const schrijf = (dir, bestand, rij) => fs.writeFileSync(path.join(dir, bestand), Buffer.from(rij.buffer, rij.byteOffset, rij.byteLength));
function bouwGraaf(db, doelMap) {
  db.exec(`CREATE TABLE node_seq(idx INTEGER PRIMARY KEY,id INTEGER NOT NULL UNIQUE,lat REAL NOT NULL,lng REAL NOT NULL);
    INSERT INTO node_seq SELECT row_number() OVER(ORDER BY id)-1,id,lat,lng FROM nodes WHERE id IN (SELECT van FROM edges UNION SELECT naar FROM edges) ORDER BY id;
    CREATE VIRTUAL TABLE node_seq_rtree USING rtree(id,minLng,maxLng,minLat,maxLat);
    INSERT INTO node_seq_rtree SELECT idx,lng,lng,lat,lat FROM node_seq; ANALYZE;`);
  const knopen = Number(db.prepare('SELECT count(*) n FROM node_seq').get().n), kanten = Number(db.prepare('SELECT count(*) n FROM edges').get().n);
  const coords = new Float64Array(knopen * 2), offsets = new Uint32Array(knopen + 1);
  for (const n of db.prepare('SELECT idx,lat,lng FROM node_seq ORDER BY idx').iterate()) { coords[n.idx * 2] = n.lat; coords[n.idx * 2 + 1] = n.lng; }
  const doelen = new Uint32Array(kanten), kosten = new Float32Array(kanten), lengtes = new Float32Array(kanten), wegen = new Uint32Array(kanten), vlaggen = new Uint8Array(kanten);
  let z = 0, huidig = 0;
  for (const e of db.prepare(`SELECT a.idx van,b.idx naar,e.road_id,e.kost,e.lengte,e.hoofd,e.toegang FROM edges e
    JOIN node_seq a ON a.id=e.van JOIN node_seq b ON b.id=e.naar ORDER BY a.idx`).iterate()) {
    while (huidig < e.van) offsets[++huidig] = z; doelen[z] = e.naar; kosten[z] = e.kost; lengtes[z] = e.lengte;
    wegen[z] = e.road_id; vlaggen[z] = (e.toegang & 7) | (e.hoofd ? 8 : 0); z++;
  }
  while (huidig < knopen) offsets[++huidig] = z;
  const nieuw = doelMap + '.nieuw'; fs.rmSync(nieuw, { recursive: true, force: true }); fs.mkdirSync(nieuw, { recursive: true });
  schrijf(nieuw, 'coords.f64', coords); schrijf(nieuw, 'offsets.u32', offsets); schrijf(nieuw, 'doelen.u32', doelen);
  schrijf(nieuw, 'kosten.f32', kosten); schrijf(nieuw, 'lengtes.f32', lengtes); schrijf(nieuw, 'wegen.u32', wegen); schrijf(nieuw, 'vlaggen.u8', vlaggen);
  fs.writeFileSync(path.join(nieuw, 'graaf.json'), JSON.stringify({ versie: 1, knopen, kanten, bron: 'OpenStreetMap', licentie: 'ODbL 1.0', gebouwdAt: new Date().toISOString() }));
  fs.rmSync(doelMap, { recursive: true, force: true }); fs.renameSync(nieuw, doelMap); return { knopen, kanten };
}
function manifest(def) {
  const bestand = path.join(map, 'manifest.json'); let m = { versie: 1, regios: [] };
  if (fs.existsSync(bestand)) m = JSON.parse(fs.readFileSync(bestand, 'utf8'));
  m.regios = (m.regios || []).filter(x => x.id !== def.id).concat(def); m.bijgewerktAt = new Date().toISOString();
  fs.writeFileSync(bestand, JSON.stringify(m, null, 2));
}
function bouw() {
  if (!fs.existsSync(bron)) throw new Error('Bronbestand bestaat niet: ' + bron); fs.mkdirSync(map, { recursive: true });
  const doel = path.join(map, id + '.sqlite'), tijdelijk = doel + '.nieuw', graaf = path.join(map, id + '-graaf');
  fs.rmSync(tijdelijk, { force: true }); const db = new DatabaseSync(tijdelijk); schema(db);
  const node = db.prepare('INSERT OR REPLACE INTO nodes VALUES(?,?,?)');
  const plek = db.prepare('INSERT OR IGNORE INTO plaatsen(naam,extra,soort,lat,lng,gewicht) VALUES(?,?,?,?,?,?)');
  const road = db.prepare('INSERT INTO roads VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  const edge = db.prepare('INSERT INTO edges VALUES(?,?,?,?,?,?,?)'), coord = db.prepare('SELECT lat,lng FROM nodes WHERE id=?');
  let nodes = 0, ways = 0, roadId = 0, over = 0, g = { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 };
  db.exec('BEGIN');
  leesPbf(bron, {
    node(n) { node.run(n.id, n.lat, n.lng); nodes++;
      if (n.tags.name && n.tags.place) plek.run(n.tags.name, n.tags['is_in'] || naam, ['city','town'].includes(n.tags.place) ? 'stad' : 'plaats', n.lat, n.lng, Number(n.tags.population) || 10);
      if (nodes % 500000 === 0) { db.exec('COMMIT; BEGIN'); console.log('[WORLD] ' + nodes.toLocaleString('nl-NL') + ' knopen'); } },
    way(w) { const t = w.tags; if (!t.highway || w.refs.length < 2) return; const punten = [];
      for (const ref of w.refs) { const p = coord.get(ref); if (p) punten.push({ id: ref, lat: p.lat, lng: p.lng }); }
      if (punten.length < 2) { over++; return; } const mask = toegang(t); if (!mask) return;
      let lengte = 0; for (let i = 1; i < punten.length; i++) lengte += haversine(punten[i - 1], punten[i]);
      const rid = ++roadId, hoofd = hoofdweg(t.highway), box = grens(punten), v = snelheid(t), oneway = String(t.oneway || '').toLowerCase();
      road.run(rid, w.id, lengte, hoofd ? 1 : 0, t.name || '', t.ref || '', schrijfLijn(punten), box.minLat, box.maxLat, box.minLng, box.maxLng);
      for (let i = 1; i < punten.length; i++) { const a = punten[i - 1], b = punten[i], m = Math.max(1, haversine(a, b));
        if (oneway !== '-1') edge.run(a.id, b.id, rid, m / v, m, hoofd ? 1 : 0, mask);
        if (!['yes','1','true'].includes(oneway) && t.junction !== 'roundabout') edge.run(b.id, a.id, rid, m / v, m, hoofd ? 1 : 0, mask); }
      const midden = punten[Math.floor(punten.length / 2)]; if (t.name) plek.run(t.name, naam, 'straat', midden.lat, midden.lng, 1);
      g.minLat = Math.min(g.minLat, box.minLat); g.maxLat = Math.max(g.maxLat, box.maxLat); g.minLng = Math.min(g.minLng, box.minLng); g.maxLng = Math.max(g.maxLng, box.maxLng);
      ways++; if (ways % 50000 === 0) { db.exec('COMMIT; BEGIN'); console.log('[WORLD] ' + ways.toLocaleString('nl-NL') + ' wegen'); } },
    voortgang() {}
  });
  db.exec('COMMIT'); console.log('[WORLD] zoek- en ruimte-indexen bouwen...');
  db.exec(`INSERT INTO road_rtree SELECT id,minLng,maxLng,minLat,maxLat FROM roads;
    CREATE VIRTUAL TABLE plaatsen_fts USING fts5(naam,extra,content='plaatsen',content_rowid='id',tokenize='unicode61 remove_diacritics 2');
    INSERT INTO plaatsen_fts(plaatsen_fts) VALUES('rebuild'); CREATE INDEX plaatsen_soort_gewicht ON plaatsen(soort,gewicht DESC);`);
  const gebouwdAt = new Date().toISOString(); const meta = db.prepare('INSERT INTO meta VALUES(?,?)');
  for (const [k, v] of Object.entries({ bron: 'OpenStreetMap', licentie: 'ODbL 1.0', bron_url: 'https://planet.openstreetmap.org/', gebouwd_at: gebouwdAt,
    regio: naam, wegen: ways, knopen_bron: nodes, overgeslagen: over, lat0: g.minLat, lat1: g.maxLat, lng0: g.minLng, lng1: g.maxLng })) meta.run(k, String(v));
  const statistiek = bouwGraaf(db, graaf);
  /* De bouwtabellen zijn na het verpakken niet meer nodig. Alleen de compacte
     node_seq, zoekindex, wegvormen en binaire adjacency arrays gaan live. */
  db.exec('DROP TABLE edges; DROP TABLE nodes; PRAGMA journal_mode=DELETE; VACUUM;');
  db.close(); fs.rmSync(doel, { force: true }); fs.renameSync(tijdelijk, doel);
  manifest({ id, naam, db: id + '.sqlite', graaf: id + '-graaf', bounds: { lat0: g.minLat, lat1: g.maxLat, lng0: g.minLng, lng1: g.maxLng },
    bron: 'OpenStreetMap', licentie: 'ODbL 1.0', gebouwdAt });
  console.log('[WORLD] klaar: ' + ways.toLocaleString('nl-NL') + ' wegen, ' + statistiek.knopen.toLocaleString('nl-NL') + ' routeknopen, ' + statistiek.kanten.toLocaleString('nl-NL') + ' kanten.');
}
try { bouw(); } catch (e) { console.error('[WORLD] ' + e.message); process.exitCode = 1; }
