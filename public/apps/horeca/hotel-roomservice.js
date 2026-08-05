/* RTG Horeca (scherm): roomservice.

   Roomservice is een gewone rekening met een kamer eraan, en dat is precies de
   reden dat hij hier staat: de bestelling gaat langs dezelfde keuken (met
   dezelfde gang-vrijgave en dezelfde allergiekaart) en komt daarna op dezelfde
   gastrekening als de kamer en het ontbijt.

   Op de kamer boeken kan alleen als er een OPEN gastrekening op dat nummer
   staat. Staat die er niet, dan weigert de server -- en dat is de bedoeling:
   anders verdwijnt een rekening in een kamer die leegstaat en merkt niemand
   het tot de dagafsluiting. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;
  var huidig = null;

  function laad() {
    K.api('/rekeningen', { status: 'open', kanaal: 'roomservice' }).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('sLijst').innerHTML = (d.rekeningen || []).map(function (x) {
        return '<div class="item"><span><b>' + esc(x.tafel || x.kanaal) + '</b> <span class="stil">· ' +
          x.regels + ' regel(s)</span></span><span class="rij"><span class="stil">' + K.euro(x.totalen.teBetalen) +
          '</span>' + K.knop('Openen', { rek: x.id }) + '</span></div>';
      }).join('') || '<p class="stil">Er loopt geen roomservice.</p>';
      K.bind($('sLijst'), 'rek', function (b) { huidig = b.dataset.rek; toon(); });
      if (huidig) toon();
    });
  }

  function toon() {
    if (!huidig) return;
    K.api('/rekening', { rekeningId: huidig }).then(function (r) {
      if (r.body.error) { huidig = null; $('sDetail').innerHTML = ''; return; }
      var rek = r.body.rekening;
      $('sKop').textContent = (rek.tafel || 'Roomservice') + ' · kamer ' + (rek.kamer || '?');
      $('sDetail').innerHTML = (rek.regels || []).map(function (x) {
        return K.rij(x.aantal + '× ' + esc(x.naam) +
          (x.allergie ? ' <span class="allergie">' + esc(x.allergie) + '</span>' : '') +
          ' <span class="tag' + (x.vrijAt ? ' aan' : '') + '">' + esc(x.vrijAt ? x.stand : 'niet vrijgegeven') + '</span>',
        K.euro(x.centen * x.aantal));
      }).join('') + K.rij('<b>Te betalen</b>', '<b>' + K.euro(rek.totalen.teBetalen) + '</b>');
    });
  }

  if (!K.poort()) return;

  $('sOpen').addEventListener('click', function () {
    var kamer = $('sKamer').value.trim();
    if (!kamer) return K.meld('Voor welke kamer?');
    K.api('/rekening/open', { kanaal: 'roomservice', tafel: 'Kamer ' + kamer, kamer: kamer,
      gasten: Number($('sGasten').value) || 1 }).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      huidig = r.body.rekening.id;
      laad();
    });
  });
  $('sRegel').addEventListener('click', function () {
    if (!huidig) return K.meld('Open eerst een roomservicebestelling.');
    var naam = $('sNaam').value.trim();
    if (!naam) return K.meld('Wat wordt er besteld?');
    K.api('/rekening/regel', { rekeningId: huidig, naam: naam, prijs: Number($('sPrijs').value) || 0,
      aantal: Number($('sAantal').value) || 1, gang: 1, station: 'roomservice',
      allergie: $('sAllergie').value.trim() }).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      $('sNaam').value = ''; $('sPrijs').value = ''; $('sAllergie').value = '';
      laad();
    });
  });
  $('sVrij').addEventListener('click', function () {
    if (!huidig) return K.meld('Open eerst een roomservicebestelling.');
    K.api('/gang/vrij', { rekeningId: huidig, gang: 1, serveerOm: $('sServeerOm').value.trim() })
      .then(function (r) {
        K.meld(r.body.error || (r.body.vrijgegeven + ' regel(s) naar de keuken.'));
        laad();
      });
  });
  $('sOpKamer').addEventListener('click', function () {
    if (!huidig) return K.meld('Open eerst een roomservicebestelling.');
    K.api('/betaal', { rekeningId: huidig, wijze: 'kamer' }).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      K.meld('Op de gastrekening geboekt.');
      huidig = null;
      $('sDetail').innerHTML = '';
      laad();
      if (window.RTGHorecaFolio) { window.RTGHorecaFolio.lijst(); window.RTGHorecaFolio.toon(); }
    });
  });
  laad();
})();
