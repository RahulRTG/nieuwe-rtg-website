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

  /* De uitgang: per kanaal een volume en een plek in het stereobeeld, dan alles
     samen door een compressor. Zonder die compressor tikt een vol raster tegen
     het plafond en klinkt het goedkoop. */
  function uitgang(ctx, kanaal) {
    var g = ctx.createGain();
    g.gain.value = kanaal.stil ? 0 : (kanaal.volume != null ? kanaal.volume : 0.8);
    var laatste = g;
    if (ctx.createStereoPanner && kanaal.pan) {
      var p = ctx.createStereoPanner(); p.pan.value = kanaal.pan;
      g.connect(p); laatste = p;
    }
    return { in: g, uit: laatste };
  }
  function bus(ctx) {
    var master = ctx.createGain(); master.gain.value = 0.8;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.004;
    master.connect(comp); comp.connect(ctx.destination);
    return master;
  }

  var stapDuur = function (bpm) { return 60 / bpm / 4; };

  /* Een heel stuk in een context schrijven, beginnend op t0. Geeft de duur in
     seconden terug, zodat de aanroeper weet wanneer het klaar is. */
  function plan(ctx, master, track, t0) {
    var sd = stapDuur(track.bpm);
    var stappen = track.stappen || (16 * track.maten);
    var kanalen = track.kanalen || [];
    for (var i = 0; i < kanalen.length; i++) {
      var k = kanalen[i];
      if (k.stil) continue;
      var u = uitgang(ctx, k); u.uit.connect(master);
      if (SLAG[k.instrument]) {
        var rij = k.stappen || [];
        for (var j = 0; j < rij.length; j++) {
          if (rij[j] < stappen) SLAG[k.instrument](ctx, u.in, t0 + rij[j] * sd, 1);
        }
      } else if (STEM[k.instrument]) {
        // een stemkanaal: elke noot draagt een lettergreep (apps/klankwerk/zang.js)
        var zn = k.noten || [];
        for (var z = 0; z < zn.length; z++) {
          var zno = zn[z];
          if (zno.stap >= stappen) continue;
          if (window.RTGStudioZang) {
            window.RTGStudioZang.zingNoot(ctx, u.in, t0 + zno.stap * sd,
              Math.max(1, zno.lengte || 1) * sd, zno.toon, zno.tekst || '', STEM[k.instrument]);
          }
        }
      } else {
        var noten = k.noten || [];
        for (var n = 0; n < noten.length; n++) {
          var no = noten[n];
          if (no.stap >= stappen) continue;
          toonKlank(ctx, u.in, k.instrument, t0 + no.stap * sd,
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
    master = bus(ctx);
    return ctx;
  }
  function speel(track, opties) {
    stop();
    zorgCtx();
    if (ctx.state === 'suspended') ctx.resume();
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
        setTimeout(function () { try { oud.disconnect(); } catch (e) {} }, 120);
        master = bus(ctx);
      } catch (e) { /* context al weg */ }
    }
    if (luister) luister(-1);
  }

  window.RTGStudioMotor = { plan, bus, speel, stop, stapDuur, hz,
    speelt: function () { return bezig; },
    context: function () { return ctx; } };
})();
