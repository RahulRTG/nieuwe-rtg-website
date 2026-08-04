/* RTG Horeca (scherm): de gastrekening van het hotel.

   Alles wat een gast tijdens zijn verblijf uitgeeft staat op EEN rekening: de
   kamer, het ontbijt, de minibar, de spa, het restaurant en de roomservice.
   Daarom staat het overzicht per soort onder de regels: aan het eind hoort een
   gast te kunnen zien waar zijn bedrag vandaan komt.

   Drie dingen die dit scherm expres benoemt:

   - DE TOERISTENBELASTING IS EEN EIGEN REGEL en zit niet in de kamerprijs. Een
     gast hoort te zien wat hij aan wie betaalt.
   - DE NACHTRUN IS IDEMPOTENT. Twee keer drukken boekt geen twee nachten; het
     scherm meldt hoeveel er zijn overgeslagen, zodat dat zichtbaar blijft en
     niet stilzwijgend gebeurt.
   - DE BORG IS EEN AANTEKENING. Er wordt niets vastgezet bij de bank van de
     gast; dat kan alleen een betaaldienst. Dat staat er ook zo bij. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;

  function lijst() {
    K.api('/folio', {}).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('hOpenTotaal').textContent = K.euro(d.openTotaal);
      $('hAantal').textContent = d.aantal;
      $('hLijst').innerHTML = (d.folios || []).map(function (f) {
        return '<div class="item"><span><b>Kamer ' + esc(f.kamer) + '</b> <span class="stil">· ' +
          esc(f.gastnaam || 'zonder naam') + ' · ' + f.nachten + ' nacht(en) geboekt</span></span>' +
          '<span class="rij"><span class="stil">' + K.euro(f.openstaand) + ' open</span>' +
          K.knop('Openen', { kamer: f.kamer }) + '</span></div>';
      }).join('') || '<p class="stil">Er staat geen gastrekening open.</p>';
      K.bind($('hLijst'), 'kamer', function (b) { $('hKamer').value = b.dataset.kamer; toon(); });
    });
  }

  function toon() {
    var kamer = $('hKamer').value.trim();
    if (!kamer) return;
    K.api('/folio', { kamer: kamer }).then(function (r) {
      var d = r.body;
      if (d.error) { $('hDetail').innerHTML = '<p class="stil">' + esc(d.error) + '</p>'; return; }
      var f = d.folio;
      var perSoort = {};
      (f.regels || []).forEach(function (x) { perSoort[x.soort] = (perSoort[x.soort] || 0) + x.centen; });
      $('hSoort').innerHTML = (d.soorten || []).map(function (s) {
        return '<option value="' + esc(s) + '">' + esc(s) + '</option>';
      }).join('');
      $('hDetail').innerHTML = (f.regels || []).map(function (x) {
        return K.rij('<span class="tag">' + esc(x.soort) + '</span> ' + esc(x.omschrijving) +
          ' <span class="stil">· ' + esc(x.at.slice(0, 10)) + ' · ' + esc(x.door) + '</span>', K.euro(x.centen));
      }).join('') + Object.keys(perSoort).map(function (s) {
        return K.rij('<span class="stil">samen ' + esc(s) + '</span>', K.euro(perSoort[s]));
      }).join('') +
        K.rij('<b>Totaal</b>', '<b>' + K.euro(f.totaal) + '</b>') +
        K.rij('Betaald', K.euro(f.betaald)) +
        K.rij('<b>Openstaand</b>', '<b>' + K.euro(f.openstaand) + '</b>') +
        (f.borg ? K.rij('Borg (afspraak, niet vastgezet bij de bank)',
          K.euro(f.borg.centen) + (f.borg.terugAt ? ' · terug' : '')) : '');
    });
  }

  if (!K.poort()) return;

  $('hToon').addEventListener('click', function () {
    if (!$('hKamer').value.trim()) return K.meld('Welke kamer?');
    toon();
  });
  $('hOpen').addEventListener('click', function () {
    K.api('/folio/open', { kamer: $('hKamer').value.trim(), gastnaam: $('hGast').value.trim(),
      gasten: Number($('hGasten').value) || 1, van: $('hVan').value.trim(), tot: $('hTot').value.trim(),
      nachtprijs: Number($('hNachtprijs').value) || 0,
      toeristenbelasting: Number($('hBelasting').value) || 0 }).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      K.meld('Gastrekening geopend op kamer ' + r.body.folio.kamer + '.');
      lijst(); toon();
    });
  });
  $('hBoek').addEventListener('click', function () {
    K.api('/folio/boek', { kamer: $('hKamer').value.trim(), soort: $('hSoort').value,
      omschrijving: $('hOmschrijving').value.trim(), bedrag: Number($('hBedrag').value) || 0 })
      .then(function (r) {
        if (r.body.error) return K.meld(r.body.error);
        $('hOmschrijving').value = ''; $('hBedrag').value = '';
        lijst(); toon();
      });
  });
  $('hNacht').addEventListener('click', function () {
    K.api('/folio/nacht', { datum: $('hNachtDatum').value.trim() }).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('hNachtUit').textContent = d.geboekt + ' kamer(s) geboekt, ' + d.overgeslagen +
        ' overgeslagen, samen ' + K.euro(d.centen) + '. ' + d.let;
      lijst(); toon();
    });
  });
  $('hBorg').addEventListener('click', function () {
    K.api('/folio/borg', { kamer: $('hKamer').value.trim(), bedrag: Number($('hBorgBedrag').value) || 0 })
      .then(function (r) {
        if (r.body.error) return K.meld(r.body.error);
        $('hBorgUit').textContent = r.body.let;
        toon();
      });
  });
  $('hBorgTerug').addEventListener('click', function () {
    K.api('/folio/borg', { kamer: $('hKamer').value.trim(), terug: true,
      ingehouden: Number($('hBorgIn').value) || 0, reden: $('hBorgReden').value.trim() })
      .then(function (r) {
        if (r.body.error) return K.meld(r.body.error);
        K.meld('Borg afgehandeld.');
        toon();
      });
  });
  $('hAfrekenen').addEventListener('click', function () {
    K.api('/folio/afrekenen', { kamer: $('hKamer').value.trim(), wijze: $('hWijze').value })
      .then(function (r) {
        var d = r.body;
        if (d.error) return K.meld(d.error);
        K.meld(d.gesloten ? 'Afgerekend en gesloten.' : 'Nog open: ' + K.euro(d.openstaand));
        lijst(); toon();
      });
  });

  window.RTGHorecaFolio = { lijst: lijst, toon: toon };
  lijst();
})();
