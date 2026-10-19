/* Het drukklare Gebouwrapport van RTG Enterprise (los script): een net
   A4-overzicht van het hele huis -- kerncijfers, huurders, contracten,
   leads, energie en open meldingen. Zelfde blob-patroon als het
   Weekrapport: html naar een eigen venster, Print/PDF-knop erin. */
(function () {
  'use strict';
  function open(d, p, ctx) {
    var esc = ctx.esc, eur = ctx.eur, T = ctx.T;
    var k = d.kpi || {};
    var rij = function (l, r) {
      return '<tr><td class="s-fuwtu8">' + l + '</td><td class="s-c40mid">' + r + '</td></tr>';
    };
    var sec = function (t) { return '<h2 class="s-bwc5d4">' + t + '</h2>'; };
    var h = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(d.naam || 'Gebouwrapport') + '</title></head>' +
      '<body style="font-family:Georgia,serif;color:#0C0C0B;max-width:46em;margin:2.5em auto;line-height:1.6;">' +
      '<div id="pwrap" style="text-align:right;"><button id="pbtn" type="button" style="padding:0.5rem 1rem;font-family:inherit;">Print / PDF</button></div>' +
      '<style>@media print { #pwrap { display:none; } }</style>' +
      '<h1 style="font-size:1.6rem;margin-bottom:0.25rem;">' + esc(d.naam || 'Het gebouw') + '</h1>' +
      '<p style="color:#8A8680;margin-top:0;">RTG Enterprise · Gebouwrapport · ' + new Date().toLocaleDateString('nl-NL') + '</p>' +
      sec(T('ge.r.kern', 'Kerncijfers')) + '<table style="border-collapse:collapse;">' +
      rij(T('ge.r.bezetting', 'Bezetting'), (k.bezetting || 0) + '%') +
      rij(T('ge.r.huurders', 'Huurders'), k.huurders || 0) +
      rij(T('ge.r.zalen', 'Zaalboekingen vandaag'), k.zalenVandaag || 0) +
      rij(T('ge.r.meld', 'Open meldingen'), k.openMeldingen || 0) +
      rij(T('ge.r.jetset', 'Jetset-aanvragen open'), k.jetsetOpen || 0) + '</table>';

    h += sec(T('ge.r.huur', 'Huurders per verdieping'));
    h += (d.huurders || []).map(function (x) {
      return '<div class="s-t99ri">' + T('ge.r.verd', 'Verdieping') + ' ' + x.verdiepingen.join(' + ') + ' · <b>' + esc(x.naam) + '</b></div>';
    }).join('') || '<p style="color:#8A8680;">-</p>';

    h += sec(T('ge.contract', 'Huurcontracten'));
    h += (p.contracten || []).map(function (c) {
      return '<div class="s-t99ri"><b>' + esc(c.huurder) + '</b> · ' + esc(c.verdiepingen || '') + ' · ' + eur(c.maandhuur) + '/mnd · ' + esc(c.start) + ' t/m ' + esc(c.eind) + ' · ' + esc(c.status) + '</div>';
    }).join('') || '<p style="color:#8A8680;">' + T('ge.c.geen', 'Nog geen contracten vastgelegd.') + '</p>';

    h += sec(T('ge.leads', 'Leads voor vrije verdiepingen'));
    h += (p.leads || []).map(function (l) {
      return '<div class="s-t99ri"><b>' + esc(l.naam) + '</b> · ' + esc(l.wens || '') + ' · ' + esc(l.fase) + ' (sinds ' + esc(l.sinds) + ')</div>';
    }).join('') || '<p style="color:#8A8680;">-</p>';

    h += sec(T('ge.energie', 'Energie per week'));
    h += '<table style="border-collapse:collapse;width:100%;">' +
      '<tr><th style="text-align:left;padding:0.2rem 0;color:#4D4A45;font-weight:400;">week</th><th style="text-align:right;color:#4D4A45;font-weight:400;">stroom (kWh)</th><th style="text-align:right;color:#4D4A45;font-weight:400;">water (m3)</th></tr>' +
      (p.energie || []).slice(0, 12).map(function (x) {
        return '<tr><td class="s-16jjbd9">' + esc(x.week) + '</td><td class="s-ckjvd1">' + x.stroomKwh + '</td><td class="s-ckjvd1">' + x.waterM3 + '</td></tr>';
      }).join('') + '</table>';

    if ((p.signalen || []).length) {
      h += sec(T('ge.r.signalen', 'Signalen'));
      h += p.signalen.map(function (s) { return '<div class="s-yhw1rz">&#9670; ' + esc(s.tekst) + '</div>'; }).join('');
    }
    h += '<p style="color:#8A8680;margin-top:2rem;font-size:0.85rem;">' + T('ge.r.voet', 'Opgesteld in de zaak-app van RTG; cijfers zijn de stand van dit moment.') + '</p>' +
      '<script>document.getElementById("pbtn").addEventListener("click",function(){window.print();});<\/script></body></html>';

    var b = new Blob([h], { type: 'text/html;charset=utf-8' });
    var u = URL.createObjectURL(b);
    window.open(u, '_blank');
    setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
  }
  window.RTGGebouwRapport = { open: open };
})();
