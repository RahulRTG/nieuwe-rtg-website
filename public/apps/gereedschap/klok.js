/* RTG Gereedschap, wekkers en timers: het scherm bij kern/klok.js. De
   server telt af; dit scherm zet, toont en luistert (SSE-event 'klok').
   Gaat er een af, dan komt het alarmscherm met een eigen opgewekte toon
   (WebAudio, dus zonder een geluidsbestand van een ander). */
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
    return fetch('/api/klok/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; });
    });
  };
  var meldT; var meld = function (t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zie');
    clearTimeout(meldT); meldT = setTimeout(function () { m.classList.remove('zie'); }, 3200);
  };
  var DAGNAMEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  var stand = null, tel = null;

  function laad() {
    return api('mijn').then(function (r) {
      if (r.status !== 200) return meld(r.body.error || 'Log eerst in op de leden-app.');
      stand = r.body;
      teken();
    });
  }

  /* Meenemen (shared/uitvoer.js): de wekkers zijn het register dat dit
     gereedschap echt bewaart -- ze staan op de server en gaan af als de app
     dicht is. Timers lopen leeg en horen daar niet bij. Op het scherm staat
     "07:00 sporten · ma di wo do vr"; hier gaan tijd, label, herhaling en de
     schakelaar los mee. */
  if (window.RTGUitvoer) RTGUitvoer.bron(function () {
    if (!stand || !(stand.wekkers || []).length) return null;
    return {
      naam: 'wekkers',
      kolommen: ['tijd', 'waarvoor', 'herhaling', 'staat'],
      rijen: stand.wekkers.map(function (w) {
        return [w.tijd || '', w.label || '', dagenTekst(w.dagen), w.aan ? 'aan' : 'uit'];
      })
    };
  });
  function dagenTekst(d) {
    if (!d || !d.length) return 'een keer';
    if (d.length === 7) return 'elke dag';
    return d.map(function (x) { return DAGNAMEN[x]; }).join(' ');
  }
  function overTekst(s) {
    var u = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return (u ? u + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0');
  }
  function teken() {
    if (!stand) return;
    $('#wekkers').innerHTML = (stand.wekkers || []).map(function (w) {
      return '<div class="kaart' + (w.aan ? '' : ' uitstand') + '"><span class="tijd">' + esc(w.tijd) + '</span>' +
        '<span class="wat">' + esc(w.label || '') + (w.label ? ' · ' : '') + dagenTekst(w.dagen) + '</span>' +
        '<button class="knop" data-aanuit="' + w.id + '" type="button">' + (w.aan ? 'Uit' : 'Aan') + '</button>' +
        '<button class="knop" data-wegwekker="' + w.id + '" type="button">Weg</button></div>';
    }).join('') || '<p class="stil">Nog geen wekkers.</p>';
    $('#timers').innerHTML = (stand.timers || []).map(function (t) {
      return '<div class="kaart"><span class="tijd" data-over="' + t.id + '">' +
        (t.af ? 'afgelopen' : overTekst(t.overS)) + '</span>' +
        '<span class="wat">' + esc(t.label || '') + '</span>' +
        '<button class="knop" data-wegtimer="' + t.id + '" type="button">Weg</button></div>';
    }).join('') || '<p class="stil">Geen lopende timers.</p>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-aanuit]'), function (el) {
      el.addEventListener('click', function () {
        var w = stand.wekkers.find(function (x) { return x.id === el.dataset.aanuit; });
        api('wekker', { id: el.dataset.aanuit, aan: !w.aan }).then(laad);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-wegwekker]'), function (el) {
      el.addEventListener('click', function () { api('wekker', { id: el.dataset.wegwekker, weg: true }).then(laad); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-wegtimer]'), function (el) {
      el.addEventListener('click', function () { api('timer', { id: el.dataset.wegtimer, weg: true }).then(laad); });
    });
    // de resterende tijd telt lokaal mee; de echte klok blijft de server
    clearInterval(tel);
    tel = setInterval(function () {
      (stand.timers || []).forEach(function (t) {
        if (t.af) return;
        t.overS = Math.max(0, t.overS - 1);
        var el = document.querySelector('[data-over="' + t.id + '"]');
        if (el) el.textContent = t.overS ? overTekst(t.overS) : 'zo meteen...';
      });
    }, 1000);
  }

  $('#wkZet').addEventListener('click', function () {
    var tijd = $('#wkTijd').value;
    if (!tijd) return meld('Kies eerst een tijd.');
    var dagen = $('#wkDagen').value ? $('#wkDagen').value.split(',').map(Number) : [];
    api('wekker', { tijd: tijd, label: $('#wkLabel').value, dagen: dagen }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      $('#wkLabel').value = '';
      meld('De wekker staat; de server telt, ook als u de app sluit.');
      laad();
    });
  });
  $('#tmStart').addEventListener('click', function () {
    var min = parseFloat(String($('#tmMin').value).replace(',', '.'));
    if (!Number.isFinite(min)) return meld('Hoeveel minuten?');
    api('timer', { duurS: Math.round(min * 60), label: $('#tmLabel').value }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      $('#tmMin').value = ''; $('#tmLabel').value = '';
      laad();
    });
  });

  /* ---- het alarm: SSE-seintje -> volledig scherm + eigen toon ---- */
  var audio = null, toonStop = null;
  function toon() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var t0 = audio.currentTime, stemmen = [];
      for (var i = 0; i < 8; i++) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = i % 2 ? 880 : 660;   // een rustige twee-toon, geen paniek
        g.gain.setValueAtTime(0, t0 + i * 0.6);
        g.gain.linearRampToValueAtTime(0.12, t0 + i * 0.6 + 0.05);
        g.gain.linearRampToValueAtTime(0, t0 + i * 0.6 + 0.45);
        o.connect(g); g.connect(audio.destination);
        o.start(t0 + i * 0.6); o.stop(t0 + i * 0.6 + 0.5);
        stemmen.push(o);
      }
      toonStop = function () { stemmen.forEach(function (o) { try { o.stop(); } catch (e) {} }); };
    } catch (e) { /* zonder geluid is het alarmscherm er nog steeds */ }
  }
  function alarm(d) {
    $('#alarmKop').textContent = d.titel || 'Alarm';
    $('#alarmTekst').textContent = d.tekst || '';
    $('#alarm').classList.add('open');
    if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]);
    toon();
    laad();
  }
  $('#alarmStil').addEventListener('click', function () {
    $('#alarm').classList.remove('open');
    if (toonStop) toonStop();
  });
  function luister() {
    if (!window.EventSource || !token) return;
    try {
      var bron = new EventSource('/api/stream?token=' + encodeURIComponent(token));
      bron.addEventListener('klok', function (e) {
        var d; try { d = JSON.parse(e.data || '{}'); } catch (err) { return; }
        alarm(d);
      });
    } catch (e) {}
  }

  window.RTGKlokScherm = { laad: laad };
  if (token) { laad(); luister(); }
})();
