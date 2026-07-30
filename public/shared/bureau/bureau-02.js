  /* Van formaat veranderen: sleep aan de hoek rechtsonder. Breder/smaller
     (kleiner/groter) en langer/korter tegelijk, met nette grenzen. De maat
     wordt onthouden, net als de plek. */
  function formaatbaar(el, grip, w) {
    grip.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      var startX = e.clientX, startY = e.clientY;
      var beginW = el.offsetWidth, beginH = el.offsetHeight;
      el.classList.add('pak'); try { grip.setPointerCapture(e.pointerId); } catch (x) {}
      function beweeg(ev) {
        var nw = Math.max(200, Math.min(560, beginW + (ev.clientX - startX)));
        var nh = Math.max(150, Math.min(Math.round(window.innerHeight * 0.9), beginH + (ev.clientY - startY)));
        el.style.width = nw + 'px'; el.style.height = nh + 'px'; el.style.maxHeight = 'none';
      }
      function los() {
        el.classList.remove('pak');
        document.removeEventListener('pointermove', beweeg);
        document.removeEventListener('pointerup', los);
        w.w = el.offsetWidth; w.h = el.offsetHeight;
        bewaar();
      }
      document.addEventListener('pointermove', beweeg);
      document.addEventListener('pointerup', los);
    });
  }

  /* Magnetisch: als een widget met een rand vlak bij die van een andere komt,
     "klikt" hij er vanzelf tegenaan (randen en boven-/onderkanten lijnen uit).
     Rustig gehouden: alleen binnen een kleine afstand (14px). */
  var KLEEF = 14;
  function magneet(el, x, y) {
    if (!laag) return { x: x, y: y };
    var ew = el.offsetWidth, eh = el.offsetHeight;
    var bx = null, by = null, dx = KLEEF, dy = KLEEF;
    var prob = function (a, kandidaat, isX) {
      var v = Math.abs(a - kandidaat);
      if (isX && v < dx) { dx = v; bx = kandidaat; }
      if (!isX && v < dy) { dy = v; by = kandidaat; }
    };
    laag.querySelectorAll('.bw').forEach(function (o) {
      if (o === el) return;
      var L = o.offsetLeft, T = o.offsetTop, R = L + o.offsetWidth, B = T + o.offsetHeight;
      prob(x, L, true); prob(x, R, true);            // linkerranden gelijk, of tegen de rechterrand
      prob(x + ew, L, true); prob(x + ew, R, true);  // rechterrand tegen links, of rechterranden gelijk
      prob(y, T, false); prob(y, B, false);
      prob(y + eh, T, false); prob(y + eh, B, false);
    });
    if (bx !== null) { if (Math.abs(bx - x) > Math.abs(bx - (x + ew))) x = bx - ew; else x = bx; }
    if (by !== null) { if (Math.abs(by - y) > Math.abs(by - (y + eh))) y = by - eh; else y = by; }
    return { x: x, y: y };
  }

  function sleepbaar(el, kop, w) {
    kop.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.bw-x')) return;
      e.preventDefault();
      var startX = e.clientX, startY = e.clientY;
      var beginL = parseFloat(el.style.left) || 0, beginT = parseFloat(el.style.top) || 0;
      el.classList.add('pak'); try { el.setPointerCapture(e.pointerId); } catch (x) {}
      function beweeg(ev) {
        var nx = Math.max(4, Math.min(window.innerWidth - 60, beginL + (ev.clientX - startX)));
        var ny = Math.max(4, Math.min(window.innerHeight - 44, beginT + (ev.clientY - startY)));
        var m = magneet(el, nx, ny); nx = m.x; ny = m.y;
        el.style.left = nx + 'px'; el.style.top = ny + 'px';
      }
      function los() {
        el.classList.remove('pak');
        document.removeEventListener('pointermove', beweeg);
        document.removeEventListener('pointerup', los);
        w.x = parseFloat(el.style.left); w.y = parseFloat(el.style.top);
        w.kant = w.x < window.innerWidth / 2 ? 'links' : 'rechts';
        bewaar();
      }
      document.addEventListener('pointermove', beweeg);
      document.addEventListener('pointerup', los);
    });
  }

  function teken() {
    if (!laag) return;
    // eerst alle geleende kaarten teruggeven, dan pas de laag legen
    laag.querySelectorAll('.bw').forEach(function (w) { var s = soort(w.dataset.id); if (s) terug(s); });
    laag.innerHTML = '';
    staat.widgets.forEach(function (w) { var el = widgetEl(w); if (el) laag.appendChild(el); });
    vulMenu();
  }

  function verwijder(id) {
    var s = soort(id); if (s) terug(s);
    staat.widgets = staat.widgets.filter(function (w) { return w.id !== id; });
    bewaar(); teken();
  }
  function voegToe(id, app, naam) {
    if (staat.widgets.some(function (w) { return w.id === id; })) return;
    // afwisselend links/rechts, op de kant met de minste widgets
    var links = staat.widgets.filter(function (w) { return w.kant === 'links'; }).length;
    var rechts = staat.widgets.length - links;
    var kant = links <= rechts ? 'links' : 'rechts';
    var wd = { id: id, kant: kant, x: null, y: 40 + Math.floor(staat.widgets.length / 2) * 60 };
    if (id.indexOf('app:') === 0) { wd.app = app; wd.naam = naam; wd.w = 320; wd.h = 440; }
    staat.widgets.push(wd);
    bewaar(); teken();
    if (menu) menu.classList.remove('open');
  }

  function vulMenu() {
    if (!menu) return;
    menu.innerHTML = '';
    SOORTEN.forEach(function (s) {
      var b = document.createElement('button'); b.textContent = s.naam;
      if (staat.widgets.some(function (w) { return w.id === s.id; })) b.disabled = true;
      else b.addEventListener('click', function () { voegToe(s.id); });
      menu.appendChild(b);
    });
    // elke ROS-app als widget
    var kop = document.createElement('div'); kop.className = 'bureauMenu-kop'; kop.textContent = 'Apps';
    menu.appendChild(kop);
    rosApps().forEach(function (a) {
      var id = 'app:' + a.url;
      var b = document.createElement('button'); b.textContent = a.naam;
      if (staat.widgets.some(function (w) { return w.id === id; })) b.disabled = true;
      else b.addEventListener('click', function () { voegToe(id, a.url, a.naam); });
      menu.appendChild(b);
    });
  }

  function plaatsKnop() {
    var r = rechterMarge();
    if (plusKnop) plusKnop.style.left = Math.min(window.innerWidth - 60, r) + 'px';
    if (menu) { menu.style.left = Math.min(window.innerWidth - 180, r) + 'px'; menu.style.bottom = 'calc(env(safe-area-inset-bottom,0px) + 4rem)'; }
  }

  function aan() {
    if (actief) return; actief = true;
    stijl();
    laag = document.createElement('div'); laag.id = 'bureau';
    document.body.insertBefore(laag, document.body.firstChild);
    /* De plus stond als los knopje op het bureaublad te zweven. Hij bestaat nog
       -- het menu hangt eraan -- maar staat niet meer in beeld: je opent hem
       vanuit het bedieningspaneel (rij "Widgets"), zoals alles wat je zelden
       nodig hebt. Voor het toetsenbord blijft hij bereikbaar via die rij. */
    plusKnop = document.createElement('button'); plusKnop.id = 'bureauPlus'; plusKnop.setAttribute('aria-label', 'Widget toevoegen'); plusKnop.textContent = '+';
    plusKnop.hidden = true;
    menu = document.createElement('div'); menu.id = 'bureauMenu';
    document.body.appendChild(plusKnop); document.body.appendChild(menu);
    plusKnop.addEventListener('click', function () { menu.classList.toggle('open'); });
    plaatsKnop(); teken();
  }
  function uit() {
    if (!actief) return; actief = false;
    if (laag) { laag.querySelectorAll('.bw').forEach(function (w) { var s = soort(w.dataset.id); if (s) terug(s); }); }
    if (laag && laag.parentNode) laag.parentNode.removeChild(laag);
    if (plusKnop && plusKnop.parentNode) plusKnop.parentNode.removeChild(plusKnop);
    if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
    laag = plusKnop = menu = null;
  }

  function beoordeel() {
    var app = document.getElementById('app');
    var binnen = app && app.classList.contains('active');
    if (binnen && window.innerWidth >= MIN) { aan(); plaatsKnop(); }
    else uit();
  }

  function start() {
    var app = document.getElementById('app');
    if (app) new MutationObserver(beoordeel).observe(app, { attributes: true, attributeFilter: ['class'] });
    var t;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { if (actief) plaatsKnop(); beoordeel(); }, 120); });
    beoordeel();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.RTGBureau = {
    beoordeel: beoordeel,
    // het bedieningspaneel opent hiermee het widget-menu; er is geen knop meer
    kiezer: function () { if (menu) menu.classList.toggle('open'); },
    mogelijk: function () { return !!menu; }
  };
})();
