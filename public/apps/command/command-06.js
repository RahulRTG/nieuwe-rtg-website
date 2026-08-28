/* RTG Command, deel 6: het beleid en de simulatie.

   HET BELEID IS EEN GEGEVEN, GEEN CODE. Elke regel heeft een versie, een
   herkomst en een reden; terugzetten is de volgende versie en niet het wissen
   van de vorige. Wie een regel met vier ogen wijzigt, doet een VOORSTEL -- en
   kan het niet zelf goedkeuren. Dat wordt op de server afgedwongen, niet hier:
   een grendel die alleen in de knop zit, is er niet.

   DE SIMULATIE STAAT ERNAAST EN NIET ERACHTER. Elke regel heeft een knop
   "proef" die laat zien wat de nieuwe waarde met de routering doet vóórdat hij
   gezet wordt. De proef rekent met een schaduw-beleid en raakt de echte regel
   gegarandeerd niet aan. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api;

  C.TEKENAARS.beleid = function (el) {
    el.innerHTML = '<h2 class="ckop">Beleid</h2>' +
      '<p class="lead">De operationele regels van RTG op één plek, met versies en een knop terug. ' +
      'Zware regels vragen twee paar ogen; de server weigert een goedkeuring van dezelfde persoon die het voorstel deed.</p>' +
      '<div id="bluit"><div class="leeg">Laden…</div></div>';
    laad();
  };

  function laad() {
    api('beleid').then(function (d) {
      document.querySelector('#bluit').innerHTML = teken(d);
      bind();
    }).catch(function (e) { if (!e.stil) document.querySelector('#bluit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  }

  function teken(d) {
    var u = '';
    var open = d.voorstellen.filter(function (v) { return v.status === 'wacht'; });
    if (open.length) {
      u += '<div class="kaart"><h3>Wachten op een tweede paar ogen</h3>';
      for (var i = 0; i < open.length; i++) {
        var v = open[i];
        u += '<div class="lijn"><b>' + esc(v.wat) + '</b>' +
          '<div class="meta">' + esc(String(v.van)) + ' → ' + esc(String(v.naar)) + ' · voorgesteld door ' + esc(v.door) +
          ' op ' + esc(C.tijd(v.at)) + '</div>' +
          '<div class="meta">Reden: ' + esc(v.reden) + '</div>' +
          '<div class="crij h-mt45">' +
          '<input class="veld" data-kr="' + esc(v.id) + '" placeholder="uw oordeel, kort" style="flex:1;min-width:12rem;">' +
          '<button class="knop vol" data-keur="' + esc(v.id) + '" data-ja="1">Goedkeuren</button>' +
          '<button class="knop weg" data-keur="' + esc(v.id) + '">Afwijzen</button></div></div>';
      }
      u += '</div>';
    }

    for (var r = 0; r < d.regels.length; r++) {
      var g = d.regels[r];
      u += '<div class="kaart"><h3>' + esc(g.wat) + '</h3>' +
        '<p class="meta">' + esc(g.id) + ' · versie ' + g.versie + ' van ' + g.versies +
        (g.sinds ? ' · sinds ' + esc(C.tijd(g.sinds)) + ' door ' + esc(g.door) : ' · startwaarde') +
        (g.vierOgen ? ' · vier ogen vereist' : '') + '</p>' +
        '<div class="crij" style="margin-top:0.5rem;align-items:baseline;">' +
        '<b style="font-family:\'Bodoni Moda\',Georgia,serif;font-size:1.4rem;">' + esc(String(g.waarde)) + '</b>' +
        '<span class="meta">' + esc(g.eenheid) + '</span>' +
        '<input class="veld" data-nw="' + esc(g.id) + '" placeholder="nieuwe waarde" style="width:8rem;">' +
        '<input class="veld" data-rd="' + esc(g.id) + '" placeholder="reden" style="flex:1;min-width:11rem;">' +
        '<button class="knop" data-proef="' + esc(g.id) + '">Proef</button>' +
        '<button class="knop vol" data-zet="' + esc(g.id) + '">Zetten</button>' +
        (g.versies > 1 ? '<button class="knop weg" data-terug="' + esc(g.id) + '">Eén terug</button>' : '') +
        '</div><div class="meta" id="proef-' + esc(g.id).replace(/\./g, '_') + '"></div></div>';
    }
    return u;
  }

  function proefvak(id) { return document.querySelector('#proef-' + id.replace(/\./g, '_')); }

  function bind() {
    document.querySelectorAll('[data-proef]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.proef;
        var w = document.querySelector('[data-nw="' + id + '"]').value;
        if (w === '') { C.meld('Vul eerst een nieuwe waarde in.'); return; }
        api('simulatie/beleid', { id: id, waarde: isNaN(Number(w)) ? w : Number(w) }).then(function (d) {
          proefvak(id).innerHTML = '<div style="margin-top:0.5rem;border-top:1px solid var(--line);padding-top:.5rem;">' +
            '<b>Proef zonder te zetten:</b> ' + esc(d.gevolg) +
            (d.risicoWaarschuwing ? '<br><span style="color:var(--acc);">' + esc(d.risicoWaarschuwing) + '</span>' : '') +
            (d.wijzigingen.length ? '<br>' + d.wijzigingen.map(function (x) {
              return esc(x.naam) + ': ' + esc(x.van) + ' → ' + esc(x.naar) + ' (' + x.kandidaten + ' geval(len))'; }).join('<br>') : '') +
            '</div>';
        }).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    document.querySelectorAll('[data-zet]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.zet;
        var w = document.querySelector('[data-nw="' + id + '"]').value;
        var rd = document.querySelector('[data-rd="' + id + '"]').value;
        if (w === '') { C.meld('Vul een nieuwe waarde in.'); return; }
        var waarde = w === 'true' ? true : w === 'false' ? false : isNaN(Number(w)) ? w : Number(w);
        api('beleid/zet', { id: id, waarde: waarde, reden: rd }).then(function (d) {
          C.meld(d.vierOgen ? 'Voorstel ingediend; iemand anders moet het goedkeuren.' : 'Gezet, versie ' + d.versie + '.');
          return C.ververs();
        }).then(laad).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    document.querySelectorAll('[data-terug]').forEach(function (b) {
      b.onclick = function () {
        var reden = prompt('Waarom zet u deze regel terug?');
        if (!reden) return;
        api('beleid/terug', { id: b.dataset.terug, reden: reden })
          .then(function (d) { C.meld('Terug naar versie ' + d.terugNaar + '.'); return C.ververs(); })
          .then(laad).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    document.querySelectorAll('[data-keur]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.keur;
        api('beleid/keur', { voorstel: id, akkoord: b.dataset.ja === '1',
          reden: document.querySelector('[data-kr="' + id + '"]').value })
          .then(function () { C.meld('Beoordeeld.'); return C.ververs(); })
          .then(laad).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
  }

  /* ---- de digitale tweeling ---- */
  C.TEKENAARS.simulatie = function (el) {
    el.innerHTML = '<h2 class="ckop">Simulatie</h2>' +
      '<p class="lead">Wat gebeurt er als het volume verandert? Dit rekent lineair door op de werkelijke aantallen, ' +
      'met een knik in de wachttijd boven 85% bezetting. De aannames staan in de uitslag -- een voorspelling zonder ' +
      'zichtbare aannames is een mening met cijfers eromheen.</p>' +
      '<div class="kaart"><div class="crij">' +
      '<label class="lb" style="margin:0;">Groei %</label><input class="veld" id="simG" value="30" style="width:5.5rem;">' +
      '<label class="lb" style="margin:0;">Plaats (optioneel)</label><input class="veld" id="simP" placeholder="bv. Amsterdam" style="width:11rem;">' +
      '<label class="lb" style="margin:0;">Capaciteit erbij</label><input class="veld" id="simC" value="0" style="width:5.5rem;">' +
      '<button class="knop vol" id="simGa">Reken door</button></div></div><div id="simuit"></div>';
    document.querySelector('#simGa').onclick = function () {
      api('simulatie/watals', { groei: Number(document.querySelector('#simG').value || 0),
        plaats: document.querySelector('#simP').value, capaciteit: Number(document.querySelector('#simC').value || 0) })
        .then(function (d) { document.querySelector('#simuit').innerHTML = simTeken(d); })
        .catch(function (e) { if (!e.stil) C.meld(e.message); });
    };
  };

  function simTeken(d) {
    var u = '<div class="kaart"><h3>' + esc(d.vraag) + '</h3>' +
      '<p>' + (d.knelpunten.length ? 'Knelpunt bij: <b>' + esc(d.knelpunten.join(', ')) + '</b>.' : 'Geen enkel domein komt boven 85% bezetting.') +
      ' Er komen ' + d.extraUitzonderingen + ' extra uitzonderingen bij; dat is ongeveer ' + d.extraMensuren + ' mensuur.</p>' +
      '<p class="meta h-mt50">Model: ' + esc(d.model) + '</p></div>';
    u += '<div class="kaart"><div class="schuif"><table class="ctab"><thead><tr><th>Domein</th><th>Volume nu</th><th>Straks</th>' +
      '<th>Bezetting</th><th>Wachtindex</th><th>Uitzonderingen</th></tr></thead><tbody>';
    for (var i = 0; i < d.regels.length; i++) {
      var r = d.regels[i];
      u += '<tr><td>' + esc(r.domein) + (r.knelpunt ? ' <span class="cniveau hand">knelpunt</span>' : '') + '</td>' +
        '<td>' + r.volume.nu + '</td><td>' + r.volume.straks + '</td>' +
        '<td>' + r.bezetting.nu + '% → ' + r.bezetting.straks + '%</td>' +
        '<td>' + r.wachtindex.nu + ' → ' + r.wachtindex.straks + '</td>' +
        '<td>' + r.uitzonderingen.nu + ' → ' + r.uitzonderingen.straks + '</td></tr>';
    }
    u += '</tbody></table></div></div>';
    u += '<div class="kaart"><h3>De aannames</h3>';
    for (var a = 0; a < d.aannames.length; a++) {
      u += '<div class="lijn"><b>' + esc(d.aannames[a].wat) + '</b><div class="meta">Gevolg: ' + esc(d.aannames[a].gevolg) + '</div></div>';
    }
    u += '</div>';
    return u;
  }
})();
