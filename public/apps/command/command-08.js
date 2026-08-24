/* RTG Command, deel 8: de werkbesparing en het journaal -- de twee spiegels.

   HET WERKBESPARINGSBORD IS BEWUST HET SCHERM WAAROP DEZE APP KAN ZAKKEN. Als
   de handminuten per duizend handelingen niet dalen, dan is er geen
   automatisering bijgekomen maar een dashboard. Daarom staat de onzekerheid van
   de meter erbij: de minutenprijzen zijn schattingen, en dat hoort een lezer te
   weten voordat hij er beleid op maakt.

   HET JOURNAAL is de andere spiegel: niet wat we van plan waren, maar wat er
   werkelijk gebeurde -- met de oude en de nieuwe toestand, de actor en de
   reden. De ketencontrole staat er bovenaan, want een auditspoor waarvan je de
   heelheid niet kunt nakijken, is een lijst die je op zijn woord moet geloven. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api;

  C.TEKENAARS.werk = function (el) {
    el.innerHTML = '<h2 class="ckop">Werkbesparing</h2>' +
      '<p class="lead">Deze app bestaat niet om duizend medewerkers een scherm te geven, maar om ervoor te zorgen ' +
      'dat er geen duizend nodig zijn. Dit is de meter waarop die belofte zichtbaar wordt -- of zichtbaar breekt.</p>' +
      '<div id="wkuit"><div class="leeg">Laden…</div></div>';
    api('werk', { dagen: 30 }).then(function (d) {
      document.querySelector('#wkuit').innerHTML = wkTeken(d.bord, d.opbrengst);
    }).catch(function (e) { if (!e.stil) document.querySelector('#wkuit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  };

  function wkTeken(b, opbrengst) {
    var u = '<div class="rooster">' +
      '<div class="tegel"><div class="l">Handminuten per 1.000</div><div class="v">' + b.handminutenPer1000 + '</div><div class="u">over ' + b.handelingen + ' handelingen in ' + b.dagen + ' dagen</div></div>' +
      '<div class="tegel"><div class="l">Automatiseringsgraad</div><div class="v ' + (b.automatiseringsgraad >= 50 ? 'groen' : 'gold') + '">' + b.automatiseringsgraad + '%</div><div class="u">aandeel dat volledig autonoom liep</div></div>' +
      '<div class="tegel"><div class="l">Handwerk</div><div class="v">' + b.handUren + ' u</div><div class="u">' + b.bespaardeUren + ' uur niet gedaan doordat de machine het deed</div></div>' +
      '<div class="tegel"><div class="l">Lekken</div><div class="v ' + (b.lekken.length ? 'acc' : 'groen') + '">' + b.lekken.length + '</div><div class="u">werkstromen met volume die nog nooit autonoom liepen</div></div>' +
      '</div>';

    u += '<div class="kaart"><h3>Per werkstroom</h3><div class="schuif"><table class="ctab"><thead><tr>' +
      '<th>Handeling</th><th>Aantal</th><th>Handmatig</th><th>Assisted</th><th>Autonoom</th><th>Handuren</th><th>Graad</th></tr></thead><tbody>';
    for (var i = 0; i < b.werkstromen.length; i++) {
      var w = b.werkstromen[i];
      u += '<tr><td>' + esc(w.actie) + (w.lek ? ' <span class="cniveau hand">lek</span>' : '') + '</td>' +
        '<td>' + w.aantal + '</td><td>' + w.perNiveau.hand + '</td><td>' + w.perNiveau.assist + '</td>' +
        '<td>' + w.perNiveau.auto + '</td><td>' + w.handUren + '</td><td>' + w.automatiseringsgraad + '%</td></tr>';
    }
    if (!b.werkstromen.length) u += '<tr><td colspan="7" class="meta">Er is in deze periode nog niets genoteerd.</td></tr>';
    u += '</tbody></table></div><p class="meta h-mt70">' + esc(b.onzeker) + '</p></div>';

    if (b.kandidaten.length) {
      u += '<div class="kaart"><h3>Kandidaten voor de volgende ronde</h3>';
      for (var k = 0; k < b.kandidaten.length; k++) {
        u += '<div class="lijn"><b>' + esc(b.kandidaten[k].oorzaak) + ' → ' + esc(b.kandidaten[k].besluit) + '</b>' +
          '<div class="meta">' + esc(b.kandidaten[k].voorstel) + '</div></div>';
      }
      u += '</div>';
    }

    u += '<div class="kaart"><h3>Wat elk runbook oplevert</h3><div class="schuif"><table class="ctab"><thead><tr>' +
      '<th>Runbook</th><th>Gevallen</th><th>Niveau</th><th>Besparing</th><th>Wat het tegenhoudt</th></tr></thead><tbody>';
    for (var o = 0; o < opbrengst.length; o++) {
      var r = opbrengst[o];
      u += '<tr><td>' + esc(r.naam) + '</td><td>' + r.kandidaten + '</td><td>' + C.niveau(r.niveau) + '</td>' +
        '<td>' + r.besparingUren + ' u</td><td class="meta">' + esc(r.blokkade || 'niets -- dit loopt autonoom') + '</td></tr>';
    }
    u += '</tbody></table></div></div>';
    return u;
  }

  /* ---- het journaal, met de configuratietijdlijn erboven ----
     De tijdlijn staat hier omdat hij dezelfde vraag beantwoordt, een stap
     breder: het journaal ziet wat er via Command ging, de tijdlijn voegt de
     schakelkast en de noodstand toe. Wat geen van beide ziet, staat erbij. */
  C.TEKENAARS.journaal = function (el) {
    el.innerHTML = '<h2 class="ckop">Journaal</h2>' +
      '<p class="lead">Iedere menselijke én automatische handeling, met de oude en de nieuwe toestand, de actor, ' +
      'de reden en de gebruikte regel. Elke regel draagt de hash van de vorige; wie er middenin iets wijzigt, ' +
      'breekt de keten en dat is hieronder te zien.</p>' +
      '<div class="crij"><button class="knop" id="jrTl">Wat is er het laatste uur veranderd?</button>' +
      '<span class="meta">Journaal, schakelkast en noodstand op één lijn.</span></div>' +
      '<div id="jrtl"></div>' +
      '<div id="jruit"><div class="leeg">Laden…</div></div>';
    document.querySelector('#jrTl').onclick = function () {
      var vak = document.querySelector('#jrtl');
      if (vak.innerHTML) { vak.innerHTML = ''; return; }
      vak.innerHTML = '<div class="leeg">Lezen…</div>';
      api('tijdlijn/rondom', { moment: new Date().toISOString(), minuten: 60 })
        .then(function (d) { vak.innerHTML = C.tijdlijnBlok(d); })
        .catch(function (e) { if (!e.stil) vak.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
    };
    api('journaal', { n: 80 }).then(function (d) {
      document.querySelector('#jruit').innerHTML = jrTeken(d);
    }).catch(function (e) { if (!e.stil) document.querySelector('#jruit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  };

  /* Gedeeld met de incidentwerkplek, die dezelfde vraag stelt over het moment
     waarop een storing begon. De zin over volgorde en oorzaak komt van de
     SERVER en wordt hier niet nagetypt; anders lopen de twee uiteen. */
  C.tijdlijnBlok = function (d) {
    var u = '<div class="kaart"><h3>Vlak hiervoor veranderd</h3>' +
      '<p class="meta">' + d.aantal + ' regel(s) in ' + d.venster.minuten + ' minuten voor ' +
      esc(C.tijd(d.moment)) + ', waarvan ' + d.veranderdeIets + ' werkelijk iets veranderde.</p>';
    u += '<ul class="h-keten">' + (d.regels.length ? d.regels.map(function (r) {
      return '<li><span class="cniveau geen">' + esc(r.bron) + '</span> ' +
        '<b>' + r.secondenVoor + ' s eerder</b> · ' + esc(r.wat) +
        ' <span class="meta">' + esc(r.wie || '') +
        (r.status ? ' · ' + esc(r.status) : '') +
        (r.veranderdeIets === false ? ' · veranderde niets' : '') + '</span></li>';
    }).join('') : '<li class="meta">Niets in dit venster.</li>') + '</ul>';
    u += '<div class="czegt">' + esc(d.let) + '</div>';
    u += '<p class="meta"><b>Buiten beeld:</b></p><ul class="h-keten">' + d.buitenBeeld.map(function (b) {
      return '<li>' + esc(b.wat) + '<div class="czegt">' + esc(b.waarom) + '</div></li>';
    }).join('') + '</ul></div>';
    return u;
  };

  function jrTeken(d) {
    var u = '<div class="kaart"><h3>De keten</h3><p>' +
      (d.keten.heel
        ? 'Heel: ' + d.keten.regels + ' regels in het venster sluiten op elkaar aan. In totaal zijn er ' + d.aantal + ' regels genoteerd.'
        : 'BREUK bij regel ' + esc(d.keten.bij) + ': ' + esc(d.keten.waarom)) +
      '</p><p class="meta h-mt40">Dit bewijst dat de regels in het venster onderling kloppen. ' +
      'Het bewijst niet dat er niets vóór het venster is verdwenen -- daarvoor telt het totaal onafhankelijk mee.</p></div>';
    u += '<div class="kaart"><div class="schuif"><table class="ctab"><thead><tr><th>Wanneer</th><th>Wie</th><th>Wat</th>' +
      '<th>Niveau</th><th>Object</th><th>Voor → na</th><th>Reden</th></tr></thead><tbody>';
    for (var i = 0; i < d.regels.length; i++) {
      var r = d.regels[i];
      u += '<tr><td class="meta">' + esc(C.tijd(r.at)) + '</td><td>' + esc(r.actor) + '</td>' +
        '<td>' + esc(r.actie) + (r.uitslag !== 'gedaan' ? ' <span class="meta">(' + esc(r.uitslag) + ')</span>' : '') + '</td>' +
        '<td>' + C.niveau(r.niveau) + (r.risico != null ? ' <span class="meta">' + r.risico + '</span>' : '') + '</td>' +
        '<td class="meta">' + esc(r.objectType ? r.objectType + ' ' + r.objectId : '-') + '</td>' +
        '<td class="meta">' + esc(kort(r.voor)) + ' → ' + esc(kort(r.na)) + '</td>' +
        '<td class="meta">' + esc(r.reden) + '</td></tr>';
    }
    if (!d.regels.length) u += '<tr><td colspan="7" class="meta">Nog niets genoteerd.</td></tr>';
    u += '</tbody></table></div></div>';
    return u;
  }

  function kort(v) {
    if (v == null) return '-';
    if (typeof v !== 'object') return String(v);
    var s = Object.keys(v).map(function (k) { return k + '=' + v[k]; }).join(', ');
    return s.length > 90 ? s.slice(0, 90) + '…' : s;
  }
})();
