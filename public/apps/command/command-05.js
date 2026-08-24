/* RTG Command, deel 5: het herstel -- de runbooks, de rondes en de terugzetknop.

   DROOG DRAAIEN STAAT LINKS VAN UITVOEREN, en dat is geen opmaakkeuze. De
   volgorde van de knoppen is de volgorde van het werk: eerst zien wat er zou
   gebeuren, dan pas doen. Een runbook waarvan niemand ooit de droogloop heeft
   gelezen, is een knop waarvan niemand weet wat hij doet.

   ELKE RONDE IS TERUG TE DRAAIEN ZOLANG NIEMAND ANDERS ERAAN ZAT. De kern zet
   alleen terug wat nog de waarde heeft die de ronde erin zette; wat sindsdien
   door iemand anders is gewijzigd, blijft staan en wordt geteld als
   overgeslagen. Zo wist een terugdraaiing nooit stilletjes andermans werk. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api;

  C.TEKENAARS.herstel = function (el) {
    el.innerHTML = '<h2 class="ckop">Herstel</h2>' +
      '<p class="lead">Vooraf goedgekeurde herstelrecepten. Wat een runbook mag doen, hangt niet aan de knop maar ' +
      'aan het beleid van dit moment: dezelfde handeling is autonoom bij één geval en mensenwerk bij honderd.</p>' +
      '<div id="hbuit"><div class="leeg">Laden…</div></div>';
    laad();
  };

  function laad() {
    Promise.all([api('runbooks'), api('runs', { n: 15 })]).then(function (r) {
      document.querySelector('#hbuit').innerHTML = teken(r[0].runbooks, r[1].runs);
      bind();
    }).catch(function (e) { if (!e.stil) document.querySelector('#hbuit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  }

  function teken(runbooks, runs) {
    var u = '';
    for (var i = 0; i < runbooks.length; i++) {
      var rb = runbooks[i];
      u += '<div class="kaart"><h3>' + esc(rb.naam) + ' ' + C.niveau(rb.oordeel.niveau) + '</h3>' +
        '<p>' + esc(rb.wat) + '</p>' +
        '<p class="meta h-mt45">Zet <b>' + esc(rb.veld) + '</b> op <b>' + esc(rb.naar) + '</b> · ' +
        (rb.terugDraaibaar ? 'terug te draaien' : 'NIET terug te draaien') +
        (rb.klantImpact ? ' · de klant merkt dit' : ' · geen klantimpact') + '</p>' +
        '<p class="meta">Risico ' + rb.oordeel.score + ' -- ' + esc(rb.oordeel.waarom) + '</p>' +
        '<div class="crij" style="margin-top:0.75rem;align-items:baseline;">' +
        '<b style="font-family:\'Bodoni Moda\',Georgia,serif;font-size:1.3rem;">' + rb.kandidaten + '</b>' +
        '<span class="meta">geval(len) passen nu</span>' +
        (rb.kandidaten ? '<button class="knop" data-droog="' + esc(rb.id) + '">Droog draaien</button>' +
          '<button class="knop' + (rb.oordeel.niveau === 'auto' ? ' vol' : '') + '" data-voer="' + esc(rb.id) + '">Uitvoeren</button>' : '') +
        '</div>' +
        (rb.oordeel.niveau === 'hand' && rb.kandidaten ? '<p class="meta h-mt50">Dit runbook staat op handmatig: uitvoeren vraagt uw expliciete akkoord en komt als zodanig in het journaal.</p>' : '') +
        '<div class="meta" id="droog-' + esc(rb.id) + '"></div></div>';
    }

    u += '<h2 class="ckop" style="font-size:1.15rem;margin:1.25rem 0 0.75rem;">De laatste rondes</h2>';
    if (!runs.length) u += '<div class="leeg">Er is nog geen herstelronde gedraaid.</div>';
    for (var j = 0; j < runs.length; j++) {
      var r = runs[j];
      u += '<div class="kaart"><h3>' + esc(r.naam) + ' <span class="meta">· ' + esc(C.tijd(r.at)) + '</span></h3>' +
        '<p class="meta">' + (r.droog ? 'droogloop' : 'uitgevoerd') + ' door ' + esc(r.door) + ' · ' +
        r.geraakt + ' van ' + r.totaalKandidaten + ' · ' + C.niveau(r.niveau) + ' · risico ' + C.getal(r.score) +
        (r.reden ? ' · ' + esc(r.reden) : '') + '</p>' +
        (r.voorbeelden && r.voorbeelden.length ? '<div class="meta h-mt40">' +
          r.voorbeelden.map(function (v) { return esc(v.titel) + ': ' + esc(v.van) + ' → ' + esc(v.naar); }).join('<br>') +
          (r.geraakt > r.voorbeelden.length ? '<br>… en nog ' + (r.geraakt - r.voorbeelden.length) : '') + '</div>' : '') +
        (r.droog ? '' : r.teruggedraaid
          ? '<p class="meta h-mt50">Teruggedraaid door ' + esc(r.terugDoor) + '.</p>'
          : '<div class="crij h-mt60"><button class="knop weg" data-terug="' + esc(r.id) + '">Terugzetten naar de vorige toestand</button></div>') +
        '</div>';
    }
    return u;
  }

  function bind() {
    document.querySelectorAll('[data-droog]').forEach(function (b) {
      b.onclick = function () {
        api('runbook/voer', { id: b.dataset.droog, droog: true }).then(function (r) {
          var vak = document.querySelector('#droog-' + b.dataset.droog);
          vak.innerHTML = '<div style="margin-top:0.5rem;border-top:1px solid var(--line);padding-top:.5rem;">' +
            '<b>Droogloop:</b> ' + r.run.geraakt + ' van ' + r.run.totaalKandidaten + ' geval(len) zouden veranderen.<br>' +
            r.run.voorbeelden.map(function (v) { return esc(v.titel) + ': ' + esc(v.van) + ' → ' + esc(v.naar); }).join('<br>') +
            (r.overgeslagen ? '<br>' + r.overgeslagen + ' vallen buiten deze ronde.' : '') + '</div>';
        }).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    document.querySelectorAll('[data-voer]').forEach(function (b) {
      b.onclick = function () {
        var reden = prompt('Waarom voert u dit herstel uit? (komt in het journaal)');
        if (!reden) return;
        api('runbook/voer', { id: b.dataset.voer, droog: false, reden: reden, menselijkAkkoord: true })
          .then(function (r) { C.meld(r.run.geraakt + ' geval(len) hersteld.'); return C.ververs(); })
          .then(laad).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    document.querySelectorAll('[data-terug]').forEach(function (b) {
      b.onclick = function () {
        var reden = prompt('Waarom draait u deze ronde terug?');
        if (!reden) return;
        api('runbook/terug', { run: b.dataset.terug, reden: reden })
          .then(function (r) { C.meld(r.teruggezet + ' teruggezet, ' + r.overgeslagen + ' overgeslagen (daar zat iemand anders aan).'); return C.ververs(); })
          .then(laad).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
  }
})();
