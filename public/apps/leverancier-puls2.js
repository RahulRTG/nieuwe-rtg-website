/* Genrepols 2 (los script): het draaiboek van vandaag en de week vooruit
   voor de acht dunnere genres. Geprioriteerde, afvinkbare taken met een
   "dit eerst"-advies, een 7-daagse weekstrip op echte agenda-data, een
   drukklaar Draaiboek en Rahul die het hele beeld meekrijgt. Wordt
   aangeroepen vanuit leverancier-puls.js met dezelfde ctx. */
(function () {
  'use strict';
  var GOUD = 'background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem 0.8rem;font-weight:600;font-family:inherit;';
  var STIL = 'background:none;border:1px solid var(--line);border-radius:8px;padding:0.35rem 0.7rem;color:var(--soft);font-family:inherit;font-size:0.72rem;';
  var PRIO = { 1: ['NU', 'var(--gold)'], 2: ['VANDAAG', 'var(--soft)'], 3: ['WEEK', 'var(--soft)'] };

  function bind(el, ctx) {
    var oud = el.querySelector('#zaakPuls2'); if (oud) oud.remove();
    Promise.all([ctx.api('/supplier/puls/plan'), ctx.api('/supplier/puls/blik')]).then(function (rs) {
      if (!rs[0].plan) return;
      var dubbel = el.querySelector('#zaakPuls2'); if (dubbel) dubbel.remove();
      var w = document.createElement('div'); w.id = 'zaakPuls2';
      el.appendChild(w);
      teken(w, rs[0].plan, (rs[1] || {}).blik, ctx);
    }).catch(function () {});
  }

  function teken(w, plan, blik, ctx) {
    var esc = ctx.esc, T = ctx.T;
    var h = '<div class="st-sec" style="margin-top:1.2rem;">' + T('dp.kop', 'Het draaiboek van vandaag') + '</div>';
    h += '<div class="sub" style="border-left:2px solid var(--gold);padding:0.3rem 0 0.3rem 0.7rem;margin-bottom:0.55rem;">' + esc(plan.advies) + '</div>';
    h += plan.taken.map(function (t2) {
      var p = PRIO[t2.prio] || PRIO[3];
      return '<div style="display:flex;align-items:center;gap:0.55rem;border:1px solid var(--line);border-radius:12px;padding:0.45rem 0.6rem;margin-top:0.4rem;' + (t2.klaar ? 'opacity:0.45;' : '') + '">' +
        '<button data-dpklaar="' + esc(t2.id) + '" aria-label="' + T('dp.vink', 'Afvinken') + '" style="' + STIL + 'min-width:2rem;' + (t2.klaar ? 'color:var(--gold);border-color:var(--gold);' : '') + '">' + (t2.klaar ? '✓' : '○') + '</button>' +
        '<span style="font-size:0.8rem;line-height:1.45;flex:1;' + (t2.klaar ? 'text-decoration:line-through;' : '') + '">' + esc(t2.tekst) + '</span>' +
        '<span class="sub" style="font-size:0.6rem;letter-spacing:0.1em;color:' + p[1] + ';">' + T('dp.p' + t2.prio, p[0]) + '</span></div>';
    }).join('');
    if (blik && blik.dagen) {
      h += '<div class="st-sec" style="margin-top:1.1rem;">' + T('dp.week', 'De week vooruit') + '</div>';
      h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:0.3rem;">' + blik.dagen.map(function (d2) {
        return '<div style="border:1px solid var(--line);border-radius:10px;padding:0.4rem 0.2rem;text-align:center;' + (d2.n ? '' : 'opacity:0.45;') + '">' +
          '<span class="sub" style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;">' + esc(d2.dag) + '</span>' +
          '<b style="display:block;font-size:0.95rem;">' + d2.n + '</b></div>';
      }).join('') + '</div>';
      var druk = blik.dagen.filter(function (d2) { return d2.n; });
      if (druk.length) h += '<div class="sub" style="margin-top:0.45rem;line-height:1.5;">' + druk.map(function (d2) {
        return '<b>' + esc(d2.dag) + '</b> ' + esc(d2.items.join(' · '));
      }).join('<br>') + '</div>';
    }
    h += '<div class="row-gap" style="margin-top:0.7rem;"><button id="dpPrint" style="' + GOUD + 'flex:1;">' + T('dp.print', 'Draaiboek (print)') + '</button>' +
      '<button id="dpRahul" style="' + STIL + 'flex:1;">' + T('dp.rahul', 'Rahul plant de dag') + '</button></div>' +
      '<div id="dpRahulUit" class="sub" style="margin-top:0.5rem;white-space:pre-wrap;"></div>';
    w.innerHTML = h;

    w.querySelectorAll('[data-dpklaar]').forEach(function (b) {
      b.addEventListener('click', function () {
        ctx.api('/supplier/puls/plan/klaar', { taakId: b.dataset.dpklaar }).then(function () {
          return ctx.api('/supplier/puls/plan');
        }).then(function (r) { if (r.plan) teken(w, r.plan, blik, ctx); }).catch(function (e) { ctx.toast(e.message); });
      });
    });
    w.querySelector('#dpPrint').addEventListener('click', function () { rapport(plan, blik, ctx); });
    w.querySelector('#dpRahul').addEventListener('click', function () {
      var uit = w.querySelector('#dpRahulUit');
      uit.textContent = ctx.T('ge.rahul.leest', 'Rahul kijkt mee...');
      var vraag = 'Dit is mijn draaiboek van vandaag (' + plan.open + ' taken open): ' +
        plan.taken.filter(function (t2) { return !t2.klaar; }).map(function (t2) { return t2.tekst; }).join(' ') +
        (blik && blik.dagen ? ' De week vooruit: ' + blik.dagen.filter(function (d2) { return d2.n; }).map(function (d2) { return d2.dag + ': ' + d2.items.join(', '); }).join('; ') : '') +
        ' In welke volgorde pak ik dit aan, en wat kan ik vandaag al voorbereiden voor later in de week?';
      ctx.api('/supplier/ai', { q: vraag }).then(function (r) { uit.textContent = r.reply || ''; })
        .catch(function (e) { uit.textContent = ''; ctx.toast(e.message); });
    });
  }

  function rapport(plan, blik, ctx) {
    var esc = ctx.esc, naam = (ctx.S && ctx.S.name) || 'De zaak';
    var kop = function (s) { return '<h2 style="font-size:0.8rem;letter-spacing:0.14em;text-transform:uppercase;color:#7F1634;margin:1.6rem 0 0.5rem;">' + s + '</h2>'; };
    var h = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(naam) + '</title></head>' +
      '<body style="font-family:Georgia,serif;color:#0C0C0B;max-width:46em;margin:2.5em auto;line-height:1.6;">' +
      '<div id="pwrap" style="text-align:right;"><button id="pbtn" type="button" style="padding:0.5rem 1rem;font-family:inherit;">Print / PDF</button></div>' +
      '<style>@media print { #pwrap { display:none; } }</style>' +
      '<h1 style="font-size:1.6rem;margin-bottom:0.2rem;">' + esc(naam) + '</h1>' +
      '<p style="color:#8A8680;margin-top:0;">Draaiboek · ' + new Date().toLocaleDateString('nl-NL') + '</p>' +
      '<p style="border-left:3px solid #857007;padding-left:0.8em;color:#4D4A45;">' + esc(plan.advies) + '</p>' +
      kop('De taken van vandaag') +
      plan.taken.map(function (t2) {
        return '<div style="padding:0.25rem 0;">' + (t2.klaar ? '✓' : '○') + ' ' + esc(t2.tekst) +
          (t2.prio === 1 ? ' <b style="color:#7F1634;">(nu)</b>' : '') + '</div>';
      }).join('') +
      (blik && blik.dagen ? kop('De week vooruit') + blik.dagen.map(function (d2) {
        return '<div style="padding:0.2rem 0;"><b style="text-transform:uppercase;font-size:0.85em;">' + esc(d2.dag) + '</b> · ' +
          (d2.n ? esc(d2.items.join(' · ')) : '<span style="color:#8A8680;">rustig</span>') + '</div>';
      }).join('') : '') +
      '<p style="color:#8A8680;margin-top:2rem;font-size:0.85rem;">Opgesteld in de zaak-app van RTG; vinkjes zijn de stand van dit moment.</p>' +
      '<script>document.getElementById("pbtn").addEventListener("click",function(){window.print();});<\/script></body></html>';
    var b = new Blob([h], { type: 'text/html;charset=utf-8' });
    var u = URL.createObjectURL(b);
    window.open(u, '_blank');
    setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
  }

  window.RTGZaakPuls2 = { bind: bind };
})();
