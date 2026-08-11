  /* ------------------------------------------------------- werkruimtes --
     Stap 5 uit WERKRUIMTE.md. Een gerangschikte set surfaces is opslaanbaar en
     met één klik terug te halen: "Mijn Directie", "Reisbureau",
     "Restaurantavond". Eén klik en de hele kamer staat er.

     WAT ER BEWAARD WORDT is met opzet weinig: per surface een naam, een adres,
     de zoomstand, en -- alleen als de gebruiker hem zelf heeft neergezet -- de
     rechthoek. Geen inhoud, geen gegevens, geen sessie. Een werkruimte is een
     MEUBELPLAN en geen kopie van het werk; wie hem terughaalt, opent dezelfde
     apps opnieuw met zijn eigen rechten. Zou hier inhoud in staan, dan was de
     werkruimte een tweede administratie en een sluiproute langs de rechten --
     precies wat par. 5 over Context Linking al verbiedt.

     Per toestel, in localStorage. Een meubelplan hoort bij een scherm: wat op
     een breed bureau klopt, klopt niet op een laptop. */
  var WKEY = 'rtg_werkruimtes_v1';

  function alleRuimtes() {
    try { return JSON.parse(localStorage.getItem(WKEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function bewaarAlle(o) {
    try { localStorage.setItem(WKEY, JSON.stringify(o)); } catch (e) { /* vol of geweigerd */ }
  }

  function bewaarRuimte(naam) {
    var n = String(naam || '').trim();
    if (!n) return null;
    var o = alleRuimtes();
    o[n] = schil.surfaces.map(function (s) {
      var r = { id: s.id, naam: s.naam, url: s.url || '', zoom: s.zoom };
      /* Alleen de rechthoek van wie ZELF is neergezet. De rest wordt door
         schik() verdeeld, en die verdeling hangt af van de schermmaat -- die
         vastleggen zou hem juist verkeerd terugzetten. */
      if (s.eigen) r.vak = { x: s.el.offsetLeft, y: s.el.offsetTop, b: s.el.offsetWidth, h: s.el.offsetHeight };
      return r;
    });
    bewaarAlle(o);
    tekenConsole();
    return n;
  }

  function haalRuimte(naam) {
    var lijst = alleRuimtes()[String(naam || '')];
    if (!lijst) return false;
    // eerst leeg, anders staat de vorige kamer er nog doorheen
    schil.surfaces.slice().forEach(function (s) { sluit(s.id); });
    lijst.forEach(function (r) {
      var s = open(r.id, { naam: r.naam, url: r.url, kort: r.naam, zoom: r.zoom });
      if (r.vak && s) {
        s.eigen = true;
        zet(s.el, r.vak.x, r.vak.y, r.vak.b, r.vak.h);
      }
    });
    schik(); tekenConsole();
    return true;
  }

  function wisRuimte(naam) {
    var o = alleRuimtes();
    if (!(naam in o)) return false;
    delete o[naam]; bewaarAlle(o); tekenConsole();
    return true;
  }

  /* ------------------------------------------------------------ het palet --
     Stap 6 uit WERKRUIMTE.md: de console IS de navigator, en ⌘K is zijn mond.
     Hier stond een zoekregel die alleen op naam kon openen; die beloofde al
     niets meer dan hij deed, maar hij kon ook niet veel.

     Wat er nu in zit: apps openen, een bewaarde werkruimte terughalen, de
     huidige ruimte bewaren, en een surface sluiten. Geen fuzzy zoeken en geen
     scores -- een palet dat je niet kunt voorspellen, kun je ook niet uit je
     hoofd leren, en dat is precies waar zo'n palet voor bestaat. */
  function paletBronnen() {
    var uit = [];
    (schil.apps || []).forEach(function (a) {
      uit.push({ soort: 'app', label: a.naam, hint: 'openen',
        doe: function () { open(a.id, { naam: a.naam, url: a.url, kort: a.naam }); } });
    });
    Object.keys(alleRuimtes()).forEach(function (n) {
      uit.push({ soort: 'ruimte', label: n, hint: 'werkruimte terughalen',
        doe: function () { haalRuimte(n); } });
    });
    schil.surfaces.forEach(function (s) {
      uit.push({ soort: 'sluit', label: 'Sluit ' + s.naam, hint: 'surface sluiten',
        doe: function () { sluit(s.id); } });
    });
    return uit;
  }

  function paletTreffers(t) {
    var q = String(t || '').trim().toLowerCase();
    var bron = paletBronnen();
    if (!q) return bron.slice(0, 8);
    /* Beginnend met wat je typt gaat voor; daarna wat het bevat. Zo staat wat
       je bedoelde bovenaan zodra je genoeg getypt hebt, en verschuift de
       eerste regel niet meer onder je vingers vandaan. */
    var begin = bron.filter(function (x) { return x.label.toLowerCase().indexOf(q) === 0; });
    var bevat = bron.filter(function (x) {
      return x.label.toLowerCase().indexOf(q) > 0 && begin.indexOf(x) === -1;
    });
    return begin.concat(bevat).slice(0, 8);
  }
