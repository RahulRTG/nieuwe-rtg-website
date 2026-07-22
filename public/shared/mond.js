/* De RTG-signatuurmond: EEN mond voor het hele systeem. Duizenden bewegende
   lichtpuntjes op een eigen canvas (geen extern beeld): bordeaux als basis,
   goud erdoorheen geweven, een enkel wit puntje als glinstering, en een gouden
   lichtgolf die om de paar seconden door de lippen trekt. De onderlip beweegt
   mee als Rahul "praat". Wie minder beweging wil (prefers-reduced-motion),
   krijgt een stilstaand beeld.

   Gebruik: geef een <canvas width="440" height="200"> mee; het CSS bepaalt de
   getoonde maat. RTGMond.maak(canvas) tekent en geeft { praat(ms) } terug om
   de onderlip kort te laten bewegen. Het tekenen pauzeert vanzelf zodra het
   canvas uit beeld is (offsetParent === null), dus het is goedkoop als het
   niet zichtbaar is. */
(() => {
  if (window.RTGMond) return;
  const RUSTIG = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function maak(canvas) {
    if (!canvas || canvas.dataset.rtgMondActief) return { praat() {} };
    canvas.dataset.rtgMondActief = '1';
    const mctx = canvas.getContext('2d');
    const PUNTEN = [];
    (function zaai() {
      // de lipvormen als functies: de middellijn met cupidoboog, de boog van de
      // bovenlip en de boog van de onderlip (mondhoeken op x=50 en x=170)
      const midden = x => 52 - 6 * Math.exp(-Math.pow(x - 110, 2) / 98);
      const boven = x => { const t = (x - 110) / 60; return 52 - 24 * Math.pow(Math.max(0, 1 - t * t), 0.8) + 7 * Math.exp(-Math.pow(x - 110, 2) / 72); };
      const onder = x => { const t = (x - 110) / 60; return 52 + 27 * Math.pow(Math.max(0, 1 - t * t), 0.9); };
      for (let i = 0; i < 2400; i++) {
        const lip = Math.random() < 0.45 ? 'b' : 'o';
        const x = 50 + Math.random() * 120;
        const y1 = lip === 'b' ? boven(x) : midden(x), y2 = lip === 'b' ? midden(x) : onder(x);
        if (y2 - y1 < 0.8) continue;
        const r = Math.random();
        PUNTEN.push({ x, y: y1 + Math.random() * (y2 - y1), lip,
          fase: Math.random() * Math.PI * 2, maat: 0.5 + Math.random() * 0.9,
          kleur: r < 0.62 ? '#9E1C40' : (r < 0.9 ? '#C9A24B' : '#FFFFFF'),
          diep: (y2 - y1) > 0 ? ((y1 + (y2 - y1) / 2) - y1) / (y2 - y1) : 0 });
      }
      // de gouden middellijn loopt door tot voorbij de mondhoeken en vervaagt
      for (let i = 0; i < 420; i++) {
        const x = 14 + Math.random() * 192;
        PUNTEN.push({ x, y: midden(Math.min(170, Math.max(50, x))) + (Math.random() - 0.5) * 1.6,
          lip: 'm', fase: Math.random() * Math.PI * 2, maat: 0.4 + Math.random() * 0.7,
          kleur: '#C9A24B', rand: Math.min(1, Math.min(x - 14, 206 - x) / 55), diep: 0 });
      }
    })();

    let praatTot = 0;
    const praat = ms => { praatTot = performance.now() + ms; };
    function verf(t) {
      mctx.clearRect(0, 0, 440, 200);
      mctx.save();
      mctx.scale(2, 2);
      const golf = ((t / 4200) % 1) * 260 - 20; // de lichtshow: een gouden golf
      const spreek = t < praatTot ? Math.sin(t / 1000 * Math.PI * 4.4) : 0;
      for (const p of PUNTEN) {
        const gloed = Math.exp(-Math.pow(p.x - golf, 2) / 420);
        const twinkel = 0.45 + 0.4 * Math.sin(p.fase + t / 700);
        mctx.globalAlpha = Math.min(1, twinkel * (p.rand == null ? 1 : p.rand) + gloed * 0.9);
        mctx.fillStyle = gloed > 0.45 ? '#F5E6B8' : p.kleur;
        mctx.fillRect(p.x, p.lip === 'o' ? p.y + spreek * 4 * p.diep : p.y, p.maat, p.maat);
      }
      mctx.restore();
    }

    if (RUSTIG) verf(0);
    else (function lus() {
      // alleen verven zolang het canvas in beeld is; daarna zuinig wachten
      if (canvas.offsetParent) { verf(performance.now()); requestAnimationFrame(lus); }
      else setTimeout(lus, 600);
    })();

    return { praat };
  }

  window.RTGMond = { maak };
})();
