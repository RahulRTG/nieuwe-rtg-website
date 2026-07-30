  /* ---------- audio-focus: wijken voor een ander geluid ---------- */
  function exclusiefActief() { for (var i = 0; i < focusStack.length; i++) if (focusStack[i].exclusief) return true; return false; }
  function pasFocusToe() {
    if (!ctx) return;
    var exclusief = exclusiefActief(), duik = focusStack.length > 0;
    if (exclusief) { if (ctx.state === 'running') ctx.suspend(); }
    else if (speelt && ctx.state === 'suspended') { ctx.resume(); }
    var doel = exclusief ? 0 : (duik ? 0.16 : 1);
    try { duck.gain.cancelScheduledValues(ctx.currentTime); duck.gain.setTargetAtTime(doel, ctx.currentTime, 0.15); } catch (e) {}
  }
  function focus(bron, opt) { focusStack.push({ bron: bron || 'geluid', exclusief: !!(opt && opt.exclusief) }); pasFocusToe(); }
  function losFocus(bron) {
    var i = -1; for (var j = focusStack.length - 1; j >= 0; j--) if (focusStack[j].bron === bron) { i = j; break; }
    if (i >= 0) focusStack.splice(i, 1); else focusStack.pop();
    pasFocusToe();
  }

  function positie() { return (ctx && station) ? Math.max(0, ctx.currentTime - startTijd) : 0; }
  function stand() {
    return station ? { stationId: station.id, station: station.naam, glyph: station.icoon,
      seed: seed, titel: trackNaam(seed), speelt: !!(speelt && ctx && ctx.state === 'running'),
      positie: positie(), duur: duur, sampleRate: ctx ? ctx.sampleRate : 0 } : null;
  }
  function meld() {
    var s = stand();
    for (var i = 0; i < luisteraars.length; i++) { try { luisteraars[i](s); } catch (e) {} }
    if (window.RTGSpeler && s) RTGSpeler.zet({ app: 'RTG Sound', titel: s.titel, artiest: 'RTG Sound',
      station: s.station, stationId: s.stationId, glyph: s.glyph, speelt: s.speelt, seed: s.seed,
      start: Date.now() - Math.round(s.positie * 1000) });
  }
  function opStand(fn) { luisteraars.push(fn); return stand(); }

  // een hartslag houdt de gedeelde stand vers (positie schuift, samen-luisteraars
  // synchroniseren), en bij het verlaten van het scherm melden we dat we zwijgen
  setInterval(function () { if (speelt && ctx && ctx.state === 'running') meld(); }, 2500);
  window.addEventListener('pagehide', function () {
    if (window.RTGSpeler && station) RTGSpeler.zet({ app: 'RTG Sound', titel: trackNaam(seed),
      artiest: 'RTG Sound', station: station.naam, stationId: station.id, glyph: station.icoon,
      speelt: false, seed: seed, start: Date.now() - Math.round(positie() * 1000) });
  });

  /* de gedeelde speler-laag stuurt bediening en focus hierheen */
  if (window.RTGSpeler) {
    RTGSpeler.opCommando(function (cmd) {
      if (cmd === 'next') volgende(); else if (cmd === 'prev') opnieuw();
      else if (cmd === 'pause') pauze(); else if (cmd === 'play') hervat();
      else if (cmd === 'toggle') toggle();
      else if (cmd === 'focus') focus('extern'); else if (cmd === 'losfocus') losFocus('extern');
    });
  }

  // op elk scherm de laatste stand kunnen hervatten, zodra er een tik is
  // (autoplay-regels vragen om een gebaar); alleen als de muziek aan stond.
  function hervatBijGebaar() {
    var s = window.RTGSpeler && RTGSpeler.laatste();
    if (!s || !s.speelt || s.app !== 'RTG Sound' || !s.stationId) return;
    var doe = function () {
      document.removeEventListener('pointerdown', doe, true);
      var off = s.start ? Math.max(0, (Date.now() - s.start) / 1000) : 0;
      speel(s.stationId, s.seed, off);
    };
    document.addEventListener('pointerdown', doe, true);
  }

  window.RTGGeluid = {
    stations: function () { return STATIONS; }, trackNaam: trackNaam,
    speel: speel, volgende: volgende, opnieuw: opnieuw, pauze: pauze, hervat: hervat, toggle: toggle,
    focus: focus, losFocus: losFocus, stand: stand, positie: positie, opStand: opStand,
    analyser: function () { return analyser; }, hervatBijGebaar: hervatBijGebaar
  };
})();
