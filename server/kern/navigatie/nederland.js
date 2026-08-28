/* Schaalbare runtime voor de eigen Nederlandse routegraaf. De grote NWB-data
   staat in RTG_DATA_DIR; de server leest alleen lokale SQLite-indexen. De enige
   externe stap is het verversbare bouwscript, nooit een routeverzoek. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { puntenUit } = require('./nwb-geo');

const NL = { lat0: 50.70, lat1: 53.72, lng0: 3.20, lng1: 7.30 };
const binnenNederland = p => p && Number(p.lat) >= NL.lat0 && Number(p.lat) <= NL.lat1
  && Number(p.lng) >= NL.lng0 && Number(p.lng) <= NL.lng1;

class Hoop {
  constructor() { this.rij = []; }
  zet(x) {
    const a = this.rij; a.push(x); let i = a.length - 1;
    while (i) { const p = (i - 1) >> 1; if (a[p].f <= x.f) break; a[i] = a[p]; i = p; }
    a[i] = x;
  }
  pak() {
    const a = this.rij, boven = a[0], x = a.pop();
    if (!a.length) return boven;
    let i = 0;
    while (true) {
      let c = i * 2 + 1; if (c >= a.length) break;
      if (c + 1 < a.length && a[c + 1].f < a[c].f) c++;
      if (a[c].f >= x.f) break; a[i] = a[c]; i = c;
    }
    a[i] = x; return boven;
  }
  get lengte() { return this.rij.length; }
}

function standaardPad() {
  const data = process.env.RTG_DATA_DIR || path.join(__dirname, '..', '..', 'data');
  return process.env.RTG_NAV_NL_DB || path.join(data, 'navigatie', 'nederland.sqlite');
}

function maakNederlandNet({ bestand = standaardPad(), haversine }) {
  if (!fs.existsSync(bestand)) return null;
  const graafMap = path.join(path.dirname(bestand), 'nederland-graaf');
  if (!fs.existsSync(path.join(graafMap, 'graaf.json'))) return null;
  const laad = (naam, Type) => {
    const b = fs.readFileSync(path.join(graafMap, naam));
    return new Type(b.buffer, b.byteOffset, b.byteLength / Type.BYTES_PER_ELEMENT);
  };
  const coords = laad('coords.f64', Float64Array), offsets = laad('offsets.u32', Uint32Array);
  const doelen = laad('doelen.u32', Uint32Array), kosten = laad('kosten.f32', Float32Array);
  const lengtes = laad('lengtes.f32', Float32Array), wegen = laad('wegen.u32', Uint32Array);
  const vlaggen = laad('vlaggen.u8', Uint8Array);
  const graaf = JSON.parse(fs.readFileSync(path.join(graafMap, 'graaf.json'), 'utf8'));
  const db = new DatabaseSync(bestand, { readOnly: true });
  const qSnap = db.prepare(`SELECT n.idx AS id,n.lat,n.lng FROM node_seq_rtree x JOIN node_seq n ON n.idx=x.id
    WHERE x.minLng<=? AND x.maxLng>=? AND x.minLat<=? AND x.maxLat>=? LIMIT 120`);
  const qWegnaam = db.prepare('SELECT naam,ref FROM roads WHERE id=?');
  const qWegen = db.prepare(`SELECT r.id,r.hoofd,r.naam,r.ref,r.geom FROM road_rtree x
    JOIN roads r ON r.id=x.id WHERE x.minLng<=? AND x.maxLng>=? AND x.minLat<=? AND x.maxLat>=?
    ORDER BY r.hoofd DESC,r.lengte DESC LIMIT 2200`);
  const qPlek = db.prepare(`SELECT p.naam,p.extra,p.soort,p.lat,p.lng,p.gewicht FROM plaatsen_fts f
    JOIN plaatsen p ON p.id=f.rowid WHERE plaatsen_fts MATCH ? ORDER BY CASE p.soort
    WHEN 'woonplaats' THEN 0 WHEN 'gemeente' THEN 1 ELSE 2 END,rank,p.gewicht DESC LIMIT 40`);
  const qGroot = db.prepare(`SELECT naam,extra,soort,lat,lng,gewicht FROM plaatsen
    WHERE soort='woonplaats' ORDER BY gewicht DESC LIMIT 24`);
  const meta = Object.fromEntries(db.prepare('SELECT sleutel,waarde FROM meta').all().map(x => [x.sleutel, x.waarde]));
  const meters = (a, b) => haversine(a, b);

  function snap(p) {
    for (const d of [0.002, 0.008, 0.03, 0.12]) {
      const kandidaten = qSnap.all(p.lng + d, p.lng - d, p.lat + d, p.lat - d);
      let best = null, afstand = Infinity;
      for (const k of kandidaten) { const m = meters(p, k); if (m < afstand) { best = k; afstand = m; } }
      if (best) return { ...best, snapAfstandM: Math.round(afstand) };
    }
    return null;
  }

  function zoek(van, naar, opties = {}) {
    if (!van || !naar) return null;
    if (van.id === naar.id) return [van];
    const mask = opties.modus === 'lopen' ? 4 : opties.modus === 'fiets' ? 2 : 1;
    const kostVan = typeof opties.kost === 'function' ? opties.kost : e => e.kost;
    const h = k => meters(k, naar) / 36.1 * 0.68;
    const open = new Hoop(), g = new Map([[van.id, 0]]), via = new Map(), kant = new Map();
    open.zet({ i: van.id, f: h(van), g: 0 });
    let bekeken = 0;
    while (open.lengte && bekeken < 1200000) {
      const cur = open.pak();
      if (cur.g !== g.get(cur.i)) continue;
      if (cur.i === naar.id) break;
      const vanP = { id: cur.i, i: cur.i, lat: coords[cur.i * 2], lng: coords[cur.i * 2 + 1] }; bekeken++;
      for (let z = offsets[cur.i]; z < offsets[cur.i + 1]; z++) {
        if ((vlaggen[z] & mask) === 0) continue;
        const doelId = doelen[z], doel = { id: doelId, i: doelId, lat: coords[doelId * 2], lng: coords[doelId * 2 + 1] };
        const rand = { i: doelId, kost: kosten[z], m: lengtes[z], hoofd: !!(vlaggen[z] & 8), id: String(wegen[z]) };
        const stap = Number(kostVan(rand, vanP, doel));
        if (!Number.isFinite(stap) || stap < 0) continue;
        const ng = cur.g + stap;
        if (ng >= (g.get(doelId) ?? Infinity)) continue;
        g.set(doelId, ng); via.set(doelId, cur.i); kant.set(doelId, z);
        open.zet({ i: doelId, g: ng, f: ng + h(doel) });
      }
    }
    if (!via.has(naar.id)) return null;
    const ids = [naar.id]; let c = naar.id;
    while (c !== van.id) { c = via.get(c); if (c == null) return null; ids.push(c); }
    ids.reverse();
    return ids.map((id, i) => {
      const z = i ? kant.get(id) : null, wegId = z == null ? null : wegen[z];
      const naam = wegId == null ? null : qWegnaam.get(wegId);
      return { i: id, lat: coords[id * 2], lng: coords[id * 2 + 1], _edgeId: wegId == null ? '' : String(wegId),
        _seconden: z == null ? 0 : kosten[z], _naam: naam && naam.naam || '', _ref: naam && naam.ref || '',
        hoofd: z == null ? false : !!(vlaggen[z] & 8) };
    });
  }

  const wind = ['noord', 'noordoost', 'oost', 'zuidoost', 'zuid', 'zuidwest', 'west', 'noordwest'];
  function richting(a, b) {
    let h = Math.atan2((b.lng - a.lng) * Math.cos(a.lat * Math.PI / 180), b.lat - a.lat) * 180 / Math.PI;
    if (h < 0) h += 360;
    return wind[Math.round(h / 45) % 8];
  }
  function stappenVan(poly) {
    if (poly.length < 2) return [];
    const st = [{ instructie: 'Vertrek richting ' + richting(poly[0], poly[1]), afstandM: 0, bocht: 'start' }];
    let sinds = 0, huidig = '';
    for (let i = 1; i < poly.length; i++) {
      sinds += meters(poly[i - 1], poly[i]);
      const naam = poly[i]._ref || poly[i]._naam || '';
      if (!naam || naam === huidig || sinds < 120 || i === poly.length - 1) { if (naam) huidig = naam; continue; }
      st[st.length - 1].afstandM = Math.round(sinds); sinds = 0; huidig = naam;
      st.push({ instructie: 'Volg ' + naam + ' richting ' + richting(poly[i - 1], poly[i]), afstandM: 0, bocht: 'rechtdoor' });
    }
    st[st.length - 1].afstandM += Math.round(sinds);
    st.push({ instructie: 'Bestemming bereikt', afstandM: 0, bocht: 'eind' });
    return st;
  }

  function zoekPlekken(q) {
    const woorden = String(q || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-zA-Z0-9]+/g) || [];
    const rij = woorden.length ? qPlek.all(woorden.map(w => '"' + w + '"*').join(' ')) : qGroot.all();
    return rij.map(p => ({ naam: p.naam, extra: p.extra || 'Nederland', soort: p.soort,
      laag: 'wegennet', lat: p.lat, lng: p.lng, gewicht: p.gewicht }));
  }

  function wegenRond(hier) {
    const dy = 0.045, dx = dy / Math.max(0.45, Math.cos(hier.lat * Math.PI / 180));
    return qWegen.all(hier.lng + dx, hier.lng - dx, hier.lat + dy, hier.lat - dy).map(r => {
      const alle = puntenUit(r.geom), stap = Math.max(1, Math.floor(alle.length / 36));
      const punten = alle.filter((_, i) => i % stap === 0 || i === alle.length - 1).map(p => ({ lat: p.lat, lng: p.lng }));
      return { id: String(r.id), hoofd: !!r.hoofd, naam: r.naam || '', ref: r.ref || '', punten };
    });
  }

  function kaart(hier, plekken) {
    const dy = 0.045, dx = dy / Math.max(0.45, Math.cos(hier.lat * Math.PI / 180));
    return { status: 200, netwerk: 'NWB', ref: { lat: hier.lat, lng: hier.lng },
      bounds: { lat0: hier.lat - dy, lat1: hier.lat + dy, lng0: hier.lng - dx, lng1: hier.lng + dx },
      wegen: wegenRond(hier), plekken: (plekken || []).filter(p => meters(p, hier) <= 30000),
      dekking: { land: 'Nederland', wegvakken: Number(meta.wegvakken || 0), bron: meta.bron, licentie: meta.licentie, gebouwdAt: meta.gebouwd_at } };
  }

  return { snap, zoek, stappenVan, zoekPlekken, kaart, binnen: binnenNederland,
    info: { ...meta, ...graaf, land: 'Nederland', actief: true, bestand } };
}

module.exports = { maakNederlandNet, binnenNederland, NL };
