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
    spelen:      { naam: 'Spelen',       icoon: '🎲', url: '/apps/spelen.html?pas=' + encodeURIComponent(pas) },
    vrienden:    { naam: 'Vrienden',     icoon: '💬', url: '/apps/foundation/vrienden.html' },
    juridisch:   { naam: 'Juridisch',    icoon: '📜', url: '/apps/juridisch.html' },
    camera:      { naam: 'Camera',       icoon: '📸', url: '/apps/camera.html' },
    muziek:      { naam: 'RTG Sound',    icoon: '🎧', url: '/apps/muziek.html' },
    podium:      { naam: 'Podium',       icoon: '🎬', url: '/apps/podium.html' },
    flits:       { naam: 'Flits',        icoon: '🛣️', url: '/apps/flits.html' },
    theater:     { naam: 'Theater',      icoon: '🎞️', url: '/apps/theater.html' },
    wbw:         { naam: 'Wie betaalt wat', icoon: '💶', url: '/apps/wbw.html' },
    passkeys:    { naam: 'Passkeys',     icoon: '🔑', url: '/apps/passkeys.html' },
    ov:          { naam: 'OV',           icoon: '🚌', url: '/apps/ov.html' },
    clips:       { naam: 'Clips',        icoon: '🎥', url: '/apps/clips.html' },
    office:      { naam: 'RTG Office',   icoon: '📊', url: '/apps/office.html' },
    vonk:        { naam: 'Vonk',         icoon: '💘', url: '/apps/vonk.html' },
    balans:      { naam: 'Balans',       icoon: '🌿', url: '/apps/balans.html' }
  };
  /* Elke functie zijn eigen app: Bellen, Videobellen en Snaps zijn eigen
     OS-apps die een kiezer openen en dan meteen doen wat u koos, via de
     sociale laag van de leden-app (WebRTC-bellen, snaps op codenaam).
     RTFoundation is EEN app: een tik toont de leeftijdskeuze en opent dan
     de hub in de passende jas (?groep= zet de bril op). */
  const OSAPPS = {
    bellen:      { naam: 'Bellen',       icoon: '📞' },
    videobellen: { naam: 'Videobellen',  icoon: '🎥' },
    snaps:       { naam: 'Snaps',        icoon: '📷' },
    rtf:         { naam: 'RTFoundation', icoon: '🕊️' }
  };
  const RTF_GROEPEN = [
    { g: 'mini',   naam: 'RTF Mini',      icoon: '🧸', sub: '0 t/m 4 jaar' },
    { g: 'kind',   naam: 'RTF Kids',      icoon: '🎒', sub: '5 t/m 11 jaar' },
    { g: 'tiener', naam: 'RTF Tiener',    icoon: '🛹', sub: '12 t/m 15 jaar' },
    { g: 'jong',   naam: 'RTF Jong',      icoon: '🚀', sub: '16 t/m 21+' },
    { g: 'volw',   naam: 'RTF Volwassen', icoon: '🧑', sub: 'ouders en verzorgers' }
  ];
  const INDELING = [
    ['tab:reizen', 'tab:betalen', 'tab:bestellen', 'tab:ai', 'tab:salon', 'tab:terplaatse',
      { sleutel: 'map-diensten', naam: 'Diensten', items: ['tab:zorg', 'tab:assets', 'tab:gezin'] }],
    [{ sleutel: 'map-sociaal', naam: 'Sociaal', items: ['link:vrienden', 'os:bellen', 'os:videobellen', 'os:snaps', 'link:spelen'] },
      'link:bank',
      'link:ov',
      'os:rtf',
      'link:camera',
      'link:muziek',
      'link:podium',
      'link:clips',
      'link:vonk',
      'link:balans',
      'link:flits',
      'link:theater',
      'link:wbw',
      'link:office',
      'link:passkeys',
      'link:juridisch']
  ];

  /* ---------- mappen: eigen namen ----------
     De naam van een map is van de gebruiker: hernoemen kan in de wiebel-modus
     (tik op de map) of via de Butler; de keuze staat per pas in localStorage. */
  function mapNamen() { try { return JSON.parse(localStorage.getItem('rtg_os_mapnamen_' + pas) || '{}'); } catch (e) { return {}; } }
  function mapNaam(map) { return (mapNamen()[map.sleutel] || '').trim() || map.naam; }
  function zetMapNaam(map, naam) {
    try {
      const m = mapNamen();
      const schoon = (naam || '').trim().slice(0, 18);
      if (schoon && schoon !== map.naam) m[map.sleutel] = schoon; else delete m[map.sleutel];
      localStorage.setItem('rtg_os_mapnamen_' + pas, JSON.stringify(m));
    } catch (e) {}
    bouw();
  }

  /* ---------- gebruik bijhouden: het OS leert wat u vaak opent ----------
     Telt per app hoe vaak hij geopend wordt, met verval per dag; Spotlight
     zet daar de rij "Voor u" van. Alles blijft lokaal op het toestel. */
  function gebruik() { try { return JSON.parse(localStorage.getItem('rtg_os_gebruik_' + pas) || '{}'); } catch (e) { return {}; } }
  function telGebruik(sleutel) {
    try {
      const g = gebruik(), nu = Date.now(), oud = g[sleutel] || { n: 0, t: nu };
      const dagen = Math.max(0, (nu - (oud.t || nu)) / 86400000);
      g[sleutel] = { n: (oud.n || 0) * Math.pow(0.85, dagen) + 1, t: nu };
      localStorage.setItem('rtg_os_gebruik_' + pas, JSON.stringify(g));
    } catch (e) {}
  }
  function topGebruik(k) {
    const g = gebruik(), nu = Date.now();
    return Object.entries(g)
      .map(([s, v]) => [s, (v.n || 0) * Math.pow(0.85, Math.max(0, (nu - (v.t || nu)) / 86400000))])
      .sort((a, b) => b[1] - a[1])
      .map(([s]) => s)
      .filter(s => s.startsWith('tab:') ? itemZichtbaar(s)
        : s.startsWith('os:') ? !!OSAPPS[s.slice(3)]
        : (s.startsWith('link:') && !!LINKS[s.slice(5)]))
      .slice(0, k);
  }

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

  function itemDef(item) { // os-app of link-app: de registry-invoer
    return item.startsWith('os:') ? OSAPPS[item.slice(3)] : LINKS[item.slice(5)];
  }
  function tegelInhoud(item) { // svg (tab) of emoji (link/os-app) in de tegel
    if (item.startsWith('tab:')) {
      const svg = tabKnop(item.slice(4)) && tabKnop(item.slice(4)).querySelector('svg');
      return svg ? svg.cloneNode(true) : document.createTextNode('•');
    }
    const span = document.createElement('span');
    span.style.fontSize = '1.5rem';
    span.textContent = (itemDef(item) || {}).icoon || '•';
    return span;
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
    else { const l = LINKS[item.slice(5)]; if (l) location.href = l.url; }
  }

  /* ---------- de kiezer: Bellen, Videobellen en Snaps ----------
     Een tik op de app opent uw contacten; een tik op een contact belt,
     videobelt of stuurt de snap meteen (via de sociale laag, RTGSocial). */
  const belScrim = $('#osBelScrim'), belTitel = $('#osBelTitel'), belLijst = $('#osBelLijst');
  function openOsApp(naam) {
    const app = OSAPPS[naam]; if (!app || !belScrim) return;
    sluitScrims();
    belTitel.textContent = app.icoon + ' ' + app.naam;
    belLijst.textContent = '';
    // RTFoundation: een leeftijdskeuze, daarna opent de juiste app (RTF-jas)
    if (naam === 'rtf') {
      let onthouden = null;
      try { onthouden = localStorage.getItem('rtf_app_groep'); } catch (e) {}
      for (const gr of RTF_GROEPEN) {
        const b = document.createElement('button');
        const zi = document.createElement('span'); zi.className = 'zi'; zi.textContent = gr.icoon;
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
