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

