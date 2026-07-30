
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
