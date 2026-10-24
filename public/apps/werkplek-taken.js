/* De taakintake van de campus: één bedoeling houdt haar sleutel bij een
   onzeker antwoord. Laden vóór werkplek-campus.js, beide met defer. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  function teken(model, k, esc) {
    var r = (model.taken || []).filter(function (t) { return (t.afdeling || 'operations') === k.id; });
    return '<div class="work-list" id="campusTaken">' + (r.length ? r.map(function (t) {
      return '<label class="work-row"><input type="checkbox" data-taak="' + esc(t.id) + '"' + (t.af ? ' checked' : '') +
        '><span' + (t.af ? ' class="taak-afgerond"' : '') + '>' + esc(t.tekst) + '</span></label>';
    }).join('') : '<p class="office-empty">Geen open werk op deze tafel.</p>') + '</div>' +
      '<form class="campus-form taakform" id="campusTaakForm"><input id="campusTaak" maxlength="200" placeholder="Nieuw werkpunt" aria-label="Nieuw werkpunt" required>' +
      '<button type="submit">Zet op tafel</button><button type="button" id="campusTaakNieuw">Bewust nieuwe opdracht</button></form>';
  }

  function bind(model, k, verander) {
    $('#campusTaakForm').addEventListener('submit', function (e) {
      e.preventDefault(); var t = $('#campusTaak').value.trim(); if (!t) return;
      var opslag='rtg_werkplek_taak_'+model.code;
      try {
        var idem=sessionStorage.getItem(opslag);
        if(!idem) { idem=crypto.randomUUID(); sessionStorage.setItem(opslag,idem); }
        verander('taak', { bedrijf: model.code, tekst: t, afdeling: k.id, idem: idem });
      } catch(fout) { alert('Opdrachtsleutel kon niet veilig worden bewaard. '+fout.message); }
    });
    $('#campusTaakNieuw').addEventListener('click', function () {
      if(confirm('Een eerdere onzekere opdracht kan al ontvangen zijn. Wilt u bewust een afzonderlijke nieuwe opdracht beginnen?')) sessionStorage.removeItem('rtg_werkplek_taak_'+model.code);
    });
  }
  window.RTGWerkplekTaken = { teken: teken, bind: bind };
})();
