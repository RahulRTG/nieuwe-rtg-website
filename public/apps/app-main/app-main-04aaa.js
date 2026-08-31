      /* RTG ACCESS COMPOSITIE.

         De klok, Rahul en passkey bestonden al. Wat ontbrak was de formele
         producthierarchie uit het goedgekeurde ontwerp: identificatie boven,
         een vaste begroeting, een duidelijke beveiligde handeling en op
         telefoon een rustige vooruitblik op de vier werelden. Deze regels
         veranderen geen authenticatie; ze ordenen uitsluitend de bestaande
         toegangspoort. */
      '#gate{overflow-y:auto;overscroll-behavior:contain;' +
        'padding:calc(env(safe-area-inset-top,0px) + 4.25rem) 1.1rem calc(env(safe-area-inset-bottom,0px) + 1.5rem);}' +
      '#gate>.rtg-toegang-signatuur{position:absolute;top:calc(env(safe-area-inset-top,0px) + 1rem);' +
        'left:50%;right:auto;width:min(calc(100% - 2rem),50rem);transform:translateX(-50%);' +
        'margin:0;padding-bottom:.7rem;}' +
      '#gate .os-lock{flex:0 0 auto;}' +
      '#gate .ag-doos{align-items:center;max-width:36rem;margin:0 auto;}' +
      '#gate .ag-mond{margin-bottom:.1rem;}' +
      '#gate .ag-rahul-label{margin:-.15rem 0 .45rem;color:var(--gold-hoog,#E1C77B);' +
        "font:italic 500 .72rem/1 'Bodoni Moda',serif;letter-spacing:.04em;}" +
      '#gate .ag-intro{display:flex;flex-direction:column;align-items:center;width:100%;}' +
      '#gate .ag-welkom{margin:0;color:#F5EFE6;text-align:center;' +
        "font:400 clamp(2.05rem,4.4vw,3rem)/1.04 'Bodoni Moda',serif;letter-spacing:-.025em;}" +
      '#gate .ag-zin{min-height:1.8rem;max-width:38ch;margin:.45rem auto .8rem;padding:0;' +
        "font:400 .72rem/1.45 'Inter',sans-serif;color:var(--rtg-soft);letter-spacing:.02em;}" +
      '#gate .ag-passkey-kaart{width:min(100%,30rem);padding:1.05rem 1.15rem 1.15rem;' +
        'border:1px solid color-mix(in srgb,var(--gold-tekst) 48%,transparent);' +
        'background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.008));' +
        'box-shadow:0 24px 70px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.035);}' +
      '#gate .ag-passkey-kaart[hidden]{display:none;}' +
      '#gate .ag-passkey-embleem{display:grid;place-items:center;width:2.35rem;height:2.35rem;' +
        'margin:0 auto .35rem;color:var(--gold-hoog,#E1C77B);}' +
      '#gate .ag-passkey-embleem svg{display:block;width:100%;height:100%;}' +
      '#gate .ag-passkey-kaart p{margin:0 0 .75rem;text-align:center;color:#E7E0D7;' +
        "font:400 .82rem/1.4 'Inter',sans-serif;letter-spacing:.015em;}" +
      '#gate .ag-passkey{width:100%;min-width:0;min-height:54px;margin:0;padding:.8rem 1rem;' +
        'border-color:color-mix(in srgb,var(--gold-hoog,#E1C77B) 72%,transparent);' +
        'background:linear-gradient(180deg,rgba(201,162,75,.14),rgba(201,162,75,.065));' +
        'color:var(--gold-hoog,#E1C77B);font-size:.86rem;letter-spacing:.045em;}' +
      '#gate .ag-passkey:hover{background:linear-gradient(180deg,rgba(201,162,75,.21),rgba(201,162,75,.1));}' +
      '#gate .ag-passkey svg{width:22px;height:22px;}' +
      '#gate .ag-anders{display:flex;align-items:center;gap:.85rem;width:min(100%,26rem);' +
        'margin:.75rem auto 0;padding:.45rem 0;text-decoration:none;color:var(--rtg-muted);' +
        'font-size:.72rem;letter-spacing:.035em;}' +
      '#gate .ag-anders::before,#gate .ag-anders::after{content:"";height:1px;flex:1;' +
        'background:color-mix(in srgb,var(--gold-tekst) 42%,transparent);}' +
      '#gate .ag-anders span{white-space:nowrap;}' +
      '#gate .ag-anders[hidden]{display:none!important;}' +
      '#gate .ag-werelden{display:none;width:100%;margin-top:1.1rem;color:var(--rtg-soft);' +
        "font:500 .56rem/1 'Inter',sans-serif;letter-spacing:.11em;text-transform:uppercase;}" +
      '#gate .ag-werelden span{min-width:0;padding:.15rem .35rem;text-align:center;}' +
      '#gate .ag-werelden span+span{border-left:1px solid color-mix(in srgb,var(--gold-tekst) 28%,transparent);}' +
      /* Zodra iemand de gesprekspoort kiest, wordt de vaste begroeting weer
         Rahuls levende zin. Een herkende gebruiker houdt de passkey als
         compacte tweede route naast het wachtwoordveld. */
      '#gate .ag-doos:has(.ag-rij:not([hidden])) .ag-welkom{display:none;}' +
      '#gate .ag-doos:has(.ag-rij:not([hidden])) .ag-zin{font-family:\'Bodoni Moda\',serif;' +
        'font-size:clamp(1.25rem,4.6vw,1.7rem);line-height:1.3;color:#FBFAF8;' +
        'min-height:3.6rem;max-width:24ch;margin:.4rem auto 1rem;}' +
      '#gate .ag-doos:has(.ag-rij:not([hidden])) .ag-passkey-kaart{margin-top:.75rem;padding:0;border:0;' +
        'background:none;box-shadow:none;}' +
      '#gate .ag-doos:has(.ag-rij:not([hidden])) .ag-passkey-embleem,' +
      '#gate .ag-doos:has(.ag-rij:not([hidden])) .ag-passkey-kaart p{display:none;}' +
      '#gate .ag-doos:has(.ag-rij:not([hidden])) .ag-werelden{display:none;}' +
      '@media (max-width:999px){' +
        '#gate{--klokschaal:.84;padding-inline:.9rem;}' +
        '#gate .ag-werelden:not(:empty){display:grid;grid-template-columns:repeat(4,minmax(0,1fr));}' +
      '}' +
      '@media (max-height:760px){' +
        '#gate{--klokschaal:.76;padding-top:3.6rem;padding-bottom:.75rem;}' +
        '#gate>.rtg-toegang-signatuur{top:.65rem;}' +
        '#gate .ag-mond{--lipgat:calc(var(--mondbreed) * .18);}' +
        '#gate .ag-rahul-label{margin-top:-.3rem;}' +
        '#gate .ag-welkom{font-size:1.8rem;}' +
        '#gate .ag-zin{margin-bottom:.55rem;}' +
        '#gate .ag-passkey-kaart{padding:.75rem .9rem .85rem;}' +
        '#gate .ag-passkey-embleem{display:none;}' +
        '#gate .ag-passkey-kaart p{margin-bottom:.5rem;font-size:.76rem;}' +
        '#gate .ag-passkey{min-height:48px;}' +
        '#gate .ag-anders{margin-top:.45rem;}' +
        '#gate .ag-werelden{margin-top:.65rem;}' +
      '}' +
