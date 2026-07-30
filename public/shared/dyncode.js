/* RTG dynamische code (client): toont een LEVENDE, gesloten RTG-code die zichzelf
   ververst. De code komt vers van de server (/api/code/dyn), wordt in RTG-stijl
   getekend (bordeaux met de lippen of het horloge in het hart) en telt af; net
   voor het verval haalt hij vanzelf een nieuwe. Een foto veroudert dus binnen de
   halve minuut -- en zonder onze app (met inlog) is er sowieso geen code te maken
   of te lezen.

   Nodig op de pagina: /shared/qr.js en /shared/qrteken.js.
   Gebruik: RTGDyn.plaats(el, { soort:'kas', code:'BETAAL9', merk:'lippen' }).
            RTGDyn.verifieer(token) -> belofte met { ok, soort, code } of fout. */
(function (root) {
  'use strict';
  function tok() {
    try { return localStorage.getItem('rtg_member_token') || localStorage.getItem('rtg_sup_token') || null; } catch (e) { return null; }
  }
  function post(pad, body) {
    var t = tok();
    return fetch(pad, { method: 'POST', headers: t ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t } : { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); });
  }

  function verifieer(token) {
    return post('/api/code/scan', { token: token }).then(function (r) {
      if (r.ok) return { ok: true, soort: r.d.soort, code: r.d.code, exp: r.d.exp };
      return { ok: false, reden: r.d && r.d.reden, error: (r.d && r.d.error) || 'Geen geldige RTG-code.' };
    });
  }

  function plaats(el, opts) {
    opts = opts || {};
    if (!el) return { stop: function () {} };
    var merk = opts.merk === 'horloge' ? 'horloge' : 'lippen';
    var levend = true, huidig = null, timer = null, raf = null;

    // opbouw: een doek voor de code + een dunne aftel-ring eronder
    el.innerHTML = '';
    el.style.textAlign = 'center';
    var doek = root.document.createElement('div');
    doek.setAttribute('role', 'img');
    doek.setAttribute('aria-label', 'RTG-code, ververst automatisch');
    var ring = root.document.createElement('canvas'); ring.width = 120; ring.height = 6;
    ring.style.cssText = 'width:min(15rem,60%);height:4px;margin:.6rem auto 0;display:block;border-radius:2px;';
    el.appendChild(doek); el.appendChild(ring);

    function tekenRing(frac) {
      var c = ring.getContext('2d'), w = ring.width, h = ring.height;
      c.clearRect(0, 0, w, h);
      c.fillStyle = 'rgba(127,22,52,.18)'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#7F1634'; c.fillRect(0, 0, Math.max(0, Math.min(1, frac)) * w, h);
    }

    function toon(token, exp) {
      try {
        var cv = root.RTGQRteken.tekenRTG(token, { merk: merk, schaal: opts.schaal || 7 });
        cv.style.cssText = 'width:min(16rem,80vw);height:auto;image-rendering:pixelated;border-radius:12px;';
        doek.innerHTML = ''; doek.appendChild(cv);
      } catch (e) { doek.textContent = 'Kon de code niet tekenen.'; }
      huidig = { token: token, exp: exp };
    }

    function ververs() {
      post('/api/code/dyn', { soort: opts.soort, code: opts.code, ttlMs: opts.ttlMs })
        .then(function (r) {
          if (!levend) return;
          if (r.ok && r.d.token) { toon(r.d.token, r.d.exp); plan(r.d.exp); }
          else { doek.textContent = (r.d && r.d.error) || 'Kon geen code maken.'; plan(Date.now() + 8000); }
        })
        .catch(function () { if (levend) { doek.textContent = 'Even geen verbinding.'; plan(Date.now() + 8000); } });
    }

    // ~1,5s voor het verval alvast een verse code halen (naadloos roterend)
    function plan(exp) {
      clearTimeout(timer);
      var over = Math.max(1000, exp - Date.now() - 1500);
      timer = setTimeout(function () { if (levend) ververs(); }, over);
    }

    function lus() {
      if (!levend) return;
      if (huidig) {
        var totaal = (opts.ttlMs || 45000);
        tekenRing((huidig.exp - Date.now()) / totaal);
      }
      raf = root.requestAnimationFrame(lus);
    }

    ververs(); lus();
    return { stop: function () { levend = false; clearTimeout(timer); if (raf) root.cancelAnimationFrame(raf); } };
  }

  root.RTGDyn = { plaats: plaats, verifieer: verifieer };
})(typeof self !== 'undefined' ? self : this);
