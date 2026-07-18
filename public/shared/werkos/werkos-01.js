/* ============================== RTG Werk-OS ==============================
   Het OS-idee van de leden-app, doorgetrokken naar de werk-apps: het
   startscherm is een springboard met app-iconen, onderin ligt een zwevend
   dock, bovenin lopen klok en batterij mee, en Cmd+K (of de zoekknop in het
   dock) opent Spotlight. Desktop en iPad zijn leidend; op een telefoon
   schaalt alles gewoon mee.

   Net als in de leden-app blijft de (verborgen) tabbar het model: alle
   bestaande logica schakelt daar tabs en zichtbaarheid; deze laag SPIEGELT
   dat model en klikt terug het model in. De styling is de strakke kant van
   het huis: scherpe hoeken, haarlijnen, korte bewegingen, goud als accent. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);

  const CSS = `
  body.wos .tabbar{display:none !important;}
  body.wos.wos-aan .content{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 6.8rem) !important;}

  /* het springboard: app-iconen bovenaan het startscherm */
  .wos-grid{
    display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));
    gap:1.2rem 0.6rem;margin:0.5rem 0 1.8rem;
  }
  @media (min-width:700px){
    .wos-grid{grid-template-columns:repeat(auto-fill,minmax(102px,1fr));gap:1.5rem 0.8rem;margin:0.9rem 0 2.2rem;}
  }
  .wos-app{
    background:none;border:none;padding:0;cursor:pointer;font-family:inherit;
    display:flex;flex-direction:column;align-items:center;gap:0.55rem;
    transition:transform 0.13s cubic-bezier(0.22,0.7,0.3,1);
  }
  .wos-app:hover{transform:translateY(-3px);}
  .wos-app:active{transform:scale(0.97);}
  .wos-tegel{
    width:76px;height:76px;border-radius:18px;position:relative;
    display:flex;align-items:center;justify-content:center;
    background:linear-gradient(155deg,#23201C 0%,#171412 62%,#131110 100%);
    border:1px solid var(--line,rgba(255,255,255,0.09));
    box-shadow:0 10px 26px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.07);
    transition:border-color 0.13s, box-shadow 0.13s;
  }
  @media (min-width:700px){.wos-tegel{width:88px;height:88px;border-radius:20px;}}
  .wos-app:hover .wos-tegel{
    border-color:color-mix(in srgb, var(--gold,#A98F1C) 65%, transparent);
    box-shadow:0 16px 34px rgba(0,0,0,0.5), 0 0 0 1px rgba(169,143,28,0.12), inset 0 1px 0 rgba(255,255,255,0.1);
  }
  .wos-tegel svg{width:30px;height:30px;stroke:var(--txt,#F4F1EC);fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;}
  @media (min-width:700px){.wos-tegel svg{width:34px;height:34px;}}
  .wos-naam{
    font-size:0.56rem;letter-spacing:0.16em;text-transform:uppercase;
    color:var(--soft,rgba(244,241,236,0.62));text-align:center;line-height:1.35;
    max-width:110px;
  }

  /* startscherm-sfeer: rustige gloed, geen franje */
  body.wos.wos-thuis .content{
    background:
      radial-gradient(85% 40% at 50% -6%, rgba(169,143,28,0.09), transparent 62%),
      radial-gradient(110% 55% at 50% 112%, rgba(194,58,94,0.06), transparent 60%);
  }

  /* het dock: zwevend glas, scherpe hoeken, goudaccent op de actieve app */
  .wos-dock{
    position:fixed;left:50%;transform:translateX(-50%);
    bottom:calc(env(safe-area-inset-bottom,0px) + 0.85rem);
    z-index:60;display:none;gap:0.5rem;padding:0.5rem 0.6rem;border-radius:16px;
    background:color-mix(in srgb, var(--card,#151312) 62%, transparent);
    backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);
    border:1px solid var(--line,rgba(255,255,255,0.09));
    box-shadow:0 18px 44px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08);
  }
  body.wos.wos-aan .wos-dock{display:flex;}
  .wos-dock button{
    width:48px;height:48px;border-radius:12px;border:1px solid transparent;
    background:linear-gradient(155deg,#211E1B,#161311);position:relative;
    display:flex;align-items:center;justify-content:center;cursor:pointer;
    transition:border-color 0.13s, transform 0.13s;
  }
  .wos-dock button:hover{border-color:var(--line,rgba(255,255,255,0.12));transform:translateY(-2px);}
  .wos-dock button svg{width:22px;height:22px;stroke:var(--txt,#F4F1EC);fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;}
  .wos-dock button.actief{border-color:color-mix(in srgb, var(--gold,#A98F1C) 55%, transparent);}
  .wos-dock button.actief::after{
    content:"";position:absolute;left:50%;transform:translateX(-50%);bottom:-7px;
    width:14px;height:2px;border-radius:1px;background:var(--gold,#A98F1C);
  }

  /* klok en batterij in de bestaande topbar */
  .wos-status{display:flex;align-items:center;gap:0.7rem;margin-left:0.6rem;flex-shrink:0;}
  .wos-klok{font-size:0.86rem;font-weight:650;color:var(--txt,#F4F1EC);font-variant-numeric:tabular-nums;letter-spacing:0.02em;}
  .wos-bat{display:inline-flex;align-items:center;gap:5px;}
  .wos-bat i{
    width:21px;height:11px;border:1px solid color-mix(in srgb, var(--txt,#F4F1EC) 55%, transparent);
    border-radius:3px;padding:1.5px;display:block;position:relative;
  }
  .wos-bat i::after{
    content:"";position:absolute;right:-3.5px;top:3px;width:2px;height:4px;
    border-radius:0 2px 2px 0;background:color-mix(in srgb, var(--txt,#F4F1EC) 55%, transparent);
  }
  .wos-bat b{display:block;height:100%;border-radius:1.5px;background:var(--txt,#F4F1EC);min-width:2px;}
  .wos-bat.laag b{background:var(--burgundy,#C23A5E);}
  .wos-bat em{font-style:normal;font-size:0.66rem;color:var(--soft,rgba(244,241,236,0.62));font-variant-numeric:tabular-nums;}

  /* Spotlight: Cmd+K of de zoekknop in het dock */
  .wos-zoek{
    position:fixed;inset:0;z-index:90;display:none;
    align-items:flex-start;justify-content:center;
    background:rgba(0,0,0,0.5);
    backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  }
  .wos-zoek.open{display:flex;}
  .wos-zoek-paneel{margin-top:14vh;width:min(480px,90%);}
  .wos-zoek-paneel input{
    width:100%;padding:0.9rem 1.1rem;border-radius:13px;
    border:1px solid var(--line,rgba(255,255,255,0.09));
    background:color-mix(in srgb, var(--card,#151312) 84%, transparent);
    color:var(--txt,#F4F1EC);font-size:0.98rem;outline:none;font-family:inherit;
  }
  .wos-zoek-paneel input:focus{border-color:color-mix(in srgb, var(--gold,#A98F1C) 55%, transparent);}
  .wos-zoek-lijst{margin-top:0.6rem;display:flex;flex-direction:column;gap:0.3rem;}
  .wos-zoek-lijst button{
    display:flex;align-items:center;gap:0.75rem;text-align:left;cursor:pointer;
    padding:0.6rem 0.8rem;border-radius:11px;border:1px solid var(--line,rgba(255,255,255,0.09));
    background:color-mix(in srgb, var(--card,#151312) 74%, transparent);
    color:var(--txt,#F4F1EC);font-size:0.86rem;font-family:inherit;
    transition:border-color 0.12s;
  }
  .wos-zoek-lijst button:hover{border-color:color-mix(in srgb, var(--gold,#A98F1C) 55%, transparent);}
  .wos-zoek-lijst .zi{
    width:32px;height:32px;border-radius:9px;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;
    background:linear-gradient(155deg,#211E1B,#161311);
    border:1px solid var(--line,rgba(255,255,255,0.09));
  }
  .wos-zoek-lijst .zi svg{width:16px;height:16px;stroke:var(--txt,#F4F1EC);fill:none;stroke-width:1.7;}
  .wos-sneltoets{margin-left:auto;font-size:0.62rem;letter-spacing:0.1em;color:var(--soft,rgba(244,241,236,0.62));text-transform:uppercase;}
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

    /* springboard bovenaan het startscherm */
    const grid = document.createElement('nav');
    grid.className = 'wos-grid';
    grid.setAttribute('aria-label', 'Apps');
    thuisView.insertBefore(grid, thuisView.firstChild);

    /* dock */
    const dock = document.createElement('nav');
    dock.className = 'wos-dock';
    dock.setAttribute('aria-label', 'Dock');
    document.body.appendChild(dock);

    /* klok en batterij in de topbar */
    const status = document.createElement('span');
    status.className = 'wos-status';
    status.setAttribute('aria-hidden', 'true');
    const klok = document.createElement('span'); klok.className = 'wos-klok'; klok.textContent = '--:--';
    status.appendChild(klok);
    const bat = document.createElement('span'); bat.className = 'wos-bat'; bat.hidden = true;
