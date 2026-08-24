/* RTG Horeca (scherm): DE MEETLAT VAN EEN DIENST.

   Onderaan HORECA.md staan twaalf meetpunten met een lat en nergens een getal.
   Dit scherm zet er de meting naast -- en, waar die er niet is, met zoveel
   woorden dat hij er niet is en waarom.

   DE HELE KUNST ZIT IN DE DRIE SOORTEN, en ze zien er hier bewust verschillend
   uit:

     GEMETEN      een getal met zijn eenheid, en de rekensom eronder. Wie het
                  getal niet kan narekenen, gelooft het niet.
     CONSTRUCTIE  nul omdat de data het niet anders KAN weergeven. Dat is geen
                  prestatie maar een eigenschap van het ontwerp, en het staat er
                  daarom apart -- wie hier een groen vinkje van maakt, meet zijn
                  eigen model in plaats van zijn dienst.
     NIET-GEMETEN geen getal, wel een reden. Zodat iemand kan besluiten die bron
                  te bouwen in plaats van te vergeten dat hij ontbreekt.

   Er komt hier GEEN samenvattend cijfer bij. "9 van de 12 groen" is precies de
   soort geruststelling die een meetlat waardeloos maakt: hij telt dan drie
   dingen op die niet in dezelfde eenheid staan, en verbergt dat er acht van de
   twaalf helemaal niet gemeten worden. Wat er wel staat is hoeveel er in elke
   soort vallen -- na te tellen op de lijst eronder. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  if (!K.poort()) return;
  var esc = K.esc, api = K.api, meld = K.meld;
  function $(id) { return document.getElementById(id); }
  if (!$('mMeetlat')) return;

  var WOORD = { gemeten: 'gemeten', constructie: 'uit het model', 'niet-gemeten': 'niet gemeten' };

  function regel(m) {
    var waarde = m.soort === 'gemeten'
      ? '<b>' + esc(String(m.waarde)) + (m.eenheid ? ' ' + esc(m.eenheid) : '') + '</b>'
      : (m.soort === 'constructie' ? '<b>0</b>' : '<span class="stil">&mdash;</span>');
    return '<div class="item"><span>' +
      '<b>' + esc(m.naam) + '</b> <span class="stil">· ' + esc(WOORD[m.soort] || m.soort) + '</span>' +
      '<div class="stil">' + esc(m.rekensom) + '</div>' +
      '</span><span>' + waarde + '</span></div>';
  }

  function teken(d) {
    $('mMeetTelling').textContent = d.gemeten + ' gemeten, ' + d.nietGemeten +
      ' niet gemeten, ' + d.constructie + ' uit het model';
    $('mMeetlat').innerHTML = (d.meetpunten || []).map(regel).join('');
    $('mMeetLet').textContent = (d.let || '') + ' Deze dag: ' + d.rekeningen +
      ' rekening(en) met ' + d.regels + ' regel(s).';
  }

  function haal() {
    return api('/dienstmeting', { datum: $('mMeetDatum').value.trim() || undefined })
      .then(function (r) {
        if (r.body.error) return meld(r.body.error);
        teken(r.body);
      });
  }

  $('mMeetToon').addEventListener('click', haal);
  haal();
})();
