/* Magnaat Van Nul, SAMEN IN EEN OUDWIJK: het blok "Samen spelen" onder Wereld
   en de balk boven Vandaag. Dit bestand rekent niets: wie er meedoet, wie klaar
   is en welke dag het is, komt van de server (/api/member/magnaat/stad/*).
   Zolang een stad loopt, stuurt ./magnaat-leven.js zijn handelingen naar de
   stad in plaats van naar je eigen leven; daarvoor vraagt hij `loopt()`. */
(function () {
  'use strict';
  var TOKEN = localStorage.getItem('rtg_member_token');
  if (!TOKEN) return;
  var q = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var STAD = null;

  function vraag(pad, body) {
    return fetch('/api/member/magnaat/stad/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || 'De stad kon dit niet doen.');
        return d;
      }); });
  }
  var loopt = function () { return !!(STAD && STAD.status === 'loopt' && STAD.spelers.some(function (s) { return s.ik && !s.weg; })); };
  var herlaad = function () { if (window.RTGMagnaatLeven) window.RTGMagnaatLeven.laad(); };

  function zet(s) {
    var was = loopt();
    STAD = s || null;
    teken();
    return was !== loopt();
  }

  function spelers(s) {
    return '<ul class="vn-spelers">' + s.spelers.map(function (p) {
      return '<li>' + esc(p.naam) + (p.ik ? ' (jij)' : '') + (p.weg ? ' · vertrokken' : s.status === 'loopt' ? (p.klaar ? ' · klaar met de dag' : p.meedoen ? ' · bezig' : ' · speelt niet meer mee') : '') + '</li>';
    }).join('') + '</ul>';
  }

  function teken() {
    var blok = q('#vnSamen'), balk = q('#vnStadBalk'), s = STAD;
    if (balk) {
      balk.hidden = !loopt();
      balk.textContent = loopt() ? 'Samen in Oudwijk · dag ' + s.dag + ' van ' + (s.tot - 1) + ' · ' +
        (s.wachtOp ? 'wacht op ' + s.wachtOp + (s.wachtOp === 1 ? ' speler' : ' spelers') + ' die de dag nog niet afsloten' : 'iedereen is klaar') : '';
    }
    if (!blok) return;
    var kop = '<div class="eyebrow">Samen spelen</div><h3>Samen in een Oudwijk</h3>';
    if (!s) {
      blok.innerHTML = kop + '<p>Twee tot vier spelers in dezelfde stad, ieder met een eigen leven en eigen boeken. De andere spelers zijn je concurrenten op de markt, ' +
        'en de dag gaat door als iedereen klaar is. Er is geen ranglijst.</p>' +
        '<p><button class="btn" type="button" data-vn-stad="maak">Maak een stad</button></p>' +
        '<label class="vn-tempo">Code van een stad <input id="vnStadCode" maxlength="6" autocomplete="off" inputmode="text"></label> ' +
        '<button class="btn" type="button" data-vn-stad="doe">Doe mee</button>';
      return;
    }
    if (s.status === 'wacht') {
      blok.innerHTML = kop + '<p>Geef deze code aan wie je erbij wilt: <b class="vn-stadcode">' + esc(s.code) + '</b></p>' + spelers(s) +
        '<p>' + (s.host ? '<button class="btn primary" type="button" data-vn-stad="start"' + (s.spelers.length < s.min ? ' disabled' : '') + '>Begin samen</button> ' : 'Wie de stad maakte, zet hem in gang. ') +
        '<button class="btn" type="button" data-vn-stad="verlaat">' + (s.host ? 'Hef de stad op' : 'Verlaat de stad') + '</button></p>' +
        (s.host && s.spelers.length < s.min ? '<p class="vn-rust">Samen spelen kan vanaf ' + s.min + ' spelers.</p>' : '');
      return;
    }
    if (s.status === 'loopt') {
      blok.innerHTML = kop + '<p>Dag ' + s.dag + ' van ' + (s.tot - 1) + '. Je speelt nu in de gedeelde stad; je eigen leven wacht tot je terugkomt.</p>' + spelers(s) +
        '<p><button class="btn" type="button" data-vn-stad="verlaat">Verlaat de stad</button></p><p class="vn-rust">' + esc(s.grens) + '</p>';
      return;
    }
    blok.innerHTML = kop + '<p>Deze stad is afgelopen. Zo verging het iedereen:</p>' + (s.verhalen || []).map(function (v) {
      return '<div class="vn-verhaal"><b>' + esc(v.naam) + (v.bedrijf ? ' · ' + esc(v.bedrijf) : '') + '</b><small>' + esc(v.einde) + '</small><ol>' +
        v.mijlpalen.map(function (m) { return '<li><small>dag ' + esc(m.dag) + '</small> ' + esc(m.tekst) + '</li>'; }).join('') + '</ol></div>';
    }).join('') + '<p><button class="btn" type="button" data-vn-stad="maak">Maak een nieuwe stad</button></p><p class="vn-rust">' + esc(s.grens) + '</p>';
  }

  function doe(pad, body) {
    var fout = q('#vnFout');
    return vraag(pad, body).then(function (d) {
      if (fout) fout.hidden = true;
      if (zet(d.stad) || pad === 'start') herlaad();
    }).catch(function (e) { if (fout) { fout.textContent = e.message; fout.hidden = false; } });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-vn-stad]');
    if (!t) return;
    var w = t.dataset.vnStad;
    if (w === 'maak') { var nv = q('#vnNiveau'), ns = q('#vnStart'); doe('maak', { moeilijkheid: nv ? nv.value : undefined, begin: ns ? ns.value : undefined }); }
    else if (w === 'doe') doe('doe', { code: (q('#vnStadCode') || {}).value });
    else doe(w, {});
  });

  window.RTGMagnaatStad = {
    loopt: loopt, zet: zet,
    /* Een seintje van de server (via RTGRealtime): iemand kwam binnen, werd klaar, of de dag ging door. */
    sein: function () { vraag('staat').then(function (d) { zet(d.stad); herlaad(); }).catch(function () {}); }
  };
  vraag('staat').then(function (d) { if (zet(d.stad)) herlaad(); }).catch(function () {});
}());
