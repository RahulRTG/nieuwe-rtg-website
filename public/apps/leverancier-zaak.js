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

  // presentatiemodus: schermvullend, vanzelf doordraaiend -- voor een
  // wandscherm of het teamoverleg; sluiten met Escape of de sluitknop
  let presDia = 0, presKlok = null;
  function presStop(){
    const o = document.getElementById('zaakPresOverlay');
    if (o) o.remove();
    if (presKlok){ clearInterval(presKlok); presKlok = null; }
    document.removeEventListener('keydown', presToets);
  }
  function presToets(e){ if (e.key === 'Escape') presStop(); }
  function presEsc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function presDias(){
    const b3 = ctx && ctx.boData; if (!b3 || b3.error) return [];
    const eur2 = c => (ctx && ctx.eur) ? ctx.eur(c) : '€ ' + (Number(c || 0) / 100).toFixed(2);
    const maxW = Math.max.apply(null, b3.week.map(d => d.omzet).concat([1]));
    const kpiRij = [[T('bz.today','Omzet vandaag'), eur2(b3.stats.omzetVandaag)], [T('bz.trans','Transacties'), b3.stats.transactiesVandaag],
      [T('bz.week','Weekomzet'), eur2(b3.stats.omzetWeek)], [T('bz.binnen','Nu ingeklokt'), b3.stats.binnenNu]];
    const dias = [];
    dias.push('<div class="zp-kpis">' + kpiRij.map(x => '<div><b>' + x[1] + '</b><span>' + x[0] + '</span></div>').join('') + '</div>');
    dias.push('<h2>' + T('bz.weekh','Omzet per dag') + '</h2><div class="zp-staaf">' +
      b3.week.map(d => '<div><i style="height:' + Math.max(2, Math.round(d.omzet / maxW * 100)) + '%"></i><span>' + presEsc(d.label) + '</span></div>').join('') + '</div>');
    if ((b3.toppers || []).length) dias.push('<h2>' + T('bz.top','Toppers') + '</h2>' +
      b3.toppers.slice(0, 5).map(t3 => '<div class="zp-rij"><b>' + presEsc(t3.naam) + '</b><span>' + t3.aantal + 'x</span></div>').join(''));
    if (b3.briefing) dias.push('<h2>' + T('bz.brief','Dagbriefing') + '</h2><p class="zp-tekst">' + presEsc(b3.briefing) + '</p>');
    const m3 = ctx.vwData && ctx.vwData.ok && ctx.vwData.morgen;
    if (m3) dias.push('<h2>' + T('vw.h','Verwachting voor morgen') + '</h2><p class="zp-tekst">' +
      m3.verwachtTransacties + ' ' + T('vw.trans','transacties') + ' &middot; ' + eur2(m3.verwachtCenten) + ' (' + presEsc(m3.dagNaam) + ')' +
      (m3.advies ? '<br>' + presEsc(m3.advies) : '') + '</p>');
    return dias;
  }
  function presTeken(){
    const vlak = document.getElementById('zaakPresVlak');
    const dias = presDias();
    if (!vlak || !dias.length) return;
    presDia = presDia % dias.length;
    vlak.innerHTML = dias[presDia];
  }
  function zaakPresentatie(){
    const b3 = ctx && ctx.boData;
    if (!b3 || b3.error){ if (ctx && ctx.toast) ctx.toast(T('z3.geen', 'De backoffice is nog aan het laden.')); return; }
    presStop();
    const S2 = ctx.S;
    const naam3 = (S2 && (S2.name || S2.naam)) || (S2 && S2.code) || '';
    const o = document.createElement('div');
    o.id = 'zaakPresOverlay';
    o.innerHTML = '<style>' +
      '#zaakPresOverlay{position:fixed;inset:0;z-index:9000;background:#0C0C0B;color:#F4F1EC;display:flex;flex-direction:column;font-family:"Inter",system-ui,sans-serif;}' +
      '#zaakPresOverlay .zp-kop{display:flex;justify-content:space-between;align-items:center;padding:1.1rem 1.6rem;border-bottom:1px solid rgba(244,241,236,.14);}' +
      '#zaakPresOverlay .zp-kop b{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;font-size:1.15rem;letter-spacing:.02em;}' +
      '#zaakPresOverlay .zp-kop button{background:none;border:1px solid rgba(244,241,236,.3);color:#F4F1EC;border-radius:999px;padding:.35rem 1rem;font:inherit;font-size:.8rem;cursor:pointer;}' +
      '#zaakPresVlak{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:1.2rem;padding:2rem;text-align:center;}' +
      '#zaakPresVlak h2{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;font-size:clamp(1.4rem,3.5vw,2.4rem);}' +
      '#zaakPresOverlay .zp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:1.2rem;width:min(60rem,90%);}' +
      '#zaakPresOverlay .zp-kpis b{display:block;font-family:"Bodoni Moda",serif;font-weight:500;font-size:clamp(1.8rem,4.5vw,3.2rem);color:#A98F1C;}' +
      '#zaakPresOverlay .zp-kpis span{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,241,236,.62);}' +
      '#zaakPresOverlay .zp-staaf{display:flex;align-items:flex-end;gap:1rem;height:38vh;width:min(56rem,88%);}' +
      '#zaakPresOverlay .zp-staaf>div{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;gap:.4rem;font-size:.75rem;color:rgba(244,241,236,.62);}' +
      '#zaakPresOverlay .zp-staaf i{display:block;width:100%;max-width:70px;margin:0 auto;background:#A98F1C;border-radius:6px 6px 3px 3px;}' +
      '#zaakPresOverlay .zp-staaf>div:last-child i{background:#7F1634;}' +
      '#zaakPresOverlay .zp-rij{display:flex;justify-content:space-between;gap:2rem;width:min(34rem,86%);font-size:1.05rem;padding:.5rem 0;border-bottom:1px solid rgba(244,241,236,.14);}' +
      '#zaakPresOverlay .zp-tekst{max-width:44rem;font-size:1.05rem;line-height:1.7;color:rgba(244,241,236,.78);}' +
      '</style>' +
      '<div class="zp-kop"><b>' + presEsc(naam3) + '</b>' +
      '<button type="button" id="zaakPresDicht">' + T('z3.sluit','Sluiten') + '</button></div>' +
      '<div id="zaakPresVlak"></div>';
    document.body.appendChild(o);
    o.querySelector('#zaakPresDicht').addEventListener('click', presStop);
    document.addEventListener('keydown', presToets);
    presDia = 0;
    presTeken();
    presKlok = setInterval(() => { presDia++; presTeken(); }, 8000);
  }

  // de app roept dit bij elke bo-render aan en geeft zijn verse context mee
  window.RTGZaakKantoor = {
    bind: function(el, c){
      ctx = c || ctx;
      const rb = el.querySelector('#boRapport');
      if (rb) rb.addEventListener('click', () => { if (window.RTGZaakRapport) RTGZaakRapport.open(ctx); });
      const pb = el.querySelector('#boPresent');
      if (pb) pb.addEventListener('click', zaakPresentatie);
      zaak3dTeken();
    }
  };
})();
