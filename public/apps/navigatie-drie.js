/* RTG Navigatie: de kaart zelf. 3D via shared/drie.js, 2D zonder WebGL,
   en de camera (slepen, wiel, knijpen). Stand: window.RTGNav. */
(() => {
  'use strict';
  const N = window.RTGNav, { $, S, LAAG, P, naarWereld } = N;
  const canvas = $('#kaart');
  let laagPinnen = null, laagRoute = null, laagHier = null;
  const cam = N.cam = { doel: [0, 0, 0], afstand: 240, azimut: 0.6, hoek: 0.9 };
  N.R = null;

  N.grootte = function grootte() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  };
  function daglicht() {
    const u = new Date().getHours();
    const nacht = (u >= 21 || u < 6), schemer = (u >= 18 && u < 21) || (u >= 6 && u < 8);
    if (nacht) return { licht: [0.3, 0.7, 0.4], lucht: [0.03, 0.03, 0.045] };
    if (schemer) return { licht: [0.7, 0.5, 0.2], lucht: [0.09, 0.06, 0.07] };
    return { licht: [0.5, 1.0, 0.35], lucht: [0.05, 0.055, 0.06] };
  }
  function hash(r, c) { let x = (r * 73856093) ^ (c * 19349663); x = (x ^ (x >>> 13)) >>> 0; return x % 1000; }
  function voegSamen(doel, bron) {
    const off = doel.posities.length / 3;
    for (const k of ['posities', 'normalen', 'kleuren']) for (const v of bron[k]) doel[k].push(v);
    for (const i of bron.indices) doel.indices.push(i + off);
  }
  const knoopVan = (b, g) => (r, c) => ({ lat: b.lat1 - (b.lat1 - b.lat0) * r / (g - 1), lng: b.lng0 + (b.lng1 - b.lng0) * c / (g - 1) });

  /* ---- de stad bouwen: grond, hoofdwegen en blokken (deterministisch) ---- */
  N.bouwStad = function bouwStad() {
    const R = N.R, kd = S.kaartData, b = kd.bounds;
    const hoek = naarWereld(b.lat0, b.lng1), hoek2 = naarWereld(b.lat1, b.lng0);
    const half = Math.max(Math.abs(hoek[0]), Math.abs(hoek[1]), Math.abs(hoek2[0]), Math.abs(hoek2[1])) + 40;
    R.voegToe(Drie.vlak(half, [0.055, 0.055, 0.052]), { raster: true });
    if (kd.netwerk === 'NWB') {
      const wegen = Drie.leegMesh();
      for (const weg of (kd.wegen || [])) {
        const pl = weg.punten.map(p => naarWereld(p.lat, p.lng));
        if (pl.length > 1) voegSamen(wegen, Drie.lint(pl, weg.hoofd ? 5.6 : 2.2,
          weg.hoofd ? [0.24, 0.22, 0.16] : [0.105, 0.105, 0.10], weg.hoofd ? 0.45 : 0.15));
      }
      R.voegToe(wegen, {});
      return;
    }
    const g = kd.grid, art = kd.arterie, knoop = knoopVan(b, g), rij = [...Array(g).keys()];
    const wegen = Drie.leegMesh(), wegKleur = [0.12, 0.115, 0.11];
    const hoofdweg = ks => voegSamen(wegen, Drie.lint(ks.map(k => naarWereld(k.lat, k.lng)), 6, wegKleur, 0.4));
    for (let r = 0; r < g; r++) if (r % art === 0) hoofdweg(rij.map(c => knoop(r, c)));
    for (let c = 0; c < g; c++) if (c % art === 0) hoofdweg(rij.map(r => knoop(r, c)));
    R.voegToe(wegen, {});
    // blokken (gebouwen) op de niet-hoofdweg-cellen
    const cellM = (b.lng1 - b.lng0) / (g - 1) * 111320 * P.cosRef * P.WERELD;
    const blokken = Drie.leegMesh();
    for (let r = 0; r < g - 1; r++) for (let c = 0; c < g - 1; c++) {
      if (r % art === 0 || c % art === 0) continue;
      const h = hash(r, c);
      if ((h % 100) < 42) continue;                 // lucht tussen de blokken
      const k = knoop(r + 0.5, c + 0.5), w = naarWereld(k.lat, k.lng);
      const hoogte = 5 + (h % 8) * 3.4, wd = cellM * (0.42 + (h % 5) * 0.05);
      let kl = [0.135 + (h % 6) * 0.012, 0.13 + (h % 5) * 0.01, 0.145 + (h % 7) * 0.012], dak = kl;
      if (h % 23 === 0) { kl = [0.30, 0.09, 0.16]; dak = [0.42, 0.14, 0.24]; }   // een enkel bordeaux landmark
      else if (h % 19 === 0) dak = [0.5, 0.4, 0.12];                            // een enkel gouden dak
      Drie.doos(blokken, w[0], w[1], wd, hoogte, wd, kl, dak);
    }
    R.voegToe(blokken, {});
  };

  /* ---- de pinnen, herbouwd bij laagwissel ----
     Zonder kaart (nog geen plek) zijn er geen plekken: leeg is de waarheid. */
  N.zichtbarePlekken = function zichtbarePlekken() {
    if (!S.kaartData) return [];
    return (S.kaartData.plekken || []).filter(p => S.actief[p.laag]).concat(S.flitsPunten.filter(() => S.actief.flits));
  };
  function hierMesh(w) { const m = Drie.leegMesh(); Drie.pin(m, w[0], w[1], 6, [0.96, 0.82, 0.32]); return m; }
  N.bouwPinnen = function bouwPinnen() {
    const R = N.R;
    if (!R || !S.hier) return; // De 2D-tekenlus leest de actuele pinnen zelf.
    const m = Drie.leegMesh();
    for (const p of N.zichtbarePlekken()) {
      const w = naarWereld(p.lat, p.lng);
      Drie.pin(m, w[0], w[1], 4 + (p.laag === 'flits' ? 3 : 0), (LAAG[p.laag] || LAAG.leverancier).rgb);
    }
    const wh = naarWereld(S.hier.lat, S.hier.lng);   // jouw eigen positie als gouden pin
    if (laagHier) R.vervang(laagHier, hierMesh(wh)); else laagHier = R.voegToe(hierMesh(wh), { emissie: 0.8 });
    if (laagPinnen) R.vervang(laagPinnen, m); else laagPinnen = R.voegToe(m, { emissie: 0.25 });
  };

  /* ---- de route als oplichtend lint ---- */
  N.bouwRoute = function bouwRoute() {
    const R = N.R;
    if (!R) return; // Ook voor de kaart klaarstaat mag een route sluiten.
    const punten = S.route ? S.route.route.map(p => naarWereld(p.lat, p.lng)) : [];
    const m = Drie.lint(punten, 4.5, [0.62, 0.11, 0.25], 1.2);
    if (laagRoute) R.vervang(laagRoute, m); else laagRoute = R.voegToe(m, { emissie: 1 });
  };
  N.kaderRoute = function kaderRoute() {
    const route = S.route;
    if (!route || !route.route.length) return;
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    for (const p of route.route) { const w = naarWereld(p.lat, p.lng); minx = Math.min(minx, w[0]); maxx = Math.max(maxx, w[0]); minz = Math.min(minz, w[1]); maxz = Math.max(maxz, w[1]); }
    cam.doel = [(minx + maxx) / 2, 0, (minz + maxz) / 2];
    const spanv = Math.max(maxx - minx, maxz - minz, 40);
    // een rijderskaart, geen satellietbol: bij een lange rit de eerste omgeving
    if (spanv > 900) { cam.doel = [0, 0, 0]; cam.afstand = 520; }
    else cam.afstand = Math.min(1200, spanv * 1.4 + 60);
  };

  /* ---- de teken-lus ---- */
  let draaien = 0, slepen = false;
  N.teken = function teken() {
    const R = N.R;
    if (!R) { N.teken2D(); return; }
    if (!N.RUSTIG && !slepen && !S.route) { draaien += 0.0012; }        // rustige idle-draai tot er een route is
    const az = cam.azimut + draaien, c = Math.cos(cam.hoek), s = Math.sin(cam.hoek);
    const oog = [cam.doel[0] + cam.afstand * c * Math.sin(az), cam.doel[1] + cam.afstand * s, cam.doel[2] + cam.afstand * c * Math.cos(az)];
    const dl = daglicht();
    R.teken(oog, cam.doel, { licht: dl.licht, lucht: dl.lucht, fov: 50 });
    requestAnimationFrame(teken);
  };

  /* ---- 2D-terugval als er geen WebGL is ---- */
  N.teken2D = function teken2D() {
    const ctx = canvas.getContext('2d'), kd = S.kaartData; if (!ctx || !kd) return;
    const W = canvas.width, H = canvas.height, sc = Math.min(W, H) / 520 * (240 / cam.afstand), cx = W / 2, cy = H / 2;
    const toXY = (lat, lng) => { const w = naarWereld(lat, lng); return [cx + (w[0] - cam.doel[0]) * sc, cy + (w[1] - cam.doel[2]) * sc]; };
    const lijn = (pts) => { ctx.beginPath(); pts.forEach((k, i) => { const p = toXY(k.lat, k.lng); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.stroke(); };
    ctx.fillStyle = '#0C0C0B'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(201,162,75,0.16)'; ctx.lineWidth = 2;
    if (kd.netwerk === 'NWB') {
      for (const weg of (kd.wegen || [])) { ctx.lineWidth = weg.hoofd ? 2.4 : 1; lijn(weg.punten); }
    } else {
      const g = kd.grid, art = kd.arterie, knoop = knoopVan(kd.bounds, g), rij = [...Array(g).keys()];
      for (let r = 0; r < g; r++) if (r % art === 0) lijn(rij.map(c => knoop(r, c)));
      for (let c = 0; c < g; c++) if (c % art === 0) lijn(rij.map(r => knoop(r, c)));
    }
    if (S.route && S.route.route.length) { ctx.strokeStyle = '#9E1C40'; ctx.lineWidth = 5; lijn(S.route.route); }
    for (const p of N.zichtbarePlekken()) { const q = toXY(p.lat, p.lng); ctx.fillStyle = (LAAG[p.laag] || LAAG.leverancier).css; ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, 7); ctx.fill(); }
    const wh = toXY(S.hier.lat, S.hier.lng); ctx.fillStyle = '#F4D24E'; ctx.beginPath(); ctx.arc(wh[0], wh[1], 7, 0, 7); ctx.fill();
    requestAnimationFrame(teken2D);
  };

  /* ---- camerabediening (sleep + zoom + knijp) ----
     Twee vingers worden geteld en gemeten; met twee vingers erop wordt niet
     gedraaid, want dan schiet de camera weg tijdens het knijpen. Het doek
     draagt .ds-gebaren (touch-action: none), dus de browser zoomt niet zelf. */
  let lastX = 0, lastY = 0, pinchD = 0;
  const vingers = new Map();
  const zoomNaar = v => { cam.afstand = Math.max(60, Math.min(6000, v)); };
  function knijpAfstand() { const [a, b] = [...vingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
  canvas.addEventListener('pointerdown', e => {
    vingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    draaien = 0; canvas.setPointerCapture(e.pointerId);
    if (vingers.size === 2) { slepen = false; pinchD = knijpAfstand(); return; }
    slepen = true; lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('pointermove', e => {
    if (!vingers.has(e.pointerId)) return;
    vingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (vingers.size === 2) {
      const nu = knijpAfstand();
      if (pinchD > 0 && nu > 0) zoomNaar(cam.afstand * (pinchD / nu));
      pinchD = nu;
      return;
    }
    if (!slepen) return;
    cam.azimut -= (e.clientX - lastX) * 0.006;
    cam.hoek = Math.max(0.25, Math.min(1.45, cam.hoek + (e.clientY - lastY) * 0.005));
    lastX = e.clientX; lastY = e.clientY;
  });
  const stop = e => {
    vingers.delete(e.pointerId);
    if (vingers.size < 2) pinchD = 0;
    // een vinger die na een knijp overblijft, is een nieuw sleeppunt
    if (vingers.size === 1) { const [v] = [...vingers.values()]; slepen = true; lastX = v.x; lastY = v.y; }
    else if (!vingers.size) slepen = false;
  };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoomNaar(cam.afstand * (1 + Math.sign(e.deltaY) * 0.08)); }, { passive: false });
})();
