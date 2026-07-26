/* RTG Agenda, het tekenen: de maand als raster, de week als zeven
   kolommen, de lijst gegroepeerd per dag. Dit bestand weet niets van de
   server; het krijgt afspraken (met de ecosysteem-laag er al bij) en
   tekent ze. De bediening woont in app.js, het afspraak-paneel in
   paneel.js.

   Levert window.RTGAgendaKal. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var DAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
  var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
    'augustus', 'september', 'oktober', 'november', 'december'];
  var iso = function (d) { return d.toISOString().slice(0, 10); };
  var vanIso = function (s) { return new Date(s + 'T12:00:00Z'); };
  var plusDagen = function (s, n) { var d = vanIso(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  // maandag als eerste dag, zoals een agenda hoort
  var maandagVan = function (s) { var d = vanIso(s); var w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return iso(d); };

  function chip(x, klik) {
    var klas = 'chip' + (x.bron === 'boeking' ? ' eco' : '') +
      (x.status === 'uitgenodigd' ? ' uit' : '') + (x.status === 'nee' ? ' nee' : '');
    // een optionele kleur (bijv. het gezinslid in de RTF-agenda) kleurt de rand
    var stijl = /^#[0-9A-Fa-f]{3,8}$/.test(x.kleur || '') ? ' style="border-color:' + x.kleur + '"' : '';
    return '<span class="' + klas + '"' + stijl + ' data-klik="' + esc(klik) + '" title="' + esc(x.titel) + '">' +
      (x.tijd ? '<b>' + x.tijd + '</b> ' : '') + esc(x.titel) + '</span>';
  }

  function perDag(alles) {
    var m = {};
    alles.forEach(function (x, i) {
      x._i = i;
      (m[x.datum] = m[x.datum] || []).push(x);
    });
    return m;
  }

  function maand(host, anker, alles, opDag, vandaag) {
    var d = vanIso(anker); d.setUTCDate(1);
    var eerste = iso(d);
    var start = maandagVan(eerste);
    var kaart = perDag(alles);
    var h = '<div class="mgrid">' + DAGEN.map(function (n) { return '<div class="mkop">' + n + '</div>'; }).join('');
    var dag = start;
    for (var i = 0; i < 42; i++) {
      var rij = kaart[dag] || [];
      var buiten = dag.slice(0, 7) !== eerste.slice(0, 7);
      h += '<button type="button" class="mdag' + (buiten ? ' buiten' : '') + (dag === vandaag ? ' vandaag' : '') +
        '" data-dag="' + dag + '" aria-label="' + dag + '">' +
        '<span class="dnr">' + +dag.slice(8) + '</span>' +
        rij.slice(0, 3).map(function (x) { return chip(x, x._i); }).join('') +
        (rij.length > 3 ? '<span class="meer">nog ' + (rij.length - 3) + '&hellip;</span>' : '') +
        '</button>';
      dag = plusDagen(dag, 1);
      // zes rijen is genoeg voor elke maand; de 42 hierboven is precies dat
    }
    host.innerHTML = h + '</div>';
    haakKlik(host, alles, opDag);
    return MAANDEN[vanIso(eerste).getUTCMonth()] + ' ' + eerste.slice(0, 4);
  }

  function week(host, anker, alles, opDag, vandaag) {
    var start = maandagVan(anker);
    var kaart = perDag(alles);
    var h = '<div class="wgrid">';
    for (var i = 0; i < 7; i++) {
      var dag = plusDagen(start, i);
      h += '<div class="wdag"><div class="mkop"' + (dag === vandaag ? ' style="color:var(--gold)"' : '') + '>' +
        DAGEN[i] + ' ' + +dag.slice(8) + '</div>' +
        (kaart[dag] || []).map(function (x) { return chip(x, x._i); }).join('') +
        '<button type="button" class="mdag" data-dag="' + dag + '" style="min-height:1.4rem;background:none;" aria-label="Nieuw op ' + dag + '"></button></div>';
    }
    host.innerHTML = h + '</div>';
    haakKlik(host, alles, opDag);
    var eind = plusDagen(start, 6);
    return +start.slice(8) + ' ' + MAANDEN[vanIso(start).getUTCMonth()].slice(0, 3) + ' t/m ' +
      +eind.slice(8) + ' ' + MAANDEN[vanIso(eind).getUTCMonth()].slice(0, 3) + ' ' + eind.slice(0, 4);
  }

  function lijst(host, anker, alles, opDag, vandaag) {
    var kaart = perDag(alles);
    var dagen = Object.keys(kaart).sort();
    var h = dagen.map(function (dag) {
      var d = vanIso(dag);
      var kop = (dag === vandaag ? 'vandaag · ' : '') +
        ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'][(d.getUTCDay() + 6) % 7] +
        ' ' + d.getUTCDate() + ' ' + MAANDEN[d.getUTCMonth()];
      return '<div class="ldag"><h3>' + kop + '</h3>' + kaart[dag].map(function (x) {
        return '<div class="litem' + (x.bron === 'boeking' ? ' eco' : '') + '" data-klik="' + x._i + '" role="button" tabindex="0">' +
          '<span class="tijd">' + (x.tijd ? x.tijd + (x.eind ? '&ndash;' + x.eind : '') : 'hele dag') + '</span>' +
          '<span class="wat"><b>' + esc(x.titel) + '</b><small>' +
          (x.plek ? esc(x.plek) + ' · ' : '') +
          (x.van ? 'uitnodiging van ' + esc(x.van) + ' · ' : '') +
          (x.status && x.bron !== 'boeking' ? 'u zei: ' + esc(x.status === 'uitgenodigd' ? 'nog niets' : x.status) : '') +
          '</small></span>' +
          (x.bron === 'boeking' ? '<span class="bron">uit RTG</span>' : '') + '</div>';
      }).join('') + '</div>';
    }).join('');
    host.innerHTML = h || '<p class="stil">Niets gepland in deze periode. Dat is ook een agenda-stand.</p>';
    haakKlik(host, alles, opDag);
    return 'Komende dertig dagen';
  }

  function haakKlik(host, alles, opDag) {
    Array.prototype.forEach.call(host.querySelectorAll('[data-klik]'), function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        opDag.item(alles[+el.dataset.klik]);
      });
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-dag]'), function (el) {
      el.addEventListener('click', function () { opDag.dag(el.dataset.dag); });
    });
  }

  window.RTGAgendaKal = { maand: maand, week: week, lijst: lijst,
    iso: iso, plusDagen: plusDagen, maandagVan: maandagVan };
})();
