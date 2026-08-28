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
