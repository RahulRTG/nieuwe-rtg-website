/* ============================== RTG OS-schil ==============================
   De leden-app als telefoon-besturingssysteem: meerdere hoofdschermen
   (scroll-snap + stippen), apps in mappen, een zoekpil (Spotlight), een
   bedieningspaneel (thema, taal, push, helderheid, uitloggen) en iconen
   herschikken met een lange druk (wiebel-modus, volgorde in localStorage).

   De (verborgen) tabbar blijft het model: alle bestaande logica schakelt daar
   tabs, zichtbaarheid (gast-modus, Assets, Gezin) en badges. Deze laag
   SPIEGELT dat model; kliks op tab-iconen lopen terug het model in
   (button.click()), dus er is een navigatiepad en geen drift. */
(() => {
  const $ = s => document.querySelector(s);
  const tabbar = $('#tabbar'), app = $('#app'), content = $('#content');
  const grids = [$('#osGrid'), $('#osGrid2')];
  const dock = $('#osDock'), pages = $('#osPages'), dots = $('#osDots');
  if (!tabbar || !app || !grids[0] || !grids[1] || !dock || !pages) return;

  const pas = new URLSearchParams(location.search).get('pas') || 'rtg';
  // De Butler in het midden van het dock, als grotere gouden orb: hij is het
  // hart van het OS en doet alles wat je hem vraagt.
  const DOCK = ['betalen', 'bestellen', 'ai', 'salon', 'terplaatse'];

  /* ---------- de indeling: tab-apps, link-apps en mappen ----------
     Link-apps zijn losse leden-pagina's die als eigen app openen. */
  const LINKS = {
    spelen:     { naam: 'Spelen',       icoon: '🎲', url: '/apps/spelen.html?pas=' + encodeURIComponent(pas) },
    vrienden:   { naam: 'Vrienden',     icoon: '💬', url: '/apps/foundation/vrienden.html' },
    website:    { naam: 'Website',      icoon: '🌍', url: '/' },
    paspagina:  { naam: 'RTG Pass',     icoon: '🎫', url: '/site/rtg-pass.html' },
    foundation: { naam: 'RTFoundation', icoon: '🕊️', url: '/site/rtfoundation.html' },
    privacy:    { naam: 'Privacy',      icoon: '🔒', url: '/site/privacy.html' },
    boeken:     { naam: 'Boeken',       icoon: '🧭', url: '/site/boeken.html' },
    download:   { naam: 'Apps',         icoon: '⬇️', url: '/site/download.html' }
  };
  const INDELING = [
    ['tab:reizen', 'tab:betalen', 'tab:bestellen', 'tab:ai', 'tab:salon', 'tab:terplaatse',
      { sleutel: 'map-diensten', naam: 'Diensten', items: ['tab:zorg', 'tab:assets', 'tab:gezin'] }],
    [{ sleutel: 'map-sociaal', naam: 'Sociaal', items: ['link:spelen', 'link:vrienden'] },
      { sleutel: 'map-rtg', naam: 'RTG & info', items: ['link:website', 'link:paspagina', 'link:foundation', 'link:privacy'] },
      'link:boeken', 'link:download']
  ];

  const sleutelVan = it => typeof it === 'string' ? it : it.sleutel;
  function bewaardeVolgorde(p) { try { return JSON.parse(localStorage.getItem('rtg_os_indeling_' + pas + '_' + p) || 'null'); } catch (e) { return null; } }
  function bewaarVolgorde(p, volgorde) { try { localStorage.setItem('rtg_os_indeling_' + pas + '_' + p, JSON.stringify(volgorde)); } catch (e) {} }
  function gesorteerd(p) {
    const basis = INDELING[p], orde = bewaardeVolgorde(p);
    if (!orde) return basis;
    const perSleutel = new Map(basis.map(it => [sleutelVan(it), it]));
    const uit = [];
    for (const s of orde) if (perSleutel.has(s)) { uit.push(perSleutel.get(s)); perSleutel.delete(s); }
    for (const it of basis) if (perSleutel.has(sleutelVan(it))) uit.push(it); // nieuw sinds de bewaring: achteraan
    return uit;
  }

  /* ---------- iconen bouwen ---------- */
  const tabKnop = t => tabbar.querySelector('button[data-tab="' + t + '"]');
  const tabZichtbaar = t => { const b = tabKnop(t); return !!b && b.style.display !== 'none'; };
  const tabNaam = t => { const s = tabKnop(t); const sp = s && s.querySelector('span'); return sp ? sp.textContent : t; };

  function tegelInhoud(item) { // svg (tab) of emoji (link) in de tegel
    if (item.startsWith('tab:')) {
      const svg = tabKnop(item.slice(4)) && tabKnop(item.slice(4)).querySelector('svg');
      return svg ? svg.cloneNode(true) : document.createTextNode('•');
    }
    const span = document.createElement('span');
    span.style.fontSize = '1.5rem';
    span.textContent = (LINKS[item.slice(5)] || {}).icoon || '•';
    return span;
  }
  function itemNaam(item) {
    return item.startsWith('tab:') ? tabNaam(item.slice(4)) : (LINKS[item.slice(5)] || {}).naam || item;
  }
  function itemZichtbaar(item) { return item.startsWith('tab:') ? tabZichtbaar(item.slice(4)) : true; }
  function openItem(item) {
    if (wiebel) return; // in wiebel-modus opent er niets, net als op een telefoon
    if (item.startsWith('tab:')) { const b = tabKnop(item.slice(4)); if (b) b.click(); }
    else { const l = LINKS[item.slice(5)]; if (l) location.href = l.url; }
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
    el.setAttribute('aria-label', 'Map ' + map.naam);
    const tegel = document.createElement('span'); tegel.className = 'os-tegel os-map-tegel';
    for (const item of map.items.filter(itemZichtbaar).slice(0, 4)) {
      const mini = document.createElement('span'); mini.className = 'os-map-mini';
      mini.appendChild(tegelInhoud(item)); tegel.appendChild(mini);
    }
    el.appendChild(tegel);
    const n = document.createElement('span'); n.className = 'os-naam'; n.textContent = map.naam; el.appendChild(n);
    el.addEventListener('click', () => { if (!wiebel) openMap(map); });
    return el;
  }

  function bouw() {
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
    mapTitel.textContent = map.naam;
    mapGrid.textContent = '';
    for (const item of map.items.filter(itemZichtbaar)) {
      const el = maakAppIcoon(item, false);
      el.addEventListener('click', () => sluitScrims());
      mapGrid.appendChild(el);
    }
    mapScrim.classList.add('open');
  }

  /* ---------- overlays: gedeeld sluiten ---------- */
  const scrims = ['#osMapScrim', '#osZoekScrim', '#osCcScrim'].map(s => $(s)).filter(Boolean);
  function sluitScrims() { scrims.forEach(s => s.classList.remove('open')); }
  scrims.forEach(s => s.addEventListener('click', e => { if (e.target === s) sluitScrims(); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { sluitScrims(); zetWiebel(false); } });

  /* ---------- zoeken (Spotlight) ---------- */
  const zoekScrim = $('#osZoekScrim'), zoekInput = $('#osZoekInput'), zoekLijst = $('#osZoekLijst');
  function alleItems() {
    const uit = [];
    INDELING.flat().forEach(it => {
      if (typeof it === 'string') { if (itemZichtbaar(it)) uit.push({ item: it, uit: null }); }
      else it.items.forEach(sub => { if (itemZichtbaar(sub)) uit.push({ item: sub, uit: it.naam }); });
    });
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
  function zoek() {
    const q = (zoekInput.value || '').trim().toLowerCase();
    zoekLijst.textContent = '';
    for (const { item, uit } of alleItems()) {
      if (q && !itemNaam(item).toLowerCase().includes(q)) continue;
      const b = document.createElement('button');
      const zi = document.createElement('span'); zi.className = 'zi'; zi.appendChild(tegelInhoud(item));
      b.appendChild(zi);
      b.appendChild(document.createTextNode(itemNaam(item)));
      if (uit) { const m = document.createElement('span'); m.className = 'zm'; m.textContent = uit; b.appendChild(m); }
      b.addEventListener('click', () => { sluitScrims(); openItem(item); });
      zoekLijst.appendChild(b);
    }
    // altijd onderaan: geef de vraag aan de Butler, wat het ook is
    const bb = document.createElement('button');
    const bi = document.createElement('span'); bi.className = 'zi'; bi.textContent = '✦'; bb.appendChild(bi);
    bb.appendChild(document.createTextNode(q ? 'Vraag de Butler: "' + zoekInput.value.trim() + '"' : 'Vraag de Butler'));
    bb.addEventListener('click', () => vraagButler(zoekInput.value.trim()));
    zoekLijst.appendChild(bb);
  }
  function openZoek() { sluitScrims(); zoekScrim.classList.add('open'); zoekInput.value = ''; zoek(); zoekInput.focus(); }
  const zoekPil = $('#osZoekPil');
  if (zoekPil) zoekPil.addEventListener('click', openZoek);
  if (zoekInput) zoekInput.addEventListener('input', zoek);

  /* ---------- bedieningspaneel ---------- */
  const ccScrim = $('#osCcScrim');
  const ccBtn = $('#osCcBtn');
  if (ccBtn) ccBtn.addEventListener('click', () => { const open = ccScrim.classList.contains('open'); sluitScrims(); if (!open) { ccSync(); ccScrim.classList.add('open'); } });
  function ccSync() {
    const T = window.RTGOSThema;
    const rij = $('#osCcThema');
    if (rij) rij.style.display = T && T.keuzeMogelijk() ? '' : 'none';
    if (T) document.querySelectorAll('#osCcThema button').forEach(b => b.classList.toggle('actief', b.dataset.thema === T.huidig()));
    const push = $('#osCcPush');
    if (push && window.RTGRealtime) push.classList.toggle('aan', RTGRealtime.pushOn && RTGRealtime.pushOn());
  }
  document.querySelectorAll('#osCcThema button').forEach(b => b.addEventListener('click', () => {
    if (window.RTGOSThema) { RTGOSThema.zet(b.dataset.thema); ccSync(); }
  }));
  const ccTaal = $('#osCcTaal');
  if (ccTaal) ccTaal.addEventListener('click', () => { sluitScrims(); if (window.RTGi18n) RTGi18n.openModal(); });
  const ccPush = $('#osCcPush');
  if (ccPush) ccPush.addEventListener('click', async () => { if (window.RTGRealtime) { await RTGRealtime.enablePush(); ccSync(); } });
  const ccZoek = $('#osCcZoek');
  if (ccZoek) ccZoek.addEventListener('click', openZoek);
  // licht/donker: de (verborgen) gedeelde themaknop blijft de motor
  const ccLicht = $('#osCcLicht');
  if (ccLicht) ccLicht.addEventListener('click', () => { const b = $('#rtg-thema-knop'); if (b) b.click(); });
  const ccUit = $('#osCcUit');
  if (ccUit) ccUit.addEventListener('click', () => { sluitScrims(); const b = $('#logoutBtn'); if (b) b.click(); });
  // helderheid: puur visueel, onthouden per browser
  const helder = $('#osCcHelder');
  function zetHelder(v) { app.style.filter = v >= 110 ? '' : 'brightness(' + (v / 100) + ')'; try { localStorage.setItem('rtg_os_helder', String(v)); } catch (e) {} }
  if (helder) {
    const h = Number(localStorage.getItem('rtg_os_helder') || 100);
    helder.value = h; zetHelder(h);
    helder.addEventListener('input', () => zetHelder(Number(helder.value)));
  }

  /* ---------- wiebel-modus: herschikken met een lange druk ---------- */
  let wiebel = false, drukTimer = null, sleepEl = null;
  const klaarKnop = $('#osKlaar');
  function zetWiebel(aan) {
    wiebel = aan;
    grids.forEach(g => g.classList.toggle('os-wiebel', aan));
    if (klaarKnop) klaarKnop.hidden = !aan;
    if (!aan) { grids.forEach((g, p) => bewaarVolgorde(p, [...g.children].map(c => c.dataset.sleutel))); sleepEl = null; }
  }
  if (klaarKnop) klaarKnop.addEventListener('click', () => zetWiebel(false));
  grids.forEach(grid => {
    grid.addEventListener('pointerdown', e => {
      const el = e.target.closest('.os-app'); if (!el) return;
      drukTimer = setTimeout(() => { zetWiebel(true); }, 550);
      if (wiebel) { sleepEl = el; el.classList.add('os-sleep'); el.setPointerCapture && el.setPointerCapture(e.pointerId); }
    });
    grid.addEventListener('pointermove', e => {
      if (drukTimer && (Math.abs(e.movementX) > 3 || Math.abs(e.movementY) > 3) && !wiebel) { clearTimeout(drukTimer); drukTimer = null; }
      if (!wiebel || !sleepEl) return;
      const onder = document.elementFromPoint(e.clientX, e.clientY);
      const doel = onder && onder.closest && onder.closest('.os-app');
      if (doel && doel !== sleepEl && doel.parentElement === sleepEl.parentElement) {
        const kinderen = [...sleepEl.parentElement.children];
        sleepEl.parentElement.insertBefore(sleepEl, kinderen.indexOf(doel) > kinderen.indexOf(sleepEl) ? doel.nextSibling : doel);
      }
    });
    const laat = () => { if (drukTimer) { clearTimeout(drukTimer); drukTimer = null; } if (sleepEl) { sleepEl.classList.remove('os-sleep'); sleepEl = null; grids.forEach((g, p) => bewaarVolgorde(p, [...g.children].map(c => c.dataset.sleutel))); } };
    grid.addEventListener('pointerup', laat);
    grid.addEventListener('pointercancel', laat);
  });

  /* ---------- pagina-stippen ---------- */
  function bouwDots() {
    dots.textContent = '';
    INDELING.forEach((_, i) => {
      const d = document.createElement('button');
      d.setAttribute('aria-label', 'Hoofdscherm ' + (i + 1));
      d.addEventListener('click', () => pages.scrollTo({ left: i * pages.clientWidth, behavior: 'smooth' }));
      dots.appendChild(d);
    });
    dotSync();
  }
  function dotSync() {
    const i = Math.round(pages.scrollLeft / Math.max(1, pages.clientWidth));
    [...dots.children].forEach((d, j) => d.classList.toggle('actief', j === i));
  }
  let dotRaf = null;
  pages.addEventListener('scroll', () => { if (!dotRaf) dotRaf = requestAnimationFrame(() => { dotRaf = null; dotSync(); }); });

  /* ---------- app-modus, statusbalk en model-spiegeling (als voorheen) ---------- */
  function actieveTab() { const b = tabbar.querySelector('button.active'); return b ? b.dataset.tab : 'home'; }
  function sync() {
    const tab = actieveTab(), open = tab !== 'home';
    app.classList.toggle('os-open', open);
    // schermvast zodra de app zichtbaar is: dock en pill echt onderin beeld
    document.body.classList.toggle('os-vast', getComputedStyle(app).display !== 'none');
    if (content) content.classList.toggle('os-thuis', !open);
    const terug = $('#osTerug'), brand = $('#osBrand'), titel = $('#osAppTitel');
    if (terug) terug.hidden = !open;
    if (brand) brand.style.display = open ? 'none' : '';
    if (titel) titel.textContent = open ? tabNaam(tab) : '';
    dock.querySelectorAll('.os-app').forEach(d => d.classList.toggle('actief', d.dataset.tab === tab));
  }
  let gepland = null;
  new MutationObserver(() => {
    if (gepland) return;
    gepland = requestAnimationFrame(() => { gepland = null; bouw(); });
  }).observe(tabbar, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
  // de gate/app-wissel (inloggen, uitloggen) stuurt de schermvaste modus
  new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ['style', 'class'] });

  const naarHome = () => { const b = tabKnop('home'); if (b) b.click(); };
  const terug = $('#osTerug'), pill = $('#osPill');
  if (terug) terug.addEventListener('click', naarHome);
  // de pill: een tik gaat naar het beginscherm, vasthouden roept de Butler
  // (het Siri-gebaar van dit OS)
  let pillLang = false, pillTimer = null;
  if (pill) {
    pill.addEventListener('pointerdown', () => {
      pillLang = false;
      pillTimer = setTimeout(() => { pillLang = true; vraagButler(''); }, 550);
    });
    const pillLos = () => { if (pillTimer) { clearTimeout(pillTimer); pillTimer = null; } };
    pill.addEventListener('pointerup', pillLos);
    pill.addEventListener('pointercancel', pillLos);
    pill.addEventListener('click', () => { if (!pillLang) naarHome(); pillLang = false; });
  }

  const klok = $('#osKlok'), datum = $('#osDatum');
  const gateKlok = $('#gateKlok'), gateDatum = $('#gateDatum');
  function tik() {
    const d = new Date();
    const uur = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (klok) klok.textContent = uur;
    if (gateKlok) gateKlok.textContent = uur;
    const taal = (document.documentElement.lang || 'nl');
    let lang;
    try { lang = d.toLocaleDateString(taal, { weekday: 'long', day: 'numeric', month: 'long' }); }
    catch (e) { lang = d.toLocaleDateString(); }
    if (datum) datum.textContent = lang;
    if (gateDatum) gateDatum.textContent = lang;
  }
  tik(); setInterval(tik, 15000);

  /* ---------- notificatie-banner: glijdt bovenin binnen ---------- */
  let bannerEl = null, bannerTimer = null;
  function bannerToon(icoon, titel, tekst) {
    if (!bannerEl) {
      bannerEl = document.createElement('button');
      bannerEl.className = 'os-banner';
      bannerEl.setAttribute('aria-live', 'polite');
      bannerEl.addEventListener('click', () => { bannerWeg(); const b = $('#bell'); if (b) b.click(); });
      app.appendChild(bannerEl);
    }
    bannerEl.textContent = '';
    const ic = document.createElement('span'); ic.className = 'ob-ic'; ic.textContent = icoon || '🔔';
    const kol = document.createElement('span');
    const t = document.createElement('div'); t.className = 'ob-titel'; t.textContent = titel || 'RTG';
    kol.appendChild(t);
    if (tekst) { const bd = document.createElement('div'); bd.className = 'ob-body'; bd.textContent = tekst; kol.appendChild(bd); }
    bannerEl.appendChild(ic); bannerEl.appendChild(kol);
    requestAnimationFrame(() => bannerEl.classList.add('open'));
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(bannerWeg, 4500);
  }
  function bannerWeg() {
    if (bannerEl) bannerEl.classList.remove('open');
    if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
  }
  // live meldingen als banner: de kern geeft zijn onChange pas bij start() aan
  // de realtime-bus, dus wikkelen we start() in en haken we daar op mee.
  if (window.RTGRealtime && typeof RTGRealtime.start === 'function') {
    const echteStart = RTGRealtime.start.bind(RTGRealtime);
    RTGRealtime.start = (token, opts) => {
      opts = opts || {};
      const oud = opts.onChange;
      opts.onChange = n => {
        if (oud) oud(n);
        if (n && n.title) bannerToon(n.icon || '🔔', n.title, n.body || '');
      };
      return echteStart(token, opts);
    };
  }

  /* ---------- de Butler bestuurt het OS ----------
     Zinnen die het OS zelf kan uitvoeren (open <app>, thema, licht/donker,
     zoek, home) onderscheppen we in de capture-fase, vóór de chat-handlers;
     al het andere gaat gewoon door naar de Butler-chat, die met zijn
     acties-registry op de server bestelt, boekt, betaalt en annuleert. */
  function alleDoelen() {
    const uit = [];
    for (const { item } of alleItems()) uit.push({ naam: itemNaam(item), doe: () => openItem(item) });
    INDELING.flat().forEach(it => { if (typeof it !== 'string') uit.push({ naam: it.naam, doe: () => openMap(it) }); });
    return uit;
  }
  function osCommando(ruw) {
    const q = (ruw || '').trim().toLowerCase().replace(/[?.!]+$/, '');
    if (!q) return false;
    if (/^(home|thuis|beginscherm)$/.test(q)) { sluitScrims(); naarHome(); bannerToon('✦', 'Butler', 'Naar het beginscherm.'); return true; }
    let m = q.match(/^zoek(?:en)?(?:\s+naar)?\s+(.+)$/);
    if (m) { openZoek(); zoekInput.value = m[1]; zoek(); return true; }
    m = q.match(/^thema\s+(bordeaux|parelmoer|standaard|klassiek)$/);
    if (m && window.RTGOSThema && RTGOSThema.keuzeMogelijk()) {
      RTGOSThema.zet(m[1] === 'klassiek' ? 'standaard' : m[1]);
      bannerToon('✦', 'Butler', 'Het thema staat op ' + m[1] + '.');
      return true;
    }
    if (/^(licht|donker|lichte modus|donkere modus)$/.test(q)) {
      const b = $('#rtg-thema-knop');
      if (b) { b.click(); bannerToon('✦', 'Butler', 'De weergave is omgezet.'); return true; }
      return false;
    }
    m = q.match(/^(?:open|start|ga naar)\s+(.+)$/);
    if (m) {
      const naam = m[1].replace(/^(?:de|het|een)\s+/, '');
      const doelen = alleDoelen();
      const doel = doelen.find(d => d.naam.toLowerCase() === naam) || doelen.find(d => d.naam.toLowerCase().includes(naam));
      if (doel) { sluitScrims(); doel.doe(); bannerToon('✦', 'Butler', doel.naam + ' staat voor u open.'); return true; }
    }
    return false;
  }
  document.addEventListener('click', e => {
    if (!e.target || !e.target.closest || !e.target.closest('#askBtn')) return;
    const inp = $('#askInput');
    if (inp && osCommando(inp.value)) { inp.value = ''; e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target || e.target.id !== 'askInput') return;
    if (osCommando(e.target.value)) { e.target.value = ''; e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);

  /* ---------- widgets op hoofdscherm 2: verbergen, terughalen, herschikken ----------
     Zelfde gebaar als bij de iconen: lang drukken op een kaart zet de
     wiebel-modus aan; de minus verbergt, de gestippelde chips halen terug,
     slepen herschikt. Kaarten die de app zelf verbergt (hidden-attribuut)
     blijven van de app; wij beheren alleen onze eigen klasse. */
  const pagina2 = $('#osPagina2'), wChips = $('#osWChips');
  const W_NAMEN = {
    homeTrip: 'Reis', homePay: 'Betalen', homeSalon: 'De Salon', homeContacts: 'Contacten',
    homeSpelen: 'Spelen', homeCv: 'CV', homeVacatures: 'Vacatures', homeFoundation: 'Foundation'
  };
  function wStand() { try { return JSON.parse(localStorage.getItem('rtg_os_widgets_' + pas) || 'null') || {}; } catch (e) { return {}; } }
  function wBewaar(st) { try { localStorage.setItem('rtg_os_widgets_' + pas, JSON.stringify(st)); } catch (e) {} }
  const wKaarten = () => pagina2 ? [...pagina2.querySelectorAll(':scope > .card')].filter(c => W_NAMEN[c.id]) : [];
  function wToepas() {
    if (!pagina2) return;
    const st = wStand(), kaarten = wKaarten();
    kaarten.forEach(c => c.classList.toggle('os-w-verborgen', (st.verborgen || []).includes(c.id)));
    const perId = new Map(kaarten.map(c => [c.id, c]));
    (st.volgorde || []).forEach(id => { const c = perId.get(id); if (c) pagina2.appendChild(c); });
  }
  let wiebelW = false, wSleep = null, wTimer = null;
  function wChipsBouw() {
    if (!wChips) return;
    wChips.textContent = '';
    for (const id of wStand().verborgen || []) {
      if (!document.getElementById(id)) continue;
      const b = document.createElement('button');
      b.textContent = '+ ' + (W_NAMEN[id] || id);
      b.addEventListener('click', () => {
        const s = wStand(); s.verborgen = (s.verborgen || []).filter(x => x !== id); wBewaar(s);
        wToepas(); zetWiebelW(true);
      });
      wChips.appendChild(b);
    }
  }
  function zetWiebelW(aan) {
    wiebelW = aan;
    if (!pagina2) return;
    pagina2.classList.toggle('os-wiebel-w', aan);
    if (klaarKnop) klaarKnop.hidden = !(aan || wiebel);
    pagina2.querySelectorAll('.os-w-min').forEach(b => b.remove());
    if (aan) {
      for (const c of wKaarten()) {
        if (c.hidden || c.classList.contains('os-w-verborgen')) continue;
        const min = document.createElement('button');
        min.className = 'os-w-min'; min.textContent = '−';
        min.setAttribute('aria-label', 'Verberg widget ' + (W_NAMEN[c.id] || c.id));
        min.addEventListener('click', e => {
          e.stopPropagation();
          const s = wStand(); s.verborgen = [...new Set([...(s.verborgen || []), c.id])]; wBewaar(s);
          wToepas(); zetWiebelW(true);
        });
        c.appendChild(min);
      }
      wChipsBouw();
    } else {
      const s = wStand(); s.volgorde = wKaarten().map(c => c.id); wBewaar(s); wSleep = null;
    }
  }
  if (klaarKnop) klaarKnop.addEventListener('click', () => { if (wiebelW) zetWiebelW(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && wiebelW) zetWiebelW(false); });
  if (pagina2) {
    pagina2.addEventListener('pointerdown', e => {
      const c = e.target.closest('.card');
      if (!c || c.parentElement !== pagina2 || !W_NAMEN[c.id]) return;
      if (e.target.closest('button, a, input') && !wiebelW) return; // knoppen in widgets gewoon laten werken
      wTimer = setTimeout(() => zetWiebelW(true), 550);
      if (wiebelW && !e.target.closest('.os-w-min')) { wSleep = c; c.classList.add('os-sleep'); }
    });
    pagina2.addEventListener('pointermove', e => {
      if (wTimer && !wiebelW && (Math.abs(e.movementX) > 3 || Math.abs(e.movementY) > 3)) { clearTimeout(wTimer); wTimer = null; }
      if (!wiebelW || !wSleep) return;
      const onder = document.elementFromPoint(e.clientX, e.clientY);
      const doel = onder && onder.closest && onder.closest('.card');
      if (doel && doel !== wSleep && doel.parentElement === pagina2) {
        const kinderen = [...pagina2.children];
        pagina2.insertBefore(wSleep, kinderen.indexOf(doel) > kinderen.indexOf(wSleep) ? doel.nextSibling : doel);
      }
    });
    const wLos = () => {
      if (wTimer) { clearTimeout(wTimer); wTimer = null; }
      if (wSleep) {
        wSleep.classList.remove('os-sleep'); wSleep = null;
        const s = wStand(); s.volgorde = wKaarten().map(c => c.id); wBewaar(s);
      }
    };
    pagina2.addEventListener('pointerup', wLos);
    pagina2.addEventListener('pointercancel', wLos);
    wToepas();
  }

  bouw(); bouwDots();
})();
