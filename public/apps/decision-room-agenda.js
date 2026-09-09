(function (w) {
  'use strict';
  function compleet(x) {
    var velden = [x.titel, x.reden, x.aanvragerLabel, Number(x.impact) > 0, Number(x.risico) > 0];
    return { aantal: velden.filter(Boolean).length, totaal: velden.length };
  }
  function geld(n) {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
  }
  function datum(v) {
    if (!v) return 'Geen deadline';
    var d = new Date(v), tijd = d.getTime();
    return Number.isFinite(tijd) ? d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' }) : String(v);
  }
  function teken(root, staat, gekozen) {
    var U = w.DecisionRoomUtil, lijst = (staat.goedkeuringen || []).filter(function (x) { return x.status === 'wacht'; });
    var dag = root.querySelector('#drDag');
    dag.textContent = 'Vandaag · ' + lijst.length + (lijst.length === 1 ? ' besluit vraagt aandacht' : ' besluiten vragen aandacht');
    var vak = root.querySelector('#drAgenda');
    if (!lijst.length) {
      vak.innerHTML = '<div class="dr-leeg"><h2>De agenda is rustig.</h2><p>Er ligt geen echt voorstel op menselijke beoordeling te wachten.</p><button class="dr-primair" type="button" data-dr-nieuw>Leg een besluit voor</button></div>';
      return null;
    }
    var focus = lijst.find(function (x) { return String(x.id) === String(gekozen || ''); }) || lijst[0], c = compleet(focus);
    var klaar = c.aantal === c.totaal;
    var html = '<article class="dr-focus"><div class="dr-focusbody"><div class="dr-focusmeta"><span class="dr-label ' + (klaar ? 'klaar' : 'wacht') + '">' + (klaar ? 'Besluitrijp' : 'Nog niet compleet') + '</span><span>' + U.veilig(focus.type || 'operations') + ' · ' + U.veilig(focus.aanvragerLabel || 'aanvrager onbekend') + '</span></div>' +
      '<h2>' + U.veilig(focus.titel) + '</h2><p>' + U.veilig(focus.reden) + '</p><div class="dr-focusvoet"><small>' + U.veilig(datum(focus.deadline)) + '<br>' + c.aantal + ' van ' + c.totaal + ' kerngegevens compleet</small><button class="dr-primair" type="button" data-dr-kies="' + U.veilig(focus.id) + '">Open volledige afweging →</button></div></div>' +
      '<div class="dr-focusstats"><div class="dr-focusstat"><small>Impact</small><b>' + Number(focus.impact || 0) + ' / 5</b></div><div class="dr-focusstat"><small>Risico</small><b>' + Number(focus.risico || 0) + ' / 5</b></div><div class="dr-focusstat"><small>Financieel</small><b>' + geld(focus.bedrag) + '</b></div></div></article>';
    var daarna = lijst.filter(function (x) { return x.id !== focus.id; });
    html += '<div class="dr-sectiekop"><h2>Daarna</h2><button type="button" data-dr-open="archief">Open besluitregister</button></div><div class="dr-lijst">';
    html += daarna.length ? daarna.map(function (x, i) {
      var v = compleet(x), gereed = v.aantal === v.totaal;
      return '<button class="dr-rij" type="button" data-dr-kies="' + U.veilig(x.id) + '"><span class="dr-nummer">' + String(i + 2).padStart(2, '0') + '</span><span><b>' + U.veilig(x.titel) + '</b><small>' + U.veilig(x.type || 'operations') + ' · ' + U.veilig(x.aanvragerLabel || 'aanvrager onbekend') + '</small></span><span class="dr-rijstatus"><strong>' + (gereed ? 'Afwegen' : 'Wacht') + '</strong><small>' + v.aantal + ' van ' + v.totaal + ' compleet</small></span></button>';
    }).join('') : '<div class="dr-leeg">Hierna staat geen ander besluit te wachten.</div>';
    vak.innerHTML = html + '</div>';
    return focus.id;
  }
  w.DecisionRoomAgenda = Object.freeze({ teken: teken, compleet: compleet });
}(window));
