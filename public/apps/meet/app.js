/* RTG Meet, de lobby: kamers maken, binnenkomen op code, de eigen kamers
   en de SSE-lijn die de WebRTC-seinen bij de kamer aflevert. De kamer
   zelf (mesh, scherm delen) staat in kamer.js. Ook de landingsplek van de
   "Vergaderruimte"-knop op een agenda-afspraak (#kamer=CODE in de URL). */
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
  function laad() {
    return api('mijn').then(function (r) {
      if (r.status !== 200) return meld(r.body.error || 'Log eerst in op de leden-app.');
      $('#kamers').innerHTML = (r.body.kamers || []).map(function (k) {
        return '<div class="kaart"><span style="flex:1;"><b>' + esc(k.titel) + '</b>' +
          ' <span class="code">' + esc(k.code) + '</span></span>' +
          '<button class="knop vol" data-kom="' + esc(k.code) + '" type="button">Binnen</button>' +
          (k.vanMij ? '<button class="knop" data-weg="' + esc(k.id) + '" type="button">Opruimen</button>' : '') +
          '<span class="meta">' + (k.besloten ? 'besloten' : 'open op code') +
          (k.agendaId ? ' · hoort bij een agenda-afspraak' : '') +
          (k.aanwezig.length ? ' · nu aanwezig: ' + k.aanwezig.map(esc).join(', ') : '') + '</span></div>';
      }).join('') || '<p class="stil">Nog geen kamers. Maak er een, of kom binnen met een code.</p>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-kom]'), function (el) {
        el.addEventListener('click', function () { binnen(el.dataset.kom); });
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

  function binnen(code) {
    api('kom', { code: code }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      luister();
      window.RTGMeetKamer.start({ api: function (pad, body) {
        return api(pad, body).then(function (x) { if (x.body.error) throw new Error(x.body.error); return x.body; });
      }, meld: meld, kamer: r.body.kamer, ik: r.body.ik, opWeg: laad });
    });
  }

  $('#komBtn').addEventListener('click', function () {
    var code = $('#komCode').value.trim().toUpperCase();
    if (code) binnen(code);
  });
  $('#komCode').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('#komBtn').click();
  });
  $('#nieuwBtn').addEventListener('click', function () {
    api('maak', { titel: $('#nieuwTitel').value }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      $('#nieuwTitel').value = '';
      meld('De kamer staat klaar; de code is ' + r.body.code + '.');
      binnen(r.body.code);
    });
  });

  // vanuit RTG Agenda: /apps/meet.html#kamer=CODE stapt direct de kamer in
  var m = /kamer=([A-Z0-9]{4,8})/i.exec(location.hash || '');
  if (!token) meld('Log eerst in op de leden-app.');
  else { luister(); laad().then(function () { if (m) binnen(m[1].toUpperCase()); }); }
})();
