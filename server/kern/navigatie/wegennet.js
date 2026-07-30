/* Navigatie-deel "wegennet" (kern/navigatie): de pure meetkunde en de
   grafenzoeker. Bouwt eenmalig het rasterwegennet (hoofdwegen sneller dan
   stadswegen), snapt een punt op de dichtstbijzijnde knoop, vindt met A* de
   snelste weg en zet de polylijn om in bocht-voor-bocht-aanwijzingen. Geen
   data-koppeling, geen externe kaartdienst -- alles uit de constanten die
   kern/navigatie.js meegeeft. */
module.exports = ({ REF, BOUNDS, GRID, ARTERIE, V_HOOFD, V_STAD, haversine }) => {
  // ---- projectie: lat/lng -> lokale meters (x oost, z zuid) ----
  const cosRef = Math.cos(REF.lat * Math.PI / 180);
  const naarXZ = (lat, lng) => ({ x: (lng - REF.lng) * 111320 * cosRef, z: (REF.lat - lat) * 110540 });
  const meters = (a, b) => haversine({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });

  // ---- het wegennet: een raster met hoofdwegen, eenmalig gebouwd ----
  let net = null;
  function knoopLatLng(r, c) {
    return {
      lat: BOUNDS.lat1 - (BOUNDS.lat1 - BOUNDS.lat0) * r / (GRID - 1),
      lng: BOUNDS.lng0 + (BOUNDS.lng1 - BOUNDS.lng0) * c / (GRID - 1)
    };
  }
  const arterie = (r, c) => (r % ARTERIE === 0 || c % ARTERIE === 0);
  function bouwNet() {
    if (net) return net;
    const knopen = [];
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
      const p = knoopLatLng(r, c);
      knopen.push({ i: r * GRID + c, r, c, lat: p.lat, lng: p.lng, art: arterie(r, c) });
    }
    const buren = knopen.map(() => []);
    const stappen = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const k of knopen) {
      for (const [dr, dc] of stappen) {
        const r2 = k.r + dr, c2 = k.c + dc;
        if (r2 < 0 || r2 >= GRID || c2 < 0 || c2 >= GRID) continue;
        const b = knopen[r2 * GRID + c2];
        const hoofd = k.art && b.art;                 // hoofdweg als beide knopen op een hoofdlijn liggen
        const v = hoofd ? V_HOOFD : V_STAD;
        buren[k.i].push({ i: b.i, kost: meters(k, b) / v, m: meters(k, b) });
      }
    }
    net = { knopen, buren };
    return net;
  }
  function snap(pt) {
    const n = bouwNet();
    let best = null, bd = Infinity;
    for (const k of n.knopen) { const d = meters(k, pt); if (d < bd) { bd = d; best = k; } }
    return best;
  }

  // ---- A*: de snelste weg over het net ----
  function zoek(vanN, naarN) {
    const n = bouwNet();
    const g = new Map([[vanN.i, 0]]);
    const via = new Map();
    const h = k => meters(k, naarN) / V_HOOFD;
    const open = [{ i: vanN.i, f: h(vanN) }];
    const dicht = new Set();
    while (open.length) {
      let bi = 0; for (let j = 1; j < open.length; j++) if (open[j].f < open[bi].f) bi = j;
      const cur = open.splice(bi, 1)[0];
      if (cur.i === naarN.i) break;
      if (dicht.has(cur.i)) continue;
      dicht.add(cur.i);
      for (const e of n.buren[cur.i]) {
        const ng = (g.get(cur.i) ?? Infinity) + e.kost;
        if (ng < (g.get(e.i) ?? Infinity)) {
          g.set(e.i, ng); via.set(e.i, cur.i);
          open.push({ i: e.i, f: ng + h(n.knopen[e.i]) });
        }
      }
    }
    if (!via.has(naarN.i) && vanN.i !== naarN.i) return null;
    const pad = [naarN.i]; let c = naarN.i;
    while (c !== vanN.i) { c = via.get(c); if (c == null) break; pad.push(c); }
    pad.reverse();
    return pad.map(i => n.knopen[i]);
  }

  // ---- bocht-voor-bocht uit de polylijn ----
  const kompas = ['noord', 'noordoost', 'oost', 'zuidoost', 'zuid', 'zuidwest', 'west', 'noordwest'];
  function richtingVan(a, b) {
    const p = naarXZ(a.lat, a.lng), q = naarXZ(b.lat, b.lng);
    let hoek = Math.atan2(q.x - p.x, -(q.z - p.z)) * 180 / Math.PI;   // 0 = noord, met de klok mee
    if (hoek < 0) hoek += 360;
    return kompas[Math.round(hoek / 45) % 8];
  }
  function stappenVan(poly) {
    if (poly.length < 2) return [];
    const st = [{ instructie: 'Vertrek richting ' + richtingVan(poly[0], poly[1]), afstandM: 0, bocht: 'start' }];
    let sinds = 0;
    for (let i = 1; i < poly.length; i++) {
      sinds += meters(poly[i - 1], poly[i]);
      if (i >= poly.length - 1) break;
      const a = naarXZ(poly[i - 1].lat, poly[i - 1].lng), b = naarXZ(poly[i].lat, poly[i].lng), c = naarXZ(poly[i + 1].lat, poly[i + 1].lng);
      const v1x = b.x - a.x, v1z = b.z - a.z, v2x = c.x - b.x, v2z = c.z - b.z;
      const kruis = v1x * v2z - v1z * v2x, dotp = v1x * v2x + v1z * v2z;
      const hoek = Math.atan2(kruis, dotp) * 180 / Math.PI;
      if (Math.abs(hoek) < 22) continue;                              // rechtdoor: geen aanwijzing
      st[st.length - 1].afstandM = Math.round(sinds);
      const bocht = hoek > 0 ? 'rechts' : 'links';                    // z wijst zuid: +kruis = naar rechts
      st.push({ instructie: 'Sla ' + (Math.abs(hoek) > 55 ? '' : 'flauw ') + bocht + 'af richting ' + richtingVan(poly[i], poly[i + 1]), afstandM: 0, bocht });
      sinds = 0;
    }
    st[st.length - 1].afstandM = Math.round(sinds);
    st.push({ instructie: 'Bestemming bereikt', afstandM: 0, bocht: 'eind' });
    return st;
  }

  return { naarXZ, meters, snap, zoek, stappenVan };
};
