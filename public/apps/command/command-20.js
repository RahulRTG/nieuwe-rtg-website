/* RTG Command, deel 20: de vloot.

   ALLE ORGANISATIES IN ÉÉN BEELD, EN DE PLEK WAAR DAT BEELD OPHOUDT. Support
   moet van alle klanten naar één werkruimte kunnen zakken zonder van gereedschap
   te wisselen -- anders wordt één externe storing bij achthonderd klanten
   achthonderd keer hetzelfde uitzoekwerk. En tegelijk mag "ik kan tot op
   werkruimteniveau kijken" niet betekenen "ik mag alles lezen".

   Vandaar dat het scherm eindigt met de reden waarom het eindigt. Een lege
   diepte leest als "er is niets"; hier staat "hier mag ik niet zonder
   uitnodiging", met de weg ernaartoe (werkplek Bijstand, deel 19).

   EN HET AANTAL GERAAKTE KLANTEN STAAT ER NIET. Bij elk hoofdincident staat wat
   de server erover zegt, en die zegt dat het er één is en niet achthonderd, en
   dat niemand heeft geteld hoeveel klanten er iets van merkten. Die zin wordt
   hier niet nagetypt maar overgenomen. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api;

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + v +
      '</div>' + (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  C.TEKENAARS.vloot = function (el) {
    el.innerHTML = '<h2 class="ckop">De vloot</h2>' +
      '<p class="lead">Alle organisaties in één beeld. Eén externe storing bij achthonderd klanten is één ' +
      'incident en geen achthonderd meldingen -- en hoeveel klanten er iets van merkten, staat er niet, want ' +
      'dat is niet gemeten.</p>' +
      '<div id="vlUit"><div class="leeg">Laden…</div></div>';
    api('vloot').then(function (d) { C.$('#vlUit').innerHTML = vloot(d); vlootBind(); })
      .catch(function (e) { if (!e.stil) C.$('#vlUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  };

  function vloot(d) {
    var u = '<div class="rooster">' +
      tegel('Organisaties', d.tel.organisaties, '', d.tel.actief + ' actief, ' + d.tel.stil + ' stil') +
      tegel('Werkruimtes', d.tel.werkruimtes, '', 'over alle organisaties heen') +
      tegel('Hoofdincidenten', d.tel.hoofdincidenten, d.tel.hoofdincidenten ? 'acc' : '', 'niet per klant geteld') +
      tegel('Met bijstand', d.tel.metBijstand, d.tel.metBijstand ? 'gold' : '', 'een lopende sessie') +
      '</div>';
    if (d.organisatieFout) u += '<div class="kaart"><h3>Het register liet zich niet lezen</h3><p>' +
      esc(d.organisatieFout) + '</p><p class="meta">De rest van dit beeld staat er wel: één stukke bron ' +
      'maakt geen leeg scherm.</p></div>';
    for (var i = 0; i < d.hoofdincidenten.length; i++) {
      var h = d.hoofdincidenten[i];
      u += '<div class="kaart"><h3>' + esc(h.id) + ' · ' + esc(h.naam) + '</h3><p>' + esc(h.wat) + '</p>' +
        '<div class="czegt">' + esc(h.let) + '</div></div>';
    }
    u += '<div class="kaart"><h3>De organisaties</h3><div class="schuif"><table class="ctab"><thead><tr>' +
      '<th>Organisatie</th><th>Modus</th><th>Werkruimtes</th><th>Bijstand</th><th></th></tr></thead><tbody>' +
      d.organisaties.map(function (o) {
        return '<tr><td>' + esc(o.naam) + '<div class="meta">' + esc(o.org) + (o.actief ? '' : ' · stil') + '</div></td>' +
          '<td class="meta">' + esc(o.modus) + '</td><td class="meta">' + o.werkruimtes + '</td>' +
          '<td class="meta">' + (o.bijstand ? esc(o.bijstand.niveau) + ' · ' + esc(o.bijstand.status) : '-') + '</td>' +
          '<td><button class="knop" data-org="' + esc(o.org) + '">Openen</button></td></tr>';
      }).join('') + '</tbody></table></div><div id="vlOrg"></div></div>';
    u += '<div class="kaart"><h3>Wat dit beeld niet kan zien</h3><ul class="h-keten">' +
      d.nietTeZien.map(function (n) {
        return '<li><b>' + esc(n.wat) + '</b><div class="czegt">' + esc(n.waarom) + '</div></li>';
      }).join('') + '</ul><p class="meta">' + esc(d.let) + '</p></div>';
    return u;
  }

  function vlootBind() {
    C.$('#vlUit').querySelectorAll('[data-org]').forEach(function (b) {
      b.onclick = function () {
        api('vloot/organisatie', { org: b.dataset.org }).then(function (o) {
          C.$('#vlOrg').innerHTML = '<div class="h-droog"><b>' + esc(o.naam) + '</b> <span class="meta">' +
            esc(o.org) + ' · ' + esc(o.modus) + '</span>' +
            '<div class="meta h-mt40">Werkruimtes: ' + o.werkruimtes.map(esc).join(', ') +
            ' · zaken: ' + (o.zaken.length || 0) + ' · groepen: ' + o.groepen + '</div>' +
            '<div class="meta">Sessies: ' + o.sessies.length + '</div>' +
            '<div class="h-mt50"><b>Verder kijken kan niet</b></div>' +
            '<div class="czegt">' + esc(o.dieper.waarom) + '</div>' +
            '<div class="meta">' + esc(o.dieper.hoe) + '</div></div>';
        }).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
  }
})();
