/* RTG Studio: de klankmotor.

   Elke klank wordt hier opgewekt uit oscillatoren en ruis -- er wordt niets
   ingeladen, want er is niets om in te laden (zie server/kern/muziek-
   instrumenten.js). Dezelfde klanktaal als RTG Sound (shared/geluid.js), maar
   dan bespeelbaar in plaats van generatief.

   EEN PLANNER, TWEE GEBRUIKEN. `plan()` schrijft een heel stuk in een
   AudioContext; die context is live (je hoort het) of offline (je exporteert
   het). Daardoor KAN de export niet anders klinken dan wat je hoorde -- er is
   maar één plek waar staat wat er gebeurt. Twee aparte paden zouden vroeg of
   laat uit elkaar lopen, en dan levert de knop "opnemen" iets anders op dan de
   knop "afspelen". */
(function () {
  'use strict';
  if (window.RTGStudioMotor) return;

  var K = window.RTGStudioKlanken || {};
  var SLAG = K.SLAG || {}, TOON = K.TOON || {}, STEM = K.STEM || {};
  var toonKlank = K.toonKlank, hz = K.hz;

  /* De uitgang is een echte kanaalstrip: driebands EQ, volume en stereobeeld.
     Alles zijn gewone Web Audio-nodes, dus exact dezelfde strip werkt live en
     in de offline master. */
  function uitgang(ctx, kanaal) {
    var g = ctx.createGain();
    g.gain.value = kanaal.stil ? 0 : (kanaal.volume != null ? kanaal.volume : 0.8);
    var laag = ctx.createBiquadFilter(); laag.type = 'lowshelf'; laag.frequency.value = 180;
    laag.gain.value = Number(kanaal.eqLaag) || 0;
    var midden = ctx.createBiquadFilter(); midden.type = 'peaking'; midden.frequency.value = 1100;
    midden.Q.value = 0.75; midden.gain.value = Number(kanaal.eqMidden) || 0;
    var hoog = ctx.createBiquadFilter(); hoog.type = 'highshelf'; hoog.frequency.value = 5200;
    hoog.gain.value = Number(kanaal.eqHoog) || 0;
    g.connect(laag); laag.connect(midden); midden.connect(hoog);
    var laatste = hoog;
    if (ctx.createStereoPanner) {
      var p = ctx.createStereoPanner(); p.pan.value = Number(kanaal.pan) || 0;
      hoog.connect(p); laatste = p;
    }
    return { in: g, uit: laatste };
  }

  function impuls(ctx, seconden) {
    var lengte = Math.max(1, Math.floor(ctx.sampleRate * seconden));
    var b = ctx.createBuffer(2, lengte, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = b.getChannelData(c);
      for (var i = 0; i < lengte; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / lengte, 2.6);
    }
    return b;
  }

  /* De masterbus bevat de gereedschappen die elders vaak achter een betaalmuur
     staan: toonregeling, parallelle ruimte/delay en een instelbare limiter. */
  function bus(ctx, track) {
    var t = track || {};
    var master = ctx.createGain(); master.gain.value = t.masterGain != null ? t.masterGain : 0.8;
    var laag = ctx.createBiquadFilter(); laag.type = 'lowshelf'; laag.frequency.value = 160;
    laag.gain.value = Number(t.masterLaag) || 0;
    var midden = ctx.createBiquadFilter(); midden.type = 'peaking'; midden.frequency.value = 1250;
    midden.Q.value = 0.7; midden.gain.value = Number(t.masterMidden) || 0;
    var hoog = ctx.createBiquadFilter(); hoog.type = 'highshelf'; hoog.frequency.value = 6500;
    hoog.gain.value = Number(t.masterHoog) || 0;
    var comp = ctx.createDynamicsCompressor();
    var drive = Math.max(0, Math.min(1, Number(t.masterDrive != null ? t.masterDrive : 0.35)));
    comp.threshold.value = -7 - drive * 17; comp.ratio.value = 2 + drive * 6;
    comp.attack.value = 0.004; comp.release.value = 0.18;
    master.connect(laag); laag.connect(midden); midden.connect(hoog); hoog.connect(comp);

    var convolver = ctx.createConvolver(); convolver.buffer = impuls(ctx, 1.8);
    var ruimteUit = ctx.createGain(); ruimteUit.gain.value = 0.34;
    convolver.connect(ruimteUit); ruimteUit.connect(comp);
    var echo = ctx.createDelay(1); echo.delayTime.value = 0.32;
    var terug = ctx.createGain(); terug.gain.value = 0.28;
    var echoUit = ctx.createGain(); echoUit.gain.value = 0.3;
    echo.connect(terug); terug.connect(echo); echo.connect(echoUit); echoUit.connect(comp);
    master.rtgFx = { ruimte: convolver, echo: echo };
    master.rtgOutput = comp;
    comp.connect(ctx.destination);
    return master;
  }

  function tijdVoorStap(stap, sd, swing) {
    var verschuiving = (stap % 2) ? sd * Math.max(0, Math.min(0.75, Number(swing) || 0)) * 0.5 : 0;
    return stap * sd + verschuiving;
  }

  var stapDuur = function (bpm) { return 60 / bpm / 4; };

  /* Een heel stuk in een context schrijven, beginnend op t0. Geeft de duur in
     seconden terug, zodat de aanroeper weet wanneer het klaar is. */
  function plan(ctx, master, track, t0) {
    var sd = stapDuur(track.bpm);
    var stappen = track.stappen || (16 * track.maten);
    var kanalen = track.kanalen || [];
    var heeftSolo = kanalen.some(function (k) { return !!k.solo; });
    for (var i = 0; i < kanalen.length; i++) {
      var k = kanalen[i];
      if (k.stil || (heeftSolo && !k.solo)) continue;
      var u = uitgang(ctx, k); u.uit.connect(master);
      if (master.rtgFx) {
        if (Number(k.reverb) > 0) {
          var rg = ctx.createGain(); rg.gain.value = Math.min(1, Number(k.reverb));
          u.uit.connect(rg); rg.connect(master.rtgFx.ruimte);
        }
        if (Number(k.delay) > 0) {
          var dg = ctx.createGain(); dg.gain.value = Math.min(1, Number(k.delay));
          u.uit.connect(dg); dg.connect(master.rtgFx.echo);
        }
      }
      if (SLAG[k.instrument]) {
        var rij = k.stappen || [];
        for (var j = 0; j < rij.length; j++) {
          if (rij[j] < stappen) SLAG[k.instrument](ctx, u.in,
            t0 + tijdVoorStap(rij[j], sd, track.swing), 1);
        }
      } else if (STEM[k.instrument]) {
        // een stemkanaal: elke noot draagt een lettergreep (apps/klankwerk/zang.js)
        var zn = k.noten || [];
        for (var z = 0; z < zn.length; z++) {
          var zno = zn[z];
          if (zno.stap >= stappen) continue;
          if (window.RTGStudioZang) {
            window.RTGStudioZang.zingNoot(ctx, u.in, t0 + tijdVoorStap(zno.stap, sd, track.swing),
              Math.max(1, zno.lengte || 1) * sd, zno.toon, zno.tekst || '', STEM[k.instrument]);
          }
        }
      } else {
        var noten = k.noten || [];
        for (var n = 0; n < noten.length; n++) {
          var no = noten[n];
          if (no.stap >= stappen) continue;
          toonKlank(ctx, u.in, k.instrument, t0 + tijdVoorStap(no.stap, sd, track.swing),
            Math.max(1, no.lengte || 1) * sd, no.toon, 1);
        }
      }
    }
    return stappen * sd;
  }

  // ---- live afspelen: lus met een vooruitblik, zoals de huismotor ----
  var ctx = null, master = null, klok = null, bezig = false, luister = null;
  function zorgCtx() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function speel(track, opties) {
    stop();
    zorgCtx();
    if (ctx.state === 'suspended') ctx.resume();
    master = bus(ctx, track);
    var o = opties || {};
    luister = o.opStap || null;
    var sd = stapDuur(track.bpm);
    var stappen = track.stappen || (16 * track.maten);
    var duur = stappen * sd;
    var start = ctx.currentTime + 0.08;
    var ronde = 0;
    bezig = true;
    plan(ctx, master, track, start);
    klok = setInterval(function () {
      if (!bezig) return;
      var verstreken = ctx.currentTime - start;
      // de volgende ronde tijdig inplannen, zodat de lus niet hapert
      if (o.lus && verstreken > (ronde + 1) * duur - 0.25) {
        ronde++;
        plan(ctx, master, track, start + ronde * duur);
      }
      if (!o.lus && verstreken >= duur) { stop(); return; }
      if (luister) {
        var stap = Math.floor((verstreken / sd)) % stappen;
        if (stap >= 0) luister(stap);
      }
    }, 25);
    return duur;
  }
  function stop() {
    bezig = false;
    if (klok) { clearInterval(klok); klok = null; }
    if (ctx) {
      // een korte demping in plaats van een harde knip: anders klikt het
      try {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
        var oud = master;
        setTimeout(function () {
          try { oud.disconnect(); } catch (e) {}
          try { if (oud.rtgOutput) oud.rtgOutput.disconnect(); } catch (e2) {}
        }, 120);
        master = null;
      } catch (e) { /* context al weg */ }
    }
    if (luister) luister(-1);
  }

  window.RTGStudioMotor = { plan, bus, speel, stop, stapDuur, hz,
    speelt: function () { return bezig; },
    context: function () { return ctx; } };
})();
