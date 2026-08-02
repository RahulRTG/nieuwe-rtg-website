  /* Rahuls signatuurmond in de balk onderaan het beginscherm. Eén gedeeld
     canvas (de mond-lus hervat vanzelf zodra hij weer in beeld is); de
     tekenlaag (shared/mond.js) laden we er zelf bij. */
  var aiMondCv = null, aiMondBezig = false, aiOrbMond = null;
  function aiMond() {
    if (!aiMondCv) {
      aiMondCv = document.createElement('canvas');
      aiMondCv.width = 440; aiMondCv.height = 200;
      aiMondCv.className = 'os-ai-mond'; aiMondCv.setAttribute('aria-hidden', 'true');
      // de handle bewaren: als Rahul in de draad iets zegt, beweegt de mond mee
      var mount = function () { if (window.RTGMond) aiOrbMond = RTGMond.maak(aiMondCv); };
      if (window.RTGMond) mount();
      else if (!aiMondBezig) {
        aiMondBezig = true;
        var s = document.createElement('script'); s.src = '/shared/mond.js'; s.async = true;
        s.onload = mount; document.head.appendChild(s);
      }
    }
    return aiMondCv;
  }

  function maakAppIcoon(item) {
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
    const n = document.createElement('span'); n.className = 'os-naam'; n.textContent = itemNaam(item); el.appendChild(n);
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

  /* Het beginscherm tekenen: de mappen bovenaan, de functies onder de klok.
     Een lege map (alles erin uitgezet of niet van toepassing op deze pas)
     laten we weg -- geen tegels die nergens heen gaan. */
  /* De afdruk van het beginscherm: precies datgene wat bouw() zou tekenen, als
     een tekenreeks -- welke tegels, in welke volgorde, met welke mapnaam EN
     met welk meldingsbolletje. Dat laatste hoort erbij: een badge die opkomt
     is een echte verandering en moet wel doortekenen. Zo kunnen we zien of
     opnieuw tekenen ergens toe leidt. */
  let vorigeAfdruk = null;
  const badgeVan = item => {
    if (!item.startsWith('tab:')) return '';
    const knop = tabKnop(item.slice(4));
    const dot = knop && knop.querySelector('span[id$="Dot"]');
    return (dot && dot.style.display !== 'none') ? '!' : '';
  };
  const afdruk = () => rijen.map((_, p) => gesorteerd(p).map(it =>
    typeof it === 'string'
      ? (itemZichtbaar(it) ? it + badgeVan(it) : '')
      : (it.items.some(itemZichtbaar) ? it.sleutel + ':' + mapNaam(it) + ':' + it.items.filter(itemZichtbaar).slice(0, 9).join('+') : '')
  ).join(',')).join('|');

  function bouw() {
    rijen.forEach((rij, p) => {
      rij.textContent = '';
      for (const it of gesorteerd(p)) {
        if (typeof it === 'string') { if (itemZichtbaar(it)) rij.appendChild(maakAppIcoon(it)); }
        else if (it.items.some(itemZichtbaar)) rij.appendChild(maakMapIcoon(it));
      }
    });
    // wat er nu staat is per definitie bij; de waarnemer hoeft er niet overheen
    vorigeAfdruk = afdruk();
    sync();
  }

  /* ---------- mappen openen ---------- */
  const mapScrim = $('#osMapScrim'), mapGrid = $('#osMapGrid'), mapTitel = $('#osMapTitel');
  function openMap(map) {
    mapTitel.textContent = mapNaam(map);
    mapGrid.textContent = '';
    for (const item of map.items.filter(itemZichtbaar)) {
      const el = maakAppIcoon(item);
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
