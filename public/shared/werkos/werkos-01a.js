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

  /* telefoongevoel: een app opent met een korte zoom, en onderin ligt de
     home-indicator (tik = startscherm, omhoog vegen = de app sluiten) */
  @media (prefers-reduced-motion: no-preference){
    body.wos-aan .view.active{animation:wosOpen 0.28s cubic-bezier(0.32,0.72,0.36,1);}
    body.wos-aan.wos-thuis .view.active{animation:wosThuis 0.24s ease-out;}
    @keyframes wosOpen{from{transform:scale(0.92) translateY(16px);opacity:0.4;}to{transform:none;opacity:1;}}
    @keyframes wosThuis{from{transform:scale(1.04);opacity:0.5;}to{transform:none;opacity:1;}}
    body.wos .content.wos-veeg-terug{transition:transform 0.22s cubic-bezier(0.32,0.72,0.36,1),opacity 0.22s ease;}
    body.wos .content.wos-veeg-weg{transition:transform 0.18s ease-in,opacity 0.18s ease-in;transform:scale(0.85) translateY(-10vh);opacity:0;}
  }
  .wos-pill{
    position:fixed;left:50%;transform:translateX(-50%);
    bottom:calc(env(safe-area-inset-bottom, 0px) + 0.3rem);
    z-index:61;width:130px;height:20px;background:none;border:none;padding:0;cursor:pointer;
    display:flex;align-items:center;justify-content:center;touch-action:none;
  }
  .wos-pill::after{content:"";width:110px;height:5px;border-radius:3px;background:color-mix(in srgb, var(--txt,#F4F1EC) 55%, transparent);}
  .wos-pill:focus-visible{outline:2px solid var(--gold,#A98F1C);outline-offset:2px;}
  body.wos-thuis .wos-pill{display:none;}
  body:not(.wos-aan) .wos-pill{display:none;}
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

    /* de home-indicator: tik = startscherm, omhoog vegen = de open app onder
       de vinger laten wegkrimpen en sluiten (het telefoongebaar) */
    const pilw = document.createElement('button');
    pilw.type = 'button';
    pilw.className = 'wos-pill';
    pilw.setAttribute('aria-label', 'Naar het startscherm; omhoog vegen sluit de app');
    document.body.appendChild(pilw);
    const inhoud = $('.content');
    const naarStart = () => { const b = knop(thuisTab); if (b) b.click(); };
    const rustigW = matchMedia('(prefers-reduced-motion: reduce)').matches;
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
      inhoud.style.transformOrigin = '50% 90%';
      inhoud.style.transform = 'scale(' + (1 - p * 0.15).toFixed(4) + ') translateY(' + Math.round(-wDy * 0.35) + 'px)';
      inhoud.style.opacity = String(1 - p * 0.3);
    });
    const wLos = () => {
      if (wY == null) return;
      const d = wDy; wY = null;
      if (!wVeeg || !inhoud) return;
      if (d > 70) {
        inhoud.style.transform = ''; inhoud.style.opacity = '';
        if (rustigW) { naarStart(); return; }
        inhoud.classList.add('wos-veeg-weg');
        setTimeout(() => { naarStart(); inhoud.classList.remove('wos-veeg-weg'); }, 170);
      } else {
        inhoud.classList.add('wos-veeg-terug');
        inhoud.style.transform = ''; inhoud.style.opacity = '';
        setTimeout(() => inhoud.classList.remove('wos-veeg-terug'), 240);
      }
    };
    pilw.addEventListener('pointerup', wLos);
    pilw.addEventListener('pointercancel', wLos);
    pilw.addEventListener('click', () => { if (wVeeg) { wVeeg = false; return; } naarStart(); });

    /* klok en batterij in de topbar */
    const status = document.createElement('span');
    status.className = 'wos-status';
    status.setAttribute('aria-hidden', 'true');
    const klok = document.createElement('span'); klok.className = 'wos-klok'; klok.textContent = '--:--';
    status.appendChild(klok);
    const bat = document.createElement('span'); bat.className = 'wos-bat'; bat.hidden = true;
