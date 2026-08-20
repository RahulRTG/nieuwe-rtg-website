/* RTG Command, deel 3: de zoekbalk over alles, en het objectdossier.

   DE UITSLAG ZEGT ALTIJD WAAR ER GEKEKEN IS. Ook bij nul treffers staat er
   welke soorten en welke velden zijn doorzocht. "Niets gevonden" hoort een
   uitslag te zijn en geen stilte -- anders weet je niet of je verkeerd zocht of
   dat het er echt niet is.

   HET DOSSIER LAAT ZIEN WAT HET NIET WEET. Staat er een kluisveld, dan staat
   dat er als kluisveld en niet als leeg veld. Is de afhankelijkhedenscan tegen
   zijn grens gelopen, dan zegt hij dat. Een dossier dat zijn eigen gaten
   verzwijgt, laat je een beslissing nemen op iets wat je niet hebt gezien. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, S = C.S, api = C.api;

  C.TEKENAARS.zoek = function (el) {
    var term = S.zoekterm || '';
    document.querySelector('#q').value = term;
    el.innerHTML = '<h2 class="ckop">Zoek alles</h2>' +
      '<p class="lead">Eén balk over elk domein: naam, code, kenteken, plaats, status of ordernummer. ' +
      'Wat u vindt, opent u als dossier -- met de systemen die eraan hangen.</p>' +
      '<div id="zuit">' + (term ? '<div class="leeg">Zoeken naar “' + esc(term) + '”…</div>'
        : '<div class="leeg">Typ boven in de balk en druk op enter.</div>') + '</div>';
    if (!term) return;
    api('zoek', { q: term }).then(function (d) {
      S.zoek = d;
      document.querySelector('#zuit').innerHTML = zoekuit(d);
      bindTreffers();
    }).catch(function (e) { if (!e.stil) document.querySelector('#zuit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  };

  function zoekuit(d) {
    if (d.kort) return '<div class="leeg">Een zoekterm van minstens twee tekens, graag.</div>';
    var u = '<p class="meta" style="margin-bottom:.9rem;">' + d.totaal + ' treffer(s) in ' +
      d.groepen.length + ' soort(en)' + (d.domeinen && d.domeinen.length ? ' over ' + d.domeinen.length + ' domein(en)' : '') + '.</p>';
    if (!d.groepen.length) {
      u += '<div class="kaart"><h3>Niets gevonden</h3><p>Er is gekeken in ' + d.bereik.length + ' objectsoorten:</p>' +
        '<div class="meta h-mt50">' +
        d.bereik.map(function (b) { return esc(b.meervoud) + ' (' + esc(b.velden.join(', ')) + ')'; }).join('<br>') +
        '</div></div>';
      return u;
    }
    for (var i = 0; i < d.groepen.length; i++) {
      var g = d.groepen[i];
      u += '<div class="kaart"><h3>' + esc(g.label) + ' <span class="meta">· ' + g.totaal + ' treffer(s) in ' + esc(g.domein) + '</span></h3>';
      if (g.afgekapt) u += '<p class="meta">Er is tot ' + g.afgekapt + ' rijen gekeken; daarboven is niet gescand.</p>';
      for (var j = 0; j < g.rijen.length; j++) {
        var r = g.rijen[j];
        u += '<div class="lijn"><button class="knop" data-t="' + esc(r.type) + '" data-i="' + esc(r.id) + '" style="border:none;padding:0;text-align:left;">' +
          '<b>' + esc(r.titel) + '</b></button>' +
          (r.sub ? ' <span class="meta">' + esc(r.sub) + '</span>' : '') +
          '<div class="meta">' + esc(r.type) + ' ' + esc(r.id) + ' · gevonden op ' + esc(r.veld) + '</div></div>';
      }
      if (g.totaal > g.rijen.length) u += '<p class="meta h-mt50">' +
        (g.totaal - g.rijen.length) + ' verder niet getoond.</p>';
      u += '</div>';
    }
    return u;
  }

  function bindTreffers() {
    document.querySelectorAll('#zuit [data-t]').forEach(function (b) {
      b.onclick = function () { openObject(b.dataset.t, b.dataset.i); };
    });
  }

  function openObject(type, id) {
    S.object = { type: type, id: id, data: null };
    C.ga('object');
  }
  C.openObject = openObject;

  /* Het objectdossier is geen eigen werkplek in de rail: je komt er vanuit een
     treffer, een uitzondering of een plan. Hij staat wel in TEKENAARS, zodat
     de schil hem net zo tekent als alle andere. */
  C.TEKENAARS.object = function (el) {
    var o = S.object;
    if (!o) { el.innerHTML = '<div class="leeg">Geen object gekozen.</div>'; return; }
    if (!o.data) {
      el.innerHTML = '<div class="leeg">Dossier laden…</div>';
      api('object', { type: o.type, id: o.id }).then(function (d) { o.data = d; C.teken(); })
        .catch(function (e) { if (!e.stil) el.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
      return;
    }
    var d = o.data;
    var u = '<button class="knop" id="terugZoek">← terug naar de zoekuitslag</button>' +
      '<h2 class="ckop h-mt90">' + esc(d.object.titel) + '</h2>' +
      '<p class="lead">' + esc(d.object.label) + ' ' + esc(d.object.id) +
      (d.object.sub ? ' · ' + esc(d.object.sub) : '') + ' · domein ' + esc(d.object.domein) + '</p>';

    u += '<div class="kaart"><h3>Wat er kan</h3>';
    if (!d.acties.length) u += '<p>Geen handelingen bekend voor deze soort.</p>';
    for (var i = 0; i < d.acties.length; i++) {
      var a = d.acties[i];
      u += '<div class="lijn"><b>' + esc(a.naam) + '</b> ' + C.niveau(a.niveau) +
        ' <span class="meta">risico ' + a.score + (a.vierOgen ? ' · vier ogen' : '') + '</span>' +
        '<div class="meta">' + esc(a.wat) + '</div>' +
        '<div class="meta">' + esc(a.waaromNiet || a.waarom) + '</div>' +
        (a.soort === 'runbook' && a.past ? '<div class="crij h-mt45">' +
          '<button class="knop" data-rb="' + esc(a.id) + '" data-droog="1">Droog draaien</button>' +
          '<button class="knop' + (a.niveau === 'auto' ? ' vol' : '') + '" data-rb="' + esc(a.id) + '">Uitvoeren</button></div>' : '') +
        '</div>';
    }
    u += '</div>';

    u += '<div class="kaart"><h3>Tijdlijn</h3>';
    if (!d.tijdlijn.length) u += '<p>Nog niets vastgelegd over dit object.</p>';
    for (var t = 0; t < Math.min(d.tijdlijn.length, 40); t++) {
      var r = d.tijdlijn[t];
      u += '<div class="lijn"><span class="meta">' + esc(C.tijd(r.at)) + '</span> · ' + esc(r.wat) +
        (r.door ? ' <span class="meta">door ' + esc(r.door) + '</span>' : '') +
        (r.niveau ? ' ' + C.niveau(r.niveau) : '') +
        (r.reden ? '<div class="meta">' + esc(r.reden) + '</div>' : '') + '</div>';
    }
    u += '</div>';

    u += '<div class="kaart"><h3>Hangt hieraan</h3>';
    if (!d.afhankelijkheden.length) u += '<p>Geen enkel ander object verwijst naar dit object.</p>';
    for (var g = 0; g < d.afhankelijkheden.length; g++) {
      var gr = d.afhankelijkheden[g];
      u += '<div class="lijn"><b>' + esc(gr.label) + '</b> <span class="meta">' + gr.totaal + ' · ' + esc(gr.domein) + '</span><div class="meta">' +
        gr.rijen.map(function (x) { return '<button class="knop" data-t="' + esc(x.type) + '" data-i="' + esc(x.id) + '" style="border:none;padding:0;font-size:.8rem;">' + esc(x.titel) + '</button> (via ' + esc(x.via) + ')'; }).join(' · ') +
        '</div></div>';
    }
    if (d.afhankelijkhedenOnvolledig) u += '<p class="meta h-mt50">Let op: minstens één collectie is groter dan de scangrens. Deze lijst is daarmee niet volledig.</p>';
    u += '</div>';

    u += '<div class="kaart"><h3>De feiten</h3><div class="schuif"><table class="ctab"><tbody>';
    for (var f = 0; f < d.feiten.length; f++) {
      u += '<tr><th style="width:11rem;">' + esc(d.feiten[f].veld) + '</th><td>' +
        esc(d.feiten[f].waarde) + (d.feiten[f].kluis ? ' <span class="meta">(alleen via de kluis, met reden en spoor)</span>' : '') + '</td></tr>';
    }
    u += '</tbody></table></div></div>';
    el.innerHTML = u;

    document.querySelector('#terugZoek').onclick = function () { C.ga('zoek'); };
    el.querySelectorAll('[data-t]').forEach(function (b) {
      b.onclick = function () { openObject(b.dataset.t, b.dataset.i); };
    });
    el.querySelectorAll('[data-rb]').forEach(function (b) {
      b.onclick = function () {
        var droog = b.dataset.droog === '1';
        var reden = droog ? 'droogloop vanuit het objectdossier' : prompt('Waarom voert u dit uit? (komt in het journaal)');
        if (!droog && !reden) return;
        api('runbook/voer', { id: b.dataset.rb, droog: droog, reden: reden, alleen: [o.id], menselijkAkkoord: !droog })
          .then(function (r) {
            C.meld((droog ? 'Droog: ' : 'Uitgevoerd: ') + r.run.geraakt + ' geval(len).');
            o.data = null; return C.ververs();
          }).then(function () { C.teken(); })
          .catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
  };
})();
