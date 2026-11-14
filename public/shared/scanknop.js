/* RTG scan-overlay: een herbruikbaar volscherm-camerablad dat een QR of
   streepjescode leest en de tekst teruggeeft. Gebruikt onze eigen RTGScanner
   (camera + BarcodeDetector met eigen-QR-terugval). Werkt in elke app: leden,
   leverancier, PDA. Zonder camera valt hij terug op met de hand typen/plakken,
   zodat een scan nooit een doodlopende weg is. Geen extern pakket, geen DOM-
   framework: puur eigen code in de huisstijl (zwart met bordeaux accent). */
(function (root) {
  'use strict';
  if (typeof document !== 'undefined' && !document.documentElement.hasAttribute('data-ds') && !document.getElementById('rtgDsRuntimeCss')) {
    var scanknopStijlLink = document.createElement('link');
    scanknopStijlLink.id = 'rtgDsRuntimeCss';
    scanknopStijlLink.rel = 'stylesheet';
    scanknopStijlLink.href = '/ds/rtg-ds.css';
    document.head.appendChild(scanknopStijlLink);
  }
  var doc = root.document;
  function open(opties) {
    opties = opties || {};
    var scanner = null, dicht = false;
    var ov = doc.createElement('div'); ov.className = 'rtg-scan-ov ds-scanknop'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', opties.titel || 'Scannen');
    var video = doc.createElement('video'); video.setAttribute('playsinline', ''); video.muted = true;
    ov.innerHTML =
      '<div class="rtg-scan-top"><h3></h3><button class="rtg-scan-x" aria-label="Sluiten">✕</button></div>' +
      '<div class="rtg-scan-stage"><div class="rtg-scan-frame"><div></div></div></div>' +
      '<div class="rtg-scan-hint"></div>' +
      '<div class="rtg-scan-status"></div>' +
      '<form class="rtg-scan-hand"><input type="text" aria-label="Code met de hand invoeren" placeholder="Of typ/plak de code"><button type="submit">Ok</button></form>';
    ov.querySelector('h3').textContent = opties.titel || 'Scannen';
    ov.querySelector('.rtg-scan-stage').insertBefore(video, ov.querySelector('.rtg-scan-frame'));
    var hint = ov.querySelector('.rtg-scan-hint');
    // altijd een uitweg om met de hand in te voeren (geen camera, of code niet leesbaar)
    hint.appendChild(doc.createTextNode((opties.hint || 'Richt de camera op de code.') + ' '));
    var handLink = doc.createElement('a'); handLink.setAttribute('data-hand', ''); handLink.textContent = opties.handTekst || 'Of typ de code';
    hint.appendChild(handLink);
    var hand = ov.querySelector('.rtg-scan-hand');
    var status = ov.querySelector('.rtg-scan-status');
    doc.body.appendChild(ov);

    function sluit() {
      if (dicht) return; dicht = true;
      try { if (scanner) scanner.stop(); } catch (e) {}
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      if (opties.onSluit) try { opties.onSluit(); } catch (e) {}
    }
    function treffer(tekst, formaat) {
      var houd = false;
      try { houd = opties.onCode && opties.onCode({ tekst: tekst, formaat: formaat }) === false; } catch (e) {}
      if (!houd && opties.sluitNaTreffer !== false) sluit();
    }
    // toon het handmatige invoerveld; de status-regel (los van de hint met de
    // permanente "of typ de code"-link) meldt een eventuele reden
    function toonHand(reden) {
      hand.classList.add('aan');
      if (reden) status.textContent = reden;
      var inp = hand.querySelector('input'); setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
    }
    ov.querySelector('.rtg-scan-x').addEventListener('click', sluit);
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') sluit(); });
    hand.addEventListener('submit', function (e) { e.preventDefault(); var v = hand.querySelector('input').value.trim(); if (v) treffer(v, 'handmatig'); });
    hint.addEventListener('click', function (e) { if (e.target.tagName === 'A') toonHand(); });

    var Scanner = root.RTGScanner;
    if (!Scanner) {
      toonHand('De scanner-module is niet geladen; typ de code hieronder.'); return { sluit: sluit };
    }
    /* Wat de mediapoort zonder te vragen al weet, zeggen we voordat we de knop
       aanbieden. Anders staat er een camerabeeld-podium te wachten op iets dat
       nooit komt. */
    var vooraf = root.RTGMedia && root.RTGMedia.reden('camera');
    if (vooraf) {
      var t = root.RTGMedia.teksten[vooraf];
      toonHand(t.kort + '. ' + t.uitleg); return { sluit: sluit };
    }
    scanner = new Scanner.Scanner({ video: video, onCode: function (c) { treffer(c.tekst, c.formaat); }, onFout: function () {} });
    // de reden uit de mediapoort erbij: "kon niet starten" laat de gebruiker
    // zoeken, "dit adres is http" vertelt hem wat hij moet doen
    scanner.start().catch(function (e) {
      var r = e && e.rtg;
      toonHand(r ? r.kort + '. ' + r.uitleg : (opties.geenToegang || 'De camera kon niet starten. Typ de code hieronder.'));
    });
    return { sluit: sluit };
  }

  var api = { open: open };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RTGScanknop = api;
})(typeof self !== 'undefined' ? self : this);
