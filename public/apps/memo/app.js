/* RTG Memo, het scherm: opnemen met de microfoon, de audio als gewoon
   bestand in de RTG Bestanden-kluis (map Memo's), afspelen, hernoemen en
   weggooien via de kluis-routes. Het toestel kan tijdens de opname
   meeluisteren voor een transcript; dat blijft in localStorage en gaat
   alleen naar de server als je zelf op Samenvatting drukt. */
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
    return fetch(pad, { method: 'POST',
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

  /* transcripten: van het toestel, niet van ons */
  var TX = {};
  try { TX = JSON.parse(localStorage.getItem('rtg_memo_tx') || '{}'); } catch (e) {}
  function txBewaar() { try { localStorage.setItem('rtg_memo_tx', JSON.stringify(TX)); } catch (e) {} }

  /* ---- de map Memo's in de kluis (een keer opzoeken of aanmaken) ---- */
  var mapId = null;
  function zoekMap() {
    return api('/api/bestanden/mijn').then(function (r) {
      if (r.body.error) throw new Error(r.body.error);
      var m = (r.body.mappen || []).find(function (x) { return x.naam === "Memo's"; });
      if (m) { mapId = m.id; return r.body; }
      return api('/api/bestanden/map', { naam: "Memo's" }).then(function (n) {
        mapId = n.body.id;
        return api('/api/bestanden/mijn').then(function (r2) { return r2.body; });
      });
    });
  }

  /* ---- opnemen ---- */
  var rec = null, delen = [], start = 0, tikT = null, sr = null, transcript = '';
  function klok() {
    var s = Math.floor((Date.now() - start) / 1000);
    $('#duur').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  function stopAlles() {
    clearInterval(tikT); tikT = null;
    if (sr) { try { sr.stop(); } catch (e) {} sr = null; }
  }
  $('#opneem').addEventListener('click', function () {
    if (rec) { rec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) return meld('Opnemen kan niet op dit toestel.');
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      delen = []; transcript = '';
      rec = new MediaRecorder(stream);
      rec.ondataavailable = function (e) { if (e.data && e.data.size) delen.push(e.data); };
      rec.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        stopAlles();
        $('#opneem').textContent = 'Neem op';
        $('#opneem').classList.remove('vol');
        var blob = new Blob(delen, { type: rec.mimeType || 'audio/webm' });
        rec = null;
        bewaar(blob);
      };
      rec.start();
      start = Date.now(); klok(); tikT = setInterval(klok, 500);
      $('#opneem').textContent = 'Stop en bewaar';
      $('#opneem').classList.add('vol');
      /* meeluisteren voor het transcript, als het toestel dat kan en jij het wilt */
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR && $('#luister').checked) {
        try {
          sr = new SR(); sr.lang = 'nl-NL'; sr.continuous = true; sr.interimResults = false;
          sr.onresult = function (e) {
            for (var i = e.resultIndex; i < e.results.length; i++) {
              if (e.results[i].isFinal) transcript += e.results[i][0].transcript + ' ';
            }
          };
          sr.start();
        } catch (e) { sr = null; }
      }
    }).catch(function () { meld('Geen toegang tot de microfoon.'); });
  });

  function bewaar(blob) {
    var fr = new FileReader();
    fr.onload = function () {
      var d = new Date();
      var naam = 'memo-' + d.toISOString().slice(0, 10) + '-' +
        String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '.webm';
      api('/api/bestanden/upload', { naam: naam, map: mapId, dataUrl: fr.result }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        if (transcript.trim()) { TX[r.body.id] = transcript.trim(); txBewaar(); }
        meld('Memo bewaard in je kluis.');
        laad();
      });
    };
    fr.readAsDataURL(blob);
  }

  /* ---- de lijst ---- */
  function rij(it) {
    var wanneer = new Date(it.op).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return '<div class="memo" data-id="' + esc(it.id) + '">' +
      '<div class="kop2"><b>' + esc(it.naam.replace(/\.webm$/, '')) + '</b>' +
      '<span class="stil">' + wanneer + ' · ' + Math.max(1, Math.round(it.bytes / 1024)) + ' kB' +
      (TX[it.id] ? ' · met transcript' : '') + '</span></div>' +
      '<audio controls preload="none" data-audio="' + esc(it.id) + '"></audio>' +
      '<div class="rij" style="margin-top:.45rem;">' +
      '<button class="knop" data-vat="' + esc(it.id) + '" type="button">Samenvatting</button>' +
      '<button class="knop" data-naam="' + esc(it.id) + '" type="button">Hernoem</button>' +
      '<button class="knop" data-weg="' + esc(it.id) + '" type="button">Weg</button></div>' +
      '<div class="stil vat" data-uit="' + esc(it.id) + '" style="margin-top:.4rem;white-space:pre-wrap;"></div></div>';
  }
  /* Meenemen (shared/uitvoer.js): de audio zit in je kluis, maar de LIJST is
     ook van jou -- welke memo's er zijn, wanneer je ze insprak, hoe groot ze
     zijn en of er een transcript bij hoort. Het transcript zelf staat op dit
     toestel en gaat hier niet in mee. */
  var LIJST = [];
  if (window.RTGUitvoer) RTGUitvoer.bron(function () {
    if (!LIJST.length) return null;
    return { naam: 'memos', kolommen: ['naam', 'datum', 'tijd', 'grootte-kb', 'transcript'],
      rijen: LIJST.map(function (it) {
        var d = new Date(it.op);
        return [String(it.naam || '').replace(/\.webm$/, ''), d.toISOString().slice(0, 10),
          d.toTimeString().slice(0, 5), Math.max(1, Math.round(it.bytes / 1024)),
          TX[it.id] ? 'ja' : 'nee'];
      }) };
  });
  function laad() {
    api('/api/bestanden/mijn').then(function (r) {
      if (r.body.error) return meld(r.body.error);
      var memos = (r.body.items || []).filter(function (x) { return x.map === mapId && !x.weg; })
        .sort(function (a, b) { return b.op - a.op; });
      LIJST = memos;
      $('#lijst').innerHTML = memos.length ? memos.map(rij).join('')
        : '<p class="stil">Nog geen memo\'s. Druk op Neem op en spreek in; stoppen is bewaren.</p>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-audio]'), function (el) {
        el.addEventListener('play', function () {
          if (el.src) return;
          api('/api/bestanden/haal', { id: el.dataset.audio }).then(function (r2) {
            if (r2.body.error) return meld(r2.body.error);
            el.src = r2.body.dataUrl; el.play();
          });
        }, { once: true });
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-vat]'), function (el) {
        el.addEventListener('click', function () {
          var id = el.dataset.vat, uit = document.querySelector('[data-uit="' + id + '"]');
          if (!TX[id]) { uit.textContent = 'Geen transcript van deze memo; het meeluisteren stond uit (of kan niet op dit toestel).'; return; }
          uit.textContent = 'Rahul vat samen...';
          api('/api/memo/samenvat', { transcript: TX[id] }).then(function (r2) {
            uit.textContent = r2.body.samenvatting || r2.body.error || 'Dat lukte nu even niet.';
          });
        });
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-naam]'), function (el) {
        el.addEventListener('click', function () {
          var nieuw = prompt('Nieuwe naam voor deze memo:');
          if (!nieuw) return;
          api('/api/bestanden/wijzig', { id: el.dataset.naam, naam: nieuw + '.webm' }).then(function (r2) {
            if (r2.body.error) return meld(r2.body.error);
            laad();
          });
        });
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-weg]'), function (el) {
        el.addEventListener('click', function () {
          api('/api/bestanden/weg', { id: el.dataset.weg }).then(function (r2) {
            if (r2.body.error) return meld(r2.body.error);
            delete TX[el.dataset.weg]; txBewaar();
            meld('Naar de prullenbak van je kluis (30 dagen te herstellen).');
            laad();
          });
        });
      });
    });
  }

  if (!token) { meld('Log eerst in op de leden-app.'); return; }
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { $('#luister').checked = false; $('#luister').disabled = true; $('#luisterWrap').classList.add('uit'); }
  zoekMap().then(function () { laad(); }).catch(function (e) { meld(e.message); });
})();
