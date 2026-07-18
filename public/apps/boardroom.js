/* De boardroom van het lid: haalt het schakelbord op (/api/member/boardroom) en
   laat elke functie per groep aan/uitzetten. Geen inline handlers (nonce-CSP);
   de schakelaars praten meteen met de server, zodat de stand overal meereist. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  function token() { try { return localStorage.getItem('rtg_member_token') || ''; } catch (e) { return ''; } }
  function post(pad, body) {
    return fetch(pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify(body || {})
    });
  }

  function schakelaar(fn) {
    var wrap = document.createElement('label');
    wrap.className = 'sw';
    var inp = document.createElement('input');
    inp.type = 'checkbox'; inp.checked = !!fn.aan;
    inp.setAttribute('aria-label', fn.naam);
    var track = document.createElement('span'); track.className = 'track';
    var dot = document.createElement('span'); dot.className = 'dot';
    wrap.appendChild(inp); wrap.appendChild(track); wrap.appendChild(dot);
    inp.addEventListener('change', function () {
      inp.disabled = true;
      post('/api/member/boardroom/zet', { id: fn.id, aan: inp.checked })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (!d || !d.ok) inp.checked = !inp.checked; })
        .catch(function () { inp.checked = !inp.checked; })
        .then(function () { inp.disabled = false; });
    });
    return wrap;
  }

  function toon(bord) {
    var doel = $('bord'); doel.textContent = '';
    (bord.categorieen || []).forEach(function (cat) {
      var g = document.createElement('section'); g.className = 'groep';
      var h = document.createElement('h2'); h.textContent = cat.naam; g.appendChild(h);
      if (cat.uitleg) { var gu = document.createElement('div'); gu.className = 'gu'; gu.textContent = cat.uitleg; g.appendChild(gu); }
      cat.functies.forEach(function (fn) {
        var rij = document.createElement('div'); rij.className = 'fn';
        var t = document.createElement('div'); t.className = 'tekst';
        var n = document.createElement('div'); n.className = 'naam'; n.textContent = fn.naam; t.appendChild(n);
        if (fn.uitleg) { var u = document.createElement('div'); u.className = 'uit'; u.textContent = fn.uitleg; t.appendChild(u); }
        rij.appendChild(t);
        rij.appendChild(schakelaar(fn));
        g.appendChild(rij);
      });
      doel.appendChild(g);
    });
  }

  function laad() {
    if (!token()) { $('melding').textContent = 'Log in als lid om je boardroom te zien.'; return; }
    post('/api/member/boardroom', {})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.bord) { $('melding').textContent = 'Je boardroom is er alleen voor leden met een account.'; return; }
        toon(d.bord);
      })
      .catch(function () { $('melding').textContent = 'Kon de boardroom niet laden.'; });
  }

  document.addEventListener('DOMContentLoaded', laad);
})();
