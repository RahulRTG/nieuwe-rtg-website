/* RTG School Partner, deel: excursies (tijdelijke GPS met kijklog), de
   vrijwillige ouderbijdrage en de telefoonboom. Laadt voor app.js, hangt
   zichzelf aan window.SPart; app.js roept SPart.excursie() aan in werkbank(). */
(function () {
  'use strict';
  window.SPart = window.SPart || {};
  var $ = function (s) { return document.querySelector(s); };
  var gebonden = false;

  function plekkenHTML(esc, r) {
    var uit = '<div class="stil" style="margin:0.5rem 0;">' + r.plekken.map(function (p) {
      return '<div class="item"><span>' + esc(p.naam) + ' <span class="tag">' + esc(p.rol) + '</span></span>' +
        '<span>' + Number(p.lat).toFixed(4) + ', ' + Number(p.lng).toFixed(4) + '</span></div>';
    }).join('') + '</div>';
    if (r.zonderToestemming.length) uit += '<p class="stil">Zonder toestemming (geen locatie, hoort zo): ' + r.zonderToestemming.map(esc).join(', ') + '</p>';
    return uit || '<p class="stil">Nog geen plekken doorgegeven.</p>';
  }

  var belAan = false;
  window.SPart.excursie = function (kc) {
    var P = window.SPart, kl = P.kl, esc = P.esc, meld = P.meld;

    // bellen binnen de app: de leraar zet het klas-belkanaal een keer open
    if (kc && window.SchoolBel && !belAan) {
      try {
        var sessie = window.RTGSchoolSession ? RTGSchoolSession.lees('rtg_schoolpartner') : null;
        if (sessie && sessie.token) { belAan = true; SchoolBel.start({ klasCode: kc, leraar: { token: sessie.token } }); }
      } catch (e) {}
    }

    kl('/school/excursie/lijst').then(function (r) {
      if (r.body.error) return;
      $('#exLijst').innerHTML = (r.body.excursies || []).map(function (e) {
        return '<div class="item"><span>' + esc(e.titel) + (e.bestemming ? ' <span class="stil">· ' + esc(e.bestemming) + '</span>' : '') +
          ' <span class="tag' + (e.status === 'actief' ? ' aan' : '') + '">' + esc(e.status) + '</span>' +
          ' <span class="stil">' + e.toestemmingen + '/' + e.leerlingen + ' toestemming · ' + e.kijkbeurten + 'x gekeken</span></span>' +
          '<span class="rij">' +
          (e.status === 'gepland' ? '<button class="knop p" data-ex="start" data-id="' + esc(e.id) + '">Start</button>' : '') +
          (e.status === 'actief' ? '<button class="knop" data-ex="plek" data-id="' + esc(e.id) + '">Deel mijn plek</button>' +
            '<button class="knop p" data-ex="kaart" data-id="' + esc(e.id) + '">Kaart</button>' +
            '<button class="knop" data-ex="stop" data-id="' + esc(e.id) + '">Stop en wis</button>' : '') +
          '</span></div>';
      }).join('') || '<p class="stil">Nog geen excursies.</p>';
    });
    kl('/school/bijdrage/overzicht').then(function (r) {
      if (r.body.error) return;
      $('#bijLijst').innerHTML = (r.body.bijdragen || []).map(function (b) {
        return '<div class="item"><span>' + esc(b.titel) + ' <span class="stil">· EUR ' + b.bedrag.toFixed(2) + '</span></span>' +
          '<span class="stil">' + b.betaald.length + ' van ' + b.leerlingen + ' betaald</span></div>';
      }).join('') || '<p class="stil">Nog geen bijdragen gevraagd.</p>';
    });
    kl('/school/telefoonboom').then(function (r) {
      if (r.body.error) return;
      var alarm = r.body.alarm ? '<p class="stil">Alarm loopt: ' + esc(r.body.alarm.bericht) + '</p>' : '';
      $('#boomLijst').innerHTML = alarm + (r.body.volgorde || []).map(function (n, i) {
        return '<div class="item"><span>' + (i < 2 ? 'Leraar belt: ' : '') + esc(n.kind) +
          (n.nummer ? '' : ' <span class="tag">geen nummer</span>') +
          (n.doorgegeven ? ' <span class="tag aan">doorgegeven</span>' : '') + '</span>' +
          '<span class="rij"><span class="stil">' + (n.belt.length ? 'belt: ' + n.belt.map(esc).join(', ') : 'blad van de boom') + '</span>' +
          '<button class="knop" data-belg="' + esc(n.gezinCode) + '" data-naam="ouders van ' + esc(n.kind) + '">Bel in de app</button></span></div>';
      }).join('') || '<p class="stil">Nog geen boom; druk op Boom (opnieuw) maken.</p>';
    });
    if (gebonden) return;
    gebonden = true;

    $('#boomLijst').addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-belg]') : null;
      if (b && window.SchoolBel) SchoolBel.bel(b.dataset.belg, b.dataset.naam);
    });

    $('#exLijst').addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-ex]') : null;
      if (!b) return;
      var id = b.dataset.id, doe = b.dataset.ex;
      if (doe === 'start') kl('/school/excursie/start', { excursieId: id }).then(function (r) { meld(r.body.error || 'De excursie is live; locaties bestaan tot de stop.'); P.excursie(); });
      if (doe === 'stop') kl('/school/excursie/stop', { excursieId: id }).then(function (r) { meld(r.body.error || 'Gestopt; alle locaties zijn gewist.'); $('#exUit').innerHTML = ''; P.excursie(); });
      if (doe === 'kaart') kl('/school/excursie/kaart', { excursieId: id }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        $('#exUit').innerHTML = '<div class="kop h-mt60">' + esc(r.body.titel) + ' · nu</div>' + plekkenHTML(esc, r.body) +
          '<p class="stil">Deze blik is gelogd en zichtbaar voor de gezinnen.</p>';
      });
      if (doe === 'plek') {
        if (!navigator.geolocation) return meld('Geen locatie beschikbaar op dit toestel.');
        navigator.geolocation.getCurrentPosition(function (pos) {
          kl('/school/excursie/gps', { excursieId: id, lat: pos.coords.latitude, lng: pos.coords.longitude })
            .then(function (r) { meld(r.body.error || 'Je plek staat op de kaart.'); });
        }, function () { meld('Locatie delen is geweigerd op dit toestel.'); });
      }
    });
    $('#exMaak').addEventListener('click', function () {
      kl('/school/excursie/maak', { titel: $('#exTitel').value, bestemming: $('#exBest').value })
        .then(function (r) { meld(r.body.error || 'Excursie staat klaar; ouders kunnen nu toestemming geven.'); P.excursie(); });
    });
    $('#bijMaak').addEventListener('click', function () {
      kl('/school/bijdrage/maak', { titel: $('#bijTitel').value, bedrag: Number($('#bijBedrag').value) })
        .then(function (r) { meld(r.body.error || r.body.vrijwillig); P.excursie(); });
    });
    $('#boomMaak').addEventListener('click', function () {
      kl('/school/telefoonboom/maak').then(function (r) { meld(r.body.error || 'Boom staat: ' + r.body.aantal + ' gezinnen.'); P.excursie(); });
    });
    $('#boomStart').addEventListener('click', function () {
      kl('/school/telefoonboom/start', { bericht: $('#boomBericht').value }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        meld('Alarm gestart. Jij belt: ' + r.body.leraarBelt.map(function (t) { return t.kind + (t.nummer ? ' (' + t.nummer + ')' : ''); }).join(' en '));
        P.excursie();
      });
    });
  };
})();
