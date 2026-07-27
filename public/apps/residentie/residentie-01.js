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
  const SFEER = { lobby: '#C9A94B', bar: '#C23A5E', bibliotheek: '#B08D3F', terras: '#4A6B8A' };

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
