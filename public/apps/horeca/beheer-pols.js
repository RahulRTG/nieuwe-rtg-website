/* RTG Horeca (scherm): de pols van de zaak -- drie bronnen, drie blokken.

   De opzet van dit stuk scherm IS de boodschap. Links wat er over de zaak
   gemeten wordt, met de rekensom erbij en zonder invoerveld: dat kan ze niet
   bijstellen. Daaronder wat ze wel zelf invult, en daaronder wat gasten vanaf
   hun tafel melden. Ze staan onder elkaar en niet door elkaar, en er komt
   nergens een totaalcijfer uit.

   De lijst met onderwerpen en de keuzes komen van de SERVER (`invulbaar`).
   Hier een eigen kopie van die lijst neerzetten zou betekenen dat een
   onderwerp dat erbij komt op twee plekken moet worden toegevoegd, en dan
   loopt er een uit de pas (LAT-regel 4). */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;
  var INVULBAAR = [];

  function bron(x) { return '<span class="stil">· ' + esc(x.label) + '</span>'; }

  function toon(d) {
    INVULBAAR = d.invulbaar || [];

    $('poGemeten').innerHTML = (d.gemeten || []).map(function (m) {
      return K.rij('<b>' + esc(m.naam) + '</b> ' + esc(m.tekst) + ' ' + bron(m) +
        '<br><span class="stil">' + esc(m.rekensom) + '</span>');
    }).join('') || '<p class="stil">Er valt op dit moment niets te meten.</p>';

    /* Wat we NIET weten staat er met de reden bij. Een leeg vak zou als "rustig"
       worden gelezen, en dat merkt de gast pas voor de deur. */
    $('poNiet').innerHTML = (d.nietGemeten || []).map(function (g) {
      return K.rij('<b>' + esc(g.onderwerp) + '</b> <span class="stil">' + esc(g.waarom) + '</span>');
    }).join('');

    $('poZaak').innerHTML = INVULBAAR.map(function (o) {
      var nu = (d.zaakZegt || []).filter(function (z) { return z.onderwerp === o.sleutel; })[0];
      return '<div class="rij h-mt40"><label for="po_' + esc(o.sleutel) + '" style="flex:0 1 11rem;">' +
        esc(o.naam) + '</label><select class="veld" id="po_' + esc(o.sleutel) + '" aria-label="' + esc(o.naam) + '">' +
        '<option value="">(niets zeggen)</option>' +
        o.standen.map(function (s) {
          return '<option value="' + esc(s) + '"' + (nu && nu.stand === s ? ' selected' : '') + '>' + esc(s) + '</option>';
        }).join('') + '</select><span class="stil">' + (nu ? esc(nu.label) : 'nog niet ingevuld') + '</span></div>';
    }).join('');

    $('poGasten').innerHTML = (d.gastenZeggen || []).map(function (g) {
      var verdeling = Object.keys(g.verdeling).map(function (s) { return esc(s) + ': ' + g.verdeling[s]; }).join(', ');
      return K.rij('<b>' + esc(g.naam) + '</b> ' + esc(g.stand) + ' ' + bron(g) +
        '<br><span class="stil">' + esc(verdeling) + '</span>');
    }).join('') || '<p class="stil">Nog geen meldingen van gasten in de afgelopen uren.</p>';

    $('poLet').textContent = d.let + ' ' + (d.versMinuten
      ? 'Wat je invult vervalt na ' + Math.round(d.versMinuten.zaak / 60) + ' uur.' : '');
  }

  function haal() {
    K.api('/pols', {}).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      toon(r.body);
    });
  }

  function zet() {
    var standen = {};
    INVULBAAR.forEach(function (o) {
      var el = $('po_' + o.sleutel);
      if (el) standen[o.sleutel] = el.value;
    });
    K.api('/pols/zet', { standen: standen }).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      var af = (r.body.geweigerd || [])[0];
      K.meld(af ? af.waarom : 'Bijgewerkt. Dit staat er nu bij voor gasten die vanavond kijken.');
      haal();
    });
  }

  if (!$('poGemeten') || !K.poort()) return;
  $('poZet').addEventListener('click', zet);
  $('poVervers').addEventListener('click', haal);
  haal();
})();
