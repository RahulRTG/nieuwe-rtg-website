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
  if (zoekInput) zoekInput.addEventListener('input', zoek);

  /* ---------- bedieningspaneel ---------- */
  const ccScrim = $('#osCcScrim');
  const ccBtn = $('#osCcBtn');
  if (ccBtn) ccBtn.addEventListener('click', () => { const open = ccScrim.classList.contains('open'); sluitScrims(); if (!open) { ccSync(); ccScrim.classList.add('open'); } });
  function ccSync() {
    const T = window.RTGOSThema;
    const rij = $('#osCcThema');
    // het thema (Champagne / Donker / Bordeaux) is een ROS-brede keuze voor iedereen
    if (rij) rij.style.display = '';
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
  /* Scannen, je Zegel en je backoffice zaten als losse knopjes in de
     statusbalk; die staat nu leeg op de bel en dit paneel na. De knoppen zelf
     blijven het model -- we klikken ze hier gewoon aan. */
  [['#osCcScan', '#scanBtn'], ['#osCcZegel', '#zegelBtn'], ['#osCcBo', '#boBtn']].forEach(([tegel, knop]) => {
    const t = $(tegel), k = $(knop);
    if (t && k) t.addEventListener('click', () => { sluitScrims(); k.click(); });
    else if (t) t.hidden = true;
  });
  // twee apps naast elkaar (split screen)
  const ccSplit = $('#osCcSplit');
  if (ccSplit) ccSplit.addEventListener('click', () => { sluitScrims(); if (window.RTGSplit) RTGSplit.open(); });
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
  // beweging: snelheid/intensiteit van de levende grond (via de gedeelde motor)
  const beweeg = $('#osCcBeweging');
  if (beweeg) {
    if (window.RTGBeweging) beweeg.value = RTGBeweging.waarde();
    beweeg.addEventListener('input', () => { if (window.RTGBeweging) RTGBeweging.zet(Number(beweeg.value)); });
  }

  /* ---------- wiebel-modus: herschikken met een lange druk ---------- */
  let wiebel = false, drukTimer = null, sleepEl = null, wiebelStart = 0;
  const klaarKnop = $('#osKlaar');
  function zetWiebel(aan) {
    wiebel = aan;
    if (aan) wiebelStart = Date.now();
    rijen.forEach(g => g.classList.toggle('os-wiebel', aan));
    if (klaarKnop) klaarKnop.hidden = !aan;
    if (!aan) { rijen.forEach((g, p) => bewaarVolgorde(p, [...g.children].map(c => c.dataset.sleutel))); sleepEl = null; }
  }
  if (klaarKnop) klaarKnop.addEventListener('click', () => zetWiebel(false));
  rijen.forEach(grid => {
