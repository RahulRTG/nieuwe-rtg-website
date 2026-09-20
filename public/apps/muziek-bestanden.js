/* De bestandsspeler onder RTG Sound. De sociale feed levert nummers aan; deze
   laag laat ze klinken via dezelfde vaste bediening als de live stations. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var audio = $('#eigenAudio'), G = window.RTGGeluid;
  if (!audio) return;
  var token = null, nummers = [], actief = null, index = -1, laatsteMelding = 0;
  try { token = localStorage.getItem('rtg_member_token'); } catch (e) {}

  function status(tekst, fout) {
    var el = $('#muziekStatus'); if (!el) return;
    el.textContent = tekst || ''; el.style.color = fout ? '#e09a9a' : '';
  }
  async function api(pad, body) {
    var r = await fetch('/api/muziek/' + pad, { method: 'POST', headers: {
      'Content-Type': 'application/json', Authorization: 'Bearer ' + token
    }, body: JSON.stringify(body || {}) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || 'Dit lukte niet.'); return j;
  }
  function duur(sec) {
    sec = Math.round(Number(sec) || 0); if (!sec) return '';
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }
  function tekenActief() {
    document.querySelectorAll('.eigen-nummer').forEach(function (r) {
      var isActief = !!actief && r.dataset.id === actief.id;
      r.dataset.actief = String(isActief);
      var icoon = r.querySelector('.eigen-nummer__icoon');
      if (icoon) icoon.textContent = isActief && !audio.paused ? 'Ⅱ' : '♪';
    });
  }
  function publiceer(forceer) {
    if (!actief || !window.RTGSpeler || (!forceer && Date.now() - laatsteMelding < 900)) return;
    laatsteMelding = Date.now();
    RTGSpeler.zet({ app: 'RTG Sound', titel: actief.naam, artiest: actief.maker,
      station: 'Muziek van mensen', bestandId: actief.id, speelt: !audio.paused,
      start: Date.now() - Math.round(audio.currentTime * 1000) });
  }
  function werkSpelerBij(forceer) {
    if (!actief) return;
    $('.speler').dataset.actief = 'true';
    $('#spTitel').textContent = actief.naam;
    $('#spSub').textContent = actief.maker + ' · muziek van mensen' +
      (Number.isFinite(audio.duration) ? ' · ' + duur(audio.duration) : '');
    $('#knopSpeel').textContent = audio.paused ? '▶' : '⏸';
    var p = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration * 100 : 0;
    $('#voortgang').style.width = Math.max(0, Math.min(100, p)) + '%';
    document.querySelectorAll('.station').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    tekenActief(); publiceer(forceer);
  }
  function wachtrij() {
    if (!actief) return;
    var ul = $('#wachtrij'); ul.textContent = '';
    if (nummers.length < 2) {
      var leeg = document.createElement('li'); leeg.textContent = 'De volgende gedeelde nummers verschijnen hier.'; ul.appendChild(leeg); return;
    }
    for (var stap = 1; stap <= Math.min(3, nummers.length - 1); stap++) {
      var n = nummers[(index + stap) % nummers.length];
      var li = document.createElement('li'), b = document.createElement('b');
      b.textContent = n.naam; li.appendChild(b); li.appendChild(document.createTextNode(' · ' + n.maker)); ul.appendChild(li);
    }
  }
  function mediaSessie() {
    if (!('mediaSession' in navigator) || !actief) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: actief.naam, artist: actief.maker, album: 'RTG Sound' });
      navigator.mediaSession.setActionHandler('play', function () { audio.play().catch(function () {}); });
      navigator.mediaSession.setActionHandler('pause', function () { audio.pause(); });
      navigator.mediaSession.setActionHandler('nexttrack', volgende);
      navigator.mediaSession.setActionHandler('previoustrack', vorige);
    } catch (e) {}
  }
  async function speel(nummer) {
    if (!nummer || !token) return;
    if (actief && actief.id === nummer.id && audio.src) {
      if (audio.paused) await audio.play(); else audio.pause(); return;
    }
    try {
      status('“' + nummer.naam + '” wordt klaargezet…');
      var toegang = await api('bestand-ticket', { id: nummer.id });
      if (G && G.stand()) G.pauze();
      actief = nummer; index = nummers.findIndex(function (n) { return n.id === nummer.id; });
      audio.src = toegang.src; audio.load(); wachtrij(); mediaSessie(); werkSpelerBij(true);
      await audio.play(); status('Nu speelt: ' + nummer.naam + ' · ' + nummer.maker);
    } catch (e) { status(e.message || 'Dit nummer kon niet worden afgespeeld.', true); }
  }
  function stop() {
    if (!actief) return;
    audio.pause(); audio.removeAttribute('src'); audio.load(); actief = null; index = -1;
    tekenActief();
    if (!G || !G.stand()) $('.speler').removeAttribute('data-actief');
    if (window.RTGSpeler) RTGSpeler.stop();
  }
  function volgende() { if (nummers.length) speel(nummers[(Math.max(0, index) + 1) % nummers.length]); }
  function vorige() {
    if (!actief) return;
    if (audio.currentTime > 4) { audio.currentTime = 0; return; }
    speel(nummers[(index - 1 + nummers.length) % nummers.length]);
  }
  function zetNummers(nieuw) {
    nummers = Array.isArray(nieuw) ? nieuw.slice() : [];
    if (actief) {
      var vers = nummers.find(function (n) { return n.id === actief.id; });
      if (!vers) stop(); else { actief = vers; index = nummers.indexOf(vers); tekenActief(); }
    }
  }

  audio.addEventListener('play', function () { werkSpelerBij(true); });
  audio.addEventListener('pause', function () { werkSpelerBij(true); });
  audio.addEventListener('timeupdate', function () { werkSpelerBij(false); });
  audio.addEventListener('loadedmetadata', function () { werkSpelerBij(true); });
  audio.addEventListener('ended', volgende);
  audio.addEventListener('error', function () { if (actief) status('Dit nummer kan op dit toestel niet worden afgespeeld.', true); });

  window.RTGEigenMuziek = {
    actief: function () { return !!actief; }, actiefId: function () { return actief && actief.id; },
    zetNummers: zetNummers, speelNummer: speel, volgende: volgende, vorige: vorige, stop: stop,
    speel: function () { return audio.play().catch(function () {}); }, pauze: function () { audio.pause(); },
    toggle: function () { if (audio.paused) audio.play().catch(function () {}); else audio.pause(); },
    filter: function (q) { document.querySelectorAll('.eigen-nummer').forEach(function (r) {
      r.hidden = !!q && !r.textContent.toLowerCase().includes(q);
    }); }
  };
})();
