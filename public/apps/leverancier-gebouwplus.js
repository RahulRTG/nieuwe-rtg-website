/* RTG Enterprise (los script): 3D-toren, signalen, huurcontracten met
   verloopbewaking, leads, energietrend en een Rahul-knop. Gebonden vanuit
   renderGebouw (deel 45) met ctx { api, T, esc, toast, eur, d };
   d = het /supplier/gebouw-overzicht. Rapport: -gebouwrapport.js. */
(function () {
  'use strict';
  var K = 'border:1px solid var(--line);border-radius:12px;padding:0.8rem;';
  var IN = 'class="st-in"';
  var GOUD = 'background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem 0.8rem;font-weight:600;font-family:inherit;';
  var STIL = 'background:none;border:1px solid var(--line);border-radius:8px;padding:0.35rem 0.7rem;color:var(--soft);font-family:inherit;font-size:0.72rem;';

  function toren(d, esc) {
    // de toren in 3D: elke verdieping een plak; verhuurd kleurt bordeaux
    var bezet = {};
    (d.huurders || []).forEach(function (h) { (h.verdiepingen || []).forEach(function (v) { bezet[v] = h.naam; }); });
    var n = d.vloeren || 1, h = '';
    for (var i = n; i >= 1; i--) {
      var wie = bezet[i];
      h += '<div title="' + esc('Verdieping ' + i + (wie ? ' · ' + wie : ' · vrij')) + '" style="position:absolute;left:0;right:0;height:11px;bottom:' + ((i - 1) * 13) + 'px;transform:rotateX(55deg) rotateZ(-45deg);border-radius:2px;' +
        (wie ? 'background:var(--burgundy,#7F1634);opacity:0.9;' : 'background:none;border:1px solid var(--line);opacity:0.7;') + '"></div>';
    }
    return '<div style="display:flex;gap:1.2rem;align-items:flex-end;">' +
      '<div style="position:relative;width:120px;height:' + (n * 13 + 30) + 'px;perspective:600px;flex:0 0 120px;">' + h + '</div>' +
      '<div class="sub h-flex1">' + esc(d.naam || '') + ' · ' + n + ' verdiepingen · ' + (d.kpi ? d.kpi.bezetting : 0) + '% verhuurd<br>' +
      'Bordeaux is verhuurd; een open plak is vrij. Beweeg eroverheen voor de huurder.</div></div>';
  }

  function bind(el, ctx) {
    var T = ctx.T, esc = ctx.esc, api = ctx.api, toast = ctx.toast, eur = ctx.eur, d = ctx.d || {};
    var oud = el.querySelector('#gePlus'); if (oud) oud.remove();
    var w = document.createElement('div'); w.id = 'gePlus';
    el.appendChild(w);
    api('/supplier/gebouwplus/overzicht').then(function (p) { teken(p); }).catch(function (e) {
      w.innerHTML = '<p class="sub">' + esc(e.message) + '</p>';
    });

    function teken(p) {
      var h = '<div class="st-sec h-mt120">' + T('ge.kop', 'RTG Enterprise') + '</div>';
      h += '<div style="' + K + '">' + toren(d, esc) + '</div>';

      if ((p.signalen || []).length) {
        h += '<div style="' + K + 'margin-top:0.6rem;border-color:var(--gold);">' +
          p.signalen.map(function (s) { return '<div class="sub" style="padding:0.15rem 0;">&#9670; ' + esc(s.tekst) + '</div>'; }).join('') + '</div>';
      }

      h += '<div class="st-sec h-mt100">' + T('ge.contract', 'Huurcontracten') + '</div>' +
        '<div class="row-gap"><input id="geCH" ' + IN + ' placeholder="' + T('ge.c.huurder', 'Huurder') + '" maxlength="60" style="flex:2;">' +
        '<input class="h-flex1" id="geCV" ' + IN + ' placeholder="' + T('ge.c.verd', 'Verd. (bijv. 4+5)') + '" maxlength="30">' +
        '<input class="h-flex1" id="geCM" ' + IN + ' type="number" min="1" placeholder="' + T('ge.c.huur', 'Maandhuur') + '"></div>' +
        '<div class="row-gap h-mt40"><input class="h-flex1" id="geCS" ' + IN + ' type="date"><input class="h-flex1" id="geCE" ' + IN + ' type="date">' +
        '<button id="geCNieuw" style="' + GOUD + 'flex:1;">' + T('ge.c.leg', 'Leg vast') + '</button></div>';
      h += (p.contracten || []).map(function (c) {
        return '<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">' +
          '<b style="flex:1;font-size:0.84rem;">' + esc(c.huurder) + '</b><span class="sub">' + esc(c.verdiepingen || '') + ' · ' + eur(c.maandhuur) + '/mnd · t/m ' + esc(c.eind) + ' · ' + esc(c.status) + '</span>' +
          (c.status === 'actief' ? '<button data-geverleng="' + c.id + '" style="' + STIL + '">' + T('ge.c.verleng', 'Verleng') + '</button>' +
            '<button data-gebeeindig="' + c.id + '" style="' + STIL + '">' + T('ge.c.stop', 'Beeindig') + '</button>' : '') + '</div>';
      }).join('') || '<p class="sub">' + T('ge.c.geen', 'Nog geen contracten vastgelegd.') + '</p>';

      h += '<div class="st-sec h-mt100">' + T('ge.leads', 'Leads voor vrije verdiepingen') + '</div>' +
        '<div class="row-gap"><input id="geLN" ' + IN + ' placeholder="' + T('ge.l.naam', 'Kandidaat-huurder') + '" maxlength="60" style="flex:2;">' +
        '<input id="geLW" ' + IN + ' placeholder="' + T('ge.l.wens', 'Wens (m2, verdieping, wanneer)') + '" maxlength="160" style="flex:3;">' +
        '<button id="geLNieuw" style="' + GOUD + 'flex:1;">' + T('ge.l.leg', 'Voeg toe') + '</button></div>';
      h += (p.leads || []).map(function (l) {
        return '<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--line);padding:0.35rem 0;">' +
          '<b style="flex:1;font-size:0.84rem;">' + esc(l.naam) + '</b><span class="sub">' + esc(l.wens || '') + ' · sinds ' + esc(l.sinds) + '</span>' +
          p.fasen.map(function (f) {
            return '<button data-gefase="' + l.id + ':' + f + '" style="' + STIL + (l.fase === f ? 'border-color:var(--gold);color:var(--txt);' : '') + '">' + f + '</button>';
          }).join('') + '</div>';
      }).join('') || '<p class="sub">' + T('ge.l.geen', 'Nog geen leads; de toren verkoopt zichzelf niet.') + '</p>';

      var em = 1;
      (p.energie || []).forEach(function (x) { if (x.stroomKwh > em) em = x.stroomKwh; });
      h += '<div class="st-sec h-mt100">' + T('ge.energie', 'Energie per week') + '</div>' +
        '<div class="row-gap"><input class="h-flex1" id="geEW" ' + IN + ' placeholder="2026-W31" maxlength="8">' +
        '<input class="h-flex1" id="geES" ' + IN + ' type="number" min="0" placeholder="kWh">' +
        '<input class="h-flex1" id="geEA" ' + IN + ' type="number" min="0" placeholder="m3 water">' +
        '<button id="geENieuw" style="' + GOUD + 'flex:1;">' + T('ge.e.leg', 'Noteer') + '</button></div>' +
        '<div style="display:flex;gap:3px;align-items:flex-end;height:56px;margin-top:0.5rem;">' +
        (p.energie || []).slice(0, 16).reverse().map(function (x) {
          return '<div title="' + esc(x.week + ' · ' + x.stroomKwh + ' kWh') + '" style="flex:1;background:var(--burgundy,#7F1634);opacity:0.85;height:' + Math.max(6, Math.round(x.stroomKwh / em * 52)) + 'px;border-radius:2px 2px 0 0;"></div>';
        }).join('') + '</div>';

      h += '<div class="row-gap h-mt90"><button id="geRapport" style="' + GOUD + 'flex:1;">' + T('ge.rapport', 'Gebouwrapport (print)') + '</button>' +
        '<button id="geRahul" style="' + STIL + 'flex:1;">' + T('ge.rahul', 'Rahul denkt mee') + '</button></div><div id="geRahulUit" class="sub" style="margin-top:0.5rem;white-space:pre-wrap;"></div>';
      w.innerHTML = h;
      knoppen(p);
    }

    function ver() { api('/supplier/gebouwplus/overzicht').then(teken).catch(function (e) { toast(e.message); }); }
    function knoppen(p) {
      var q = function (s) { return w.querySelector(s); };
      q('#geCNieuw').addEventListener('click', function () {
        api('/supplier/gebouwplus/contract', { huurder: q('#geCH').value, verdiepingen: q('#geCV').value,
          maandhuur: q('#geCM').value, start: q('#geCS').value, eind: q('#geCE').value })
          .then(ver).catch(function (e) { toast(e.message); });
      });
      w.querySelectorAll('[data-geverleng]').forEach(function (b) {
        b.addEventListener('click', function () {
          var eind = prompt(T('ge.c.tot', 'Verlengen tot (jjjj-mm-dd):')); if (!eind) return;
          api('/supplier/gebouwplus/contract/zet', { id: b.dataset.geverleng, actie: 'verleng', eind: eind })
            .then(ver).catch(function (e) { toast(e.message); });
        });
      });
      w.querySelectorAll('[data-gebeeindig]').forEach(function (b) {
        b.addEventListener('click', function () {
          api('/supplier/gebouwplus/contract/zet', { id: b.dataset.gebeeindig, actie: 'beeindig' })
            .then(ver).catch(function (e) { toast(e.message); });
        });
      });
      q('#geLNieuw').addEventListener('click', function () {
        api('/supplier/gebouwplus/lead', { naam: q('#geLN').value, wens: q('#geLW').value })
          .then(ver).catch(function (e) { toast(e.message); });
      });
      w.querySelectorAll('[data-gefase]').forEach(function (b) {
        b.addEventListener('click', function () {
          var p2 = b.dataset.gefase.split(':');
          api('/supplier/gebouwplus/lead/fase', { id: p2[0], fase: p2[1] }).then(ver).catch(function (e) { toast(e.message); });
        });
      });
      q('#geENieuw').addEventListener('click', function () {
        api('/supplier/gebouwplus/energie', { week: q('#geEW').value, stroomKwh: q('#geES').value, waterM3: q('#geEA').value })
          .then(ver).catch(function (e) { toast(e.message); });
      });
      q('#geRapport').addEventListener('click', function () {
        if (window.RTGGebouwRapport) RTGGebouwRapport.open(d, p, { esc: esc, eur: eur, T: T });
      });
      q('#geRahul').addEventListener('click', function () {
        var uit = q('#geRahulUit'); uit.textContent = T('ge.rahul.leest', 'Rahul kijkt naar het gebouw...');
        var vraag = 'Kijk naar dit kantoorgebouw: ' + (d.kpi ? d.kpi.bezetting : 0) + '% verhuurd, ' +
          (p.contracten || []).filter(function (c) { return c.status === 'actief'; }).length + ' actieve contracten, ' +
          (p.leads || []).length + ' leads, ' + (p.signalen || []).length + ' signalen. Wat verdient deze week aandacht?';
        api('/supplier/ai', { q: vraag }).then(function (r) { uit.textContent = r.reply || ''; })
          .catch(function (e) { uit.textContent = ''; toast(e.message); });
      });
    }
  }

  window.RTGZaakGebouw = { bind: bind };
})();
