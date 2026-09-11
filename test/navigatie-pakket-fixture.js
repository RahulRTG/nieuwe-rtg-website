/* EEN ECHT KAARTPAKKET, KLEIN GENOEG OM MET DE HAND TE MAKEN.

   Drie knopen op een lijn met kanten heen en terug, in de vorm die
   server/kern/navigatie/gebiednet.js werkelijk leest: een SQLite met
   r-tree-indexen en FTS naast een map met de binaire graaf. Geen fake en geen
   mock -- de motor draait er echt op, en dat is het halve punt: een verzonnen
   net bewijst niets over de code die een pakket van schijf inleest.

   HIJ STOND INLINE IN test/navigatie.test.js (toets 12) en is eruit gehaald
   toen de tweede toets hem nodig had. Twee handgeschreven pakketbouwers gaan
   binnen een half jaar iets anders bouwen, en dan zakt de ene toets op iets
   wat de andere niet ziet (LAT.md regel 4).

   DE NAAMGEVING VOLGT `pakketVan()` uit kern/navigatie/pakket.js: `<code>.sqlite`
   met `<code>-graaf` ernaast. Wie hier iets anders verzint, toetst een
   bestandsnaam die in productie niet bestaat. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

/* Drie knopen rond een gegeven punt, met een vaste stap. `lat`/`lng` maken het
   pakket verplaatsbaar: hetzelfde net in Nederland of in Frankrijk, zodat een
   toets over gebiedskeuze niet ook nog een tweede net hoeft te verzinnen. */
function bouwPakket({ map, code = 'nederland', lat = 52.36, lng = 4.89,
  stapLat = 0.001, stapLng = 0.01,
  plaats = 'Amsterdam', land = 'Nederland', bron = 'NWB test', licentie = 'CC0 1.0' }) {
  const bestand = path.join(map, code + '.sqlite');
  const graafMap = path.join(map, code + '-graaf');
  fs.mkdirSync(graafMap, { recursive: true });
  /* De twee stappen zijn met opzet verschillend en staan op de waarden waarop
     toets 12 van test/navigatie.test.js is geschreven (0,001 breedte en 0,01
     lengte). Een fixture die de meetkunde "netter" maakt, verandert stil
     waarop een groene toets rustte. */
  const p = [[lat, lng], [lat + stapLat, lng + stapLng], [lat + 2 * stapLat, lng + 2 * stapLng]];
  const db = new DatabaseSync(bestand);
  db.exec(`CREATE TABLE meta(sleutel TEXT PRIMARY KEY,waarde TEXT);
    CREATE TABLE node_seq(idx INTEGER PRIMARY KEY,id INTEGER UNIQUE,lat REAL,lng REAL);
    CREATE VIRTUAL TABLE node_seq_rtree USING rtree(id,minLng,maxLng,minLat,maxLat);
    CREATE TABLE roads(id INTEGER PRIMARY KEY,lengte REAL,hoofd INTEGER,naam TEXT,ref TEXT,geom BLOB,minLat REAL,maxLat REAL,minLng REAL,maxLng REAL);
    CREATE VIRTUAL TABLE road_rtree USING rtree(id,minLng,maxLng,minLat,maxLat);
    CREATE TABLE plaatsen(id INTEGER PRIMARY KEY,naam TEXT,extra TEXT,soort TEXT,lat REAL,lng REAL,gewicht INTEGER);
    CREATE VIRTUAL TABLE plaatsen_fts USING fts5(naam,extra,content='plaatsen',content_rowid='id');`);
  const zetMeta = db.prepare('INSERT INTO meta VALUES(?,?)');
  for (const [k, v] of [['wegvakken', '2'], ['bron', bron], ['licentie', licentie]]) zetMeta.run(k, v);
  const zetKnoop = db.prepare('INSERT INTO node_seq VALUES(?,?,?,?)');
  p.forEach((q, i) => zetKnoop.run(i, 100 + i, q[0], q[1]));
  db.exec('INSERT INTO node_seq_rtree SELECT idx,lng,lng,lat,lat FROM node_seq;');
  const zetWeg = db.prepare('INSERT INTO roads(id,lengte,hoofd,naam,ref,geom) VALUES(?,?,?,?,?,?)');
  zetWeg.run(10, 700, 1, 'Testweg', 'A1', Buffer.from([0]));
  zetWeg.run(11, 700, 1, 'Testweg', 'A1', Buffer.from([0]));
  db.prepare('INSERT INTO plaatsen VALUES(?,?,?,?,?,?,?)').run(1, plaats, land, 'woonplaats', p[0][0], p[0][1], 100);
  db.exec("INSERT INTO plaatsen_fts(plaatsen_fts) VALUES('rebuild');");
  db.close();

  const schrijf = (naam, rij) => fs.writeFileSync(path.join(graafMap, naam), Buffer.from(rij.buffer));
  schrijf('coords.f64', new Float64Array([p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1]]));
  schrijf('offsets.u32', new Uint32Array([0, 1, 3, 4]));
  schrijf('doelen.u32', new Uint32Array([1, 0, 2, 1]));
  schrijf('kosten.f32', new Float32Array([20, 20, 20, 20]));
  schrijf('lengtes.f32', new Float32Array([700, 700, 700, 700]));
  schrijf('wegen.u32', new Uint32Array([10, 10, 11, 11]));
  schrijf('vlaggen.u8', new Uint8Array([15, 15, 15, 15]));
  fs.writeFileSync(path.join(graafMap, 'graaf.json'), JSON.stringify({ versie: 1, knopen: 3, kanten: 4 }));
  return { bestand, graafMap, punten: p.map(q => ({ lat: q[0], lng: q[1] })) };
}

module.exports = { bouwPakket };
