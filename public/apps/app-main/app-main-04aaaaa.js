      /* De ballotagekaart en haar mobiele herschikking. */
      '#gate:has(.ag-doos.ag-ballotage)>.ag-doos{' +
        'position:relative;grid-column:2;grid-row:1/4;align-self:center;align-items:stretch;' +
        'width:100%;max-width:38rem;min-height:31rem;margin:0;padding:2.5rem 2.65rem 2.1rem;' +
        'overflow:hidden;color:#241711;background:#f4ede1;' +
        'border:1px solid rgba(200,169,89,.85);border-radius:0;' +
        'box-shadow:0 2rem 5rem rgba(0,0,0,.42);}' +
      '#gate .ag-doos.ag-ballotage::after{' +
        'content:attr(data-stap) " / " attr(data-van);position:absolute;top:2.3rem;right:2.45rem;color:#9a7f39;' +
        "font:400 1.45rem/1 'Bodoni Moda',serif;letter-spacing:.02em;}" +
      '#gate .ag-doos.ag-ballotage .ag-kop{' +
        'display:block;width:calc(100% - 5.5rem);margin:0 0 1.35rem;color:#8d1238;text-align:left;opacity:1;}' +
      '#gate .ag-doos.ag-ballotage .ag-kop::before,' +
      '#gate .ag-doos.ag-ballotage .ag-kop::after{display:none;}' +
      '#gate .ag-doos.ag-ballotage .ag-kop span{' +
        'display:block;margin-bottom:.42rem;font-size:.56rem;font-weight:750;letter-spacing:.28em;text-transform:uppercase;}' +
      '#gate .ag-doos.ag-ballotage .ag-kop strong{' +
        'display:block;color:#241711;text-transform:none;' +
        "font:400 1.75rem/1 'Bodoni Moda',serif;letter-spacing:-.025em;}" +
      '#gate .ag-doos.ag-ballotage .ag-mond{' +
        '--mondbreed:5.6rem;--doekhoog:2.55rem;--doekleeg:.72rem;--lipgat:.72rem;' +
        'width:var(--mondbreed);height:auto;margin:calc(var(--lipgat) - var(--doekleeg)) auto .2rem;opacity:.8;}' +
      '#gate .ag-doos.ag-ballotage .ag-rahul-label{' +
        'margin:0 0 .55rem;color:#8d1238;text-align:left;' +
        "font:italic 500 .88rem/1 'Bodoni Moda',serif;letter-spacing:.01em;}" +
      '#gate .ag-doos.ag-ballotage .ag-intro{' +
        'align-items:flex-start;background:#f4ede1!important;background-image:none!important;box-shadow:none!important;}' +
      '#gate .ag-doos.ag-ballotage .ag-zin{' +
        'display:block;width:100%;max-width:17ch;min-height:0;margin:0;padding:0;color:#241711!important;' +
        'background:#f4ede1!important;background-image:none!important;border:0!important;box-shadow:none!important;' +
        'filter:none!important;backdrop-filter:none!important;text-align:left;text-wrap:balance;' +
        "font:400 clamp(2.15rem,3vw,3.25rem)/1.02 'Bodoni Moda',serif!important;letter-spacing:-.04em;}" +
      '#gate .ag-doos.ag-ballotage .ag-vraag-hint{' +
        'display:block;max-width:34rem;margin:.6rem 0 0;color:#776a60;font-size:.72rem;line-height:1.45;}' +
      '#gate .ag-doos:not(.ag-ballotage) .ag-vraag-hint,#gate .ag-doos:not(.ag-ballotage) .ag-veld-label,' +
      '#gate .ag-doos:not(.ag-ballotage) .ag-id-privacy{display:none;}' +
      '#gate .ag-doos.ag-ballotage .ag-rij{' +
        'position:relative;width:100%;min-height:4.35rem;margin:1.55rem 0 0;padding:1.3rem 4rem .25rem .95rem;' +
        'background:transparent;border:1px solid #b79540;border-radius:0;box-shadow:none;}' +
      '#gate .ag-doos.ag-ballotage .ag-rij:focus-within{border-color:#8d1238;box-shadow:0 0 0 3px rgba(141,18,56,.09);}' +
      '#gate .ag-doos.ag-ballotage .ag-veld-label{' +
        'position:absolute;top:.62rem;left:.95rem;color:#8d1238;font-size:.48rem;font-weight:750;' +
        'letter-spacing:.2em;text-transform:uppercase;pointer-events:none;}' +
      '#gate .ag-doos.ag-ballotage .ag-rij input{' +
        'width:100%;padding:.25rem 0;background:transparent;color:#241711;text-align:left;font-size:.92rem;}' +
      '#gate .ag-doos.ag-ballotage .ag-rij input::placeholder{color:#978b81;}' +
      '#gate .ag-doos.ag-ballotage .ag-rij #agGo{' +
        'position:absolute;top:50%;right:.55rem;display:grid;place-items:center;width:2.85rem;height:2.85rem;' +
        'transform:translateY(-50%);padding:0;border:0;border-radius:50%;background:#b39033;color:#160f0c;opacity:1;}' +
      '#gate .ag-doos.ag-ballotage .ag-stappen{' +
        'display:grid;width:100%;grid-template-columns:repeat(4,1fr);gap:.35rem;margin:.8rem 0 0;' +
        'background:none!important;border:0;box-shadow:none!important;opacity:1;}' +
      '#gate .ag-doos.ag-ballotage .ag-stappen span{' +
        'height:2px;padding:0;overflow:hidden;background:#d7ccbd;color:transparent;font-size:0;}' +
      '#gate .ag-doos.ag-ballotage .ag-stappen span.nu{background:#8d1238;color:transparent;}' +
      '#gate .ag-doos.ag-ballotage .ag-stappen span.gehad{background:rgba(141,18,56,.48);color:transparent;}' +
      '#gate .ag-doos.ag-ballotage .ag-id-privacy{' +
        'display:flex;align-items:center;gap:.35rem;margin:.75rem 0 0;color:#75685e;font-size:.59rem;line-height:1.3;}' +
      '#gate .ag-doos.ag-ballotage .ag-id-privacy i{' +
        'width:.35rem;height:.35rem;flex:0 0 auto;border-radius:50%;background:#2e9b68;box-shadow:0 0 0 3px rgba(46,155,104,.08);}' +
      '#gate .ag-doos.ag-ballotage .ag-kluis{' +
        'justify-content:flex-start;margin:.55rem 0 0;color:#75685e;font-size:.59rem;letter-spacing:.02em;}' +
      '#gate .ag-doos.ag-ballotage .ag-passkey-kaart,' +
      '#gate .ag-doos.ag-ballotage .ag-anders,#gate .ag-doos.ag-ballotage .ag-werelden{display:none!important;}' +

      '@media (max-width:899px){' +
        'body:has(#gate .ag-doos.ag-ballotage){--rtg-id-edge-brand:min(11.2rem,48vw);}' +
        'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-top{' +
          'grid-template-columns:var(--rtg-id-edge-brand) minmax(0,1fr) 44px 44px;}' +
        'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-crumbs,' +
        'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-worldbar,' +
        'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-state,' +
        'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-search{display:none!important;}' +
        'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-mark{padding:.2rem .55rem;}' +
        'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-mark-lockup strong{font-size:.82rem;}' +
        'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-mark-lockup small{font-size:.35rem;}' +
        '#gate:has(.ag-doos.ag-ballotage){' +
          '--klokschaal:.42;display:grid;grid-template-columns:1fr;grid-template-rows:auto auto auto auto;' +
          'align-content:start;gap:0;overflow-x:hidden;overflow-y:auto;padding:' +
          'calc(var(--edge-top,44px) + .9rem) 1rem calc(var(--edge-bottom,48px) + .8rem);}' +
        '#gate:has(.ag-doos.ag-ballotage) .rtg-id-kicker{' +
          'grid-column:1;grid-row:1;margin:0 0 .35rem;padding-left:.5rem;}' +
        '#gate:has(.ag-doos.ag-ballotage)>.os-lock{' +
          'grid-column:1;grid-row:2;justify-self:center;width:7.4rem;height:7.4rem;margin:0 0 .55rem;}' +
        '#gate:has(.ag-doos.ag-ballotage) .rtg-id-story{' +
          'grid-column:1;grid-row:3;justify-self:center;width:100%;max-width:23rem;min-height:6.4rem;text-align:center;}' +
        '#gate:has(.ag-doos.ag-ballotage) .rtg-id-story p{margin-bottom:.5rem;font-size:.52rem;letter-spacing:.22em;}' +
        '#gate:has(.ag-doos.ag-ballotage) .rtg-id-story h1{' +
          'max-width:13ch;margin:auto;font-size:clamp(2rem,9vw,2.55rem);line-height:1;}' +
        '#gate:has(.ag-doos.ag-ballotage) .rtg-id-story div{display:none;}' +
        '#gate:has(.ag-doos.ag-ballotage)>.ag-doos{' +
          'grid-column:1;grid-row:4;width:100%;max-width:31rem;min-height:25rem;margin:1.05rem 0 0;' +
          'padding:1.45rem 1.3rem 1.15rem;border-radius:0;}' +
        '#gate .ag-doos.ag-ballotage::after{top:1.45rem;right:1.3rem;font-size:1.35rem;}' +
        '#gate .ag-doos.ag-ballotage .ag-kop{width:calc(100% - 4.7rem);margin-bottom:.7rem;}' +
        '#gate .ag-doos.ag-ballotage .ag-kop span{font-size:.5rem;}' +
        '#gate .ag-doos.ag-ballotage .ag-kop strong{font-size:1.35rem;}' +
        '#gate .ag-doos.ag-ballotage .ag-mond{' +
          '--mondbreed:4.6rem;--doekhoog:2.1rem;--doekleeg:.58rem;--lipgat:.58rem;margin-bottom:0;}' +
        '#gate .ag-doos.ag-ballotage .ag-rahul-label{margin-bottom:.45rem;font-size:.78rem;}' +
        '#gate .ag-doos.ag-ballotage .ag-zin{max-width:16ch;font-size:clamp(1.65rem,7.1vw,2rem)!important;}' +
        '#gate .ag-doos.ag-ballotage .ag-vraag-hint{margin-top:.4rem;font-size:.65rem;}' +
        '#gate .ag-doos.ag-ballotage .ag-rij{min-height:3.9rem;margin-top:1.05rem;padding-right:3.6rem;}' +
        '#gate .ag-doos.ag-ballotage .ag-rij #agGo{width:2.55rem;height:2.55rem;}' +
        '#gate .ag-doos.ag-ballotage .ag-id-privacy{margin-top:.6rem;font-size:.54rem;}' +
      '}' +
      '@media (max-width:899px) and (max-height:720px){' +
        '#gate:has(.ag-doos.ag-ballotage){--klokschaal:.31;padding-top:calc(var(--edge-top,44px) + .45rem);}' +
        '#gate:has(.ag-doos.ag-ballotage)>.os-lock{width:5.3rem;height:5.3rem;margin-bottom:.25rem;}' +
        '#gate:has(.ag-doos.ag-ballotage) .rtg-id-story p{display:none;}' +
        '#gate:has(.ag-doos.ag-ballotage) .rtg-id-story h1{font-size:1.7rem;}' +
        '#gate:has(.ag-doos.ag-ballotage)>.ag-doos{margin-top:.65rem;padding-top:1.15rem;}' +
        '#gate .ag-doos.ag-ballotage::after{top:1.15rem;}' +
        '#gate .ag-doos.ag-ballotage .ag-mond,#gate .ag-doos.ag-ballotage .ag-rahul-label{display:none;}' +
        '#gate .ag-doos.ag-ballotage .ag-zin{font-size:1.65rem;}' +
      '}' +
