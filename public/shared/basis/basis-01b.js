/* Vervolg van basis-01 (op de 10 kB-grens geknipt na de thema-toevoeging van
   de consolidatieronde; de bundelvolgorde is alfabetisch, dus 01, 01b, 02).
   Sectie 1 en verder: offline, verbinding, en de rest. */
  /* ---- 1. offline: de service worker + een rustig verbindingsseintje ---- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    try {
      if (rtf) navigator.serviceWorker.register('/apps/foundation/sw.js', { scope: '/apps/foundation/' }).catch(function () {});
      else navigator.serviceWorker.register('/sw.js').catch(function () {});
    } catch (e) {}
  }

  var css = '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important;}}' +
    ':focus-visible{outline:2px solid var(--gold,#A98F1C);outline-offset:2px;}' +
    /* Het toegankelijkheidsprofiel, inline en niet als apart blad: wie grote
       tekst nodig heeft hoort daar niet eerst een netwerkronde op te wachten.
       De tekstmaat werkt omdat de hele familie in rem meet (ruim drieduizend
       plekken, en precies een in px). Hoog contrast tilt de twee gedempte
       tinten van het huis op zonder een nieuwe kleur te verzinnen: zelfde
       #F4F1EC, alleen minder doorzichtig. */
    'html.rtg-tekst-groot{font-size:118%;}' +
    'html.rtg-tekst-groter{font-size:135%;}' +
    'html.rtg-contrast{--rtg-txt:#FFFFFF;--rtg-muted:rgba(244,241,236,0.94);--rtg-soft:rgba(244,241,236,0.88);--rtg-line:rgba(255,255,255,0.32);}' +
    'html.rtg-stil *,html.rtg-stil *::before,html.rtg-stil *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important;}' +
    /* Rustig: alles even luid. De accentkleuren van het huis worden de gewone
       tekstkleur, en dikke randen worden dunne lijnen -- zodat niets aan de
       aandacht trekt dat dat niet verdient. */
    'html.rtg-rustig{--gold:var(--txt);--goud:var(--txt);--goldlicht:var(--muted,var(--soft));}' +
    'html.rtg-rustig [class*="badge"],html.rtg-rustig [class*="pill"]{filter:saturate(.35);}' +
    'html.rtg-rustig *{border-width:1px!important;box-shadow:none!important;}' +
    'html.rtg-linkstreep a{text-decoration:underline!important;text-underline-offset:.18em;}' +
    '.bss-net{position:fixed;left:50%;transform:translateX(-50%);top:.6rem;z-index:60;background:#0C0C0B;border:1px solid #444;border-radius:0;color:#eee;font:500 .8rem Inter,system-ui,sans-serif;padding:.45rem .8rem;box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:92vw;}' +
    '.bss-sheet{position:fixed;left:1rem;bottom:1rem;z-index:38;width:min(340px,92vw);background:#151312;border:1px solid var(--gold,#A98F1C);border-radius:0;padding:1rem;color:#eee;font-family:Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:.55rem;}' +
    '.bss-sheet[hidden]{display:none;}' +
    '.bss-kop{display:flex;align-items:center;justify-content:space-between;gap:.6rem;font-weight:600;font-size:.92rem;}' +
    '.bss-x{background:transparent;border:1px solid #444;border-radius:0;color:#eee;padding:.12rem .5rem;cursor:pointer;font:inherit;}' +
    '.bss-wat{font-size:.84rem;color:#ccc;line-height:1.55;}' +
    '.bss-doe{margin:0;padding-left:1.1rem;font-size:.82rem;color:#bbb;line-height:1.6;}' +
    '.bss-tip{font-size:.8rem;color:#d7c690;line-height:1.5;border-top:1px solid rgba(255,255,255,.08);padding-top:.55rem;}' +
    /* In een split-paneel is de grote titel dubbelop: je hebt de app zelf net
       gekozen in de paneelkiezer. De titel en de terugknop gaan daarom uit het
       zicht maar blijven in de toegankelijkheidsboom (zelfde techniek als
       .vis-verborgen). De ACTIEknoppen in de balk (zoeken, uploaden, nieuw)
       blijven gewoon staan: dat is bediening, geen chrome. */
    'html.rtg-in-frame body>header{position:static!important;background:none!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;}' +
    'html.rtg-in-frame .ios-groot,html.rtg-in-frame body>header h1,' +
    'html.rtg-in-frame body>header .ios-terug,html.rtg-in-frame body>header .terug,' +
    'html.rtg-in-frame body>header>a[href^="/apps/app.html"]' +
    '{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:0!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important;}';
  var st = document.createElement('style'); st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* de gedeelde rustlaag: één ingetogen stijl die overal dezelfde kalmte legt
     (zachte, trage overgangen + een rustige focusrand). Als apart bestand zodat
     het cachet en pagina's het kunnen overschrijven. */
  var rl = document.createElement('link');
  rl.rel = 'stylesheet'; rl.href = '/shared/rust.css';
  (document.head || document.documentElement).appendChild(rl);

  /* de trage helft van de toegankelijkheid: bij de server ophalen wat het lid
     heeft ingesteld, zodat een tweede toestel het ook krijgt. Zonder haast --
     de stand van dit toestel staat hierboven al op het scherm. */
  var tgs = document.createElement('script');
  tgs.src = '/shared/toegankelijk.js'; tgs.async = true;
  (document.head || document.documentElement).appendChild(tgs);

  /* ---- de gebarenlaag: twee laden onder elke regel ----------------------
     Hij ligt op elk appscherm en DOET IN RUST NIETS. Geen element erbij, geen
     stijl erover; hij wordt pas wakker als een scherm zegt welke acties een
     regel draagt (RTGGebaar.zet / RTGGebaar.lijst). Zo staat de bediening op
     EEN plek in plaats van acht keer net anders (LAT.md regel 4), en kost een
     scherm dat hem niet gebruikt precies niets.

     Zonder haast: een veeg is een tweede handeling, nooit de eerste. Het blad
     laadt de laag zelf bij, dus een pagina hoeft er geen <link> voor te kennen. */
  if (!window.RTGGebaar && !document.querySelector('script[src^="/shared/gebaar.js"]')) {
    var gb = document.createElement('script');
    gb.src = '/shared/gebaar.js'; gb.async = true;
    (document.head || document.documentElement).appendChild(gb);
  }

  function toost(t) {
    var m = document.createElement('div'); m.className = 'bss-net'; m.setAttribute('role', 'status'); m.textContent = t;
    document.body.appendChild(m);
    setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 3500);
  }
  window.addEventListener('offline', function () { toost(rtf ? 'Even geen internet; de app werkt gewoon door waar dat kan.' : 'Geen verbinding; de app werkt door waar dat kan.'); });
  window.addEventListener('online', function () { toost('De verbinding is terug.'); });


  /* ---- 9. de overdracht: wat een lid uit zijn mand meenam naar dit scherm
     (shared/overdracht.js). Bevestigen gebeurt in het domein dat er al over
     gaat, en die deuren staan verspreid over tientallen schermen -- dus staat
     de balk op EEN plek en niet in elk van hen. Hij wordt alleen bijgeladen als
     er ook werkelijk een briefje in het adres staat; op elk ander scherm kost
     dit niets. De uitleg staat in kern/commerce/overdracht.js.

     Hij hoort hier en niet bij punt 5 en 6 in basis-02.js, waar de andere twee
     bijladers staan: dat deel zat op 9894 bytes en zou met dit blok over de
     10 kB-leesgrens gaan. Een deelbestand is een GROOTTE-grens en geen
     betekenisgrens -- alle delen draaien in dezelfde functie. ---- */
  if (location.search.indexOf('overdracht=') >= 0) {
    var ovdS = document.createElement('script');
    ovdS.src = '/shared/overdracht.js'; ovdS.async = true;
    (document.head || document.documentElement).appendChild(ovdS);
  }

  /* ---- de toestelsleutel: het bezitsbewijs bij zware handelingen ----
     NIET async: dit script haakt op fetch, en laadt het pas na het eerste
     betaalverzoek, dan gaat dat verzoek zonder bewijs de deur uit. De uitleg
     staat in shared/toestelsleutel.js; hier staat het omdat een regel die op
     elk scherm herhaald moet worden, over een half jaar op een scherm
     ontbreekt -- en dat is dan het scherm waar geld beweegt. */
  var tsl = document.createElement('script');
  tsl.src = '/shared/toestelsleutel.js';
  (document.head || document.documentElement).appendChild(tsl);
