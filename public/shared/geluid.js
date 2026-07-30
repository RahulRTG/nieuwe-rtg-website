/* RTG Geluid: de altijd-aanwezige geluidsmotor van het huis.

   RTG Sound mag altijd spelen: dit is de gedeelde generatieve motor (dezelfde
   studio's als RTG Sound, live op WebAudio). Elk scherm kan hem aansturen, en
   omdat de tracks uit een seed komen speelt hij op elk scherm exact hetzelfde,
   in de maat mee. Zo loopt de muziek met je mee door de ROS.

   Audio-focus: komt er een ander geluid (een gesprek, een video, Rahul die
   praat), dan duikt de muziek weg (zachter) of pauzeert ze even; zodra dat
   geluid weg is, pakt ze vanzelf weer op. Vraag focus met RTGGeluid.focus(bron)
   en geef hem terug met RTGGeluid.losFocus(bron). Zo is Sound altijd de bodem
   die wijkt voor wat er even belangrijker is, en daarna weer verder gaat.

   Publiceert zijn stand via de gedeelde speler-laag (shared/speler.js) en
   luistert daar ook naar bediening en focus. Geen audio buiten deze motor. */
(function () {
  if (window.RTGGeluid) return;

  var STATIONS = [
    { id: 'sunset', naam: 'Sunset Lounge', sub: 'chill · 84 bpm', icoon: '', hoes: 'h-sunset',
      bpm: 84, toon: 57, akkoorden: [[0,3,7,10],[5,8,12,15],[3,7,10,14],[10,14,17,21]], perc: 'zacht', arp: true },
    { id: 'beach', naam: 'Beach Club', sub: 'house · 118 bpm', icoon: '', hoes: 'h-beach',
      bpm: 118, toon: 55, akkoorden: [[0,3,7,10],[8,12,15,19],[5,8,12,15],[7,10,14,17]], perc: 'club', arp: true },
    { id: 'jazz', naam: 'Salon Jazz', sub: 'diner · 72 bpm', icoon: '', hoes: 'h-jazz',
      bpm: 72, toon: 58, akkoorden: [[0,4,7,11],[5,9,12,16],[7,11,14,17],[2,5,9,12]], perc: 'brush', arp: false },
    { id: 'golden', naam: 'Golden Hour', sub: 'warm · 64 bpm', icoon: '', hoes: 'h-golden',
      bpm: 64, toon: 53, akkoorden: [[0,4,7,11],[9,12,16,19],[5,9,12,16],[7,10,14,19]], perc: 'geen', arp: false },
    { id: 'focus', naam: 'Focus', sub: 'ambient · 60 bpm', icoon: '', hoes: 'h-focus',
      bpm: 60, toon: 50, akkoorden: [[0,7,12,16],[5,12,17,21],[3,10,15,19],[0,7,12,16]], perc: 'geen', arp: true },
    { id: 'nacht', naam: 'Club Nacht', sub: 'deep · 122 bpm', icoon: '', hoes: 'h-nacht',
      bpm: 122, toon: 52, akkoorden: [[0,3,7,12],[10,14,17,22],[8,12,15,20],[5,8,12,17]], perc: 'club', arp: true }
  ];
  var W1 = ['Cala', 'Vora', 'Luna', 'Brisa', 'Sal', 'Isla', 'Alba', 'Mar', 'Ola', 'Sombra'];
  var W2 = ['Dorada', 'Blanca', 'del Sur', 'de Medianoche', 'Serena', 'Secreta', 'Eterna', 'de Oro', 'Suave', 'Azul'];
  function rngVan(seed) { var t = seed >>> 0; return function () { t += 0x6D2B79F5; var r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }
  function trackNaam(seed) { var r = rngVan(seed); return W1[Math.floor(r() * W1.length)] + ' ' + W2[Math.floor(r() * W2.length)]; }
  function vindStation(id) { for (var i = 0; i < STATIONS.length; i++) if (STATIONS[i].id === id) return STATIONS[i]; return null; }

  var ctx = null, master = null, duck = null, analyser = null;
  var station = null, seed = 0, rng = null, speelt = false;
  var startTijd = 0, duur = 180, tel = 0, klok = null, stemmen = [];
  var focusStack = [], luisteraars = [];

  function zorgCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.7;
    duck = ctx.createGain(); duck.gain.value = 1;               // audio-focus: hiermee duiken we weg
    analyser = ctx.createAnalyser(); analyser.fftSize = 256;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    var galm = ctx.createConvolver();
    var ir = ctx.createBuffer(2, ctx.sampleRate * 2, ctx.sampleRate);
    for (var k = 0; k < 2; k++) { var d = ir.getChannelData(k); for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6); }
    galm.buffer = ir;
    var galmMix = ctx.createGain(); galmMix.gain.value = 0.22;
    master.connect(duck); duck.connect(analyser); analyser.connect(comp); comp.connect(ctx.destination);
    master.connect(galm); galm.connect(galmMix); galmMix.connect(duck);
  }
  function nootHz(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function stapDuur() { return 60 / station.bpm / 4; }
  function toonNoot(freq, t0, len, soort, vol, laag) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = soort; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.04, len / 4));
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + len);
    var uit = g;
    if (laag) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = laag; g.connect(f); uit = f; }
    o.connect(g); uit.connect(master);
    o.start(t0); o.stop(t0 + len + 0.05);
    stemmen.push(o);
  }
  function ruis(t0, len, hz, vol, type) {
    var b = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    var s = ctx.createBufferSource(); s.buffer = b;
    var f = ctx.createBiquadFilter(); f.type = type || 'highpass'; f.frequency.value = hz;
    var g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0); stemmen.push(s);
  }
  function kick(t0) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(44, t0 + 0.12);
    g.gain.setValueAtTime(0.85, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.25);
    stemmen.push(o);
  }
  function plan(stap, t0) {
    var s = station, tel16 = stap % 16, maat = Math.floor(stap / 16);
    var akk = s.akkoorden[Math.floor(maat / 2) % s.akkoorden.length];
    var beat = tel16 % 4 === 0;
    if (tel16 === 0 && maat % 2 === 0) for (var q = 0; q < akk.length; q++) toonNoot(nootHz(s.toon + akk[q]), t0, (16 * 2) * stapDuur() * 0.98, 'sawtooth', 0.05, 900);
    if (beat) toonNoot(nootHz(s.toon - 24 + akk[0]), t0, stapDuur() * (s.perc === 'club' ? 0.7 : 1.8), s.perc === 'club' ? 'triangle' : 'sine', 0.16, 500);
    if (s.arp && tel16 % 2 === 1 && rng() < 0.75) toonNoot(nootHz(s.toon + 12 + akk[Math.floor(rng() * akk.length)]), t0, stapDuur() * 1.1, 'triangle', 0.06, 2400);
    if (s.perc === 'club') { if (tel16 % 4 === 0) kick(t0); if (tel16 % 4 === 2) ruis(t0, 0.05, 7000, 0.12); if (rng() < 0.12) ruis(t0, 0.03, 9000, 0.06); }
    if (s.perc === 'zacht' && tel16 % 8 === 4) ruis(t0, 0.09, 5000, 0.07);
    if (s.perc === 'brush' && tel16 % 4 === 2) ruis(t0, 0.16, 2400, 0.05, 'bandpass');
  }
  function tik() {
    while (speelt && ctx.state === 'running' && startTijd + tel * stapDuur() < ctx.currentTime + 0.15) {
      plan(tel, startTijd + tel * stapDuur()); tel++;
      if ((tel * stapDuur()) > duur) { volgende(); return; }
    }
  }
  function stopStemmen() { for (var i = 0; i < stemmen.length; i++) { try { stemmen[i].stop(); } catch (e) {} } stemmen = []; }

  function metaZet() {
    if (!('mediaSession' in navigator) || !station) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: trackNaam(seed), artist: 'RTG Sound', album: station.naam });
      navigator.mediaSession.setActionHandler('play', hervat);
      navigator.mediaSession.setActionHandler('pause', pauze);
      navigator.mediaSession.setActionHandler('nexttrack', volgende);
      navigator.mediaSession.setActionHandler('previoustrack', opnieuw);
    } catch (e) {}
  }

  function speel(id, zaad, offsetSec) {
    var st = typeof id === 'object' ? id : vindStation(id);
    if (!st) return;
    zorgCtx();
    station = st; seed = (zaad == null) ? ((Date.now() / 60000 | 0) * 7 + STATIONS.indexOf(st)) : (zaad | 0);
    rng = rngVan(seed);
    duur = 150 + Math.floor(rngVan(seed + 1)() * 60);
    offsetSec = Math.max(0, Math.min(Number(offsetSec) || 0, duur - 1));
    stopStemmen(); if (klok) clearInterval(klok);
    startTijd = ctx.currentTime + 0.08 - offsetSec; speelt = true;
    tel = offsetSec > 0 ? Math.ceil(offsetSec / stapDuur()) : 0;
    pasFocusToe();                       // eventuele duik/pauze meteen toepassen
    if (ctx.state === 'suspended' && !exclusiefActief()) ctx.resume();
    klok = setInterval(tik, 40); tik();
    metaZet(); meld();
  }
  function volgende() { if (station) speel(station, seed + 1); }
  function opnieuw() { if (station) speel(station, seed); }
  function pauze() { speelt = false; if (ctx) ctx.suspend(); meld(); }
  function hervat() { if (!station) return; speelt = true; pasFocusToe(); meld(); }
  function toggle() { (speelt && ctx && ctx.state === 'running') ? pauze() : hervat(); }

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
