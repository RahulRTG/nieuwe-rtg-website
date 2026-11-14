  /* --- deel 2: de vorm (stijl) --- */
  function laadSprongPresentatie(pad) {
    if (dsBijStart || document.documentElement.hasAttribute('data-ds')) return;
    if (document.getElementById('rtgDsRuntimeCss')) return;
    var s = document.createElement('link');
    s.id = 'rtgDsRuntimeCss'; s.rel = 'stylesheet'; s.href = pad;
    document.head.appendChild(s);
  }
  function stijl() {
    /* Alle hosts gebruiken dezelfde component; alleen oudere documenten laden
       de centrale DS-root nog dynamisch. */
    laadSprongPresentatie('/ds/rtg-ds.css');
  }

  /* De zoeklade van de leden-app, als die op deze pagina staat. */
  function ledenlade() {
    var scrim = d.getElementById('osZoekScrim');
    return scrim && d.getElementById('osZoekInput') ? scrim : null;
  }

  function haal() {
    if (index) return Promise.resolve(index);
    if (!laadt) laadt = fetch(INDEX, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { items: [] }; })
      .then(function (j) { index = (j && j.items) || []; return index; })
      .catch(function () { index = []; return index; });
    return laadt;
  }

  function ga(rij) {
    sluit();
    if (rij.url) {
      /* Beide indexen worden gegenereerd, maar het netwerkantwoord blijft
         onbetrouwbare invoer. Sprong voert uitsluitend een interne app-route
         uit; een gewijzigd indexbestand kan geen javascript:- of extern adres
         starten. De vaste prefix houdt ook de statische laadgraaf bewijsbaar. */
      var veilig = typeof rij.url === 'string' &&
        /^\/apps\/(?!\.{1,2}(?:\/|[?#]|$))(?!.*\/\.{1,2}(?:\/|[?#]|$))[A-Za-z0-9_.\/-]+(?:[?#][^\s]*)?$/.test(rij.url) ? rij.url : null;
      if (!veilig) return;
      if (w.RTGCommand && w.RTGCommand.actief && w.RTGCommand.actief()) w.RTGCommand.open(veilig, rij.naam);
      else location.href = '/apps/' + veilig.slice('/apps/'.length);
      return;
    }
    /* Een tab of os-app woont IN de leden-app. Staat die om ons heen, dan
       drukken we zijn eigen knop in (een tweede weg zou twee waarheden geven);
       anders met de stand in de hash, en app-main opent hem daar
       (renderAll in app-main-12a.js). */
    var knop = d.querySelector('.tabbar button[data-tab="' + rij.sleutel + '"]');
    if (rij.soort === 'tab' && knop) { knop.click(); return; }
    location.href = '/apps/app.html#' + (rij.soort === 'tab' ? 'tab=' : 'os=') + encodeURIComponent(rij.sleutel);
  }
