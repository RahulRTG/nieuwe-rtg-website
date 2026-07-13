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

  w.RTGNet = { toon: toonBanner, verberg: verbergBanner, fout: fout, haal: haal, status: status };
})(window);
