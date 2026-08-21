  /* De onderbalk is een onyx commandobalk, geen los merkobject. */
  .wos-dock{
    position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + .8rem);
    z-index:60;display:none;align-items:stretch;padding:0;
    background:color-mix(in srgb,var(--onyx-basis,#0C0C0B) 94%,transparent);
    border:1px solid var(--rtg-line);border-top-color:var(--gold-rand,var(--rtg-goud));
    box-shadow:none;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  }
  body.wos.wos-aan .wos-dock,body.wos.wos-bord-aan .wos-dock{display:flex;}
  .wos-dock button{
    position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;
    border:0;border-left:1px solid var(--rtg-line);border-radius:0;background:transparent;color:var(--rtg-muted);
    cursor:pointer;transition:color var(--rtg-tijd-kort,120ms) var(--rtg-veer,ease),background var(--rtg-tijd-kort,120ms) var(--rtg-veer,ease);
  }
  .wos-dock button:first-child{border-left:0;}
  .wos-dock button:hover{background:rgba(255,255,255,.035);color:var(--rtg-txt);}
  .wos-dock button:focus-visible{outline:1px solid var(--gold-tekst,var(--rtg-goud));outline-offset:-3px;}
  .wos-dock button svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:var(--rtg-stroke,1.6);stroke-linecap:round;stroke-linejoin:round;}
  .wos-dock button.actief{color:var(--gold-tekst,var(--rtg-goud));background:rgba(255,255,255,.025);}
  .wos-dock button.actief::after{content:"";position:absolute;left:12px;right:12px;bottom:0;height:2px;background:var(--gold-basis,#857007);}
  @media (hover:hover) and (min-width:700px){
    .wos-dock button::before{
      content:attr(data-label);position:absolute;left:50%;bottom:calc(100% + 9px);transform:translate(-50%,3px);opacity:0;
      pointer-events:none;white-space:nowrap;background:var(--onyx-basis,#0C0C0B);border:1px solid var(--rtg-line);
      padding:.32rem .48rem;color:var(--rtg-txt);font-size:.55rem;letter-spacing:.04em;transition:opacity .12s,transform .12s;
    }
    .wos-dock button:hover::before{opacity:1;transform:translate(-50%,0);}
  }

  /* Command Center gebruikt op desktop het hele werkvlak: commando links,
     resultaten in het midden en context rechts. */
  .wos-zoek{
    position:fixed;inset:0;z-index:90;display:none;align-items:stretch;justify-content:center;
    padding:clamp(1rem,3vw,2.4rem);background:rgba(5,5,5,.88);
    backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  }
  .wos-zoek.open{display:flex;}
  body.wos-command-open{overflow:hidden;}
  .wos-zoek-paneel{
    width:min(1180px,100%);height:100%;min-height:0;display:grid;grid-template-rows:76px minmax(0,1fr) 44px;
    border:1px solid var(--rtg-line);border-top-color:var(--gold-rand,var(--rtg-goud));
    background:var(--onyx-glans,var(--onyx-basis,#0C0C0B));box-shadow:none;overflow:hidden;
  }
  .wos-zoek-kop{display:flex;align-items:center;padding:0 1.2rem;border-bottom:1px solid var(--rtg-line);background:transparent;}
  .wos-zoek-kop b{font-family:var(--rtg-display,'Bodoni Moda',serif);font-size:1.35rem;font-weight:500;color:var(--rtg-txt);}
  .wos-zoek-kop span{display:block;margin-top:.15rem;font-size:.5rem;letter-spacing:.16em;text-transform:uppercase;color:var(--rtg-soft);font-weight:650;}
  .wos-zoek-sluit{margin-left:auto;width:34px;height:34px;border:1px solid var(--rtg-line);border-radius:0;background:transparent;color:var(--rtg-muted);cursor:pointer;}
  .wos-zoek-sluit:hover{color:var(--rtg-txt);border-color:var(--gold-rand,var(--rtg-line));}
  .wos-zoek-sluit:focus-visible{outline:1px solid var(--gold-tekst,var(--rtg-goud));outline-offset:2px;}
  .wos-zoek-body{min-height:0;display:grid;grid-template-columns:190px minmax(0,1fr) 260px;}
  .wos-zoek-rail{padding:1.25rem 1rem;border-right:1px solid var(--rtg-line);}
  .wos-zoek-rail>span,.wos-context>span{display:block;font-size:.5rem;letter-spacing:.18em;text-transform:uppercase;color:var(--rtg-soft);}
  .wos-zoek-rail ol{list-style:none;margin:1.1rem 0 0;padding:0;border-top:1px solid var(--rtg-line);counter-reset:stap;}
  .wos-zoek-rail li{counter-increment:stap;padding:.72rem 0;border-bottom:1px solid var(--rtg-line);color:var(--rtg-muted);font-size:.68rem;}
  .wos-zoek-rail li::before{content:"0" counter(stap);display:inline-block;width:2.2rem;color:var(--rtg-soft);font-size:.48rem;letter-spacing:.1em;}
  .wos-zoek-rail li:first-child{color:var(--rtg-txt);box-shadow:inset 2px 0 var(--gold-basis,#857007);padding-left:.55rem;}
  .wos-zoek-kern{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);}
  .wos-zoek-veld{position:relative;margin:1.05rem;border-bottom:1px solid var(--rtg-line);padding-bottom:1.05rem;}
  .wos-zoek-veld::before{content:"/";position:absolute;left:.9rem;top:calc(50% - .5rem);transform:translateY(-50%);color:var(--gold-tekst,var(--rtg-goud));font-family:var(--rtg-display,'Bodoni Moda',serif);font-size:1.08rem;}
  .wos-zoek-paneel input{width:100%;padding:.84rem 1rem .84rem 2.05rem;border:1px solid var(--rtg-line);border-radius:0;background:rgba(255,255,255,.025);color:var(--rtg-txt);font-size:.86rem;outline:none;font-family:inherit;}
  .wos-zoek-paneel input::placeholder{color:var(--rtg-soft);}
  .wos-zoek-paneel input:focus{border-color:var(--gold-rand,var(--rtg-line));box-shadow:inset 2px 0 var(--gold-basis,#857007);}
  .wos-zoek-lijst{min-height:0;height:100%;padding:0 1.05rem 1rem;display:grid;grid-auto-rows:minmax(58px,1fr);overflow-y:auto;}
  .wos-zoek-lijst button{width:100%;min-height:58px;display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:.72rem;padding:.55rem .55rem;text-align:left;cursor:pointer;border:0;border-bottom:1px solid var(--rtg-line);border-radius:0;background:transparent;color:var(--rtg-txt);font-size:.78rem;font-family:inherit;}
  .wos-zoek-lijst button:hover,.wos-zoek-lijst button.is-selected{background:rgba(255,255,255,.035);box-shadow:inset 2px 0 var(--gold-basis,#857007);}
  .wos-zoek-lijst button:focus-visible{outline:1px solid var(--gold-tekst,var(--rtg-goud));outline-offset:-2px;}
  .wos-zoek-lijst .zi{width:34px;height:34px;display:flex;align-items:center;justify-content:flex-start;color:var(--rtg-muted);}
  .wos-zoek-lijst .zi svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:var(--rtg-stroke,1.6);}
  .wos-zoek-code{margin-left:auto;font-size:.48rem;letter-spacing:.12em;color:var(--rtg-soft);font-variant-numeric:tabular-nums;}
  .wos-zoek-leeg{padding:1.3rem .55rem;color:var(--rtg-muted);font-size:.72rem;}
  .wos-context{position:relative;padding:1.25rem;border-left:1px solid var(--rtg-line);}
  .wos-context b{display:block;margin-top:1.2rem;font:500 1.45rem/1.08 var(--rtg-display,'Bodoni Moda',serif);color:var(--rtg-txt);}
  .wos-context p{margin:.65rem 0 0;color:var(--rtg-muted);font-size:.72rem;line-height:1.6;}
  .wos-context code{position:absolute;left:1.25rem;right:1.25rem;bottom:1.25rem;padding-top:.75rem;border-top:1px solid var(--rtg-line);color:var(--rtg-soft);font:500 .5rem var(--rtg-interface,Inter,sans-serif);letter-spacing:.14em;text-transform:uppercase;}
  .wos-zoek-voet{display:flex;align-items:center;gap:1rem;padding:0 1.15rem;border-top:1px solid var(--rtg-line);font-size:.48rem;letter-spacing:.1em;text-transform:uppercase;color:var(--rtg-soft);}
  .wos-zoek-voet span:last-child{margin-left:auto;}
  .wos-zoek-voet kbd{font-family:inherit;color:var(--rtg-txt);border:1px solid var(--rtg-line);border-radius:0;padding:.08rem .24rem;margin-right:.28rem;background:transparent;}
  @media (max-width:820px){.wos-zoek-body{grid-template-columns:1fr}.wos-zoek-rail,.wos-context{display:none}}
  @media (min-width:901px){
    body.wos.wos-aan .topbar,body.wos.wos-aan .content,body.wos.wos-bord-aan header,body.wos.wos-bord-aan #app{margin-left:176px;}
    body.wos.wos-aan .wos-dock,body.wos.wos-bord-aan .wos-dock{left:calc(50% + 88px);}
  }
  @media (min-width:621px) and (max-width:900px){
    body.wos .wos-rail{width:64px;}body.wos .wos-rail-kop{font-size:0;height:42px;padding:0;}body.wos .wos-rail-kop::after{content:"WOS";height:42px;display:grid;place-items:center;font-size:.46rem;letter-spacing:.12em;color:var(--rtg-soft);}
    body.wos .wos-rail button{grid-template-columns:1fr;padding:.55rem;justify-items:center;}body.wos .wos-rail button span{display:none;}
    body.wos.wos-aan .topbar,body.wos.wos-aan .content,body.wos.wos-bord-aan header,body.wos.wos-bord-aan #app{margin-left:64px;}
    body.wos.wos-aan .wos-dock,body.wos.wos-bord-aan .wos-dock{left:calc(50% + 32px);}
    body.wos .wos-top-huidig{min-width:130px;}
  }
