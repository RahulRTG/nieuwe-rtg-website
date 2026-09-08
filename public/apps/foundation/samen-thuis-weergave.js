/* Samen Thuis toont uitsluitend wat de bestaande gezinsroutes teruggeven.
   Een lege agenda wordt dus geen verzonnen schooldag en een profiel krijgt
   nooit een geraden locatie of aanwezigheid. */
(function (w) {
  'use strict';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]; }); }
  function kleur(t) { return /^#[0-9a-f]{6}$/i.test(String(t || '')) ? t : '#d7c6a7'; }
  function opKleur(hex) {
    var h = kleur(hex).slice(1), rgb = [0, 2, 4].map(function (i) { var v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    var l = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]; return 1.05 / (l + .05) >= (l + .05) / .05 ? '#fff' : '#102322';
  }
  function lokaal(d) { return new Intl.DateTimeFormat('nl-NL', { weekday:'short', day:'numeric', month:'short' }).format(new Date(d + 'T12:00:00')); }
  function dagKort(d) { return new Intl.DateTimeFormat('nl-NL', { weekday:'short' }).format(new Date(d + 'T12:00:00')).replace('.', ''); }
  function dagNummer(d) { return new Date(d + 'T12:00:00').getDate(); }
  function icoon(naam) { return '<i data-glyf="' + naam + '"></i>'; }
  function vulGlyf(el) { try { if (w.RTGGlyf) w.RTGGlyf.vul(el); } catch (e) {} }
  function vandaag(staat) {
    var box = document.getElementById('stVandaag');
    var dag = staat.vandaag, uit = [];
    (staat.agenda || []).filter(function (x) { return x.datum === dag; }).forEach(function (x) {
      uit.push({ tijd:x.tijd || 'Vandaag', icoon:x.bron === 'school' ? 'diploma' : 'agenda', titel:x.titel,
        bij:x.wieNaam || 'Het hele gezin', soort:x.bron === 'school' ? 'Van school' : 'Geregeld' });
    });
    (staat.klussen || []).filter(function (x) { return x.status !== 'goedgekeurd'; }).slice(0, 2).forEach(function (x) {
      uit.push({ tijd:'Taak', icoon:'logboek', titel:x.titel, bij:x.voorNaam || 'Iedereen',
        soort:x.status === 'gedaan' ? 'Wacht op akkoord' : 'Open' });
    });
    var eten = (staat.keuken.dagen || []).find(function (x) { return x.datum === dag && x.gerecht; });
    if (eten) uit.push({ tijd:'Eten', icoon:'table', titel:eten.gerecht, bij:eten.kokNaam ? eten.kokNaam + ' kookt' : 'Samen eten', soort:'Gepland' });
    if (!uit.length) {
      box.innerHTML = '<div class="st-leeg">Er staat vandaag nog niets gezamenlijks. U kunt de dag zo laten of <button type="button" data-st-leeg-regel>iets regelen</button>.</div>';
    } else {
      box.innerHTML = uit.slice(0, 7).map(function (x) {
        return '<div class="st-moment"><time>' + esc(x.tijd) + '</time><span class="st-moment__icoon">' + icoon(x.icoon) + '</span>' +
          '<div><small>' + esc(x.soort) + '</small><b>' + esc(x.titel) + '</b><span>' + esc(x.bij) + '</span></div>' +
          '<em class="st-status">' + esc(x.soort) + '</em></div>';
      }).join('');
    }
    vulGlyf(box);
  }
  function dagen(staat, gekozen) {
    var box = document.getElementById('stDagen');
    box.innerHTML = (staat.dagen || []).map(function (d) {
      return '<button type="button" data-st-dag="' + d + '" class="' + (d === gekozen ? 'is-actief' : '') + '" aria-pressed="' + (d === gekozen) + '"><span>' + esc(dagKort(d)) + '</span><b>' + dagNummer(d) + '</b></button>';
    }).join('');
  }
  function ochtendVan(staat, pid) { return (staat.ochtend.bord || []).find(function (x) { return x.pid === pid; }); }
  function afspraakVan(staat, pid, gekozen) {
    return (staat.agenda || []).filter(function (x) { return x.datum === gekozen && x.wie === pid; })
      .sort(function (a, b) { return String(a.tijd || '99:99').localeCompare(String(b.tijd || '99:99')); })[0] || null;
  }
  function gezin(staat, gekozen) {
    var box = document.getElementById('stGezin');
    if (!staat.profielen.length) { box.innerHTML = '<div class="st-leeg">Er zijn nog geen gezinsleden zichtbaar voor dit profiel.</div>'; return; }
    box.innerHTML = staat.profielen.map(function (p) {
      var a = afspraakVan(staat, p.id, gekozen), o = ochtendVan(staat, p.id);
      var regel = a ? ((a.tijd ? a.tijd + ' · ' : '') + a.titel) : 'Geen eigen afspraak op ' + lokaal(gekozen);
      var status = o && o.heeftRitme ? (o.klaar ? 'Ochtend klaar' : o.gedaan + ' van ' + o.totaal + ' ochtendstappen') : 'Geen ochtendstatus';
      return '<article class="st-persoon"><span class="st-avatar" style="background:' + kleur(p.kleur) + ';color:' + opKleur(p.kleur) + '">' + esc(String(p.naam || '?').slice(0, 1).toUpperCase()) + '</span>' +
        '<div><b>' + esc(p.naam) + '</b><span>' + esc(regel) + '</span><small>' + esc(status) + '</small></div></article>';
    }).join('');
  }
  function geregeld(staat) {
    var box = document.getElementById('stGeregeld'), open = (staat.klussen || []).filter(function (x) { return x.status !== 'goedgekeurd'; }).length;
    var boodschappen = (staat.keuken.lijst || []).filter(function (x) { return !x.af; }).length;
    var eten = (staat.keuken.dagen || []).find(function (x) { return x.datum === staat.vandaag && x.gerecht; });
    box.innerHTML = '<a class="st-regel" href="keuken.html">' + icoon('table') + '<div><b>' + (eten ? esc(eten.gerecht) : 'Nog geen avondeten gekozen') + '</b><span>' + (boodschappen ? boodschappen + ' open op de boodschappenlijst' : 'Boodschappenlijst is leeg') + '</span></div><em>→</em></a>' +
      '<a class="st-regel" href="klusjes.html">' + icoon('logboek') + '<div><b>' + (open ? open + (open === 1 ? ' open taak' : ' open taken') : 'Geen open taken') + '</b><span>Bekijk wat het gezin samen oppakt</span></div><em>→</em></a>' +
      '<a class="st-regel" href="agenda.html">' + icoon('agenda') + '<div><b>Gezinsagenda</b><span>' + (staat.agenda.length ? staat.agenda.length + ' afspraakregels in de komende dagen' : 'Nog geen afspraken in de komende dagen') + '</span></div><em>→</em></a>';
    vulGlyf(box);
  }
  function profielen(staat) {
    var html = '<option value="">Het hele gezin</option>' + staat.profielen.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.naam) + '</option>'; }).join('');
    document.getElementById('stWie').innerHTML = html;
  }
  function alles(staat, gekozen) { vandaag(staat); dagen(staat, gekozen); gezin(staat, gekozen); geregeld(staat); profielen(staat); }
  w.RTGSamenThuisWeergave = { alles:alles, dagen:dagen, gezin:gezin };
})(window);
