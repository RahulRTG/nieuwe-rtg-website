/* Gedeelde ROS-thema-kiezer voor de kantoor- en PDA-schermen (staat los van het
   leden-OS, dat zijn eigen bedieningspaneel heeft). Dezelfde drie thema's
   (Champagne / Donker / Bordeaux) en dezelfde opslagsleutel als het leden-OS,
   zodat je keuze meereist tussen al je RTG-schermen. Zet het attribuut op <html>
   (waardoor shared/rosthema.css de tokens omkleurt), stuurt de levende grond
   (shared/levendekleur.js) aan, en zet een zwevende kleurenkiezer linksonder.
   Geen keuze? Dan het vertrouwde donker. */
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
    return 'standaard';
  }
  function pas(t) {
    var el = d.documentElement;
    if (t === 'standaard') el.removeAttribute('data-pas-thema'); else el.setAttribute('data-pas-thema', t);
    var kleur = { bordeaux: '#1E0912', parelmoer: '#ECE6DD' }[t] || '#0C0C0B';
    var meta = d.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', kleur);
    if (w.RTGLevend) w.RTGLevend.familie();
    merk();
  }
  function zet(t) { try { localStorage.setItem(KEY, t); } catch (e) {} pas(t); }
  function merk() {
    var box = d.getElementById('rosThema'); if (!box) return;
    var nu = huidig();
    box.querySelectorAll('button').forEach(function (b) { b.classList.toggle('actief', b.dataset.thema === nu); });
  }
  function bouwKiezer() {
    if (d.getElementById('rosThema')) return;
    var box = d.createElement('div'); box.id = 'rosThema'; box.className = 'ros-thema';
    box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Kleurthema kiezen');
    THEMAS.forEach(function (t) {
      var b = d.createElement('button'); b.type = 'button'; b.dataset.thema = t.id;
      b.style.background = t.stip; b.setAttribute('aria-label', 'Thema ' + t.naam); b.title = t.naam;
      b.addEventListener('click', function () { zet(t.id); });
      box.appendChild(b);
    });
    d.body.appendChild(box);
    merk();
  }
  function start() {
    // de levende grond aan de pagina hangen (als er nog geen doel is aangewezen)
    if (!d.querySelector('[data-levendegrond]') && d.body) d.body.setAttribute('data-levendegrond', '');
    pas(huidig());
    bouwKiezer();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
  w.RTGRosThema = { huidig: huidig, zet: zet };
})(window, document);
