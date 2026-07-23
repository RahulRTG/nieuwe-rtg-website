/* RTG Split: twee apps naast elkaar. Vanuit de instellingen splits je het scherm
   door het midden en open je twee RTG-schermen tegelijk. De scheiding is te
   verslepen (het ene paneel groter, het andere kleiner), en je kiest per kant
   welke app. Op een telefoon in de hand kun je wisselen tussen naast elkaar en
   boven elkaar. Alles op het toestel; elke kant is een gewoon RTG-scherm.

   Gebruik: RTGSplit.open(); (bijv. vanuit het bedieningspaneel). */
(function (w, d) {
  'use strict';
  if (w.RTGSplit) return;
  var SLEUTEL = 'rtg_split';
  // alle ROS-schermen die je naast elkaar kunt zetten: dezelfde gedeelde lijst
  // als de flagship- en bureau-widgets (shared/rosapps.js), met een terugval
  var APPS = (w.RTGApps && w.RTGApps.length) ? w.RTGApps : [
    { naam: 'Beginscherm', url: '/apps/index.html' },
    { naam: 'De Salon', url: '/apps/app.html#salon' },
    { naam: 'RTG Mall', url: '/apps/mall.html' },
    { naam: 'Food Court', url: '/apps/foodcourt.html' },
    { naam: 'RTG OV', url: '/apps/ov.html' },
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

  function stijl() {
    if (d.getElementById('rtgSplitCss')) return;
    var st = d.createElement('style'); st.id = 'rtgSplitCss';
    st.textContent =
      '#rtgSplit{position:fixed;inset:0;z-index:300;background:var(--bg,#0C0C0B);display:flex;flex-direction:column;' +
        'padding-top:env(safe-area-inset-top,0px);}' +
      '#rtgSplit .sp-balk{display:flex;align-items:center;gap:.5rem;padding:.4rem .6rem;flex:0 0 auto;' +
        'border-bottom:1px solid var(--line,rgba(255,255,255,.1));background:var(--card,#151312);}' +
      '#rtgSplit .sp-balk .sp-titel{font-family:"Bodoni Moda",serif;font-size:.9rem;color:var(--txt,#F4F1EC);margin-right:auto;}' +
      '#rtgSplit .sp-balk button{font-family:Inter,system-ui,sans-serif;font-size:.72rem;font-weight:600;color:var(--txt,#F4F1EC);' +
        'background:var(--card2,#1B1817);border:1px solid var(--line,rgba(255,255,255,.14));border-radius:999px;padding:.35rem .7rem;cursor:pointer;}' +
      '#rtgSplit .sp-balk button.sp-x{background:none;}' +
      '#rtgSplit .sp-vlak{flex:1 1 auto;display:flex;min-height:0;min-width:0;}' +
      '#rtgSplit .sp-vlak.boven{flex-direction:column;}' +
      '#rtgSplit .sp-paneel{position:relative;min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column;background:var(--bg,#0C0C0B);}' +
      '#rtgSplit .sp-kop{display:flex;align-items:center;gap:.4rem;padding:.3rem .5rem;flex:0 0 auto;background:var(--card,#151312);' +
        'border-bottom:1px solid var(--line,rgba(255,255,255,.08));}' +
      '#rtgSplit .sp-kop select{flex:1;min-width:0;font-family:Inter,system-ui,sans-serif;font-size:.74rem;color:var(--txt,#F4F1EC);' +
        'background:var(--card2,#1B1817);border:1px solid var(--line,rgba(255,255,255,.14));border-radius:8px;padding:.3rem .4rem;}' +
      '#rtgSplit iframe{flex:1 1 auto;width:100%;height:100%;border:0;background:var(--bg,#0C0C0B);}' +
      '#rtgSplit .sp-greep{flex:0 0 auto;background:var(--line,rgba(255,255,255,.14));position:relative;touch-action:none;}' +
      '#rtgSplit .sp-vlak.naast > .sp-greep{width:10px;cursor:col-resize;}' +
      '#rtgSplit .sp-vlak.boven > .sp-greep{height:10px;cursor:row-resize;}' +
      '#rtgSplit .sp-greep::after{content:"";position:absolute;inset:0;margin:auto;background:var(--soft,#8A8680);border-radius:999px;}' +
      '#rtgSplit .sp-vlak.naast > .sp-greep::after{width:3px;height:34px;}' +
      '#rtgSplit .sp-vlak.boven > .sp-greep::after{height:3px;width:34px;}';
    d.head.appendChild(st);
  }

  var staat = null, ov = null;

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
    var f = d.createElement('iframe'); f.src = staat[kant];
    f.setAttribute('title', kant === 'a' ? 'Linkerscherm' : 'Rechterscherm');
    p.appendChild(kop); p.appendChild(f);
    return p;
  }

  function pasRatio() {
    var pa = ov.querySelector('.sp-paneel[data-kant="a"]');
    var pb = ov.querySelector('.sp-paneel[data-kant="b"]');
    var r = Math.max(0.2, Math.min(0.8, staat.ratio));
    pa.style.flex = r + ' 1 0'; pb.style.flex = (1 - r) + ' 1 0';
  }

  function bouwVlak() {
    var vlak = ov.querySelector('.sp-vlak');
    vlak.innerHTML = '';
    vlak.className = 'sp-vlak ' + (staat.richting === 'boven' ? 'boven' : 'naast');
    vlak.appendChild(paneel('a'));
    var greep = d.createElement('div'); greep.className = 'sp-greep'; greep.setAttribute('role', 'separator');
    greep.setAttribute('aria-label', 'Versleep om de schermen groter of kleiner te maken');
    vlak.appendChild(greep);
    vlak.appendChild(paneel('b'));
    pasRatio();
    sleep(greep, vlak);
  }

  function sleep(greep, vlak) {
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
    staat = laad(); stijl();
    ov = d.createElement('div'); ov.id = 'rtgSplit';
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
  }
  function esc(e) { if (e.key === 'Escape') sluit(); }
  function sluit() {
    d.removeEventListener('keydown', esc);
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    ov = null;
  }

  w.RTGSplit = { open: open, sluit: sluit };
})(window, document);
