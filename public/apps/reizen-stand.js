/* LAAG 0 EN 3 VAN TRAVELOS: de stand en de lijn van vandaag, op het RTG
   Design System.

   Dit bestand tekent ze zelf, met dezelfde regels als shared/canvas.js:
   zonder meting staat er Onbekend en geen cijfers, elk niveau draagt een
   teken, wachten kleurt het woord niet, en een punt zonder uur krijgt geen
   verzonnen tijd. canvas.js tekent .cv-klassen waar het Design System geen
   vorm voor heeft; zodra hij een ds-weergave kent, hoort dit tekenwerk terug
   naar hem (TRAVELOS-MIGRATIE.md, open punt). De WOORDEN komen wel uit de
   gedeelde laag: RTGCanvas.zin en .groet uit canvas-taal.js. */
(function (w, d) {
  'use strict';
  var R = w.RTGReizen; if (!R) return;
  var $ = R.$;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g,
    function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var T = function (k, nl) { return (w.RTGi18n && w.RTGi18n.t) ? w.RTGi18n.t(k, nl) : nl; };
  var SOORT = { verblijf: 'Verblijf', reis: 'Reis', vlucht: 'Vlucht', charter: 'Charter' };
  var TEKENS = { verstoord: '!', aandacht: '!', gezond: '✓', onbekend: '?' };
  var VANDAAG = new Date().toISOString().slice(0, 10);

  /* Laag 0: het oordeel komt uit de wereld mee (d.stand); dit kiest alleen de
     drie cijfers. Wachten is geen aandacht, dus wachtend kleurt het woord niet. */
  function tekenStand(d, aantalReizen) {
    var s = d.stand && typeof d.stand === 'object' ? d.stand : null;
    var niveau = s && TEKENS[s.niveau] && s.niveau !== 'onbekend' ? s.niveau : 'onbekend';
    var woord = niveau !== 'onbekend' && s.woord ? s.woord : T('canvas.onbekend', 'Onbekend');
    var t = d.telling || {}, n = aantalReizen == null ? (t.komend || 0) : aantalReizen;
    var cijfers = s ? [[n, n === 1 ? 'reis gepland' : 'reizen gepland'], [t.aandacht || 0, 'vraagt actie'],
      [t.wachtend || 0, 'wacht op bevestiging']] : [];
    var el = $('#stand');
    el.dataset.niveau = niveau;
    el.innerHTML = '<p class="ds-label">RTG Reizen</p><p class="ds-detail__status">' + esc(woord) +
      ' <span aria-hidden="true">' + TEKENS[niveau] + '</span></p>' +
      (cijfers.length ? '<p class="ds-meta">' + cijfers.map(function (c) { return '<b>' + esc(c[0]) + '</b> ' + esc(c[1]); }).join(' · ') + '</p>' : '');
    rust(w.RTGCanvas && w.RTGCanvas.zin ? w.RTGCanvas.zin(d.stand, { stil: d.stil }) : '');
  }
  function rust(zin) {
    var kop = w.RTGCanvas && w.RTGCanvas.groet ? w.RTGCanvas.groet() : '';
    $('#rust').innerHTML = (kop ? '<h3 class="ds-kaart__titel">' + esc(kop) + '</h3>' : '') + (zin ? '<p class="ds-meta">' + esc(zin) + '</p>' : '');
  }

  /* Laag 3: alleen wat een vertrektijd kent staat op de lijn, op tijd. */
  function opDeKlok(x) { return x.van === VANDAAG && !!x.tijd; }
  function lijn(punten) {
    $('#vandaag').innerHTML = punten.map(function (p) {
      var binnen = '<span class="ds-lijst__tijd">' + esc(p.uur || '-') + '</span><span><span class="ds-lijst__titel">' + esc(p.titel) +
        '</span>' + (p.toe ? '<span class="ds-lijst__tekst">' + esc(p.toe) + '</span>' : '') + '</span><span></span>';
      return '<li>' + (p.href ? '<a class="ds-lijst__rij" href="' + esc(p.href) + '"' + (p.sig ? ' data-sig="' + esc(p.sig) + '"' : '') + '>' + binnen + '</a>'
        : '<span class="ds-lijst__rij">' + binnen + '</span>') + '</li>';
    }).join('');
  }
  function tekenVandaag(r) {
    var punten = r.filter(opDeKlok).sort(function (a, b) { return String(a.tijd).localeCompare(String(b.tijd)); });
    $('#vandaagVak').hidden = !punten.length;
    $('#telVandaag').textContent = punten.length ? punten.length + (punten.length === 1 ? ' moment' : ' momenten') : '';
    lijn(punten.map(function (x) { return { uur: x.tijd, sig: x.sig, href: x.link,
      titel: (x.titel || SOORT[x.soort] || 'Reis') + (x.bestemming ? ' naar ' + x.bestemming : ''),
      toe: x.status ? x.app + ' · ' + x.status : x.app }; }));
    return r.filter(function (x) { return !opDeKlok(x); });
  }
  /* reizen-performance-reis.js tekent dezelfde lijn uit de wereldstand. */
  w.tekenCanvasVandaag = function (lijst) { return tekenVandaag(lijst || []); };
  R.stand = { tekenStand: tekenStand, rust: rust, tekenVandaag: tekenVandaag, opDeKlok: opDeKlok };
})(window, document);
