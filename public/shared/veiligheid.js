/* Gedeelde laag voor de vier veiligheidsapps (Thuiswacht, Codewoord, Vitaal,
   Thuisrust). Alle vier tonen dezelfde kring en dezelfde eerlijke grens, dus
   die staan hier een keer.

   Geen framework, geen build: dit bestand wordt gewoon meegeladen. */
(function (root) {
  'use strict';
  var V = {};

  V.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };

  V.token = function () { try { return localStorage.getItem('rtg_member_token'); } catch (e) { return null; } };

  V.api = function (pad, body) {
    var t = V.token();
    return fetch(pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (t || '') },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || 'Er ging iets mis.');
        return d;
      });
    });
  };

  /* De grensregel. Staat op alle vier de schermen, altijd zichtbaar, nooit
     weg te klikken. Wie denkt beschermd te zijn en het niet is, is slechter
     af dan wie het weet; daarom is dit geen kleine lettertjes maar gewoon
     tekst op het scherm. */
  V.grens = function () {
    return '<div class="grens" role="note">' +
      '<strong>Wat dit niet is.</strong> RTG is geen alarmcentrale. Er wordt niemand gebeld, ' +
      'er kijkt geen mens mee, en er komt geen hulpdienst. Alleen de mensen die u zelf in uw ' +
      'kring zet krijgen bericht. Zonder internet, of als de server plat ligt, gaat er niets af. ' +
      '<strong>Bij levensgevaar belt u het alarmnummer.</strong></div>';
  };

  V.tijd = function (iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  V.klok = function (sec) {
    sec = Math.max(0, Math.round(sec));
    var u = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (u ? u + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  };

  /* ---- de kring ----
     Een contact is een CODENAAM. Echte namen staan in de kluis en komen hier
     nooit langs; dat is geen beperking maar het ontwerp. */
  V.kringKaart = function (host, opnieuw) {
    V.api('/api/veiligheid/kring').then(function (d) {
      var k = d.kring;
      var rijen = k.contacten.map(function (c) {
        return '<div class="rij">' +
          '<span class="cn">' + V.esc(c.codenaam) + '</span>' +
          '<label class="mini"><input type="checkbox" data-loc="' + V.esc(c.handle) + '"' +
            (c.locatie ? ' checked' : '') + '> plek delen</label>' +
          '<button class="knop mini weg" data-weg="' + V.esc(c.handle) + '">Weg</button></div>';
      }).join('');
      var mails = k.mails.map(function (m) {
        return '<div class="rij"><span class="cn">' + V.esc(m) + '</span>' +
          '<button class="knop mini weg" data-mailweg="' + V.esc(m) + '">Weg</button></div>';
      }).join('');
      host.innerHTML =
        (rijen || '<p class="stil">Uw kring is nog leeg. Zonder kring gaat er bij een alarm niets uit.</p>') +
        mails +
        '<label class="stil lbl" for="kringIn">Codenaam toevoegen (moet al een connectie zijn)</label>' +
        '<div class="rij"><input id="kringIn" maxlength="40" placeholder="Codenaam of sleutel">' +
        '<button class="knop" id="kringAdd">Toevoegen</button></div>' +
        '<label class="stil lbl" for="mailIn">Of een e-mailadres, voor iemand buiten RTG</label>' +
        '<div class="rij"><input id="mailIn" type="email" maxlength="120" placeholder="naam@voorbeeld.nl">' +
        '<button class="knop" id="mailAdd">Toevoegen</button></div>' +
        '<p class="stil" style="margin-top:.5rem;">Een klein kringetje werkt beter dan een groot: ' +
        'als iedereen denkt dat een ander wel gaat kijken, gaat er niemand.</p>';

      function na(p) { p.then(function () { V.kringKaart(host, opnieuw); if (opnieuw) opnieuw(); }).catch(function (e) { V.melding(e.message); }); }
      host.querySelectorAll('[data-weg]').forEach(function (b) {
        b.addEventListener('click', function () { na(V.api('/api/veiligheid/kring/verwijderen', { handle: b.dataset.weg })); });
      });
      host.querySelectorAll('[data-mailweg]').forEach(function (b) {
        b.addEventListener('click', function () { na(V.api('/api/veiligheid/kring/mail', { adres: b.dataset.mailweg, weg: true })); });
      });
      host.querySelectorAll('[data-loc]').forEach(function (c) {
        c.addEventListener('change', function () { na(V.api('/api/veiligheid/kring/aanpassen', { handle: c.dataset.loc, locatie: c.checked })); });
      });
      host.querySelector('#kringAdd').addEventListener('click', function () {
        var v = host.querySelector('#kringIn').value.trim();
        if (v) na(V.api('/api/veiligheid/kring/toevoegen', { handle: v }));
      });
      host.querySelector('#mailAdd').addEventListener('click', function () {
        var v = host.querySelector('#mailIn').value.trim();
        if (v) na(V.api('/api/veiligheid/kring/mail', { adres: v }));
      });
    }).catch(function (e) {
      host.innerHTML = '<p class="stil">' + V.esc(e.message) + ' Log eerst in via de leden-app.</p>';
    });
  };

  /* Een positie doorgeven. Dit is het levensteken: de server onthoudt de
     laatste, zodat uw kring iets heeft als uw telefoon straks uitvalt. */
  V.plekDoorgeven = function () {
    return new Promise(function (klaar) {
      /* De GPS-schakelaar in het OS-menu (rtg_os_gps) wint van het levensteken,
         en de STAND VAN DE SCHAKELAAR IS DE WAARHEID. Hier stond een controle op
         de waarde "0", terwijl de schakelaar zelf op "1" toetst (osmenu.js). Bij
         een sleutel die er nog niet is -- elk vers profiel, elk toestel waar het
         vinkje nooit is aangeraakt -- stond het vinkje dus op UIT terwijl de
         positie gewoon werd opgehaald en elke twee minuten verstuurd. Nu geldt:
         alleen een uitdrukkelijke "1" geeft de locatie vrij. De kring krijgt
         dan geen plek, en dat is precies wat het scherm belooft. */
      try { if (localStorage.getItem('rtg_os_gps') !== '1') return klaar(false); } catch (e) {}
      if (!navigator.geolocation) return klaar(false);
      navigator.geolocation.getCurrentPosition(function (p) {
        var body = { lat: p.coords.latitude, lon: p.coords.longitude, nauwkeurig: p.coords.accuracy };
        if (navigator.getBattery) {
          navigator.getBattery().then(function (b) {
            body.accu = Math.round(b.level * 100);
            V.api('/api/veiligheid/plek', body).then(function () { klaar(true); }).catch(function () { klaar(false); });
          }).catch(function () { V.api('/api/veiligheid/plek', body).then(function () { klaar(true); }).catch(function () { klaar(false); }); });
        } else {
          V.api('/api/veiligheid/plek', body).then(function () { klaar(true); }).catch(function () { klaar(false); });
        }
      }, function () { klaar(false); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
  };

  // elke twee minuten een levensteken zolang er iets loopt
  V.plekBlijvenMelden = function (loopt) {
    if (V._plekTimer) clearInterval(V._plekTimer);
    if (!loopt) return;
    V.plekDoorgeven();
    V._plekTimer = setInterval(function () { V.plekDoorgeven(); }, 120000);
  };

  V.melding = function (tekst) {
    var b = document.getElementById('vmelding');
    if (!b) { b = document.createElement('div'); b.id = 'vmelding'; b.className = 'vmelding'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
    b.textContent = tekst;
    b.classList.add('aan');
    clearTimeout(V._mt);
    V._mt = setTimeout(function () { b.classList.remove('aan'); }, 4000);
  };

  root.Veilig = V;
})(typeof self !== 'undefined' ? self : this);
