/* Een artikel blijft in Saloon, met de echte Edge bereikbaar. Elke opening
   haalt de gepubliceerde editie opnieuw bij de krant op. Geen conceptcache. */
(function (w) {
  'use strict';
  w.RTGSaloonLezer = function (host) {
    var vlak = document.createElement('article'); vlak.id = 'saloonArtikel'; vlak.hidden = true;
    vlak.setAttribute('aria-label', 'Verhaal in Saloon'); document.querySelector('main').appendChild(vlak);
    var nummer = 0, huidig = null, terugFocus = null, scroll = 0, slaOp = null;
    function sluit() {
      nummer++; huidig = null; vlak.hidden = true; vlak.textContent = '';
      document.body.classList.remove('saloon-leest'); host.veranderd(false);
      w.scrollTo(0, scroll); if (terugFocus && terugFocus.isConnected) terugFocus.focus({ preventScroll: true });
    }
    function terug() {
      if (huidig && history.state && history.state.saloonArtikel) history.back();
      else sluit();
    }
    function bewaren() {
      if (!slaOp) return;
      var b = vlak.querySelector('[data-lezer-bewaar]'); if (!b || b.disabled) return;
      b.disabled = true;
      slaOp().then(function (aan) {
        b.textContent = aan ? 'Bewaard' : 'Bewaren'; b.setAttribute('aria-pressed', String(aan));
      }).catch(function (e) { vlak.querySelector('[role="status"]').textContent = e.message; })
        .finally(function () { b.disabled = false; });
    }
    function open(i, bewaar, vervang) {
      var vraag = ++nummer, esc = w.RTGSaloon.esc;
      i.bewaard = host.bewaard(i.id);
      if (!huidig) { terugFocus = document.activeElement; scroll = w.scrollY; }
      huidig = i; slaOp = bewaar || function () { return host.bewaar(i); };
      if (!vervang) history.pushState({ saloonArtikel: i }, '', '#saloon-artikel');
      vlak.hidden = false; document.body.classList.add('saloon-leest'); host.veranderd(true);
      // Een geopend verhaal moet ook te ZIEN zijn. De warme wereldcompositie zet de
      // Saloon in een ingeklapt "volledig overzicht"; herstelt de lezer zich na een
      // herlaadbeurt of Vooruit, dan stond hij onzichtbaar in die dichte vouw.
      for (var vouw = vlak.closest('details:not([open])'); vouw; vouw = vouw.parentElement && vouw.parentElement.closest('details:not([open])')) vouw.open = true;
      vlak.innerHTML = '<nav class="saloon-lezerkop" aria-label="Artikelbediening"><button type="button" data-terug>‹ Saloon</button>'
        + '<button type="button" data-lezer-bewaar aria-pressed="' + String(!!i.bewaard) + '">' + (i.bewaard ? 'Bewaard' : 'Bewaren') + '</button></nav>'
        + '<div class="saloon-leesinhoud"><p role="status">Artikel ophalen…</p></div>';
      vlak.querySelector('[data-terug]').onclick = terug; vlak.querySelector('[data-lezer-bewaar]').onclick = bewaren;
      w.scrollTo(0, 0); vlak.querySelector('[data-terug]').focus({ preventScroll: true });
      w.RTGSaloonActies.verzoek('/api/krant/artikel', i.artikel).then(function (r) {
        if (vraag !== nummer) return;
        var a = r.artikel, inhoud = vlak.querySelector('.saloon-leesinhoud');
        // Gebruik het beeld van deze gepubliceerde editie, nooit een oud feedbeeld.
        var url = typeof a.beeld === 'string' ? a.beeld : '';
        var beeld = url && /^(https:\/\/|\/(?!\/))/.test(url)
          ? '<figure><img src="' + esc(url) + '" alt="' + '' + '"></figure>' : '';
        inhoud.innerHTML = beeld + '<div class="saloon-leestekst"><p class="saloon-bronlint">' + esc(a.naam || i.uitgever || 'Journalistiek') + '</p>'
          + '<h1 tabindex="-1">' + esc(a.titel) + '</h1><p class="saloon-auteur">' + esc(a.auteur || '') + '</p>'
          + (a.chapo ? '<p class="saloon-chapo">' + esc(a.chapo) + '</p>' : '')
          + '<div class="saloon-artikeltekst">' + String(a.inhoud || '').split(/\n+/).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>'
          + w.RTGPublicatieInfo(a, esc) + '<a class="saloon-bronlink" href="' + esc(i.url) + '">Open in de krant <span aria-hidden="true">→</span></a><p role="status"></p></div>';
        inhoud.querySelector('h1').focus({ preventScroll: true });
      }).catch(function (e) {
        if (vraag !== nummer) return;
        var inhoud = vlak.querySelector('.saloon-leesinhoud');
        inhoud.innerHTML = '<p role="status">' + esc(e.message) + '</p><button type="button" data-opnieuw>Opnieuw proberen</button>';
        inhoud.querySelector('button').onclick = function () { open(i, slaOp, true); };
      });
    }
    w.addEventListener('popstate', function () {
      if (history.state && history.state.saloonArtikel) open(history.state.saloonArtikel, null, true);
      else if (huidig) sluit();
    });
    return { open: open, terug: terug, bewaren: bewaren, herstel: function () {
      if (!huidig && history.state && history.state.saloonArtikel) open(history.state.saloonArtikel, null, true);
    }, sluit: function () {
      if (!huidig) return;
      // Een profielwissel beëindigt deze leesstand zonder een latere popstate
      // over de nieuwe profielweergave heen te laten tekenen.
      history.replaceState(null, '', location.pathname + location.search); sluit();
    } };
  };
}(window));
