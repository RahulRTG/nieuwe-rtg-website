
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
