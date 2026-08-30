/* een map hernoemen op het springboard */
    setTimeout(() => { hernoemIn.focus(); hernoemIn.select(); }, 60);
  }
  if (hernoemOk) hernoemOk.addEventListener('click', () => { if (hernoemDoel) zetMapNaam(hernoemDoel, hernoemIn.value); sluitScrims(); });
  if (hernoemReset) hernoemReset.addEventListener('click', () => { if (hernoemDoel) zetMapNaam(hernoemDoel, ''); sluitScrims(); });
  if (hernoemIn) hernoemIn.addEventListener('keydown', e => { if (e.key === 'Enter' && hernoemOk) hernoemOk.click(); });

  /* ---------- overlays: gedeeld sluiten ---------- */
  const scrims = ['#osMapScrim', '#osZoekScrim', '#osCcScrim', '#osHernoemScrim', '#osBelScrim', '#osWinkelScrim']
    .map(s => $(s)).filter(Boolean);
  function sluitScrims() { scrims.forEach(s => s.classList.remove('open')); }
  scrims.forEach(s => s.addEventListener('click', e => { if (e.target === s) sluitScrims(); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { sluitScrims(); zetWiebel(false); } });

  /* ---------- zoeken (Spotlight) ---------- */
  const zoekScrim = $('#osZoekScrim'), zoekInput = $('#osZoekInput'), zoekLijst = $('#osZoekLijst');
  function alleItems() {
    const uit = [], gezien = new Set();
    const voeg = (item, map) => {
      if (gezien.has(item) || !itemZichtbaar(item)) return;
      gezien.add(item); uit.push({ item: item, uit: map });
    };
    FUNCTIES.forEach(it => voeg(it, null));
    MAPPEN.forEach(mp => mp.items.forEach(sub => voeg(sub, mapNaam(mp))));
    return uit;
  }
  // acties zijn ook gewoon vindbaar in Spotlight: instellingen als resultaten
  function osActies() {
    const uit = [
      { naam: 'Licht of donker', glyf: 'thema', doe: () => { const b = $('#rtg-thema-knop'); if (b) b.click(); } },
      { naam: 'Meldingen', glyf: 'meldingen', doe: () => { const b = $('#bell'); if (b) b.click(); } },
      { naam: 'Bedieningspaneel', glyf: 'paneel', doe: () => { ccSync(); if (ccScrim) ccScrim.classList.add('open'); } },
      { naam: 'Taal kiezen', glyf: 'taal', doe: () => { if (window.RTGi18n) RTGi18n.openModal(); } },
      { naam: 'Push aanzetten', glyf: 'push', doe: () => { if (window.RTGRealtime) RTGRealtime.enablePush(); } },
      { naam: 'Uitloggen', glyf: 'uitloggen', doe: () => { const b = $('#logoutBtn'); if (b) b.click(); } }
    ];
    if (window.RTGOSThema && RTGOSThema.keuzeMogelijk()) {
      for (const t of ['bordeaux', 'parelmoer', 'standaard']) {
        uit.push({ naam: 'Thema ' + (t === 'standaard' ? 'klassiek' : t), glyf: 'thema', doe: () => RTGOSThema.zet(t) });
      }
    }
    return uit;
  }
  // Rahul vanuit het zoekscherm: open zijn app, vul de vraag in en verstuur
  // via de bestaande chat-knoppen; de hele acties-registry van Rahul
  // (bestellen, boeken, betalen, plannen, annuleren) doet dan gewoon zijn werk.
  function vraagRahul(q) {
    sluitScrims();
    const b = tabKnop('ai'); if (b) b.click();
    const inp = $('#askInput'), knop = $('#askBtn');
    if (inp && knop && q) { inp.value = q; setTimeout(() => knop.click(), 150); }
    else if (inp) inp.focus();
  }
  /* Ook buiten deze laag bruikbaar. Twee plekken in de buitenste IIFE deden
     `if (typeof ask === 'function') ask(vraag)` -- en `ask` bestaat nergens, dus
     die knoppen openden Rahul wel en vulden de vraag NOOIT in. De guard ving het
     stil af. Eén functie, hier, en daar aangeroepen: geen tweede kopie. */
  window.RTGVraag = vraagRahul;
  /* De handelingen worden EEN keer opgehaald en daarna hergebruikt; hij is
     klein en verandert alleen bij een nieuwe bouw. Mislukt het ophalen, dan is
     de lijst leeg en doet de lade gewoon wat hij hiervoor deed. */
  let HANDELINGEN = [];
  fetch('/shared/handelingindex.json', { credentials: 'same-origin' })
    .then(r => (r.ok ? r.json() : { items: [] }))
    .then(j => { HANDELINGEN = (j && j.items) || []; })
    .catch(() => { HANDELINGEN = []; });

  function zoekSectie(tekst) {
    const d = document.createElement('div'); d.className = 'os-zoek-sectie'; d.textContent = tekst;
    zoekLijst.appendChild(d);
  }
  /* `sleutel` is optioneel en alleen gezet op rijen die een APP zijn.

     Waarom hij er is: Spotlight is sinds het springboard verdween de enige
     plek waar de onderdelen van een wereld nog te vinden zijn (zie openMap in
     app-main-26b.js -- de `items` blijven bestaan zodat deze index ze kan
     indexeren). Een rij droeg alleen zijn ZICHTBARE naam, en die namen
     veranderen met beleid: "Werk OS" werd "Mijn werkplekken", "RTG Office"
     werd "Documenten". Wie wil nagaan of een app nog vindbaar is, moest dus
     op een etiket zoeken dat juist hoort te mogen schuiven.

     De sleutel schuift niet: die verandert alleen als de app echt een andere
     app wordt. Hij staat hier dus naast het etiket, net als op een tegel
     (app-main-26b.js doet hetzelfde met dataset.sleutel). */
  function zoekRij(icoonNode, label, meta, doe, sleutel) {
    const b = document.createElement('button');
    if (sleutel) b.dataset.sleutel = sleutel;
    /* HET ADRES OP DE RIJ. Een rij die alleen in een klikafhandelaar weet waar
       hij heen gaat, bestaat niet voor scripts/tikken.js -- de meter die telt
       hoeveel tikken een functie van het beginscherm af ligt, en die met opzet
       alleen ECHTE bestemmingen telt (anders is hij op te poetsen met een
       belofte). Zwijgt deze lijst, dan meet het huis zich dieper dan het is.
       De klik blijft lopen via openItem(): dit is een etiket en geen tweede weg. */
    if (sleutel && sleutel.indexOf('link:') === 0) {
      const l = LINKS[sleutel.slice(5)];
      if (l && l.url) b.dataset.url = l.url;
    }
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
    // zodra je iets typt: Rahul bovenaan. Zoeken gaat zo naadloos over in laten-
    // doen -- wat je ook typt (een app-naam, een klus, een vraag), Rahul pakt het
    // op met je eigen inlog. De letterlijke tekst gaat mee (niet de lowercase).
    if (q) {
      const bt = document.createElement('span'); bt.textContent = '✦';
      zoekRij(bt, 'Laat Rahul dit doen: "' + zoekInput.value.trim() + '"', null,
        () => vraagRahul(zoekInput.value.trim()));
    }
    // leeg veld: eerst "Voor u", de apps die u hier het vaakst opent
    if (!q) {
      const top = topGebruik(4);
      if (top.length) {
        zoekSectie('Voor u');
        for (const s of top) zoekRij(tegelInhoud(s), itemNaam(s), null, () => { sluitScrims(); openItem(s); }, s);
        zoekSectie('Alle apps');
      }
    }
    for (const { item, uit } of alleItems()) {
      if (q && !itemNaam(item).toLowerCase().includes(q)) continue;
      zoekRij(tegelInhoud(item), itemNaam(item), uit, () => { sluitScrims(); openItem(item); }, item);
    }
    /* HANDELINGEN DIE IN EEN ANDERE APP WONEN. Dezelfde lijst die de sprong op
       elk ander scherm toont (shared/handelingindex.json, gegenereerd uit de
       knoppen van de schermen zelf). Zonder dit deed de zoeklade hier MINDER dan
       de sprong drie schermen verderop, en dat is precies het soort verschil dat
       een mens niet kan onthouden.

       Alleen bij een zoekwoord, en een tik brengt je ERHEEN: uitvoeren doet de
       mens op het scherm zelf (GRAMMATICA.md). */
    if (q && HANDELINGEN.length) {
      const treffers = HANDELINGEN.filter(h => (h.label + ' ' + h.app).toLowerCase().includes(q)).slice(0, 8);
      if (treffers.length) {
        zoekSectie('Handelingen');
        for (const h of treffers) {
          const ic = document.createElement('span'); ic.textContent = '>';
          zoekRij(ic, h.label, 'in ' + h.app, () => {
            sluitScrims();
            if (window.RTGCommand && RTGCommand.actief()) RTGCommand.open(h.url, h.app);
            else location.href = h.url;
          });
        }
      }
    }
    // acties (instellingen en schakelaars) doen mee zodra er getypt wordt
    if (q) {
      const acts = osActies().filter(a => a.naam.toLowerCase().includes(q));
      if (acts.length) {
        zoekSectie('Acties');
        for (const a of acts) {
          const ic = (window.RTGGlyf && RTGGlyf.svg(a.glyf)) || document.createTextNode('');
          zoekRij(ic, a.naam, null, () => { sluitScrims(); a.doe(); });
        }
      }
    }
    // altijd onderaan: geef de vraag aan Rahul, wat het ook is
    // bij een lege zoekbalk staat Rahul onderaan als vaste ingang; zodra je typt
    // staat hij al bovenaan (zie zoek()), dus dan slaan we de dubbele rij over.
    if (!q) {
      const bi = document.createElement('span'); bi.textContent = '✦';
      zoekRij(bi, 'Vraag Rahul', null, () => vraagRahul(''));
    }
  }
  function openZoek() { sluitScrims(); zoekScrim.classList.add('open'); zoekInput.value = ''; zoek(); zoekInput.focus(); }
  /* EEN KEER VOORAF OPBOUWEN. De lade blijft dicht; wat verandert is dat de
     lijst er al IN staat. Twee redenen: hij staat er meteen als u hem opent, en
     hij is meetbaar -- een korte weg die pas na een tik bestaat, telt in geen
     enkele meting mee (zie de opmerking bij zoekRij hierboven). */
  if (zoekLijst) setTimeout(zoek, 800);
  if (zoekInput) zoekInput.addEventListener('input', zoek);

