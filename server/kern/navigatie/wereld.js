/* RTG World Graph: wereldatlas plus lokaal geïnstalleerde OSM-regiopakketten.
   De atlas kan overal tekenen en zoeken; een route wordt uitsluitend berekend
   wanneer beide punten binnen dezelfde echte, lokale routegraaf vallen. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { maakRegioNet, maakRegioZoek, pakketPad } = require('./wereld-regio');

let atlasCache;
function atlas() {
  if (atlasCache) return atlasCache;
  const bestand = path.join(__dirname, '..', '..', '..', 'public', 'data', 'wereld-atlas.json');
  atlasCache = fs.existsSync(bestand) ? JSON.parse(fs.readFileSync(bestand, 'utf8'))
    : { versie: 1, landen: [], steden: [], bron: 'RTG World Atlas' };
  return atlasCache;
}
const kaal = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const binnen = (p, b) => p && b && Number(p.lat) >= b.lat0 && Number(p.lat) <= b.lat1
  && Number(p.lng) >= b.lng0 && Number(p.lng) <= b.lng1;
const oppervlakte = b => (b.lat1 - b.lat0) * (b.lng1 - b.lng0);

function atlasZoek(q) {
  const a = atlas(), zoek = kaal(q), uit = [];
  const score = naam => { const n = kaal(naam); return n === zoek ? 100 : n.startsWith(zoek) ? 82 : n.includes(zoek) ? 60 : 0; };
  for (const p of a.steden || []) { const s = zoek ? Math.max(score(p.naam), score(p.land)) : Number(p.rang || 0);
    if (s) uit.push({ naam: p.naam, extra: p.land, soort: 'wereldstad', laag: 'wereld', lat: p.lat, lng: p.lng, land: p.iso, zoekScore: s }); }
  for (const p of a.landen || []) { const s = zoek ? Math.max(score(p.naam), score(p.iso)) : 0;
    if (s) uit.push({ naam: p.naam, extra: p.continent, soort: 'land', laag: 'wereld', lat: p.lat, lng: p.lng, land: p.iso, zoekScore: s }); }
  return uit.sort((x, y) => y.zoekScore - x.zoekScore).slice(0, 35);
}

function maakWereldNet({ haversine, map }) {
  const data = process.env.RTG_DATA_DIR || path.join(__dirname, '..', '..', 'data');
  map = map || process.env.RTG_NAV_WORLD_DIR || path.join(data, 'navigatie', 'wereld');
  const manifestPad = path.join(map, 'manifest.json');
  let defs = [];
  if (fs.existsSync(manifestPad)) { const m = JSON.parse(fs.readFileSync(manifestPad, 'utf8')); defs = Array.isArray(m.regios) ? m.regios : []; }
  const cache = new Map(), zoekCache = new Map();
  const beschikbaar = def => { try {
    return fs.existsSync(pakketPad(map, def.db || def.id + '.sqlite'))
      && fs.existsSync(path.join(pakketPad(map, def.graaf || def.id + '-graaf'), 'graaf.json'));
  } catch (_) { return false; } };
  const laad = def => { if (!cache.has(def.id)) cache.set(def.id, maakRegioNet(def, map, haversine)); return cache.get(def.id); };
  const laadZoek = def => { if (!zoekCache.has(def.id)) zoekCache.set(def.id, maakRegioZoek(def, map)); return zoekCache.get(def.id); };
  const kandidaten = (a, b) => defs.filter(d => binnen(a, d.bounds) && (!b || binnen(b, d.bounds))).sort((x, y) => oppervlakte(x.bounds) - oppervlakte(y.bounds));
  const regioVoor = (a, b) => { for (const def of kandidaten(a, b)) { const n = laad(def); if (n) return n; } return null; };
  function zoekPlekken(q) {
    const uit = atlasZoek(q);
    if (String(q || '').trim().length >= 2) for (const def of defs.filter(beschikbaar)) { const z = laadZoek(def); if (z) uit.push(...z.zoekPlekken(q)); }
    const gezien = new Set(); return uit.filter(p => { const k = kaal(p.naam) + ':' + p.lat.toFixed(4) + ':' + p.lng.toFixed(4);
      if (gezien.has(k)) return false; gezien.add(k); return true; }).slice(0, 50);
  }
  function kaart(hier, plekken, forceWorld) {
    const regio = !forceWorld && regioVoor(hier);
    if (regio) return regio.kaart(hier, plekken);
    const a = atlas(); return { status: 200, netwerk: 'RTG-WORLD-ATLAS', ref: { lat: 18, lng: 0 },
      bounds: { lat0: -90, lat1: 90, lng0: -180, lng1: 180 }, landen: a.landen || [], steden: a.steden || [],
      plekken: [], dekking: { landen: (a.landen || []).length, regios: defs.filter(beschikbaar).map(d => ({ id: d.id, naam: d.naam, bounds: d.bounds })),
        bron: a.bron, licentie: a.licentie, gebouwdAt: a.gebouwdAt } };
  }
  function status(hier) { const actief = regioVoor(hier), a = atlas(); return { actief: !!actief,
    hierActief: !!actief, regio: actief && actief.def.naam, landen: (a.landen || []).length,
    regios: defs.map(d => ({ id: d.id, naam: d.naam, actief: beschikbaar(d), geladen: cache.has(d.id) && !!cache.get(d.id), bounds: d.bounds })),
    bron: a.bron, licentie: a.licentie, gebouwdAt: a.gebouwdAt }; }
  return { atlas: atlas(), zoekPlekken, kaart, status, regioVoor };
}

module.exports = { maakWereldNet, atlasZoek, binnen };
