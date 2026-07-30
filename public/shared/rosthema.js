/* Gedeelde ROS-thema-kiezer voor de kantoor- en PDA-schermen (staat los van het
   leden-OS, dat zijn eigen bedieningspaneel heeft). Dezelfde drie thema's
   (Champagne / Donker / Bordeaux) en dezelfde opslagsleutel als het leden-OS,
   zodat je keuze meereist tussen al je RTG-schermen. Zet het attribuut op <html>
   (waardoor shared/rosthema.css de tokens omkleurt), stuurt de levende grond
   (shared/levendekleur.js) aan, en zet een zwevende kleurenkiezer linksonder.
   Geen keuze? Dan Bordeaux (rood), de huiskleur. */
(function (w, d) {
  'use strict';
  if (w.RTGRosThema) return;
  var KEY = 'rtg_ros_thema';
  var THEMAS = [
    { id: 'parelmoer', naam: 'Champagne', stip: 'linear-gradient(135deg,#F3EBDA,#E4CF9E)' },
    { id: 'standaard', naam: 'Donker', stip: 'linear-gradient(135deg,#2A2724,#0C0C0B)' },
    { id: 'bordeaux', naam: 'Bordeaux', stip: 'linear-gradient(135deg,#9E1C40,#4A0C1E)' }
  ];
  function huidig() {
    try { var t = localStorage.getItem(KEY); if (t === 'standaard' || t === 'bordeaux' || t === 'parelmoer') return t; } catch (e) {}
    return 'bordeaux';
  }
  function pas(t) {
    var el = d.documentElement;
    if (t === 'standaard') el.removeAttribute('data-pas-thema'); else el.setAttribute('data-pas-thema', t);
    var kleur = { bordeaux: '#1E0912', parelmoer: '#ECE6DD' }[t] || '#0C0C0B';
    var meta = d.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', kleur);
    if (w.RTGLevend) w.RTGLevend.familie();
  }
  function zet(t) { try { localStorage.setItem(KEY, t); } catch (e) {} pas(t); }
  /* Hier stond merk(): dat zette de 'actief'-klasse op de knoppen in #rosThema.
     Dat kiezertje dreef als los kaartje linksonder en is naar het
     bedieningspaneel verhuisd; sindsdien bestaat #rosThema op geen enkele
     pagina meer en deed merk() bij elke themawissel niets. De blindevlek-toets
     ving het. Het paneel zet de klasse zelf op de stip waarop geklikt is
     (vulThema in shared/bediening.js) en leest bij elke opening opnieuw uit
     huidig(), dus er is niets om over te nemen. */
  function start() {
    // de levende grond aan de pagina hangen (als er nog geen doel is aangewezen)
    if (!d.querySelector('[data-levendegrond]') && d.body) d.body.setAttribute('data-levendegrond', '');
    pas(huidig());
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
  // De kleurstippen dreven als los kiezertje linksonder, boven op de taalknop en
  // het vraagteken. Ze staan nu in het bedieningspaneel (shared/bediening.js),
  // dat de thema's hier ophaalt en zet.
  w.RTGRosThema = { huidig: huidig, zet: zet, themas: THEMAS };
})(window, document);
