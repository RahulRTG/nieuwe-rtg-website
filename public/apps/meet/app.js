/* RTG Meet, de lobby: kamers maken, binnenkomen op code, de eigen kamers
   en de SSE-lijn die de WebRTC-seinen bij de kamer aflevert. De kamer
   zelf (mesh, scherm delen) staat in kamer.js. Ook de landingsplek van de
   "Vergaderruimte"-knop op een agenda-afspraak (#kamer=KAMER-ID). De
   eenmalige deelcode komt nooit in een URL, lijst of browseropslag. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var token = null;
  try { token = localStorage.getItem('rtg_member_token'); } catch (e) {}
  var api = function (pad, body) {
    return fetch('/api/meet/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; });
    });
  };
  var meldT; var meld = function (t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zie');
    clearTimeout(meldT); meldT = setTimeout(function () { m.classList.remove('zie'); }, 3600);
  };

  /* ---- de SSE-lijn: seinen van de kamer komen hier binnen ---- */
  var bron = null;
  function luister() {
    if (bron || !window.EventSource || !token) return;
    try { bron = new EventSource('/api/stream?token=' + encodeURIComponent(token)); } catch (e) { return; }
    bron.addEventListener('meet', function (e) {
      var d; try { d = JSON.parse(e.data || '{}'); } catch (err) { return; }
      if (window.RTGMeetKamer) window.RTGMeetKamer.opSein(d);
    });
  }

  /* ---- de lobby ---- */
  /* Meenemen (shared/uitvoer.js): de kamerlijst is een register met eigen
     velden -- titel, lifecycle, hoe hij open staat, wie er nu binnen is. Die
     velden gaan mee, niet de tekst van de kaart. */
  var kamers = [];
  if (window.RTGUitvoer) RTGUitvoer.bron(function () {
    if (!kamers.length) return null;
    return { naam: 'kamers', kolommen: ['titel', 'deelcode', 'toegang', 'aanwezig'],
      rijen: kamers.map(function (k) {
        return [k.titel || '', 'alleen bij uitgifte', k.besloten ? 'besloten' : 'open op code',
          (k.aanwezig || []).join(', ')];
      }) };
  });

  function toonEenmaligeCode(code) {
    var vak = $('#eenmaligeCode');
    if (!vak || !code) return;
    vak.innerHTML = '<div class="kaart"><span class="h-flex1"><b>Nieuwe deelcode: nu eenmalig kopiëren</b>' +
      '<span class="meta">Een nieuwe uitgifte maakt de vorige code direct onbruikbaar.</span></span>' +
      '<input class="veld code" id="verseMeetCode" readonly autocomplete="off" spellcheck="false">' +
      '<button class="knop" id="kopieerMeetCode" type="button">Kopieer</button></div>';
    $('#verseMeetCode').value = code;
    $('#kopieerMeetCode').addEventListener('click', function () {
      var invoer = $('#verseMeetCode');
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(invoer.value).then(function () { $('#kopieerMeetCode').textContent = 'Gekopieerd'; })
          .catch(function () { invoer.focus(); invoer.select(); });
      else { invoer.focus(); invoer.select(); }
    });
  }
  function laad() {
    return api('mijn').then(function (r) {
      if (r.status !== 200) return meld(r.body.error || 'Log eerst in op de leden-app.');
      kamers = r.body.kamers || [];
      $('#kamers').innerHTML = (r.body.kamers || []).map(function (k) {
        return '<div class="kaart"><span class="h-flex1"><b>' + esc(k.titel) + '</b></span>' +
          '<button class="knop vol" data-kom-id="' + esc(k.id) + '" type="button">Binnen</button>' +
          (k.vanMij ? '<button class="knop" data-code="' + esc(k.id) + '" type="button">Nieuwe deelcode</button>' : '') +
          (k.vanMij ? '<button class="knop" data-weg="' + esc(k.id) + '" type="button">Opruimen</button>' : '') +
          '<span class="meta">' + (k.besloten ? 'besloten' : 'open op code') +
          (k.toegang ? ' · deelcode ' + esc(k.toegang.stand || 'onbekend') : '') +
          (k.agendaId ? ' · hoort bij een agenda-afspraak' : '') +
          (k.aanwezig.length ? ' · nu aanwezig: ' + k.aanwezig.map(esc).join(', ') : '') + '</span></div>';
      }).join('') || '<p class="stil">Nog geen kamers. Maak er een, of kom binnen met een code.</p>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-kom-id]'), function (el) {
        el.addEventListener('click', function () { binnen({ id: el.dataset.komId }); });
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-code]'), function (el) {
        el.addEventListener('click', function () {
          el.disabled = true;
          api('code', { id: el.dataset.code }).then(function (r2) {
            el.disabled = false;
            if (r2.body.error) return meld(r2.body.error);
            toonEenmaligeCode(r2.body.code); laad();
          });
        });
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-weg]'), function (el) {
        el.addEventListener('click', function () {
          if (!confirm('Deze kamer opruimen?')) return;
          api('weg', { id: el.dataset.weg }).then(function (r2) {
            if (r2.body.error) return meld(r2.body.error);
            laad();
          });
        });
      });
    });
  }

  function binnen(toegang, deelcode) {
    api('kom', toegang).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      luister();
      window.RTGMeetKamer.start({ api: function (pad, body) {
        return api(pad, body).then(function (x) { if (x.body.error) throw new Error(x.body.error); return x.body; });
      }, meld: meld, kamer: r.body.kamer, deelcode: deelcode || null, ik: r.body.ik, opWeg: laad });
    });
  }

  $('#komBtn').addEventListener('click', function () {
    var code = $('#komCode').value.trim().toUpperCase();
    if (code) { $('#komCode').value = ''; binnen({ code: code }); }
  });
  $('#komCode').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('#komBtn').click();
  });
  $('#nieuwBtn').addEventListener('click', function () {
    api('maak', { titel: $('#nieuwTitel').value }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      $('#nieuwTitel').value = '';
      toonEenmaligeCode(r.body.code);
      meld('De kamer staat klaar. Kopieer de deelcode nu; later tonen we haar niet opnieuw.');
      binnen({ id: r.body.id }, r.body.code);
    });
  });

  // vanuit RTG Agenda reist alleen de niet-geheime kamer-id in het fragment
  var m = /kamer=(mk[a-f0-9]{16})/i.exec(location.hash || '');
  if (!token) meld('Log eerst in op de leden-app.');
  else { luister(); laad().then(function () { if (m) binnen({ id: m[1] }); }); }
})();
