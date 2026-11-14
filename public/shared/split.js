/* RTG Split: twee apps naast elkaar. Vanuit de instellingen splits je het scherm
   door het midden en open je twee RTG-schermen tegelijk. De scheiding is te
   verslepen (het ene paneel groter, het andere kleiner), en je kiest per kant
   welke app. Op een telefoon in de hand kun je wisselen tussen naast elkaar en
   boven elkaar. Alles op het toestel; elke kant is een gewoon RTG-scherm.

   Gebruik: RTGSplit.open(); (bijv. vanuit het bedieningspaneel). */
(function (w, d) {
  'use strict';
  if (w.RTGSplit) return;
  if (d && d.documentElement && !d.documentElement.hasAttribute('data-ds') && !d.getElementById('rtgDsRuntimeCss')) {
    var link = d.createElement('link');
    link.id = 'rtgDsRuntimeCss'; link.rel = 'stylesheet'; link.href = '/ds/rtg-ds.css';
    d.head.appendChild(link);
  }
  var SLEUTEL = 'rtg_split';
  // alle ROS-schermen die je naast elkaar kunt zetten: dezelfde gedeelde lijst
  // als de flagship- en bureau-widgets (shared/rosapps.js), met een terugval
  var APPS = (w.RTGApps && w.RTGApps.length) ? w.RTGApps : [
    { naam: 'Beginscherm', url: '/apps/app.html' },
    { naam: 'De Salon', url: '/apps/app.html#salon' },
    { naam: 'RTG Mall', url: '/apps/mall.html' },
      { naam: 'De Résidence', url: '/apps/residentie.html' },
    { naam: 'Food Court', url: '/apps/foodcourt.html' },
    { naam: 'RTG OV', url: '/apps/ov.html' },
    { naam: 'RTG Media', url: '/apps/media.html' },
    { naam: 'RTG Clips', url: '/apps/clips.html' },
    { naam: 'RTG Podium', url: '/apps/podium.html' },
    { naam: 'RTG Eye', url: '/apps/oog.html' },
    { naam: 'RTG Flits', url: '/apps/flits.html' },
    { naam: 'Spelen', url: '/apps/spelen.html' }
  ];

  function laad() {
    try { var s = JSON.parse(localStorage.getItem(SLEUTEL)); if (s && s.a && s.b) return s; } catch (e) {}
    return { a: APPS[2].url, b: APPS[3].url, ratio: 0.5, richting: (w.innerWidth < 620 ? 'boven' : 'naast') };
  }
  function bewaar(s) { try { localStorage.setItem(SLEUTEL, JSON.stringify(s)); } catch (e) {} }

  var staat = null, ov = null, focusVoorOpen = null;

  function kies(url, kant) {
    var s = d.createElement('select');
    APPS.forEach(function (a) {
      var o = d.createElement('option'); o.value = a.url; o.textContent = a.naam;
      if (a.url === url) o.selected = true; s.appendChild(o);
    });
    s.setAttribute('aria-label', 'Kies de app voor ' + (kant === 'a' ? 'de linkerkant' : 'de rechterkant'));
    s.addEventListener('change', function () { staat[kant] = s.value; bewaar(staat); frame(kant).src = s.value; });
    return s;
  }
  function frame(kant) { return ov.querySelector('.sp-paneel[data-kant="' + kant + '"] iframe'); }

  function paneel(kant) {
    var p = d.createElement('div'); p.className = 'sp-paneel'; p.dataset.kant = kant;
    var kop = d.createElement('div'); kop.className = 'sp-kop'; kop.appendChild(kies(staat[kant], kant));
    var f = d.createElement('iframe');
    window.RTGMedia.kader(f);   // camera/microfoon doorgeven; tekst in shared/media.js
    f.src = staat[kant];
    f.setAttribute('title', kant === 'a' ? 'Linkerscherm' : 'Rechterscherm');
    p.appendChild(kop); p.appendChild(f);
    return p;
  }

  function pasRatio() {
    var pa = ov.querySelector('.sp-paneel[data-kant="a"]');
    var pb = ov.querySelector('.sp-paneel[data-kant="b"]');
    var r = Math.max(0.2, Math.min(0.8, staat.ratio));
    ov.style.setProperty('--ds-split-a', String(r));
    ov.style.setProperty('--ds-split-b', String(1 - r));
    var greep = ov.querySelector('.sp-greep');
    if (greep) greep.setAttribute('aria-valuenow', String(Math.round(r * 100)));
  }

  function bouwVlak() {
    var vlak = ov.querySelector('.sp-vlak');
    vlak.innerHTML = '';
    vlak.className = 'sp-vlak ' + (staat.richting === 'boven' ? 'boven' : 'naast');
    vlak.appendChild(paneel('a'));
    var greep = d.createElement('div'); greep.className = 'sp-greep'; greep.setAttribute('role', 'separator');
    greep.setAttribute('aria-label', 'Versleep om de schermen groter of kleiner te maken');
    greep.tabIndex = 0; greep.setAttribute('aria-valuemin', '20'); greep.setAttribute('aria-valuemax', '80');
    greep.setAttribute('aria-orientation', staat.richting === 'boven' ? 'horizontal' : 'vertical');
    vlak.appendChild(greep);
    vlak.appendChild(paneel('b'));
    pasRatio();
    sleep(greep, vlak);
  }

  function sleep(greep, vlak) {
    greep.addEventListener('keydown', function (e) {
      var stap = e.shiftKey ? 0.1 : 0.05;
      var min = staat.richting === 'boven' ? 'ArrowUp' : 'ArrowLeft';
      var plus = staat.richting === 'boven' ? 'ArrowDown' : 'ArrowRight';
      if (e.key !== min && e.key !== plus) return;
      e.preventDefault(); staat.ratio += e.key === plus ? stap : -stap;
      staat.ratio = Math.max(0.2, Math.min(0.8, staat.ratio)); pasRatio(); bewaar(staat);
    });
    greep.addEventListener('pointerdown', function (e) {
      e.preventDefault(); try { greep.setPointerCapture(e.pointerId); } catch (x) {}
      function beweeg(ev) {
        var r = vlak.getBoundingClientRect();
        var rat = staat.richting === 'boven' ? (ev.clientY - r.top) / r.height : (ev.clientX - r.left) / r.width;
        staat.ratio = Math.max(0.2, Math.min(0.8, rat)); pasRatio();
      }
      function los() { d.removeEventListener('pointermove', beweeg); d.removeEventListener('pointerup', los); bewaar(staat); }
      d.addEventListener('pointermove', beweeg); d.addEventListener('pointerup', los);
    });
  }

  function open() {
    if (ov) return;
    focusVoorOpen = d.activeElement;
    staat = laad();
    ov = d.createElement('div'); ov.id = 'rtgSplit'; ov.className = 'ds-split';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Twee schermen naast elkaar');
    ov.innerHTML =
      '<div class="sp-balk"><span class="sp-titel">Twee naast elkaar</span>' +
        '<button type="button" id="spDraai">Draaien</button>' +
        '<button type="button" id="spWissel">Wisselen</button>' +
        '<button type="button" class="sp-x" id="spSluit" aria-label="Sluiten">&times;</button></div>' +
      '<div class="sp-vlak"></div>';
    d.body.appendChild(ov);
    bouwVlak();
    ov.querySelector('#spSluit').addEventListener('click', sluit);
    ov.querySelector('#spDraai').addEventListener('click', function () {
      staat.richting = staat.richting === 'boven' ? 'naast' : 'boven'; bewaar(staat); bouwVlak();
    });
    ov.querySelector('#spWissel').addEventListener('click', function () {
      var t = staat.a; staat.a = staat.b; staat.b = t; bewaar(staat); bouwVlak();
    });
    d.addEventListener('keydown', esc);
    ov.querySelector('#spSluit').focus();
  }
  function esc(e) { if (e.key === 'Escape') sluit(); }
  function sluit() {
    d.removeEventListener('keydown', esc);
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    ov = null;
    var terug = focusVoorOpen; focusVoorOpen = null;
    if (terug && terug.isConnected && typeof terug.focus === 'function') terug.focus();
  }

  w.RTGSplit = { open: open, sluit: sluit };
})(window, document);
