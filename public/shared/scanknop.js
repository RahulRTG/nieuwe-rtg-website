/* RTG scan-overlay: een herbruikbaar volscherm-camerablad dat een QR of
   streepjescode leest en de tekst teruggeeft. Gebruikt onze eigen RTGScanner
   (camera + BarcodeDetector met eigen-QR-terugval). Werkt in elke app: leden,
   leverancier, PDA. Zonder camera valt hij terug op met de hand typen/plakken,
   zodat een scan nooit een doodlopende weg is. Geen extern pakket, geen DOM-
   framework: puur eigen code in de huisstijl (zwart met bordeaux accent). */
(function (root) {
  'use strict';
  var doc = root.document;
  function stijlEenmalig() {
    if (!doc || doc.getElementById('rtg-scanknop-stijl')) return;
    var st = doc.createElement('style'); st.id = 'rtg-scanknop-stijl';
    st.textContent = [
      '.rtg-scan-ov{position:fixed;inset:0;z-index:99999;background:#0C0C0B;display:flex;flex-direction:column;color:#fff;font-family:Inter,system-ui,sans-serif;}',
      '.rtg-scan-top{display:flex;align-items:center;gap:.6rem;padding:1rem 1.1rem;padding-top:calc(1rem + env(safe-area-inset-top,0));}',
      '.rtg-scan-top h3{font-size:1rem;margin:0;font-weight:600;flex:1;}',
      '.rtg-scan-x{background:rgba(255,255,255,.12);border:none;color:#fff;width:38px;height:38px;border-radius:999px;font-size:1.2rem;cursor:pointer;line-height:1;}',
      '.rtg-scan-stage{position:relative;flex:1;overflow:hidden;background:#000;}',
      '.rtg-scan-stage video{width:100%;height:100%;object-fit:cover;}',
      '.rtg-scan-frame{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;}',
      '.rtg-scan-frame div{width:min(66vw,320px);aspect-ratio:1;border:2px solid rgba(255,255,255,.85);border-radius:22px;box-shadow:0 0 0 100vmax rgba(0,0,0,.45);}',
      '.rtg-scan-hint{padding:.9rem 1.2rem .3rem;text-align:center;font-size:.86rem;color:#DEDBD5;}',
      '.rtg-scan-hint a{color:#C23A5E;cursor:pointer;text-decoration:underline;}',
      '.rtg-scan-status{padding:0 1.2rem;text-align:center;font-size:.78rem;color:#C23A5E;min-height:1em;}',
      '.rtg-scan-hand{padding:.7rem 1.1rem 1.4rem;padding-bottom:calc(1.4rem + env(safe-area-inset-bottom,0));display:none;gap:.5rem;}',
      '.rtg-scan-hand.aan{display:flex;}',
      '.rtg-scan-hand input{flex:1;background:#161615;border:1px solid #3a3a38;border-radius:12px;padding:.7rem .8rem;color:#fff;font-size:.9rem;font-family:inherit;}',
      '.rtg-scan-hand button{background:#7F1634;border:none;color:#fff;border-radius:12px;padding:.7rem 1.1rem;font-weight:600;font-family:inherit;cursor:pointer;}'
    ].join('');
    doc.head.appendChild(st);
  }

  function open(opties) {
    opties = opties || {};
    stijlEenmalig();
    var scanner = null, dicht = false;
    var ov = doc.createElement('div'); ov.className = 'rtg-scan-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', opties.titel || 'Scannen');
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
    if (!Scanner || !root.navigator || !root.navigator.mediaDevices) {
      toonHand(opties.geenCamera || 'Camera niet beschikbaar op dit toestel; typ de code hieronder.'); return { sluit: sluit };
    }
    scanner = new Scanner.Scanner({ video: video, onCode: function (c) { treffer(c.tekst, c.formaat); }, onFout: function () {} });
    scanner.start().catch(function () { toonHand(opties.geenToegang || 'De camera kon niet starten. Typ de code hieronder.'); });
    return { sluit: sluit };
  }

  var api = { open: open };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RTGScanknop = api;
})(typeof self !== 'undefined' ? self : this);
