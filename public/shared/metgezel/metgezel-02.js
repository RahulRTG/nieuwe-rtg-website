    /* ---------- Rahul heeft een melding: de lippen verkleuren en bewegen ----------
       We halen zuinig de eigen seintjes op (kern/fluister). Zijn er nieuwe
       (t.o.v. wat de gebruiker al zag), dan gloeit de knop, komt er een teken
       met het aantal en bewegen de lippen af en toe. Tikt de gebruiker, dan
       ziet ze de melding boven de vraagbalk en kan ze meteen reageren. */
    var stip = null, laatsteSeintjes = [], meldTimer = null;
    var ZIEN = 'rtg_rahul_gezien';
    function gezienIds() { try { return JSON.parse(localStorage.getItem(ZIEN) || '[]'); } catch (e) { return []; } }
    function bewaarGezien(ids) { try { localStorage.setItem(ZIEN, JSON.stringify(ids.slice(0, 60))); } catch (e) {} }
    function idVan(s) { return (s && (s.id || s.tekst || (s.titel || '') + (s.bron || ''))) || ''; }
    function nieuweSeintjes() { var g = gezienIds(); return laatsteSeintjes.filter(function (s) { return g.indexOf(idVan(s)) === -1; }); }
    function toonMelding() {
      var nieuw = nieuweSeintjes();
      if (!nieuw.length) { doofMelding(); return; }
      fab.classList.add('mgz-meld');
      if (!stip) { stip = maakEl('<span class="mgz-stip"></span>'); fab.appendChild(stip); }
      stip.textContent = nieuw.length > 9 ? '9+' : String(nieuw.length);
      if (!meldTimer) meldTimer = setInterval(function () { if (!document.hidden && fab.classList.contains('mgz-meld')) mond.praat(700); }, 4200);
    }
    function doofMelding() {
      fab.classList.remove('mgz-meld');
      if (stip) { stip.remove(); stip = null; }
      if (meldTimer) { clearInterval(meldTimer); meldTimer = null; }
      if (laatsteSeintjes.length) bewaarGezien(laatsteSeintjes.map(idVan));
      tekenSeintjes();
    }
    function tekenSeintjes() {
      if (!seintjesVak) return;
      if (!laatsteSeintjes.length) { seintjesVak.innerHTML = ''; return; }
      seintjesVak.innerHTML = laatsteSeintjes.slice(0, 5).map(function (s) {
        var t = typeof s === 'string' ? s : (s.tekst || s.titel || '');
        var kop = (s && s.titel && s.tekst) ? '<b>' + esc(s.titel) + '</b>' : '';
        return '<button class="mgz-seintje" type="button" data-vraag="' + esc(s && s.actie ? s.actie : t) + '">' + kop + esc(t) + '</button>';
      }).join('');
      [].forEach.call(seintjesVak.querySelectorAll('.mgz-seintje'), function (b) {
        b.addEventListener('click', function () { inp.value = b.getAttribute('data-vraag') || ''; inp.focus(); });
      });
    }
    function haalSeintjes() {
      if (!memTok || document.hidden) return;
      fetch('/api/fluister/profiel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + memTok }, body: '{}' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (!d) return; laatsteSeintjes = (d.seintjes || []).filter(Boolean); tekenSeintjes(); if (sheet.hidden) toonMelding(); })
        .catch(function () {});
    }
    if (memTok) {
      haalSeintjes();
      setInterval(haalSeintjes, 60000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) haalSeintjes(); });
    }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); var q = inp.value.trim(); if (!q) return; inp.value = '';
      uit.textContent = 'Rahul denkt na...';
      /* Voor een zware taak stroomt de server live de voortgang ("Stap 4/24:
         taxi zoeken...") over de eigen SSE-verbinding. We openen die alleen
         zolang de vraag loopt en sluiten hem als het antwoord er is. */
      var vBron = null;
      if (memTok && window.EventSource) {
        try {
          vBron = new EventSource('/api/stream?token=' + encodeURIComponent(memTok));
          vBron.addEventListener('rahul-voortgang', function (e) {
            var v = {}; try { v = JSON.parse(e.data); } catch (x) {}
            if (v.klaar) return;
            if (v.totaal) { uit.textContent = 'Stap ' + v.stap + '/' + v.totaal + (v.bericht ? ': ' + v.bericht : '') + '...'; mond.praat(600); }
          });
        } catch (e) {}
      }
      var sluitBron = function () { if (vBron) { try { vBron.close(); } catch (e) {} vBron = null; } };
      fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ q: q }) })
        .then(function (r) { return r.json(); })
        .then(function (d) { sluitBron(); uit.textContent = (d && (d.antwoord || d.reply || d.error)) || 'Ik kwam er niet uit.'; mond.praat(1400); })
        .catch(function () { sluitBron(); uit.textContent = 'Even geen verbinding; probeer het zo weer.'; });
    });

