  /* ---------- Heel RTG leest de functiegids (eigenaarsbesluit 19 oktober 2026) ----------
     Het zoekmenu "Heel RTG" in de rand (shared/rtg-edge-smart-menu.js) toonde
     alleen de URL-catalogus van de widgets. De OS-apps -- Videobellen, Bellen,
     Snaps, Werk -- hebben geen adres en stonden er dus niet in, terwijl Rahul ze
     met "open videobellen" wel vindt. Hier zoekt het menu in DEZELFDE gids als
     gidsCommando (RTGWorkspaceDirectory over RTGWorkspaceWorldCatalog, met
     gidsToegang als poort): geen tweede lijst, en wat een lid niet mag openen
     (werkrol, pas) vindt hij ook niet. Een treffer opent via gidsOpen, dezelfde
     weg als Rahul; een link die de catalogus al toont, komt er niet dubbel bij. */
  function heelRtgZoek(invoer) {
    const D = window.RTGWorkspaceDirectory, gezicht = invoer.closest('.rtg-edge-face-all');
    const lijst = gezicht && gezicht.querySelector('.rtg-edge-groups');
    if (!D || !lijst) return;
    let groep = lijst.querySelector('[data-edge-gids]');
    const uit = D.search(invoer.value, { catalog: window.RTGWorkspaceWorldCatalog, guard: gidsContext(), allow: gidsToegang, alles: true });
    // het adres staat in dezelfde catalogus; een OS-app heeft er geen
    const urlVan = id => { for (const w of window.RTGWorkspaceWorldCatalog || []) for (const i of w.items || []) if (i.id === id) return i.url || null; return null; };
    const al = new Set(Array.from(lijst.querySelectorAll('a[href]:not([data-gids-id])')).map(a => a.getAttribute('href')));
    const treffers = uit.status === 'ready' ? uit.matches.filter(m => m.kind === 'item' && !(urlVan(m.id) && al.has(urlVan(m.id)))) : [];
    if (!treffers.length) { if (groep) groep.remove(); return; }
    if (!groep) {
      groep = document.createElement('section'); groep.className = 'rtg-edge-group'; groep.setAttribute('data-edge-gids', '');
      const kop = document.createElement('h3'); kop.textContent = T('edge.gids', 'In de app'); groep.appendChild(kop);
      lijst.prepend(groep);
    }
    groep.querySelectorAll('a').forEach(a => a.remove());
    treffers.forEach((m, i) => {
      const a = document.createElement('a'), nr = document.createElement('span'), naam = document.createElement('b'), pijl = document.createElement('em');
      a.href = urlVan(m.id) || '#'; a.dataset.gidsId = m.id; a.dataset.search = (m.world + ' ' + m.name).toLowerCase();
      nr.textContent = String(i + 1).padStart(2, '0'); naam.textContent = m.name; pijl.textContent = '→';
      a.append(nr, naam, pijl);
      a.addEventListener('click', ev => {
        ev.preventDefault();
        const menu = document.querySelector('.rtg-edge-menu[aria-expanded="true"]'); if (menu) menu.click();
        gidsOpen(m);
      });
      groep.appendChild(a);
    });
    groep.hidden = false;
    const geen = gezicht.querySelector('.rtg-edge-none'); if (geen) geen.hidden = true;
  }
  document.addEventListener('input', e => {
    const t = e.target;
    if (t && t.matches && t.matches('.rtg-edge-face-all .rtg-edge-find input')) heelRtgZoek(t);
  });
