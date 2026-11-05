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

  /* Presentatie: /ds/componenten/werkos.css, statisch geladen door iedere host. */
/* WerkOS-commandobalk, Command Center en tabletindeling wonen in
   /ds/componenten/werkos.css; dit bundeldeel blijft als expliciete historische naad. */
/* WerkOS mobiel woont in /ds/componenten/werkos.css; dit bundeldeel blijft als
   expliciete historische naad voor de bestaande bundelregistratie. */
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
      b.dataset.rtgActionKey = 'work.panel.' + apps.indexOf(a);
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
      const b = dockKnop(glyf || '', a.naam, () => ga(a));
      b.dataset.rtgActionKey = 'work.panel.' + apps.indexOf(a);
      dockKnoppen.push({ a, b });
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
