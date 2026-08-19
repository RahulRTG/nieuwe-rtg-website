/* Vervolg van gebaar-02: HET SLEPEN ZELF. Apart bestand omdat het een eigen
   onderwerp is (en omdat de maat van check.js regel 13 dat afdwong): hierboven
   staat WAT er onder een regel ligt en wat er gebeurt als je erop tikt, hier
   staat hoe een hand daar bij komt -- de richtingsvergrendeling, de weerstand,
   de drempel en het loslaten. */
  /* ---------------------------------------------------------- het slepen -- */
  function opNeer(e) {
    if (e.button != null && e.button !== 0) return;      // rechts is de actielade
    /* Op een OPEN lade begint geen nieuw gebaar: daar wordt getikt. De greep
       staat wel in de weg van de hand -- hij zit precies aan de rand waar een
       veeg naar links begint -- dus daar mag je gewoon vandaan vegen. Blijft de
       hand stilstaan, dan is het een klik en opent hij de actielade. */
    if (e.target.closest('.gb-lade')) return;
    var t = e.target;
    if (t.closest && t.closest('input,textarea,select,[contenteditable="true"]')) return;
    var rij = t.closest && t.closest('.gb-rij');
    if (!rij) { sluitAlles(); return; }
    if (openLade && openLade.rij !== rij) sluitAlles();
    var acties = actiesVan(rij);
    if (!acties) return;
    g = {
      rij: rij, acties: acties, x0: e.clientX, y0: e.clientY,
      dx: 0, vast: false, dood: false, kant: null, lade: null,
      breed: 0, drempel: 0, gereed: false, pid: e.pointerId
    };
  }

  function opBeweeg(e) {
    if (!g || g.dood || e.pointerId !== g.pid) return;
    var dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.vast) {
      /* DE RICHTINGSVERGRENDELING. Zonder deze stap steelt elke veeg het
         verticaal scrollen van de pagina, want de eerste paar pixels van een
         scroll zien er precies zo uit als het begin van een veeg. */
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > RICHTING) { g.dood = true; return; }
      if (Math.abs(dx) < RICHTING) return;
      var kant = dx < 0 ? 'rechts' : 'links';
      var lijst = g.acties[kant];
      if (!lijst || !lijst.length) { g.dood = true; return; }
      g.vast = true; g.kant = kant;
      /* WAT ABSOLUUT STAAT, SCHUIFT NIET MEE. De stip van een tijdlijn en het
         bolletje van een signaalrail zijn geen inhoud van de regel maar van de
         LIJN waar hij aan hangt; die horen te blijven staan terwijl de regel
         eronder wegschuift. Zonder deze stap veegt de tijdlijn zichzelf weg. */
      var kind = g.rij.children;
      for (var i = 0; i < kind.length; i++) {
        var pos = getComputedStyle(kind[i]).position;
        if (pos === 'absolute' || pos === 'fixed') kind[i].setAttribute('data-gb-vast', '');
      }
      /* DE RONDING VAN DE REGEL, ZODAT DE SNEDE HEM VOLGT. De lade is een
         rechthoek en de regel heeft ronde hoeken; zonder deze maat eindigt een
         open lade in een scherpe hoek naast een ronde regel -- op post viel dat
         meteen op. CSS kan een border-radius niet zelf in een clip-path lezen,
         dus wordt hij hier gemeten en doorgegeven. De lade krijgt hem een pixel
         kleiner: zij ligt BINNEN de rand van de regel en een gelijke ronding
         puilt daar net overheen. */
      var cs = getComputedStyle(g.rij);
      var buiten = parseFloat(kant === 'rechts' ? cs.borderTopRightRadius : cs.borderTopLeftRadius) || 0;
      var rand = parseFloat(kant === 'rechts' ? cs.borderRightWidth : cs.borderLeftWidth) || 0;
      px(g.rij, '--gb-rond', buiten + 'px');
      px(g.rij, '--gb-rond-lade', Math.max(0, buiten - rand) + 'px');
      g.rij.setAttribute('data-gb', kant);
      px(g.rij, '--gb-duur', '0ms');
      g.lade = bouwLade(g.rij, kant, lijst, g.rij.offsetWidth * 0.72);
      px(g.lade, '--gb-duur', '0ms');
      g.breed = g.lade.vol;
      /* De drempel ligt voorbij de volle lade EN voorbij de helft van de regel:
         wie alleen de lade wil zien, komt er nooit per ongeluk overheen. */
      g.drempel = Math.max(g.breed + 52, g.rij.offsetWidth * 0.55);
      try { g.rij.setPointerCapture(e.pointerId); } catch (err) {}
    }
    var breedte = Math.abs(dx);
    /* Voorbij de drempel wordt het zwaar. Dat is geen decoratie: weerstand is
       hoe een hand voelt dat er iets verandert, nog voor het oog het ziet. */
    if (breedte > g.drempel) breedte = g.drempel + (breedte - g.drempel) * 0.35;
    breedte = Math.min(breedte, g.rij.offsetWidth);
    g.dx = g.kant === 'rechts' ? -breedte : breedte;
    px(g.rij, '--gb-x', Math.round(g.dx) + 'px');
    px(g.lade, '--gb-lade', Math.round(breedte) + 'px');
    var gereed = breedte >= g.drempel && !g.acties[g.kant][0].borg;
    if (gereed !== g.gereed) {
      g.gereed = gereed;
      if (gereed) { g.lade.setAttribute('data-gereed', ''); tik(9); }
      else g.lade.removeAttribute('data-gereed');
    }
  }

  function opLos(e) {
    if (!g) return;
    var h = g; g = null;
    if (!h.vast) return;
    slikRij = h.rij;      // de klik die hier zo achteraan komt is de staart van dit gebaar
    try { h.rij.releasePointerCapture(h.pid); } catch (err) {}
    var lijst = h.acties[h.kant];
    if (h.gereed) {
      /* Doorgeveegd: de eerste actie gebeurt. De lade sluit METEEN -- open laten
         staan zou suggereren dat er nog iets moet gebeuren. */
      h.lade.removeAttribute('data-gereed');
      sluit(h.rij, true);
      voerUit(lijst[0], h.rij);
      return;
    }
    if (Math.abs(h.dx) >= h.breed * 0.45) {
      px(h.rij, '--gb-duur', rustig() ? '0ms' : 'var(--rtg-tijd-paneel,180ms)');
      px(h.lade, '--gb-duur', rustig() ? '0ms' : 'var(--rtg-tijd-paneel,180ms)');
      px(h.rij, '--gb-x', (h.kant === 'rechts' ? -h.breed : h.breed) + 'px');
      px(h.lade, '--gb-lade', h.breed + 'px');
      openLade = { rij: h.rij, kant: h.kant };
      return;
    }
    sluit(h.rij);
  }
