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
