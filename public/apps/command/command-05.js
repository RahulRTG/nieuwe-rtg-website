/* RTG Command, deel 5: het herstel -- de runbooks, de rondes en de terugzetknop.

   DROOG DRAAIEN STAAT LINKS VAN UITVOEREN, en dat is geen opmaakkeuze. De
   volgorde van de knoppen is de volgorde van het werk: eerst zien wat er zou
   gebeuren, dan pas doen. Een runbook waarvan niemand ooit de droogloop heeft
   gelezen, is een knop waarvan niemand weet wat hij doet.

   EN SINDS DE TRANSACTIE STAAT DE KETEN OP HET SCHERM. Een ronde loopt
   voorcontrole -> momentopname -> uitvoeren -> verificatie -> vastleggen, en
   bij een mislukte verificatie automatisch terug. De droogloop toont de
   voorcontrole (ook als die zou weigeren -- daar is hij voor), en elke ronde in
   de lijst draagt zijn verificatie. "Niet nagekeken" staat er als uitslag en
   niet als leegte: een oude ronde van vóór de transactie hoort niet te lezen
   als een ronde die is nagekeken.

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
        (r.droog ? '' : '<p class="meta">' + verificatie(r.verificatie) + '</p>') +
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

  /* De uitslag van de verificatie in één regel. `null` is hier een UITSLAG:
     deze ronde is niet langs een verificatie gekomen, en dat is iets anders dan
     een geslaagde. */
  function verificatie(v) {
    if (!v) return '<span class="cniveau geen">niet nagekeken</span> Deze ronde liep niet langs een verificatie.';
    if (v.nietVanToepassing) return '<span class="cniveau geen">niets te verifiëren</span> ' + esc(v.waarom);
    return '<span class="cniveau ' + (v.goed ? 'ok' : 'mis') + '">verificatie ' +
      (v.goed ? 'geslaagd' : 'mislukt') + '</span> ' + esc(v.waarom);
  }

  /* De voorcontrole bij een droogloop. Hij toont ook wat er NIET gecontroleerd
     kon worden -- dat is precies het soort voorwaarde dat je anders voor
     geslaagd aanziet. */
  function voorcontrole(v, cert) {
    if (!v) return '';
    var u = '<div class="h-mt50"><b>Voorcontrole:</b> ' +
      (v.mag ? 'alle gecontroleerde voorwaarden houden.' : 'dit zou een echte ronde tegenhouden.') + '</div>';
    u += '<ul class="h-keten">' + v.stappen.map(function (s) {
      var merk = !s.gecontroleerd ? '<span class="cniveau geen">niet gecontroleerd</span>'
        : '<span class="cniveau ' + (s.goed ? 'ok' : 'mis') + '">' + (s.goed ? 'houdt' : 'weigert') + '</span>';
      return '<li>' + merk + ' <b>' + esc(s.naam) + '</b> · ' + esc(s.waarom) + '</li>';
    }).join('') + '</ul>';
    if (cert && cert.ongecertificeerd) u += '<div class="meta">' + esc(cert.waarom) + '</div>';
    else if (cert) u += '<div class="meta">Certificaat v' + cert.versie + ' · ten hoogste ' +
      (cert.maxObjecten == null ? 'geen grens' : cert.maxObjecten + ' objecten') + ' · weg terug: ' +
      esc(cert.terugweg) + ' · nagekeken op: ' + esc((cert.verificaties || []).join(', ')) + '</div>';
    return u;
  }

  function bind() {
    document.querySelectorAll('[data-droog]').forEach(function (b) {
      b.onclick = function () {
        api('runbook/voer', { id: b.dataset.droog, droog: true }).then(function (r) {
          var vak = document.querySelector('#droog-' + b.dataset.droog);
          vak.innerHTML = '<div class="h-droog">' +
            '<b>Droogloop:</b> ' + r.run.geraakt + ' van ' + r.run.totaalKandidaten + ' geval(len) zouden veranderen.<br>' +
            r.run.voorbeelden.map(function (v) { return esc(v.titel) + ': ' + esc(v.van) + ' → ' + esc(v.naar); }).join('<br>') +
            (r.overgeslagen ? '<br>' + r.overgeslagen + ' vallen buiten deze ronde.' : '') +
            voorcontrole(r.voorcontrole, r.certificaat) + '</div>';
        }).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    document.querySelectorAll('[data-voer]').forEach(function (b) {
      b.onclick = function () {
        var reden = prompt('Waarom voert u dit herstel uit? (komt in het journaal)');
        if (!reden) return;
        api('runbook/voer', { id: b.dataset.voer, droog: false, reden: reden, menselijkAkkoord: true })
          .then(function (r) {
            /* De melding zegt de UITSLAG en niet alleen het aantal. Een ronde
               die zichzelf heeft teruggedraaid en "12 hersteld" meldt, is de
               ergste melding die dit scherm kan geven. */
            C.meld(r.teruggedraaid
              ? 'De verificatie mislukte; de ronde is teruggedraaid (' + r.teruggedraaid.teruggezet + ' teruggezet).'
              : r.verificatie && r.verificatie.goed === false
                ? 'De verificatie mislukte en terugdraaien lukte niet: ' + (r.terugMislukt || r.verificatie.waarom)
                : r.verificatie && r.verificatie.nietVanToepassing
                  ? 'Er veranderde niets, dus er viel niets te verifiëren.'
                  : r.run.geraakt + ' geval(len) hersteld en nagekeken.');
            return C.ververs();
          })
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
