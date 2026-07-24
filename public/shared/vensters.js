/* RTG vensterbeheer.

   window.RTGVensters.open(url, titel) opent een app als venster op het
   bureaublad (een same-origin iframe). Meerdere vensters mogen tegelijk open;
   je sleept ze aan de titelbalk, schaalt ze aan de rechteronderhoek (CSS
   resize), haalt ze naar voren door erop te klikken, en sluit ze met de kruis-
   knop. De pijl-knop opent dezelfde app als een ECHT los browservenster, dat je
   naar een tweede of derde monitor sleept. Onderaan staat een dock met de open
   vensters.

   Alleen op een breed scherm (>=1000px). Op de telefoon valt open() terug op
   gewoon navigeren, zodat de app daar schermvullend opent zoals altijd. */
(function () {
  var wins = [];
  var zTop = 40;
  var laag = null, dock = null;

  function desktop() { return window.matchMedia('(min-width: 1000px)').matches; }

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
    wins.forEach(function (w) {
      var b = document.createElement('button');
      b.className = 'rtg-dockknop' + (w.el.classList.contains('voor') ? ' voor' : '');
      b.type = 'button'; b.textContent = w.titel;
      b.addEventListener('click', function () { w.el.hidden = false; focus(w); });
      dock.appendChild(b);
    });
  }
  function sluit(w) {
    w.el.remove();
    wins = wins.filter(function (x) { return x !== w; });
    dockSync();
  }
  function popout(w) {
    var b = Math.round(w.el.getBoundingClientRect().width) || 1040;
    var h = Math.round(w.el.getBoundingClientRect().height) || 720;
    window.open(w.url, '_blank', 'noopener,width=' + b + ',height=' + h);
    sluit(w);
  }
  function sleepbaar(el, greep) {
    greep.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      var sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
      try { greep.setPointerCapture(e.pointerId); } catch (er) {}
      function mv(ev) {
        el.style.left = Math.max(0, Math.min(ox + ev.clientX - sx, window.innerWidth - 90)) + 'px';
        el.style.top = Math.max(0, Math.min(oy + ev.clientY - sy, window.innerHeight - 40)) + 'px';
      }
      function up() { greep.removeEventListener('pointermove', mv); greep.removeEventListener('pointerup', up); }
      greep.addEventListener('pointermove', mv);
      greep.addEventListener('pointerup', up);
    });
  }
  function open(url, titel) {
    if (!desktop()) { location.href = url; return null; }
    zorgLaag();
    var best = null;
    wins.forEach(function (x) { if (x.url === url) best = x; });
    if (best) { best.el.hidden = false; focus(best); return best; }

    var el = document.createElement('section');
    el.className = 'rtg-venster-os';
    var n = wins.length;
    var w0 = Math.min(1040, window.innerWidth - 120);
    var h0 = Math.min(760, window.innerHeight - 140);
    el.style.left = (60 + n * 34) + 'px';
    el.style.top = (64 + n * 30) + 'px';
    el.style.width = w0 + 'px'; el.style.height = h0 + 'px';
    el.innerHTML =
      '<header class="rtg-titel"><span class="rtg-grip"></span><span class="rtg-naam"></span>' +
      '<span class="rtg-sp"></span>' +
      '<button class="rtg-uit" type="button" title="Als los venster (andere monitor)" aria-label="Open in een los venster">↗</button>' +
      '<button class="rtg-dicht" type="button" title="Sluiten" aria-label="Venster sluiten">×</button></header>' +
      '<div class="rtg-body"><iframe title="" loading="lazy"></iframe></div>';
    el.querySelector('.rtg-naam').textContent = titel || 'App';
    var ifr = el.querySelector('iframe');
    ifr.title = titel || 'App';
    ifr.src = url;
    laag.appendChild(el);

    var w = { el: el, url: url, titel: titel || 'App' };
    wins.push(w);
    el.addEventListener('pointerdown', function () { focus(w); }, true);
    sleepbaar(el, el.querySelector('.rtg-titel'));
    el.querySelector('.rtg-dicht').addEventListener('click', function (e) { e.stopPropagation(); sluit(w); });
    el.querySelector('.rtg-uit').addEventListener('click', function (e) { e.stopPropagation(); popout(w); });
    focus(w);
    return w;
  }

  window.RTGVensters = {
    open: open,
    actief: function () { return desktop(); },
    sluitAlles: function () { wins.slice().forEach(sluit); }
  };
})();
