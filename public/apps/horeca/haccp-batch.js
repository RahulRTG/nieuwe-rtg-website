/* RTG Horeca (scherm): HACCP -- batches met houdbaarheid en de controlelijsten.

   Wat over de datum is, staat bovenaan met het aantal dagen erbij. Het wordt
   NIET automatisch afgeboekt: weggooien is een handeling van een mens, met een
   reden. Een systeem dat zelf voorraad laat verdwijnen, maakt van een
   houdbaarheidsdatum een boekhoudregel.

   De controlelijst kent geen knop "alles akkoord". Elke vraag krijgt een eigen
   antwoord, en bij elk punt dat niet akkoord is, hoort een opmerking. Dat is
   precies het verschil tussen een lijst die werkt en een lijst die elke
   ochtend in twee seconden groen wordt. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;
  var lijsten = [];

  function batches() {
    K.api('/haccp/batches', {}).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('bOver').textContent = d.over;
      $('bBijna').textContent = d.bijnaOver;
      $('bBatches').innerHTML = (d.batches || []).map(function (b) {
        return K.rij('<b>' + esc(b.naam) + '</b> <span class="stil">· ' + esc(b.batch || 'zonder batchnummer') +
          (b.leverancier ? ' · ' + esc(b.leverancier) : '') + (b.hoeveelheid ? ' · ' + esc(b.hoeveelheid) : '') + '</span>',
        '<span class="tag' + (b.over ? ' laat' : (b.dagenTeGaan <= 2 ? ' laat' : ' aan')) + '">' + esc(b.tht) + ' · ' +
          (b.over ? Math.abs(b.dagenTeGaan) + ' dagen over de datum' : b.dagenTeGaan + ' dagen') + '</span>' +
          K.knop('Eraf', { weg: b.id }));
      }).join('') || '<p class="stil">Er staan geen batches open.</p>';
      $('bBatchLet').textContent = d.let;
      K.bind($('bBatches'), 'weg', function (btn) {
        var reden = $('bWegReden').value.trim();
        if (!reden) return K.meld('Waarom gaat deze batch eraf? (opgemaakt, over de datum, teruggeroepen)');
        K.api('/haccp/batch/weg', { batchId: btn.dataset.weg, reden: reden }).then(function (r2) {
          if (r2.body.error) return K.meld(r2.body.error);
          batches();
        });
      });
    });
  }

  function toonLijsten() {
    K.api('/haccp/lijst', {}).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      lijsten = r.body.lijsten || [];
      $('bLijstKeuze').innerHTML = lijsten.map(function (l) {
        return '<option value="' + esc(l.naam) + '">' + esc(l.naam) + ' (' + esc(l.moment) + ')</option>';
      }).join('');
      vragen();
    });
  }

  function gekozen() {
    return lijsten.filter(function (l) { return l.naam === $('bLijstKeuze').value; })[0] || null;
  }

  function vragen() {
    var l = gekozen();
    $('bVragen').innerHTML = l ? l.vragen.map(function (v, i) {
      return '<div class="item"><span><label><input type="checkbox" data-akkoord="' + i + '"> ' + esc(v) + '</label></span>' +
        '<input class="veld" data-opmerking="' + i + '" maxlength="160" placeholder="Opmerking (verplicht als niet akkoord)" aria-label="Opmerking bij ' + esc(v) + '"></div>';
    }).join('') : '<p class="stil">Er is nog geen controlelijst. Maak er hierboven een.</p>';
  }

  if (!K.poort()) return;

  $('bBatchZet').addEventListener('click', function () {
    K.api('/haccp/batch', { naam: $('bNaam').value.trim(), tht: $('bTht').value.trim(),
      batch: $('bBatchNr').value.trim(), leverancier: $('bLeverancier').value.trim(),
      hoeveelheid: $('bHoeveel').value.trim() }).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      $('bNaam').value = ''; $('bBatchNr').value = '';
      batches();
    });
  });
  $('bLijstZet').addEventListener('click', function () {
    var v = $('bLijstVragen').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    if (!$('bLijstNaam').value.trim() || !v.length) return K.meld('Geef een naam en minstens een vraag (een per regel).');
    K.api('/haccp/lijst', { naam: $('bLijstNaam').value.trim(), vragen: v, moment: $('bMoment').value })
      .then(function (r) {
        if (r.body.error) return K.meld(r.body.error);
        toonLijsten();
      });
  });
  $('bLijstKeuze').addEventListener('change', vragen);
  $('bAfvinken').addEventListener('click', function () {
    var l = gekozen();
    if (!l) return K.meld('Kies een controlelijst.');
    var antwoorden = l.vragen.map(function (v, i) {
      return { akkoord: $('bVragen').querySelector('[data-akkoord="' + i + '"]').checked,
        opmerking: $('bVragen').querySelector('[data-opmerking="' + i + '"]').value.trim() };
    });
    K.api('/haccp/afvinken', { naam: l.naam, antwoorden: antwoorden }).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('bAfUit').textContent = 'Afgevinkt om ' + d.controle.at.slice(11, 16) + ' door ' + d.controle.door +
        (d.controle.akkoord ? ': alles akkoord.' : ': niet alles akkoord, met opmerkingen erbij.');
    });
  });
  batches();
  toonLijsten();
})();
