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
