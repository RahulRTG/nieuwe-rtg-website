      /* RTG ID BALLOTAGE.

         Geen losse klok, vraag en invoerbalk meer, maar één toegangsmoment:
         identiteit en verhaal links, het beveiligde gesprek op ivoor rechts.
         Op telefoon worden dezelfde onderdelen verticaal gezet. De echte
         klok, Rahul-mond, servervragen en Edge-bediening blijven intact. */

      /* Het woordmerk is typografie IN de Edge. Beide delen zijn transparant,
         zodat achter het logo exact hetzelfde bordeaux staat als achter de
         wereldknoppen, status en profiel -- geen afwijkend logovlak. */
      'body:has(#gate .ag-doos.ag-ballotage){--rtg-id-edge-brand:clamp(13rem,19vw,15.5rem);}' +
      'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-top{' +
        'grid-template-columns:var(--rtg-id-edge-brand) minmax(7rem,1fr) auto auto 44px 44px 44px;' +
        'background:var(--edge-bar-bg)!important;}' +
      'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-bottom{background:var(--edge-bar-bg)!important;}' +
      'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-mark{' +
        'place-items:center;padding:.2rem .8rem;background:transparent!important;border-right-color:var(--edge-bar-line);}' +
      'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-mark-short{display:none;}' +
      'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-mark-lockup{' +
        'display:grid;grid-template-rows:auto auto;align-content:center;width:100%;height:100%;gap:.08rem;background:transparent!important;}' +
      'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-mark-lockup strong{' +
        'display:block;min-width:0;padding:0;background:transparent!important;color:#fff8ed;text-align:center;' +
        "font:400 clamp(.86rem,1.35vw,1.12rem)/1 'Bodoni Moda',Didot,Georgia,serif;" +
        'letter-spacing:-.035em;white-space:nowrap;}' +
      'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-mark-lockup small{' +
        'padding-bottom:.1rem;background:transparent!important;color:#d8bd6b;text-align:center;text-transform:uppercase;' +
        "font:400 .4rem/1 'Bodoni Moda',Didot,Georgia,serif;letter-spacing:.1em;white-space:nowrap;}" +
      'body:has(#gate .ag-doos.ag-ballotage) .rtg-edge-side{' +
        'transform:translateX(-101%)!important;visibility:hidden;}' +
      'body:has(#gate .ag-doos.ag-ballotage) #rtgCommand .cmd-bank,' +
      'body:has(#gate .ag-doos.ag-ballotage) #rtgCommand .cmd-tabs,' +
      'body:has(#gate .ag-doos.ag-ballotage) #rtgCommand .cmd-toevoeg,' +
      'body:has(#gate .ag-doos.ag-ballotage) #rtgCommand .cmd-kiezer,' +
      'body:has(#gate .ag-doos.ag-ballotage) #rtgCommand .cmd-praat,' +
      'body:has(#gate .ag-doos.ag-ballotage) #rtgCommand .cmd-balk{display:none!important;}' +

      /* `display:contents` laat verhaal en klok samen de linkerhelft vormen
         zonder een tweede klok of een los decoratief instrument te maken. */
      '#gate .rtg-id-intro{display:none;}' +
      '#gate:has(.ag-doos.ag-ballotage){' +
        '--klokschaal:.56;display:grid;grid-template-columns:minmax(20rem,1fr) minmax(27rem,.88fr);' +
        'grid-template-rows:auto auto auto;align-content:center;column-gap:clamp(3rem,7vw,7rem);' +
        'overflow-y:auto;padding:calc(var(--edge-top,44px) + 2rem) clamp(3rem,7vw,7rem) ' +
        'calc(var(--edge-bottom,48px) + 2rem);background:' +
        'radial-gradient(circle at 12% 40%,rgba(126,18,54,.15),transparent 27%),' +
        'radial-gradient(circle at 82% 74%,rgba(197,158,69,.09),transparent 25%),var(--bg);}' +
      '#gate:has(.ag-doos.ag-ballotage)>.rtg-toegang-signatuur{display:none;}' +
      '#gate:has(.ag-doos.ag-ballotage)>.rtg-id-intro{display:contents;}' +
      '#gate:has(.ag-doos.ag-ballotage) .rtg-id-kicker{' +
        'position:relative;z-index:2;grid-column:1;grid-row:1;align-self:end;margin-bottom:.9rem;color:#dfca8c;' +
        "font:700 .62rem/1 'Inter',sans-serif;letter-spacing:.28em;text-transform:uppercase;}" +
      '#gate:has(.ag-doos.ag-ballotage) .rtg-id-kicker span{' +
        'display:inline-block;width:1.7rem;height:1px;margin:0 .7rem .2rem 0;background:#c8a959;}' +
      '#gate:has(.ag-doos.ag-ballotage)>.os-lock{' +
        'grid-column:1;grid-row:2;align-self:center;justify-self:start;width:11rem;height:11rem;' +
        'margin:0 0 1.1rem clamp(4.5rem,8.5vw,8rem);padding:0;}' +
      '#gate:has(.ag-doos.ag-ballotage)>.os-lock>.rtg-ring{' +
        'flex:0 0 var(--rtg-klok-maat,16rem);}' +
      '#gate:has(.ag-doos.ag-ballotage) .rtg-id-story{' +
        'position:relative;z-index:2;grid-column:1;grid-row:3;align-self:start;max-width:35rem;}' +
      '#gate:has(.ag-doos.ag-ballotage) .rtg-id-story p{' +
        'margin:0 0 .8rem;color:#dfca8c;font-size:.61rem;font-weight:650;letter-spacing:.28em;text-transform:uppercase;}' +
      '#gate:has(.ag-doos.ag-ballotage) .rtg-id-story h1{' +
        'max-width:12ch;margin:0;color:#f7f0e5;' +
        "font:400 clamp(2.8rem,4.5vw,4.6rem)/.98 'Bodoni Moda',Didot,Georgia,serif;letter-spacing:-.045em;}" +
      '#gate:has(.ag-doos.ag-ballotage) .rtg-id-story div{' +
        'max-width:38rem;margin-top:1rem;color:#b8aaa0;font-size:.84rem;line-height:1.65;}' +
