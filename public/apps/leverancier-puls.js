/* De Genrepols (los script): voor golf, fitclub, beauty, petcare,
   kinderopvang, weddings, marina en alpine -- de meters en signalen van
   vandaag bovenin de eigen backoffice, met een drukklaar Polsrapport en
   een Rahul-knop. Gebonden vanuit deel 22 (backoffice) met ctx
   { api, T, esc, toast, S }; genres met een eigen plus-laag krijgen
   van de server geen pols en zien dit blok dus nooit. */
(function () {
  'use strict';
  var GOUD = 'background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem 0.8rem;font-weight:600;font-family:inherit;';
  var STIL = 'background:none;border:1px solid var(--line);border-radius:8px;padding:0.35rem 0.7rem;color:var(--soft);font-family:inherit;font-size:0.72rem;';

  function bind(el, ctx) {
    var api = ctx.api, T = ctx.T, esc = ctx.esc, toast = ctx.toast, S = ctx.S;
    var oud = el.querySelector('#zaakPuls'); if (oud) oud.remove();
    api('/supplier/puls').then(function (r) {
      if (!r.puls) return;
      var dubbel = el.querySelector('#zaakPuls'); if (dubbel) dubbel.remove();
      var w = document.createElement('div'); w.id = 'zaakPuls';
      el.appendChild(w);
      teken(w, r.puls, ctx);
    }).catch(function () {});
  }

  function teken(w, p, ctx) {
    var esc = ctx.esc, T = ctx.T;
    var h = '<div class="st-sec" style="margin-top:1.2rem;">' + T('pu.kop', 'De pols van vandaag') + '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr));gap:0.5rem;">' +
      p.meters.map(function (m) {
        return '<div style="border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.05rem;display:block;">' + esc(String(m[1])) + '</b><span class="sub">' + esc(m[0]) + '</span></div>';
      }).join('') + '</div>';
    if ((p.signalen || []).length) {
      h += '<div style="border:1px solid var(--gold);border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.6rem;">' +
        p.signalen.map(function (s) { return '<div class="sub" style="padding:0.15rem 0;">&#9670; ' + esc(s.tekst) + '</div>'; }).join('') + '</div>';
    } else {
      h += '<p class="sub" style="margin-top:0.5rem;">' + T('pu.rust', 'Geen signalen; de dag loopt zoals hij hoort.') + '</p>';
    }
    h += '<div class="row-gap" style="margin-top:0.7rem;"><button id="puRapport" style="' + GOUD + 'flex:1;">' + T('pu.rapport', 'Polsrapport (print)') + '</button>' +
      '<button id="puRahul" style="' + STIL + 'flex:1;">' + T('ge.rahul', 'Rahul denkt mee') + '</button></div>' +
      '<div id="puRahulUit" class="sub" style="margin-top:0.5rem;white-space:pre-wrap;"></div>';
    w.innerHTML = h;

    w.querySelector('#puRapport').addEventListener('click', function () { rapport(p, ctx); });
    w.querySelector('#puRahul').addEventListener('click', function () {
      var uit = w.querySelector('#puRahulUit');
      uit.textContent = T('ge.rahul.leest', 'Rahul kijkt mee...');
      var vraag = 'Dit is de pols van mijn zaak vandaag: ' +
        p.meters.map(function (m) { return m[0] + ': ' + m[1]; }).join(', ') +
        ((p.signalen || []).length ? '. Signalen: ' + p.signalen.map(function (s) { return s.tekst; }).join(' ') : '. Geen signalen.') +
        ' Wat verdient vandaag als eerste aandacht?';
      ctx.api('/supplier/ai', { q: vraag }).then(function (r) { uit.textContent = r.reply || ''; })
        .catch(function (e) { uit.textContent = ''; ctx.toast(e.message); });
    });
  }

  function rapport(p, ctx) {
    var esc = ctx.esc, naam = (ctx.S && ctx.S.name) || 'De zaak';
    var h = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(naam) + '</title></head>' +
      '<body style="font-family:Georgia,serif;color:#0C0C0B;max-width:46em;margin:2.5em auto;line-height:1.6;">' +
      '<div id="pwrap" style="text-align:right;"><button id="pbtn" type="button" style="padding:0.5rem 1rem;font-family:inherit;">Print / PDF</button></div>' +
      '<style>@media print { #pwrap { display:none; } }</style>' +
      '<h1 style="font-size:1.6rem;margin-bottom:0.2rem;">' + esc(naam) + '</h1>' +
      '<p style="color:#8A8680;margin-top:0;">Polsrapport · ' + new Date().toLocaleDateString('nl-NL') + '</p>' +
      '<h2 style="font-size:0.8rem;letter-spacing:0.14em;text-transform:uppercase;color:#7F1634;margin:1.6rem 0 0.5rem;">De meters van vandaag</h2>' +
      '<table style="border-collapse:collapse;">' + p.meters.map(function (m) {
        return '<tr><td style="padding:0.3rem 0.6rem 0.3rem 0;color:#4D4A45;">' + esc(m[0]) + '</td><td style="padding:0.3rem 0;font-weight:600;">' + esc(String(m[1])) + '</td></tr>';
      }).join('') + '</table>' +
      ((p.signalen || []).length ? '<h2 style="font-size:0.8rem;letter-spacing:0.14em;text-transform:uppercase;color:#7F1634;margin:1.6rem 0 0.5rem;">Signalen</h2>' +
        p.signalen.map(function (s) { return '<div style="padding:0.2rem 0;">&#9670; ' + esc(s.tekst) + '</div>'; }).join('') : '<p>Geen signalen vandaag.</p>') +
      '<p style="color:#8A8680;margin-top:2rem;font-size:0.85rem;">Opgesteld in de zaak-app van RTG; de stand van dit moment.</p>' +
      '<script>document.getElementById("pbtn").addEventListener("click",function(){window.print();});<\/script></body></html>';
    var b = new Blob([h], { type: 'text/html;charset=utf-8' });
    var u = URL.createObjectURL(b);
    window.open(u, '_blank');
    setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
  }

  window.RTGZaakPuls = { bind: bind };
})();
