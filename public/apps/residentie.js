/* De Residence, deel 1: de staat, de isometrie en de zaal zelf (vloer,
   muren, sfeer). De hele wereld wordt met canvas getekend in de huisstijl:
   diep zwart, marmer, dunne goudlijnen -- geen sprites, geen extern beeld.
   Een bundel-app: de delen 01..04 delen een gesloten scope. */
(function () {
  const $ = s => document.querySelector(s);
  let TOKEN = null; try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) {}
  const api = (pad, body) => fetch(pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
    body: JSON.stringify(body || {})
  }).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Er ging iets mis.'); return d; });
  function meld(t){ const m = $('#melding'); m.textContent = t; m.style.opacity = '1'; clearTimeout(m._t); m._t = setTimeout(() => m.style.opacity = '0', 2600); }

  /* ---------- de wereldstaat ---------- */
  const S = {
    kamer: null,          // { id, soort, naam, sub, b, d, meubels, eigen }
    leden: new Map(),     // codenaam -> { x, y, dx, dy, rx, ry, zit, zeg, zegTot, emote, emoteTot }
    ik: null,             // eigen codenaam
    editor: null,         // null | { soort } | { weg: true }
    catalogus: [], suite: null,
    hover: null
  };
  const KLEUR = {
    goud: '#C9A94B', goudDiep: '#857007', bordeaux: '#7F1634', bordeauxLicht: '#C23A5E',
    ivoor: '#EDE6D6', tegelA: '#17140F', tegelB: '#14110D', lijn: 'rgba(201,169,75,0.16)',
    muur: '#121009', muurLicht: '#1A1710', marmer: '#E9E3D8'
  };
  // elke zaal een eigen ondertoon in het licht
  const SFEER = { lobby: '#C9A94B', bar: '#C23A5E', bibliotheek: '#B08D3F', terras: '#4A6B8A',
    golf: '#3E6B4A', kegel: '#8A5A2B', badhuis: '#3A7A8A', restaurant: '#7F1634' };

  /* ---------- canvas en isometrie ---------- */
  const canvas = $('#wereld'), ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1, TW = 64, TH = 32, OX = 0, OY = 0, MUUR = 84;
  function maat() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (S.kamer) {
      const b = S.kamer.b, d = S.kamer.d;
      // de zaal moet passen: kies de tegelmaat op het scherm
      TW = Math.max(34, Math.min(72, Math.floor(Math.min((W - 24) / ((b + d) / 2 + 1), (H - 250) / ((b + d) / 4 + 1.6)))));
      TW = TW - (TW % 2); TH = TW / 2;
      MUUR = Math.round(TW * 1.3);
      OX = W / 2 - ((b - d) * TW / 4);
      OY = (H - ((b + d) * TH / 2)) / 2 + MUUR / 2 + 14;
    }
  }
  window.addEventListener('resize', () => { maat(); });
  const isoX = (x, y) => OX + (x - y) * TW / 2;
  const isoY = (x, y) => OY + (x + y) * TH / 2;
  function tegelVan(px, py) { // scherm -> tegel (middenpunten)
    const fx = (px - OX) / (TW / 2), fy = (py - OY) / (TH / 2);
    return { x: Math.floor((fy + fx) / 2), y: Math.floor((fy - fx) / 2) };
  }
  function ruit(cx, cy, s) { // een vloertegel-pad rond het roosterpunt
    ctx.beginPath();
    ctx.moveTo(cx, cy - TH / 2 * s); ctx.lineTo(cx + TW / 2 * s, cy);
    ctx.lineTo(cx, cy + TH / 2 * s); ctx.lineTo(cx - TW / 2 * s, cy);
    ctx.closePath();
  }

  /* ---------- de zaal: sfeerlicht, muren, marmer ---------- */
  function tekenZaal() {
    ctx.clearRect(0, 0, W, H);
    const b = S.kamer.b, d = S.kamer.d;
    const sfeer = S.kamer.soort === 'suite' ? KLEUR.goud : (SFEER[S.kamer.id] || KLEUR.goud);
    // avondlicht van boven: een zachte gloed in de zaalkleur
    const g = ctx.createRadialGradient(W / 2, OY - MUUR, 40, W / 2, H / 2, Math.max(W, H) * 0.9);
    g.addColorStop(0, sfeer + '22'); g.addColorStop(0.4, '#0C0C0B'); g.addColorStop(1, '#080807');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // de achtermuren met gouden plint
    const hoekX = isoX(0, 0), hoekY = isoY(0, 0) - TH / 2;
    ctx.fillStyle = KLEUR.muur;
    ctx.beginPath(); // linkerwand (langs y-as)
    ctx.moveTo(hoekX, hoekY - MUUR); ctx.lineTo(hoekX, hoekY);
    ctx.lineTo(isoX(0, d) - TW / 2, isoY(0, d) - TH / 2 + TH / 2);
    ctx.lineTo(isoX(0, d) - TW / 2, isoY(0, d) - MUUR); ctx.closePath(); ctx.fill();
    ctx.fillStyle = KLEUR.muurLicht;
    ctx.beginPath(); // rechterwand (langs x-as)
    ctx.moveTo(hoekX, hoekY - MUUR); ctx.lineTo(hoekX, hoekY);
    ctx.lineTo(isoX(b, 0) + TW / 2, isoY(b, 0) - TH / 2 + TH / 2);
    ctx.lineTo(isoX(b, 0) + TW / 2, isoY(b, 0) - MUUR); ctx.closePath(); ctx.fill();
    // plintlijn in goud
    ctx.strokeStyle = 'rgba(201,169,75,0.4)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(isoX(0, d) - TW / 2, isoY(0, d));
    ctx.lineTo(hoekX, hoekY + TH / 2); ctx.lineTo(isoX(b, 0) + TW / 2, isoY(b, 0));
    ctx.stroke();
    // lambrisering: dunne gouden lijnen op de wanden
    ctx.strokeStyle = 'rgba(201,169,75,0.14)';
    for (let i = 1; i < 4; i++) {
      const yv = hoekY - (MUUR / 4) * i;
      ctx.beginPath();
      ctx.moveTo(isoX(0, d) - TW / 2, isoY(0, d) - (MUUR / 4) * i);
      ctx.lineTo(hoekX, yv + TH / 2 - TH / 2);
      ctx.lineTo(isoX(b, 0) + TW / 2, isoY(b, 0) - (MUUR / 4) * i);
      ctx.stroke();
    }
    // de marmeren vloer, tegel voor tegel
    for (let y = 0; y < d; y++) for (let x = 0; x < b; x++) {
      const cx = isoX(x, y), cy = isoY(x, y);
      ruit(cx, cy, 1);
      ctx.fillStyle = (x + y) % 2 ? KLEUR.tegelA : KLEUR.tegelB;
      ctx.fill();
      ctx.strokeStyle = KLEUR.lijn; ctx.lineWidth = 1; ctx.stroke();
    }
    // hover-tegel: een zachte gouden ring waar u heen kunt
    if (S.hover && S.hover.x >= 0 && S.hover.x < b && S.hover.y >= 0 && S.hover.y < d) {
      ruit(isoX(S.hover.x, S.hover.y), isoY(S.hover.x, S.hover.y), 0.86);
      ctx.strokeStyle = S.editor ? 'rgba(194,58,94,0.8)' : 'rgba(201,169,75,0.7)';
      ctx.lineWidth = 1.6; ctx.stroke();
    }
  }

  /* ---------- deel 2: de meubels van RTG Maison en de gasten ----------
     Elk meubel is een kleine tekening in goudlijn op donker; de gasten zijn
     elegante pionnen (schaakstuk-taal) op codenaam -- bewust geen poppetjes
     of foto's, wel karakter. */
  function blokje(x, y, b, d, h, zij, top) { // een iso-prisma op tegel x,y
    const x0 = isoX(x, y) - TW / 2, y0 = isoY(x, y);
    const pnt = (tx, ty) => [isoX(tx, ty), isoY(tx, ty)];
    const [ax, ay] = pnt(x, y), [bx, by] = pnt(x + b, y), [cx2, cy2] = pnt(x + b, y + d), [dx2, dy2] = pnt(x, y + d);
    ctx.fillStyle = zij;
    ctx.beginPath(); ctx.moveTo(dx2, dy2 - h); ctx.lineTo(cx2, cy2 - h); ctx.lineTo(cx2, cy2); ctx.lineTo(dx2, dy2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx2, cy2 - h); ctx.lineTo(bx, by - h); ctx.lineTo(bx, by); ctx.lineTo(cx2, cy2); ctx.closePath();
    ctx.fillStyle = schaduw(zij, 0.7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ax, ay - h); ctx.lineTo(bx, by - h); ctx.lineTo(cx2, cy2 - h); ctx.lineTo(dx2, dy2 - h); ctx.closePath();
    ctx.fillStyle = top; ctx.fill();
    ctx.strokeStyle = 'rgba(201,169,75,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
    return { ax, ay, bx, by, cx: cx2, cy: cy2, dx: dx2, dy: dy2, x0, y0 };
  }
  function schaduw(hex, f) {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g2 = (n >> 8) & 255, b2 = n & 255;
    return 'rgb(' + Math.round(r * f) + ',' + Math.round(g2 * f) + ',' + Math.round(b2 * f) + ')';
  }
  const midden = (x, y, b, d) => [isoX(x + b / 2, y + d / 2) - ((b - d) * 0) , isoY(x + b / 2, y + d / 2)];

  /* de meubeltekeningen, per soort */
  const TEKEN = {
    fauteuil: (x, y) => { blokje(x, y, 1, 1, TH * 0.55, '#241E14', '#3A2F1C'); blokje(x, y, 0.28, 1, TH * 1.05, '#241E14', '#4A3C22'); },
    bank: (x, y) => { blokje(x, y, 2, 1, TH * 0.55, '#241E14', '#3A2F1C'); blokje(x, y, 2, 0.3, TH * 1.05, '#241E14', '#4A3C22'); },
    chaise: (x, y) => { blokje(x, y, 2, 1, TH * 0.5, '#2B1420', '#4A2033'); blokje(x, y, 0.5, 1, TH * 0.95, '#2B1420', '#5B2540'); },
    kruk: (x, y) => { blokje(x + 0.25, y + 0.25, 0.5, 0.5, TH * 0.85, '#241E14', '#C9A94B'); },
    tafel: (x, y) => { blokje(x, y, 2, 2, TH * 0.7, '#171310', '#E9E3D8'); ader(x, y, 2, 2, TH * 0.7); },
    bijzet: (x, y) => { blokje(x + 0.15, y + 0.15, 0.7, 0.7, TH * 0.65, '#171310', '#E9E3D8'); },
    vleugel: (x, y) => {
      blokje(x, y, 2, 2, TH * 0.9, '#0E0C0A', '#1C1916');
      const [mx, my] = midden(x, y, 2, 2);
      ctx.beginPath(); ctx.ellipse(mx, my - TH * 0.9, TW * 0.62, TH * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#12100D'; ctx.fill(); ctx.strokeStyle = 'rgba(201,169,75,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    },
    haard: (x, y) => {
      blokje(x, y, 2, 1, TH * 1.5, '#1A1712', '#242018');
      const [mx, my] = midden(x, y, 2, 1);
      const fl = Math.sin(Date.now() / 160) * 2;
      const vuur = ctx.createRadialGradient(mx, my - TH * 0.45, 2, mx, my - TH * 0.45, TW * 0.32 + fl);
      vuur.addColorStop(0, 'rgba(233,180,90,0.95)'); vuur.addColorStop(1, 'rgba(127,22,52,0)');
      ctx.fillStyle = vuur; ctx.beginPath(); ctx.ellipse(mx, my - TH * 0.45, TW * 0.3 + fl, TH * 0.5 + fl, 0, 0, Math.PI * 2); ctx.fill();
    },
    bar: (x, y) => { blokje(x, y, 3, 1, TH * 0.95, '#241E14', '#C9A94B'); },
    palm: (x, y) => {
      blokje(x + 0.28, y + 0.28, 0.45, 0.45, TH * 0.5, '#241E14', '#3A2F1C');
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5) - TH * 0.5;
      ctx.strokeStyle = '#2E4A3A'; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const a = (Math.PI * 2 / 6) * i;
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + Math.cos(a) * TW * 0.24, py - TH * 1.35, px + Math.cos(a) * TW * 0.52, py - TH * 0.72 + Math.sin(a) * 5);
        ctx.stroke(); }
    },
    lamp: (x, y) => {
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      ctx.strokeStyle = KLEUR.goud; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - TH * 2); ctx.stroke();
      const gl = ctx.createRadialGradient(px, py - TH * 2.15, 2, px, py - TH * 2.15, TW * 0.42);
      gl.addColorStop(0, 'rgba(233,214,150,0.9)'); gl.addColorStop(1, 'rgba(201,169,75,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py - TH * 2.15, TW * 0.42, 0, Math.PI * 2); ctx.fill();
    },
    schaak: (x, y) => {
      blokje(x + 0.1, y + 0.1, 0.8, 0.8, TH * 0.62, '#171310', '#E9E3D8');
      const cx2 = isoX(x + 0.5, y + 0.5), cy2 = isoY(x + 0.5, y + 0.5) - TH * 0.62;
      ctx.fillStyle = '#241E14';
      ruitje(cx2 - TW * 0.09, cy2 - TH * 0.09, TW * 0.16); ruitje(cx2 + TW * 0.09, cy2 + TH * 0.02, TW * 0.16);
    },
    boekenkast: (x, y) => {
      blokje(x, y, 3, 0.5, TH * 2.2, '#1A1712', '#242018');
      ctx.strokeStyle = 'rgba(201,169,75,0.35)'; ctx.lineWidth = 0.8;
      for (let i = 1; i <= 3; i++) { const h = TH * 2.2 * i / 4;
        ctx.beginPath(); ctx.moveTo(isoX(x, y + 0.5), isoY(x, y + 0.5) - h); ctx.lineTo(isoX(x + 3, y + 0.5), isoY(x + 3, y + 0.5) - h); ctx.stroke(); }
    },
    tapijt: (x, y) => {
      ctx.beginPath();
      ctx.moveTo(isoX(x + 1.5, y), isoY(x + 1.5, y) - 1); ctx.lineTo(isoX(x + 3, y + 1), isoY(x + 3, y + 1) - 1);
      ctx.lineTo(isoX(x + 1.5, y + 2), isoY(x + 1.5, y + 2) - 1); ctx.lineTo(isoX(x, y + 1), isoY(x, y + 1) - 1);
      ctx.closePath();
      ctx.fillStyle = 'rgba(127,22,52,0.55)'; ctx.fill();
      ctx.strokeStyle = 'rgba(201,169,75,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();
    },
    fontein: (x, y) => {
      const [mx, my] = midden(x, y, 2, 2);
      ctx.beginPath(); ctx.ellipse(mx, my, TW * 0.7, TH * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#141B20'; ctx.fill(); ctx.strokeStyle = 'rgba(201,169,75,0.5)'; ctx.lineWidth = 1.4; ctx.stroke();
      const t = Date.now() / 500;
      ctx.strokeStyle = 'rgba(120,160,190,0.5)';
      for (let i = 0; i < 3; i++) { const r = ((t + i / 3) % 1);
        ctx.beginPath(); ctx.ellipse(mx, my, TW * 0.7 * r, TH * 0.7 * r, 0, 0, Math.PI * 2); ctx.globalAlpha = 1 - r; ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(160,200,230,0.7)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, my - TH * 1.3); ctx.stroke();
    }
  };
  function ruitje(cx, cy, s) { ctx.beginPath(); ctx.moveTo(cx, cy - s / 4); ctx.lineTo(cx + s / 2, cy); ctx.lineTo(cx, cy + s / 4); ctx.lineTo(cx - s / 2, cy); ctx.closePath(); ctx.fill(); }
  function ader(x, y, b, d, h) { // een marmerader over het tafelblad
    ctx.strokeStyle = 'rgba(120,110,95,0.5)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(isoX(x + 0.3, y + 0.5), isoY(x + 0.3, y + 0.5) - h);
    ctx.quadraticCurveTo(isoX(x + b / 2, y + d * 0.3), isoY(x + b / 2, y + d * 0.3) - h, isoX(x + b - 0.3, y + d - 0.5), isoY(x + b - 0.3, y + d - 0.5) - h);
    ctx.stroke();
  }

  /* ---------- de gast: een elegante pion op codenaam ---------- */
  function tekenGast(l, zelf) {
    const px = isoX(l.rx + 0.5, l.ry + 0.5), py = isoY(l.rx + 0.5, l.ry + 0.5);
    const hoog = l.zit ? TH * 1.15 : TH * 1.55;
    ctx.beginPath(); ctx.ellipse(px, py, TW * 0.2, TH * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
    const g = ctx.createLinearGradient(px, py - hoog, px, py);
    if (zelf) { g.addColorStop(0, '#E3C878'); g.addColorStop(1, '#8A6F1F'); }
    else { g.addColorStop(0, '#F0EADD'); g.addColorStop(1, '#A99F8A'); }
    ctx.fillStyle = g;
    ctx.beginPath(); // het pion-silhouet: voet, taille, kraag, hoofd
    ctx.moveTo(px - TW * 0.16, py);
    ctx.bezierCurveTo(px - TW * 0.05, py - hoog * 0.38, px - TW * 0.1, py - hoog * 0.52, px - TW * 0.07, py - hoog * 0.66);
    ctx.lineTo(px + TW * 0.07, py - hoog * 0.66);
    ctx.bezierCurveTo(px + TW * 0.1, py - hoog * 0.52, px + TW * 0.05, py - hoog * 0.38, px + TW * 0.16, py);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(px, py - hoog * 0.8, TW * 0.105, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = zelf ? 'rgba(201,169,75,0.8)' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(px, py - hoog * 0.66, TW * 0.085, TH * 0.06, 0, 0, Math.PI * 2); ctx.stroke();
    extraGast(l, px, py); // in het water of onder de douche: het effect erbij
    // het naamplaatje
    ctx.font = '600 10px Inter, sans-serif'; ctx.textAlign = 'center';
    const naam = l.codenaam, tb = ctx.measureText(naam).width;
    ctx.fillStyle = 'rgba(12,12,11,0.72)';
    ctx.beginPath(); ctx.roundRect(px - tb / 2 - 6, py - hoog - 26, tb + 12, 15, 7); ctx.fill();
    ctx.fillStyle = zelf ? KLEUR.goud : 'rgba(244,241,236,0.85)';
    ctx.fillText(naam, px, py - hoog - 15);
    // de spreekbubbel en de emote
    if (l.zeg && Date.now() < l.zegTot) tekenBubbel(px, py - hoog - 32, l.zeg);
    if (l.emote && Date.now() < l.emoteTot) {
      const rest = (l.emoteTot - Date.now()) / 1800;
      ctx.globalAlpha = Math.min(1, rest * 2);
      ctx.font = '16px Inter, sans-serif';
      ctx.fillStyle = l.emote === '♥' ? KLEUR.bordeauxLicht : KLEUR.goud;
      ctx.fillText(l.emote, px + TW * 0.22, py - hoog - 6 - (1 - rest) * 26);
      ctx.globalAlpha = 1;
    }
  }
  function tekenBubbel(px, py, tekst) {
    ctx.font = '11px Inter, sans-serif';
    const woorden = tekst.length > 46 ? tekst.slice(0, 45) + '…' : tekst;
    const b = ctx.measureText(woorden).width;
    ctx.fillStyle = 'rgba(21,19,18,0.94)';
    ctx.strokeStyle = 'rgba(201,169,75,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(px - b / 2 - 9, py - 22, b + 18, 20, 10); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px - 4, py - 3); ctx.lineTo(px, py + 4); ctx.lineTo(px + 4, py - 3); ctx.closePath();
    ctx.fillStyle = 'rgba(21,19,18,0.94)'; ctx.fill();
    ctx.fillStyle = '#F4F1EC'; ctx.textAlign = 'center'; ctx.fillText(woorden, px, py - 8);
  }

  /* ---------- deel 2b: RTG Maison deluxe en de activiteiten ----------
     De tekeningen voor het penthouse (bed, badkamer, keuken, televisie,
     telefoon) en voor de activiteitenzalen (green, water, kegelbaan,
     dartbord). Zelfde taal als deel 2: goudlijn op donker, geen sprites. */
  const VLAKKEN = new Set(['tapijt', 'water', 'green', 'golfhole', 'golfmat', 'kegelbaan', 'douche']);

  function vlakRuit(x, y, b, d, vul, rand) {
    ctx.beginPath();
    ctx.moveTo(isoX(x + b / 2, y), isoY(x + b / 2, y) - 1);
    ctx.lineTo(isoX(x + b, y + d / 2), isoY(x + b, y + d / 2) - 1);
    ctx.lineTo(isoX(x + b / 2, y + d), isoY(x + b / 2, y + d) - 1);
    ctx.lineTo(isoX(x, y + d / 2), isoY(x, y + d / 2) - 1);
    ctx.closePath();
    ctx.fillStyle = vul; ctx.fill();
    if (rand) { ctx.strokeStyle = rand; ctx.lineWidth = 1.2; ctx.stroke(); }
  }

  Object.assign(TEKEN, {
    bed: (x, y) => {
      blokje(x, y, 2, 2, TH * 0.5, '#241E14', '#EDE6D6');
      blokje(x, y, 2, 0.35, TH * 1.1, '#1A1712', '#2B2418'); // hoofdbord
      const [mx, my] = midden(x, y, 2, 2);
      ctx.fillStyle = '#F7F2E6';
      ctx.beginPath(); ctx.ellipse(mx - TW * 0.2, my - TH * 0.62, TW * 0.16, TH * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(mx + TW * 0.05, my - TH * 0.5, TW * 0.16, TH * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(127,22,52,0.6)'; ctx.lineWidth = 2; // plaid
      ctx.beginPath(); ctx.moveTo(isoX(x + 0.2, y + 1.3), isoY(x + 0.2, y + 1.3) - TH * 0.5);
      ctx.lineTo(isoX(x + 1.8, y + 1.3), isoY(x + 1.8, y + 1.3) - TH * 0.5); ctx.stroke();
    },
    kast: (x, y) => {
      blokje(x, y, 2, 1, TH * 2.1, '#1A1712', '#242018');
      ctx.strokeStyle = 'rgba(201,169,75,0.4)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(isoX(x + 1, y + 1), isoY(x + 1, y + 1)); ctx.lineTo(isoX(x + 1, y + 1), isoY(x + 1, y + 1) - TH * 2.1); ctx.stroke();
    },
    spiegel: (x, y) => {
      blokje(x + 0.3, y + 0.3, 0.4, 0.4, TH * 1.7, '#1A1712', '#C9A94B');
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      ctx.fillStyle = 'rgba(180,200,215,0.35)';
      ctx.beginPath(); ctx.ellipse(px, py - TH * 1.1, TW * 0.14, TH * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(201,169,75,0.7)'; ctx.lineWidth = 1; ctx.stroke();
    },
    tv: (x, y) => {
      blokje(x, y, 2, 0.35, TH * 1.5, '#0E0C0A', '#12100D');
      const gl = Math.sin(Date.now() / 900) * 0.06 + 0.2;
      ctx.fillStyle = 'rgba(120,160,200,' + gl.toFixed(2) + ')';
      ctx.beginPath();
      ctx.moveTo(isoX(x + 0.2, y + 0.18), isoY(x + 0.2, y + 0.18) - TH * 1.35);
      ctx.lineTo(isoX(x + 1.8, y + 0.18), isoY(x + 1.8, y + 0.18) - TH * 1.35);
      ctx.lineTo(isoX(x + 1.8, y + 0.18), isoY(x + 1.8, y + 0.18) - TH * 0.55);
      ctx.lineTo(isoX(x + 0.2, y + 0.18), isoY(x + 0.2, y + 0.18) - TH * 0.55);
      ctx.closePath(); ctx.fill();
    },
    bureau: (x, y) => { blokje(x, y, 2, 1, TH * 0.72, '#171310', '#3A2F1C'); ader(x, y, 2, 1, TH * 0.72); },
    telefoon: (x, y) => {
      blokje(x + 0.2, y + 0.2, 0.6, 0.6, TH * 0.7, '#171310', '#E9E3D8');
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5) - TH * 0.7;
      ctx.strokeStyle = KLEUR.goud; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py - 4, TW * 0.1, Math.PI * 0.15, Math.PI * 0.85, true); ctx.stroke();
      ctx.fillStyle = KLEUR.goud;
      ctx.beginPath(); ctx.arc(px - TW * 0.09, py - 3, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + TW * 0.09, py - 3, 2.4, 0, Math.PI * 2); ctx.fill();
    },
    bad: (x, y) => {
      blokje(x, y, 2, 1, TH * 0.62, '#2A2A28', '#F0EBE0');
      ctx.fillStyle = 'rgba(110,160,190,0.55)';
      const [mx, my] = midden(x, y, 2, 1);
      ctx.beginPath(); ctx.ellipse(mx, my - TH * 0.62, TW * 0.52, TH * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    },
    douche: (x, y) => {
      vlakRuit(x, y, 1, 1, 'rgba(120,160,190,0.18)', 'rgba(201,169,75,0.45)');
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      ctx.strokeStyle = 'rgba(201,169,75,0.7)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(px - TW * 0.28, py); ctx.lineTo(px - TW * 0.28, py - TH * 2); ctx.lineTo(px + TW * 0.1, py - TH * 2.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(px + TW * 0.1, py - TH * 2.1, 3, 0, Math.PI * 2); ctx.fillStyle = KLEUR.goud; ctx.fill();
    },
    wastafel: (x, y) => {
      blokje(x + 0.15, y + 0.15, 0.7, 0.7, TH * 0.75, '#171310', '#E9E3D8');
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5) - TH * 0.75;
      ctx.fillStyle = 'rgba(110,160,190,0.4)';
      ctx.beginPath(); ctx.ellipse(px, py, TW * 0.14, TH * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    },
    toilet: (x, y) => {
      blokje(x + 0.2, y + 0.2, 0.6, 0.6, TH * 0.55, '#2A2A28', '#F0EBE0');
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5) - TH * 0.55;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(px, py, TW * 0.13, TH * 0.1, 0, 0, Math.PI * 2); ctx.stroke();
    },
    keuken: (x, y) => {
      blokje(x, y, 3, 1, TH * 0.8, '#1A1712', '#E9E3D8'); ader(x, y, 3, 1, TH * 0.8);
      const px = isoX(x + 2.5, y + 0.5), py = isoY(x + 2.5, y + 0.5) - TH * 0.8;
      ctx.strokeStyle = KLEUR.goud; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 9); ctx.lineTo(px + 6, py - 9); ctx.stroke();
    },
    koelkast: (x, y) => {
      blokje(x + 0.1, y + 0.1, 0.8, 0.8, TH * 1.9, '#26262A', '#3A3A40');
      ctx.strokeStyle = 'rgba(201,169,75,0.5)'; ctx.lineWidth = 1;
      const px = isoX(x + 0.85, y + 0.5), py = isoY(x + 0.85, y + 0.5);
      ctx.beginPath(); ctx.moveTo(px, py - TH * 1.5); ctx.lineTo(px, py - TH * 0.9); ctx.stroke();
    },
    dinertafel: (x, y) => {
      blokje(x + 0.2, y + 0.2, 1.6, 1.6, TH * 0.72, '#2A2622', '#F4EFE2');
      const [mx, my] = midden(x, y, 2, 2), top = my - TH * 0.72;
      const fl = Math.sin(Date.now() / 130) * 1.2;
      ctx.strokeStyle = KLEUR.goud; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(mx, top); ctx.lineTo(mx, top - 8); ctx.stroke();
      const vg = ctx.createRadialGradient(mx, top - 11, 1, mx, top - 11, 7 + fl);
      vg.addColorStop(0, 'rgba(240,200,110,0.95)'); vg.addColorStop(1, 'rgba(240,200,110,0)');
      ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(mx, top - 11, 7 + fl, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(201,169,75,0.8)';
      ctx.beginPath(); ctx.ellipse(mx - TW * 0.22, top + TH * 0.1, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(mx + TW * 0.22, top - TH * 0.1, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    },
    water: (x, y) => {
      vlakRuit(x, y, 2, 2, 'rgba(38,86,110,0.85)', 'rgba(201,169,75,0.5)');
      const t = Date.now() / 700;
      ctx.strokeStyle = 'rgba(150,200,225,0.35)'; ctx.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const f = ((t + i / 2) % 1);
        ctx.globalAlpha = 1 - f;
        ctx.beginPath();
        ctx.ellipse(isoX(x + 1, y + 1), isoY(x + 1, y + 1), TW * 0.8 * f, TH * 0.8 * f, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    green: (x, y) => { vlakRuit(x, y, 2, 2, 'rgba(38,74,52,0.9)', 'rgba(201,169,75,0.4)'); },
    golfhole: (x, y) => {
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      ctx.fillStyle = '#0A0A09';
      ctx.beginPath(); ctx.ellipse(px, py, TW * 0.1, TH * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = KLEUR.goud; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - TH * 1.6); ctx.stroke();
      ctx.fillStyle = KLEUR.bordeauxLicht;
      ctx.beginPath(); ctx.moveTo(px, py - TH * 1.6); ctx.lineTo(px + TW * 0.2, py - TH * 1.45); ctx.lineTo(px, py - TH * 1.3); ctx.closePath(); ctx.fill();
    },
    golfmat: (x, y) => { vlakRuit(x + 0.15, y + 0.15, 0.7, 0.7, 'rgba(30,55,40,0.9)', 'rgba(201,169,75,0.5)'); },
    dartbord: (x, y) => {
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      ctx.strokeStyle = 'rgba(201,169,75,0.7)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - TH * 1.7); ctx.stroke();
      const r = TW * 0.2;
      ctx.fillStyle = '#171310';
      ctx.beginPath(); ctx.arc(px, py - TH * 1.9, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = KLEUR.bordeauxLicht;
      ctx.beginPath(); ctx.arc(px, py - TH * 1.9, r * 0.62, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = KLEUR.goud;
      ctx.beginPath(); ctx.arc(px, py - TH * 1.9, r * 0.26, 0, Math.PI * 2); ctx.stroke();
    },
    kegelbaan: (x, y) => {
      vlakRuit(x, y, 1, 5, 'rgba(72,54,30,0.85)', 'rgba(201,169,75,0.45)');
      const px = isoX(x + 0.5, y + 0.35), py = isoY(x + 0.5, y + 0.35);
      ctx.fillStyle = '#EDE6D6';
      for (const [ox, oy] of [[0, 0], [-4, 3], [4, 3], [-8, 6], [0, 6], [8, 6]]) {
        ctx.beginPath(); ctx.ellipse(px + ox, py + oy - 6, 2.2, 4.2, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  });

  /* effecten om de gast heen: baantjes trekken in het water, de regendouche */
  function extraGast(l, px, py) {
    if (!S.kamer) return;
    const hier = (S.kamer.meubels || []).find(([soort, mx, my]) => {
      const specs = { water: [2, 2], douche: [1, 1] }[soort];
      return specs && l.dx >= mx && l.dx < mx + specs[0] && l.dy >= my && l.dy < my + specs[1];
    });
    if (!hier) return;
    if (hier[0] === 'water') {
      const t = Date.now() / 600;
      ctx.strokeStyle = 'rgba(170,215,235,0.6)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 2; i++) { const f = ((t + i / 2) % 1);
        ctx.globalAlpha = 1 - f;
        ctx.beginPath(); ctx.ellipse(px, py, TW * 0.34 * f + 4, TH * 0.3 * f + 2, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = 'rgba(170,210,235,0.55)'; ctx.lineWidth = 1;
      const t = Date.now() / 90;
      for (let i = 0; i < 5; i++) {
        const dy2 = ((t + i * 7) % 26);
        ctx.beginPath(); ctx.moveTo(px - 8 + i * 4, py - TH * 2 + dy2); ctx.lineTo(px - 8 + i * 4, py - TH * 2 + dy2 + 5); ctx.stroke();
      }
    }
  }

  /* ---------- deel 3: de tekenlus, het netwerk en het gesprek ----------
     De lus loopt op requestAnimationFrame en sorteert alles op diepte; het
     netwerk rijdt op de gewone routes plus het bestaande /api/stream-kanaal
     (event 'residentie'), met een rustige pols als vangnet. */
  const SNELHEID = 2.6; // tegels per seconde
  let vorigT = 0;
  function lus(t) {
    requestAnimationFrame(lus);
    if (!S.kamer) return;
    const dt = Math.min(0.1, (t - vorigT) / 1000 || 0); vorigT = t;
    // iedereen glijdt rustig naar zijn doel-tegel
    for (const l of S.leden.values()) {
      const vx = l.dx - l.rx, vy = l.dy - l.ry;
      const afstand = Math.hypot(vx, vy);
      if (afstand > 0.02) { const stapje = Math.min(afstand, SNELHEID * dt); l.rx += vx / afstand * stapje; l.ry += vy / afstand * stapje; }
      else { l.rx = l.dx; l.ry = l.dy; }
    }
    tekenZaal();
    // meubels en gasten samen op diepte sorteren en tekenen
    const items = [];
    for (const [soort, mx, my] of (S.kamer.meubels || [])) {
      if (!TEKEN[soort]) continue;
      const vlak = VLAKKEN.has(soort);
      items.push({ z: vlak ? -1000 + (mx + my) : (mx + my) * 10 + 5, doe: () => TEKEN[soort](mx, my) });
    }
    for (const l of S.leden.values()) items.push({ z: (l.rx + l.ry) * 10 + 6, doe: () => tekenGast(l, l.codenaam === S.ik) });
    items.sort((a, b) => a.z - b.z);
    for (const it of items) it.doe();
    tekenParen(); // de gouden draad tussen wie samen wandelt
  }

  /* ---------- staat bijwerken vanuit server-antwoorden ---------- */
  function neemStaat(d, hou) {
    if (d.ik) S.ik = d.ik;
    if ('paar' in d) S.paar = d.paar;
    S.kamer = d.kamer;
    $('#kamerNaam').textContent = d.kamer.naam;
    $('#kamerSub').textContent = (d.kamer.sub || '') + ' · ' + d.leden.length + ' aanwezig';
    $('#knopAtelier').hidden = !d.kamer.eigen;
    kamerKnoppen();
    const oud = hou ? S.leden : new Map();
    S.leden = new Map();
    for (const l of d.leden) {
      const was = oud.get(l.codenaam);
      S.leden.set(l.codenaam, { codenaam: l.codenaam, x: l.x, y: l.y, dx: l.dx, dy: l.dy,
        rx: was ? was.rx : l.dx, ry: was ? was.ry : l.dy, zit: l.zit,
        zeg: was && was.zeg, zegTot: was ? was.zegTot : 0, emote: was && was.emote, emoteTot: was ? was.emoteTot : 0 });
    }
    maat();
  }
  const lid = naam => S.leden.get(naam);

  async function betreed(kamerId) {
    try {
      const d = await api('/api/residentie/betreed', { kamer: kamerId });
      neemStaat(d, false);
      $('#balk').hidden = false;
    } catch (e) {
      meld(e.message);
      if (!S.kamer && kamerId !== 'lobby') betreed('lobby');
    }
  }

  /* ---------- live: het bestaande stream-kanaal ---------- */
  function luister() {
    if (!window.EventSource) return;
    try {
      const bron = new EventSource('/api/stream?token=' + encodeURIComponent(TOKEN));
      bron.addEventListener('residentie', ev => {
        let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
        if (!S.kamer || d.kamer !== S.kamer.id) return;
        if (d.kind === 'kom' && d.codenaam !== S.ik) {
          S.leden.set(d.codenaam, { codenaam: d.codenaam, x: d.x, y: d.y, dx: d.dx, dy: d.dy, rx: d.dx, ry: d.dy, zit: d.zit, zegTot: 0, emoteTot: 0 });
          $('#kamerSub').textContent = (S.kamer.sub || '') + ' · ' + S.leden.size + ' aanwezig';
        }
        if (d.kind === 'weg') { S.leden.delete(d.codenaam); $('#kamerSub').textContent = (S.kamer.sub || '') + ' · ' + S.leden.size + ' aanwezig'; }
        if (d.kind === 'stap') { const l = lid(d.codenaam); if (l) { l.dx = d.dx; l.dy = d.dy; l.zit = d.zit; } }
        if (d.kind === 'zeg') { const l = lid(d.codenaam); if (l) { l.zeg = d.tekst; l.zegTot = Date.now() + 5200; } }
        if (d.kind === 'emote') { const l = lid(d.codenaam); if (l) { l.emote = d.glyf; l.emoteTot = Date.now() + 1800; } }
        if (d.kind === 'meubel' && S.kamer.soort === 'suite') { S.kamer.meubels = d.meubels; }
        if (d.kind && d.kind.slice(0, 4) === 'spel') spelSein(d);
        if (d.kind === 'vraag') toonVraag(d);
        if (d.kind === 'telefoon') toonBel(d);
        if (d.kind === 'volg') return betreed(d.naar); // de partner neemt u mee
        if (d.kind && d.kind.slice(0, 5) === 'paar-') paarSein(d);
      });
      bron.onerror = () => { bron.close(); setTimeout(luister, 4000); };
    } catch (e) {}
  }
  // de rustige pols: houdt de plek warm en vangt gemiste seintjes op
  setInterval(async () => {
    if (!S.kamer) return;
    try { neemStaat(await api('/api/residentie/pols', {}), true); } catch (e) {}
  }, 25000);
  // weggaan hoeft niet netjes: wie het tabblad sluit, verdwijnt vanzelf
  // via de 90-seconden-pols aan de serverkant

  /* ---------- aanraken: lopen, zitten of een meubel zetten ---------- */
  canvas.addEventListener('pointermove', ev => { S.hover = tegelVan(ev.clientX, ev.clientY); });
  canvas.addEventListener('click', async ev => {
    if (!S.kamer) return;
    const t2 = tegelVan(ev.clientX, ev.clientY);
    if (t2.x < 0 || t2.x >= S.kamer.b || t2.y < 0 || t2.y >= S.kamer.d) return;
    if (S.editor) return zetOfWeg(t2);
    if (S.kamer.eigen && telefoonOp(t2)) return openBel(); // de huistelefoon
    try {
      const r = await api('/api/residentie/stap', { x: t2.x, y: t2.y });
      const ik = lid(S.ik);
      if (ik) { ik.dx = t2.x; ik.dy = t2.y; ik.zit = r.zit; }
      if (window.RTGWauw) RTGWauw.tik && RTGWauw.tik();
    } catch (e) { meld(e.message); }
  });

  /* ---------- het gesprek: zeggen en emotes ---------- */
  async function zeg() {
    const inp = $('#zegIn'), tekst = inp.value.trim();
    if (!tekst) return;
    inp.value = '';
    try {
      await api('/api/residentie/zeg', { tekst });
      const ik = lid(S.ik); if (ik) { ik.zeg = tekst; ik.zegTot = Date.now() + 5200; }
    } catch (e) { meld(e.message); }
  }
  $('#zegGo').addEventListener('click', zeg);
  $('#zegIn').addEventListener('keydown', e => { if (e.key === 'Enter') zeg(); });
  async function emote(glyf) {
    try {
      await api('/api/residentie/emote', { glyf });
      const ik = lid(S.ik); if (ik) { ik.emote = glyf; ik.emoteTot = Date.now() + 1800; }
    } catch (e) { meld(e.message); }
  }
  $('#emoteSter').addEventListener('click', () => emote('✶'));
  $('#emoteHart').addEventListener('click', () => emote('♥'));

  /* ---------- deel 3b: samen spelen ----------
     De activiteitenzalen hebben een eigen spel per zaal; u daagt iemand in
     de zaal uit, de ander zegt ja, en om de beurt speelt u met de
     timing-meter. Geen ranglijsten -- de uitslag is van het moment. */
  const SPELZAAL = { golf: 'golf', bar: 'darts', kegel: 'kegelen', badhuis: 'zwemmen' };
  const SPELWERK = { golf: 'Sla af', darts: 'Gooi', kegelen: 'Rol', zwemmen: 'Zwem' };
  let P = null, meterAan = false, meterWaarde = 0;

  function kamerKnoppen() {
    const spel = S.kamer && SPELZAAL[S.kamer.id];
    $('#knopSpel').hidden = !spel;
    $('#knopVraag').hidden = !(S.kamer && (S.kamer.id === 'restaurant' || S.kamer.soort === 'suite'));
    $('#knopPaar').hidden = !S.kamer;
    zetKnopPaar();
    if (P && P.kamerId !== (S.kamer && S.kamer.id)) { P = null; $('#spelBalk').hidden = true; }
  }

  $('#knopSpel').addEventListener('click', () => {
    if (P) return meld('Er loopt al een potje.');
    const anderen = [...S.leden.values()].filter(l => l.codenaam !== S.ik);
    if (!anderen.length) return meld('U bent hier nog alleen; nodig iemand uit via de gids of uw telefoon.');
    $('#spelKeuze').innerHTML = '<h2>Wie daagt u uit?</h2><div class="sub">' +
      esc((S.kamer && S.kamer.naam) || '') + ' · een potje om elkaar te leren kennen</div>' +
      anderen.map(l => '<button class="rij-item" data-daag="' + esc(l.codenaam) + '"><span><b>' + esc(l.codenaam) + '</b></span><span class="tel">daag uit</span></button>').join('') +
      '<button class="knop2 stil2" id="spelKeuzeWeg" type="button" style="margin-top:.9rem;width:100%;">Toch niet</button>';
    $('#spelLaag').classList.add('open');
    $('#spelKeuzeWeg').addEventListener('click', () => $('#spelLaag').classList.remove('open'));
    $('#spelKeuze').querySelectorAll('[data-daag]').forEach(b => b.addEventListener('click', async () => {
      $('#spelLaag').classList.remove('open');
      try { await api('/api/residentie/spel/daag', { codenaam: b.dataset.daag, spel: SPELZAAL[S.kamer.id] });
        meld('Uitnodiging verstuurd; even wachten op ' + b.dataset.daag + '.'); } catch (e) { meld(e.message); }
    }));
  });

  function startPotje(d) {
    P = { spel: d.spel, naam: d.naam, eenheid: d.eenheid, laag: d.laag, beurten: d.beurten,
      kamerId: d.kamerId || (S.kamer && S.kamer.id), spelers: d.spelers, aanZet: d.aanZet };
    $('#spelBalk').hidden = false;
    tekenSpel();
    if (!meterAan) { meterAan = true; requestAnimationFrame(meterLus); }
  }
  function tekenSpel() {
    if (!P) return;
    // met vier spelers (koppel tegen koppel) tellen we per team
    const st = P.spelers.length === 4
      ? [0, 1].map(t => P.spelers.filter(s2 => s2.team === t).map(s2 => esc(s2.codenaam)).join(' & ') + ' ' +
          P.spelers.filter(s2 => s2.team === t).reduce((a, s2) => a + s2.punten.reduce((x, y) => x + y, 0), 0)).join(' tegen ')
      : P.spelers.map(s2 => esc(s2.codenaam) + ' ' + (s2.punten.length ? s2.punten.reduce((a, b) => a + b, 0) : 0)).join(' tegen ');
    $('#spelInfo').innerHTML = '<b>' + esc(P.naam) + '</b> · ' + st + ' ' + esc(P.eenheid) +
      '<span style="color:var(--gold);"> · ' + (P.aanZet === S.ik ? 'u bent aan zet' : esc(P.aanZet || '') + ' is aan zet') + '</span>';
    $('#spelDoe').textContent = SPELWERK[P.spel] || 'Speel';
  }
  function meterLus(t) {
    if (!P) { meterAan = false; return; }
    requestAnimationFrame(meterLus);
    meterWaarde = Math.round((Math.sin(t / 260) * 0.5 + 0.5) * 100);
    $('#spelPin').style.left = meterWaarde + '%';
  }
  $('#spelDoe').addEventListener('click', async () => {
    if (!P) return;
    if (P.aanZet !== S.ik) return meld('De ander is aan zet.');
    try { verwerkZet(await api('/api/residentie/spel/zet', { kracht: meterWaarde }), S.ik); }
    catch (e) { meld(e.message); }
  });
  $('#spelWeg').addEventListener('click', async () => {
    try { await api('/api/residentie/spel/stop', {}); } catch (e) {}
    P = null; $('#spelBalk').hidden = true;
  });

  function verwerkZet(d, wie) {
    if (d.punt != null && wie) meld(wie === S.ik ? 'U: ' + d.punt + ' ' + (P ? P.eenheid : '') : wie + ': ' + d.punt + ' ' + (P ? P.eenheid : ''));
    if (d.uitslag) {
      const namen = d.uitslag.teams || (P ? P.spelers.map(s2 => s2.codenaam) : ['', '']);
      const w = d.uitslag.winnaar;
      $('#spelKeuze').innerHTML = '<h2>' + (P ? esc(P.naam) : 'Uitslag') + '</h2>' +
        '<div class="sub">' + esc(namen[0]) + ': ' + d.uitslag.stand[0] + ' · ' + esc(namen[1]) + ': ' + d.uitslag.stand[1] + '</div>' +
        '<p style="margin:.6rem 0;font-family:\'Bodoni Moda\',serif;font-size:1.15rem;">' +
        (w == null ? 'Gelijkspel; dat vraagt om een revanche.' : esc(namen[w]) + ' wint. Mooi gespeeld, allebei.') + '</p>' +
        '<button class="knop2" id="spelUitslagWeg" type="button" style="width:100%;">Verder</button>';
      $('#spelLaag').classList.add('open');
      $('#spelUitslagWeg').addEventListener('click', () => $('#spelLaag').classList.remove('open'));
      P = null; $('#spelBalk').hidden = true;
      return;
    }
    if (d.potje) { P.spelers = d.potje.spelers; P.aanZet = d.potje.aanZet; tekenSpel(); }
  }

  function spelSein(d) {
    if (d.kind === 'spel-uitnodiging') {
      $('#spelKeuze').innerHTML = '<h2>Een uitnodiging</h2>' +
        '<div class="sub">' + esc(d.van) + ' vraagt u voor een potje ' + esc(d.naam) + '</div>' +
        '<div style="display:flex;gap:.5rem;margin-top:.8rem;">' +
        '<button class="knop2" id="spelJa" type="button" style="flex:1;">Graag</button>' +
        '<button class="knop2 stil2" id="spelNee" type="button" style="flex:1;">Nu even niet</button></div>';
      $('#spelLaag').classList.add('open');
      $('#spelJa').addEventListener('click', async () => {
        $('#spelLaag').classList.remove('open');
        try { const r = await api('/api/residentie/spel/antwoord', { ja: true }); if (r.potje) startPotje(r.potje); }
        catch (e) { meld(e.message); }
      });
      $('#spelNee').addEventListener('click', async () => {
        $('#spelLaag').classList.remove('open');
        try { await api('/api/residentie/spel/antwoord', { ja: false }); } catch (e) {}
      });
    }
    if (d.kind === 'spel-start') startPotje(d);
    if (d.kind === 'spel-zet' && d.codenaam !== S.ik) verwerkZet(d, d.codenaam);
    if (d.kind === 'spel-afgewezen') meld(d.van + ' slaat het potje even over.');
    if (d.kind === 'spel-gestopt') { P = null; $('#spelBalk').hidden = true; meld('Het potje is gestopt.'); }
  }

  /* ---------- deel 3c: de vragen van het huis en de huistelefoon ----------
     Aan tafel (restaurant of suite) stelt het huis een vraag om het gesprek
     op gang te helpen; iedereen aan tafel ziet dezelfde kaart. De telefoon
     in de suite belt een lid dat nu in het huis is en nodigt uit. */
  function toonVraag(v) {
    if (typeof v === 'string') v = { tekst: v };
    const k = $('#vraagKaart'), rahul = v.van === 'rahul';
    k.classList.toggle('rahul', rahul);
    k.innerHTML = '<div class="ey" style="font-size:.6rem;letter-spacing:.26em;text-transform:uppercase;color:' +
      (rahul ? 'var(--burgundy)' : 'var(--gold)') + ';margin-bottom:.35rem;">' +
      (rahul ? 'Rahul · directeur van het huis' + (v.niveau === 'gewaagd' ? ' · gewaagd' : '') : 'Vraag van het huis') + '</div>' +
      (rahul && v.intro ? '<div style="font-size:.74rem;color:var(--soft);margin-bottom:.3rem;">' + esc(v.intro) + '</div>' : '') +
      '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.05rem;line-height:1.4;">' + esc(v.tekst) + '</div>';
    k.classList.add('open');
    clearTimeout(k._t); k._t = setTimeout(() => k.classList.remove('open'), rahul ? 16000 : 12000);
  }
  $('#knopVraag').addEventListener('click', async () => {
    try { toonVraag(await api('/api/residentie/vraag', {})); }
    catch (e) { meld(e.message); }
  });

  /* de telefoon in de suite: tik erop en nodig iemand uit */
  function telefoonOp(t2) {
    return (S.kamer.meubels || []).some(([soort, mx, my]) => soort === 'telefoon' && t2.x === mx && t2.y === my);
  }
  async function openBel() {
    try {
      const d = await api('/api/residentie/huis', {});
      $('#belLijst').innerHTML = d.leden.length ? d.leden.map(l =>
        '<button class="rij-item" data-bel="' + esc(l.codenaam) + '"><span><b>' + esc(l.codenaam) + '</b><span class="m">nu in ' + esc(l.kamer) + '</span></span>' +
        '<span class="tel">nodig uit</span></button>').join('')
        : '<div class="m" style="color:var(--soft);font-size:.78rem;margin-top:.5rem;">Er is nu verder niemand in het huis.</div>';
      $('#belLaag').classList.add('open');
      $('#belLijst').querySelectorAll('[data-bel]').forEach(b => b.addEventListener('click', async () => {
        $('#belLaag').classList.remove('open');
        try { await api('/api/residentie/bel', { codenaam: b.dataset.bel });
          meld('Uitnodiging verstuurd naar ' + b.dataset.bel + '.'); } catch (e) { meld(e.message); }
      }));
    } catch (e) { meld(e.message); }
  }
  $('#belDicht').addEventListener('click', () => $('#belLaag').classList.remove('open'));

  /* er wordt gebeld: iemand nodigt u uit in zijn of haar suite */
  function toonBel(d) {
    $('#spelKeuze').innerHTML = '<h2>De telefoon gaat</h2>' +
      '<div class="sub">' + esc(d.van) + ' nodigt u uit in de suite</div>' +
      '<div style="display:flex;gap:.5rem;margin-top:.8rem;">' +
      '<button class="knop2" id="belGa" type="button" style="flex:1;">Ga erheen</button>' +
      '<button class="knop2 stil2" id="belNiet" type="button" style="flex:1;">Niet nu</button></div>';
    $('#spelLaag').classList.add('open');
    $('#belGa').addEventListener('click', () => { $('#spelLaag').classList.remove('open'); betreed(d.adres); });
    $('#belNiet').addEventListener('click', () => $('#spelLaag').classList.remove('open'));
  }

  /* ---------- deel 3d: samen wandelen (het paar) ----------
     Een verzoek, een ja, en twee pionnen wandelen vast aan elkaar door het
     huis: een gouden draad met een hartje ertussen. Losmaken mag altijd;
     wie wil, wordt via de bestaande vriendenlaag ook echt vrienden. */
  function tekenParen() {
    if (!S.kamer || !S.kamer.paren || !S.kamer.paren.length) return;
    for (const [na, nb] of S.kamer.paren) {
      const a = S.leden.get(na), b = S.leden.get(nb);
      if (!a || !b) continue;
      const ax = isoX(a.rx + 0.5, a.ry + 0.5), ay = isoY(a.rx + 0.5, a.ry + 0.5) - TH * 0.8;
      const bx = isoX(b.rx + 0.5, b.ry + 0.5), by = isoY(b.rx + 0.5, b.ry + 0.5) - TH * 0.8;
      const mx = (ax + bx) / 2, my = (ay + by) / 2 - 14;
      ctx.strokeStyle = 'rgba(201,169,75,0.55)'; ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = KLEUR.bordeauxLicht;
      ctx.fillText('♥', mx, my + 4);
    }
  }

  function zetKnopPaar() {
    $('#knopPaar').textContent = S.paar ? 'Losmaken' : 'Wandel samen';
  }
  $('#knopPaar').addEventListener('click', async () => {
    if (S.paar) {
      try { await api('/api/residentie/paar/los', {}); S.paar = null; zetKnopPaar(); meld('U wandelt weer alleen.'); }
      catch (e) { meld(e.message); }
      return;
    }
    const anderen = [...S.leden.values()].filter(l => l.codenaam !== S.ik);
    if (!anderen.length) return meld('U bent hier nog alleen.');
    $('#spelKeuze').innerHTML = '<h2>Samen wandelen</h2><div class="sub">vast aan elkaar door het huis, zolang u allebei hier bent</div>' +
      anderen.map(l => '<button class="rij-item" data-paar="' + esc(l.codenaam) + '"><span><b>' + esc(l.codenaam) + '</b></span><span class="tel">vraag</span></button>').join('') +
      '<button class="knop2 stil2" id="paarKeuzeWeg" type="button" style="margin-top:.9rem;width:100%;">Toch niet</button>';
    $('#spelLaag').classList.add('open');
    $('#paarKeuzeWeg').addEventListener('click', () => $('#spelLaag').classList.remove('open'));
    $('#spelKeuze').querySelectorAll('[data-paar]').forEach(b => b.addEventListener('click', async () => {
      $('#spelLaag').classList.remove('open');
      try { await api('/api/residentie/paar/vraag', { codenaam: b.dataset.paar });
        meld('Gevraagd; even wachten op ' + b.dataset.paar + '.'); } catch (e) { meld(e.message); }
    }));
  });

  async function wordVrienden(naam) {
    try {
      const z = await api('/api/member/find', { q: naam });
      const t = (z.results || []).find(r => r.codename === naam) || (z.results || [])[0];
      if (!t) return meld('Niet gevonden in de ledengids.');
      await api('/api/member/connect', { key: t.key });
      meld('Vriendschapsverzoek verstuurd naar ' + naam + '.');
    } catch (e) { meld(e.message); }
  }

  function paarSein(d) {
    if (d.kind === 'paar-verzoek') {
      $('#spelKeuze').innerHTML = '<h2>Samen wandelen?</h2>' +
        '<div class="sub">' + esc(d.van) + ' wil vast aan u wandelen, zolang u hier samen bent</div>' +
        '<div style="display:flex;gap:.5rem;margin-top:.8rem;">' +
        '<button class="knop2" id="paarJa" type="button" style="flex:1;">Graag</button>' +
        '<button class="knop2 stil2" id="paarNee" type="button" style="flex:1;">Liever niet</button></div>';
      $('#spelLaag').classList.add('open');
      $('#paarJa').addEventListener('click', async () => {
        $('#spelLaag').classList.remove('open');
        try { const r = await api('/api/residentie/paar/antwoord', { ja: true }); S.paar = r.paar || d.van; zetKnopPaar(); }
        catch (e) { meld(e.message); }
      });
      $('#paarNee').addEventListener('click', async () => {
        $('#spelLaag').classList.remove('open');
        try { await api('/api/residentie/paar/antwoord', { ja: false }); } catch (e) {}
      });
    }
    if (d.kind === 'paar-aan') {
      if (S.kamer && S.kamer.paren && !S.kamer.paren.some(p2 => p2.includes(d.a))) S.kamer.paren.push([d.a, d.b]);
      if (d.a === S.ik || d.b === S.ik) {
        S.paar = d.a === S.ik ? d.b : d.a; zetKnopPaar();
        $('#spelKeuze').innerHTML = '<h2>U wandelt samen</h2>' +
          '<div class="sub">met ' + esc(S.paar) + ' · u loopt nu vast aan elkaar door het huis</div>' +
          '<div style="display:flex;gap:.5rem;margin-top:.8rem;">' +
          '<button class="knop2" id="paarVriend" type="button" style="flex:1;">Word ook vrienden</button>' +
          '<button class="knop2 stil2" id="paarKlaar" type="button" style="flex:1;">Verder</button></div>';
        $('#spelLaag').classList.add('open');
        $('#paarVriend').addEventListener('click', () => { $('#spelLaag').classList.remove('open'); wordVrienden(S.paar); });
        $('#paarKlaar').addEventListener('click', () => $('#spelLaag').classList.remove('open'));
      } else meld(d.a + ' en ' + d.b + ' wandelen nu samen.');
    }
    if (d.kind === 'paar-los') {
      if (S.kamer && S.kamer.paren) S.kamer.paren = S.kamer.paren.filter(p2 => !(p2.includes(d.a) || p2.includes(d.b)));
      if (d.a === S.ik || d.b === S.ik || S.paar) { S.paar = null; zetKnopPaar(); meld('Het paar is losgemaakt.'); }
    }
    if (d.kind === 'paar-nee') meld('Nu even niet; misschien straks.');
  }

  /* ---------- deel 4: de gids, het suite-atelier en de start ---------- */
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function toonGids() {
    try {
      const d = await api('/api/residentie/gids', {});
      $('#gidsZalen').innerHTML = d.zalen.map(z =>
        '<button class="rij-item" data-kamer="' + esc(z.id) + '"><span><b>' + esc(z.naam) + '</b><span class="m">' + esc(z.sub) + '</span></span>' +
        '<span class="tel">' + z.aanwezig + ' aanwezig</span></button>').join('');
      $('#gidsSuites').innerHTML = d.suites.length ? d.suites.map(s2 =>
        '<button class="rij-item" data-kamer="' + esc(s2.adres) + '"><span><b>' + esc(s2.naam) + '</b><span class="m">van ' + esc(s2.van) + ' · ' + s2.meubels + ' meubels</span></span>' +
        '<span class="tel">' + s2.aanwezig + ' aanwezig</span></button>').join('')
        : '<div class="m" style="color:var(--soft);font-size:.78rem;margin-top:.5rem;">Nog geen open suites; richt de uwe in en zet hem open.</div>';
      $('#gidsLaag').classList.add('open');
      $('#gidsLaag').querySelectorAll('[data-kamer]').forEach(b => b.addEventListener('click', () => {
        $('#gidsLaag').classList.remove('open');
        S.editor = null; $('#knopAtelier').classList.remove('aan');
        betreed(b.dataset.kamer);
      }));
    } catch (e) { meld(e.message); }
  }
  $('#knopGids').addEventListener('click', toonGids);
  $('#gidsDicht').addEventListener('click', () => $('#gidsLaag').classList.remove('open'));

  /* mijn suite: binnenlopen en het atelier openen */
  async function naarMijnSuite() {
    try {
      const d = await api('/api/residentie/suite', {});
      S.suite = d.suite; S.catalogus = d.catalogus;
      await betreed(d.suite.adres);
    } catch (e) { meld(e.message); }
  }
  $('#knopSuite').addEventListener('click', naarMijnSuite);

  function tekenAtelier() {
    $('#suiteNaam').value = S.suite ? S.suite.naam : '';
    $('#suiteOpen').textContent = S.suite && S.suite.open ? 'Open voor bezoek: ja' : 'Open voor bezoek: nee';
    $('#catalogus').innerHTML = S.catalogus.map(c =>
      '<button class="cat' + (S.editor && S.editor.soort === c.soort ? ' aan' : '') + '" data-soort="' + esc(c.soort) + '">' + esc(c.naam) +
      '<span style="display:block;color:var(--soft);font-size:.66rem;">' + c.b + 'x' + c.d + (c.zit ? ' · zitplek' : '') + '</span></button>').join('');
    $('#catalogus').querySelectorAll('[data-soort]').forEach(b => b.addEventListener('click', () => {
      S.editor = { soort: b.dataset.soort };
      $('#atelierWeg').classList.remove('aan');
      tekenAtelier();
      meld('Tik op een tegel om "' + b.textContent.split('\n')[0].trim() + '" neer te zetten.');
    }));
  }
  $('#knopAtelier').addEventListener('click', async () => {
    if (!S.suite) { try { const d = await api('/api/residentie/suite', {}); S.suite = d.suite; S.catalogus = d.catalogus; } catch (e) { return meld(e.message); } }
    tekenAtelier();
    $('#atelierLaag').classList.add('open');
  });
  $('#atelierDicht').addEventListener('click', () => { $('#atelierLaag').classList.remove('open'); });
  $('#atelierWeg').addEventListener('click', () => {
    S.editor = S.editor && S.editor.weg ? null : { weg: true };
    $('#atelierWeg').classList.toggle('aan', !!(S.editor && S.editor.weg));
    tekenAtelier();
    if (S.editor) { $('#atelierLaag').classList.remove('open'); meld('Weghaal-modus: tik op een meubel in de suite.'); }
  });
  $('#suiteNaamZet').addEventListener('click', async () => {
    try { const r = await api('/api/residentie/suite/zet', { naam: $('#suiteNaam').value });
      S.suite.naam = r.suite.naam; if (S.kamer && S.kamer.eigen) { S.kamer.naam = r.suite.naam; $('#kamerNaam').textContent = r.suite.naam; }
      meld('Naam bewaard.'); } catch (e) { meld(e.message); }
  });
  $('#suiteOpen').addEventListener('click', async () => {
    try { const r = await api('/api/residentie/suite/zet', { open: !S.suite.open });
      S.suite.open = r.suite.open; tekenAtelier();
      meld(S.suite.open ? 'De suite staat open voor bezoek.' : 'De suite is nu privé.'); } catch (e) { meld(e.message); }
  });

  // in de eigen suite: een tik zet of verwijdert een meubel (editor-modus)
  async function zetOfWeg(t2) {
    if (!(S.kamer && S.kamer.eigen)) { S.editor = null; return; }
    try {
      if (S.editor.weg) {
        const i = (S.kamer.meubels || []).findIndex(([soort, mx, my]) => {
          const c = S.catalogus.find(k => k.soort === soort);
          return c && t2.x >= mx && t2.x < mx + c.b && t2.y >= my && t2.y < my + c.d;
        });
        if (i < 0) return meld('Daar staat geen meubel.');
        const r = await api('/api/residentie/meubel/weg', { i });
        S.kamer.meubels = r.meubels.map(m => [m.soort, m.x, m.y]);
      } else {
        const r = await api('/api/residentie/meubel/zet', { soort: S.editor.soort, x: t2.x, y: t2.y });
        S.kamer.meubels = r.meubels.map(m => [m.soort, m.x, m.y]);
        if (window.RTGWauw) RTGWauw.tik && RTGWauw.tik();
      }
    } catch (e) { meld(e.message); }
  }

  /* ---------- de start: poort of naar binnen ---------- */
  if (!TOKEN) {
    document.querySelector('.kop').style.display = 'none';
    $('#poort').innerHTML = '<div class="inlog"><h2 style="font-family:\'Bodoni Moda\',serif;font-size:1.5rem;">De Résidence</h2>' +
      '<p style="color:var(--muted);margin-top:.6rem;line-height:1.6;">Het virtuele huis van RTG is er voor leden. Open de app en log in met je RTG-account.</p>' +
      '<p style="margin-top:1rem;"><a href="/apps/app.html">Naar de app →</a></p></div>';
  } else {
    const wens = new URLSearchParams(location.search).get('kamer') || 'lobby';
    betreed(wens);
    luister();
    requestAnimationFrame(lus);
  }
  maat();
})();
