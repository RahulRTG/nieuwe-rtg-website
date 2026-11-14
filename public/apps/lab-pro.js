/* Onderzoekslab, de professionele laag: KPI-band, fase-strook per project,
   rustige toast-meldingen (geen alert-popups) en een kennisbank-zoekveld.
   De presentatie staat centraal in ds/componenten/onderzoekslab.css; dit
   script blijft uitsluitend eigenaar van het bestaande gedrag. */
(function () {
  'use strict';
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  // een rustige melding onderin beeld, in plaats van een alert-popup
  var meldEl = null, meldTimer = null;
  function meld(tekst) {
    if (!meldEl) { meldEl = document.createElement('div'); meldEl.className = 'labmeld'; meldEl.setAttribute('role', 'status'); document.body.appendChild(meldEl); }
    meldEl.textContent = String(tekst || '');
    meldEl.classList.add('aan');
    clearTimeout(meldTimer);
    meldTimer = setTimeout(function () { meldEl.classList.remove('aan'); }, 3200);
  }

  // de KPI-band: het lab in vier cijfers
  function kpi(D, kbTotaal) {
    var el = document.getElementById('labKpi');
    if (!el || !D) return;
    var p = D.projecten || [], fasen = D.fasen || [];
    var verIx = Math.max(0, fasen.indexOf('prototype'));
    var onderweg = p.filter(function (x) { return fasen.indexOf(x.fase) >= verIx; }).length;
    var open = p.filter(function (x) { return !x.veiligheid || x.veiligheid.status !== 'akkoord'; }).length;
    el.innerHTML =
      '<div class="labkpi"><b>' + p.length + '</b><span>Projecten</span></div>' +
      '<div class="labkpi"><b>' + onderweg + '</b><span>Prototype of verder</span></div>' +
      '<div class="labkpi' + (open ? ' let' : '') + '"><b>' + open + '</b><span>Toets open</span></div>' +
      '<div class="labkpi"><b>' + (kbTotaal || 0) + '</b><span>Bevindingen</span></div>';
  }

  // de fase-strook op een projectkaart: waar staat dit werk in de keten?
  function strook(fasen, fase) {
    var ix = (fasen || []).indexOf(fase);
    return '<div class="faseband">' + (fasen || []).map(function (f, i) {
      return '<span class="fs ' + (i < ix ? 'was' : (i === ix ? 'nu' : '')) + '">' + esc(f) + '</span>';
    }).join('') + '</div>';
  }

  // het kennisbank-zoekveld: client-side filteren over alle bevindingen
  function zoekbind(alles, render) {
    var veld = document.getElementById('kbZoek');
    if (!veld || veld.dataset.aan) return;
    veld.dataset.aan = '1';
    veld.addEventListener('input', function () {
      var q = veld.value.trim().toLowerCase();
      var lijst = !q ? alles() : alles().filter(function (b) {
        return (String(b.titel) + ' ' + String(b.tekst || '') + ' ' + String(b.project || '') + ' ' + String(b.veld || '')).toLowerCase().includes(q);
      });
      render(lijst, q);
    });
  }

  window.LabPro = { meld: meld, kpi: kpi, strook: strook, zoekbind: zoekbind };
})();
