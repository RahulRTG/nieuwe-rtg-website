/* WerkOS-beweging, rail en contextpresentatie: /ds/componenten/werkos.css. */
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

    document.body.classList.add('ds-werkos', 'wos');

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
    /* De contextbalk hoort bij de werkruimte. Buiten een mogelijk
       getransformeerde appkop blijft `position: fixed` echt viewportvast. */
    document.body.appendChild(topContext);
    if (topbar) {
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
