/* Eén bediening voor live stations en geüploade muziek. De capture-luisteraars
   grijpen alleen in als Mijn muziek actief is; anders blijft RTGGeluid eigenaar. */
(function () {
  'use strict';
  var B = window.RTGEigenMuziek, G = window.RTGGeluid;
  if (!B) return;
  var focusSpeelde = false;
  function vang(id, fn) {
    var el = document.querySelector(id); if (!el) return;
    el.addEventListener('click', function (ev) {
      if (!B.actief()) return;
      ev.preventDefault(); ev.stopImmediatePropagation(); fn();
    }, true);
  }
  vang('#knopSpeel', B.toggle);
  vang('#heroSpeel', B.speel);
  vang('#knopVolgende', B.volgende);
  vang('#knopVorige', B.vorige);
  document.querySelector('#stations').addEventListener('click', function (ev) {
    if (B.actief() && ev.target.closest('.station')) B.stop();
  }, true);
  document.querySelector('#zoek').addEventListener('input', function (ev) {
    B.filter(ev.target.value.toLowerCase());
  });

  if (window.RTGSpeler) RTGSpeler.opCommando(function (cmd) {
    if (B.actief()) {
      if (cmd === 'next') B.volgende(); else if (cmd === 'prev') B.vorige();
      else if (cmd === 'pause') B.pauze(); else if (cmd === 'play') B.speel(); else if (cmd === 'toggle') B.toggle();
      else if (cmd === 'focus') { focusSpeelde = true; B.pauze(); }
      else if (cmd === 'losfocus' && focusSpeelde) { focusSpeelde = false; B.speel(); }
      return;
    }
    if (!G) return;
    if (cmd === 'next') G.volgende(); else if (cmd === 'prev') G.opnieuw();
    else if (cmd === 'pause') G.pauze(); else if (cmd === 'play') G.hervat(); else if (cmd === 'toggle') G.toggle();
    else if (cmd === 'focus') G.focus('extern'); else if (cmd === 'losfocus') G.losFocus('extern');
  });
})();
