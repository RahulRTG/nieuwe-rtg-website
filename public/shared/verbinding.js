/* Gedeelde verbindingslaag voor alle apps. Twee doelen:
   1) Een slanke banner bovenaan zodra de browser offline gaat, die vanzelf
      verdwijnt als de verbinding terug is. Zo weet de gebruiker altijd waarom
      iets niet lukt in plaats van naar een bevroren scherm te kijken.
   2) Een nette, uniforme foutmelding (RTGNet.fout) voor mislukte acties, zodat
      apps niet langer stil hoeven te falen in een lege catch.
   Zelf-installerend: het script insluiten is genoeg (na /shared/i18n.js, zodat
   vertalingen meelopen als ze er zijn). */
(function (w) {
  'use strict';
  function T(k, nl) { try { return w.RTGi18n ? w.RTGi18n.t(k, nl) : nl; } catch (e) { return nl; } }

  var banner;
  function maakBanner() {
    if (banner) return banner;
    banner = document.createElement('div');
    banner.id = 'rtg-net-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:100000;transform:translateY(-100%);' +
      'transition:transform .25s ease;background:#7a1f2b;color:#fff;text-align:center;' +
      'padding:0.5rem 1rem;font:600 0.82rem/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.25);';
    (document.body || document.documentElement).appendChild(banner);
    return banner;
  }
  function toonBanner(tekst) { var b = maakBanner(); b.textContent = tekst; b.style.transform = 'translateY(0)'; }
  function verbergBanner() { if (banner) banner.style.transform = 'translateY(-100%)'; }

  function status() {
    if (navigator.onLine === false) toonBanner(T('net.offline', 'Geen internetverbinding. Zodra je weer online bent gaat het vanzelf verder.'));
    else verbergBanner();
  }

  // Een korte, vriendelijke toast voor een mislukte actie. Gebruikt de eigen
  // toast van de app als die er is (window.toast), anders een eigen minitoast.
  var eigenToast;
  function fout(bericht) {
    var tekst = bericht || T('net.fout', 'Er ging iets mis. Probeer het zo nog eens.');
    if (typeof w.toast === 'function') { try { w.toast(tekst); return; } catch (e) { /* val terug */ } }
    if (!eigenToast) {
      eigenToast = document.createElement('div');
      eigenToast.setAttribute('role', 'status');
      eigenToast.style.cssText = 'position:fixed;left:50%;bottom:1.25rem;transform:translateX(-50%);z-index:100001;' +
        'max-width:90vw;background:#222;color:#fff;padding:0.6rem 1rem;border-radius:10px;opacity:0;transition:opacity .2s;' +
        'font:500 0.82rem/1.4 system-ui,-apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
      (document.body || document.documentElement).appendChild(eigenToast);
    }
    eigenToast.textContent = tekst;
    eigenToast.style.opacity = '1';
    clearTimeout(eigenToast._t);
    eigenToast._t = setTimeout(function () { eigenToast.style.opacity = '0'; }, 3200);
  }

  // Een fetch die bij netwerkfouten een nette melding geeft en de fout doorgeeft,
  // zodat een aanroeper hem kan opvangen zonder zelf de melding te hoeven maken.
  async function haal(pad, opties) {
    try {
      var r = await fetch(pad, opties);
      return r;
    } catch (e) {
      fout(T('net.geen', 'Geen verbinding met de server. Controleer je internet.'));
      throw e;
    }
  }

  w.addEventListener('online', verbergBanner);
  w.addEventListener('offline', status);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', status);
  else status();

  /* ---------- satellietmodus ----------
     De hele app blijft bruikbaar op een satellietverbinding (of heel traag
     mobiel): hoge vertraging, smalle band, af en toe een hapering. Drie dingen:
     1) Elk /api/-verzoek krijgt een ruime timeout en meet stilletjes de
        rondreistijd mee; mislukte GET's proberen het vanzelf nog eens.
     2) Blijkt de mediaan traag (of zegt de browser 2g), dan gaat de zuinige
        stand aan: pollers slaan beurten over (Satelliet.beurt) en een klein
        balkje onderin vertelt het eerlijk. Wordt de lijn weer vlot, dan gaat
        hij er vanzelf weer af.
     3) De stand is te sturen (auto/aan/uit) via localStorage rtg_sat; welke
        knoppen en opties daarbij komen is een aparte keuze. */
  var SAT_KEY = 'rtg_sat'; // 'auto' | 'aan' | 'uit'
  function satStand() { try { return localStorage.getItem(SAT_KEY) || 'auto'; } catch (e) { return 'auto'; } }
  function satZet(v) { try { localStorage.setItem(SAT_KEY, v); } catch (e) {} satTeken(); }
  var satTraag = false;
  try {
    var cn = navigator.connection;
    if (cn && /(^|-)2g$/.test(String(cn.effectiveType || ''))) satTraag = true;
  } catch (e) {}
  function satActief() { var s = satStand(); return s === 'aan' || (s === 'auto' && satTraag); }

  // meet mee met echte verzoeken: de mediaan beslist, zodat een losse hapering niet telt
  var satMonsters = [];
  function satMeet(ms, mislukt) {
    satMonsters.push(mislukt ? 5000 : ms);
    if (satMonsters.length > 8) satMonsters.shift();
    if (satMonsters.length < 4) return;
    var kopie = satMonsters.slice().sort(function (a, b) { return a - b; });
    var mediaan = kopie[Math.floor(kopie.length / 2)];
    var was = satTraag;
    if (mediaan > 1200) satTraag = true;
    else if (mediaan < 600) satTraag = false;
    if (was !== satTraag) satTeken();
  }

  // fetch-wikkel voor /api/-paden: timeout, meting en een stille herkansing voor GET's
  var echteFetch = w.fetch.bind(w);
  w.fetch = function (invoer, opties) {
    var url = typeof invoer === 'string' ? invoer : '';
    if (url.split('?')[0].indexOf('/api/') !== 0) return echteFetch(invoer, opties);
    var methode = String((opties && opties.method) || 'GET').toUpperCase();
    var maxPogingen = methode === 'GET' ? 3 : 1; // schrijfacties nooit dubbel versturen
    function poging(n) {
      var start = Date.now();
      var opts = opties || {};
      var timer = null;
      if (!opts.signal && w.AbortController) {
        var ctl = new AbortController();
        opts = Object.assign({}, opties, { signal: ctl.signal });
        timer = setTimeout(function () { ctl.abort(); }, satActief() ? 60000 : 30000);
      }
      return echteFetch(invoer, opts).then(function (r) {
        if (timer) clearTimeout(timer);
        satMeet(Date.now() - start, false);
        return r;
      }, function (e) {
        if (timer) clearTimeout(timer);
        satMeet(Date.now() - start, true);
        if (n < maxPogingen && navigator.onLine !== false) {
          return new Promise(function (klaar) { setTimeout(klaar, 1200 * n); }).then(function () { return poging(n + 1); });
        }
        // een veilig-uitstelbare schrijfactie zonder verbinding: in de wachtrij
        if (methode === 'POST' && W_PADEN.indexOf(url.split('?')[0]) !== -1 &&
            typeof (opties && opties.body) === 'string') {
          var q = wachtrij();
          q.push({ url: url, body: opties.body, at: Date.now() });
          wachtrijZet(q);
          fout(T('net.rij', 'Geen verbinding; het staat in de wachtrij en gaat vanzelf mee zodra er weer lijn is.'));
          return new Response(JSON.stringify({ ok: true, uitgesteld: true }), {
            status: 202, headers: { 'Content-Type': 'application/json' }
          });
        }
        throw e;
      });
    }
    return poging(1);
  };

  // pollers vragen per beurt of ze mogen: in de zuinige stand 1 op de 4
  var satBeurten = {};
  function satBeurt(naam) {
    var m = satActief() ? 4 : 1;
    satBeurten[naam] = (satBeurten[naam] || 0) + 1;
    return satBeurten[naam] % m === 0;
  }

  /* ---------- de offline-wachtrij ----------
     Schrijfacties die veilig een keer later mogen aankomen (een notitie, een
     dagboekmomentje, een afgevinkte leerstap) gaan bij een weggevallen
     verbinding in een wachtrij op het toestel, en worden vanzelf verstuurd
     zodra er weer lijn is. Alleen paden op deze lijst; een spelzet of een
     betaling hoort hier nadrukkelijk NIET bij (die mag nooit dubbel of laat). */
  var W_KEY = 'rtg_wachtrij';
  var W_PADEN = [
    '/api/rtf/leren/notitie', '/api/rtf/leren/schrijf-bewaar',
    '/api/rtf/baby/entry-maak', '/api/rtf/baby/gezin-zet',
    '/api/rtf/tiener/toets-stap'
  ];
  function wachtrij() { try { return JSON.parse(localStorage.getItem(W_KEY) || '[]'); } catch (e) { return []; } }
  function wachtrijZet(q) { try { localStorage.setItem(W_KEY, JSON.stringify(q.slice(0, 50))); } catch (e) {} satTeken(); }
  var wBezig = false;
  function verstuurWachtrij() {
    if (wBezig || navigator.onLine === false) return;
    var q = wachtrij();
    if (!q.length) return;
    wBezig = true;
    var item = q[0];
    echteFetch(item.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: item.body })
      .then(function (r) {
        wBezig = false;
        // gelukt, of definitief geweigerd (4xx): allebei uit de wachtrij
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
    if (aan) delen.push(T('net.sat', 'Trage verbinding: zuinige stand aan'));
    if (rij) delen.push(rij + T('net.rijWacht', ' in de wachtrij'));
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
