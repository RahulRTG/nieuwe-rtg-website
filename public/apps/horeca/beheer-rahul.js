/* RTG Horeca (scherm): DE ACTIEBONNEN VAN RAHUL, op het scherm van de manager.

   Een actiebon die niemand leest, is geen bon maar een logregel. De hele
   opdracht was dat een AI-voorstel nooit ONGEMERKT iets doet -- en "ongemerkt"
   gaat over wat een mens ziet, niet over wat er in een bestand staat. Dus staat
   hij hier, op het scherm waar de manager toch al kijkt.

   DRIE DINGEN DIE HIER ZICHTBAAR BLIJVEN:

   1. EEN GEWEIGERDE POGING STAAT ER OOK. Juist die: een poging die niemand ziet
      is de gevaarlijkste. Er staat geen filter op dat ze verbergt.
   2. DE REDEN STAAT BIJ DE UITKOMST. "Geweigerd" zonder waarom is een muur; met
      waarom is het een regel die een mens kan aanvechten of veranderen.
   3. BEVESTIGEN IS EEN TIK VAN EEN MENS, met zijn naam erbij. Er is geen knop
      die alles in een keer goedkeurt: een stapel bevestigen is precies hoe een
      bevestiging een formaliteit wordt. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  if (!K.poort()) return;
  var esc = K.esc, api = K.api, meld = K.meld;
  function $(id) { return document.getElementById(id); }
  if (!$('mRahulBonnen')) return;

  var WOORD = { wacht: 'wacht op een mens', uitgevoerd: 'uitgevoerd',
    geweigerd: 'geweigerd', mislukt: 'mislukt' };

  function klokje(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function bon(b) {
    return '<div class="item"><span>' +
      '<b>' + esc(b.wat) + '</b> <span class="stil">· ' + esc(klokje(b.at)) +
      (b.door ? ' · ' + esc(b.door) : '') + '</span>' +
      '<div class="stil">' + esc(WOORD[b.stand] || b.stand) + ' &mdash; ' + esc(b.reden) + '</div>' +
      (b.waarom ? '<div class="stil">Aanleiding: ' + esc(b.waarom) + '</div>' : '') +
      (b.uitkomst ? '<div class="stil">' + esc(b.uitkomst) + '</div>' : '') +
      (b.bevestigdDoor ? '<div class="stil">Bevestigd door ' + esc(b.bevestigdDoor) + '.</div>' : '') +
      '</span><span>' +
      (b.stand === 'wacht' ? '<button class="knop p" data-bevestig="' + esc(b.id) + '">Bevestigen</button>' : '') +
      '</span></div>';
  }

  function teken(d) {
    $('mRahulTelling').textContent = d.aantal + (d.wacht ? ', ' + d.wacht + ' wacht' : '');
    $('mRahulBonnen').innerHTML = d.bonnen.length ? d.bonnen.map(bon).join('')
      : '<p class="stil">Rahul heeft in deze zaak nog niets gedaan of voorgesteld.</p>';
    $('mRahulLet').textContent = d.let || '';
    K.bind($('mRahulBonnen'), 'bevestig', function (b) {
      api('/rahul/bevestig', { bonId: b.getAttribute('data-bevestig') }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        meld(r.body.bon.uitkomst || 'Bevestigd.');
        haal();
      });
    });
  }

  function grens() {
    return api('/rahul/register', {}).then(function (r) {
      var c = r.body.kortingGrensCenten;
      $('mRahulGrensUit').textContent = c === null
        ? 'Geen kortingsgrens ingesteld, dus vraagt elke korting van Rahul een mens. Er wordt hier geen bedrag verzonnen.'
        : 'Tot € ' + (c / 100).toFixed(2) + ' mag Rahul een korting zelf boeken; daarboven bevestigt een mens.';
      if (c !== null) $('mRahulGrens').value = c;
    });
  }

  function haal() {
    return api('/rahul/bonnen', { hoeveel: 40 }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      teken(r.body);
    }).then(grens);
  }

  $('mRahulGrensZet').addEventListener('click', function () {
    var c = Number($('mRahulGrens').value);
    api('/rahul/grens', { centen: c }).then(function (r) {
      meld(r.body.error || 'Grens gezet.');
      haal();
    });
  });
  $('mRahulGrensWeg').addEventListener('click', function () {
    api('/rahul/grens', { centen: null }).then(function (r) {
      $('mRahulGrens').value = '';
      meld(r.body.error || r.body.let || 'Grens weg.');
      haal();
    });
  });

  K.luister('horeca', haal);
  haal();
})();
