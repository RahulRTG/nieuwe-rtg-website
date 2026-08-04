/* RTG Horeca (scherm): de deur -- de capaciteitsteller en de gastenlijst.

   De teller telt hoeveel mensen er binnen zijn, niet WIE. Er wordt geen
   aanwezigheidslijst bijgehouden en er staat geen camera achter; in en uit en
   herbetreding zijn drie knoppen en samen zijn ze het getal dat de portier
   nodig heeft.

   Bij de gastenlijst staat per promoter twee getallen naast elkaar:
   aangemeld en binnen. Alleen dat eerste zegt niets -- honderd namen op een
   lijst is geen honderd mensen in de zaak, en een promoter die op aanmeldingen
   wordt afgerekend, heeft dat allang door. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;

  function toonDeur(d) {
    $('dBinnen').textContent = d.binnen;
    $('dVrij').textContent = d.vrij;
    $('dVerwacht').textContent = d.verwacht;
    $('dDeurUit').textContent = 'In ' + d.in + ' · uit ' + d.uit + ' · herbetreding ' + d.herbetreding +
      ' · geweigerd wegens vol ' + d.geweigerd + '. ' + d.let;
  }

  function deur(wat) {
    K.api('/club/deur', { wat: wat, personen: Number($('dPersonen').value) || 1,
      capaciteit: Number($('dCapaciteit').value) || 300,
      leeftijdGecontroleerd: wat === 'stand' ? undefined : $('dLeeftijd').checked })
      .then(function (r) {
        if (r.body.error) { K.meld(r.body.error); return; }
        toonDeur(r.body);
        gasten(null);
      });
  }

  function gasten(namen) {
    var body = { datum: $('dDatum').value.trim() };
    if (namen) {
      body.namen = namen;
      body.promoter = $('dPromoter').value.trim();
      body.personen = Number($('dGastPersonen').value) || 1;
      body.korting = $('dKorting').value.trim();
    }
    K.api('/club/gastenlijst', body).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('dLijst').innerHTML = (d.gasten || []).map(function (g) {
        return K.rij(esc(g.naam) + ' <span class="stil">· ' + g.personen + ' pers.' +
          (g.promoter ? ' · ' + esc(g.promoter) : '') + (g.korting ? ' · ' + esc(g.korting) : '') + '</span>',
        '<span class="tag' + (g.binnen ? ' aan' : '') + '">' + (g.binnen ? 'binnen' : 'verwacht') + '</span>');
      }).join('') || '<p class="stil">Voor deze datum staat er niemand op de lijst.</p>';
      $('dPromoters').innerHTML = Object.keys(d.perPromoter).map(function (p) {
        return K.rij(esc(p), d.perPromoter[p].binnen + ' van ' + d.perPromoter[p].aangemeld + ' binnen');
      }).join('') || '<p class="stil">Nog geen promotercodes.</p>';
    });
  }

  if (!K.poort()) return;

  $('dIn').addEventListener('click', function () { deur('in'); });
  $('dUit').addEventListener('click', function () { deur('uit'); });
  $('dTerug').addEventListener('click', function () { deur('terug'); });
  $('dStand').addEventListener('click', function () { deur('stand'); });
  $('dGastZet').addEventListener('click', function () {
    var namen = $('dNamen').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    if (!namen.length) return K.meld('Welke namen komen op de lijst?');
    gasten(namen);
    $('dNamen').value = '';
  });
  $('dGastToon').addEventListener('click', function () { gasten(null); });
  deur('stand');
})();
