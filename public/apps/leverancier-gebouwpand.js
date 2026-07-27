/* RTG Enterprise -- het hele pand (los script): installaties met
   keuringsbewaking, de mailroom, parkeerplekken en BHV-oefeningen.
   Gebonden vanuit renderGebouw (deel 45) met ctx { api, T, esc, toast },
   direct na RTGZaakGebouw; eigen wortel #gePand naast #gePlus. */
(function () {
  'use strict';
  var IN = 'class="st-in"';
  var GOUD = 'background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem 0.8rem;font-weight:600;font-family:inherit;';
  var STIL = 'background:none;border:1px solid var(--line);border-radius:8px;padding:0.35rem 0.7rem;color:var(--soft);font-family:inherit;font-size:0.72rem;';
  var NAAM_INST = { lift: 'Lift', klimaat: 'Klimaat', brandmeld: 'Brandmeld', noodverlichting: 'Noodverlichting', toegang: 'Toegang', zonwering: 'Zonwering' };

  function bind(el, ctx) {
    var T = ctx.T, esc = ctx.esc, api = ctx.api, toast = ctx.toast;
    var oud = el.querySelector('#gePand'); if (oud) oud.remove();
    var w = document.createElement('div'); w.id = 'gePand';
    el.appendChild(w);
    laad();
    function laad() {
      api('/supplier/gebouwpand/overzicht').then(teken).catch(function (e) {
        w.innerHTML = '<p class="sub">' + esc(e.message) + '</p>';
      });
    }

    function teken(p) {
      var vandaag = new Date().toISOString().slice(0, 10);
      var h = '<div class="st-sec" style="margin-top:1.2rem;">' + T('gp.kop', 'Het hele pand') + '</div>';
      if ((p.signalen || []).length) {
        h += '<div style="border:1px solid var(--gold);border-radius:12px;padding:0.6rem 0.8rem;">' +
          p.signalen.map(function (s) { return '<div class="sub" style="padding:0.15rem 0;">&#9670; ' + esc(s.tekst) + '</div>'; }).join('') + '</div>';
      }

      h += '<div class="st-sec" style="margin-top:0.9rem;">' + T('gp.inst', 'Installaties en keuringen') + '</div>' +
        '<div class="row-gap"><select id="gpISoort" ' + IN + ' style="flex:1;">' +
        (p.soorten || []).map(function (s) { return '<option value="' + s + '">' + (NAAM_INST[s] || s) + '</option>'; }).join('') + '</select>' +
        '<input id="gpINaam" ' + IN + ' placeholder="' + T('gp.i.naam', 'Naam (bijv. Lift A)') + '" maxlength="60" style="flex:2;">' +
        '<input id="gpIDatum" ' + IN + ' type="date" style="flex:1;">' +
        '<button id="gpINieuw" style="' + GOUD + 'flex:1;">' + T('gp.i.leg', 'Leg vast') + '</button></div>';
      h += (p.installaties || []).map(function (i) {
        var te = i.keuringTot < vandaag;
        return '<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">' +
          '<b style="flex:1;font-size:0.84rem;">' + esc(i.naam) + '</b><span class="sub">' + (NAAM_INST[i.soort] || i.soort) + ' · ' +
          T('gp.i.tot', 'keuring t/m') + ' <span style="' + (te ? 'color:var(--burgundy-on-dark,#C23A5E);' : '') + '">' + esc(i.keuringTot) + '</span></span>' +
          '<button data-gpkeur="' + i.id + '" style="' + STIL + '">' + T('gp.i.herkeur', 'Herkeurd') + '</button></div>';
      }).join('') || '<p class="sub">' + T('gp.i.geen', 'Nog geen installaties vastgelegd.') + '</p>';

      h += '<div class="st-sec" style="margin-top:1rem;">' + T('gp.post', 'Mailroom') + '</div>' +
        '<div class="row-gap"><input id="gpPVoor" ' + IN + ' placeholder="' + T('gp.p.voor', 'Voor welke huurder') + '" maxlength="60" style="flex:2;">' +
        '<input id="gpPWat" ' + IN + ' placeholder="' + T('gp.p.wat', 'Wat (pakket, aangetekend...)') + '" maxlength="80" style="flex:2;">' +
        '<button id="gpPNieuw" style="' + GOUD + 'flex:1;">' + T('gp.p.aan', 'Neem aan') + '</button></div>';
      h += (p.post || []).filter(function (x) { return x.status === 'aangekomen'; }).map(function (x) {
        return '<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">' +
          '<b style="flex:1;font-size:0.84rem;">' + esc(x.voorWie) + '</b><span class="sub">' + esc(x.omschrijving) + ' · ' + esc(x.dag) + '</span>' +
          '<button data-gppost="' + x.id + '" style="' + STIL + '">' + T('gp.p.klaar', 'Opgehaald') + '</button></div>';
      }).join('') || '<p class="sub">' + T('gp.p.geen', 'De mailroom is leeg.') + '</p>';

      h += '<div class="st-sec" style="margin-top:1rem;">' + T('gp.park', 'Parkeren') + '</div>' +
        '<div class="row-gap"><input id="gpKPlek" ' + IN + ' placeholder="P1-04" maxlength="12" style="flex:1;">' +
        '<input id="gpKWie" ' + IN + ' placeholder="' + T('gp.k.wie', 'Huurder (leeg = vrij)') + '" maxlength="60" style="flex:2;">' +
        '<button id="gpKZet" style="' + GOUD + 'flex:1;">' + T('gp.k.zet', 'Wijs toe') + '</button></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-top:0.5rem;">' +
        (p.parkeer || []).map(function (x) {
          return '<span title="' + esc(x.huurder || T('gp.k.vrij', 'vrij')) + '" style="border:1px solid ' + (x.huurder ? 'var(--burgundy,#7F1634)' : 'var(--line)') + ';border-radius:8px;padding:0.25rem 0.55rem;font-size:0.72rem;color:' + (x.huurder ? 'inherit' : 'var(--soft)') + ';">' + esc(x.plek) + '</span>';
        }).join('') + '</div>';

      h += '<div class="st-sec" style="margin-top:1rem;">' + T('gp.bhv', 'BHV en ontruiming') + '</div>' +
        '<div class="row-gap"><input id="gpBDag" ' + IN + ' type="date" style="flex:1;">' +
        '<input id="gpBOp" ' + IN + ' type="number" min="0" max="100" placeholder="' + T('gp.b.op', 'Opkomst %') + '" style="flex:1;">' +
        '<input id="gpBPunt" ' + IN + ' placeholder="' + T('gp.b.punt', 'Verbeterpunten') + '" maxlength="300" style="flex:3;">' +
        '<button id="gpBLeg" style="' + GOUD + 'flex:1;">' + T('gp.b.leg', 'Leg vast') + '</button></div>';
      h += (p.bhv || []).slice(0, 5).map(function (o) {
        return '<div class="sub" style="padding:0.25rem 0;border-bottom:1px solid var(--line);">' + esc(o.dag) + ' · ' + o.opkomst + '% ' + T('gp.b.opkomst', 'opkomst') + (o.verbeterpunten ? ' · ' + esc(o.verbeterpunten) : '') + '</div>';
      }).join('');
      w.innerHTML = h;
      knoppen();
    }

    function knoppen() {
      var q = function (s) { return w.querySelector(s); };
      q('#gpINieuw').addEventListener('click', function () {
        api('/supplier/gebouwpand/installatie', { soort: q('#gpISoort').value, naam: q('#gpINaam').value, keuringTot: q('#gpIDatum').value })
          .then(laad).catch(function (e) { toast(e.message); });
      });
      w.querySelectorAll('[data-gpkeur]').forEach(function (b) {
        b.addEventListener('click', function () {
          var tot = prompt(T('gp.i.nieuw', 'Nieuwe keuringsdatum (jjjj-mm-dd):')); if (!tot) return;
          api('/supplier/gebouwpand/installatie/keuring', { id: b.dataset.gpkeur, keuringTot: tot })
            .then(laad).catch(function (e) { toast(e.message); });
        });
      });
      q('#gpPNieuw').addEventListener('click', function () {
        api('/supplier/gebouwpand/post', { voorWie: q('#gpPVoor').value, omschrijving: q('#gpPWat').value })
          .then(laad).catch(function (e) { toast(e.message); });
      });
      w.querySelectorAll('[data-gppost]').forEach(function (b) {
        b.addEventListener('click', function () {
          api('/supplier/gebouwpand/post/opgehaald', { id: b.dataset.gppost }).then(laad).catch(function (e) { toast(e.message); });
        });
      });
      q('#gpKZet').addEventListener('click', function () {
        api('/supplier/gebouwpand/parkeer', { plek: q('#gpKPlek').value, huurder: q('#gpKWie').value })
          .then(laad).catch(function (e) { toast(e.message); });
      });
      q('#gpBLeg').addEventListener('click', function () {
        api('/supplier/gebouwpand/bhv', { dag: q('#gpBDag').value, opkomst: q('#gpBOp').value, verbeterpunten: q('#gpBPunt').value })
          .then(laad).catch(function (e) { toast(e.message); });
      });
    }
  }

  window.RTGZaakPand = { bind: bind };
})();
