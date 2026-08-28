
  /* Afgesplitst van app-main-27.js, dat over de 10 KB ging. De snede loopt
     langs de grens tussen ZOEKEN (Spotlight: wat staat er op dit OS) en
     BEDIENEN (het paneel, de helderheid, de wiebel-modus). */
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
    const gps = $('#osCcGps');
    if (gps) {
      const g = window.RTGPlek ? RTGPlek.aan() : false;
      gps.classList.toggle('aan', g);
      gps.setAttribute('aria-pressed', String(g));
    }
  }
  document.querySelectorAll('#osCcThema button').forEach(b => b.addEventListener('click', () => {
    if (window.RTGOSThema) { RTGOSThema.zet(b.dataset.thema); ccSync(); }
  }));
  const ccTaal = $('#osCcTaal');
  if (ccTaal) ccTaal.addEventListener('click', () => { sluitScrims(); if (window.RTGi18n) RTGi18n.openModal(); });
  const ccPush = $('#osCcPush');
  if (ccPush) ccPush.addEventListener('click', async () => { if (window.RTGRealtime) { await RTGRealtime.enablePush(); ccSync(); } });
  /* DE LOCATIESCHAKELAAR, DIE ER NIET WAS.

     Zeven plekken (navigatie, flits, ov, ovdienst, de sterrenhemel, het
     levensteken van RTG Veilig en de ontmoet-lus) lezen `rtg_os_gps` en
     behandelen hem als de waarheid: alleen een uitdrukkelijke '1' geeft je
     positie vrij. Terecht -- maar niemand zette hem ooit op '1', want deze
     tegel bestond niet en shared/osmenu.js, waar de commentaren naar
     verwijzen, bestaat evenmin. De schakelaar stond dus voor iedereen, voor
     altijd, op uit. Dat is geen instelling maar een dode functie: "de gps doet
     het niet", en gelijk heeft wie dat zegt.

     shared/plek.js houdt de sleutel; hier staat alleen de knop. Aanzetten
     vraagt meteen een positie op, zodat de tegel niet "aan" zegt terwijl het
     toestel weigert -- dan springt hij zichtbaar terug op uit. */
  const ccGps = $('#osCcGps');
  if (ccGps) ccGps.addEventListener('click', async () => {
    if (!window.RTGPlek) return;
    await RTGPlek.zetAan(!RTGPlek.aan());
    ccSync();
  });
  const ccPin = $('#osCcPin');
  if (ccPin) ccPin.addEventListener('click', () => { sluitScrims(); metAlgPin(() => {}); });
  const ccZoek = $('#osCcZoek');
  if (ccZoek) ccZoek.addEventListener('click', openZoek);
  /* Scannen, je Zegel, je backoffice en de bel zaten als losse knopjes in de
     statusbalk; die staat nu helemaal leeg. Het beginscherm is mappen, klok,
     functies en de balk van Rahul -- en verder niets. De knoppen zelf blijven
     het model (verborgen in de HTML): we klikken ze hier gewoon aan, zodat het
     gedrag op EEN plek blijft wonen.

     De bel hoorde er per se bij. Zonder deze tegel was er na het leegmaken van
     de balk geen enkele ingang meer naar wat er voor je klaarligt, en dat merk
     je pas als je iets mist -- de stilste storing die er is. */
  [['#osCcScan', '#scanBtn'], ['#osCcZegel', '#zegelBtn'], ['#osCcBo', '#boBtn'],
   ['#osCcBel', '#bell']].forEach(([tegel, knop]) => {
    const t = $(tegel), k = $(knop);
    if (t && k) t.addEventListener('click', () => { sluitScrims(); k.click(); });
    else if (t) t.hidden = true;
  });
  /* De vier van Instellingen: identiteit, bescherming, sleutels en akkoorden.
     Ze staan hier als tegel en in MAPPEN als map zonder `wereld` -- twee
     weergaven van EEN lijst, want de tegel leest zijn item uit het attribuut en
     opent hem met dezelfde openItem als overal. Wie er een vijfde bij zet, zet
     hem op beide plekken of nergens; dat is de prijs van een paneel dat in HTML
     staat en een register dat in JS staat, en hij hoort hier genoemd te worden
     in plaats van pas op te vallen als er een mist. */
  document.querySelectorAll('[data-cc-open]').forEach((t) => {
    t.addEventListener('click', () => { sluitScrims(); openItem(t.dataset.ccOpen); });
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
  let wiebel = false, drukTimer = null, sleepEl = null, wiebelStart = 0, drukX = 0, drukY = 0;
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
