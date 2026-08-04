/* RTG Werk OS (scherm): de bedrading van de pagina -- inloggen, de twee
   weergaven en het verversen.

   De inlogkaart staat OP de pagina en niet achter een omleiding: wie zijn
   sleutel kwijt is, hoort te zien waar hij is en wat hij nodig heeft. */
(function () {
  'use strict';
  var K = window.RTGWerk;
  function $(id) { return document.getElementById(id); }

  function toon(welke) {
    var start = welke === 'start';
    $('vStart').hidden = !start;
    $('vModules').hidden = start;
    $('tabStart').setAttribute('aria-selected', start ? 'true' : 'false');
    $('tabModules').setAttribute('aria-selected', start ? 'false' : 'true');
    if (!K.poort()) return;
    if (start) window.RTGWerkStart.laad(); else window.RTGWerkModules.laad();
  }

  $('inlogGa').addEventListener('click', function () {
    var w = $('iWerkruimte').value.trim().toUpperCase();
    var t = $('iToken').value.trim();
    if (!w || !t) return K.meld('Vul de werkruimtecode en uw lid-token in.');
    K.bewaar({ werkruimte: w, lidToken: t });
    K.api('/mijn-rechten', {}).then(function (r) {
      if (r.body.error) { K.wis(); K.poort(); return K.meld(r.body.error); }
      $('iToken').value = '';
      K.poort();
      toon('start');
    });
  });
  $('inlogUit').addEventListener('click', function () {
    K.wis(); K.poort();
    K.meld('U bent uitgelogd uit deze werkruimte.');
  });
  $('tabStart').addEventListener('click', function () { toon('start'); });
  $('tabModules').addEventListener('click', function () { toon('modules'); });
  $('mKeuze').addEventListener('change', function () { window.RTGWerkModules.laad(); });
  $('mZoekGa').addEventListener('click', function () { window.RTGWerkModules.laad(); });
  $('ververs').addEventListener('click', function () { toon($('vStart').hidden ? 'modules' : 'start'); });

  /* Eerst kijken of er al een weg naar binnen is via het ledenaccount; pas
     als die er niet is, komt de inlogkaart in beeld. */
  K.poort();
  if (K.sessie()) { toon('start'); } else {
    K.viaLid().then(function (gelukt) {
      K.poort();
      if (!gelukt) return;
      var w = K._welkom;
      if (w) K.meld('Welkom in ' + w.naam + (w.eigenaarsRuimte ? ' (uw eigen werkruimte)' : '') + '.');
      toon('start');
    });
  }
})();
