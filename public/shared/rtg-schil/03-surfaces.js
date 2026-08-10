  /* ------------------------------------------------------------- surfaces -- */
  function open(id, opties) {
    opties = opties || {};
    var bestaand = vind(id);
    if (bestaand) { maakActief(bestaand); return bestaand; }

    var e = el('article', 'rtg-surface', schil.vak);
    e.dataset.id = id;
    e.dataset.zoom = opties.zoom || 'work';
    e.setAttribute('aria-label', opties.naam || id);

    var h = el('header', 'rtg-handle', e);
    h.innerHTML = '<span class="naam">' + esc(opties.naam || id) + '</span>' +
      '<span class="rek"></span>' +
      '<button type="button" data-doe="zoom" title="Kleiner of groter">&#9633;</button>' +
      '<button type="button" data-doe="sluit" title="Sluiten">&times;</button>';

    el('div', 'kort', e).innerHTML = opties.kort || '';
    var vlak = el('div', 'vlak', e);
    if (opties.url) {
      var f = d.createElement('iframe');
      f.setAttribute('title', opties.naam || id);
      /* Het recht op camera en microfoon doorgeven VOOR de src wordt gezet.
         Zonder dit vallen ze in een surface stil weg: de app vraagt netjes, de
         browser weigert zonder melding, en de gebruiker ziet alleen dat het
         niet werkt. De mediapoort is er precies om dat te voorkomen. */
      if (w.RTGMedia && w.RTGMedia.kader) w.RTGMedia.kader(f);
      /* De app draait als eigen pagina in de surface. Dat is met opzet: een app
         houdt zijn eigen diepte en zijn eigen sessie, en de shell hoeft niets
         van zijn binnenkant te weten (PLATFORM.md). */
      f.src = opties.url;
      vlak.appendChild(f);
    }

    var s = { id: id, naam: opties.naam || id, el: e, zoom: e.dataset.zoom, eigen: false };
    schil.surfaces.push(s);

    h.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('button')) return;
      sleep(s, ev);
    });
    h.addEventListener('dblclick', function () { zoom(s, 'deep'); });
    h.querySelector('[data-doe="sluit"]').addEventListener('click', function () { sluit(id); });
    h.querySelector('[data-doe="zoom"]').addEventListener('click', function () {
      zoom(s, s.zoom === 'glance' ? 'work' : 'glance');
    });
    e.addEventListener('pointerdown', function () { maakActief(s); });

    maakActief(s);
    schik();
    tekenConsole();
    return s;
  }

  function vind(id) {
    for (var i = 0; i < schil.surfaces.length; i++) if (schil.surfaces[i].id === id) return schil.surfaces[i];
    return null;
  }

  function sluit(id) {
    var s = vind(id); if (!s) return;
    s.el.remove();
    schil.surfaces = schil.surfaces.filter(function (x) { return x !== s; });
    if (schil.actief === s) schil.actief = schil.surfaces[schil.surfaces.length - 1] || null;
    if (schil.actief) maakActief(schil.actief);
    schik(); tekenConsole();
  }

  function maakActief(s) {
    schil.surfaces.forEach(function (x) { x.el.removeAttribute('data-actief'); });
    s.el.setAttribute('data-actief', '');
    schil.actief = s;
    // de actieve surface bovenop, zodat zweven ook echt zweeft
    schil.surfaces.forEach(function (x, i) { x.el.style.zIndex = String(10 + i); });
    s.el.style.zIndex = '40';
    tekenConsole();
  }

  /* Deep maakt er een dominante van en zet de rest op Glance: zo blijft de
     werkruimte vloeiend in plaats van een stapel gelijke vensters
     (WERKRUIMTE.md par. 4). */
  function zoom(s, stand) {
    s.zoom = stand; s.el.dataset.zoom = stand;
    if (stand === 'deep') {
      schil.surfaces.forEach(function (x) {
        if (x !== s) { x.zoom = 'glance'; x.el.dataset.zoom = 'glance'; }
      });
      maakActief(s);
    }
    schik();
  }

