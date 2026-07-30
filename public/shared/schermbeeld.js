/* ==================== RTG Schermbeeld ====================
   Twee handelingen die over het beeld zelf gaan, in elke app en op het
   bureaublad:

   - VOLLEDIG SCHERM: schakelt de app naar volledig scherm en terug (de browser
     staat dit alleen na een tik toe, dus het blijft een knop).
   - DRAAIEN: kantelt het hele beeld 90 graden per tik (0 -> 90 -> 180 -> 270),
     puur met CSS, zodat het in een gedraaide stand past (tablet/kiosk liggend
     of staand). Bij 90/270 wisselen we de maten om, zodat het beeld het scherm
     blijft vullen. De gekozen hoek wordt onthouden en meteen toegepast.

   Deze module tekent zelf niets meer. Ze stonden als zwevende pil rechtsboven
   op elk scherm; nu staan ze bij de andere schermdingen in het
   bedieningspaneel (shared/bediening.js), dat ze via window.RTGscherm bedient.
   Het leden-OS deed dat allang zo, met tegels in zijn eigen paneel.

   Zuivere UI-laag, geen afhankelijkheden. Insluiten met defer. */
(function () {
  'use strict';
  if (window.RTGscherm) return; // niet dubbel
  var STORE = 'rtg_os_draai';
  var hoek = 0;
  try { hoek = (parseInt(localStorage.getItem(STORE), 10) || 0) % 360; } catch (e) {}

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

  function bouw() {
    // "Beeld draaien" en "Volledig scherm" stonden als zwevende pil rechtsboven
    // op elk scherm. Het leden-OS deed dat al niet: daar zitten ze als tegels in
    // het bedieningspaneel. Dat geldt nu overal -- shared/bediening.js zet ze in
    // hetzelfde paneel als taal, weergave en beweging, en roept ze aan via
    // window.RTGscherm. Hier tekenen we dus niets meer; alleen een eerder
    // gekozen hoek passen we meteen toe.
    if (hoek) pasHoekToe();
  }

  window.RTGscherm = {
    volledig: volledigWissel, draai: draai,
    // zodat het paneel kan tonen of volledig scherm aan of uit staat
    volledigAan: function () { return !!volledigActief(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bouw);
  else bouw();
})();
