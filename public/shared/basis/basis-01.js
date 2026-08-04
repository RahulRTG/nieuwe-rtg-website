/* De gedeelde basis-laag: het vangnet dat elke app-pagina op 9+-niveau houdt.
   Eén klein script, vier stille taken (RTGId woont in shared/id.js):
   1. offline: registreert de juiste service worker (leden-OS of RTFoundation),
      zodat elke pagina ook zonder bereik opent, en meldt rustig als de
      verbinding wegvalt of terugkomt
   2. rust: respecteert prefers-reduced-motion (alle animaties uit) en geeft
      toetsenbord-gebruikers een zichtbare focusrand
   3. begrenzing: zet een maxlength-vangnet op tekstvelden die er geen hebben
      (de server begrenst altijd al; dit voorkomt stil afgekapte invoer)
   4. leren: de app-gids (wat is dit, wat kun je hier, een leerzame tip) via
      /api/gids/app; te openen vanuit het bedieningspaneel via RTGGids.open()
   5. sfeer: laadt het lopende werk bij (shared/uurwerk.js), de gangreserve
      van het huis die als een stil verhaal over alle pagina's doorloopt
   6. kaart: laadt de kaart-uitwijk bij (shared/kaart.js), die geo:-links op
      desktop/iOS opvangt met een eigen paneeltje - coördinaten tonen en laten
      kopiëren, zonder ook maar iets naar een kaart-provider te sturen
   7. (vervallen) de OS-klok is nu zelf een rustige analoge wijzerplaat in
      shared/klok.js; het uitbundige 3D-skelet (klok3d.js) wordt niet meer
      standaard over elke ring gelegd, maar leeft als concept op /apps/horloge.html
   Geen inloggegevens nodig; werkt hetzelfde in beide werelden. */
(function () {
  'use strict';
  if (window.__rtgBasis) return; window.__rtgBasis = true;
  var rtf = location.pathname.indexOf('/apps/foundation/') === 0;

  /* In een OS-venster (same-origin iframe uit shared/vensters.js) levert de
     vensterbeheerder de rand al: titelbalk, sluiten, minimaliseren, volledig
     scherm. desktopframe.js zet deze class ook, maar staat maar op 91 van de
     188 pagina's; hier staat hij overal (de 9+-keuring eist basis.js), dus
     ook camera, clips en de RTFoundation-pagina's weten het nu. Los venster
     (popout) en mobiel hebben geen iframe en houden hun eigen kop. */
  if (window.self !== window.top) {
    try { document.documentElement.classList.add('rtg-in-frame'); } catch (e) {}
  }


  /* ---- 1. offline: de service worker + een rustig verbindingsseintje ---- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    try {
      if (rtf) navigator.serviceWorker.register('/apps/foundation/sw.js', { scope: '/apps/foundation/' }).catch(function () {});
      else navigator.serviceWorker.register('/sw.js').catch(function () {});
    } catch (e) {}
  }

  var css = '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important;}}' +
    ':focus-visible{outline:2px solid var(--gold,#A98F1C);outline-offset:2px;}' +
    '.bss-net{position:fixed;left:50%;transform:translateX(-50%);top:.6rem;z-index:60;background:#0C0C0B;border:1px solid #444;border-radius:10px;color:#eee;font:500 .8rem Inter,system-ui,sans-serif;padding:.45rem .8rem;box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:92vw;}' +
    '.bss-sheet{position:fixed;left:1rem;bottom:1rem;z-index:38;width:min(340px,92vw);background:#151312;border:1px solid var(--gold,#A98F1C);border-radius:16px;padding:1rem;color:#eee;font-family:Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:.55rem;}' +
    '.bss-sheet[hidden]{display:none;}' +
    '.bss-kop{display:flex;align-items:center;justify-content:space-between;gap:.6rem;font-weight:600;font-size:.92rem;}' +
    '.bss-x{background:transparent;border:1px solid #444;border-radius:8px;color:#eee;padding:.12rem .5rem;cursor:pointer;font:inherit;}' +
    '.bss-wat{font-size:.84rem;color:#ccc;line-height:1.55;}' +
    '.bss-doe{margin:0;padding-left:1.1rem;font-size:.82rem;color:#bbb;line-height:1.6;}' +
    '.bss-tip{font-size:.8rem;color:#d7c690;line-height:1.5;border-top:1px solid rgba(255,255,255,.08);padding-top:.55rem;}' +
    /* In een OS-venster is de paginakop dubbelop: de venstertitelbalk toont de
       naam al en de rode lamp sluit. De kop wordt daarom stil: geen balk meer
       (statisch, transparant), en titel, eyebrow en terugknop gaan uit het
       zicht maar blijven in de toegankelijkheidsboom (zelfde techniek als
       .vis-verborgen). De ACTIEknoppen in de kop (zoeken, uploaden, nieuw)
       blijven gewoon staan: dat is bediening, geen chrome. */
    'html.rtg-in-frame body>header{position:static!important;background:none!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;}' +
    'html.rtg-in-frame body>header h1,html.rtg-in-frame body>header .ey,html.rtg-in-frame body>header .terug,' +
    'html.rtg-in-frame body>header>a[href^="/apps/app.html"],html.rtg-in-frame body>header>a[href^="/apps/index.html"]' +
    '{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:0!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important;}';
  var st = document.createElement('style'); st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* de gedeelde rustlaag: één ingetogen stijl die overal dezelfde kalmte legt
     (zachte, trage overgangen + een rustige focusrand). Als apart bestand zodat
     het cachet en pagina's het kunnen overschrijven. */
  var rl = document.createElement('link');
  rl.rel = 'stylesheet'; rl.href = '/shared/rust.css';
  (document.head || document.documentElement).appendChild(rl);

  function toost(t) {
    var m = document.createElement('div'); m.className = 'bss-net'; m.setAttribute('role', 'status'); m.textContent = t;
    document.body.appendChild(m);
    setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 3500);
  }
  window.addEventListener('offline', function () { toost(rtf ? 'Even geen internet; de app werkt gewoon door waar dat kan.' : 'Geen verbinding; de app werkt door waar dat kan.'); });
  window.addEventListener('online', function () { toost('De verbinding is terug.'); });

