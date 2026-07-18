/* ==================== RTG Schermbeeld ====================
   Een klein zwevend knopje, in elke app en op het bureaublad:

   - VOLLEDIG SCHERM: schakelt de app naar volledig scherm en terug (de browser
     staat dit alleen na een tik toe, dus het is bewust een knop). Het icoon
     volgt de echte toestand.
   - DRAAIEN: kantelt het hele beeld 90 graden per tik (0 -> 90 -> 180 -> 270),
     puur met CSS, zodat het in een gedraaide stand past (tablet/kiosk liggend
     of staand). Bij 90/270 wisselen we de maten om, zodat het beeld het scherm
     blijft vullen. De gekozen hoek wordt onthouden en bij de volgende keer
     meteen toegepast.

   Zuivere UI-laag, geen afhankelijkheden. Insluiten met defer. */
(function () {
  'use strict';
  if (window.RTGscherm) return; // niet dubbel
  var STORE = 'rtg_os_draai';
  var hoek = 0;
  try { hoek = (parseInt(localStorage.getItem(STORE), 10) || 0) % 360; } catch (e) {}

  var CSS =
  '.rtg-scherm{position:fixed;right:calc(env(safe-area-inset-right,0px) + 0.7rem);' +
  'bottom:calc(env(safe-area-inset-bottom,0px) + 0.7rem);z-index:2147483000;display:flex;gap:0.35rem;' +
  'padding:0.3rem;border-radius:999px;background:rgba(18,16,15,0.72);backdrop-filter:blur(12px);' +
  'border:1px solid rgba(255,255,255,0.12);box-shadow:0 8px 24px rgba(0,0,0,0.4);}' +
  '.rtg-scherm button{width:2.1rem;height:2.1rem;border-radius:50%;border:none;cursor:pointer;' +
  'background:none;color:#F4F1EC;display:flex;align-items:center;justify-content:center;' +
  'font-size:1rem;line-height:1;transition:background 0.13s;}' +
  '.rtg-scherm button:hover{background:rgba(255,255,255,0.1);}' +
  '.rtg-scherm button:focus-visible{outline:2px solid #A98F1C;outline-offset:2px;}' +
  '@media print{.rtg-scherm{display:none;}}';

  function stijl() {
    var s = document.createElement('style');
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  // ---- volledig scherm ----
  function volledigActief() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  function volledigWissel() {
    var d = document;
    if (volledigActief()) {
      (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d);
    } else {
      var e = d.documentElement;
      (e.requestFullscreen || e.webkitRequestFullscreen || function () {}).call(e);
    }
  }

  // ---- draaien (CSS) ----
  function pasHoekToe() {
    var el = document.documentElement;
    var st = el.style;
    if (!hoek) {
      st.transform = ''; st.transformOrigin = ''; st.position = '';
      st.top = ''; st.left = ''; st.width = ''; st.height = ''; st.overflow = '';
      return;
    }
    var kwart = (hoek === 90 || hoek === 270);
    st.position = 'fixed'; st.top = '50%'; st.left = '50%';
    st.width = kwart ? '100vh' : '100vw';
    st.height = kwart ? '100vw' : '100vh';
    st.overflow = 'auto';
    st.transformOrigin = '50% 50%';
    st.transform = 'translate(-50%,-50%) rotate(' + hoek + 'deg)';
  }
  function draai() {
    hoek = (hoek + 90) % 360;
    try { localStorage.setItem(STORE, String(hoek)); } catch (e) {}
    pasHoekToe();
  }

  function knop(label, svg, doe) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = svg;
    b.addEventListener('click', doe);
    return b;
  }

  var SVG_VOL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
  var SVG_UIT = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M16 21v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
  var SVG_DRAAI = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>';

  function bouw() {
    stijl();
    var balk = document.createElement('div');
    balk.className = 'rtg-scherm';
    balk.setAttribute('role', 'group');
    balk.setAttribute('aria-label', 'Scherm');
    var vol = knop('Volledig scherm', SVG_VOL, volledigWissel);
    balk.appendChild(knop('Beeld draaien', SVG_DRAAI, draai));
    balk.appendChild(vol);
    document.body.appendChild(balk);
    document.addEventListener('fullscreenchange', function () {
      var aan = !!volledigActief();
      vol.innerHTML = aan ? SVG_UIT : SVG_VOL;
      vol.setAttribute('aria-label', aan ? 'Volledig scherm sluiten' : 'Volledig scherm');
      vol.title = vol.getAttribute('aria-label');
    });
    if (hoek) pasHoekToe();
  }

  window.RTGscherm = { volledig: volledigWissel, draai: draai };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bouw);
  else bouw();
})();
