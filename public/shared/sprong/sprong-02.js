  /* --- deel 2: de vorm (stijl) --- */
  var css = '.rtgsprong-greep{position:fixed;z-index:9970;right:14px;bottom:calc(76px + env(safe-area-inset-bottom,0px));' +
      'width:52px;height:52px;display:grid;place-items:center;border:1px solid #857007;border-radius:0;' +
      'background:#0C0C0B;color:#FFFFFF;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.45);}' +
    '[data-hand="links"] .rtgsprong-greep{right:auto;left:14px;}' +
    '.rtgsprong-greep:focus-visible{outline:2px solid #857007;outline-offset:2px;}' +
    '.rtgsprong{position:fixed;inset:0;z-index:9971;display:flex;flex-direction:column;background:#0C0C0B;' +
      'font-family:Inter,system-ui,sans-serif;color:#FFFFFF;}' +
    '.rtgsprong[hidden]{display:none;}' +
    '.rtgsprong-kop{display:flex;gap:10px;align-items:center;padding:calc(14px + env(safe-area-inset-top,0px)) 14px 12px;' +
      'border-bottom:1px solid #4D4A45;}' +
    '.rtgsprong-kop input{flex:1;min-height:48px;background:#000;color:#FFFFFF;border:1px solid #4D4A45;border-radius:0;' +
      'padding:0 12px;font:400 1rem Inter,system-ui,sans-serif;}' +
    '.rtgsprong-kop button{min-width:48px;min-height:48px;background:none;border:1px solid #4D4A45;border-radius:0;' +
      'color:#FFFFFF;font:600 .85rem Inter,system-ui,sans-serif;cursor:pointer;}' +
    '.rtgsprong-lijst{flex:1;overflow:auto;padding:0 0 calc(24px + env(safe-area-inset-bottom,0px));}' +
    '.rtgsprong-wereld{margin:0;padding:16px 14px 6px;font:600 .62rem Inter,system-ui,sans-serif;letter-spacing:.18em;' +
      'text-transform:uppercase;color:#857007;}' +
    '.rtgsprong-rij{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:48px;' +
      'padding:12px 14px;background:none;border:0;border-bottom:1px solid #2A2724;border-radius:0;color:#FFFFFF;' +
      'font:400 .95rem Inter,system-ui,sans-serif;text-align:left;cursor:pointer;}' +
    '.rtgsprong-rij:hover,.rtgsprong-rij:focus-visible{background:#191817;outline:none;}' +
    '.rtgsprong-rij em{font-style:normal;color:#8A8680;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;}' +
    '.rtgsprong-leeg{padding:22px 14px;color:#8A8680;}';

  function stijl() {
    var s = d.createElement('style');
    s.textContent = css;
    /* De stempelaar van de voordeur zet de nonce erop (middleware/csp.js). */
    d.head.appendChild(s);
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
      if (w.RTGCommand && w.RTGCommand.actief && w.RTGCommand.actief()) w.RTGCommand.open(rij.url, rij.naam);
      else location.href = rij.url;
      return;
    }
    /* Een tab of os-app woont IN de leden-app. Staat die om ons heen, dan
       drukken we zijn eigen knop in (een tweede weg zou twee waarheden geven);
       anders met de stand in de hash, en app-main opent hem daar (28.js). */
    var knop = d.querySelector('.tabbar button[data-tab="' + rij.sleutel + '"]');
    if (rij.soort === 'tab' && knop) { knop.click(); return; }
    location.href = '/apps/app.html#' + (rij.soort === 'tab' ? 'tab=' : 'os=') + encodeURIComponent(rij.sleutel);
  }

