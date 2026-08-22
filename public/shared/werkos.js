/* ============================== RTG Werk-OS ==============================
   De gedeelde werklaag volgt het RTG Command Canvas. De app zelf toont eerst
   haar gemeten stand, aandacht en werk van vandaag. Pas daarna volgt het
   register met werkvlakken. Geen tweede huisstijl, geen springboard en geen
   verzonnen merk: deze laag gebruikt uitsluitend de RTG-tokens en glyfen die
   de onderliggende app al draagt.

   De verborgen tabbar blijft het model. WerkOS spiegelt dat model in een
   register, een compacte commandobalk en het Command Center. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);

  const CSS = `
  body.wos .tabbar{display:none !important;}
  body.wos.wos-aan .content{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 6.5rem) !important;}
  body.wos #shell{background:var(--rtg-grond,var(--rtg-bg));}
  body.wos .topbar{
    position:relative;z-index:5;background:color-mix(in srgb,var(--onyx-basis,#0C0C0B) 92%,transparent);
    border-bottom-color:var(--rtg-line);box-shadow:none;
    backdrop-filter:blur(18px) saturate(1.05);-webkit-backdrop-filter:blur(18px) saturate(1.05);
  }

  /* Functies komen na het echte werk van het thuisscherm. De kop markeert de
     overgang; hij doet niet alsof een losse app een merk of een wereld is. */
  .wos-navkop{margin:2.4rem 0 0;padding:1rem 0 .75rem;border-top:1px solid var(--rtg-line);}
  .wos-navkop span{display:block;font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;color:var(--rtg-soft);font-weight:650;}
  .wos-navkop p{margin:.28rem 0 0;font-size:.82rem;line-height:1.5;color:var(--rtg-muted);}

  /* Een register in plaats van een kaarten-dashboard. Geen doosjes om namen:
     alleen glyph, naam, vaste referentie en haarlijnen. */
  .wos-grid{display:grid;grid-template-columns:1fr 1fr;margin:0 0 2.25rem;border-top:1px solid var(--rtg-line);}
  .wos-app{
    position:relative;min-width:0;min-height:56px;padding:.65rem .9rem;
    display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:.75rem;
    border:0;border-bottom:1px solid var(--rtg-line);background:transparent;color:var(--rtg-txt);
    font-family:var(--rtg-interface,Inter,system-ui,sans-serif);text-align:left;cursor:pointer;
    transition:background var(--rtg-tijd-kort,120ms) var(--rtg-veer,ease);
  }
  .wos-app:nth-child(odd){border-right:1px solid var(--rtg-line);}
  .wos-app::after{content:"WOS-" attr(data-index);font-size:.5rem;letter-spacing:.12em;color:var(--rtg-soft);font-variant-numeric:tabular-nums;}
  .wos-app:hover{background:rgba(255,255,255,.028);}
  .wos-app:focus-visible{outline:1px solid var(--gold-tekst,var(--rtg-goud));outline-offset:-2px;}
  .wos-app:active{background:rgba(255,255,255,.045);}
  .wos-tegel{width:34px;height:34px;display:flex;align-items:center;justify-content:flex-start;color:var(--rtg-muted);}
  .wos-tegel svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:var(--rtg-stroke,1.6);stroke-linecap:round;stroke-linejoin:round;}
  .wos-naam{min-width:0;font-size:.78rem;line-height:1.35;color:var(--rtg-txt);font-weight:550;overflow-wrap:anywhere;}
  .wos-grid + h2{margin-top:1.8rem;}

  body.wos.wos-thuis .content{background:transparent;}
  @media (min-width:700px){
    body.wos.wos-thuis .view.active{min-height:calc(100dvh - 10.5rem);display:flex;flex-direction:column;}
    body.wos.wos-thuis .wos-navkop{margin-top:auto;}
    body.wos.wos-thuis .wos-app{min-height:64px;}
  }
  @media (max-width:620px){
    .wos-grid{grid-template-columns:1fr;}
    .wos-app:nth-child(odd){border-right:0;}
    .wos-navkop{margin-top:2rem;}
  }
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
  /* Beweging bevestigt alleen een wissel van werkvlak. */
  @media (prefers-reduced-motion:no-preference){
    body.wos-aan .view.active{animation:wosOpen var(--rtg-tijd-normaal,180ms) var(--rtg-veer,ease);}
    @keyframes wosOpen{from{transform:translateY(4px);opacity:.72;}to{transform:none;opacity:1;}}
    body.wos .content.wos-veeg-terug{transition:transform .18s var(--rtg-veer,ease),opacity .18s ease;}
    body.wos .content.wos-veeg-weg{transition:transform .15s ease-in,opacity .15s ease-in;transform:translateY(-18px);opacity:0;}
  }
  .wos-pill{
    position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + .2rem);
    z-index:61;width:116px;height:18px;background:none;border:0;padding:0;cursor:pointer;
    display:none;align-items:center;justify-content:center;touch-action:none;
  }
  .wos-pill::after{content:"";width:86px;height:2px;background:var(--rtg-soft);}
  .wos-pill:focus-visible{outline:1px solid var(--gold-tekst,var(--rtg-goud));outline-offset:2px;}
  body.wos-thuis .wos-pill,body:not(.wos-aan) .wos-pill{display:none;}

  /* De vaste WerkOS-schil: links alle werkvlakken, boven de huidige context
     en onder de snelle commando's. Elke balk bedient het geopende scherm. */
  .wos-rail{
    position:fixed;z-index:50;left:0;top:var(--wos-top-h,64px);bottom:0;width:176px;display:none;
    border-right:1px solid var(--rtg-line);background:color-mix(in srgb,var(--onyx-basis,#0C0C0B) 97%,transparent);
    overflow-y:auto;overscroll-behavior:contain;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 5.5rem);
  }
  body.wos.wos-aan .wos-rail,body.wos.wos-bord-aan .wos-rail{display:block;}
  .wos-rail-kop{padding:1rem .85rem .7rem;border-bottom:1px solid var(--rtg-line);font-size:.5rem;letter-spacing:.18em;text-transform:uppercase;color:var(--rtg-soft);}
  .wos-rail button{position:relative;width:100%;min-height:52px;display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:.55rem;padding:.55rem .75rem;border:0;border-bottom:1px solid var(--rtg-line);border-radius:0;background:transparent;color:var(--rtg-muted);font:500 .68rem/1.3 var(--rtg-interface,Inter,sans-serif);text-align:left;cursor:pointer;}
  .wos-rail button:hover{background:rgba(255,255,255,.03);color:var(--rtg-txt);}
  .wos-rail button:focus-visible{outline:1px solid var(--gold-tekst,var(--rtg-goud));outline-offset:-2px;}
  .wos-rail button.actief{color:var(--rtg-txt);background:rgba(255,255,255,.025);box-shadow:inset 2px 0 var(--gold-basis,#857007);}
  .wos-rail button svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:var(--rtg-stroke,1.6);stroke-linecap:round;stroke-linejoin:round;}
  .wos-top-context{position:absolute;left:50%;transform:translateX(-50%);display:none;align-items:stretch;height:38px;border:1px solid var(--rtg-line);background:rgba(5,5,5,.26);}
  body.wos.wos-aan .wos-top-context,body.wos.wos-bord-aan .wos-top-context{display:flex;}
  .wos-top-context button{width:38px;border:0;border-radius:0;background:transparent;color:var(--rtg-muted);display:grid;place-items:center;cursor:pointer;}
  .wos-top-context button+button,.wos-top-context .wos-top-huidig+button{border-left:1px solid var(--rtg-line);}
  .wos-top-context button:hover{background:rgba(255,255,255,.035);color:var(--rtg-txt);}
  .wos-top-context button:focus-visible{outline:1px solid var(--gold-tekst,var(--rtg-goud));outline-offset:-2px;}
  .wos-top-context svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:var(--rtg-stroke,1.6);stroke-linecap:round;stroke-linejoin:round;}
  .wos-top-huidig{min-width:170px;padding:.42rem .75rem;display:flex;flex-direction:column;justify-content:center;}
  .wos-top-huidig span{font-size:.47rem;letter-spacing:.13em;text-transform:uppercase;color:var(--rtg-soft);}
  .wos-top-huidig b{margin-top:.08rem;font:550 .66rem var(--rtg-interface,Inter,sans-serif);color:var(--rtg-txt);}
  `;

  const HUIS_SVG = '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>';
  const ZOEK_SVG = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';

  let gestart = false;

  function koppel(opts) {
    if (gestart) return; gestart = true;
    opts = opts || {};
    const thuisTab = opts.thuisTab || 'home';
    const dockWens = opts.dock || [];
    const tabbar = $('#tabbar'), app = $('#app'), topbar = $('.topbar');
    const thuisView = document.querySelector('.view[data-view="' + thuisTab + '"]');
    if (!tabbar || !app || !thuisView) return;

    const stijl = document.createElement('style');
    stijl.textContent = CSS;
    document.head.appendChild(stijl);
    document.body.classList.add('wos');

    const knop = t => tabbar.querySelector('button[data-tab="' + t + '"]');
    const zichtbaar = b => !!b && b.style.display !== 'none';
    const naamVan = b => (b.textContent || '').trim();
    const svgVan = b => { const s = b.querySelector('svg'); return s ? s.cloneNode(true) : null; };

    /* De app toont haar echte stand en aandacht eerst. Dit register komt pas
       daarna en bevat alleen bestaande functies uit de onderliggende app. */
    const navKop = document.createElement('div');
    navKop.className = 'wos-navkop';
    navKop.innerHTML = '<span>Werkvlakken</span><p>Kies waar u aan wilt werken.</p>';
    const grid = document.createElement('nav');
    grid.className = 'wos-grid';
    grid.setAttribute('aria-label', 'Werkvlakken');
    thuisView.appendChild(navKop);
    thuisView.appendChild(grid);

    /* De drie vaste interactieve balken delen hetzelfde tabmodel. */
    const rail = document.createElement('nav');
    rail.className = 'wos-rail';
    rail.setAttribute('aria-label', 'Alle werkvlakken');
    document.body.appendChild(rail);

    const dock = document.createElement('nav');
    dock.className = 'wos-dock';
    dock.setAttribute('aria-label', 'Snelle werkvlakken');
    document.body.appendChild(dock);

    const topContext = document.createElement('nav');
    topContext.className = 'wos-top-context';
    topContext.setAttribute('aria-label', 'Huidig werkvlak');
    const topHome = document.createElement('button'); topHome.type = 'button'; topHome.innerHTML = HUIS_SVG;
    topHome.setAttribute('aria-label', 'Naar de werktafel'); topHome.addEventListener('click', () => { const b = knop(thuisTab); if (b) b.click(); });
    const topHuidig = document.createElement('span'); topHuidig.className = 'wos-top-huidig';
    topHuidig.innerHTML = '<span>Huidig werkvlak</span><b>Werktafel</b>';
    const topZoek = document.createElement('button'); topZoek.type = 'button'; topZoek.innerHTML = ZOEK_SVG;
    topZoek.setAttribute('aria-label', 'Command Center openen'); topZoek.addEventListener('click', zoekOpen);
    topContext.appendChild(topHome); topContext.appendChild(topHuidig); topContext.appendChild(topZoek);
    if (topbar) {
      topbar.appendChild(topContext);
      const meetTop = () => document.body.style.setProperty('--wos-top-h', Math.ceil(topbar.getBoundingClientRect().height) + 'px');
      meetTop(); if (window.ResizeObserver) new ResizeObserver(meetTop).observe(topbar);
    }

    /* Op klein scherm blijft het bestaande mobiele teruggebaar beschikbaar. */
    const pilw = document.createElement('button');
    pilw.type = 'button';
    pilw.className = 'wos-pill';
    pilw.setAttribute('aria-label', 'Naar het startscherm; omhoog vegen sluit het werkvlak');
    document.body.appendChild(pilw);
    const inhoud = $('.content');
    const naarStart = () => { const b = knop(thuisTab); if (b) b.click(); };
    const rustigW = matchMedia('(prefers-reduced-motion:reduce)').matches;
    let wY = null, wDy = 0, wVeeg = false;
    pilw.addEventListener('pointerdown', e => {
      wY = e.clientY; wDy = 0; wVeeg = false;
      try { pilw.setPointerCapture(e.pointerId); } catch (x) {}
    });
    pilw.addEventListener('pointermove', e => {
      if (wY == null) return;
      wDy = Math.max(0, wY - e.clientY);
      if (wDy > 8) wVeeg = true;
      if (!wVeeg || rustigW || !inhoud) return;
      const p = Math.min(wDy / 240, 1);
      inhoud.style.transform = 'translateY(' + Math.round(-p * 18) + 'px)';
      inhoud.style.opacity = String(1 - p * .2);
    });
    const wLos = () => {
      if (wY == null) return;
      const d = wDy; wY = null;
      if (!wVeeg || !inhoud) return;
      inhoud.style.transform = ''; inhoud.style.opacity = '';
      if (d > 70) {
        if (rustigW) { naarStart(); return; }
        inhoud.classList.add('wos-veeg-weg');
        setTimeout(() => { naarStart(); inhoud.classList.remove('wos-veeg-weg'); }, 150);
      } else {
        inhoud.classList.add('wos-veeg-terug');
        setTimeout(() => inhoud.classList.remove('wos-veeg-terug'), 190);
      }
    };
    pilw.addEventListener('pointerup', wLos);
    pilw.addEventListener('pointercancel', wLos);
    pilw.addEventListener('click', () => { if (wVeeg) { wVeeg = false; return; } naarStart(); });
    /* Command Center */
    const zoekScrim = document.createElement('div');
    zoekScrim.className = 'wos-zoek';
    zoekScrim.setAttribute('role', 'dialog');
    zoekScrim.setAttribute('aria-modal', 'true');
    zoekScrim.setAttribute('aria-labelledby', 'wosCommandTitel');
    const paneel = document.createElement('div'); paneel.className = 'wos-zoek-paneel';
    const zoekKop = document.createElement('div'); zoekKop.className = 'wos-zoek-kop';
    const zoekMerk = document.createElement('div');
    zoekMerk.innerHTML = '<b id="wosCommandTitel">Command Center</b><span>Werkvlakken</span>';
    const zoekSluit = document.createElement('button'); zoekSluit.type = 'button'; zoekSluit.className = 'wos-zoek-sluit';
    zoekSluit.setAttribute('aria-label', 'Command Center sluiten'); zoekSluit.textContent = '×';
    zoekKop.appendChild(zoekMerk); zoekKop.appendChild(zoekSluit);
    const zoekVeld = document.createElement('div'); zoekVeld.className = 'wos-zoek-veld';
    const zoekIn = document.createElement('input');
    zoekIn.placeholder = 'Zoek een app of werkvlak…'; zoekIn.setAttribute('aria-label', 'Zoek een app of werkvlak');
    zoekVeld.appendChild(zoekIn);
    const lijst = document.createElement('div'); lijst.className = 'wos-zoek-lijst';
    const zoekBody = document.createElement('div'); zoekBody.className = 'wos-zoek-body';
    const zoekRail = document.createElement('aside'); zoekRail.className = 'wos-zoek-rail';
    zoekRail.innerHTML = '<span>Commando</span><ol><li>Zoeken</li><li>Schakelen</li><li>Openen</li></ol>';
    const zoekKern = document.createElement('div'); zoekKern.className = 'wos-zoek-kern';
    zoekKern.appendChild(zoekVeld); zoekKern.appendChild(lijst);
    const zoekContext = document.createElement('aside'); zoekContext.className = 'wos-context';
    const contextTitel = document.createElement('b'); contextTitel.textContent = 'Werkvlak';
    const contextTekst = document.createElement('p'); contextTekst.textContent = 'Bekijk de keuze en open haar zonder uw huidige werk te verliezen.';
    const contextCode = document.createElement('code'); contextCode.textContent = 'Selecteer een werkvlak';
    zoekContext.innerHTML = '<span>Context</span>';
    zoekContext.appendChild(contextTitel); zoekContext.appendChild(contextTekst); zoekContext.appendChild(contextCode);
    zoekBody.appendChild(zoekRail); zoekBody.appendChild(zoekKern); zoekBody.appendChild(zoekContext);
    const zoekVoet = document.createElement('div'); zoekVoet.className = 'wos-zoek-voet';
    zoekVoet.innerHTML = '<span><kbd>↑↓</kbd>Navigeren</span><span><kbd>Enter</kbd>Openen</span><span><kbd>Esc</kbd>Sluiten</span>';
    paneel.appendChild(zoekKop); paneel.appendChild(zoekBody); paneel.appendChild(zoekVoet);
    zoekScrim.appendChild(paneel);
    document.body.appendChild(zoekScrim);
    zoekScrim.addEventListener('click', e => { if (e.target === zoekScrim) zoekDicht(); });
    zoekSluit.addEventListener('click', zoekDicht);

    function alleTabs() { return [...tabbar.querySelectorAll('button[data-tab]')].filter(zichtbaar); }
    /* Alle werkvlakken: de tabs plus, indien aanwezig, het bestaande Meer-register. */
    const verberg = new Set(opts.verberg || []);
    const extraSel = opts.extra || null;
    function alleApps() {
      const uit = [];
      for (const b of alleTabs()) {
        if (b.dataset.tab === thuisTab || verberg.has(b.dataset.tab)) continue;
        uit.push({ naam: naamVan(b), svg: svgVan(b), tab: b.dataset.tab, doe: () => b.click() });
      }
      if (extraSel) {
        const houder = document.querySelector(extraSel.houder);
        if (houder) {
          for (const b of houder.querySelectorAll(extraSel.knop)) {
            const tab = b.dataset.goto2 || b.dataset.tab || b.dataset.view || '';
            uit.push({ naam: naamVan(b), svg: svgVan(b), tab, doe: () => b.click() });
          }
        }
      }
      return uit;
    }
    let actieveZoek = 0, vorigeFocus = null;
    function kiesZoek(i) {
      const rijen = [...lijst.querySelectorAll('button')];
      if (!rijen.length) return;
      actieveZoek = (i + rijen.length) % rijen.length;
      rijen.forEach((r, n) => r.classList.toggle('is-selected', n === actieveZoek));
      rijen[actieveZoek].scrollIntoView({ block: 'nearest' });
      contextTitel.textContent = rijen[actieveZoek].dataset.naam || 'Werkvlak';
      contextCode.textContent = (rijen[actieveZoek].dataset.code || 'WOS') + ' · Enter om te openen';
    }
    function zoekBouw() {
      const q = (zoekIn.value || '').trim().toLowerCase();
      lijst.textContent = '';
      let nr = 0;
      for (const a of alleApps()) {
        if (q && !a.naam.toLowerCase().includes(q)) continue;
        const r = document.createElement('button');
        r.dataset.naam = a.naam;
        const zi = document.createElement('span'); zi.className = 'zi';
        if (a.svg) zi.appendChild(a.svg.cloneNode(true));
        r.appendChild(zi);
        r.appendChild(document.createTextNode(a.naam));
        const code = document.createElement('span'); code.className = 'wos-zoek-code'; code.textContent = 'WOS-' + String(++nr).padStart(2, '0');
        r.dataset.code = code.textContent;
        r.appendChild(code);
        r.addEventListener('click', () => { zoekDicht(); a.doe(); });
        r.addEventListener('pointerenter', () => kiesZoek([...lijst.children].indexOf(r)));
        lijst.appendChild(r);
      }
      if (!lijst.children.length) {
        const leeg = document.createElement('div'); leeg.className = 'wos-zoek-leeg'; leeg.textContent = 'Geen werkvlak gevonden.'; lijst.appendChild(leeg);
        contextTitel.textContent = 'Geen resultaat'; contextCode.textContent = 'Pas uw zoekopdracht aan';
      }
      actieveZoek = 0; kiesZoek(0);
    }
    function zoekOpen() {
      vorigeFocus = document.activeElement;
      zoekScrim.classList.add('open'); document.body.classList.add('wos-command-open');
      zoekIn.value = ''; zoekBouw(); zoekIn.focus();
    }
    function zoekDicht() {
      if (!zoekScrim.classList.contains('open')) return;
      zoekScrim.classList.remove('open'); document.body.classList.remove('wos-command-open');
      if (vorigeFocus && vorigeFocus.focus) vorigeFocus.focus();
    }
    zoekIn.addEventListener('input', zoekBouw);
    zoekIn.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); kiesZoek(actieveZoek + 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); kiesZoek(actieveZoek - 1); }
      if (e.key === 'Enter') { const r = lijst.querySelectorAll('button')[actieveZoek]; if (r) r.click(); }
    });
    zoekScrim.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const f = [...zoekScrim.querySelectorAll('button,input,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent);
      if (!f.length) return;
      const eerste = f[0], laatste = f[f.length - 1];
      if (e.shiftKey && document.activeElement === eerste) { e.preventDefault(); laatste.focus(); }
      else if (!e.shiftKey && document.activeElement === laatste) { e.preventDefault(); eerste.focus(); }
    });
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') { e.preventDefault(); zoekOpen(); }
      if (e.key === 'Escape') zoekDicht();
    });
    function maakDockKnop(svgHtml, label, doe) {
      const b = document.createElement('button');
      b.innerHTML = svgHtml;
      b.setAttribute('aria-label', label);
      b.dataset.label = label.replace(/\s*\([^)]*\)\s*$/, '');
      b.addEventListener('click', doe);
      return b;
    }
    /* bouwen en spiegelen */
    function bouw() {
      grid.textContent = '';
      let appNr = 0;
      for (const app2 of alleApps()) {
        const a = document.createElement('button');
        a.className = 'wos-app';
        a.setAttribute('aria-label', app2.naam);
        const tegel = document.createElement('span'); tegel.className = 'wos-tegel';
        a.dataset.index = String(++appNr).padStart(2, '0');
        if (app2.svg) tegel.appendChild(app2.svg.cloneNode(true));
        a.appendChild(tegel);
        const n = document.createElement('span'); n.className = 'wos-naam'; n.textContent = app2.naam;
        a.appendChild(n);
        a.addEventListener('click', app2.doe);
        grid.appendChild(a);
      }
      rail.textContent = '';
      const railKop = document.createElement('div'); railKop.className = 'wos-rail-kop'; railKop.textContent = 'Werkvlakken'; rail.appendChild(railKop);
      const railKnop = (svg, label, tab, doe) => {
        const r = document.createElement('button'); r.type = 'button'; r.setAttribute('aria-label', label); r.dataset.tab = tab || '';
        if (svg) r.appendChild(svg.cloneNode(true)); else r.innerHTML = HUIS_SVG;
        const s = document.createElement('span'); s.textContent = label; r.appendChild(s); r.addEventListener('click', doe); rail.appendChild(r);
      };
      railKnop(null, 'Werktafel', thuisTab, () => { const b = knop(thuisTab); if (b) b.click(); });
      for (const app2 of alleApps()) railKnop(app2.svg, app2.naam, app2.tab, app2.doe);

      dock.textContent = '';
      const huis = maakDockKnop(HUIS_SVG, 'Startscherm', () => { const b = knop(thuisTab); if (b) b.click(); });
      huis.dataset.tab = thuisTab;
      dock.appendChild(huis);
      for (const t of dockWens) {
        const b = knop(t);
        if (!zichtbaar(b)) continue;
        const sv = svgVan(b);
        const k = maakDockKnop('', naamVan(b), () => b.click());
        if (sv) k.appendChild(sv);
        k.dataset.tab = t;
        dock.appendChild(k);
      }
      dock.appendChild(maakDockKnop(ZOEK_SVG, 'Command Center (Cmd+K)', zoekOpen));
      sync();
    }
    function sync() {
      const act = tabbar.querySelector('button.active');
      const view = app.querySelector('.view.active[data-view]');
      const tab = view ? view.dataset.view : (act ? act.dataset.tab : thuisTab);
      document.body.classList.toggle('wos-thuis', tab === thuisTab);
      document.body.classList.toggle('wos-aan', app.classList.contains('active'));
      dock.querySelectorAll('button').forEach(b => {
        const actief = !!b.dataset.tab && b.dataset.tab === tab;
        b.classList.toggle('actief', actief);
        if (actief) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      rail.querySelectorAll('button').forEach(b => {
        const actief = !!b.dataset.tab && b.dataset.tab === tab;
        b.classList.toggle('actief', actief);
        if (actief) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      const topNaam = topHuidig.querySelector('b');
      const werkvlak = tab === thuisTab ? null : alleApps().find(a => a.tab === tab);
      if (topNaam) topNaam.textContent = werkvlak ? werkvlak.naam : (act ? naamVan(act) : 'Werktafel');
    }

    let gepland = null;
    const plan = () => { if (gepland) return; gepland = requestAnimationFrame(() => { gepland = null; bouw(); }); };
    new MutationObserver(plan).observe(tabbar, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
    new MutationObserver(sync).observe(app, { subtree: true, attributes: true, attributeFilter: ['class'] });
    if (extraSel) {
      const houder = document.querySelector(extraSel.houder);
      if (houder) new MutationObserver(plan).observe(houder, { subtree: true, childList: true });
    }
    bouw();
  }

  /* Backoffice-commandolaag: kiezen scrolt naar het juiste paneel. */
  function bord(opts) {
    opts = opts || {};
    document.body.classList.add('wos', 'wos-bord-aan');
    const stijl = document.createElement('style');
    stijl.textContent = CSS + `
    .wos-bord{
      position:fixed;inset:0;z-index:80;display:none;height:100dvh;box-sizing:border-box;overflow-y:auto;
      background:color-mix(in srgb,var(--onyx-basis,#0C0C0B) 96%,transparent);
      backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
      padding:clamp(1.4rem,4vh,2.7rem) 1.4rem;
    }
    .wos-bord.open{display:block;}
    .wos-bord-kader{width:min(1120px,100%);min-height:100%;margin:0 auto;display:grid;grid-template-rows:auto minmax(0,1fr);}
    .wos-bord-kop{position:relative;margin-bottom:1.2rem;padding:1.2rem 3.6rem 1.25rem 0;border-top:1px solid var(--gold-rand,var(--rtg-line));border-bottom:1px solid var(--rtg-line);background:transparent;}
    .wos-bord-kicker{font-size:.52rem;letter-spacing:.18em;text-transform:uppercase;color:var(--rtg-soft);font-weight:650;}
    .wos-bord-titel{margin-top:.52rem;font-family:var(--rtg-display,'Bodoni Moda',serif);font-size:clamp(1.65rem,3.5vw,2.7rem);font-weight:500;line-height:1.02;letter-spacing:-.02em;color:var(--rtg-txt);}
    .wos-bord-sub{margin-top:.5rem;max-width:34rem;font-size:.72rem;line-height:1.58;color:var(--rtg-muted);}
    .wos-bord-sluit{position:absolute;right:0;top:1rem;width:34px;height:34px;border:1px solid var(--rtg-line);border-radius:0;background:transparent;color:var(--rtg-muted);cursor:pointer;}
    .wos-bord-sluit:hover{border-color:var(--gold-rand,var(--rtg-line));color:var(--rtg-txt);}
    .wos-bord-sluit:focus-visible{outline:1px solid var(--gold-tekst,var(--rtg-goud));outline-offset:2px;}
    .wos-bord .wos-grid{width:100%;min-height:0;margin:0;align-self:stretch;grid-template-columns:1fr 1fr;grid-auto-rows:minmax(68px,1fr);}
    .wos-bord .wos-app{min-height:68px;}
    .wos-flits{outline:1px solid var(--gold-tekst,var(--rtg-goud)) !important;outline-offset:3px;transition:outline-color .6s;}
    .wos-bord-knop{
      display:inline-flex;align-items:center;gap:.45rem;cursor:pointer;
      min-height:32px;border:0;border-bottom:1px solid var(--rtg-line);border-radius:0;
      background:transparent;color:var(--rtg-muted);
      padding:.48rem .78rem;font-size:.62rem;font-family:inherit;letter-spacing:.11em;text-transform:uppercase;
      box-shadow:none;transition:border-color .12s,color .12s,background .12s;
    }
    .wos-bord-knop:hover{border-color:var(--gold-rand,var(--rtg-line));background:rgba(255,255,255,.025);color:var(--rtg-txt);}
    .wos-bord-knop:focus-visible{outline:1px solid var(--gold-tekst,var(--rtg-goud));outline-offset:2px;}
    .wos-bord-knop svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:var(--rtg-stroke,1.6);}
    @media (max-width:620px){.wos-bord{height:auto;min-height:100dvh;padding:1.2rem .9rem 2rem}.wos-bord-kader{min-height:auto}.wos-bord-kop{padding:1.1rem 3rem 1.1rem 0}.wos-bord .wos-grid{grid-template-columns:1fr;grid-auto-rows:minmax(68px,auto)}}
    `;
    document.head.appendChild(stijl);

    const scrim = document.createElement('div');
    scrim.className = 'wos-bord';
    scrim.setAttribute('role', 'dialog'); scrim.setAttribute('aria-modal', 'true'); scrim.setAttribute('aria-labelledby', 'wosBordTitel');
    const kader = document.createElement('div'); kader.className = 'wos-bord-kader';
    const kop = document.createElement('div'); kop.className = 'wos-bord-kop';
    const kicker = document.createElement('div'); kicker.className = 'wos-bord-kicker'; kicker.textContent = 'WerkOS · Command';
    const titel = document.createElement('div');
    titel.className = 'wos-bord-titel';
    titel.id = 'wosBordTitel';
    titel.textContent = opts.titel || 'Het bord';
    const sub = document.createElement('div'); sub.className = 'wos-bord-sub'; sub.textContent = 'Kies het operationele werkvlak.';
    const sluit = document.createElement('button'); sluit.type = 'button'; sluit.className = 'wos-bord-sluit'; sluit.setAttribute('aria-label', 'Command Center sluiten'); sluit.textContent = '×';
    kop.appendChild(kicker); kop.appendChild(titel); kop.appendChild(sub); kop.appendChild(sluit); kader.appendChild(kop);
    const grid = document.createElement('nav');
    grid.className = 'wos-grid';
    grid.setAttribute('aria-label', 'Panelen');
    kader.appendChild(grid); scrim.appendChild(kader);
    document.body.appendChild(scrim);
    return bouwBordSchil(opts, scrim, grid, sluit);
  }
  function bouwBordSchil(opts, scrim, grid, sluit) {
    const apps = (opts.apps || []).filter(a => a.el);
    let vergrendeldTot = 0;
    let vorigeFocus = null;
    const dicht = () => {
      if (!scrim.classList.contains('open')) return;
      scrim.classList.remove('open'); document.body.classList.remove('wos-command-open');
      if (vorigeFocus && vorigeFocus.focus) vorigeFocus.focus();
    };
    const open = () => {
      vorigeFocus = document.activeElement;
      scrim.classList.add('open'); document.body.classList.add('wos-command-open');
      sluit.focus();
    };
    const ga = a => {
      vergrendeldTot = Date.now() + 900;
      dicht();
      a.el.scrollIntoView({ behavior:'smooth', block:'start' });
      a.el.classList.add('wos-flits');
      setTimeout(() => a.el.classList.remove('wos-flits'), 1600);
      actief(a);
    };

    let bordNr = 0;
    for (const a of apps) {
      const b = document.createElement('button'); b.className = 'wos-app'; b.setAttribute('aria-label', a.naam);
      const tegel = document.createElement('span'); tegel.className = 'wos-tegel';
      b.dataset.index = String(++bordNr).padStart(2, '0');
      const glyf = window.RTGGlyf && RTGGlyf.svg(a.glyf || 'paneel'); if (glyf) tegel.appendChild(glyf);
      b.appendChild(tegel);
      const n = document.createElement('span'); n.className = 'wos-naam'; n.textContent = a.naam; b.appendChild(n);
      b.addEventListener('click', () => ga(a)); grid.appendChild(b);
    }
    scrim.addEventListener('click', e => { if (e.target === scrim) dicht(); });
    sluit.addEventListener('click', dicht);
    scrim.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const f = [...scrim.querySelectorAll('button,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent);
      if (!f.length) return;
      const eerste = f[0], laatste = f[f.length - 1];
      if (e.shiftKey && document.activeElement === eerste) { e.preventDefault(); laatste.focus(); }
      else if (!e.shiftKey && document.activeElement === laatste) { e.preventDefault(); eerste.focus(); }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') dicht();
      if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') { e.preventDefault(); if (scrim.classList.contains('open')) dicht(); else open(); }
    });

    const rail = document.createElement('nav'); rail.className = 'wos-rail'; rail.setAttribute('aria-label', 'Backoffice-panelen');
    const railKop = document.createElement('div'); railKop.className = 'wos-rail-kop'; railKop.textContent = 'Panelen'; rail.appendChild(railKop);
    const railKnoppen = [];
    for (const a of apps) {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', a.naam);
      const glyf = window.RTGGlyf && RTGGlyf.svg(a.glyf || 'paneel'); if (glyf) b.appendChild(glyf);
      const s = document.createElement('span'); s.textContent = a.naam; b.appendChild(s); b.addEventListener('click', () => ga(a));
      rail.appendChild(b); railKnoppen.push({ a, b });
    }
    document.body.appendChild(rail);

    const dock = document.createElement('nav'); dock.className = 'wos-dock'; dock.setAttribute('aria-label', 'Snelle backoffice-panelen');
    const dockKnoppen = [];
    const dockKnop = (svg, label, doe) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = svg; b.setAttribute('aria-label', label); b.dataset.label = label; b.addEventListener('click', doe); dock.appendChild(b); return b; };
    dockKnop(HUIS_SVG, 'Naar boven', () => { window.scrollTo({ top:0, behavior:'smooth' }); actief(null); });
    for (const a of apps.slice(0, 4)) {
      const glyf = window.RTGGlyf && RTGGlyf.svgHTML(a.glyf || 'paneel');
      dockKnoppen.push({ a, b:dockKnop(glyf || '', a.naam, () => ga(a)) });
    }
    dockKnop(ZOEK_SVG, 'Command Center', open); document.body.appendChild(dock);

    const top = document.createElement('nav'); top.className = 'wos-top-context'; top.setAttribute('aria-label', 'Huidig backoffice-paneel');
    const boven = document.createElement('button'); boven.type = 'button'; boven.innerHTML = HUIS_SVG; boven.setAttribute('aria-label', 'Naar het overzicht'); boven.addEventListener('click', () => { window.scrollTo({ top:0, behavior:'smooth' }); actief(null); });
    const huidig = document.createElement('span'); huidig.className = 'wos-top-huidig'; huidig.innerHTML = '<span>Huidig paneel</span><b>Overzicht</b>';
    const zoek = document.createElement('button'); zoek.type = 'button'; zoek.innerHTML = ZOEK_SVG; zoek.setAttribute('aria-label', 'Command Center openen'); zoek.addEventListener('click', open);
    top.appendChild(boven); top.appendChild(huidig); top.appendChild(zoek);
    const header = document.querySelector('header'); const topHouder = header && (header.querySelector('.wrap') || header); if (topHouder) topHouder.appendChild(top);
    if (header) { const meet = () => document.body.style.setProperty('--wos-top-h', Math.ceil(header.getBoundingClientRect().height) + 'px'); meet(); if (window.ResizeObserver) new ResizeObserver(meet).observe(header); }

    function actief(a) {
      railKnoppen.forEach(x => x.b.classList.toggle('actief', x.a === a));
      dockKnoppen.forEach(x => x.b.classList.toggle('actief', x.a === a));
      const naam = huidig.querySelector('b'); if (naam) naam.textContent = a ? a.naam : 'Overzicht';
    }
    if (window.IntersectionObserver) {
      const oog = new IntersectionObserver(es => { if (Date.now() < vergrendeldTot) return; const e = es.filter(x => x.isIntersecting).sort((a,b) => Math.abs(a.boundingClientRect.top)-Math.abs(b.boundingClientRect.top))[0]; if (e) actief(apps.find(a => a.el === e.target) || null); }, { threshold:[.25,.5] });
      apps.forEach(a => oog.observe(a.el));
    }

    if (opts.knopIn && !topHouder) {
      const k = document.createElement('button'); k.className = 'wos-bord-knop'; k.innerHTML = HUIS_SVG + '<span>Command Center</span>'; k.addEventListener('click', open); opts.knopIn.appendChild(k);
    }
    return { open };
  }

  window.WerkOS = { koppel, bord };
})();
