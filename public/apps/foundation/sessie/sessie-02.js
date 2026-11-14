/* de ongelezen-teller */
      telOngelezen(el);
    }
  };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function telOngelezen(el) {
    var s = lees(); if (!s) return;
    fetch('/api/foundation/gezin/' + s.code + '/mij', { headers: { Authorization: 'Bearer ' + s.token } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (!d) return; var t = el.querySelector('#sbTel'); if (d.ongelezen > 0) { t.textContent = d.ongelezen; t.hidden = false; } else t.hidden = true; })
      .catch(function () {});
  }
  function laadBerichten(el) {
    var s = lees(); var box = el.querySelector('#sbBerichten');
    box.innerHTML = '<div class="sb-leeg">Berichten laden...</div>';
    fetch('/api/foundation/gezin/' + s.code + '/berichten', { headers: { Authorization: 'Bearer ' + s.token } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var lijst = (d.berichten || []);
        if (!lijst.length) { box.innerHTML = '<div class="sb-leeg">Nog geen berichten. Je gezin kan hier iets achterlaten.</div>'; return; }
        box.innerHTML = lijst.map(function (b) {
          var extra = b.soort === 'reis' ? '<a class="sb-reisknop" href="reis.html">Naar de reis</a>' : '';
          var kop = b.soort === 'hulp' ? '<div class="sb-hulplabel">SOS Vraagt om hulp</div>' : '';
          var wie = b.vanMij ? 'Jij' : esc(b.vanNaam);
          var aan = b.naar === 'allen' ? '' : '<span class="sb-aan"> aan ' + esc(b.naarNaam) + '</span>';
          return '<div class="sb-b ' + (b.soort || '') + '">' + kop + '<div class="sb-bkop">' + (b.vanAvatar || '') + ' <b>' + wie + '</b>' + aan + '</div><div class="sb-btxt">' + esc(b.tekst) + '</div>' + extra + '</div>';
        }).join('');
        api('/gezin/bericht/gelezen', { code: s.code, token: s.token }).then(function () { var t = el.querySelector('#sbTel'); if (t) t.hidden = true; }).catch(function () {});
      }).catch(function () { box.innerHTML = '<div class="sb-leeg">Kon berichten niet laden.</div>'; });
  }
  /* Dezelfde balk met DS-vorm; oorspronkelijke ids blijven gedragshaken. */
  function sessieVorm(el) {
    el.classList.add('ds-foundation-balk');
    var klassen = { 'sb-balk': 'ds-foundation-sessierij', 'sb-brand': 'ds-foundation-merk',
      'sb-terug': 'ds-knop ds-knop--klein', 'sb-safe': 'ds-meta',
      'sb-bel': 'ds-knop ds-knop--klein', 'sb-prof': 'ds-knop ds-knop--klein',
      'sb-tel': 'ds-foundation-teller', 'sb-av': 'ds-foundation-avatar',
      'sb-menu': 'ds-foundation-menu', 'sb-berichten': 'ds-foundation-berichten' };
    Object.keys(klassen).forEach(function (naam) {
      el.querySelectorAll('.' + naam).forEach(function (node) { klassen[naam].split(' ').forEach(function (k) { node.classList.add(k); }); });
    });
    el.querySelectorAll('.sb-menu a').forEach(function (a) { a.classList.add('ds-knop', 'ds-knop--stil'); });
    var prof = el.querySelector('#sbProf'), bel = el.querySelector('#sbBel');
    prof.setAttribute('aria-controls', 'sbMenu'); bel.setAttribute('aria-controls', 'sbBerichten');
    prof.setAttribute('aria-expanded', 'false'); bel.setAttribute('aria-expanded', 'false');
    el.addEventListener('click', function () {
      prof.setAttribute('aria-expanded', String(!el.querySelector('#sbMenu').hidden));
      bel.setAttribute('aria-expanded', String(!el.querySelector('#sbBerichten').hidden));
    });
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var menu = el.querySelector('#sbMenu'), berichten = el.querySelector('#sbBerichten');
      var bron = !menu.hidden ? prof : !berichten.hidden ? bel : null;
      if (!bron) return;
      e.preventDefault(); e.stopPropagation(); menu.hidden = true; berichten.hidden = true;
      prof.setAttribute('aria-expanded', 'false'); bel.setAttribute('aria-expanded', 'false');
      bron.focus();
    });
  }
  function injectCss() {
    laadSessiePresentatie('/ds/rtg-ds.css');
  }
  w.Sessie = Sessie;
  /* Draait meteen wanneer sessie.js wordt gelezen, dus nog voordat de pagina
     bruikbaar wordt. De server beslist; bij storing blijft de deur dicht. */
  controleerToegang();
})(window);
