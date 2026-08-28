  /* Op de telefoon blijft de driedelige WerkOS-schil volledig bruikbaar.
     De contextbalk krijgt een eigen rij, de rail blijft een compacte
     glyfenstrook en de dock houdt altijd Start en Command Center bereikbaar. */
  @media (max-width:620px){
    body.wos.wos-aan:not(.wos-thuis) .wos-pill{display:flex;}
    body.wos .wos-rail{width:50px;}
    body.wos .wos-rail-kop{font-size:0;height:36px;padding:0;}
    body.wos .wos-rail-kop::after{content:"W";height:36px;display:grid;place-items:center;font:500 .75rem var(--rtg-display,'Bodoni Moda',serif);color:var(--gold-tekst,var(--rtg-goud));}
    body.wos .wos-rail button{grid-template-columns:1fr;padding:.5rem;justify-items:center;min-height:48px;}
    body.wos .wos-rail button span{display:none;}
    body.wos.wos-aan .topbar,body.wos.wos-aan .content,body.wos.wos-bord-aan header,body.wos.wos-bord-aan #app{margin-left:50px;}
    body.wos.wos-aan .topbar{padding-top:calc(env(safe-area-inset-top,0px) + 4.15rem);}
    body.wos.wos-bord-aan header{padding-top:calc(env(safe-area-inset-top,0px) + 4rem);}
    .wos-dock{left:calc(50% + 25px);bottom:calc(env(safe-area-inset-bottom,0px) + .65rem);max-width:calc(100vw - 62px);overflow:hidden;}
    .wos-dock button{width:44px;height:44px;}
    body.wos .wos-top-context{position:fixed;z-index:55;top:calc(env(safe-area-inset-top,0px) + .55rem);right:.55rem;left:.55rem;transform:none;height:42px;}
    body.wos .wos-top-context button{width:42px;flex:0 0 42px;}
    body.wos .wos-top-huidig{display:flex;min-width:0;flex:1;overflow:hidden;}
    body.wos .wos-top-huidig b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .wos-zoek{padding:.65rem;}
    .wos-zoek-paneel{height:100%;grid-template-rows:64px minmax(0,1fr) 40px;}
    .wos-zoek-voet{gap:.55rem;}
    .wos-zoek-voet span:nth-child(2){display:none;}
  }
  @media (max-width:360px){.wos-dock button:nth-child(n+5):not(:last-child){display:none;}}
