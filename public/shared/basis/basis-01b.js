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
    /* De hulplaag onder de uitleg. Eigen scheidingslijn, want het is een ander
       soort ding: hierboven staat wat dit scherm IS, hieronder wat je doet als
       het niet werkt. De knoppen halen 2,6rem zodat ze op telefoonformaat boven
       de 24x24 van WCAG 2.5.8 blijven; dat is de maat die de a11y-keuring op
       elk raakvlak natelt. */
    '.bss-hulp{border-top:1px solid rgba(255,255,255,.08);padding-top:.55rem;display:flex;flex-direction:column;gap:.45rem;}' +
    '.bss-hulp b{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:#d7c690;font-weight:600;}' +
    '.bss-hulp p{font-size:.8rem;color:#bbb;line-height:1.5;margin:0;}' +
    '.bss-rij{display:flex;gap:.4rem;flex-wrap:wrap;}' +
    '.bss-hulp button,.bss-zaak button{background:transparent;border:1px solid #555;border-radius:0;color:#eee;font:inherit;font-size:.8rem;padding:.5rem .7rem;min-height:2.6rem;min-width:2.6rem;cursor:pointer;}' +
    '.bss-hulp button.bss-ja,.bss-zaak button.bss-ja{background:#eee;color:#111;border-color:#eee;font-weight:600;}' +
    '.bss-zaak{font-size:.78rem;color:#bbb;line-height:1.5;border-left:2px solid #444;padding-left:.55rem;display:flex;flex-direction:column;gap:.35rem;}' +
    '.bss-zaak i{font-style:normal;color:#d7c690;}' +
    '.bss-veld{width:100%;background:transparent;color:#eee;border:1px solid #555;border-radius:0;font:inherit;font-size:.82rem;padding:.5rem;}' +
