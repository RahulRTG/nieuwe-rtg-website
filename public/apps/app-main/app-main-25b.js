/* ---------- Mappen, gebruik en het bouwen van de tegels ----------

   Afgesplitst van app-main-25.js toen die over de 10 kB ging. Let op de VORM
   van deze knip: de bundel plakt de delen rauw aaneen en app-main-25.js eindigt
   MIDDEN in een functie (tegelInhoud loopt door in 26). Een blok uit het midden
   verplaatsen zou de volgorde van de stroom veranderen -- dat is hier een keer
   gebeurd, en toen belandde openWerkKiezer() binnen in tegelInhoud(). Regel 42
   van de keuring ving dat meteen: "aangeroepen buiten de functie waarin hij
   verklaard staat", op het scherm een lege bel.

   Een deel van een bundel mag dus alleen aan de STAART worden afgeknipt, nooit
   uit het midden. Wat hier staat is precies de staart van 25. */
  /* ---------- mappen: eigen namen ----------
     De naam van een map is van de gebruiker: hernoemen kan in de wiebel-modus
     (tik op de map) of via Rahul; de keuze staat per pas in localStorage. */
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
  /* ---------- het ritme: WANNEER je iets opent ----------
     De teller hierboven weet WAT je vaak opent; dit weet wanneer. Samen zijn ze
     "normaal open je nu Kantoor". Zelfde principe als hierboven, en daarom
     bewust dezelfde vorm: lokaal op het toestel, met verval per dag, zodat een
     gewoonte die je loslaat vanzelf uitdooft in plaats van jaren mee te wegen.

     ER GAAT NIETS NAAR DE SERVER. Niet je uren, niet je ritme, niets. Dat is
     dezelfde afspraak als bij de codenamen: wat je niet verstuurt, kan ook niet
     uitlekken.

     De sleutel is wereld + uur. Uren zijn grof genoeg om een gewoonte te
     vangen en te grof om een dag mee te reconstrueren -- dat is precies de
     bedoeling. */
  function ritmeLees() { try { return JSON.parse(localStorage.getItem('rtg_os_ritme_' + pas) || '{}'); } catch (e) { return {}; } }
  function telRitme(sleutel) {
    try {
      const r = ritmeLees(), nu = Date.now(), k = sleutel + '|' + new Date().getHours();
      const oud = r[k] || { n: 0, t: nu };
      const dagen = Math.max(0, (nu - (oud.t || nu)) / 86400000);
      r[k] = { n: (oud.n || 0) * Math.pow(0.85, dagen) + 1, t: nu };
      localStorage.setItem('rtg_os_ritme_' + pas, JSON.stringify(r));
    } catch (e) {}
  }
  /* Wat open je normaal OP DIT UUR? Alleen als het echt een patroon is:
     minstens DREMPEL keer, en duidelijk vaker dan de nummer twee. Anders zwijgt
     hij -- liever stil dan een gok die als inzicht klinkt. */
  const RITME_DREMPEL = 3;
  function ritmeNu() {
    const r = ritmeLees(), nu = Date.now(), uur = new Date().getHours();
    const scores = Object.entries(r)
      .filter(([k]) => Number(k.split('|')[1]) === uur)
      .map(([k, v]) => [k.split('|')[0], (v.n || 0) * Math.pow(0.85, Math.max(0, (nu - (v.t || nu)) / 86400000))])
      .sort((a, b) => b[1] - a[1]);
    if (!scores.length || scores[0][1] < RITME_DREMPEL) return null;
    // een koploper die nauwelijks voorloopt is geen gewoonte maar een muntworp
    if (scores[1] && scores[0][1] < scores[1][1] * 1.5) return null;
    return scores[0][0];
  }

  function topGebruik(k) {
    const g = gebruik(), nu = Date.now();
    return Object.entries(g)
      .map(([s, v]) => [s, (v.n || 0) * Math.pow(0.85, Math.max(0, (nu - (v.t || nu)) / 86400000))])
      .sort((a, b) => b[1] - a[1])
      .map(([s]) => s)
      .filter(itemZichtbaar)
      .slice(0, k);
  }

  const sleutelVan = it => typeof it === 'string' ? it : it.sleutel;
  // rij 0 = de mappen boven de klok, rij 1 = de functies eronder
  const RIJEN = () => [MAPPEN, FUNCTIES];
  function bewaardeVolgorde(p) { try { return JSON.parse(localStorage.getItem('rtg_os_indeling_' + pas + '_' + p) || 'null'); } catch (e) { return null; } }
  function bewaarVolgorde(p, volgorde) { try { localStorage.setItem('rtg_os_indeling_' + pas + '_' + p, JSON.stringify(volgorde)); } catch (e) {} }
  function gesorteerd(p) {
    const basis = RIJEN()[p], orde = bewaardeVolgorde(p);
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
  // een Bodoni-monogram als de app (nog) geen eigen glyf heeft: de eerste
  // letters van de naam, netjes in de display-letter (huisstijl, geen emoji).
  function monogram(naam) {
    const woorden = String(naam || '').trim().split(/\s+/).filter(w => !/^(de|het|een|rtg|rtf|mijn)$/i.test(w));
    let m = woorden.length >= 2 ? (woorden[0][0] + woorden[1][0])
      : (woorden[0] || naam || '?').slice(0, 2);
    const span = document.createElement('span');
    span.className = 'os-monogram';
    span.textContent = m.toUpperCase();
    return span;
  }
  function glyfVoor(item) { // huisstijl-glyf op naam van de sleutel
    const sleutel = item.slice(item.indexOf(':') + 1);
    return window.RTGGlyf ? RTGGlyf.svg(sleutel) : null;
  }
  function tegelInhoud(item) { // svg (tab), glyf (link/os-app) of monogram in de tegel
