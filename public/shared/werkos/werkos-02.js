    const batI = document.createElement('i'); const batVul = document.createElement('b'); batI.appendChild(batVul);
    const batPct = document.createElement('em');
    bat.appendChild(batI); bat.appendChild(batPct);
    status.appendChild(bat);
    if (topbar) topbar.appendChild(status);

    function tik() {
      const d = new Date();
      klok.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    tik(); setInterval(tik, 15000);
    if (navigator.getBattery) {
      navigator.getBattery().then(b => {
        const verf = () => {
          bat.hidden = false;
          const p = Math.round(b.level * 100);
          batVul.style.width = Math.max(6, p) + '%';
          batPct.textContent = p + '%';
          bat.classList.toggle('laag', p <= 20 && !b.charging);
        };
        b.addEventListener('levelchange', verf); b.addEventListener('chargingchange', verf); verf();
      }).catch(() => {});
    }

    /* Spotlight */
    const zoekScrim = document.createElement('div');
    zoekScrim.className = 'wos-zoek';
    const paneel = document.createElement('div'); paneel.className = 'wos-zoek-paneel';
    const zoekIn = document.createElement('input');
    zoekIn.placeholder = 'Zoek een app...'; zoekIn.setAttribute('aria-label', 'Zoek een app');
    const lijst = document.createElement('div'); lijst.className = 'wos-zoek-lijst';
    paneel.appendChild(zoekIn); paneel.appendChild(lijst);
    zoekScrim.appendChild(paneel);
    document.body.appendChild(zoekScrim);
    zoekScrim.addEventListener('click', e => { if (e.target === zoekScrim) zoekDicht(); });

    function alleTabs() { return [...tabbar.querySelectorAll('button[data-tab]')].filter(zichtbaar); }
    /* alle apps: de tabs plus (optioneel) een extra bron zoals het Meer-grid,
       zodat het springboard echt ALLE functies laat zien */
    const verberg = new Set(opts.verberg || []);
    const extraSel = opts.extra || null;
    function alleApps() {
      const uit = [];
      for (const b of alleTabs()) {
        if (b.dataset.tab === thuisTab || verberg.has(b.dataset.tab)) continue;
        uit.push({ naam: naamVan(b), svg: svgVan(b), doe: () => b.click() });
      }
      if (extraSel) {
        const houder = document.querySelector(extraSel.houder);
        if (houder) {
          for (const b of houder.querySelectorAll(extraSel.knop)) {
            uit.push({ naam: naamVan(b), svg: svgVan(b), doe: () => b.click() });
          }
        }
      }
      return uit;
    }
    function zoekBouw() {
      const q = (zoekIn.value || '').trim().toLowerCase();
      lijst.textContent = '';
      for (const a of alleApps()) {
        if (q && !a.naam.toLowerCase().includes(q)) continue;
        const r = document.createElement('button');
        const zi = document.createElement('span'); zi.className = 'zi';
        if (a.svg) zi.appendChild(a.svg.cloneNode(true));
        r.appendChild(zi);
        r.appendChild(document.createTextNode(a.naam));
        r.addEventListener('click', () => { zoekDicht(); a.doe(); });
        lijst.appendChild(r);
      }
    }
    function zoekOpen() { zoekScrim.classList.add('open'); zoekIn.value = ''; zoekBouw(); zoekIn.focus(); }
    function zoekDicht() { zoekScrim.classList.remove('open'); }
    zoekIn.addEventListener('input', zoekBouw);
    zoekIn.addEventListener('keydown', e => {
      if (e.key === 'Enter') { const r = lijst.querySelector('button'); if (r) r.click(); }
    });
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') { e.preventDefault(); zoekOpen(); }
      if (e.key === 'Escape') zoekDicht();
    });

    /* bouwen en spiegelen */
    function maakDockKnop(svgHtml, label, doe) {
      const b = document.createElement('button');
      b.innerHTML = svgHtml;
      b.setAttribute('aria-label', label);
      b.addEventListener('click', doe);
      return b;
    }
    function bouw() {
      grid.textContent = '';
      for (const app2 of alleApps()) {
        const a = document.createElement('button');
        a.className = 'wos-app';
        a.setAttribute('aria-label', app2.naam);
        const tegel = document.createElement('span'); tegel.className = 'wos-tegel';
        if (app2.svg) tegel.appendChild(app2.svg.cloneNode(true));
        a.appendChild(tegel);
        const n = document.createElement('span'); n.className = 'wos-naam'; n.textContent = app2.naam;
        a.appendChild(n);
        a.addEventListener('click', app2.doe);
        grid.appendChild(a);
      }
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
      dock.appendChild(maakDockKnop(ZOEK_SVG, 'Zoeken (Cmd+K)', zoekOpen));
      sync();
    }
    function sync() {
      const act = tabbar.querySelector('button.active');
      const tab = act ? act.dataset.tab : thuisTab;
      document.body.classList.toggle('wos-thuis', tab === thuisTab);
      document.body.classList.toggle('wos-aan', app.classList.contains('active'));
      dock.querySelectorAll('button').forEach(b => {
        const actief = !!b.dataset.tab && b.dataset.tab === tab;
        b.classList.toggle('actief', actief);
        if (actief) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
    }

    let gepland = null;
    const plan = () => { if (gepland) return; gepland = requestAnimationFrame(() => { gepland = null; bouw(); }); };
    new MutationObserver(plan).observe(tabbar, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
    new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ['class'] });
    if (extraSel) {
      const houder = document.querySelector(extraSel.houder);
      if (houder) new MutationObserver(plan).observe(houder, { subtree: true, childList: true });
    }
    bouw();
  }

  /* ---- bordmodus (backoffice): een springboard als overlay boven het bord.
     De knop in de kop (of Cmd+K) opent hem; een tik scrolt naar het paneel
     en licht het even op. ---- */
  function bord(opts) {
    opts = opts || {};
    const stijl = document.createElement('style');
    stijl.textContent = CSS + `
    .wos-bord{
      position:fixed;inset:0;z-index:80;display:none;overflow-y:auto;
      background:
        radial-gradient(85% 40% at 50% -6%, rgba(169,143,28,0.1), transparent 62%),
        radial-gradient(110% 55% at 50% 112%, rgba(194,58,94,0.07), transparent 60%),
        color-mix(in srgb, var(--bg,#0C0C0B) 88%, transparent);
      backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
      padding:9vh 1.4rem 3rem;
    }
    .wos-bord.open{display:block;}
    .wos-bord .wos-grid{max-width:860px;margin:0 auto;}
    .wos-bord-titel{
      max-width:860px;margin:0 auto 1.6rem;text-align:center;
      font-size:0.66rem;letter-spacing:0.24em;text-transform:uppercase;
      color:var(--soft,rgba(244,241,236,0.62));font-weight:700;
    }
    .wos-flits{outline:1px solid color-mix(in srgb, var(--gold,#A98F1C) 70%, transparent) !important;outline-offset:3px;transition:outline-color 0.6s;}
    .wos-bord-knop{
      display:inline-flex;align-items:center;gap:0.4rem;cursor:pointer;
      border:1px solid var(--line,rgba(255,255,255,0.09));border-radius:11px;
      background:linear-gradient(155deg,#211E1B,#161311);color:var(--txt,#F4F1EC);
      padding:0.45rem 0.8rem;font-size:0.72rem;font-family:inherit;letter-spacing:0.08em;text-transform:uppercase;
      transition:border-color 0.13s;
    }
    .wos-bord-knop:hover{border-color:color-mix(in srgb, var(--gold,#A98F1C) 55%, transparent);}
    .wos-bord-knop svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.8;}
    `;
    document.head.appendChild(stijl);

    const scrim = document.createElement('div');
    scrim.className = 'wos-bord';
    const titel = document.createElement('div');
    titel.className = 'wos-bord-titel';
    titel.textContent = opts.titel || 'Het bord';
    scrim.appendChild(titel);
    const grid = document.createElement('nav');
    grid.className = 'wos-grid';
    grid.setAttribute('aria-label', 'Panelen');
    scrim.appendChild(grid);
    document.body.appendChild(scrim);

    for (const a of (opts.apps || [])) {
      if (!a.el) continue;
      const b = document.createElement('button');
      b.className = 'wos-app';
      b.setAttribute('aria-label', a.naam);
      const tegel = document.createElement('span'); tegel.className = 'wos-tegel';
      const em = document.createElement('span'); em.style.fontSize = '1.7rem'; em.textContent = a.icoon || '▦';
      tegel.appendChild(em);
      b.appendChild(tegel);
