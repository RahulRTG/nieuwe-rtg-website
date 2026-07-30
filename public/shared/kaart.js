/* De kaart-uitwijk: een klein, huiseigen vangnet voor kaart-links zonder
   ook maar iets naar derden te sturen.

   Sinds we de kaart-links op geo:-URI's (RFC 5870) zetten in plaats van
   Google/OSM-deeplinks, opent Android die netjes in de kaart-app die de
   bezoeker zélf koos - een systeem-intent, geen data naar ons of naar een
   derde. Maar op de desktop (en in iOS-Safari) kent de browser het geo:-
   schema niet: een klik doet daar niets. Dit script vangt precies dat geval
   op met een eigen paneeltje dat de coördinaten (of het adres) toont en laat
   kopiëren, zodat de bezoeker ze in zíjn eigen kaart-app plakt. Geen kaart-
   provider, geen tracker, geen externe tegel - puur de coördinaten die al in
   de link stonden.

   Eén gedelegeerde klik-vanger op document, geen inline-handlers (nonce-CSP),
   en dezelfde donkere/gouden sfeer als de rest van de app-schil. De pure
   parseGeo() is los te toetsen in Node (test/kaart.test.js). */
(function (root) {
  'use strict';

  /* ---- de kern: een geo:-URI ontleden tot iets toonbaars ----
     Twee vormen komen uit het huis:
       geo:LAT,LNG?q=LAT,LNG   (echte coördinaten)
       geo:0,0?q=<adres>       (alleen een adres, geen punt op de kaart)
     We negeren nette-maar-ongebruikte extra's (;crs=, hoogte na een tweede
     komma) en accepteren ook een q= die zélf "lat,lng" is als coördinaat. */
  function parseGeo(href) {
    if (typeof href !== 'string') return null;
    var m = href.match(/^geo:([^?]*)(?:\?(.*))?$/i);
    if (!m) return null;
    var coordDeel = (m[1] || '').split(';')[0];
    var delen = coordDeel.split(',');
    var lat = parseFloat(delen[0]);
    var lng = parseFloat(delen[1]);

    var q = null;
    (m[2] || '').split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 0) return;
      if (kv.slice(0, i).toLowerCase() === 'q') {
        var ruw = kv.slice(i + 1).replace(/\+/g, ' ');
        try { q = decodeURIComponent(ruw); } catch (e) { q = ruw; }
      }
    });

    var heeftCoord = isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0);
    if (!heeftCoord && q) {
      var qm = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (qm) {
        lat = parseFloat(qm[1]); lng = parseFloat(qm[2]);
        heeftCoord = !(lat === 0 && lng === 0);
      }
    }
    var qIsCoord = /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(q || '');
    var adres = (!heeftCoord && q && !qIsCoord) ? q : null;
    var label = heeftCoord ? (lat + ', ' + lng) : (adres || '');
    return {
      lat: heeftCoord ? lat : null,
      lng: heeftCoord ? lng : null,
      q: q,
      adres: adres,
      heeftCoord: heeftCoord,
      label: label
    };
  }

  var api = { parseGeo: parseGeo };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ---- vanaf hier: alleen in de browser ---- */
  if (!root || !root.document) return;
  if (root.__rtgKaart) return; root.__rtgKaart = true;
  var doc = root.document;

  /* Android kent het geo:-schema systeembreed en opent de eigen kaart-app van
     de bezoeker - dat laten we met rust. Alles daarbuiten (desktop, iOS-Safari,
     iPadOS) krijgt ons eigen paneeltje, want daar doet geo: niets. */
  function kanGeoNatief() {
    return /Android/i.test((root.navigator && root.navigator.userAgent) || '');
  }

  function stijl() {
    if (doc.getElementById('rtg-kaart-stijl')) return;
    var css =
      '.krt-waas{position:fixed;inset:0;z-index:70;background:rgba(6,6,6,.55);' +
        'display:flex;align-items:center;justify-content:center;padding:1rem;}' +
      '.krt-kaart{width:min(360px,94vw);background:#151312;border:1px solid var(--gold,#A98F1C);' +
        'border-radius:16px;padding:1.1rem;color:#eee;font-family:Inter,system-ui,sans-serif;' +
        'box-shadow:0 14px 40px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:.7rem;}' +
      '.krt-kop{display:flex;align-items:center;justify-content:space-between;gap:.6rem;' +
        'font-weight:600;font-size:.95rem;}' +
      '.krt-x{background:transparent;border:1px solid #444;border-radius:8px;color:#eee;' +
        'padding:.12rem .5rem;cursor:pointer;font:inherit;line-height:1;}' +
      '.krt-x:hover{border-color:var(--gold,#A98F1C);color:#fff;}' +
      '.krt-val{font-size:1.12rem;font-weight:600;color:var(--gold,#C9A24B);word-break:break-word;' +
        'line-height:1.4;user-select:all;font-variant-numeric:tabular-nums;}' +
      '.krt-uitleg{font-size:.8rem;color:#bbb;line-height:1.55;}' +
      '.krt-doe{background:var(--gold,#A98F1C);border:none;border-radius:10px;color:#0C0C0B;' +
        'font:600 .9rem Inter,system-ui,sans-serif;padding:.6rem .8rem;cursor:pointer;}' +
      '.krt-doe:hover{filter:brightness(1.08);}' +
      '.krt-doe:focus-visible{outline:2px solid #fff;outline-offset:2px;}';
    var st = doc.createElement('style'); st.id = 'rtg-kaart-stijl'; st.textContent = css;
    (doc.head || doc.documentElement).appendChild(st);
  }

  var open = null, vorigeFocus = null;
  function sluit() {
    if (!open) return;
    if (open.parentNode) open.parentNode.removeChild(open);
    open = null;
    try { if (vorigeFocus && vorigeFocus.focus) vorigeFocus.focus(); } catch (e) {}
  }

  function kopieer(tekst, knop) {
    var oorspr = knop.textContent;
    function gelukt() { knop.textContent = 'Gekopieerd ✓'; setTimeout(function () { if (knop) knop.textContent = oorspr; }, 1600); }
    function terugval() {
      try {
        var ta = doc.createElement('textarea'); ta.value = tekst;
        ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
        doc.body.appendChild(ta); ta.select();
        doc.execCommand('copy'); doc.body.removeChild(ta); gelukt();
      } catch (e) {}
    }
    if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
      root.navigator.clipboard.writeText(tekst).then(gelukt, terugval);
    } else terugval();
  }

  function toon(info) {
    if (!info) return;
    stijl();
    sluit();
    vorigeFocus = doc.activeElement;
    var waas = doc.createElement('div'); waas.className = 'krt-waas';
    var kaart = doc.createElement('section');
    kaart.className = 'krt-kaart';
    kaart.setAttribute('role', 'dialog');
    kaart.setAttribute('aria-modal', 'true');
    kaart.setAttribute('aria-label', 'Locatie');

    var kop = doc.createElement('div'); kop.className = 'krt-kop';
    var titel = doc.createElement('span'); titel.textContent = info.heeftCoord ? 'Coördinaten' : 'Adres';
    var x = doc.createElement('button'); x.type = 'button'; x.className = 'krt-x'; x.setAttribute('aria-label', 'Sluiten'); x.textContent = '✕';
    kop.appendChild(titel); kop.appendChild(x);

    var val = doc.createElement('div'); val.className = 'krt-val'; val.textContent = info.label || '-';

    var uitleg = doc.createElement('div'); uitleg.className = 'krt-uitleg';
    uitleg.textContent = 'Op deze computer opent de kaart niet vanzelf. Kopieer de locatie en plak die in je eigen kaart-app.';

    var doe = doc.createElement('button'); doe.type = 'button'; doe.className = 'krt-doe';
    doe.textContent = info.heeftCoord ? 'Kopieer coördinaten' : 'Kopieer adres';

    kaart.appendChild(kop); kaart.appendChild(val); kaart.appendChild(uitleg); kaart.appendChild(doe);
    waas.appendChild(kaart);
    doc.body.appendChild(waas);
    open = waas;

    x.addEventListener('click', sluit);
    doe.addEventListener('click', function () { kopieer(info.label, doe); });
    waas.addEventListener('click', function (ev) { if (ev.target === waas) sluit(); });
    try { doe.focus(); } catch (e) {}
  }

  doc.addEventListener('click', function (ev) {
    var t = ev.target;
    var a = t && t.closest ? t.closest('a[href^="geo:"]') : null;
    if (!a) return;
    if (kanGeoNatief()) return; // laat het toestel zelf de kaart-app openen
    ev.preventDefault();
    toon(parseGeo(a.getAttribute('href')));
  });
  doc.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') sluit(); });
})(typeof self !== 'undefined' ? self : this);
