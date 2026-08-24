/* RTG Horeca (scherm): de gastreis-toren -- per open tafel waar hij staat en
   wat er nu aandacht vraagt.

   WAT HIER WEG IS, EN WAAROM. De ring toonde een percentage (12 / 30 / 48 / 64 /
   78) dat rechtstreeks uit een toestandslabel kwam en niets mat. Met zes tafels
   in beeld stond er zes keer 30%. Datzelfde gold voor "course sync", een score
   van 0 tot 100 die via een verzonnen factor uit een spreiding in minuten werd
   gerekend.

   HORECA.md grens 7: wat niet gemeten is, wordt niet als getal getoond. Er staat
   nu wat er wél te tellen valt -- hoeveel van de bestelde regels zijn uitgegeven,
   en hoeveel minuten de gerechten van een gang uit elkaar lopen. Allebei
   navertelbaar, en bij een tafel die nog niets besteld heeft is de ring leeg in
   plaats van nul procent. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(x) { return document.getElementById(x); }
  function esc(x) { return K.esc(x); }

  function ring(g) {
    // niets besteld: geen breuk, dus geen ring met een verzonnen nul erin
    if (!g || !g.besteld) return '<div class="hj-ring hj-leeg"><span>-</span></div>';
    var deel = Math.round(g.uitgegeven / g.besteld * 100);
    return '<div class="hj-ring" style="--p:' + deel + '">' +
      '<span>' + g.uitgegeven + '/' + g.besteld + '</span></div>';
  }

  function laad() {
    K.api('/journey', {}).then(function (r) {
      var d = r.body;
      if (d.error) return;
      $('hjGasten').firstChild.nodeValue = d.samenvatting.gasten;
      $('hjTafels').firstChild.nodeValue = d.samenvatting.tafels;
      $('hjAandacht').firstChild.nodeValue = d.samenvatting.aandacht;
      $('hjRahul').textContent = d.rahul;

      $('hjReizen').innerHTML = (d.reizen || []).map(function (x) {
        var gang = x.gangen[0];
        return '<article data-risk="' + esc(x.risico) + '">' + ring(x.geserveerd) +
          '<div><span class="hj-place">' + esc(x.tafel) + ' · ' + x.gasten + ' gasten</span>' +
          '<h3>' + esc(x.stap.label) + '</h3><p>' + esc(x.stap.actie) + '</p></div>' +
          /* De spreiding in MINUTEN in plaats van een sync-percentage: dat is
             het getal waar een expediteur iets mee kan, en hij is na te rekenen. */
          '<aside><b>' + (gang ? (gang.spreiding ? gang.spreiding + ' min' : 'gelijk') : '-') + '</b>' +
          '<small>' + (gang ? 'gang uit elkaar' : 'geen gang open') + '</small>' +
          (x.openVerzoeken ? '<em>' + x.openVerzoeken + ' verzoek' + (x.openVerzoeken === 1 ? '' : 'en') + '</em>' : '') +
          (x.allergieen.length ? '<em class="safe">Allergiecontrole</em>' : '') +
          '</aside></article>';
      }).join('') || '<p class="hj-empty">Geen open gastreizen. De operatie is rustig.</p>';
    }).catch(function () {});
  }

  if (!K.poort()) return;
  laad();
  setInterval(laad, 10000);
  window.RTGHorecaJourney = { laad: laad };
})();
