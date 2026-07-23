      const gi = document.createElement('span'); gi.className = 'zi'; gi.textContent = '🫂';
      ga.appendChild(gi); ga.appendChild(document.createTextNode('Naar De Salon'));
      ga.addEventListener('click', () => { sluitScrims(); const b = tabKnop('salon'); if (b) b.click(); });
      belLijst.appendChild(ga);
    }
    for (const c of lijst) {
      const b = document.createElement('button');
      const zi = document.createElement('span'); zi.className = 'zi';
      zi.textContent = String(c.codename || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
      b.appendChild(zi);
      b.appendChild(document.createTextNode(c.codename || ''));
      const m = document.createElement('span'); m.className = 'zm'; m.textContent = app.icoon; b.appendChild(m);
      b.addEventListener('click', () => {
        sluitScrims();
        if (!window.RTGSocial) return;
        if (naam === 'snaps') RTGSocial.snap(c.key);
        else RTGSocial.bel(c.key, c.codename, naam === 'videobellen');
      });
      belLijst.appendChild(b);
    }
    belScrim.classList.add('open');
  }

  function maakAppIcoon(item, inDock) {
    const el = document.createElement('button');
    el.className = 'os-app'; el.dataset.sleutel = item;
    if (item.startsWith('tab:')) el.dataset.tab = item.slice(4);
    el.setAttribute('aria-label', itemNaam(item));
    const tegel = document.createElement('span'); tegel.className = 'os-tegel';
    tegel.appendChild(tegelInhoud(item));
    if (item.startsWith('tab:')) {
      const dot = tabKnop(item.slice(4)) && tabKnop(item.slice(4)).querySelector('span[id$="Dot"]');
      if (dot && dot.style.display !== 'none') { const b = document.createElement('span'); b.className = 'os-badge'; tegel.appendChild(b); }
    }
    el.appendChild(tegel);
    if (!inDock) { const n = document.createElement('span'); n.className = 'os-naam'; n.textContent = itemNaam(item); el.appendChild(n); }
    el.addEventListener('click', () => openItem(item));
    return el;
  }
  function maakMapIcoon(map) {
    const el = document.createElement('button');
    el.className = 'os-app os-map'; el.dataset.sleutel = map.sleutel;
    el.setAttribute('aria-label', 'Map ' + mapNaam(map));
    const tegel = document.createElement('span'); tegel.className = 'os-tegel os-map-tegel';
    for (const item of map.items.filter(itemZichtbaar).slice(0, 9)) {
      const mini = document.createElement('span'); mini.className = 'os-map-mini';
      mini.appendChild(tegelInhoud(item)); tegel.appendChild(mini);
    }
    el.appendChild(tegel);
    const n = document.createElement('span'); n.className = 'os-naam'; n.textContent = mapNaam(map); el.appendChild(n);
    // gewoon tikken opent de map; in de wiebel-modus tik je om te hernoemen
    el.addEventListener('click', () => {
      if (!wiebel) { openMap(map); return; }
      if (Date.now() - wiebelStart > 600) openHernoem(map);
    });
    return el;
  }

  function bouw() {
    // pagina 2 toont wat je in de App Store hebt geïnstalleerd (25-os-04b.js)
    INDELING[1] = geinstalleerdeItems();
    grids.forEach((grid, p) => {
      grid.textContent = '';
      for (const it of gesorteerd(p)) {
        if (typeof it === 'string') { if (itemZichtbaar(it)) grid.appendChild(maakAppIcoon(it, false)); }
        else if (it.items.some(itemZichtbaar)) grid.appendChild(maakMapIcoon(it));
      }
    });
    dock.textContent = '';
    for (const t of DOCK) if (tabZichtbaar(t)) dock.appendChild(maakAppIcoon('tab:' + t, true));
    sync();
  }

  /* ---------- mappen openen ---------- */
  const mapScrim = $('#osMapScrim'), mapGrid = $('#osMapGrid'), mapTitel = $('#osMapTitel');
  function openMap(map) {
    mapTitel.textContent = mapNaam(map);
    mapGrid.textContent = '';
    for (const item of map.items.filter(itemZichtbaar)) {
      const el = maakAppIcoon(item, false);
      // alleen de map zelf dicht: een os-app (Bellen) opent hierna zijn kiezer
      el.addEventListener('click', () => mapScrim.classList.remove('open'));
      mapGrid.appendChild(el);
    }
    mapScrim.classList.add('open');
  }

  /* ---------- map hernoemen (wiebel-modus of Butler) ---------- */
  const hernoemScrim = $('#osHernoemScrim'), hernoemIn = $('#osHernoemIn');
  const hernoemOk = $('#osHernoemOk'), hernoemReset = $('#osHernoemReset');
  let hernoemDoel = null;
  function openHernoem(map) {
    if (!hernoemScrim) return;
    hernoemDoel = map;
    hernoemIn.value = mapNaam(map);
    hernoemScrim.classList.add('open');
    setTimeout(() => { hernoemIn.focus(); hernoemIn.select(); }, 60);
  }
  if (hernoemOk) hernoemOk.addEventListener('click', () => { if (hernoemDoel) zetMapNaam(hernoemDoel, hernoemIn.value); sluitScrims(); });
  if (hernoemReset) hernoemReset.addEventListener('click', () => { if (hernoemDoel) zetMapNaam(hernoemDoel, ''); sluitScrims(); });
  if (hernoemIn) hernoemIn.addEventListener('keydown', e => { if (e.key === 'Enter' && hernoemOk) hernoemOk.click(); });

  /* ---------- overlays: gedeeld sluiten ---------- */
  const scrims = ['#osMapScrim', '#osZoekScrim', '#osCcScrim', '#osHernoemScrim', '#osBelScrim', '#osWinkelScrim'].map(s => $(s)).filter(Boolean);
  function sluitScrims() { scrims.forEach(s => s.classList.remove('open')); }
  scrims.forEach(s => s.addEventListener('click', e => { if (e.target === s) sluitScrims(); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { sluitScrims(); zetWiebel(false); } });

  /* ---------- zoeken (Spotlight) ---------- */
  const zoekScrim = $('#osZoekScrim'), zoekInput = $('#osZoekInput'), zoekLijst = $('#osZoekLijst');
  function alleItems() {
    const uit = [];
    INDELING.flat().forEach(it => {
      if (typeof it === 'string') { if (itemZichtbaar(it)) uit.push({ item: it, uit: null }); }
      else it.items.forEach(sub => { if (itemZichtbaar(sub)) uit.push({ item: sub, uit: mapNaam(it) }); });
    });
    return uit;
  }
  // acties zijn ook gewoon vindbaar in Spotlight: instellingen als resultaten
  function osActies() {
    const uit = [
      { naam: 'Licht of donker', icoon: '🌗', doe: () => { const b = $('#rtg-thema-knop'); if (b) b.click(); } },
      { naam: 'Meldingen', icoon: '🔔', doe: () => { const b = $('#bell'); if (b) b.click(); } },
      { naam: 'Bedieningspaneel', icoon: '🎛️', doe: () => { ccSync(); if (ccScrim) ccScrim.classList.add('open'); } },
      { naam: 'Taal kiezen', icoon: '🌐', doe: () => { if (window.RTGi18n) RTGi18n.openModal(); } },
      { naam: 'Push aanzetten', icoon: '📳', doe: () => { if (window.RTGRealtime) RTGRealtime.enablePush(); } },
      { naam: 'Uitloggen', icoon: '⏻', doe: () => { const b = $('#logoutBtn'); if (b) b.click(); } }
    ];
    if (window.RTGOSThema && RTGOSThema.keuzeMogelijk()) {
      for (const t of ['bordeaux', 'parelmoer', 'standaard']) {
        uit.push({ naam: 'Thema ' + (t === 'standaard' ? 'klassiek' : t), icoon: '🎨', doe: () => RTGOSThema.zet(t) });
      }
    }
    return uit;
  }
  // De Butler vanuit het zoekscherm: open zijn app, vul de vraag in en verstuur
  // via de bestaande chat-knoppen; de hele acties-registry van de Butler
  // (bestellen, boeken, betalen, plannen, annuleren) doet dan gewoon zijn werk.
  function vraagButler(q) {
    sluitScrims();
    const b = tabKnop('ai'); if (b) b.click();
    const inp = $('#askInput'), knop = $('#askBtn');
    if (inp && knop && q) { inp.value = q; setTimeout(() => knop.click(), 150); }
    else if (inp) inp.focus();
  }
  function zoekSectie(tekst) {
    const d = document.createElement('div'); d.className = 'os-zoek-sectie'; d.textContent = tekst;
    zoekLijst.appendChild(d);
  }
  function zoekRij(icoonNode, label, meta, doe) {
    const b = document.createElement('button');
    const zi = document.createElement('span'); zi.className = 'zi'; zi.appendChild(icoonNode);
    b.appendChild(zi);
    b.appendChild(document.createTextNode(label));
    if (meta) { const m = document.createElement('span'); m.className = 'zm'; m.textContent = meta; b.appendChild(m); }
    b.addEventListener('click', doe);
    zoekLijst.appendChild(b);
  }
  function zoek() {
    const q = (zoekInput.value || '').trim().toLowerCase();
    zoekLijst.textContent = '';
    // leeg veld: eerst "Voor u", de apps die u hier het vaakst opent
    if (!q) {
      const top = topGebruik(4);
      if (top.length) {
        zoekSectie('Voor u');
        for (const s of top) zoekRij(tegelInhoud(s), itemNaam(s), null, () => { sluitScrims(); openItem(s); });
        zoekSectie('Alle apps');
      }
    }
    for (const { item, uit } of alleItems()) {
      if (q && !itemNaam(item).toLowerCase().includes(q)) continue;
      zoekRij(tegelInhoud(item), itemNaam(item), uit, () => { sluitScrims(); openItem(item); });
    }
    // acties (instellingen en schakelaars) doen mee zodra er getypt wordt
    if (q) {
      const acts = osActies().filter(a => a.naam.toLowerCase().includes(q));
      if (acts.length) {
        zoekSectie('Acties');
        for (const a of acts) {
          const ic = document.createElement('span'); ic.textContent = a.icoon;
          zoekRij(ic, a.naam, null, () => { sluitScrims(); a.doe(); });
        }
      }
    }
    // altijd onderaan: geef de vraag aan de Butler, wat het ook is
