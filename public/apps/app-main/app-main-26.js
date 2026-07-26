    if (item.startsWith('tab:')) {
      const svg = tabKnop(item.slice(4)) && tabKnop(item.slice(4)).querySelector('svg');
      return svg ? svg.cloneNode(true) : document.createTextNode('•');
    }
    return glyfVoor(item) || monogram((itemDef(item) || {}).naam || item);
  }
  function itemNaam(item) {
    return item.startsWith('tab:') ? tabNaam(item.slice(4)) : (itemDef(item) || {}).naam || item;
  }
  function itemZichtbaar(item) { return item.startsWith('tab:') ? tabZichtbaar(item.slice(4)) : !!itemDef(item); }
  function openItem(item) {
    if (wiebel) return; // in wiebel-modus opent er niets, net als op een telefoon
    telGebruik(item);
    if (item.startsWith('tab:')) { const b = tabKnop(item.slice(4)); if (b) b.click(); }
    else if (item.startsWith('os:')) { openOsApp(item.slice(3)); }
    else {
      const l = LINKS[item.slice(5)];
      if (!l) return;
      // op een breed scherm opent een app als venster op het bureaublad
      // (meerdere naast elkaar); op de telefoon gewoon schermvullend.
      const openen = () => {
        if (window.RTGVensters && RTGVensters.actief()) RTGVensters.open(l.url, l.app || l.naam || 'App');
        else location.href = l.url;
      };
      // prive-apps openen pas na de algemene pin (25-os-01a.js)
      if (l.prive) return metAlgPin(openen);
      openen();
    }
  }

  /* ---------- de kiezer: Bellen, Videobellen en Snaps ----------
     Een tik op de app opent uw contacten; een tik op een contact belt,
     videobelt of stuurt de snap meteen (via de sociale laag, RTGSocial). */
  const belScrim = $('#osBelScrim'), belTitel = $('#osBelTitel'), belLijst = $('#osBelLijst');
  function openOsApp(naam) {
    const app = OSAPPS[naam]; if (!app || !belScrim) return;
    sluitScrims();
    // App Store: de eigen winkel-overlay (25-os-04b.js)
    if (naam === 'store') { openWinkel(); return; }
    // Werk: de eigen kiezer met gekoppelde werkplekken en de algemene pin
    if (naam === 'werk') { openWerkKiezer(); return; }
    belTitel.textContent = app.naam;
    belLijst.textContent = '';
    // RTFoundation: een leeftijdskeuze, daarna opent de juiste app (RTF-jas)
    if (naam === 'rtf') {
      let onthouden = null;
      try { onthouden = localStorage.getItem('rtf_app_groep'); } catch (e) {}
      for (const gr of RTF_GROEPEN) {
        const b = document.createElement('button');
        const zi = document.createElement('span'); zi.className = 'zi';
        const gg = window.RTGGlyf && RTGGlyf.svg('rtf-' + gr.g);
        if (gg) zi.appendChild(gg); else zi.textContent = (gr.naam.match(/[A-Z]/g) || ['R']).slice(0, 2).join('');
        b.appendChild(zi);
        b.appendChild(document.createTextNode(gr.naam));
        const m = document.createElement('span'); m.className = 'zm';
        m.textContent = gr.sub + (onthouden === gr.g ? ' · vorige keer' : '');
        b.appendChild(m);
        b.addEventListener('click', () => { location.href = '/apps/foundation/index.html?groep=' + gr.g; });
        belLijst.appendChild(b);
      }
      belScrim.classList.add('open');
      return;
    }
    const S = window.RTGSocial;
    const lijst = S && S.ok && S.ok() ? S.lijst() : [];
    if (!lijst.length) {
      const d = document.createElement('div');
      d.className = 'os-bel-leeg';
      d.textContent = 'Nog geen contacten. Voeg iemand toe in De Salon; daarna belt, videobelt en snapt u met een tik, zonder telefoonnummer.';
      belLijst.appendChild(d);
      const ga = document.createElement('button');
      const gi = document.createElement('span'); gi.className = 'zi';
      const gis = window.RTGGlyf && RTGGlyf.svg('salon'); if (gis) gi.appendChild(gis);
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
      const m = document.createElement('span'); m.className = 'zm';
      const mg = window.RTGGlyf && RTGGlyf.svg(naam); if (mg) m.appendChild(mg); b.appendChild(m);
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

  /* Rahuls signatuurmond als de AI-knop in het dock. Eén gedeeld canvas dat we
     bij elke herbouw opnieuw in de bol hangen (de mond-lus hervat vanzelf zodra
     hij weer in beeld is); de tekenlaag (shared/mond.js) laden we er zelf bij. */
  var aiMondCv = null, aiMondBezig = false;
  function aiMond() {
    if (!aiMondCv) {
      aiMondCv = document.createElement('canvas');
      aiMondCv.width = 440; aiMondCv.height = 200;
      aiMondCv.className = 'os-ai-mond'; aiMondCv.setAttribute('aria-hidden', 'true');
      var mount = function () { if (window.RTGMond) RTGMond.maak(aiMondCv); };
      if (window.RTGMond) mount();
      else if (!aiMondBezig) {
        aiMondBezig = true;
        var s = document.createElement('script'); s.src = '/shared/mond.js'; s.async = true;
        s.onload = mount; document.head.appendChild(s);
      }
    }
    return aiMondCv;
  }

  function maakAppIcoon(item, inDock) {
    const el = document.createElement('button');
    el.className = 'os-app'; el.dataset.sleutel = item;
    if (item.startsWith('tab:')) el.dataset.tab = item.slice(4);
    el.setAttribute('aria-label', itemNaam(item));
    const tegel = document.createElement('span'); tegel.className = 'os-tegel';
    // de AI-knop in het dock IS Rahul: zijn signatuurmond (bewegende lichtpuntjes)
    if (item === 'tab:ai' && inDock) tegel.appendChild(aiMond());
    else tegel.appendChild(tegelInhoud(item));
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

  /* ---------- map hernoemen (wiebel-modus of Rahul) ---------- */
  const hernoemScrim = $('#osHernoemScrim'), hernoemIn = $('#osHernoemIn');
  const hernoemOk = $('#osHernoemOk'), hernoemReset = $('#osHernoemReset');
  let hernoemDoel = null;
  function openHernoem(map) {
    if (!hernoemScrim) return;
    hernoemDoel = map;
    hernoemIn.value = mapNaam(map);
    hernoemScrim.classList.add('open');
