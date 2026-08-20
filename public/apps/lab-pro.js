/* Onderzoekslab, de professionele laag: KPI-band, fase-strook per project,
   rustige toast-meldingen (geen alert-popups) en een kennisbank-zoekveld.
   Zelfvoorzienend deel: injecteert zijn eigen kleine stijl en hangt zich aan
   de elementen die lab.html neerzet. */
(function () {
  'use strict';
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  var stijl = document.createElement('style');
  stijl.textContent =
    '.labkpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr));gap:.6rem;}' +
    '.labkpi{background:var(--card);border:1px solid var(--line);border-radius:0;padding:.7rem .85rem;}' +
    '.labkpi b{display:block;font-family:"Bodoni Moda",serif;font-weight:500;font-size:1.5rem;line-height:1.1;}' +
    '.labkpi span{font-size:.64rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);}' +
    '.labkpi.let b{color:var(--gold);}' +
    '.faseband{display:flex;align-items:center;gap:.3rem;flex-wrap:wrap;margin:.3rem 0 .1rem;}' +
    '.faseband .fs{font-size:.58rem;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--line);border-radius:0;padding:.1rem .5rem;color:var(--soft,rgba(244,241,236,0.55));}' +
    '.faseband .fs.was{color:var(--gold);border-color:var(--gold);}' +
    '.faseband .fs.nu{background:var(--gold);color:#000;border-color:var(--gold);font-weight:600;}' +
    '.labmeld{position:fixed;left:50%;bottom:1.4rem;transform:translateX(-50%) translateY(1rem);background:#000;color:var(--txt,#F4F1EC);border:1px solid var(--gold);border-radius:0;padding:.6rem 1.1rem;font-size:.86rem;z-index:80;opacity:0;transition:opacity .25s,transform .25s;max-width:min(92vw,30rem);text-align:center;}' +
    '.labmeld.aan{opacity:1;transform:translateX(-50%) translateY(0);}';
  document.head.appendChild(stijl);

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
