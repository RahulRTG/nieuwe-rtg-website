        if (r.ok || (r.status >= 400 && r.status < 500)) {
          q = wachtrij(); q.shift(); wachtrijZet(q);
          if (q.length) setTimeout(verstuurWachtrij, 800);
          else {
            fout(T('net.rijLeeg', 'Alles uit de wachtrij is alsnog verstuurd.'));
            try { document.dispatchEvent(new CustomEvent('rtg-wachtrij-leeg')); } catch (e) {}
          }
        }
      }, function () { wBezig = false; });
  }
  w.addEventListener('online', function () { setTimeout(verstuurWachtrij, 1500); });
  setInterval(verstuurWachtrij, 30000);
  setTimeout(verstuurWachtrij, 3000);

  /* ---------- het satelliet-noodbericht ----------
     Nieuwere telefoons versturen zonder bereik een sms via een satelliet. De
     app maakt daarvoor een zo kort mogelijk bericht klaar met tijd en locatie;
     versturen doet het toestel zelf (Berichten-app), wij duwen niets weg. */
  function noodtekst(opts) {
    opts = opts || {};
    return new Promise(function (klaar) {
      function bouw(pos) {
        var d = new Date();
        var t = 'SOS' + (opts.naam ? ' ' + String(opts.naam).slice(0, 20) : '') +
          ' ' + d.getDate() + '/' + (d.getMonth() + 1) +
          ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
        if (pos) t += ' locatie ' + pos.coords.latitude.toFixed(5) + ',' + pos.coords.longitude.toFixed(5);
        t += ' - ' + (opts.wat || 'Ik heb hulp nodig. Dit bericht komt via satelliet, ik heb geen bereik.');
        klaar(t.replace(/\s+/g, ' ').trim());
      }
      if (!navigator.geolocation) return bouw(null);
      navigator.geolocation.getCurrentPosition(bouw, function () { bouw(null); }, { enableHighAccuracy: true, timeout: 8000 });
    });
  }

  // het balkje onderin: eerlijk zeggen dat de zuinige stand aanstaat,
  // en hoeveel er in de wachtrij op verbinding staat te wachten
  var satEl;
  function satTeken() {
    var aan = satActief();
    var rij = wachtrij().length;
    if (!aan && !rij) { if (satEl) { satEl.remove(); satEl = null; } return; }
    if (!document.body) { document.addEventListener('DOMContentLoaded', satTeken); return; }
    if (!satEl) {
      satEl = document.createElement('div');
      satEl.id = 'rtg-sat-balkje';
      satEl.setAttribute('role', 'status');
      satEl.setAttribute('aria-live', 'polite');
      satEl.style.cssText = 'position:fixed;left:50%;bottom:.7rem;transform:translateX(-50%);z-index:99999;' +
        'display:flex;gap:.6rem;align-items:center;background:#14202b;color:#cfe0ee;border:1px solid #2c3f52;' +
        'border-radius:999px;padding:.42rem .9rem;font:600 .78rem/1.2 system-ui,-apple-system,sans-serif;' +
        'box-shadow:0 4px 16px rgba(0,0,0,.35);max-width:92vw;';
      var tekst = document.createElement('span');
      tekst.id = 'rtg-sat-tekst';
      var uit = document.createElement('button');
      uit.type = 'button';
      uit.textContent = '✕';
      uit.setAttribute('aria-label', T('net.satUit', 'Zuinige stand uitzetten'));
      uit.style.cssText = 'background:none;border:0;color:#8fa6ba;cursor:pointer;font-size:.8rem;padding:0;';
      uit.addEventListener('click', function () { satZet('uit'); });
      satEl.appendChild(tekst); satEl.appendChild(uit);
      document.body.appendChild(satEl);
    }
    var delen = [];
    if (aan) delen.push(T('net.sat', '🛰 Trage verbinding: zuinige stand aan'));
    if (rij) delen.push(T('net.rijTel', '📮 ') + rij + T('net.rijWacht', ' in de wachtrij'));
    satEl.querySelector('#rtg-sat-tekst').textContent = delen.join(' · ');
  }
  if (satActief() || wachtrij().length) satTeken();

  w.Satelliet = {
    actief: satActief, stand: satStand, zetStand: satZet, beurt: satBeurt,
    multiplier: function () { return satActief() ? 4 : 1; },
    wachtrij: function () { return wachtrij().length; },
    noodtekst: noodtekst
  };

  /* ---------- Zaakdoos-voorkeur ----------
     Elke app probeert standaard eerst een Zaakdoos (het kastje in de zaak) en
     valt pas terug op de cloud als er geen doos is. Een browser mag het lokale
     net niet zelf afscannen, dus dit werkt in drie trappen:
     1) De app is al vanaf een Zaakdoos geopend (zelfde origin serveert de doos)
        -> alles loopt al via de doos, die zelf terugvalt op de cloud. Een groen
        lampje laat dat zien.
     2) Er is een Zaakdoos-adres ingesteld (localStorage rtg_doos_url): de app
        probeert dat eerst en stapt erheen (met de sessie mee via de hash), of
        valt terug op de cloud als de doos niet reageert.
     3) Niets ingesteld en niet op een doos -> gewoon de cloud. */
  (function doosLaag() {
    var DOOS_KEY = 'rtg_doos_url', DOOS_UIT = 'rtg_doos_uit', SESSIE = 'rtg_doos_geprobeerd';
    function lees(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
    function schrijf(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
    function doosURL() { return lees(DOOS_KEY).trim().replace(/\/$/, ''); }
    var opDeDoos = false;

    // token-overdracht: kwamen we van de cloud naar de doos met de sessie in de hash?
    try {
      var m = /[#&]doos-token=([^&]+)/.exec(location.hash || '');
      if (m) {
        try { localStorage.setItem('rtg_member_token', decodeURIComponent(m[1])); } catch (e) {}
        history.replaceState(null, '', location.pathname + location.search);
      }
    } catch (e) {}

    function probe(base, ms) {
      return new Promise(function (res) {
        var ctl = w.AbortController ? new AbortController() : null;
        var t = setTimeout(function () { if (ctl) ctl.abort(); res(false); }, ms || 2500);
        echteFetch((base || '') + '/api/doos/status', ctl ? { signal: ctl.signal } : {})
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) { clearTimeout(t); res(!!(d && d.doos)); })
          .catch(function () { clearTimeout(t); res(false); });
      });
    }
    function naarDoos() {
      var u = doosURL(); if (!u) return;
      var tok = ''; try { tok = localStorage.getItem('rtg_member_token') || ''; } catch (e) {}
      location.href = u + location.pathname + location.search + (tok ? '#doos-token=' + encodeURIComponent(tok) : '');
    }
    function lampje(soort) {
      var el = document.getElementById('rtg-doos-pill');
      if (!soort) { if (el) el.remove(); return; }
      if (!document.body) { document.addEventListener('DOMContentLoaded', function () { lampje(soort); }); return; }
      if (!el) {
        el = document.createElement(soort === 'beschikbaar' ? 'button' : 'div');
        el.id = 'rtg-doos-pill';
        el.style.cssText = 'position:fixed;left:.7rem;bottom:.7rem;z-index:99998;display:flex;gap:.4rem;align-items:center;' +
          'border-radius:999px;padding:.4rem .8rem;font:600 .76rem/1.2 system-ui,-apple-system,sans-serif;border:1px solid;' +
          'box-shadow:0 4px 16px rgba(0,0,0,.35);' + (soort === 'beschikbaar' ? 'cursor:pointer;' : '');
        if (soort === 'beschikbaar') { el.type = 'button'; el.addEventListener('click', naarDoos); }
        document.body.appendChild(el);
      }
      if (soort === 'doos') { el.style.background = '#10231a'; el.style.color = '#8fe0b0'; el.style.borderColor = '#2f7d54'; el.textContent = '● Zaakdoos'; el.title = 'Deze app draait via de Zaakdoos in de zaak (valt zelf terug op de cloud).'; }
      else { el.style.background = '#14202b'; el.style.color = '#cfe0ee'; el.style.borderColor = '#2c3f52'; el.textContent = '◐ Open op de Zaakdoos'; }
    }
    function init() {
      probe('', 2500).then(function (hier) {
        if (hier) { opDeDoos = true; lampje('doos'); return; }
        var u = doosURL();
        if (!u || lees(DOOS_UIT) === '1') return; // geen doos ingesteld of bewust uit: cloud
        probe(u, 3000).then(function (bereikbaar) {
          if (!bereikbaar) return; // geen doos gevonden: terugval op de cloud
          var alGeprobeerd = false;
          try { alGeprobeerd = sessionStorage.getItem(SESSIE) === '1'; } catch (e) {}
          if (alGeprobeerd) { lampje('beschikbaar'); return; } // niet in een lus belanden
          try { sessionStorage.setItem(SESSIE, '1'); } catch (e) {}
          naarDoos(); // standaard eerst naar de doos
        });
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

    w.RTGdoos = {
      opDeDoos: function () { return opDeDoos; },
      adres: doosURL,
      instellen: function (url) { schrijf(DOOS_KEY, (String(url || '').trim().replace(/\/$/, '')) || null); },
      uit: function (v) { schrijf(DOOS_UIT, v ? '1' : null); },
      naarDoos: naarDoos
    };
  })();

  w.RTGNet = { toon: toonBanner, verberg: verbergBanner, fout: fout, haal: haal, status: status, satelliet: w.Satelliet, doos: w.RTGdoos };
})(window);
