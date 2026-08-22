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
    schil.console.querySelectorAll('[data-open]').forEach(function (b) {
      var geopend = vind(b.dataset.open);
      b.toggleAttribute('data-huidig', !!(geopend && schil.actief === geopend));
    });
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
    /* De bewaarde werkruimtes. Ze staan in de console en niet in een menu:
       de console IS de navigator (WERKRUIMTE.md par. 10), en een kamer
       terughalen is navigeren. */
    var wr = schil.console.querySelector('[data-ruimtes]');
    if (wr) {
      var namen = Object.keys(alleRuimtes());
      wr.innerHTML = namen.length
        ? namen.map(function (n) {
            return '<button type="button" data-ruimte="' + esc(n) + '">' + esc(n) + '</button>';
          }).join('')
        : '<span class="stil" style="font-size:.78rem;">nog niets bewaard</span>';
      wr.querySelectorAll('[data-ruimte]').forEach(function (b) {
        b.addEventListener('click', function () { haalRuimte(b.dataset.ruimte); });
      });
    }
    var ctx = schil.console.querySelector('[data-context]');
    if (ctx) {
      ctx.innerHTML = schil.huidigeContext
        ? 'Alles op <b>' + esc(schil.huidigeContext.id) + '</b><br>' + esc(schil.huidigeContext.label)
        : 'Geen gedeelde context. Kies iets in een app; de rest volgt.';
    }
  }

  /* Een tab is één echt open oppervlak: kiezen activeert het scherm en het
     kruis sluit precies dat scherm. */
  function tekenTabs() {
    if (!schil.tabs) return;
    schil.tabs.innerHTML = schil.surfaces.map(function (s) {
      return '<div class="rtg-tab" data-id="' + esc(s.id) + '"' +
        (schil.actief === s ? ' data-actief' : '') + '>' +
        '<button type="button" class="rtg-tab-kies">' + esc(s.naam) + '</button>' +
        '<button type="button" class="rtg-tab-sluit" aria-label="Sluit ' + esc(s.naam) + '">&times;</button>' +
        '</div>';
    }).join('');
    schil.tabs.querySelectorAll('.rtg-tab').forEach(function (tab) {
      tab.querySelector('.rtg-tab-kies').addEventListener('click', function () {
        var s = vind(tab.dataset.id); if (s) maakActief(s);
      });
      tab.querySelector('.rtg-tab-kies').addEventListener('dblclick', function () {
        var s = vind(tab.dataset.id); if (s) zoom(s, 'deep');
      });
      tab.querySelector('.rtg-tab-sluit').addEventListener('click', function () { sluit(tab.dataset.id); });
    });
    tekenOnderbalk();
  }

  /* De onderbalk is de korte, contextvaste route door de software. Hij kent
     alleen app-id's en opent dezelfde surfaces als de linkerbank; er ontstaat
     dus geen tweede administratie of afwijkende mobiele app. */
  function tekenOnderbalk() {
    if (!schil.onderbalk) return;
    var ids = (schil.dockApps.length ? schil.dockApps : schil.apps.slice(0, 4).map(function (a) { return a.id; }));
    var eerste = schil.apps[0];
    var apps = ids.map(function (id) {
      return schil.apps.find(function (a) { return a.id === id; });
    }).filter(function (a) { return a && (!eerste || a.id !== eerste.id); });
    function knop(a) {
      var actief = schil.actief && schil.actief.id === a.id;
      return '<button type="button" class="rtg-onder-app" data-dock-open="' + esc(a.id) + '"' +
        (actief ? ' aria-current="page"' : '') + '>' +
        '<span class="rtg-onder-code" aria-hidden="true">' + esc(a.kort || a.naam.slice(0, 2).toUpperCase()) + '</span>' +
        '<span class="rtg-onder-label">' + esc(a.naam) + '</span></button>';
    }
    schil.onderbalk.innerHTML = (eerste
      ? '<button type="button" class="rtg-onder-thuis" data-dock-open="' + esc(eerste.id) + '"' +
        (schil.actief && schil.actief.id === eerste.id ? ' aria-current="page"' : '') +
        '><span class="rtg-onder-code" aria-hidden="true">01</span><span class="rtg-onder-label">Home</span></button>'
      : '') + apps.map(knop).join('') +
      '<span class="rtg-onder-rek"></span><button type="button" class="rtg-onder-zoek" data-dock-zoek>' +
      '<span class="rtg-onder-code" aria-hidden="true">⌘K</span><span class="rtg-onder-label">Zoeken</span></button>';
    schil.onderbalk.querySelectorAll('[data-dock-open]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = schil.apps.find(function (x) { return x.id === b.dataset.dockOpen; });
        if (a) open(a.id, { naam: a.naam, url: a.url, kort: a.naam });
      });
    });
    var zoek = schil.onderbalk.querySelector('[data-dock-zoek]');
    if (zoek) zoek.addEventListener('click', function () {
      schil.vak.dispatchEvent(new CustomEvent('rtg-palet-open', { bubbles: true }));
    });
  }
