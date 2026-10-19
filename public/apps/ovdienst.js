/* De OV-dienst op het RTG Design System (TRAVELOS-MIGRATIE.md par. 1b).
   Dezelfde kern als ervoor: /api/staff/ov/* en /api/supplier/ov/overzicht
   met het PDA-token, /api/staff/mob/kaart/controle voor een kaartje. */
(function (w, d) {
  'use strict';
  var R = w.RTGWerk, $ = R.$, maak = R.maak, zeg = R.zeg;
  var token = (function () { try { return localStorage.getItem('rtg_pda_token'); } catch (e) { return null; } })();
  var api = function (pad, body) {
    return fetch('/api/staff/ov/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {}) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; }); });
  };

  var hier = { lat: 38.908, lng: 1.432 };
  /* DE STAND VAN DE GPS-SCHAKELAAR KOMT VAN DE CONTRACTLAAG (shared/plek.js),
     NIET UIT LOCALSTORAGE. plek.js laadt met defer, dus alles wat de stand
     nodig heeft staat in DOMContentLoaded, waar RTGPlek gegarandeerd geladen
     is. Zonder plek blijft het demo-startpunt staan; plek.js vraagt het een
     keer, met de reden erbij. */
  d.addEventListener('DOMContentLoaded', function () {
    if (!w.RTGPlek) { if (w.console) console.warn('[ov] shared/plek.js ontbreekt; zonder plek blijft het scherm bij de demo-stand.'); return; }
    if (w.RTGPlek.aan()) {
      if ('geolocation' in navigator)
        navigator.geolocation.watchPosition(function (p) { hier = { lat: p.coords.latitude, lng: p.coords.longitude }; }, function () {}, { enableHighAccuracy: true });
      return;
    }
    w.RTGPlek.vraag({ waarom: 'Om je dienst en de haltes op je route te tonen moet ik weten waar je bent. Je locatie blijft op je toestel.' })
      .then(function (plek) { if (plek) location.reload(); });
  });

  var posTimer = null, standTimer = null;
  function poort() { $('#vPoort').hidden = false; R.schermtype('status'); }
  function start() {
    if (!token) return poort();
    // de lijnen komen uit het zaakoverzicht (zelfde inlog)
    return fetch('/api/supplier/ov/overzicht', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: '{}' })
      .then(function (x) { return x.json().catch(function () { return {}; }).then(function (b) { return { status: x.status, body: b }; }); })
      .then(function (r) {
        if (r.status !== 200) { R.deur($('#poortDeur'), '/apps/personeel.html'); return poort(); }
        var sel = $('#dLijn'); R.leeg(sel);
        (r.body.lijnen || []).forEach(function (l) { var o = maak('option', '', l.icoon + ' ' + l.naam); o.value = l.id; sel.appendChild(o); });
        $('#vDienst').hidden = false;
        // liep er al een dienst? dan meteen terug in het werkscherm
        return api('stand').then(function (st) {
          if (st.status === 200 && st.body.aan) dienstLoopt((st.body.lijn && st.body.lijn.naam) || 'Dienst');
        });
      });
  }

  /* Het scherm van een LOPENDE dienst. Twee wegen leiden ernaartoe: de
     startknop, en het herladen van de pagina terwijl de dienst doorloopt.
     Zonder die tweede weg zag een chauffeur na een hapering zijn startscherm
     terug met zijn dienst nog actief: geen tellers, geen GPS, geen controle. */
  function tellers(s) { if (s.status === 200) { $('#tAanBoord').textContent = s.body.aanBoord; $('#tVandaag').textContent = s.body.vandaag; } }
  function dienstLoopt(lijnNaam) {
    $('#kies').hidden = true; $('#loopt').hidden = false;
    R.schermtype('detail');
    $('#dienstBadge').textContent = lijnNaam + ' · live';
    $('#nuTitel').textContent = lijnNaam + ' is live';
    clearInterval(posTimer); clearInterval(standTimer);
    var deel = function () {
      api('pos', hier).then(function (p) {
        $('#gpsStatus').textContent = p.body.error ? p.body.error : 'GPS gedeeld om ' +
          new Intl.DateTimeFormat(d.documentElement.lang || 'nl', { hour: '2-digit', minute: '2-digit' }).format(new Date()) + '; leden zien u live.';
      });
    };
    deel(); posTimer = setInterval(deel, 7000);
    var stand = function () { api('stand').then(tellers); };
    stand(); standTimer = setInterval(stand, 8000);
  }
  $('#dStart').addEventListener('click', function () {
    api('dienst', { lijnId: $('#dLijn').value, voertuigNaam: $('#dNaam').value }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      dienstLoopt(r.body.lijn.naam);
      if (r.body.afwezigWaarschuwing) zeg(r.body.afwezigWaarschuwing);
    });
  });
  $('#dStop').addEventListener('click', function () {
    api('dienst', { aan: false }).then(function () {
      clearInterval(posTimer); clearInterval(standTimer);
      $('#kies').hidden = false; $('#loopt').hidden = true;
      R.schermtype('taak');
      $('#dienstBadge').textContent = 'Geen dienst';
      zeg('Dienst gestopt.');
    });
  });
  function incheck(code) {
    api('checkin', { code: code }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      $('#codeVeld').value = '';
      zeg('Reiziger ingecheckt.');
      api('stand').then(tellers);
    });
  }
  $('#codeForm').addEventListener('submit', function (e) { e.preventDefault(); incheck($('#codeVeld').value.trim()); });
  $('#incheckScan').addEventListener('click', function () {
    if (!w.RTGOvScan) return zeg('Scannen kan hier niet; tik de code in.');
    w.RTGOvScan.open({ titel: 'Incheckcode scannen', hint: 'Laat de reiziger de oplichtende QR tonen.', onCode: incheck });
  });

  /* ---- vervoerbewijzen controleren ----
     De conducteur ziet het BEWIJS en niet de persoon: product, lijn,
     geldigheid en de codenaam. Geen e-mailadres, geen wallet, geen
     reisgeschiedenis: hij controleert een kaartje, geen persoon. */
  function bewijsCheck(code) {
    var uit = $('#bewijsUit');
    uit.hidden = false;
    uit.textContent = 'Even kijken…';
    fetch('/api/staff/mob/kaart/controle', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ code: code, lijnId: $('#dLijn').value || undefined }) })
      .then(function (x) { return x.json().catch(function () { return {}; }); })
      .then(function (b) {
        R.leeg(uit);
        uit.appendChild(maak('p', 'ds-detail__status', b.geldig ? 'Geldig' : 'Niet geldig'));
        uit.appendChild(maak('p', 'ds-meta', b.geldig ? (b.melding || '') : (b.error || 'Onbekende code.')));
        var k = b.kaartje;
        if (k) uit.appendChild(maak('p', 'ds-meta', [k.product, k.lijnNaam, k.van ? k.van + ' → ' + k.naar : null, k.codenaam].filter(Boolean).join(' · ')));
        zeg(b.geldig ? 'Geldig vervoerbewijs.' : (b.error || 'Niet geldig.'));
      });
  }
  $('#bewijsForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var c = $('#bewijsVeld').value.trim();
    if (!c) return zeg('Vul een code in.');
    bewijsCheck(c);
    $('#bewijsVeld').value = '';
  });
  $('#scanKnop').addEventListener('click', function () {
    if (!w.RTGOvScan) return zeg('Scannen kan hier niet; tik de code in.');
    w.RTGOvScan.open({ titel: 'Vervoerbewijs scannen', hint: 'Laat de reiziger de QR van zijn kaartje tonen.', onCode: bewijsCheck });
  });

  start();
}(window, document));
