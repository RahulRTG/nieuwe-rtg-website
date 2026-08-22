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
