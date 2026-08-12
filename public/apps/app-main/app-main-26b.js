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
    /* EEN WERELD IS EEN APP EN ZIET ERUIT ALS EEN APP: een tegel met een glyf,
       geen mapvoorbeeld met minitegels (PLATFORM.md par. 0). Het mapvoorbeeld
       had ook een echt gebrek: het telde de ZICHTBARE onderdelen, dus op de
       instappas toonde RTG Leven drie snippers en RTFoundation een -- en dan
       oogt de instap budget, precies wat de merkregel verbiedt. Een glyf is
       op elke pas even vol. */
    if (map.wereld) {
      const tegel = document.createElement('span'); tegel.className = 'os-tegel';
      const g = window.RTGGlyf && RTGGlyf.svg(map.glyf);
      if (g) tegel.appendChild(g);
      else { const m = document.createElement('span'); m.className = 'os-monogram'; m.textContent = mapNaam(map).replace(/^RTG /, '').slice(0, 2); tegel.appendChild(m); }
      el.appendChild(tegel);
      const nm = document.createElement('span'); nm.className = 'os-naam'; nm.textContent = mapNaam(map); el.appendChild(nm);
      el.addEventListener('click', () => { if (!wiebel) openMap(map); });
      return el;
    }
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
    /* De ring van de wereldstand hangt aan DEZELFDE bouw() als de tegels. Dat is
       geen nettigheid maar de kern van de afspraak: welke werelden je ziet en
       welke onderdelen erin zitten hangt aan je pas en je boardroom, dus twee
       lijsten die op verschillende momenten worden bijgewerkt lopen uit elkaar.
       Eerder hing de ring aan het laden van de pagina, en die is een slag
       eerder dan de boardroom-gegevens: het beginscherm was leeg. */
    if (typeof wereldBij === 'function') wereldBij();
  }

  /* ---------- mappen openen ---------- */
  const mapScrim = $('#osMapScrim'), mapGrid = $('#osMapGrid'), mapTitel = $('#osMapTitel');
  /* HIER STOND EEN SECTIE-INDELING, EN DIE WERD NOOIT GEBRUIKT.

     De opzet was: een brede map opent in kopjes ("Betalen", "Rekeningen")
     in plaats van een raster losse merknamen. Alleen las deze functie
     `map.secties` en zette NIEMAND dat ooit -- MAPPEN in 24a2.js draagt alleen
     `items`, van de bewaarde indeling wordt alleen de NAAM onthouden
     (rtg_os_mapnamen_*), en de server bemoeit zich er niet mee. Elke map liep
     dus altijd door de terugvaltak. `.os-sectiekop` had bovendien nergens CSS:
     was er ooit een kopje verschenen, dan als kale h4 met browsermarges.

     Dat is precies de rommel waar deze codebase elders een naam voor heeft: een
     klasse zonder element, en hier een tak zonder aanroeper. Hij leest als een
     feature die bestaat, dus niemand durft eraan te komen. Weg dus -- en met
     hem de reden dat de tegels over elkaar heen lagen: de sectie-lus maakte
     RIJEN, die rijen kregen zelf een raster, en ze hingen in een #osMapGrid dat
     ook al een raster was. Nu is er een raster en liggen de tegels er direct
     in.

     Komt de indeling terug, geef de rijen dan een eigen wikkel en haal het
     raster van #osMapGrid af -- niet twee rasters in elkaar.
     test/appmenu.e2e.js meet de meetkunde en zakt als dat weer gebeurt. */
  function openMap(map) {
    /* ACHT WERELDEN (PLATFORM.md par. 0). Een wereld is een APP en geen map:
       tikken opent hem, en er komt geen tussenscherm met tegels. De `items`
       blijven staan zolang de onderdelen nog eigen pagina's zijn -- Spotlight
       indexeert ze en zonder die index is er halverwege de verhuizing van
       alles onvindbaar. Naarmate een wereld zijn secties opslokt, loopt die
       lijst vanzelf leeg. */
    if (map.wereld) { telRitme(map.sleutel); location.href = map.wereld; return; }
    mapTitel.textContent = mapNaam(map);
    mapGrid.textContent = '';
    const zicht = map.items.filter(itemZichtbaar);
    /* Een brede app met maar EEN deur opent die deur. Het Privekantoor is zo'n
       geval -- het is zelf al een app met kamers, dus een tussenscherm met een
       enkele tegel erop zou een extra tik zijn die niets kiest. Dit geldt ook
       als een lid de rest van een map heeft uitgezet in zijn boardroom. */
    if (zicht.length === 1) { openItem(zicht[0]); return; }
    for (const item of zicht) {
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
