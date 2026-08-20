/* RTG School Partner: verlofaanvragen van gezinnen, en de momenten voor het
   oudergesprek. Beide hingen aan de aanwezigheidskant van de server en hadden
   geen scherm.

   Bij een besluit is de reden verplicht, en dat is geen formaliteit: het gezin
   krijgt hem te zien, en een afwijzing zonder reden is bij leerplicht het
   begin van een conflict dat niemand wil. Het scherm vraagt hem daarom in
   dezelfde handeling en niet als optie erachteraan.

   Bij de gespreksmomenten geldt: wie het eerst komt. Er is geen voorrang te
   koop en geen ranglijst van ouders; het scherm toont alleen of een moment
   bezet is en door wie.

   Zelfde SPart-patroon als presentie.js; app.js roept SPart.verlof() aan. */
window.SPart = window.SPart || {};
window.SPart.verlof = function () {
  var P = window.SPart, sk = P.sk, esc = P.esc, meld = P.meld;
  var $ = function (s) { return document.querySelector(s); };

  sk('/school/verlof/lijst').then(function (r) {
    if (r.body.error) { $('#verlofLijst').innerHTML = '<p class="stil">' + esc(r.body.error) + '</p>'; return; }
    $('#verlofLijst').innerHTML = (r.body.aanvragen || []).slice(0, 20).map(function (v) {
      return '<div class="item" style="align-items:flex-start;"><span style="flex:1;min-width:13rem;">' +
        '<b>' + esc(v.naam || v.sleutel) + '</b> <span class="stil">· ' + esc(v.van) +
        (v.tot && v.tot !== v.van ? ' tot ' + esc(v.tot) : '') + ' · ' + esc(v.soort) + '</span><br>' +
        '<span class="stil">' + esc(v.reden) + (v.besluitReden ? '<br>besluit: ' + esc(v.besluitReden) : '') + '</span></span>' +
        (v.status === 'ingediend'
          ? '<span class="rij"><button class="knop p" data-verlof="' + esc(v.id) + '" data-besluit="toegekend">Toekennen</button>' +
            '<button class="knop" data-verlof="' + esc(v.id) + '" data-besluit="afgewezen">Afwijzen</button></span>'
          : '<span class="tag' + (v.status === 'toegekend' ? ' aan' : '') + '">' + esc(v.status) + '</span>') + '</div>';
    }).join('') || '<p class="stil">Geen verlofaanvragen.</p>';

    Array.prototype.forEach.call(document.querySelectorAll('[data-verlof]'), function (b) {
      b.addEventListener('click', function () {
        var toe = b.dataset.besluit === 'toegekend';
        var reden = window.prompt(toe ? 'Waarom kent u dit verlof toe? Het gezin ziet deze reden.'
          : 'Waarom wordt dit verlof afgewezen? Het gezin ziet deze reden.');
        if (reden == null || !reden.trim()) return meld('Zonder reden geen besluit; het gezin heeft recht op de reden.');
        sk('/school/verlof/besluit', { verlofId: b.dataset.verlof, besluit: b.dataset.besluit, reden: reden })
          .then(function (r2) { meld(r2.body.error || 'Besluit vastgelegd; het gezin ziet het met de reden erbij.'); P.verlof(); });
      });
    });
  });

  sk('/school/afspraak/momenten', { alleen: true }).then(function (r) {
    if (r.body.error) { $('#afspraakLijst').innerHTML = '<p class="stil">' + esc(r.body.error) + '</p>'; return; }
    $('#afspraakLijst').innerHTML = (r.body.momenten || []).slice(0, 20).map(function (m) {
      return '<div class="item"><span>' + esc(m.datum) + ' · ' + esc(m.tijd) + ' <span class="stil">· ' +
        m.minuten + ' min' + (m.plek ? ' · ' + esc(m.plek) : '') + '</span></span>' +
        (m.bezet ? '<span class="stil">' + esc(m.bezet.naam) + ' (' + esc(m.bezet.kind) + ')</span>'
          : '<span class="tag">vrij</span>') + '</div>';
    }).join('') || '<p class="stil">Nog geen momenten klaargezet.</p>';
  });

  var knop = $('#afspraakZet');
  if (knop && !knop.dataset.gebonden) {
    knop.dataset.gebonden = '1';
    knop.addEventListener('click', function () {
      var datum = $('#afspraakDatum').value, tijd = $('#afspraakTijd').value;
      if (!datum || !tijd) return meld('Geef een datum en een tijd.');
      var aantal = Math.max(1, Math.min(20, Number($('#afspraakAantal').value) || 1));
      var minuten = Math.max(5, Math.min(60, Number($('#afspraakMinuten').value) || 10));
      /* Meerdere momenten achter elkaar: de leraar zet zelden een gesprek
         klaar maar een avond. De tijd loopt hier op, niet op de server -- die
         neemt gewoon de lijst aan die hij krijgt. */
      var momenten = [], u = Number(tijd.slice(0, 2)), m = Number(tijd.slice(3, 5));
      for (var i = 0; i < aantal; i++) {
        momenten.push({ datum: datum, minuten: minuten, plek: $('#afspraakPlek').value,
          tijd: ('0' + u).slice(-2) + ':' + ('0' + m).slice(-2) });
        m += minuten;
        while (m >= 60) { m -= 60; u = (u + 1) % 24; }
      }
      sk('/school/afspraak/momenten', { momenten: momenten }).then(function (r) {
        meld(r.body.error || (r.body.klaargezet + ' momenten staan klaar; ouders kiezen zelf.'));
        P.verlof();
      });
    });
  }
};
