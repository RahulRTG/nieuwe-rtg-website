/* ---------- de kantoorvleugel van de zaak (kantoren-niveau) ----------
   De week als 3D-skyline op de huiseigen Drie-motor, voor ELKE partner in
   elk genre, bovenop de eigen backoffice: vandaag in bordeaux, een gouden
   pin op de beste dag; zonder WebGL verdwijnt de kaart stil. Losstaand
   naast de bundel; de app geeft bij het binden zijn eigen context door
   (cijfers, i18n, huisfuncties). Het drukklare Weekrapport zit in
   leverancier-zaak-rapport.js en krijgt dezelfde context. */
(function(){
  'use strict';
  let ctx = null;
  let z3dCanvas = null, z3dR = null, z3dHoek = 0.85, z3dKantel = 0.5, z3dSleep = null, z3dDraai = true, z3dLus = false;
  const T = (k, nl) => (ctx && ctx.T) ? ctx.T(k, nl) : nl;

  function zaak3dTeken(){
    const canvas = document.getElementById('zaak3d');
    const bo = ctx && ctx.boData;
    if (!canvas || !window.Drie || !Drie.maakRenderer || !bo || bo.error) return;
    if (canvas !== z3dCanvas){
      // de sectie is opnieuw getekend: een verse renderer op het verse canvas
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const b2 = canvas.clientWidth || 520;
      canvas.width = Math.round(b2 * dpr);
      canvas.height = Math.round(b2 * 0.52 * dpr);
      z3dCanvas = canvas;
      z3dR = Drie.maakRenderer(canvas, {});
      if (!z3dR){ const k = document.getElementById('zaak3dKaart'); if (k) k.style.display = 'none'; return; }
      canvas.addEventListener('pointerdown', e => { z3dSleep = { x: e.clientX, y: e.clientY }; z3dDraai = false; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', e => {
        if (!z3dSleep) return;
        z3dHoek += (e.clientX - z3dSleep.x) * 0.008;
        z3dKantel = Math.min(1.25, Math.max(0.15, z3dKantel + (e.clientY - z3dSleep.y) * 0.005));
        z3dSleep = { x: e.clientX, y: e.clientY };
      });
      canvas.addEventListener('pointerup', () => { z3dSleep = null; });
    }
    const week = (bo.week || []);
    if (!week.length || !z3dR) return;
    const max2 = Math.max.apply(null, week.map(d => d.omzet).concat([1]));
    const topIx = week.reduce((bi, d, i) => (d.omzet > week[bi].omzet ? i : bi), 0);
    z3dR.wis();
    z3dR.voegToe(Drie.vlak(24, [0.055, 0.055, 0.052]), { raster: true });
    const m2 = Drie.leegMesh();
    week.forEach((d, i) => {
      const cx = (i - (week.length - 1) / 2) * 4.6;
      const h2 = 0.6 + (d.omzet / max2) * 9;
      // vandaag in bordeaux, de rest in gedempt goud -- de huiskleuren
      Drie.doos(m2, cx, 0, 3, h2, 3, i === week.length - 1 ? [0.5, 0.09, 0.2] : [0.42, 0.36, 0.13], true);
      if (i === topIx && d.omzet > 0) Drie.pin(m2, cx, 0, h2 + 1.6, [0.96, 0.82, 0.32]);
    });
    z3dR.voegToe(m2, {});
    const uitleg2 = document.getElementById('zaak3dUitleg');
    if (uitleg2) uitleg2.textContent = T('z3.uitleg', 'Uw week als skyline: hoe hoger het blok, hoe meer omzet. Vandaag in bordeaux, de gouden pin staat op uw beste dag. Slepen om te draaien.');
    if (!z3dLus){
      z3dLus = true;
      (function lus(){
        if (z3dDraai) z3dHoek += 0.0025;
        if (z3dR && z3dCanvas && z3dCanvas.isConnected){
          const oog = [Math.cos(z3dHoek) * 26 * Math.cos(z3dKantel), Math.sin(z3dKantel) * 26, Math.sin(z3dHoek) * 26 * Math.cos(z3dKantel)];
          try { z3dR.teken(oog, [0, 3, 0]); } catch(e){}
        }
        requestAnimationFrame(lus);
      })();
    }
  }

  // de app roept dit bij elke bo-render aan en geeft zijn verse context mee
  window.RTGZaakKantoor = {
    bind: function(el, c){
      ctx = c || ctx;
      const rb = el.querySelector('#boRapport');
      if (rb) rb.addEventListener('click', () => { if (window.RTGZaakRapport) RTGZaakRapport.open(ctx); });
      zaak3dTeken();
    }
  };
})();
