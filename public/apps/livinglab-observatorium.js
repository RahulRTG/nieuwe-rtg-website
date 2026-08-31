/* RTF Living Lab, scherm: het OBSERVATORIUM -- één bord over de labs heen dat
   kan zakken.

   De vorm volgt de regel uit BESTUUR.md: een cockpit die niet kan zakken is een
   dashboard. Daarom staat de stand van het bord bovenaan en in kleur, staat een
   sein dat NIET te peilen viel er even nadrukkelijk als een storing, en staat er
   geen samengesteld cijfer -- één getal boven zes eerlijke seinen verbergt welk
   ervan bewoog.

   Alles wat hier staat, komt van /api/lab2/observatorium. Dit scherm rekent
   niets zelf uit en kent geen drempels: wat een storing is, bepaalt de server. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var KLASSE = { 'in orde': 'ok', 'niet vast te stellen': 'onbekend', storing: 'storing' };

  function stijl() {
    if (document.getElementById('obsStijl')) return;
    var s = document.createElement('style');
    s.id = 'obsStijl';
    s.textContent =
      '#obs .obs-kop{display:flex;align-items:baseline;gap:.75rem;flex-wrap:wrap;margin-bottom:.9rem;}' +
      '#obs .obs-stand{font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;' +
        'border:1px solid currentColor;padding:.25rem .6rem;}' +
      '#obs .ok{color:#4C9A75;}#obs .onbekend{color:#C9A24B;}#obs .storing{color:#C23A5E;}' +
      '#obs .obs-seinen{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));}' +
      '#obs .sein{border-left:3px solid currentColor;padding:.6rem .8rem;background:rgba(255,255,255,.03);}' +
      '#obs .sein h4{margin:0 0 .2rem;font-size:.95rem;font-weight:600;color:inherit;}' +
      '#obs .sein .aantal{font-family:"Bodoni Moda",serif;font-size:1.8rem;line-height:1.1;}' +
      '#obs .sein p{margin:.35rem 0 0;font-size:.82rem;line-height:1.45;color:var(--rtg-soft,#8A8680);}' +
      '#obs .sein ul{margin:.4rem 0 0;padding-left:1.1rem;font-size:.82rem;color:var(--rtg-soft,#8A8680);}' +
      '#obs .obs-niet{margin-top:.9rem;font-size:.8rem;line-height:1.5;color:var(--rtg-soft,#8A8680);}';
    document.head.appendChild(s);
  }

  /* Een sein toont een AANTAL waar het er een heeft, en anders het bedrag of de
     reden. Waar de server "niet vast te stellen" zegt, komt er geen nul te
     staan: dat is precies het verschil tussen "er is niets" en "we weten het
     niet" (KOSTEN.md par. 1). */
  function sein(s) {
    var kl = KLASSE[s.stand] || 'onbekend';
    var kop = s.nietTeZeggen ? '&mdash;'
      : (s.code === 'geld'
        ? '&euro; ' + (s.toegezegdEuro != null ? s.toegezegdEuro : 0)
        : (s.aantal != null ? s.aantal : '&mdash;'));
    var rijen = (s.studies || s.apparaten || s.conclusies || []).slice(0, 5).map(function (r) {
      return '<li>' + esc(r.nummer || r.apparaat || r.conclusie || '') +
        (r.titel ? ' &middot; ' + esc(r.titel) : '') +
        (r.reden ? ' &middot; ' + esc(r.reden) : '') +
        (r.volgende ? ' &middot; wacht op ' + esc(r.volgende) : '') +
        (r.van ? ' &middot; ' + esc(r.van) + ' &rarr; ' + esc(r.naar) : '') + '</li>';
    }).join('');
    return '<div class="sein ' + kl + '">' +
      '<h4>' + esc(s.naam) + '</h4>' +
      '<div class="aantal">' + kop + '</div>' +
      '<div class="obs-stand ' + kl + '">' + esc(s.stand) + '</div>' +
      (s.code === 'geld' && !s.nietTeZeggen
        ? '<p>toegezegd door leden &middot; gemeten kosten: &euro; ' +
          ((s.gemetenCenten || 0) / 100).toFixed(2).replace('.', ',') +
          ' (' + esc(s.gemetenGraad || 'onbekend') + ')</p>' : '') +
      '<p>' + esc(s.nietTeZeggen || s.wat || '') + '</p>' +
      (rijen ? '<ul>' + rijen + '</ul>' : '') +
    '</div>';
  }

  function teken(doel, b) {
    stijl();
    if (!doel) return;
    if (!b || !b.ok) { doel.innerHTML = '<div class="leeg">' + esc((b && b.error) || 'Het bord is niet te peilen.') + '</div>'; return; }
    var kl = KLASSE[b.stand] || 'onbekend';
    doel.innerHTML =
      '<div class="obs-kop"><span class="obs-stand ' + kl + '">' + esc(b.stand) + '</span>' +
        '<span>' + b.onderzoeken.lopend + ' lopend van ' + b.onderzoeken.totaal +
        ' &middot; ' + b.labs.length + ' lab' + (b.labs.length === 1 ? '' : 's') + '</span></div>' +
      '<div class="obs-seinen">' + (b.seinen || []).map(sein).join('') + '</div>' +
      '<div class="obs-niet">' + (b.zegtNiet || []).map(function (z) { return esc(z); }).join('<br>') + '</div>';
  }

  window.LivingLabObservatorium = { teken: teken };
})();
