/* DE REISWACHT en DE OPLOSSER (REIZEN.md fase 3 en 5), op het Design System.

   Stond als inline script in reizen.html; het gedrag is gelijk. Drie stukken,
   in deze volgorde: de signalen (alleen die), de rustzin als er niets is, en
   ALTIJD de bronnenregel eronder, ook de bronnen die stilvielen of niet
   bestaan. Wie "alles rustig" leest, ziet in dezelfde oogopslag met hoeveel
   ogen er gekeken is. Een wacht die stuk is, is STUK: geen leeg vak.

   De oplosser haalt voorstellen op en voert NIETS uit; alleen een taak-voorstel
   heeft een eigen knop, en die zet na een klik een taak in de eigen agenda.
   Boeken en betalen gebeurt in het domein. De grens komt van de server. */
(function (w, d) {
  'use strict';
  var R = w.RTGReizen; if (!R) return;
  var $ = R.$;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g,
    function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var TEKEN = { incident: '!', aandacht: '\u25B3' };

  function laadWacht() {
    var el = $('#wacht');
    return R.api('/api/reis/wacht', {}).then(function (dt) {
      var blokken = (dt.reizen || []).filter(function (r) { return r.signalen.length; }).map(function (r) {
        return '<article class="ds-kaart"><div class="ds-kaart__inhoud"><h3 class="ds-kaart__titel">' + esc(r.bestemming) + '</h3>' +
          r.signalen.map(function (s) {
            return '<p class="ds-detail__status" data-ernst="' + esc(s.ernst) + '">' + TEKEN[s.ernst] + ' ' + esc(s.tekst) + '</p>' +
              '<p class="ds-meta">Bron: ' + esc(s.bron) + ' &middot; ' + esc(s.grond) + '</p>';
          }).join('') +
          '<div><button class="ds-knop ds-knop--stil ds-knop--klein" type="button" data-los="' + esc(r.id) + '" data-ds-actie="Los het op">Los het op</button></div>' +
          '<div class="ds-taak__kop" data-losuit="' + esc(r.id) + '"></div></div></article>';
      });
      if ((dt.stil || []).length) blokken.push('<p class="ds-meta">Let op: de bron' +
        (dt.stil.length === 1 ? '' : 'nen') + ' ' + dt.stil.map(esc).join(', ') +
        ' deed' + (dt.stil.length === 1 ? '' : 'en') + ' niet mee. Dit beeld is onvolledig.</p>');
      var rust = blokken.length ? '' : '<p class="ds-meta">Er speelt op dit moment niets rond uw reizen.</p>';
      var bronnen = (dt.bronnen || []).map(function (b) {
        return '<span data-stand="' + esc(b.stand) + '">' +
          (b.stand === 'gemeten' ? '\u25CF' : b.stand === 'stil' ? '\u25CB' : '\u2014') + ' ' +
          esc(b.naam) + (b.stand === 'gemeten' ? '' : ': ' + esc(b.uitleg)) + '</span>';
      }).join('<br>');
      el.innerHTML = rust + blokken.join('') + '<p class="ds-meta">' + esc(dt.uitleg || '') + '</p>' +
        '<p class="ds-meta">' + bronnen + '</p>';
      R.$$('[data-los]', el).forEach(function (b) { b.addEventListener('click', function () { losOp(b); }); });
    }).catch(function (e) {
      el.innerHTML = '<p class="ds-meta">' + esc(e.message || 'De reiswacht gaf geen antwoord.') + ' Dit betekent niet dat er niets speelt.</p>';
    });
  }

  function voorstel(v, reis) {
    if (v.soort === 'taak') return '<div class="ds-chips"><button class="ds-knop ds-knop--primair ds-knop--klein" type="button" data-doe="' +
      esc(v.id) + '" data-reis="' + esc(reis) + '">' + esc(v.tekst) + '</button><span class="ds-meta">' + esc(v.uitleg || '') + '</span></div>';
    if (v.soort === 'alternatief') return '<p class="ds-meta">&rarr; <a href="' + esc(v.link) + '">' + esc(v.tekst) + '</a>' +
      (v.kosten ? ' &middot; ' + new Intl.NumberFormat(R.taal(), { style: 'currency', currency: 'EUR' }).format(v.kosten.bedrag) + ' p.p.' : '') +
      ' &middot; ' + esc(v.uitleg || '') + '</p>';
    if (v.soort === 'nakijken') return '<p class="ds-meta">&rarr; <a href="' + esc(v.link) + '">' + esc(v.tekst) + '</a></p>';
    return '<p class="ds-meta">' + esc(v.tekst) + '</p>';
  }

  function losOp(knop) {
    var vak = $('#wacht').querySelector('[data-losuit="' + knop.dataset.los + '"]');
    if (!vak) return;
    knop.disabled = true;
    vak.innerHTML = '<p class="ds-meta">Kijken wat er kan...</p>';
    R.api('/api/reis/los', { reisId: knop.dataset.los }).then(function (dt) {
      vak.innerHTML = dt.blokken.map(function (b) { return b.voorstellen.map(function (v) { return voorstel(v, knop.dataset.los); }).join(''); }).join('') +
        '<p class="ds-meta">' + esc(dt.grens || '') + '</p>';
      R.$$('[data-doe]', vak).forEach(function (b) { b.addEventListener('click', function () {
        b.disabled = true;
        R.api('/api/reis/los/doe', { reisId: b.dataset.reis, voorstel: b.dataset.doe }).then(function (r) {
          b.outerHTML = '<span class="ds-meta">' + (r.al ? 'Deze taak stond al in uw agenda.' : 'De taak staat in uw agenda.') +
            ' <a href="' + esc(r.link) + '">Naar de agenda</a></span>';
          laadWacht();
        }).catch(function (e) { b.disabled = false; b.textContent = e.message; });
      }); });
    }).catch(function (e) { vak.innerHTML = '<p class="ds-meta">' + esc(e.message) + '</p>'; knop.disabled = false; });
  }

  R.laadWacht = laadWacht;
  laadWacht();
})(window, document);
