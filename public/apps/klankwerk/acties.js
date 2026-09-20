/* RTG Klankwerk: de acties op een geopend stuk -- Rahul, en meenemen.

   Staat los van apps/klankwerk/scherm.js omdat het een ander soort werk is:
   daar wordt een stuk geopend en bewaard, hier gebeurt er iets MEE. De brug
   ertussen (window.RTGKlankwerk) is met opzet smal: dit bestand mag lezen wat
   er open staat en melden dat er iets veranderde, en verder niets. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var B = window.RTGKlankwerk;
  if (!B) return;
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var voorstel = null;

  /* ---- kanalen erbij en eruit ---- */
  $('#kanaalBij').addEventListener('click', function () {
    var track = B.track(), instrumenten = B.instrumenten();
    if (!track) return;
    var inst = $('#nieuwInstrument').value;
    if (!inst) return;
    track.kanalen = track.kanalen || [];
    if (track.kanalen.length >= 16) return B.zeg('Zestien kanalen is het maximum.');
    var k = { instrument: inst, naam: (instrumenten[inst] || {}).naam, volume: 0.8, pan: 0, stil: false };
    if ((instrumenten[inst] || {}).soort === 'slag') k.stappen = []; else k.noten = [];
    track.kanalen.push(k);
    B.gewijzigd();
    B.raster().zet(track, instrumenten);
    B.raster().kies(track.kanalen.length - 1);
  });
  $('#kanaalWeg').addEventListener('click', function () {
    var track = B.track();
    if (!track) return;
    var i = B.raster().gekozen();
    if (i == null || i < 0) return B.zeg('Kies eerst een kanaal.');
    track.kanalen.splice(i, 1);
    B.gewijzigd();
    B.raster().zet(track, B.instrumenten());
  });

  /* ---- Rahul: een voorstel dat u zelf plaatst ----

     Twee knoppen, want het zijn twee verschillende dingen. Een FIGUUR is een
     lus om mee te beginnen en laat uw eigen maten staan. Een LIED brengt zijn
     eigen lengte en vorm mee -- die kan het huidige stuk dus overnemen, en dat
     hoort de maker te zien voordat hij op "zet het in mijn raster" drukt. */
  $('#rVraagKnop').addEventListener('click', function () { vraagRahul(false); });
  $('#rLiedKnop').addEventListener('click', function () { vraagRahul(true); });

  function vraagRahul(lied) {
    var track = B.track();
    if (!track) return;
    var k = lied ? $('#rLiedKnop') : $('#rVraagKnop');
    var woord = k.textContent;
    k.disabled = true; k.textContent = 'Antwoord wordt voorbereid...';
    B.api('rahul', { vraag: $('#rVraag').value, maten: lied ? undefined : track.maten,
      lied: lied, tekst: lied ? $('#rTekst').value : '', zaad: Date.now() }).then(function (d) {
      k.disabled = false; k.textContent = woord;
      if (d.error) return B.zeg(d.error);
      voorstel = d.voorstel;
      var namen = voorstel.kanalen.map(function (c) {
        return (B.instrumenten()[c.instrument] || {}).naam || c.instrument;
      }).join(', ');
      $('#rUit').innerHTML = '<p class="stil">' + esc(voorstel.uitleg) + '</p>' +
        '<p class="stil h-mt30">Kanalen: ' + esc(namen) + '</p>' +
        '<div class="rij h-mt60">' +
        '<button class="knop" id="rBeluister" type="button">Eerst beluisteren</button>' +
        '<button class="knop vol" id="rZet" type="button">Zet het in mijn raster</button>' +
        '<button class="knop" id="rWeg" type="button">Laat maar</button></div>';
      $('#rBeluister').addEventListener('click', function () {
        window.RTGStudioMotor.speel({ bpm: voorstel.bpm, maten: voorstel.maten,
          stappen: 16 * voorstel.maten, kanalen: voorstel.kanalen }, { lus: false });
      });
      $('#rZet').addEventListener('click', function () {
        B.stop();
        track.bpm = voorstel.bpm; track.maten = voorstel.maten;
        track.stappen = 16 * voorstel.maten;
        track.kanalen = voorstel.kanalen;
        // De vorm hoort bij het voorstel. Hem laten staan zou betekenen dat de
        // delen naar maten wijzen die er niet meer zijn.
        if (voorstel.secties && voorstel.secties.length) track.secties = voorstel.secties;
        B.velden();
        B.gewijzigd();
        B.raster().zet(track, B.instrumenten());
        if (window.RTGKlankwerkVorm) window.RTGKlankwerkVorm.teken();
        $('#rUit').innerHTML = '<p class="stil">Het staat in uw raster. Haal eruit wat u niet wilt; ' +
          'het is nu gewoon uw werk.</p>';
      });
      $('#rWeg').addEventListener('click', function () { voorstel = null; $('#rUit').textContent = ''; });
    }).catch(function () {
      k.disabled = false; k.textContent = woord;
      B.zeg('Rahul is nu niet bereikbaar.');
    });
  }

  /* ---- meenemen ---- */
  $('#exportWav').addEventListener('click', function () {
    var track = B.track();
    if (!track) return;
    B.leesVelden();
    var k = $('#exportWav'); k.disabled = true; k.textContent = 'Master wordt gerenderd...';
    var kwaliteit = ($('#exportKwaliteit') || {}).value || '48000-24';
    var delen = kwaliteit.split('-');
    var rondes = Number(($('#exportRondes') || {}).value) || 2;
    window.RTGStudioWav.render(track, { rondes: rondes, sampleRate: Number(delen[0]), bitDepth: Number(delen[1]) }).then(function (blob) {
      B.download((track.naam || 'stuk').replace(/[^\w -]/g, '') + '.wav', blob);
      k.disabled = false; k.textContent = 'Exporteer WAV-master';
      B.zeg('Master klaar: ' + delen[0] / 1000 + ' kHz / ' + delen[1] + '-bit, zonder watermerk.');
    }).catch(function (e) {
      k.disabled = false; k.textContent = 'Exporteer WAV-master';
      B.fout(e.message || 'Uitrekenen lukte niet.');
    });
  });
  $('#exportJson').addEventListener('click', function () {
    var track = B.track();
    if (!track) return;
    B.leesVelden();
    B.download((track.naam || 'stuk').replace(/[^\w -]/g, '') + '.json',
      new Blob([JSON.stringify({ naam: track.naam, bpm: track.bpm, maten: track.maten,
        swing: track.swing, masterGain: track.masterGain, masterLaag: track.masterLaag,
        masterMidden: track.masterMidden, masterHoog: track.masterHoog,
        masterDrive: track.masterDrive, kanalen: track.kanalen, secties: track.secties || []
      }, null, 2)], { type: 'application/json' }));
  });
  $('#exportStem').addEventListener('click', function () {
    var track = B.track(), gekozen = B.raster().gekozen();
    if (!track || gekozen == null || !track.kanalen[gekozen]) return B.zeg('Kies eerst een kanaal in het raster.');
    B.leesVelden();
    var stem = JSON.parse(JSON.stringify(track));
    stem.kanalen.forEach(function (k, i) { k.stil = i !== gekozen; k.solo = false; });
    var kwaliteit = ($('#exportKwaliteit') || {}).value || '48000-24';
    var delen = kwaliteit.split('-'), k = $('#exportStem');
    k.disabled = true; k.textContent = 'Stem wordt gerenderd...';
    window.RTGStudioWav.render(stem, { rondes: Number(($('#exportRondes') || {}).value) || 2,
      sampleRate: Number(delen[0]), bitDepth: Number(delen[1]) }).then(function (blob) {
      var kanaal = track.kanalen[gekozen];
      B.download((track.naam + ' - ' + (kanaal.naam || kanaal.instrument)).replace(/[^\w -]/g, '') + '.wav', blob);
      k.disabled = false; k.textContent = 'Exporteer gekozen stem'; B.zeg('Losse stem klaar, zonder watermerk.');
    }).catch(function (e) {
      k.disabled = false; k.textContent = 'Exporteer gekozen stem'; B.fout(e.message || 'De stem kon niet worden gerenderd.');
    });
  });
  $('#stukWeg').addEventListener('click', function () {
    var track = B.track();
    if (!track) return;
    if (!confirm('Dit stuk verdwijnt. Doorgaan?')) return;
    B.api('weg', { id: track.id }).then(function (d) {
      if (d.error) return B.zeg(d.error);
      B.naarLijst();
    });
  });
})();
