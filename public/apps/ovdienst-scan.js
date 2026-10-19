/* Het scanblad van de OV-dienst op het RTG Design System: een dialoog met
   het camerabeeld en altijd een veld om de code met de hand in te tikken.
   Het lezen zelf doet de gedeelde scanner (shared/scanner.js met
   shared/qrscan.js als terugval), de camera gaat open via de mediapoort
   (shared/media.js). Zonder camera of zonder scanner is typen de weg, met
   de reden erbij: een scan is nooit een doodlopende weg. Hier stond
   shared/scanknop.js; dat zet een eigen <style> neer en hoort dus niet op
   een ds-scherm (ONTWERPSYSTEEM.md par. 3). */
(function (w, d) {
  'use strict';
  function open(o) {
    var R = w.RTGWerk, maak = R.maak;
    var dlg = maak('dialog', 'ds-dialoog');
    dlg.setAttribute('aria-label', o.titel);
    var kop = maak('h2', 'ds-kaart__titel', o.titel);
    var video = maak('video', 'ds-detail__beeld');
    video.setAttribute('playsinline', ''); video.muted = true; video.hidden = true;
    var hint = maak('p', 'ds-meta', o.hint);
    var status = maak('p', 'ds-meta'); status.setAttribute('aria-live', 'polite');
    var form = maak('form', 'ds-vraagrij');
    var inp = maak('input', 'ds-invoer');
    inp.setAttribute('aria-label', 'Code met de hand invoeren'); inp.placeholder = 'Of typ/plak de code'; inp.autocomplete = 'off';
    var ok = maak('button', 'ds-knop ds-knop--primair ds-knop--klein', 'Ok'); ok.type = 'submit';
    form.append(inp, ok);
    var acties = maak('div', 'ds-dialoog__acties');
    var sluitK = maak('button', 'ds-knop ds-knop--stil ds-knop--klein', 'Sluiten'); sluitK.type = 'button';
    acties.appendChild(sluitK);
    dlg.append(kop, video, hint, status, form, acties);
    d.body.appendChild(dlg);

    var scanner = null, dicht = false;
    function sluit() {
      if (dicht) return; dicht = true;
      try { if (scanner) scanner.stop(); } catch (e) {}
      if (dlg.open) dlg.close();
      dlg.remove();
    }
    function treffer(tekst) { sluit(); o.onCode(String(tekst || '').trim()); }
    sluitK.addEventListener('click', sluit);
    dlg.addEventListener('close', sluit);
    form.addEventListener('submit', function (e) { e.preventDefault(); var v = inp.value.trim(); if (v) treffer(v); });
    dlg.showModal();

    var Scanner = w.RTGScanner;
    if (!Scanner) { status.textContent = 'De scanner-module is niet geladen; typ de code hieronder.'; inp.focus(); return; }
    /* Wat de mediapoort zonder te vragen al weet, zeggen we voordat er een
       camerabeeld staat te wachten op iets dat nooit komt. */
    var vooraf = w.RTGMedia && w.RTGMedia.reden('camera');
    if (vooraf) { var t = w.RTGMedia.teksten[vooraf]; status.textContent = t.kort + '. ' + t.uitleg; inp.focus(); return; }
    video.hidden = false;
    scanner = new Scanner.Scanner({ video: video, onCode: function (c) { treffer(c.tekst); }, onFout: function () {} });
    scanner.start().catch(function (e) {
      var r = e && e.rtg;
      video.hidden = true;
      status.textContent = r ? r.kort + '. ' + r.uitleg : 'De camera kon niet starten. Typ de code hieronder.';
      inp.focus();
    });
  }
  w.RTGOvScan = { open: open };
}(window, document));
