/* RTF School, gezinskant: de tweetalige klasgenoot. De thuistaal instellen en
   het schoolwerk in twee talen naast elkaar lezen: de eigen taal erbij, het
   Nederlands blijft staan -- dat is de taal die het kind erbij leert.
   Los deel naast school.html; gebruikt gezinApi (zelfde globale scope). */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var wortel = null;

  async function laad() {
    if (typeof gezinApi !== 'function' || !wortel) return;
    var d;
    try { d = await gezinApi('/school/mijn'); } catch (e) { return; }
    if (!d || !d.school || !d.school.length) { wortel.innerHTML = ''; return; }
    var uit = '';
    d.school.forEach(function (x) {
      // de taalkiezer per kind (taalcode, bijv. en, uk, ar, tr; leeg = alleen NL)
      uit += '<div class="sec">Thuistaal · ' + esc(x.kind.naam) + ' · klas ' + esc(x.klas.code) + '</div><div class="kaart blok">' +
        '<div class="mini" style="margin-bottom:0.5rem;">Kom je uit het buitenland? Zet je eigen taal erbij: je ziet alles dan in twee talen, en het Nederlands leer je er vanzelf bij.</div>' +
        '<div style="display:flex;gap:.4rem;">' +
        '<input class="veld h-flex1" data-taalin="' + esc(x.klas.code) + ':' + esc(x.kind.profielId) + '" value="' + esc(x.taal || '') + '" placeholder="Taalcode (en, uk, ar, tr, ...)" maxlength="5">' +
        '<button class="knop mini" data-taalzet="' + esc(x.klas.code) + ':' + esc(x.kind.profielId) + '">Bewaar</button></div></div>';
      // de tweetalige weergave: NL en de eigen taal naast elkaar
      if (x.vertaling) {
        var v = x.vertaling, blok = '';
        (x.huiswerk || []).forEach(function (h) {
          var t = v.huiswerk[h.id];
          if (t) blok += '<div style="margin:0.25rem 0;"><b>' + esc(h.titel) + '</b><div class="mini">' + esc(v.taal) + ': ' + esc(t.titel) + '</div></div>';
        });
        (x.mededelingen || []).forEach(function (m) {
          if (v.mededelingen[m.id]) blok += '<div style="margin:0.25rem 0;">' + esc(m.tekst) + '<div class="mini">' + esc(v.taal) + ': ' + esc(v.mededelingen[m.id]) + '</div></div>';
        });
        if (blok) uit += '<div class="sec">In twee talen · ' + esc(x.kind.naam) + '</div><div class="kaart blok">' + blok +
          '<div class="mini">Het Nederlands blijft altijd staan: naast elkaar lezen is hoe je het erbij leert.</div></div>';
      }
    });
    wortel.innerHTML = uit;
    wortel.querySelectorAll('[data-taalzet]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var deel = b.dataset.taalzet.split(':');
        var inp = wortel.querySelector('[data-taalin="' + b.dataset.taalzet + '"]');
        try {
          await gezinApi('/school/taal', { klasCode: deel[0], profielId: deel[1], taal: (inp && inp.value.trim()) || 'nl' });
          laad();
        } catch (e) { b.insertAdjacentHTML('afterend', ' <span class="mini">' + esc(e.message) + '</span>'); }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var na = document.getElementById('schoolExtra') || document.getElementById('schoolLijst');
    if (!na) return;
    wortel = document.createElement('div');
    wortel.id = 'schoolTaal';
    na.parentNode.insertBefore(wortel, na.nextSibling);
    setTimeout(laad, 900); // na de eerste laadGezin en school-extra
  });
})();
