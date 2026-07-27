/* Mijn HR in de PDA (hr-plus): de medewerker ziet en vinkt het eigen
   inwerktraject, leest de eigen groeigesprekken en certificaten.
   Zelfde standalone-patroon als de hulplijn: eigen wortel naast #hulpWrap,
   eigen fetch met het PDA-token; verschijnt alleen als er iets te tonen is. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  function api(pad, body) {
    var t = null; try { t = localStorage.getItem('rtg_pda_token'); } catch (e) {}
    if (!t) return Promise.reject(new Error('geen sessie'));
    return fetch('/api' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify(body || {}) }).then(function (r) { return r.json(); });
  }
  var kaartStijl = 'border:1px solid var(--line,rgba(255,255,255,0.1));border-radius:14px;padding:0.8rem 0.95rem;margin-top:0.8rem;';
  var kopStijl = 'font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold,#A98F1C);';
  var subStijl = 'font-size:0.72rem;color:var(--soft,rgba(255,255,255,0.55));';

  function teken(d) {
    var w = document.getElementById('hulpWrap');
    if (!w) return;
    var el = document.getElementById('pdHrMijn');
    var leeg = !(d.inwerk || []).length && !(d.gesprekken || []).length && !(d.certificaten || []).length;
    if (leeg) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'pdHrMijn'; w.parentNode.insertBefore(el, w.nextSibling); }
    var h = '';
    (d.inwerk || []).filter(function (t2) { return !t2.klaarOp; }).forEach(function (t2) {
      var n = t2.stappen.filter(function (s) { return s.klaar; }).length;
      h += '<div style="' + kaartStijl + '"><div style="' + kopStijl + '">Mijn inwerklijst · ' + n + '/' + t2.stappen.length + '</div>' +
        '<div style="' + subStijl + 'margin-top:0.2rem;">Vink af wat je gedaan hebt; het kantoor kijkt mee.</div>' +
        t2.stappen.map(function (s) {
          return '<button data-pdhrvink="' + t2.id + '" data-stap="' + s.id + '" style="display:block;width:100%;text-align:left;margin-top:0.4rem;padding:0.5rem 0.7rem;border-radius:10px;border:1px solid var(--line,rgba(255,255,255,0.1));background:none;color:inherit;font:inherit;font-size:0.78rem;cursor:pointer;' + (s.klaar ? 'opacity:0.65;' : '') + '">' + (s.klaar ? '✓ ' : '○ ') + esc(s.tekst) + '</button>';
        }).join('') + '</div>';
    });
    if ((d.gesprekken || []).length) {
      h += '<div style="' + kaartStijl + '"><div style="' + kopStijl + '">Mijn groeigesprekken</div>' +
        '<div style="' + subStijl + 'margin-top:0.2rem;">Alleen jij en het management zien dit.</div>' +
        d.gesprekken.slice(-5).reverse().map(function (g) {
          return '<div style="margin-top:0.5rem;font-size:0.8rem;line-height:1.5;"><b>' + esc(g.datum) + ' · ' + esc(g.onderwerp) + '</b><br>' +
            esc(g.verslag) + (g.afspraken ? '<br><span style="' + subStijl + '">Afspraken: ' + esc(g.afspraken) + '</span>' : '') + '</div>';
        }).join('') + '</div>';
    }
    if ((d.certificaten || []).length) {
      h += '<div style="' + kaartStijl + '"><div style="' + kopStijl + '">Mijn certificaten</div>' +
        d.certificaten.map(function (c) {
          return '<div style="margin-top:0.4rem;font-size:0.8rem;">' + esc(c.soort) + (c.verlooptOp ? ' <span style="' + subStijl + '">t/m ' + esc(c.verlooptOp) + '</span>' : '') + '</div>';
        }).join('') + '</div>';
    }
    el.innerHTML = h;
  }

  function laad() { api('/supplier/hr/mijn').then(function (d) { if (d && d.ok) teken(d); }).catch(function () {}); }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pdhrvink]');
    if (!b) return;
    api('/supplier/hr/inwerk/vink', { trajectId: b.dataset.pdhrvink, stapId: b.dataset.stap }).then(laad).catch(function () {});
  });
  document.addEventListener('DOMContentLoaded', function () { setTimeout(laad, 1500); setTimeout(laad, 6000); });
})();
