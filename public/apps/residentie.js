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
    goud: '#D8B858', goudDiep: '#857007', bordeaux: '#7F1634', bordeauxLicht: '#D24A6E',
    ivoor: '#F2ECDC', tegelA: '#2B2519', tegelB: '#231E14', lijn: 'rgba(216,184,88,0.3)',
    muur: '#1E1910', muurLicht: '#2A2416', marmer: '#EFE9DC'
  };
  // elke zaal een eigen ondertoon in het licht
  const SFEER = { lobby: '#D8B858', bar: '#D24A6E', bibliotheek: '#C09A48', terras: '#5C82A6',
    golf: '#4E8A5E', kegel: '#A66E38', badhuis: '#4A96AA', restaurant: '#9E1C40',
    balzaal: '#C9A050', biljart: '#3E7A50', boog: '#8A6E3A', sterrenwacht: '#3A4E7A',
    renbaan: '#A64A2E' };

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
    // avondlicht van boven: een warme gloed in de zaalkleur, met meer contrast
    const g = ctx.createRadialGradient(W / 2, OY - MUUR, 40, W / 2, H / 2, Math.max(W, H) * 0.9);
    g.addColorStop(0, sfeer + '4A'); g.addColorStop(0.45, '#151310'); g.addColorStop(1, '#0A0908');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // de achtermuren: een verloop van licht (boven) naar diep (bij de vloer)
    const hoekX = isoX(0, 0), hoekY = isoY(0, 0) - TH / 2;
    const wg = ctx.createLinearGradient(0, hoekY - MUUR, 0, hoekY + TH);
    wg.addColorStop(0, KLEUR.muurLicht); wg.addColorStop(1, KLEUR.muur);
    ctx.fillStyle = wg;
    ctx.beginPath(); // linkerwand (langs y-as)
    ctx.moveTo(hoekX, hoekY - MUUR); ctx.lineTo(hoekX, hoekY);
    ctx.lineTo(isoX(0, d) - TW / 2, isoY(0, d) - TH / 2 + TH / 2);
    ctx.lineTo(isoX(0, d) - TW / 2, isoY(0, d) - MUUR); ctx.closePath(); ctx.fill();
    ctx.beginPath(); // rechterwand (langs x-as), iets lichter aangezet
    ctx.moveTo(hoekX, hoekY - MUUR); ctx.lineTo(hoekX, hoekY);
    ctx.lineTo(isoX(b, 0) + TW / 2, isoY(b, 0) - TH / 2 + TH / 2);
    ctx.lineTo(isoX(b, 0) + TW / 2, isoY(b, 0) - MUUR); ctx.closePath(); ctx.fill();
    ctx.fillStyle = sfeer + '14'; ctx.fill();
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
    // het gemaskerde bal: een venetiaans masker met een veertje en een kraag
    const hoofdY = py - hoog * 0.8, r = TW * 0.105;
    ctx.fillStyle = zelf ? '#7F1634' : '#141210';
    ctx.beginPath(); ctx.ellipse(px, hoofdY - r * 0.12, r * 1.06, r * 0.52, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = zelf ? 'rgba(240,214,140,0.9)' : 'rgba(201,169,75,0.8)'; ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.fillStyle = '#F2ECDC';
    ctx.beginPath(); ctx.arc(px - r * 0.42, hoofdY - r * 0.12, r * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + r * 0.42, hoofdY - r * 0.12, r * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = zelf ? '#E3C878' : '#C9A94B'; ctx.lineWidth = 1.1; // het veertje
    ctx.beginPath(); ctx.moveTo(px + r * 0.9, hoofdY - r * 0.3);
    ctx.quadraticCurveTo(px + r * 1.5, hoofdY - r * 1.6, px + r * 0.7, hoofdY - r * 2.1); ctx.stroke();
    ctx.strokeStyle = zelf ? 'rgba(127,22,52,0.75)' : 'rgba(20,18,16,0.65)'; ctx.lineWidth = 1.6; // de kraag
    ctx.beginPath(); ctx.ellipse(px, py - hoog * 0.64, TW * 0.1, TH * 0.075, 0, Math.PI * 1.05, Math.PI * 1.95, true); ctx.stroke();
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

  /* ---------- deel 2c: het bal, de biljartkamer en de sterrenwacht ----------
     De tekeningen voor de nieuwe zalen: kroonluchters en een spiegelende
     dansvloer, de biljarttafel, het boogdoel en de telescoop. Zelfde taal:
     goudlijn op donker, licht uit de tekening zelf. */
  VLAKKEN.add('dansvloer');
  VLAKKEN.add('kroonluchter');

  Object.assign(TEKEN, {
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
    kroonluchter: (x, y) => {
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      const top = py - TH * 4.6, fl = Math.sin(Date.now() / 300 + x) * 0.6;
      ctx.strokeStyle = 'rgba(216,184,88,0.75)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, top - TH * 0.8); ctx.lineTo(px, top); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(px, top, TW * 0.34, TH * 0.16, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(px, top + TH * 0.28, TW * 0.2, TH * 0.1, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 / 5) * i + 0.4;
        const kx = px + Math.cos(a) * TW * 0.34, ky = top + Math.sin(a) * TH * 0.16;
        const gl = ctx.createRadialGradient(kx, ky - 3, 0.5, kx, ky - 3, 5 + fl);
        gl.addColorStop(0, 'rgba(246,220,140,0.95)'); gl.addColorStop(1, 'rgba(246,220,140,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(kx, ky - 3, 5 + fl, 0, Math.PI * 2); ctx.fill();
      }
      const poel = ctx.createRadialGradient(px, py, 2, px, py, TW * 1.1);
      poel.addColorStop(0, 'rgba(246,220,140,0.16)'); poel.addColorStop(1, 'rgba(246,220,140,0)');
      ctx.fillStyle = poel;
      ctx.beginPath(); ctx.ellipse(px, py, TW * 1.1, TH * 1.1, 0, 0, Math.PI * 2); ctx.fill();
    },
    dansvloer: (x, y) => {
      vlakRuit(x, y, 2, 2, 'rgba(58,50,34,0.9)', 'rgba(216,184,88,0.55)');
      ctx.strokeStyle = 'rgba(216,184,88,0.28)'; ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(isoX(x + 1, y), isoY(x + 1, y) - 1); ctx.lineTo(isoX(x + 1, y + 2), isoY(x + 1, y + 2) - 1);
      ctx.moveTo(isoX(x, y + 1), isoY(x, y + 1) - 1); ctx.lineTo(isoX(x + 2, y + 1), isoY(x + 2, y + 1) - 1);
      ctx.stroke();
      const sh = ctx.createLinearGradient(isoX(x, y + 1) , isoY(x, y) - 1, isoX(x + 2, y + 1), isoY(x + 2, y + 2));
      sh.addColorStop(0, 'rgba(246,236,220,0)'); sh.addColorStop(0.5, 'rgba(246,236,220,0.08)'); sh.addColorStop(1, 'rgba(246,236,220,0)');
      vlakRuit(x, y, 2, 2, sh);
    },
    biljarttafel: (x, y) => {
      blokje(x, y, 3, 2, TH * 0.72, '#241E14', '#2E6B44');
      ctx.strokeStyle = 'rgba(216,184,88,0.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(isoX(x + 0.2, y + 0.2), isoY(x + 0.2, y + 0.2) - TH * 0.72);
      ctx.lineTo(isoX(x + 2.8, y + 0.2), isoY(x + 2.8, y + 0.2) - TH * 0.72);
      ctx.lineTo(isoX(x + 2.8, y + 1.8), isoY(x + 2.8, y + 1.8) - TH * 0.72);
      ctx.lineTo(isoX(x + 0.2, y + 1.8), isoY(x + 0.2, y + 1.8) - TH * 0.72);
      ctx.closePath(); ctx.stroke();
      const bal = (bx, by, kleur) => {
        ctx.fillStyle = kleur;
        ctx.beginPath(); ctx.ellipse(isoX(x + bx, y + by), isoY(x + bx, y + by) - TH * 0.72 - 2, 2.6, 2, 0, 0, Math.PI * 2); ctx.fill();
      };
      bal(1, 0.8, '#F2ECDC'); bal(1.8, 1.2, '#C23A5E'); bal(2.2, 0.6, '#D8B858');
    },
    doelwit: (x, y) => {
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      ctx.strokeStyle = 'rgba(216,184,88,0.7)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(px - TW * 0.14, py); ctx.lineTo(px, py - TH * 1.1); ctx.moveTo(px + TW * 0.14, py); ctx.lineTo(px, py - TH * 1.1); ctx.stroke();
      const r = TW * 0.26, cy2 = py - TH * 1.7;
      for (const [rr, kleur] of [[1, '#F2ECDC'], [0.66, '#D24A6E'], [0.33, '#D8B858']]) {
        ctx.fillStyle = kleur;
        ctx.beginPath(); ctx.arc(px, cy2, r * rr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#141210';
      ctx.beginPath(); ctx.arc(px, cy2, r * 0.1, 0, Math.PI * 2); ctx.fill();
    },
    telescoop: (x, y) => {
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      ctx.strokeStyle = 'rgba(216,184,88,0.8)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px - TW * 0.16, py); ctx.lineTo(px, py - TH * 1);
      ctx.moveTo(px + TW * 0.16, py); ctx.lineTo(px, py - TH * 1);
      ctx.stroke();
      ctx.save();
      ctx.translate(px, py - TH * 1); ctx.rotate(-0.6);
      ctx.fillStyle = '#2A2416';
      ctx.fillRect(-3, -TW * 0.42, 6, TW * 0.46);
      ctx.strokeStyle = 'rgba(216,184,88,0.9)'; ctx.lineWidth = 1; ctx.strokeRect(-3, -TW * 0.42, 6, TW * 0.46);
      ctx.restore();
      const st = Date.now() / 900; // een handvol sterren boven de kijker
      ctx.fillStyle = 'rgba(240,236,220,' + (0.5 + Math.sin(st + x) * 0.3).toFixed(2) + ')';
      for (const [ox, oy] of [[-14, -TH * 2.6], [10, -TH * 3], [2, -TH * 2.2]]) {
        ctx.beginPath(); ctx.arc(px + ox, py + oy, 1.1, 0, Math.PI * 2); ctx.fill();
      }
    }
  });

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
    tekenEffecten(); // beurt-animaties: ballen, pijlen, spetters, glans
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
      // de speeltafel (bordspellen) seint over hetzelfde kanaal
      bron.addEventListener('social', ev => {
        let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
        if (d.kind === 'spel') bordSein(d);
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
  const SPELZAAL = { golf: 'golf', bar: 'darts', kegel: 'kegelen', badhuis: 'zwemmen',
    balzaal: 'dansen', biljart: 'biljart', boog: 'boogschieten', renbaan: 'racen' };
  const SPELWERK = { golf: 'Sla af', darts: 'Gooi', kegelen: 'Rol', zwemmen: 'Zwem',
    dansen: 'Dans', biljart: 'Stoot', boogschieten: 'Schiet', racen: 'Geef gas', pool: 'Stoot' };
  let P = null, meterAan = false, meterWaarde = 0;
  // tikspellen: geen timing-meter maar tikken -- het tempo is de kracht
  const TIK = { zwemmen: 1, racen: 1, dansen: 1 };
  // vrij richten: daar doet de timing-meter niet mee
  const VRIJ = { darts: 1, boogschieten: 1 };
  let gas = null; // { taps, tijden, tot } tijdens een tik-beurt
  let laatsteKracht = 0; // de kracht van de eigen laatste zet, voor de scene

  function kamerKnoppen() {
    // samen spelen kan overal: het zaalspel waar dat er is, de kast altijd
    $('#knopSpel').hidden = !S.kamer;
    $('#knopVraag').hidden = !(S.kamer && (S.kamer.id === 'restaurant' || S.kamer.soort === 'suite'));
    $('#knopPaar').hidden = !S.kamer;
    zetKnopPaar();
    if (P && P.kamerId !== (S.kamer && S.kamer.id)) { P = null; gas = null; $('#spelBalk').hidden = true; sceneDicht(); }
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
    $('#spelKeuze').querySelectorAll('[data-daag]').forEach(b => b.addEventListener('click', () => kiesSpel(b.dataset.daag)));
  });

  function startPotje(d) {
    P = { spel: d.spel, naam: d.naam, eenheid: d.eenheid, laag: d.laag, samen: d.samen, beurten: d.beurten,
      kamerId: d.kamerId || (S.kamer && S.kamer.id), spelers: d.spelers, aanZet: d.aanZet };
    $('#spelBalk').hidden = false;
    $('#spelPin').parentElement.style.opacity = (TIK[P.spel] || VRIJ[P.spel]) ? '0.25' : '1';
    tekenSpel(); sceneOpen(P.spel);
    if (!meterAan) { meterAan = true; requestAnimationFrame(meterLus); }
  }
  function tekenSpel() {
    if (!P) return;
    // met vier spelers (koppel tegen koppel) tellen we per team
    const st = P.spelers.length === 4
      ? [0, 1].map(t => P.spelers.filter(s2 => s2.team === t).map(s2 => esc(s2.codenaam)).join(' & ') + ' ' +
          P.spelers.filter(s2 => s2.team === t).reduce((a, s2) => a + s2.punten.reduce((x, y) => x + y, 0), 0)).join(' tegen ')
      : P.spelers.map(s2 => esc(s2.codenaam) + ' ' + (s2.punten.length ? s2.punten.reduce((a, b) => a + b, 0) : 0)).join(P.samen ? ' en ' : ' tegen ');
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
    const sc = SCENES[P.spel];
    if (TIK[P.spel]) { // eerste druk opent het tikvenster, elke tik erna telt
      if (gas) {
        if (gas.rood && performance.now() < gas.rood) { gas.vals = true; return; }
        gas.taps++; gas.tijden.push(performance.now());
        return;
      }
      const cfg = (sc && sc.gasCfg) ? sc.gasCfg() : { rood: 0, duur: 3500 };
      gas = { taps: 0, tijden: [], vals: false,
        rood: cfg.rood ? performance.now() + cfg.rood : 0,
        tot: performance.now() + cfg.rood + cfg.duur };
      setTimeout(gasKlaar, cfg.rood + cfg.duur);
      return;
    }
    if (sc && sc.tik) { // het spel zelf vangt de tik (richten, kracht)
      const kr = sc.tik(meterWaarde);
      if (kr == null) return;
      laatsteKracht = kr;
      try { verwerkZet(await api('/api/residentie/spel/zet', { kracht: kr }), S.ik); }
      catch (e) { meld(e.message); }
      return;
    }
    laatsteKracht = meterWaarde;
    try { verwerkZet(await api('/api/residentie/spel/zet', { kracht: meterWaarde }), S.ik); }
    catch (e) { meld(e.message); }
  });
  function gasKlaar() {
    if (!gas) return;
    const sc = P && SCENES[P.spel];
    const kr = sc && sc.gasScore ? sc.gasScore(gas) : Math.min(100, Math.round(gas.taps * 4.5));
    gas = null; laatsteKracht = kr;
    if (!P) return;
    api('/api/residentie/spel/zet', { kracht: kr }).then(d => verwerkZet(d, S.ik)).catch(e => meld(e.message));
  }
  $('#spelWeg').addEventListener('click', async () => {
    try { await api('/api/residentie/spel/stop', {}); } catch (e) {}
    P = null; gas = null; $('#spelBalk').hidden = true; sceneDicht();
  });

  function verwerkZet(d, wie) {
    if (d.punt != null && wie && P) {
      voegEffect(P.spel, wie, d.punt, d.punt + ' ' + P.eenheid);
      sceneZet(wie, d.punt, (RAAK[P.spel] || (() => true))(d.punt), wie === S.ik ? laatsteKracht : meterWaarde);
    }
    if (d.punt != null && wie) meld(wie === S.ik ? 'U: ' + d.punt + ' ' + (P ? P.eenheid : '') : wie + ': ' + d.punt + ' ' + (P ? P.eenheid : ''));
    if (d.uitslag) {
      const namen = d.uitslag.teams || (P ? P.spelers.map(s2 => s2.codenaam) : ['', '']);
      const w = d.uitslag.winnaar;
      $('#spelKeuze').innerHTML = '<h2>' + (P ? esc(P.naam) : 'Uitslag') + '</h2>' +
        '<div class="sub">' + (d.uitslag.samen
          ? esc(namen[0]) + ' · samen ' + d.uitslag.stand[0] + ' ' + (P ? esc(P.eenheid) : '')
          : esc(namen[0]) + ': ' + d.uitslag.stand[0] + ' · ' + esc(namen[1]) + ': ' + d.uitslag.stand[1]) + '</div>' +
        '<p style="margin:.6rem 0;font-family:\'Bodoni Moda\',serif;font-size:1.15rem;">' +
        (d.uitslag.samen ? 'Wat een paar. De vloer was van u.'
          : w == null ? 'Gelijkspel; dat vraagt om een revanche.' : esc(namen[w]) + ' wint. Mooi gespeeld, allebei.') + '</p>' +
        '<button class="knop2" id="spelUitslagWeg" type="button" style="width:100%;">Verder</button>';
      $('#spelLaag').classList.add('open');
      $('#spelUitslagWeg').addEventListener('click', () => { $('#spelLaag').classList.remove('open'); sceneDicht(); });
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
        '<button class="knop2 h-flex1" id="spelJa" type="button">Graag</button>' +
        '<button class="knop2 stil2 h-flex1" id="spelNee" type="button">Nu even niet</button></div>';
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
    if (d.kind === 'spel-gestopt') { P = null; gas = null; $('#spelBalk').hidden = true; sceneDicht(); meld('Het potje is gestopt.'); }
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
      (rahul ? 'Rahul · directeur van het huis' : 'Vraag van het huis') +
      (v.niveau ? ' · ' + esc(v.niveau) : '') + '</div>' +
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
      '<button class="knop2 h-flex1" id="belGa" type="button">Ga erheen</button>' +
      '<button class="knop2 stil2 h-flex1" id="belNiet" type="button">Niet nu</button></div>';
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
        '<button class="knop2 h-flex1" id="paarJa" type="button">Graag</button>' +
        '<button class="knop2 stil2 h-flex1" id="paarNee" type="button">Liever niet</button></div>';
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
          '<button class="knop2 h-flex1" id="paarVriend" type="button">Word ook vrienden</button>' +
          '<button class="knop2 stil2 h-flex1" id="paarKlaar" type="button">Verder</button></div>';
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

  /* ---------- deel 3e: de wereld speelt mee ----------
     Elke beurt is zichtbaar in de zaal: een golfbal rolt naar de hole, een
     pijltje vliegt naar het bord, de kegelbal gaat de baan af, de boogpijl
     zoekt de roos, de witte bal stoot de rode weg, het water spat en de
     dansvloer glanst. En boven de speler zweeft het puntenaantal omhoog. */
  const EFX = [];
  const RAAK = { golf: p => p <= 1, darts: p => p >= 40, kegelen: p => p >= 9, zwemmen: p => p <= 7.5,
    biljart: p => p >= 2, boogschieten: p => p >= 9, dansen: p => p >= 35, racen: p => p >= 85,
    pool: p => p >= 1 };

  function doelVan(spel, l) {
    const zoek = soorten => {
      let best = null, ba = 1e9;
      for (const [soort, mx, my] of (S.kamer.meubels || [])) if (soorten.includes(soort)) {
        const d2 = Math.hypot(mx - l.rx, my - l.ry);
        if (d2 < ba) { ba = d2; best = [mx, my]; }
      }
      return best;
    };
    if (spel === 'golf') return zoek(['golfhole']);
    if (spel === 'darts') return zoek(['dartbord']);
    if (spel === 'kegelen') return zoek(['kegelbaan']);
    if (spel === 'boogschieten') return zoek(['doelwit']);
    if (spel === 'biljart') { const b = zoek(['biljarttafel']); return b && [b[0] + 1, b[1] + 0.5]; }
    if (spel === 'zwemmen') { const b = zoek(['water']); return b && [b[0] + 1, b[1] + 1]; }
    return null; // dansen: om de speler zelf
  }

  function voegEffect(spel, codenaam, punt, tekst) {
    const l = codenaam && S.leden.get(codenaam);
    if (!l || !S.kamer) return;
    const doel = doelVan(spel, l);
    EFX.push({ spel, van: [l.rx + 0.5, l.ry + 0.5], naar: doel ? [doel[0] + 0.5, doel[1] + 0.5] : [l.rx + 0.5, l.ry + 0.5],
      raak: (RAAK[spel] || (() => true))(punt), tekst, t0: performance.now(), duur: spel === 'dansen' ? 1700 : 1200 });
  }

  function tekenEffecten() {
    if (!EFX.length) return;
    const nu = performance.now();
    for (let i = EFX.length - 1; i >= 0; i--) {
      const e = EFX[i], f = Math.min(1, (nu - e.t0) / e.duur);
      if (f >= 1) { EFX.splice(i, 1); continue; }
      const g = Math.min(1, f * 1.45); // het projectiel is eerder klaar dan de nazweving
      const vx = e.van[0] + (e.naar[0] - e.van[0]) * g, vy = e.van[1] + (e.naar[1] - e.van[1]) * g;
      const px = isoX(vx, vy), py = isoY(vx, vy);
      if (e.spel === 'golf' || e.spel === 'kegelen') {
        ctx.fillStyle = e.spel === 'golf' ? '#F2ECDC' : '#2A2A30';
        ctx.beginPath(); ctx.ellipse(px, py - 3, e.spel === 'golf' ? 2.6 : 4, e.spel === 'golf' ? 2.2 : 3.2, 0, 0, Math.PI * 2); ctx.fill();
        if (g >= 1 && e.raak) vonken(px, py - 6, f, '#D8B858');
      } else if (e.spel === 'darts' || e.spel === 'boogschieten') {
        const hoog = TH * (e.spel === 'darts' ? 1.9 : 1.7) * g + Math.sin(Math.PI * g) * TH * 0.6;
        ctx.strokeStyle = '#D8B858'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(px - 6, py - hoog + 3); ctx.lineTo(px + 3, py - hoog - 2); ctx.stroke();
        if (g >= 1) vonken(px, py - hoog, f, e.raak ? '#D24A6E' : '#8A8680');
      } else if (e.spel === 'biljart') {
        const blad = TH * 0.72 + 4;
        ctx.fillStyle = '#F2ECDC';
        ctx.beginPath(); ctx.ellipse(px, py - blad, 2.6, 2, 0, 0, Math.PI * 2); ctx.fill();
        if (g >= 1 && e.raak) {
          const w = (f - 0.68) * 26;
          ctx.fillStyle = '#C23A5E';
          ctx.beginPath(); ctx.ellipse(px + 6 + w, py - blad - w * 0.3, 2.6, 2, 0, 0, Math.PI * 2); ctx.fill();
        }
      } else if (e.spel === 'zwemmen') {
        ctx.strokeStyle = 'rgba(190,225,240,0.8)'; ctx.lineWidth = 1.3;
        for (let r = 0; r < 3; r++) {
          const rf = (f + r / 3) % 1;
          ctx.globalAlpha = 1 - rf;
          ctx.beginPath(); ctx.ellipse(px, py, TW * 0.4 * rf + 3, TH * 0.34 * rf + 2, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (e.spel === 'dansen') {
        const sx = isoX(e.van[0], e.van[1]), sy = isoY(e.van[0], e.van[1]);
        for (let s2 = 0; s2 < 6; s2++) {
          const a = f * 5 + s2 * (Math.PI / 3);
          ctx.globalAlpha = 0.85 - f * 0.7;
          ctx.fillStyle = s2 % 2 ? '#D8B858' : '#D24A6E';
          ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('✶', sx + Math.cos(a) * TW * 0.42, sy - TH * (0.8 + f * 1.1) + Math.sin(a) * TH * 0.28);
        }
        ctx.globalAlpha = 1;
      }
      // het puntenaantal zweeft boven de speler omhoog
      if (e.tekst && f > 0.18) {
        const sx = isoX(e.van[0], e.van[1]), sy = isoY(e.van[0], e.van[1]);
        ctx.globalAlpha = Math.max(0, 1 - (f - 0.18) * 1.35);
        ctx.font = '700 12px Inter, sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = e.raak ? '#E3C878' : 'rgba(244,241,236,0.9)';
        ctx.fillText(e.tekst, sx, sy - TH * 2.1 - f * 26);
        ctx.globalAlpha = 1;
      }
    }
  }
  function vonken(px, py, f, kleur) {
    ctx.fillStyle = kleur;
    for (let v = 0; v < 5; v++) {
      const a = (Math.PI * 2 / 5) * v, r = 4 + f * 10;
      ctx.globalAlpha = Math.max(0, 1.4 - f * 1.6);
      ctx.beginPath(); ctx.arc(px + Math.cos(a) * r, py + Math.sin(a) * r * 0.6, 1.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- deel 3f: de speelschermen ----------
     Zodra een potje begint, klapt een eigen speelscherm open over de zaal:
     de golfbaan, het dartbord, de kegelbaan, het bad, het biljartlaken, het
     boogdoel of de dansvloer, schermvullend. De meter onderin blijft de
     besturing; richten gebeurt in de scene zelf, en tikken op het veld is
     hetzelfde als de speelknop. De scenes registreren zich in SCENES. */
  const SC = { aan: false, spel: null, anims: [] };
  const SCENES = {};
  const veld = $('#speelveld'), sctx = veld.getContext('2d');
  let SW = 0, SH = 0, SDPR = 1;

  function sceneMaat() {
    if (!SC.aan) return;
    SDPR = Math.min(2, window.devicePixelRatio || 1);
    SW = window.innerWidth; SH = window.innerHeight;
    veld.width = SW * SDPR; veld.height = SH * SDPR;
    veld.style.width = SW + 'px'; veld.style.height = SH + 'px';
    sctx.setTransform(SDPR, 0, 0, SDPR, 0, 0);
  }
  window.addEventListener('resize', sceneMaat);

  function sceneOpen(spel) {
    if (!SCENES[spel]) return;
    SC.aan = true; SC.spel = spel; SC.anims = [];
    if (SCENES[spel].reset) SCENES[spel].reset();
    veld.hidden = false; document.body.classList.add('scene-aan');
    sceneMaat();
    requestAnimationFrame(sceneLus);
  }
  function sceneDicht() { SC.aan = false; veld.hidden = true; document.body.classList.remove('scene-aan'); }

  function sceneLus() {
    if (!SC.aan) return;
    requestAnimationFrame(sceneLus);
    const sc = SCENES[SC.spel];
    if (!sc) return;
    const mijnBeurt = !!(P && P.aanZet === S.ik);
    sc.teken(sctx, SW, SH, meterWaarde, mijnBeurt);
    const nu = performance.now();
    for (let i = SC.anims.length - 1; i >= 0; i--) {
      const a = SC.anims[i], t = (nu - a.t0) / a.duur;
      if (t >= 1) { SC.anims.splice(i, 1); continue; }
      if (sc.anim) sc.anim(sctx, SW, SH, a, t);
    }
  }
  function sceneZet(wie, punt, raak, kracht) {
    if (!SC.aan) return;
    SC.anims.push({ wie, punt, raak, eigen: wie === S.ik,
      kracht: Math.max(0, Math.min(100, kracht == null ? 50 : kracht)),
      t0: performance.now(), duur: SC.spel === 'dansen' ? 1600 : 1400 });
  }
  // tikken op het speelveld = de speelknop
  veld.addEventListener('click', () => { const k = $('#spelDoe'); if (k && !$('#spelBalk').hidden) k.click(); });

  /* gedeelde penselen voor de scenes */
  function doek(boven, onder) {
    const g = sctx.createLinearGradient(0, 0, 0, SH);
    g.addColorStop(0, boven); g.addColorStop(1, onder);
    sctx.fillStyle = g; sctx.fillRect(0, 0, SW, SH);
  }
  function kopScene(naam, sub) { // de titel van de scene, in de huisstijl
    sctx.textAlign = 'center';
    sctx.fillStyle = '#F2ECDC'; sctx.font = '500 26px "Bodoni Moda", serif';
    sctx.fillText(naam, SW / 2, 96);
    sctx.fillStyle = 'rgba(216,184,88,0.9)'; sctx.font = '600 10px Inter, sans-serif';
    sctx.fillText(sub, SW / 2, 116);
  }
  function baanVak() { // de maten van de perspectief-baan, zonder te tekenen
    const bw = Math.min(SW * 0.7, 420);
    return { x0: SW / 2, yB: SH - 170, yT: 130, bw, tw: bw * 0.34 };
  }
  function baan(kleurA, kleurB, randKleur) { // een perspectief-baan van onder naar boven
    const { x0, yB, yT, bw, tw } = baanVak();
    sctx.beginPath();
    sctx.moveTo(x0 - bw / 2, yB); sctx.lineTo(x0 - tw / 2, yT);
    sctx.lineTo(x0 + tw / 2, yT); sctx.lineTo(x0 + bw / 2, yB); sctx.closePath();
    const g = sctx.createLinearGradient(0, yT, 0, yB);
    g.addColorStop(0, kleurA); g.addColorStop(1, kleurB);
    sctx.fillStyle = g; sctx.fill();
    sctx.strokeStyle = randKleur; sctx.lineWidth = 2; sctx.stroke();
    return { x0, yB, yT, bw, tw };
  }
  // een punt op de baan: v = 0 (onder) .. 1 (boven), zij = -1..1
  function opBaan(b, v, zij) {
    const w = b.bw + (b.tw - b.bw) * v;
    return [b.x0 + zij * w / 2 * 0.8, b.yB + (b.yT - b.yB) * v];
  }
  function richtlijn(b, zij, kleur) { // gebogen stippellijn vanaf de bal
    sctx.setLineDash([6, 8]); sctx.strokeStyle = kleur; sctx.lineWidth = 2;
    sctx.beginPath();
    const [sx, sy] = opBaan(b, 0.04, 0), [ex, ey] = opBaan(b, 0.9, zij);
    sctx.moveTo(sx, sy - 8);
    sctx.quadraticCurveTo(sx + (ex - sx) * 0.5, sy + (ey - sy) * 0.55, ex, ey);
    sctx.stroke(); sctx.setLineDash([]);
  }
  function schijf(x, y, r, ringen) { // een doel van ringen [kleur, kleur, ...]
    for (let i = 0; i < ringen.length; i++) {
      sctx.fillStyle = ringen[i];
      sctx.beginPath(); sctx.arc(x, y, r * (1 - i / ringen.length), 0, Math.PI * 2); sctx.fill();
    }
    sctx.strokeStyle = 'rgba(216,184,88,0.7)'; sctx.lineWidth = 2;
    sctx.beginPath(); sctx.arc(x, y, r, 0, Math.PI * 2); sctx.stroke();
  }
  function kruis(x, y, kleur) { // het zwevende richtkruis
    sctx.strokeStyle = kleur; sctx.lineWidth = 1.6;
    sctx.beginPath(); sctx.arc(x, y, 14, 0, Math.PI * 2); sctx.stroke();
    sctx.beginPath();
    sctx.moveTo(x - 22, y); sctx.lineTo(x - 8, y); sctx.moveTo(x + 8, y); sctx.lineTo(x + 22, y);
    sctx.moveTo(x, y - 22); sctx.lineTo(x, y - 8); sctx.moveTo(x, y + 8); sctx.lineTo(x, y + 22);
    sctx.stroke();
  }
  function sceneVonken(x, y, t, kleur) {
    sctx.fillStyle = kleur;
    for (let v = 0; v < 8; v++) {
      const a = (Math.PI * 2 / 8) * v, r = 8 + t * 46;
      sctx.globalAlpha = Math.max(0, 1 - t * 1.2);
      sctx.beginPath(); sctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 2.2, 0, Math.PI * 2); sctx.fill();
    }
    sctx.globalAlpha = 1;
  }
  function puntZweef(x, y, a, t) { // het puntenaantal zweeft ook hier
    if (a.punt == null) return;
    sctx.globalAlpha = Math.max(0, 1 - t * 1.1);
    sctx.font = '700 20px Inter, sans-serif'; sctx.textAlign = 'center';
    sctx.fillStyle = a.raak ? '#E3C878' : 'rgba(244,241,236,0.9)';
    sctx.fillText(String(a.punt), x, y - t * 60);
    sctx.globalAlpha = 1;
  }

  /* ---------- deel 3g: de baanscenes ----------
     Golf, kegelen en boogschieten als schermvullende speelvelden. De baan
     ligt in perspectief, het richten volgt de meter onderin, en elke beurt
     speelt zich in de scene af: de bal rolt, de pijl vliegt, kegels vallen. */
  SCENES.golf = {
    // drie holes die elk anders liggen; de baan wisselt per beurt
    HOLES: [{ v: 0.86, zij: 0 }, { v: 0.8, zij: -0.34 }, { v: 0.9, zij: 0.36 }],
    st: null,
    reset() { this.st = null; },
    beurtVan(naam) {
      const w = ((P && P.spelers) || []).find(s2 => s2.codenaam === naam);
      return (w && w.punten.length) || 0;
    },
    mik() { return Math.sin(performance.now() / 300) * 0.8; },
    tik(m) { // tik een: de richting vangen; tik twee: de kracht van de meter
      if (!this.st) { this.st = { aim: this.mik() }; return null; }
      const h = this.HOLES[this.beurtVan(S.ik) % 3];
      const kr = Math.max(0, Math.min(100, Math.round(m - Math.abs(this.st.aim - h.zij) * 140)));
      this.st = null;
      return kr;
    },
    teken(c, W, H, m, beurt) {
      doek('#141C0F', '#090D06');
      const b = baan('#4C6B36', '#2C471F', 'rgba(216,184,88,0.5)');
      const h = this.HOLES[this.beurtVan((P && P.aanZet) || S.ik) % 3];
      const [hx, hy] = opBaan(b, h.v, h.zij);
      c.fillStyle = 'rgba(62,102,44,0.9)'; // de glooiing rond de hole
      c.beginPath(); c.ellipse(hx, hy, 34, 15, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0A0A09';
      c.beginPath(); c.ellipse(hx, hy, 13, 6, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#D8B858'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx, hy - 54); c.stroke();
      c.fillStyle = '#D24A6E';
      c.beginPath(); c.moveTo(hx, hy - 54); c.lineTo(hx + 26, hy - 46); c.lineTo(hx, hy - 38); c.closePath(); c.fill();
      const [bx, by] = opBaan(b, 0.04, 0);
      if (beurt) {
        richtlijn(b, this.st ? this.st.aim : this.mik(), this.st ? 'rgba(216,184,88,0.95)' : 'rgba(242,236,220,0.6)');
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        c.fillText(this.st ? 'de richting staat -- tik op het topje voor de kracht'
          : 'hole ' + (this.beurtVan(S.ik) % 3 + 1) + ' -- tik als de lijn op de hole ligt', W / 2, 140);
      }
      c.fillStyle = '#F2ECDC';
      c.beginPath(); c.arc(bx, by - 5, 6, 0, Math.PI * 2); c.fill();
      kopScene('Midgetgolf', 'drie holes, en elke hole ligt anders');
    },
    anim(c, W, H, a, t) {
      const b = baanVak(), tt = 1 - (1 - t) * (1 - t);
      const h = this.HOLES[Math.max(0, this.beurtVan(a.wie) - 1) % 3];
      const eindV = a.raak ? h.v : 0.3 + a.kracht / 100 * (h.v - 0.3);
      const eindZ = a.raak ? h.zij : h.zij + (a.kracht >= 50 ? 0.3 : -0.3);
      const [x, y] = opBaan(b, 0.04 + (eindV - 0.04) * tt, eindZ * tt);
      c.fillStyle = '#F2ECDC';
      c.beginPath(); c.arc(x, y - 4, 6 - tt * 2.5, 0, Math.PI * 2); c.fill();
      if (a.raak && t > 0.72) { const [hx, hy] = opBaan(b, h.v, h.zij); sceneVonken(hx, hy - 4, (t - 0.72) * 3.6, '#E3C878'); }
      puntZweef(x, y - 28, a, t);
    }
  };

  SCENES.kegelen = {
    st: null, rol: 0,
    reset() { this.st = null; this.rol = 0; },
    glij() { return Math.sin(performance.now() / 280) * 0.55; },
    tik(m) { // tik een: de bal stilzetten; tik twee: de kracht van de meter
      if (!this.st) { this.st = { zij: this.glij() }; return null; }
      const kr = Math.max(0, Math.min(100, Math.round(m - Math.abs(this.st.zij) * 160)));
      this.rol = this.st.zij; this.st = null;
      return kr;
    },
    teken(c, W, H, m, beurt) {
      doek('#1B130A', '#0C0805');
      const b = baan('#7A552C', '#452C13', 'rgba(216,184,88,0.45)');
      // de naden van de baanplanken lopen mee het perspectief in
      c.strokeStyle = 'rgba(12,10,7,0.35)'; c.lineWidth = 1;
      for (const z of [-0.5, 0, 0.5]) {
        const [x1, y1] = opBaan(b, 0, z), [x2, y2] = opBaan(b, 1, z);
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      }
      const kegel = (x, y, r) => {
        c.fillStyle = '#EFE8D6';
        c.beginPath(); c.ellipse(x, y - r * 1.6, r, r * 2, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#B08D2F'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(x - r * 0.7, y - r * 2.4); c.lineTo(x + r * 0.7, y - r * 2.4); c.stroke();
      };
      const rijen = [[0], [-0.13, 0.13], [-0.26, 0, 0.26], [-0.39, -0.13, 0.13, 0.39]];
      rijen.forEach((rij, i) => rij.forEach(z => { const [x, y] = opBaan(b, 0.8 + i * 0.05, z); kegel(x, y, 4.6 - i * 0.5); }));
      const zijNu = beurt ? (this.st ? this.st.zij : this.glij()) : 0;
      const [bx, by] = opBaan(b, 0.05, zijNu);
      if (beurt) {
        richtlijn(b, zijNu, this.st ? 'rgba(216,184,88,0.95)' : 'rgba(242,236,220,0.55)');
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        c.fillText(this.st ? 'de lijn staat -- tik op het topje voor de kracht'
          : 'de bal glijdt -- tik als hij voor het midden staat', W / 2, 140);
      }
      c.fillStyle = '#7F1634'; c.beginPath(); c.arc(bx, by - 7, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(242,236,220,0.5)'; c.beginPath(); c.arc(bx - 3, by - 10, 2.2, 0, Math.PI * 2); c.fill();
      kopScene('Kegelen', 'zet de bal recht en rol vol door');
    },
    anim(c, W, H, a, t) {
      const b = baanVak(), tt = 1 - (1 - t) * (1 - t);
      const zijA = a.eigen ? this.rol * (1 - tt * 0.8) : 0;
      const [x, y] = opBaan(b, 0.05 + 0.72 * tt, zijA);
      c.fillStyle = '#7F1634';
      c.beginPath(); c.arc(x, y - 6, 9 - tt * 4, 0, Math.PI * 2); c.fill();
      if (t > 0.55) { // de kegels stuiven uiteen, naar rato van de worp
        const n = Math.max(1, Math.round(a.punt || 0)), f = (t - 0.55) / 0.45;
        const [px, py] = opBaan(b, 0.85, 0);
        c.strokeStyle = 'rgba(239,232,214,' + Math.max(0, 1 - f * 1.1) + ')'; c.lineWidth = 2.4;
        for (let i = 0; i < n; i++) {
          const hk = (i / n - 0.5) * 2.6, r = 10 + f * 52;
          const kx = px + Math.cos(hk - Math.PI / 2) * r, ky = py + Math.sin(hk - Math.PI / 2) * r * 0.6;
          c.beginPath(); c.moveTo(kx, ky); c.lineTo(kx + Math.cos(hk) * 8, ky + Math.sin(hk) * 8 - 4); c.stroke();
        }
        if (a.raak) sceneVonken(px, py - 6, f, '#E3C878');
        puntZweef(px, py - 30, a, f);
      }
    }
  };

  SCENES.boogschieten = {
    st: null, schot: null,
    reset() { this.schot = null; },
    doel(W, H) { return { cx: W / 2, cy: H * 0.34, r: Math.min(W * 0.33, 150) }; },
    kruisPos(W, H) { // het kruis ademt rond en scheert af en toe langs de roos
      const { cx, cy, r } = this.doel(W, H), t = performance.now();
      const rr = r * 0.85 * (0.5 + 0.5 * Math.sin(t / 810));
      return [cx + Math.cos(t / 540) * rr, cy + Math.sin(t / 540) * rr * 0.92];
    },
    tik() { // een tik: de pijl vertrekt naar waar het kruis nu staat
      const { cx, cy, r } = this.doel(SW, SH);
      const p = this.kruisPos(SW, SH);
      this.schot = p;
      const afst = Math.hypot(p[0] - cx, (p[1] - cy) / 0.92);
      return Math.max(0, Math.min(100, Math.round(100 - afst / (r * 0.92) * 100)));
    },
    teken(c, W, H, m, beurt) {
      doek('#151110', '#0A0807');
      const cx = W / 2, cy = H * 0.34, r = Math.min(W * 0.33, 150);
      c.strokeStyle = '#4A3A22'; c.lineWidth = 5; // de poten van de schietstand
      c.beginPath(); c.moveTo(cx - r * 0.7, cy + r * 1.5); c.lineTo(cx, cy);
      c.moveTo(cx + r * 0.7, cy + r * 1.5); c.lineTo(cx, cy); c.stroke();
      schijf(cx, cy, r, ['#EFE8D6', '#1E1910', '#C23A5E', '#7F1634', '#D8B858']);
      // de boog met de pijl op de pees, onderin
      const by = H - 190;
      c.strokeStyle = '#8A6238'; c.lineWidth = 4;
      c.beginPath(); c.arc(cx, by + 60, 85, Math.PI * 1.22, Math.PI * 1.78); c.stroke();
      c.strokeStyle = 'rgba(242,236,220,0.6)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(cx - 71, by + 13); c.lineTo(cx, by + 4); c.lineTo(cx + 71, by + 13); c.stroke();
      c.strokeStyle = '#D8B858'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx, by + 4); c.lineTo(cx, by - 44); c.stroke();
      if (beurt) {
        const [kx, ky] = this.kruisPos(W, H);
        kruis(kx, ky, 'rgba(242,236,220,0.9)');
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        c.fillText('adem mee en tik als het kruis de roos vindt', W / 2, 140);
      }
      kopScene('Boogschieten', 'de pijl gaat naar waar uw kruis staat');
    },
    anim(c, W, H, a, t) {
      const cx = W / 2, cy = H * 0.34, r = Math.min(W * 0.33, 150);
      let lx, ly;
      if (a.eigen && this.schot) { lx = this.schot[0]; ly = this.schot[1]; }
      else {
        const rr = r * Math.max(0, 10 - (a.punt || 0)) / 10 * 0.9, ha = a.kracht / 100 * Math.PI * 2;
        lx = cx + Math.cos(ha) * rr; ly = cy + Math.sin(ha) * rr * 0.9;
      }
      const tt = Math.min(1, t * 2.2), sx = cx, sy = H - 234;
      const x = sx + (lx - sx) * tt, y = sy + (ly - sy) * tt;
      c.strokeStyle = '#D8B858'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, y + 26 * (1 - tt * 0.6)); c.lineTo(x, y); c.stroke();
      c.fillStyle = '#D24A6E';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3.4, y + 8); c.lineTo(x + 3.4, y + 8); c.closePath(); c.fill();
      if (tt >= 1) { if (a.raak) sceneVonken(lx, ly, (t - 0.45) * 2, '#E3C878'); puntZweef(lx, ly - 16, a, Math.max(0, t - 0.4)); }
    }
  };

  /* ---------- deel 3h: de zaalscenes ----------
     Darts, biljart, zwemmen en dansen: het bord aan de muur, het laken van
     boven, de banen van het badhuis en de dansvloer in het spotlicht. */
  SCENES.darts = {
    worp: null,
    reset() { this.worp = null; },
    doel(W, H) { return { cx: W / 2, cy: H * 0.36, r: Math.min(W * 0.34, 150) }; },
    kruisPos(W, H) { // het kruis zwerft over het bord; uw tik is de worp
      const { cx, cy, r } = this.doel(W, H), t = performance.now();
      const rr = r * 0.88 * (0.5 + 0.5 * Math.sin(t / 690));
      return [cx + Math.cos(t / 470) * rr, cy + Math.sin(t / 470) * rr];
    },
    tik() {
      const { cx, cy, r } = this.doel(SW, SH);
      const p = this.kruisPos(SW, SH);
      this.worp = p;
      const afst = Math.hypot(p[0] - cx, p[1] - cy);
      return Math.max(0, Math.min(100, Math.round(100 - afst / (r * 0.92) * 100)));
    },
    teken(c, W, H, m, beurt) {
      doek('#171310', '#0B0908');
      const cx = W / 2, cy = H * 0.36, r = Math.min(W * 0.34, 150);
      c.fillStyle = '#241E15';
      c.beginPath(); c.arc(cx, cy, r + 12, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 20; i++) {
        c.fillStyle = i % 2 ? '#EFE8D6' : '#1E1910';
        c.beginPath(); c.moveTo(cx, cy);
        c.arc(cx, cy, r, i * Math.PI / 10, (i + 1) * Math.PI / 10); c.closePath(); c.fill();
      }
      c.strokeStyle = '#7F1634'; c.lineWidth = 5; // dubbel- en tripelring
      c.beginPath(); c.arc(cx, cy, r * 0.95, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(cx, cy, r * 0.58, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#D8B858'; c.beginPath(); c.arc(cx, cy, r * 0.11, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#7F1634'; c.beginPath(); c.arc(cx, cy, r * 0.05, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(216,184,88,0.8)'; c.lineWidth = 2;
      c.beginPath(); c.arc(cx, cy, r + 12, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = 'rgba(216,184,88,0.5)'; // de werplijn (oche)
      c.beginPath(); c.moveTo(W * 0.3, H - 180); c.lineTo(W * 0.7, H - 180); c.stroke();
      if (beurt) {
        const [kx, ky] = this.kruisPos(W, H);
        kruis(kx, ky, 'rgba(242,236,220,0.9)');
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        c.fillText('tik als het kruis op de roos staat', W / 2, 140);
      }
      kopScene('Darts', 'de pijl landt waar uw kruis staat');
    },
    anim(c, W, H, a, t) {
      const cx = W / 2, cy = H * 0.36, r = Math.min(W * 0.34, 150);
      let lx, ly;
      if (a.eigen && this.worp) { lx = this.worp[0]; ly = this.worp[1]; }
      else {
        const rr = r * Math.max(0, 60 - (a.punt || 0)) / 60 * 0.9, ha = a.kracht / 100 * Math.PI * 2;
        lx = cx + Math.cos(ha) * rr; ly = cy + Math.sin(ha) * rr;
      }
      const tt = Math.min(1, t * 2.4);
      const x = lx + (1 - tt) * (a.eigen ? 90 : -90), y = ly + (1 - tt) * 300;
      c.strokeStyle = '#D8B858'; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(x, y + 20 * (1 - tt * 0.5)); c.lineTo(x, y); c.stroke();
      c.fillStyle = '#D24A6E';
      c.beginPath(); c.moveTo(x, y + 22 * (1 - tt * 0.5)); c.lineTo(x - 3.4, y + 29 * (1 - tt * 0.5) + 3); c.lineTo(x + 3.4, y + 29 * (1 - tt * 0.5) + 3); c.closePath(); c.fill();
      if (tt >= 1) { if (a.raak) sceneVonken(lx, ly, (t - 0.42) * 2, '#E3C878'); puntZweef(lx, ly - 16, a, Math.max(0, t - 0.38)); }
    }
  };

  SCENES.biljart = {
    st: null, stoot: null,
    reset() { this.st = null; this.stoot = null; },
    draai() { return performance.now() / 900; },
    naarRood(W, H) {
      const { tx, ty, tw, th } = this.vak(W, H), b = this.ballen(tx, ty, tw, th);
      return Math.atan2(b.ry - b.wy, b.rx - b.wx);
    },
    tik(m) { // tik een: de keu stilzetten; tik twee: de kracht van de meter
      if (!this.st) { this.st = { hoek: this.draai() % (Math.PI * 2) }; return null; }
      let afw = Math.abs(((this.st.hoek - this.naarRood(SW, SH)) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      const kr = Math.max(0, Math.min(100, Math.round(m - afw * 110)));
      this.stoot = this.st.hoek; this.st = null;
      return kr;
    },
    vak(W, H) { const tw = Math.min(W * 0.84, 560), th = tw * 0.52;
      return { tx: (W - tw) / 2, ty: H * 0.24, tw, th }; },
    teken(c, W, H, m, beurt) {
      doek('#161310', '#0B0908');
      const { tx, ty, tw, th } = this.vak(W, H);
      c.fillStyle = '#4A2F16'; c.fillRect(tx - 16, ty - 16, tw + 32, th + 32);
      c.fillStyle = '#2E5A3E'; c.fillRect(tx, ty, tw, th);
      c.strokeStyle = 'rgba(12,10,7,0.5)'; c.lineWidth = 2; c.strokeRect(tx, ty, tw, th);
      c.fillStyle = '#D8B858'; // de diamanten op de band
      for (let i = 1; i < 4; i++) { c.beginPath(); c.arc(tx + tw * i / 4, ty - 8, 2.2, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(tx + tw * i / 4, ty + th + 8, 2.2, 0, Math.PI * 2); c.fill(); }
      const b = this.ballen(tx, ty, tw, th);
      if (beurt) {
        const hk = this.st ? this.st.hoek : this.draai();
        c.setLineDash([5, 7]); c.lineWidth = 1.8;
        c.strokeStyle = this.st ? 'rgba(216,184,88,0.95)' : 'rgba(242,236,220,0.6)';
        c.beginPath(); c.moveTo(b.wx, b.wy); c.lineTo(b.wx + Math.cos(hk) * tw * 0.36, b.wy + Math.sin(hk) * tw * 0.36); c.stroke();
        c.setLineDash([]);
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        c.fillText(this.st ? 'de keu staat -- tik op het topje voor de kracht'
          : 'de keu draait -- tik als de lijn de rode raakt', W / 2, 140);
      }
      const bal = (x, y, k) => { c.fillStyle = k; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(x - 2.5, y - 2.5, 2.2, 0, Math.PI * 2); c.fill(); };
      bal(b.wx, b.wy, '#F2ECDC'); bal(b.gx, b.gy, '#C9A94B'); bal(b.rx, b.ry, '#9E1C40');
      kopScene('Biljart', 'stoot als de lijn de rode raakt');
    },
    ballen(tx, ty, tw, th) {
      return { wx: tx + tw * 0.28, wy: ty + th * 0.62, gx: tx + tw * 0.24, gy: ty + th * 0.3,
        rx: tx + tw * 0.72, ry: ty + th * 0.46 };
    },
    anim(c, W, H, a, t) {
      const { tx, ty, tw, th } = this.vak(W, H), b = this.ballen(tx, ty, tw, th);
      const tt = 1 - (1 - t) * (1 - t);
      let doelx = a.raak ? b.rx : b.rx + tw * 0.12, doely = a.raak ? b.ry : ty + th * 0.9;
      if (a.eigen && !a.raak && this.stoot != null) { // de misser volgt de eigen keu
        doelx = Math.max(tx + 10, Math.min(tx + tw - 10, b.wx + Math.cos(this.stoot) * tw * 0.42));
        doely = Math.max(ty + 10, Math.min(ty + th - 10, b.wy + Math.sin(this.stoot) * tw * 0.42));
      }
      const f = Math.min(1, tt * 1.6);
      const x = b.wx + (doelx - b.wx) * f, y = b.wy + (doely - b.wy) * f;
      c.fillStyle = '#F2ECDC'; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
      if (a.raak && f >= 1) { // de rode kaatst weg over het laken
        const g = (tt - 0.62) / 0.38;
        if (g > 0) { c.fillStyle = '#9E1C40';
          c.beginPath(); c.arc(b.rx + g * tw * 0.16, b.ry - g * th * 0.3, 8, 0, Math.PI * 2); c.fill();
          sceneVonken(b.rx, b.ry, g, '#E3C878'); }
      }
      puntZweef(x, y - 20, a, t);
    }
  };


  /* ---------- deel 3i: de vloerscenes ----------
     De dansvloer als maatspel (tik op elke tel van de kloppende ring) en
     het badhuis als tempospel (gelijkmatig tikken zwemt het snelst). */
  SCENES.dansen = {
    P0: 400, PD: 620, // de eerste tel en de maat, in milliseconden
    gasScore(g) { // niet het tempo maar de maat telt: hoe dichtbij elke tel?
      const start = g.tot - 3500;
      let som = 0;
      for (let k = 0; k < 5; k++) {
        const tel = start + this.P0 + k * this.PD;
        const afw = g.tijden.length ? Math.min(...g.tijden.map(x => Math.abs(x - tel))) : 999;
        som += Math.max(0, 100 - afw / 3);
      }
      return Math.round(som / 5);
    },
    teken(c, W, H, m, beurt) {
      doek('#100C0A', '#070505');
      const cx = W / 2, fy = H * 0.6, rx = Math.min(W * 0.38, 210);
      c.fillStyle = 'rgba(240,200,110,0.09)'; // de lichtbundel van boven
      c.beginPath(); c.moveTo(cx - 30, 70); c.lineTo(cx - rx, fy); c.lineTo(cx + rx, fy); c.lineTo(cx + 30, 70); c.closePath(); c.fill();
      const g = c.createRadialGradient(cx, fy, 20, cx, fy, rx);
      g.addColorStop(0, '#3A3226'); g.addColorStop(1, '#16120D');
      c.fillStyle = g; c.beginPath(); c.ellipse(cx, fy, rx, rx * 0.42, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(216,184,88,0.55)'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(cx, fy, rx, rx * 0.42, 0, 0, Math.PI * 2); c.stroke();
      const t2 = Date.now() / 800, dans = (x, k) => {
        const dy = Math.sin(t2 * 2 + x) * 6;
        c.fillStyle = k; c.beginPath(); c.ellipse(cx + x, fy - 34 + dy, 12, 26, x > 0 ? -0.08 : 0.08, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#D8B858'; c.beginPath(); c.ellipse(cx + x, fy - 56 + dy, 7, 4.6, 0, 0, Math.PI * 2); c.fill();
      };
      dans(-34, '#7F1634'); dans(34, '#1E1910');
      if (beurt) {
        // de ring klopt op de maat; op elke slag hoort een tik
        const nu = gas ? performance.now() - (gas.tot - 3500) - this.P0 : Date.now();
        const f = ((nu % this.PD) + this.PD) % this.PD / this.PD;
        const r = 30 + f * (rx - 40);
        c.strokeStyle = 'rgba(240,200,110,' + Math.max(0.15, 1 - f) + ')'; c.lineWidth = 2.6;
        c.beginPath(); c.ellipse(cx, fy, r, r * 0.42, 0, 0, Math.PI * 2); c.stroke();
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        c.fillText(gas ? 'tik op elke slag van de ring -- ' + gas.taps + ' van 5 tellen'
          : 'druk op Dans en tik dan op de maat van de ring', W / 2, 140);
      }
      kopScene('Het gemaskerde bal', 'wie de maat voelt, danst met gratie');
    },
    anim(c, W, H, a, t) {
      const cx = W / 2, fy = H * 0.6, rx = Math.min(W * 0.38, 210);
      c.strokeStyle = 'rgba(240,200,110,' + Math.max(0, 0.8 - t) + ')'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(cx, fy, 30 + t * rx, (30 + t * rx) * 0.42, 0, 0, Math.PI * 2); c.stroke();
      if (a.raak) {
        c.fillStyle = 'rgba(240,200,110,' + Math.max(0, 1 - t * 1.1) + ')';
        c.font = '400 ' + (16 + t * 10) + 'px serif'; c.textAlign = 'center';
        for (let i = 0; i < 5; i++) {
          const hk = t * 1.6 + i * Math.PI * 2 / 5, r = 40 + t * 90;
          c.fillText('✶', cx + Math.cos(hk) * r, fy - 40 + Math.sin(hk) * r * 0.45);
        }
      }
      puntZweef(cx, fy - 90, a, t);
    }
  };

  SCENES.zwemmen = {
    gasScore(g) { // tempo telt, maar een gelijkmatige slag zwemt het snelst
      const basis = Math.min(100, Math.round(g.taps * 5));
      if (g.tijden.length < 3) return Math.min(100, Math.round(g.taps * 4.5));
      const iv = g.tijden.slice(1).map((x, i) => x - g.tijden[i]);
      const gem = iv.reduce((a, b) => a + b, 0) / iv.length;
      const spr = Math.sqrt(iv.reduce((a, b) => a + (b - gem) * (b - gem), 0) / iv.length);
      const factor = 1 - Math.min(0.3, Math.max(0, spr / gem - 0.18));
      return Math.round(basis * factor);
    },
    vak(W, H) { const pw = Math.min(W * 0.78, 480);
      return { px: (W - pw) / 2, py: 170, pw, ph: H - 470 }; },
    teken(c, W, H, m, beurt) {
      doek('#0E1A1E', '#080F13');
      const { px, py, pw, ph } = this.vak(W, H);
      const g = c.createLinearGradient(0, py, 0, py + ph);
      g.addColorStop(0, 'rgba(48,104,130,0.95)'); g.addColorStop(1, 'rgba(24,58,76,0.95)');
      c.fillStyle = g; c.fillRect(px, py, pw, ph);
      c.strokeStyle = 'rgba(216,184,88,0.7)'; c.lineWidth = 3; c.strokeRect(px, py, pw, ph);
      const sp = (P && P.spelers) || [], n = Math.max(2, sp.length);
      c.setLineDash([4, 10]); c.strokeStyle = 'rgba(242,236,220,0.4)'; c.lineWidth = 1.4;
      for (let i = 1; i < n; i++) { c.beginPath(); c.moveTo(px + pw * i / n, py); c.lineTo(px + pw * i / n, py + ph); c.stroke(); }
      c.setLineDash([]);
      const t2 = Date.now() / 600;
      // wie sneller zwemt (minder seconden) ligt zichtbaar iets voor
      const sommen = sp.map(s2 => s2.punten.reduce((a2, b2) => a2 + b2, 0));
      const gem = sommen.reduce((a2, b2) => a2 + b2, 0) / (sommen.length || 1);
      sp.forEach((s2, i) => {
        const lx = px + pw * (i + 0.5) / n;
        const voor = Math.max(-0.05, Math.min(0.05, (gem - sommen[i]) * 0.01));
        const v = Math.max(0, Math.min(1, s2.punten.length / ((P && P.beurten) || 4) + voor));
        const y = py + ph - 26 - v * (ph - 56);
        c.strokeStyle = 'rgba(242,236,220,0.5)'; c.lineWidth = 1.2;
        c.beginPath(); c.ellipse(lx, y, 13 + Math.sin(t2 + i) * 2, 6, 0, 0, Math.PI * 2); c.stroke();
        c.fillStyle = s2.codenaam === S.ik ? '#7F1634' : '#1E1910';
        c.beginPath(); c.arc(lx, y, 7.5, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#D8B858'; c.lineWidth = 1.4; c.beginPath(); c.arc(lx, y, 7.5, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#EFE8D6'; c.font = '600 10px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText(s2.codenaam, lx, py + ph + 18 + (i % 2) * 12);
      });
      if (beurt) {
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        if (gas) {
          const rest = Math.max(0, (gas.tot - performance.now()) / 1000);
          c.fillText('tik, tik, tik -- nog ' + rest.toFixed(1) + ' s', W / 2, py - 12);
          c.font = '500 34px "Bodoni Moda", serif'; c.fillStyle = '#F2ECDC';
          c.fillText(String(gas.taps), W / 2, py + 42);
        } else c.fillText('druk op Zwem en tik dan snel en gelijkmatig', W / 2, py - 12);
      }
      kopScene('Baantjes trekken', 'een strakke, gelijkmatige slag zwemt het snelst');
    },
    anim(c, W, H, a, t) {
      const { px, py, pw, ph } = this.vak(W, H);
      const sp = (P && P.spelers) || [], n = Math.max(2, sp.length);
      const i = Math.max(0, sp.findIndex(s2 => s2.codenaam === a.wie));
      const lx = px + pw * (i + 0.5) / n, y = py + ph - 26 - t * (ph - 56);
      c.strokeStyle = 'rgba(242,236,220,' + (0.7 - t * 0.4) + ')'; c.lineWidth = 1.6;
      for (let k = 0; k < 3; k++) {
        const f = (t * 2 + k / 3) % 1;
        c.beginPath(); c.ellipse(lx, y + f * 34, 6 + f * 16, 3 + f * 7, 0, 0, Math.PI * 2); c.stroke();
      }
      puntZweef(lx, y - 14, a, t);
    }
  };


  /* ---------- deel 3j: de renbaan-scene ----------
     De Grand Prix: startlicht, kerbstones en karts met gemaskerde
     coureurs; het tik-tempo is het gas. */
  function kart(c, x, y, eigen, s) { // een kart van achteren, met gemaskerde coureur
    c.fillStyle = '#0A0908';
    c.fillRect(x - 11 * s, y - 3 * s, 5 * s, 8 * s); c.fillRect(x + 6 * s, y - 3 * s, 5 * s, 8 * s);
    c.fillStyle = eigen ? '#7F1634' : '#1E1910';
    c.fillRect(x - 8 * s, y - 8 * s, 16 * s, 11 * s);
    c.strokeStyle = 'rgba(216,184,88,0.8)'; c.lineWidth = 1.2;
    c.strokeRect(x - 8 * s, y - 8 * s, 16 * s, 11 * s);
    c.fillStyle = '#D8B858'; // de helm als masker
    c.beginPath(); c.ellipse(x, y - 12 * s, 5.5 * s, 4.5 * s, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = eigen ? '#D24A6E' : '#F2ECDC';
    c.fillRect(x - 6 * s, y - 20 * s, 12 * s, 2.2 * s); // het vleugeltje
  }

  SCENES.racen = {
    gasCfg() { return { rood: 1400, duur: 3500 }; }, // eerst het startlicht, dan pas gas
    gasScore(g) { // wie voor groen tikt, maakt een valse start
      const basis = Math.min(100, Math.round(g.taps * 4.5));
      return g.vals ? Math.round(basis * 0.6) : basis;
    },
    teken(c, W, H, m, beurt) {
      doek('#15120E', '#0A0806');
      const b = baan('#3A3630', '#242019', 'rgba(216,184,88,0.4)');
      for (let k = 0; k < 20; k++) { // kerbstones langs beide randen
        const v = k * 0.05;
        for (const zij of [-1.22, 1.22]) {
          const [x, y] = opBaan(b, v, zij);
          c.fillStyle = k % 2 ? '#7F1634' : '#EFE8D6';
          c.fillRect(x - 5, y - 3, 10, 5);
        }
      }
      const [fx, fy] = opBaan(b, 0.94, 0), fw = b.tw * 1.05; // de geblokte finish
      for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) {
        c.fillStyle = (i + j) % 2 ? '#16130E' : '#EFE8D6';
        c.fillRect(fx - fw / 2 + i * fw / 10, fy - 6 + j * 5, fw / 10, 5);
      }
      c.setLineDash([8, 12]); c.strokeStyle = 'rgba(242,236,220,0.28)'; c.lineWidth = 2;
      const [m1x, m1y] = opBaan(b, 0, 0), [m2x, m2y] = opBaan(b, 0.92, 0);
      c.beginPath(); c.moveTo(m1x, m1y); c.lineTo(m2x, m2y); c.stroke(); c.setLineDash([]);
      const sp = (P && P.spelers) || [], tot = ((P && P.beurten) || 4) * 100;
      sp.forEach((s2, i) => {
        const zij = sp.length > 2 ? -0.75 + i * 0.5 : (i ? 0.45 : -0.45);
        const afs = s2.punten.reduce((a2, b2) => a2 + b2, 0);
        let v = 0.14 + Math.min(1, afs / tot) * 0.74;
        if (gas && beurt && s2.codenaam === S.ik) v += Math.min(0.03, gas.taps * 0.0012);
        const [kx, ky] = opBaan(b, v, zij);
        kart(c, kx, ky, s2.codenaam === S.ik, 1.15 - v * 0.55);
        c.fillStyle = '#EFE8D6'; c.font = '600 9px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText(s2.codenaam, kx, ky + 16);
      });
      if (beurt) {
        const nu = performance.now(), rood = gas && gas.rood && nu < gas.rood;
        const aanTal = rood ? Math.min(3, Math.ceil((1400 - (gas.rood - nu)) / 470)) : 3;
        for (let i = 0; i < 3; i++) { // de startlichten boven de baan
          c.beginPath(); c.arc(W / 2 - 34 + i * 34, 192, 9, 0, Math.PI * 2);
          c.fillStyle = !gas ? 'rgba(242,236,220,0.15)'
            : rood ? (i < aanTal ? '#9E1C40' : 'rgba(242,236,220,0.15)') : '#D8B858';
          c.fill();
        }
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        if (!gas) c.fillText('druk op Geef gas en wacht op het gouden licht', W / 2, 230);
        else if (rood) c.fillText(gas.vals ? 'te vroeg! dat kost u meters' : 'wachten op groen...', W / 2, 230);
        else {
          const rest = Math.max(0, (gas.tot - nu) / 1000);
          c.fillText((gas.vals ? 'valse start -- ' : '') + 'tik, tik, tik -- nog ' + rest.toFixed(1) + ' s', W / 2, 230);
          c.font = '500 34px "Bodoni Moda", serif'; c.fillStyle = '#F2ECDC';
          c.fillText(String(gas.taps), W / 2, 272);
        }
      }
      kopScene('De Grand Prix van het huis', 'wacht op groen en tik u naar de finish');
    },
    anim(c, W, H, a, t) {
      const b = baanVak(), sp = (P && P.spelers) || [];
      const i = Math.max(0, sp.findIndex(s2 => s2.codenaam === a.wie));
      const zij = sp.length > 2 ? -0.75 + i * 0.5 : (i ? 0.45 : -0.45);
      const afs = sp[i] ? sp[i].punten.reduce((a2, b2) => a2 + b2, 0) : 0;
      const v = 0.14 + Math.min(1, afs / (((P && P.beurten) || 4) * 100)) * 0.74;
      const [x, y] = opBaan(b, v, zij);
      c.strokeStyle = 'rgba(216,184,88,' + Math.max(0, 0.7 - t) + ')'; c.lineWidth = 2;
      for (let k = 0; k < 3; k++) { // stofwolkjes achter de kart
        c.beginPath(); c.arc(x - 8 + k * 8, y + 10 + t * 26, 3 + t * 9, 0, Math.PI * 2); c.stroke();
      }
      if (a.raak) sceneVonken(x, y - 10, t, '#E3C878');
      puntZweef(x, y - 26, a, t);
    }
  };

  SCENES.pool = {
    st: null, stoot: null,
    reset() { this.st = null; this.stoot = null; },
    vak(W, H) { const tw = Math.min(W * 0.84, 560), th = tw * 0.62;
      return { tx: (W - tw) / 2, ty: H * 0.2, tw, th }; },
    zakken(tx, ty, tw, th) {
      return [[tx, ty], [tx + tw / 2, ty - 4], [tx + tw, ty],
        [tx, ty + th], [tx + tw / 2, ty + th + 4], [tx + tw, ty + th]];
    },
    // per beurt een andere opstelling: de bal ligt voor een andere zak
    OPSTELLING: [{ b: [0.68, 0.26], z: 2 }, { b: [0.28, 0.7], z: 3 }, { b: [0.5, 0.22], z: 1 }],
    beurtVan(naam) {
      const w = ((P && P.spelers) || []).find(s2 => s2.codenaam === naam);
      return (w && w.punten.length) || 0;
    },
    op(naam) { return this.OPSTELLING[this.beurtVan(naam) % 3]; },
    ballen(tx, ty, tw, th, o) {
      return { wx: tx + tw * 0.25, wy: ty + th * 0.76, bx: tx + tw * o.b[0], by: ty + th * o.b[1] };
    },
    draai() { return performance.now() / 900; },
    tik(m) { // tik een: de keu stilzetten; tik twee: de kracht van de meter
      if (!this.st) { this.st = { hoek: this.draai() % (Math.PI * 2) }; return null; }
      const { tx, ty, tw, th } = this.vak(SW, SH), o = this.op(S.ik);
      const b = this.ballen(tx, ty, tw, th, o);
      const naarBal = Math.atan2(b.by - b.wy, b.bx - b.wx);
      const afw = Math.abs(((this.st.hoek - naarBal) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      const kr = Math.max(0, Math.min(100, Math.round(m - afw * 110)));
      this.stoot = this.st.hoek; this.st = null;
      return kr;
    },
    teken(c, W, H, m, beurt) {
      doek('#131610', '#0A0C08');
      const { tx, ty, tw, th } = this.vak(W, H);
      c.fillStyle = '#4A2F16'; c.fillRect(tx - 16, ty - 16, tw + 32, th + 32);
      c.fillStyle = '#25543A'; c.fillRect(tx, ty, tw, th);
      c.strokeStyle = 'rgba(12,10,7,0.5)'; c.lineWidth = 2; c.strokeRect(tx, ty, tw, th);
      const o = this.op((P && P.aanZet) || S.ik), b = this.ballen(tx, ty, tw, th, o);
      const zk = this.zakken(tx, ty, tw, th);
      zk.forEach(([zx, zy], i) => { // de zes zakken; de doelzak licht op
        c.fillStyle = '#070605'; c.beginPath(); c.arc(zx, zy, 11, 0, Math.PI * 2); c.fill();
        c.strokeStyle = i === o.z ? 'rgba(216,184,88,0.95)' : 'rgba(216,184,88,0.35)';
        c.lineWidth = i === o.z ? 2.4 : 1.2;
        c.beginPath(); c.arc(zx, zy, i === o.z ? 14 : 11, 0, Math.PI * 2); c.stroke();
      });
      if (beurt) {
        const hk = this.st ? this.st.hoek : this.draai();
        c.setLineDash([5, 7]); c.lineWidth = 1.8;
        c.strokeStyle = this.st ? 'rgba(216,184,88,0.95)' : 'rgba(242,236,220,0.6)';
        c.beginPath(); c.moveTo(b.wx, b.wy); c.lineTo(b.wx + Math.cos(hk) * tw * 0.4, b.wy + Math.sin(hk) * tw * 0.4); c.stroke();
        c.setLineDash([]);
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        c.fillText(this.st ? 'de keu staat -- tik op het topje voor de kracht'
          : 'de keu draait -- tik als de lijn de gekleurde bal pakt', W / 2, 140);
      }
      const bal = (x, y, k) => { c.fillStyle = k; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(x - 2.5, y - 2.5, 2.2, 0, Math.PI * 2); c.fill(); };
      bal(tx + tw * 0.82, ty + th * 0.62, '#C9A94B'); bal(tx + tw * 0.14, ty + th * 0.3, '#1E1910');
      bal(b.bx, b.by, '#9E1C40'); bal(b.wx, b.wy, '#F2ECDC');
      kopScene('Pool', 'pot de bal in de oplichtende zak');
    },
    anim(c, W, H, a, t) {
      const { tx, ty, tw, th } = this.vak(W, H);
      const o = this.OPSTELLING[Math.max(0, this.beurtVan(a.wie) - 1) % 3];
      const b = this.ballen(tx, ty, tw, th, o), zak = this.zakken(tx, ty, tw, th)[o.z];
      const tt = 1 - (1 - t) * (1 - t);
      if (a.raak) { // wit naar de bal, de bal rolt door de zak in
        const f = Math.min(1, tt * 1.7);
        const x = b.wx + (b.bx - b.wx) * f, y = b.wy + (b.by - b.wy) * f;
        c.fillStyle = '#F2ECDC'; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
        if (f >= 1) {
          const g = Math.min(1, (tt - 0.58) / 0.42);
          if (g < 0.96) { c.fillStyle = '#9E1C40';
            c.beginPath(); c.arc(b.bx + (zak[0] - b.bx) * g, b.by + (zak[1] - b.by) * g, 8 * (1 - g * 0.4), 0, Math.PI * 2); c.fill(); }
          else sceneVonken(zak[0], zak[1], (tt - 0.9) * 6, '#E3C878');
        }
      } else { // de misser volgt de eigen keu over het laken
        let dx = b.wx + tw * 0.3, dy = ty + th * 0.9;
        if (a.eigen && this.stoot != null) {
          dx = Math.max(tx + 10, Math.min(tx + tw - 10, b.wx + Math.cos(this.stoot) * tw * 0.45));
          dy = Math.max(ty + 10, Math.min(ty + th - 10, b.wy + Math.sin(this.stoot) * tw * 0.45));
        }
        const f = Math.min(1, tt * 1.4);
        c.fillStyle = '#F2ECDC';
        c.beginPath(); c.arc(b.wx + (dx - b.wx) * f, b.wy + (dy - b.wy) * f, 8, 0, Math.PI * 2); c.fill();
      }
      puntZweef(b.bx, b.by - 22, a, t);
    }
  };

  /* ---------- deel 3k: de spellenkast ----------
     Naast het spel van de zaal staan alle bordspellen van het huis klaar:
     schaken, Woordduel, Magnaat en Proost (18+). Een potje loopt via de
     bestaande speeltafel (spelen.html) op dezelfde spelmotor; de
     uitnodiging komt gewoon hier in het hotel binnen. */
  const KAST = { schaak: 'Schaken', woord: 'Woordduel', magnaat: 'Magnaat', proost: 'Proost (18+)' };
  const KASTNAAM = Object.assign({ seconden: '30 Seconden', mejn: 'Mens erger je niet',
    pesten: 'Pesten', dam: 'Dammen', rummi: 'Rummi', waarheid: 'Doen of Waarheid' }, KAST);

  function kiesSpel(codenaam) {
    const zaalSpel = S.kamer && SPELZAAL[S.kamer.id];
    // sommige zalen hebben een tweede tafel naast het zaalspel
    const tweede = S.kamer && S.kamer.id === 'biljart' ? [['pool', 'Pool', 'de tafel met de zes zakken']] : [];
    $('#spelKeuze').innerHTML = '<h2>' + esc(codenaam) + ' uitdagen</h2>' +
      '<div class="sub">kies waarmee u het ijs breekt</div>' +
      (zaalSpel ? '<button class="rij-item" id="kiesZaal" type="button"><span><b>Het spel van de zaal</b></span><span class="tel">' + esc(zaalSpel) + '</span></button>' : '') +
      tweede.map(([k, n, t2]) => '<button class="rij-item" data-zaal2="' + k + '" type="button"><span><b>' + n + '</b></span><span class="tel">' + t2 + '</span></button>').join('') +
      Object.entries(KAST).map(([k, n]) =>
        '<button class="rij-item" data-kast="' + k + '" type="button"><span><b>' + n + '</b></span><span class="tel">aan de speeltafel</span></button>').join('') +
      '<button class="knop2 stil2" id="kiesWeg" type="button" style="margin-top:.9rem;width:100%;">Toch niet</button>';
    $('#kiesWeg').addEventListener('click', () => $('#spelLaag').classList.remove('open'));
    if (zaalSpel) $('#kiesZaal').addEventListener('click', async () => {
      $('#spelLaag').classList.remove('open');
      try {
        await api('/api/residentie/spel/daag', { codenaam, spel: zaalSpel });
        meld('Uitnodiging verstuurd; even wachten op ' + codenaam + '.');
      } catch (e) { meld(e.message); }
    });
    $('#spelKeuze').querySelectorAll('[data-zaal2]').forEach(b2 => b2.addEventListener('click', async () => {
      $('#spelLaag').classList.remove('open');
      try {
        await api('/api/residentie/spel/daag', { codenaam, spel: b2.dataset.zaal2 });
        meld('Uitnodiging verstuurd; even wachten op ' + codenaam + '.');
      } catch (e) { meld(e.message); }
    }));
    $('#spelKeuze').querySelectorAll('[data-kast]').forEach(b2 => b2.addEventListener('click', async () => {
      try {
        const r = await api('/api/member/spel/nieuw', { soort: b2.dataset.kast, codenamen: [codenaam] });
        naarTafel(r.id, KAST[b2.dataset.kast], codenaam);
      } catch (e) { meld(e.message); }
    }));
  }

  // de tafel is gedekt: het potje staat klaar op de speeltafel
  function naarTafel(id, naam, wie) {
    $('#spelKeuze').innerHTML = '<h2>De tafel is gedekt</h2>' +
      '<div class="sub">' + esc(naam) + ' met ' + esc(wie) + ' -- de uitnodiging is onderweg</div>' +
      '<div style="display:flex;gap:.5rem;margin-top:.8rem;">' +
      '<button class="knop2 h-flex1" id="tafelGa" type="button">Naar de speeltafel</button>' +
      '<button class="knop2 stil2 h-flex1" id="tafelHier" type="button">Hier wachten</button></div>';
    $('#spelLaag').classList.add('open');
    $('#tafelGa').addEventListener('click', () => { location.href = '/apps/spelen.html?potje=' + encodeURIComponent(id) + '&pas=rtg'; });
    $('#tafelHier').addEventListener('click', () => $('#spelLaag').classList.remove('open'));
  }

  // een uitnodiging voor de speeltafel komt hier in het hotel binnen; de
  // spelmotor seint ook bij updates van eigen potjes, dus eerst navragen
  // of dit echt een uitnodiging aan u is
  async function bordSein(d) {
    if (!d || !d.potje) return;
    let mijn; try { mijn = await api('/api/member/spel/mijn', {}); } catch (e) { return; }
    const uit = (mijn.uitnodigingen || []).find(u => u.id === d.potje);
    if (!uit) return;
    $('#spelKeuze').innerHTML = '<h2>Een uitnodiging</h2>' +
      '<div class="sub">' + esc(uit.van || 'een lid') + ' vraagt u aan de speeltafel voor een potje ' + esc(uit.naam || KASTNAAM[d.soort] || 'spel') + '</div>' +
      '<div style="display:flex;gap:.5rem;margin-top:.8rem;">' +
      '<button class="knop2 h-flex1" id="bordJa" type="button">Speel mee</button>' +
      '<button class="knop2 stil2 h-flex1" id="bordNee" type="button">Nu even niet</button></div>';
    $('#spelLaag').classList.add('open');
    $('#bordJa').addEventListener('click', async () => {
      try {
        await api('/api/member/spel/antwoord', { id: d.potje, akkoord: true });
        location.href = '/apps/spelen.html?potje=' + encodeURIComponent(d.potje) + '&pas=rtg';
      } catch (e) { meld(e.message); $('#spelLaag').classList.remove('open'); }
    });
    $('#bordNee').addEventListener('click', async () => {
      $('#spelLaag').classList.remove('open');
      try { await api('/api/member/spel/antwoord', { id: d.potje, akkoord: false }); } catch (e) {}
    });
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
      '<p class="h-mt100"><a href="/apps/app.html">Naar de app →</a></p></div>';
  } else {
    const wens = new URLSearchParams(location.search).get('kamer') || 'lobby';
    betreed(wens);
    luister();
    requestAnimationFrame(lus);
  }
  maat();
})();
