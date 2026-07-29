/* De wauw-laag (gedeeld): de moderne rand die elke RTG-app hoort te
   hebben, als een stille standaard -- geen stapeling van trucjes, wel
   het gevoel van een toestel van deze tijd.
   - zachte overgangen: RTGWauw.vt(fn) wikkelt een schermwissel in een
     View Transition (de document-overgangen zelf staan in rtg-uniform.css)
   - voelbare tikken: een subtiele haptiek op echte knoppen, vanzelf
   - delen: RTGWauw.deel({titel, tekst, url}) via het systeem-deelvel,
     met kopieren-naar-klembord als nette terugval
   - badge: RTGWauw.badge(n) zet het ongelezen-bolletje op het app-icoon
   - wakker: RTGWauw.wakker(aan) houdt het scherm aan op werkstations,
     en herstelt de wake lock na tabwissel vanzelf
   Alles met nette terugval: op een toestel zonder deze API's verandert
   er niets. Rustig bewegen respecteert prefers-reduced-motion. */
(function () {
  'use strict';
  if (window.RTGWauw) return;
  var rustig = function () {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  };
  var en = function () {
    try { return (localStorage.getItem('rtg_lang') || document.documentElement.lang || 'nl').indexOf('en') === 0; } catch (e) { return false; }
  };

  /* 1. Zachte overgangen binnen een pagina. */
  function vt(fn) {
    if (document.startViewTransition && !rustig()) {
      var t = document.startViewTransition(fn);
      /* Wordt de overgang overgeslagen -- er komt er meteen een tweede
         achteraan, of het tabblad is niet zichtbaar -- dan verwerpt .ready
         met een AbortError. De schermwissel zelf is dan gewoon gebeurd;
         alleen de animatie viel weg. Zonder deze vangst blijft die afwijzing
         onafgevangen en meldt de browser 'Transition was skipped' als een
         paginafout. Een overgeslagen animatie is geen fout, dus slikken we
         hem hier op: dezelfde nette terugval als een toestel zonder de API. */
      if (t && t.ready && t.ready.catch) t.ready.catch(function () {});
      return t;
    }
    var r = fn(); return { finished: Promise.resolve(r) };
  }

  /* 2. Voelbare tikken: een korte, subtiele trilling op echte knoppen. */
  function tik(patroon) {
    if (rustig()) return;
    try { if (navigator.vibrate) navigator.vibrate(patroon || 6); } catch (e) {}
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('button, [role="button"], input[type="submit"]');
    if (b && !b.disabled) tik(6);
  }, true);

  /* 3. Delen via het systeem-deelvel, met klembord als terugval. */
  function meld(tekst) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:50%;bottom:4.5rem;transform:translateX(-50%);background:#0C0C0B;color:#FFF;' +
      'padding:0.55rem 1rem;border-radius:999px;font-size:0.78rem;z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,0.35);';
    d.textContent = tekst;
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 2200);
  }
  function deel(o) {
    o = o || {};
    var data = { title: o.titel || document.title, text: o.tekst || '', url: o.url || location.href };
    if (navigator.share) return navigator.share(data).catch(function () {});
    var plat = (data.title ? data.title + ' -- ' : '') + (data.text ? data.text + ' ' : '') + data.url;
    var klaar = function () { meld(en() ? 'Copied; ready to paste.' : 'Gekopieerd; klaar om te plakken.'); tik(6); };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(plat).then(klaar, function () {});
    return Promise.resolve();
  }

  /* 4. Het ongelezen-bolletje op het geinstalleerde app-icoon. */
  function badge(n) {
    try {
      if (!navigator.setAppBadge) return;
      if (n > 0) navigator.setAppBadge(Math.min(n, 99)); else navigator.clearAppBadge();
    } catch (e) {}
  }

  /* 5. Het scherm aanhouden op een werkstation (kassa, keuken, PDA). */
  var slot = null, wilWakker = false;
  function pak() {
    if (!wilWakker || slot || !navigator.wakeLock) return;
    navigator.wakeLock.request('screen').then(function (s) {
      slot = s;
      s.addEventListener('release', function () { slot = null; });
    }).catch(function () {});
  }
  function wakker(aan) {
    wilWakker = aan !== false;
    if (!wilWakker && slot) { try { slot.release(); } catch (e) {} slot = null; }
    if (wilWakker) pak();
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') pak();
  });
  /* Werkstations herkennen we aan hun eigen aanvraag (RTGWauw.wakker()),
     aan een actieve stationsstand van de zaak-app, of aan een PDA-pagina
     (daar hoort het scherm aan te blijven tijdens de dienst). */
  try {
    var pda = /\/apps\/(personeel|gemeentepda|kantoorpda|architect-pda|hardware-pda|redactie-pda|studio-pda)\.html$/.test(location.pathname);
    if (pda || localStorage.getItem('rtg_sup_station')) wakker(true);
  } catch (e) {}

  /* 6. Het ROS-palet erbij (shared/palet.js): Ctrl/Cmd+K, overal. */
  if (!window.RTGPalet) {
    var paletS = document.createElement('script');
    paletS.src = '/shared/palet.js'; paletS.defer = true;
    document.head.appendChild(paletS);
  }

  window.RTGWauw = { vt: vt, tik: tik, deel: deel, badge: badge, wakker: wakker };
})();
