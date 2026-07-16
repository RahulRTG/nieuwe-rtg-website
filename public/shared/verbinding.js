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
        if (n >= maxPogingen || navigator.onLine === false) throw e;
        return new Promise(function (klaar) { setTimeout(klaar, 1200 * n); }).then(function () { return poging(n + 1); });
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

  // het balkje onderin: eerlijk zeggen dat de zuinige stand aanstaat
  var satEl;
  function satTeken() {
    var aan = satActief();
    if (!aan) { if (satEl) { satEl.remove(); satEl = null; } return; }
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
      tekst.textContent = T('net.sat', '🛰 Trage verbinding: zuinige stand aan');
      var uit = document.createElement('button');
      uit.type = 'button';
      uit.textContent = '✕';
      uit.setAttribute('aria-label', T('net.satUit', 'Zuinige stand uitzetten'));
      uit.style.cssText = 'background:none;border:0;color:#8fa6ba;cursor:pointer;font-size:.8rem;padding:0;';
      uit.addEventListener('click', function () { satZet('uit'); });
      satEl.appendChild(tekst); satEl.appendChild(uit);
      document.body.appendChild(satEl);
    }
  }
  if (satActief()) satTeken();

  w.Satelliet = {
    actief: satActief, stand: satStand, zetStand: satZet, beurt: satBeurt,
    multiplier: function () { return satActief() ? 4 : 1; }
  };

  w.RTGNet = { toon: toonBanner, verberg: verbergBanner, fout: fout, haal: haal, status: status, satelliet: w.Satelliet };
})(window);
