/* RTG Studio: het stuk als geluidsbestand.

   De studio bewaart een stuk als getallen, niet als audio -- dat is klein en te
   bewerken. Maar soms wil je het gewoon MEENEMEN: naar een clip, naar iemand
   anders, naar een telefoon zonder RTG erop. Dan moet het een bestand worden.

   TWEE KEUZES DIE HIER TOELICHTING VERDIENEN.

   1. WAV, EN GEEN MP3. Een MP3-codeerder zouden we zelf moeten schrijven (er
      komt geen bibliotheek in huis) en dat is veel werk voor een slechter
      resultaat. WAV is onversleuteld, onverpakt en opent overal -- ook over
      tien jaar nog. Groter, ja; maar een stuk van een halve minuut blijft een
      paar megabyte, en het is uw eigen werk in volle kwaliteit.

   2. HET WORDT OFFLINE UITGEREKEND, MET DEZELFDE PLANNER als het afspelen
      (apps/muziek/motor.js). Daardoor KAN het bestand niet anders klinken dan
      wat u hoorde. Een aparte export-route zou vroeg of laat afwijken, en dan
      levert "opnemen" iets anders op dan "afspelen". */
(function () {
  'use strict';
  if (window.RTGStudioWav) return;

  /* De RIFF/WAVE-kop, met de hand geschreven. 44 bytes, en elk veld staat in de
     norm; er valt hier niets te verzinnen. 16-bits PCM, want dat leest alles. */
  function riff(kanalen, aantalFrames, sampleRate) {
    var bytesPerSample = 2;
    var blockAlign = kanalen * bytesPerSample;
    var dataLengte = aantalFrames * blockAlign;
    var buf = new ArrayBuffer(44 + dataLengte);
    var dv = new DataView(buf);
    var p = 0;
    function tekst(s) { for (var i = 0; i < s.length; i++) dv.setUint8(p++, s.charCodeAt(i)); }
    function u32(v) { dv.setUint32(p, v, true); p += 4; }
    function u16(v) { dv.setUint16(p, v, true); p += 2; }
    tekst('RIFF'); u32(36 + dataLengte); tekst('WAVE');
    tekst('fmt '); u32(16); u16(1);            // 1 = PCM, ongecomprimeerd
    u16(kanalen); u32(sampleRate);
    u32(sampleRate * blockAlign); u16(blockAlign); u16(8 * bytesPerSample);
    tekst('data'); u32(dataLengte);
    return { buffer: buf, dv: dv, begin: 44 };
  }

  /* Van een AudioBuffer naar een WAV-blob. De kanalen worden om en om
     weggeschreven (links, rechts, links, ...) en we knippen netjes af op -1..1;
     zonder die begrenzing slaat een luide piek om naar het tegenovergestelde
     teken en hoort u een tik. */
  function naarWav(audio) {
    var kanalen = Math.min(2, audio.numberOfChannels);
    var frames = audio.length;
    var w = riff(kanalen, frames, audio.sampleRate);
    var data = [];
    for (var c = 0; c < kanalen; c++) data.push(audio.getChannelData(c));
    var p = w.begin;
    for (var i = 0; i < frames; i++) {
      for (var k = 0; k < kanalen; k++) {
        var v = Math.max(-1, Math.min(1, data[k][i]));
        w.dv.setInt16(p, v < 0 ? v * 0x8000 : v * 0x7FFF, true);
        p += 2;
      }
    }
    return new Blob([w.buffer], { type: 'audio/wav' });
  }

  /* Het stuk uitrekenen zonder het af te spelen. Er komt een staart van twee
     seconden achteraan, anders wordt de laatste noot midden in zijn uitklinken
     afgekapt -- dat hoort u meteen, en het klinkt goedkoop. */
  function render(track, opties) {
    var o = opties || {};
    var M = window.RTGStudioMotor;
    if (!M) return Promise.reject(new Error('De klankmotor is niet geladen.'));
    var Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) return Promise.reject(new Error('Deze browser kan niet uitrekenen naar een bestand.'));
    var sr = o.sampleRate || 44100;
    var stappen = track.stappen || (16 * track.maten);
    var rondes = Math.max(1, Math.min(16, o.rondes || 1));
    var duur = stappen * M.stapDuur(track.bpm) * rondes;
    var staart = 2;
    var ctx = new Offline(2, Math.ceil((duur + staart) * sr), sr);
    var master = M.bus(ctx);
    for (var r = 0; r < rondes; r++) {
      M.plan(ctx, master, track, r * (duur / rondes));
    }
    return ctx.startRendering().then(naarWav);
  }

  window.RTGStudioWav = { render: render, naarWav: naarWav };
})();
