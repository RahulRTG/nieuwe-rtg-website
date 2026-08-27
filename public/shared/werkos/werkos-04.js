/* DE BORDSCHIL: het vlak dat over de app komt met de werkvlakken erin.

   Hier staat hoe dat vlak opent en sluit, wat de focus doet zolang het open
   is, en hoe het rooster van apps erin wordt gezet. Onderdeel van de bundel
   shared/werkos.js; de delen worden achter elkaar geplakt
   (scripts/bundel.js), dus dit bestand begint midden in de omringende
   functie. */
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
