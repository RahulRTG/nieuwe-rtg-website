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
    document.body.classList.add('ds-werkos', 'wos', 'wos-bord-aan');

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
