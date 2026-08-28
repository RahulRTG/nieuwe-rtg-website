/* Een enkel lokaal RTG World Graph-regiopakket: compacte arrays voor A*,
   SQLite voor ruimtelijk snappen, zoeken en het tekenen van echte wegen. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { leesLijn } = require('./wereld-geo');

function pakketPad(map, relatief) {
  const wortel = path.resolve(map), kandidaat = path.resolve(wortel, relatief);
  if (kandidaat !== wortel && !kandidaat.startsWith(wortel + path.sep)) throw new Error('Ongeldig World Graph-pakketpad.');
  return kandidaat;
}

const zoekWoorden = q => String(q || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-zA-Z0-9]+/g) || [];
function maakPlekZoeker(db, def) {
  const qPlek = db.prepare(`SELECT p.naam,p.extra,p.soort,p.lat,p.lng,p.gewicht FROM plaatsen_fts f
    JOIN plaatsen p ON p.id=f.rowid WHERE plaatsen_fts MATCH ? ORDER BY CASE p.soort
    WHEN 'stad' THEN 0 WHEN 'plaats' THEN 1 ELSE 2 END,rank,p.gewicht DESC LIMIT 35`);
  const qGroot = db.prepare(`SELECT naam,extra,soort,lat,lng,gewicht FROM plaatsen
    WHERE soort IN ('stad','plaats') ORDER BY gewicht DESC LIMIT 24`);
  return q => {
    const woorden = zoekWoorden(q), rij = woorden.length ? qPlek.all(woorden.map(w => '"' + w + '"*').join(' ')) : qGroot.all();
    return rij.map(p => ({ ...p, extra: p.extra || def.naam, laag: 'wereld', regio: def.id, land: p.land || '' }));
  };
}

/* Zoeken opent alleen SQLite. De veel grotere binaire adjacency arrays blijven
   dicht totdat er werkelijk een route of lokale kaart voor deze regio nodig is. */
function maakRegioZoek(def, map) {
  const bestand = pakketPad(map, def.db || def.id + '.sqlite');
  if (!fs.existsSync(bestand)) return null;
  const db = new DatabaseSync(bestand, { readOnly: true });
  return { zoekPlekken: maakPlekZoeker(db, def), sluit: () => db.close() };
}

class Hoop {
  constructor() { this.rij = []; }
  zet(x) { const a = this.rij; a.push(x); let i = a.length - 1;
    while (i) { const p = (i - 1) >> 1; if (a[p].f <= x.f) break; a[i] = a[p]; i = p; } a[i] = x; }
  pak() { const a = this.rij, boven = a[0], x = a.pop(); if (!a.length) return boven; let i = 0;
    while (true) { let c = i * 2 + 1; if (c >= a.length) break; if (c + 1 < a.length && a[c + 1].f < a[c].f) c++;
      if (a[c].f >= x.f) break; a[i] = a[c]; i = c; } a[i] = x; return boven; }
  get lengte() { return this.rij.length; }
}

function maakRegioNet(def, map, haversine) {
  const bestand = pakketPad(map, def.db || def.id + '.sqlite');
  const graafMap = pakketPad(map, def.graaf || def.id + '-graaf');
  if (!fs.existsSync(bestand) || !fs.existsSync(path.join(graafMap, 'graaf.json'))) return null;
  const laad = (naam, Type) => { const b = fs.readFileSync(path.join(graafMap, naam));
    return new Type(b.buffer, b.byteOffset, b.byteLength / Type.BYTES_PER_ELEMENT); };
  const coords = laad('coords.f64', Float64Array), offsets = laad('offsets.u32', Uint32Array);
  const doelen = laad('doelen.u32', Uint32Array), kosten = laad('kosten.f32', Float32Array);
  const lengtes = laad('lengtes.f32', Float32Array), wegen = laad('wegen.u32', Uint32Array);
  const vlaggen = laad('vlaggen.u8', Uint8Array), db = new DatabaseSync(bestand, { readOnly: true });
  const qSnap = db.prepare(`SELECT n.idx AS id,n.lat,n.lng FROM node_seq_rtree x JOIN node_seq n ON n.idx=x.id
    WHERE x.minLng<=? AND x.maxLng>=? AND x.minLat<=? AND x.maxLat>=? LIMIT 160`);
  const qNaam = db.prepare('SELECT naam,ref FROM roads WHERE id=?');
  const qWegen = db.prepare(`SELECT r.id,r.hoofd,r.naam,r.ref,r.geom FROM road_rtree x JOIN roads r ON r.id=x.id
    WHERE x.minLng<=? AND x.maxLng>=? AND x.minLat<=? AND x.maxLat>=? ORDER BY r.hoofd DESC,r.lengte DESC LIMIT 2400`);
  const zoekPlekken = maakPlekZoeker(db, def);
  const meta = Object.fromEntries(db.prepare('SELECT sleutel,waarde FROM meta').all().map(x => [x.sleutel, x.waarde]));
  const meters = (a, b) => haversine(a, b);

  function snap(p) {
    for (const d of [0.002, 0.008, 0.03, 0.12, 0.4]) {
      let best = null, afstand = Infinity;
      for (const k of qSnap.all(p.lng + d, p.lng - d, p.lat + d, p.lat - d)) {
        const m = meters(p, k); if (m < afstand) { best = k; afstand = m; }
      }
      if (best) return { ...best, snapAfstandM: Math.round(afstand) };
    }
    return null;
  }
  function zoek(van, naar, opties = {}) {
    if (!van || !naar) return null; if (van.id === naar.id) return [van];
    const mask = opties.modus === 'lopen' ? 4 : opties.modus === 'fiets' ? 2 : 1;
    const kostVan = typeof opties.kost === 'function' ? opties.kost : e => e.kost;
    const h = k => meters(k, naar) / 36.1 * 0.68, open = new Hoop();
    const g = new Map([[van.id, 0]]), via = new Map(), kant = new Map(); open.zet({ i: van.id, f: h(van), g: 0 });
    let bekeken = 0;
    while (open.lengte && bekeken < 1800000) {
      const cur = open.pak(); if (cur.g !== g.get(cur.i)) continue; if (cur.i === naar.id) break;
      const a = { id: cur.i, lat: coords[cur.i * 2], lng: coords[cur.i * 2 + 1] }; bekeken++;
      for (let z = offsets[cur.i]; z < offsets[cur.i + 1]; z++) {
        if ((vlaggen[z] & mask) === 0) continue;
        const id = doelen[z], b = { id, lat: coords[id * 2], lng: coords[id * 2 + 1] };
        const rand = { i: id, kost: kosten[z], m: lengtes[z], hoofd: !!(vlaggen[z] & 8), id: String(wegen[z]) };
        const stap = Number(kostVan(rand, a, b)); if (!Number.isFinite(stap) || stap < 0) continue;
        const ng = cur.g + stap; if (ng >= (g.get(id) ?? Infinity)) continue;
        g.set(id, ng); via.set(id, cur.i); kant.set(id, z); open.zet({ i: id, g: ng, f: ng + h(b) });
      }
    }
    if (!via.has(naar.id)) return null;
    const ids = [naar.id]; let c = naar.id;
    while (c !== van.id) { c = via.get(c); if (c == null) return null; ids.push(c); } ids.reverse();
    return ids.map((id, i) => { const z = i ? kant.get(id) : null, wegId = z == null ? null : wegen[z];
      const naam = wegId == null ? null : qNaam.get(wegId); return { i: id, lat: coords[id * 2], lng: coords[id * 2 + 1],
        _edgeId: wegId == null ? '' : def.id + ':' + wegId, _seconden: z == null ? 0 : kosten[z],
        _naam: naam && naam.naam || '', _ref: naam && naam.ref || '', hoofd: z == null ? false : !!(vlaggen[z] & 8) }; });
  }
  const wind = ['noord', 'noordoost', 'oost', 'zuidoost', 'zuid', 'zuidwest', 'west', 'noordwest'];
  const richting = (a, b) => { let h = Math.atan2((b.lng - a.lng) * Math.cos(a.lat * Math.PI / 180), b.lat - a.lat) * 180 / Math.PI;
    if (h < 0) h += 360; return wind[Math.round(h / 45) % 8]; };
  function stappenVan(poly) {
    if (poly.length < 2) return []; const st = [{ instructie: 'Vertrek richting ' + richting(poly[0], poly[1]), afstandM: 0, bocht: 'start' }];
    let sinds = 0, huidig = '';
    for (let i = 1; i < poly.length; i++) { sinds += meters(poly[i - 1], poly[i]); const naam = poly[i]._ref || poly[i]._naam || '';
      if (!naam || naam === huidig || sinds < 120 || i === poly.length - 1) { if (naam) huidig = naam; continue; }
      st[st.length - 1].afstandM = Math.round(sinds); sinds = 0; huidig = naam;
      st.push({ instructie: 'Volg ' + naam + ' richting ' + richting(poly[i - 1], poly[i]), afstandM: 0, bocht: 'rechtdoor' }); }
    st[st.length - 1].afstandM += Math.round(sinds); st.push({ instructie: 'Bestemming bereikt', afstandM: 0, bocht: 'eind' }); return st;
  }
  function kaart(hier, plekken) {
    const dy = 0.055, dx = dy / Math.max(0.35, Math.cos(hier.lat * Math.PI / 180));
    const rij = qWegen.all(hier.lng + dx, hier.lng - dx, hier.lat + dy, hier.lat - dy).map(r => {
      const alle = leesLijn(r.geom), stap = Math.max(1, Math.floor(alle.length / 42));
      return { id: def.id + ':' + r.id, hoofd: !!r.hoofd, naam: r.naam || '', ref: r.ref || '',
        punten: alle.filter((_, i) => i % stap === 0 || i === alle.length - 1) }; });
    return { status: 200, netwerk: 'RTG-WORLD-GRAPH', regio: def.id, ref: { lat: hier.lat, lng: hier.lng },
      bounds: { lat0: hier.lat - dy, lat1: hier.lat + dy, lng0: hier.lng - dx, lng1: hier.lng + dx }, wegen: rij,
      plekken: (plekken || []).filter(p => meters(p, hier) <= 35000),
      dekking: { regio: def.naam, wegen: Number(meta.wegen || 0), bron: meta.bron, licentie: meta.licentie, gebouwdAt: meta.gebouwd_at } };
  }
  return { id: def.id, def, snap, zoek, stappenVan, zoekPlekken, kaart, info: { ...meta, regio: def.naam, bestand } };
}

module.exports = { maakRegioNet, maakRegioZoek, pakketPad };
