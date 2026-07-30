/* RTG vensterbeheer.

   window.RTGVensters.open(url, titel) opent een app als venster op het
   bureaublad (een same-origin iframe). Meerdere vensters mogen tegelijk open;
   je sleept ze aan de titelbalk, schaalt ze aan de rechteronderhoek (CSS
   resize), haalt ze naar voren door erop te klikken, en bedient ze met de drie
   knopjes: bordeaux = sluiten, goud = kleiner (naar het dock), groen = volledig
   scherm. De pijl-knop opent dezelfde app als een ECHT los browservenster voor
   een tweede of derde monitor. Onderaan staat een dock met de open vensters en
   een Bureaublad-knop die alles even wegvouwt -- zo is de "mobiel" (het OS zelf)
   altijd bereikbaar.

   De open vensters worden onthouden per pagina: na een verversing komt je
   werkruimte terug. Alleen op een breed scherm (>=1000px); op de telefoon valt
   open() terug op gewoon navigeren. */
(function () {
  var wins = [];
  var zTop = 40;
  var laag = null, dock = null;
  var herstellen = false;
  var KEY = 'rtg_vensters_' + location.pathname.replace(/[^a-z0-9]/gi, '_');

  function desktop() { return window.matchMedia('(min-width: 1000px)').matches; }

  function bewaar() {
    if (herstellen) return;
    try {
      var data = wins.map(function (w) {
        var el = w.el;
        return { url: w.url, titel: w.titel, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, min: !!el.hidden, vol: el.classList.contains('vol') };
      });
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function zorgLaag() {
    if (laag) return;
    laag = document.createElement('div'); laag.id = 'rtg-vensters';
    document.body.appendChild(laag);
    dock = document.createElement('div'); dock.className = 'rtg-dock'; dock.hidden = true;
    document.body.appendChild(dock);
  }
  function focus(w) {
    zTop += 1; w.el.style.zIndex = zTop;
    wins.forEach(function (x) { x.el.classList.toggle('voor', x === w); });
    dockSync();
  }
  function dockSync() {
    if (!dock) return;
    dock.textContent = '';
    dock.hidden = wins.length === 0;
    if (wins.length) {
      // de Bureaublad-knop: vouwt alles weg zodat het OS ("de mobiel") vrijkomt
      var home = document.createElement('button');
      home.className = 'rtg-dockknop rtg-home'; home.type = 'button';
      home.textContent = 'Bureaublad'; home.title = 'Alle vensters even wegvouwen';
      home.addEventListener('click', function () { wins.forEach(function (w) { w.el.hidden = true; }); dockSync(); bewaar(); });
      dock.appendChild(home);
    }
    wins.forEach(function (w) {
      var b = document.createElement('button');
      b.className = 'rtg-dockknop' + (w.el.classList.contains('voor') && !w.el.hidden ? ' voor' : '');
      b.type = 'button'; b.textContent = w.titel;
      b.addEventListener('click', function () { w.el.hidden = false; focus(w); bewaar(); });
      dock.appendChild(b);
    });
  }
  function sluit(w) {
    w.el.remove();
    wins = wins.filter(function (x) { return x !== w; });
    dockSync(); bewaar();
  }
  function popout(w) {
    var b = Math.round(w.el.getBoundingClientRect().width) || 1040;
    var h = Math.round(w.el.getBoundingClientRect().height) || 720;
    window.open(w.url, '_blank', 'noopener,width=' + b + ',height=' + h);
    sluit(w);
  }
  function minimaliseer(w) { w.el.hidden = true; dockSync(); bewaar(); }
  function maximaliseer(w) {
    var el = w.el;
    if (el.classList.contains('vol')) {
      el.classList.remove('vol');
      if (w.prev) { el.style.left = w.prev.x + 'px'; el.style.top = w.prev.y + 'px'; el.style.width = w.prev.w + 'px'; el.style.height = w.prev.h + 'px'; }
    } else {
      w.prev = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      el.classList.add('vol');
      el.style.left = '0px'; el.style.top = '0px';
      el.style.width = window.innerWidth + 'px'; el.style.height = window.innerHeight + 'px';
    }
    focus(w); bewaar();
  }
  function sleepbaar(el, greep, w) {
    greep.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      var sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
      try { greep.setPointerCapture(e.pointerId); } catch (er) {}
      function mv(ev) {
        el.style.left = Math.max(0, Math.min(ox + ev.clientX - sx, window.innerWidth - 90)) + 'px';
        el.style.top = Math.max(0, Math.min(oy + ev.clientY - sy, window.innerHeight - 40)) + 'px';
      }
      function up() { greep.removeEventListener('pointermove', mv); greep.removeEventListener('pointerup', up); bewaar(); }
      greep.addEventListener('pointermove', mv);
      greep.addEventListener('pointerup', up);
    });
  }
  function open(url, titel, geo) {
    if (!desktop()) { if (!herstellen) location.href = url; return null; }
    zorgLaag();
    var best = null;
    wins.forEach(function (x) { if (x.url === url) best = x; });
    if (best && !geo) { best.el.hidden = false; focus(best); return best; }

    var el = document.createElement('section');
    el.className = 'rtg-venster-os';
    var n = wins.length;
    var w0 = (geo && geo.w) || Math.min(1040, window.innerWidth - 120);
    var h0 = (geo && geo.h) || Math.min(760, window.innerHeight - 140);
    el.style.left = (geo ? geo.x : (60 + n * 34)) + 'px';
    el.style.top = (geo ? geo.y : (64 + n * 30)) + 'px';
    el.style.width = w0 + 'px'; el.style.height = h0 + 'px';
    if (geo && geo.vol) el.classList.add('vol');
    if (geo && geo.min) el.hidden = true;
    el.innerHTML =
      '<header class="rtg-titel"><span class="rtg-grip"></span><span class="rtg-naam"></span>' +
      '<span class="rtg-sp"></span>' +
      '<button class="rtg-uit" type="button" title="Als los venster (andere monitor)" aria-label="Open in een los venster">↗</button>' +
      '<span class="rtg-lampen">' +
      '<button class="rtg-lamp rood" type="button" title="Sluiten" aria-label="Venster sluiten"></button>' +
      '<button class="rtg-lamp geel" type="button" title="Kleiner (naar het dock)" aria-label="Minimaliseren"></button>' +
      '<button class="rtg-lamp groen" type="button" title="Volledig scherm" aria-label="Volledig scherm"></button>' +
      '</span></header>' +
      '<div class="rtg-body"><iframe title="" loading="lazy"></iframe></div>';
    el.querySelector('.rtg-naam').textContent = titel || 'App';
    var ifr = el.querySelector('iframe');
    ifr.title = titel || 'App';
    ifr.src = url;
    laag.appendChild(el);

    var w = { el: el, url: url, titel: titel || 'App' };
    wins.push(w);
    el.addEventListener('pointerdown', function () { focus(w); }, true);
    sleepbaar(el, el.querySelector('.rtg-titel'), w);
    el.querySelector('.rtg-lamp.rood').addEventListener('click', function (e) { e.stopPropagation(); sluit(w); });
    el.querySelector('.rtg-lamp.geel').addEventListener('click', function (e) { e.stopPropagation(); minimaliseer(w); });
    el.querySelector('.rtg-lamp.groen').addEventListener('click', function (e) { e.stopPropagation(); maximaliseer(w); });
    el.querySelector('.rtg-uit').addEventListener('click', function (e) { e.stopPropagation(); popout(w); });
    if (window.ResizeObserver) { var ro = new ResizeObserver(function () { if (!herstellen) bewaar(); }); ro.observe(el); }
    if (!el.hidden) focus(w); else dockSync();
    if (!herstellen) bewaar();
    return w;
  }

  function herstel() {
    if (!desktop()) return;
    var data = null;
    try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!data || !data.length) return;
    herstellen = true;
    data.slice(0, 8).forEach(function (d) { if (d && d.url) open(d.url, d.titel, d); });
    herstellen = false;
    bewaar();
  }

  window.RTGVensters = {
    open: open,
    actief: function () { return desktop(); },
    sluitAlles: function () { wins.slice().forEach(sluit); }
  };

  // werkruimte herstellen zodra de pagina er staat
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', herstel);
  else herstel();
})();
