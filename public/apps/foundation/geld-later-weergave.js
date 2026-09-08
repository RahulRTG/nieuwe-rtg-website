/* Geld & Later laat alleen echte potgegevens, echte vacatures en de lokale
   cv-status zien. Geen saldo, voortgang of toekomststap wordt ingevuld als de
   bron dat niet heeft gezegd. */
(function (w) {
  'use strict';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]; }); }
  function euro(c) { return new Intl.NumberFormat('nl-NL', { style:'currency', currency:'EUR' }).format((Number(c) || 0) / 100); }
  function icoon(n) { return '<i data-glyf="' + n + '"></i>'; }
  function glyf(el) { try { if (w.RTGGlyf) w.RTGGlyf.vul(el); } catch (e) {} }
  function maandBeweging(transacties) {
    var nu = new Date();
    return (transacties || []).filter(function (t) { var d = new Date(t.at); return d.getFullYear() === nu.getFullYear() && d.getMonth() === nu.getMonth(); })
      .reduce(function (som, t) { return som + (Number(t.centen) || 0); }, 0);
  }
  function vandaag(staat) {
    var box = document.getElementById('glVandaag');
    if (!staat.potje) {
      box.innerHTML = '<div class="gl-leeg">Uw zakgeldpotje is nu niet bereikbaar. De andere Foundation-routes blijven wel beschikbaar.</div>';
      return;
    }
    var p = staat.potje, doel = (p.doelen || [])[0], maand = maandBeweging(p.transacties);
    var doelTitel = doel ? esc(doel.naam) : 'Nog geen spaardoel';
    var doelRegel = doel ? euro(doel.gespaard) + ' van ' + euro(doel.doelCenten) : 'Begin wanneer u iets wilt bewaren';
    box.innerHTML = '<a class="gl-geldkaart" href="zakgeld.html">' + icoon('wallet') + '<small>Zakgeld</small><b>' + euro(p.saldoCenten) + '</b><span>Vrij in uw potje</span></a>' +
      '<a class="gl-geldkaart" href="zakgeld.html">' + icoon('rekening') + '<small>Spaardoel</small><b>' + doelTitel + '</b><span>' + esc(doelRegel) + '</span></a>' +
      '<a class="gl-geldkaart" href="zakgeld.html">' + icoon('balans') + '<small>Deze maand</small><b>' + (maand === 0 ? 'Geen beweging' : euro(maand)) + '</b><span>' + (maand === 0 ? 'Nog niets geboekt' : (maand > 0 ? 'Meer erbij dan eruit' : 'Meer eruit dan erbij')) + '</span></a>';
    glyf(box);
  }
  function kansen(staat) {
    var box = document.getElementById('glKansen'), aantal = staat.vacatures == null ? null : staat.vacatures.length;
    box.innerHTML = '<div class="gl-kans"><b>' + (aantal == null ? 'Kansen niet geladen' : aantal + (aantal === 1 ? ' actuele kans' : ' actuele kansen')) + '</b><span>' + (aantal == null ? 'Open Werk om opnieuw te proberen' : 'Uit de echte vacaturelijst, passend bij de leeftijdsgroep') + '</span></div>' +
      '<div class="gl-kans"><b>' + (staat.cv.klaar ? 'CV heeft een basis' : (staat.cv.bestaat ? 'CV is begonnen' : 'Nog geen CV')) + '</b><span>' + (staat.cv.klaar ? 'Naam, contact en inhoud zijn ingevuld' : 'Open de CV-maker en bouw rustig verder') + '</span></div>';
  }
  function alles(staat) { vandaag(staat); kansen(staat); }
  w.RTGGeldLaterWeergave = { alles:alles, vandaag:vandaag, kansen:kansen, euro:euro };
})(window);
