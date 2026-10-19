/* De Mobility Control Tower op het RTG Design System (TRAVELOS-MIGRATIE.md
   par. 1b). Dezelfde kern als ervoor: /api/supplier/ov/overzicht met het
   PDA-token, elke tien seconden opnieuw. Alleen kijken; private operaties
   tonen alleen capaciteit, nooit een hoofdgast of route. */
(function (w) {
  'use strict';
  var R = w.RTGWerk, $ = R.$, esc = R.esc, item = R.item;
  var token = (function () { try { return localStorage.getItem('rtg_pda_token'); } catch (e) { return null; } })();
  function mis(t) { $('#poort').hidden = false; $('#fout').textContent = t; R.schermtype('status'); }
  function laad() {
    if (!token) return mis('Log eerst in via de personeels-app van uw OV-bedrijf.');
    fetch('/api/supplier/ov/overzicht', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: '{}' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, b: b }; }); })
      .then(function (x) {
        var b = x.b;
        if (!x.ok) return mis(b.error || 'De Control Tower is niet beschikbaar.');
        $('#poort').hidden = true; $('#inhoud').hidden = false; R.schermtype('collectie');
        $('#mV').textContent = b.voertuigen.length;
        $('#mA').textContent = b.aanBoord;
        $('#mR').textContent = b.reizigersVandaag;
        $('#mO').textContent = R.eur(b.omzetVandaag);
        $('#vloot').innerHTML = b.voertuigen.length ? b.voertuigen.map(function (v) {
          return item({ aandacht: true, kop: esc(v.naam), meta: esc(v.door) + ' · ' + esc(v.lijnId), stand: 'live' });
        }).join('') : R.leegRegel('Geen voertuig deelt nu een verse positie.');
        $('#lijnen').innerHTML = b.lijnen.map(function (l) {
          return item({ kop: esc(l.icoon + ' ' + l.naam), stand: l.reizigers + ' reizigers' });
        }).join('');
        var o = b.operaties || { actief: 0, segmenten: 0, personen: 0, aandacht: 0, modi: [] };
        $('#operaties').innerHTML = item({ aandacht: o.aandacht > 0, kop: o.actief + ' operaties · ' + o.segmenten + ' segmenten',
          meta: 'capaciteit voor ' + o.personen + ' personen · ' + o.aandacht + ' vragen aandacht', stand: 'need-to-know' }) +
          o.modi.map(function (m) { return item({ kop: esc(m.modus), stand: String(m.aantal) }); }).join('');
      });
  }
  laad(); setInterval(laad, 10000);
}(window));
