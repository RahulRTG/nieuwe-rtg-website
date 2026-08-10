  /* ------------------------------------------------------- context linking --
     De shell stuurt alleen een VERWIJZING rond: soort, id, label. Nooit de
     gegevens zelf. Elke surface lost hem op met zijn eigen sessie en zijn eigen
     rechten, zodat de werkruimte geen sluiproute wordt naar iets waar je niet
     bij mag (WERKRUIMTE.md par. 5). */
  function context(ref) {
    if (!ref || !ref.id) { schil.huidigeContext = null; tekenConsole(); return; }
    schil.huidigeContext = { soort: String(ref.soort || ''), id: String(ref.id), label: String(ref.label || '') };
    schil.luisteraars.forEach(function (fn) {
      try { fn(schil.huidigeContext); } catch (e) { /* een luisteraar die stukgaat neemt de rest niet mee */ }
    });
    // de surfaces die als eigen pagina draaien, krijgen hem over de framegrens
    schil.surfaces.forEach(function (s) {
      var f = s.el.querySelector('iframe');
      if (f && f.contentWindow) {
        try { f.contentWindow.postMessage({ rtg: 'context', ref: schil.huidigeContext }, location.origin); }
        catch (e) { /* een frame dat nog laadt hoort de volgende wel */ }
      }
    });
    tekenConsole();
  }
  function opContext(fn) { if (typeof fn === 'function') schil.luisteraars.push(fn); }

  /* --------------------------------------------------------- de console -- */
  function tekenConsole() {
    var c = schil.console.querySelector('[data-actieflijst]');
    if (c) {
      c.innerHTML = schil.surfaces.length
        ? schil.surfaces.map(function (s) {
            return '<button type="button" data-ga="' + esc(s.id) + '"' +
              (schil.actief === s ? ' data-open' : '') + '>' + esc(s.naam) + '</button>';
          }).join('')
        : '<span class="stil" style="font-size:.78rem;">nog niets open</span>';
      c.querySelectorAll('[data-ga]').forEach(function (b) {
        b.addEventListener('click', function () { var s = vind(b.dataset.ga); if (s) { zoom(s, 'work'); maakActief(s); } });
      });
    }
    var ctx = schil.console.querySelector('[data-context]');
    if (ctx) {
      ctx.innerHTML = schil.huidigeContext
        ? 'Alles op <b>' + esc(schil.huidigeContext.id) + '</b><br>' + esc(schil.huidigeContext.label)
        : 'Geen gedeelde context. Kies iets in een app; de rest volgt.';
    }
  }

  function start(opties) {
    opties = opties || {};
    schil.vak = opties.vak || d.querySelector('.rtg-werkruimte');
    schil.console = opties.console || schil.vak.querySelector('.rtg-console');
    schil.dok = el('div', 'rtg-dok', schil.vak);
    w.addEventListener('resize', schik);
    // een surface die zelf om context roept (uit een frame, zelfde herkomst)
    w.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.rtg !== 'context') return;
      context(e.data.ref);
    });
    schik(); tekenConsole();
    return w.RTGSchil;
  }

  w.RTGSchil = {
    start: start, open: open, sluit: sluit, zoom: zoom,
    context: context, opContext: opContext,
    get surfaces() { return schil.surfaces.slice(); },
    get actief() { return schil.actief; }
  };
})(window, document);
