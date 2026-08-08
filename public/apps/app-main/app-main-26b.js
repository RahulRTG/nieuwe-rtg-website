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

  /* EEN KAPOTTE TEGEL MAG NIET HET HELE BEGINSCHERM KOSTEN.

     Dit is de plek waar de tegels ontstaan, en hij stond buiten elk vangnet:
     gooide een van de iconen (of een van de regels die bepaalt of hij zichtbaar
     is), dan brak de hele lus af en bleef er geen enkele tegel over. Wat je dan
     ziet is een leeg beginscherm met alleen de vaste onderdelen -- precies de
     melding "ik zie alleen de Rahul-balk".

     Nu valt per tegel te falen: de rest van de rij wordt gewoon gebouwd, en de
     console noemt de tegel bij naam. Een scherm met negentien van de twintig
     tegels is een werkende app; een leeg scherm is dat niet. */
  function bouw() {
    const stuk = [];
    rijen.forEach((rij, p) => {
      rij.textContent = '';
      for (const it of gesorteerd(p)) {
        try {
          if (typeof it === 'string') {  if (itemZichtbaar(it)) rij.appendChild(maakAppIcoon(it)); }
          else if (it.items.some(itemZichtbaar)) rij.appendChild(maakMapIcoon(it));
        } catch (e) {
          const naam = typeof it === 'string' ? it : (it && it.sleutel) || 'onbekend';
          stuk.push(naam);
          console.error('[rtg] tegel "' + naam + '" kon niet gebouwd worden:', e);
        }
      }
    });
    if (stuk.length) meldLeegScherm('tegels: ' + stuk.join(', '));
    // wat er nu staat is per definitie bij; de waarnemer hoeft er niet overheen
    vorigeAfdruk = afdruk();
    sync();
  }

  /* ---------- mappen openen ---------- */
  const mapScrim = $('#osMapScrim'), mapGrid = $('#osMapGrid'), mapTitel = $('#osMapTitel');
  /* Een brede app opent in SECTIES en niet als een raster losse merknamen.

     Dat is het verschil tussen honderd apps en vijf. Wie "Geld" opende zag
     tien tegels met ieder een eigen naam -- Wallet, RTG-code, Lab-fonds -- en
     moest zelf uitzoeken welke hij nodig had. Nu staat er "Betalen",
     "Rekeningen", "Samen en bezit", en daaronder wat je daar doet. De namen
     eronder zijn functies geworden en geen producten (zie LINKS in 24.js).

     Een sectie waarvan geen enkel onderdeel zichtbaar is (pas, boardroom, gast)
     verdwijnt hier helemaal: een kopje boven een leeg vak is erger dan geen
     kopje, want het suggereert dat er iets weg is. */
  function openMap(map) {
    mapTitel.textContent = mapNaam(map);
    mapGrid.textContent = '';
    // oudere bewaarde indelingen kennen alleen een vlakke lijst; die krijgt
    // hier een naamloze sectie, zodat een map altijd te openen is
    const secties = map.secties || [{ naam: '', items: map.items }];
    /* Een brede app met maar EEN deur opent die deur. Het Privekantoor is zo'n
       geval -- het is zelf al een app met kamers, dus een tussenscherm met een
       enkele tegel erop zou een extra tik zijn die niets kiest. Dit geldt ook
       als een lid de rest van een map heeft uitgezet in zijn boardroom. */
    const zichtbaar = secties.reduce((a, x) => a.concat(x.items.filter(itemZichtbaar)), []);
    if (zichtbaar.length === 1) { openItem(zichtbaar[0]); return; }
    for (const sectie of secties) {
      const zicht = sectie.items.filter(itemZichtbaar);
      if (!zicht.length) continue;
      if (sectie.naam) {
        const kop = document.createElement('h4');
        kop.className = 'os-sectiekop';
        kop.textContent = T('os.sectie.' + sectie.naam.toLowerCase().replace(/[^a-z]+/g, ''), sectie.naam);
        mapGrid.appendChild(kop);
      }
      const rij = document.createElement('div');
      rij.className = 'os-grid os-map-grid';
      for (const item of zicht) {
        const el = maakAppIcoon(item);
        // alleen de map zelf dicht: een os-app (Bellen) opent hierna zijn kiezer
        el.addEventListener('click', () => mapScrim.classList.remove('open'));
        rij.appendChild(el);
      }
      mapGrid.appendChild(rij);
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
