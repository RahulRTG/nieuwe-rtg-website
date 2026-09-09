/* Veilig & Vertrouwd brengt bestaande gezinsstatus, toestemmingen en hulp bij
   elkaar. De korte status deelt nadrukkelijk geen GPS-positie. */
(function (w, d) {
  'use strict';
  if (!w.Sessie || !Sessie.eisFamilie()) return;
  var sessie = Sessie.huidig(), W = w.RTGVeiligVertrouwdWeergave;
  var staat = { locaties:[], ikDeel:false, kring:null };
  function json(r) { return r.json().catch(function () { return {}; }).then(function (x) { if (!r.ok) throw new Error(x.error || 'Deze gegevens zijn nu niet bereikbaar.'); return x; }); }
  function locaties() {
    return fetch('/api/foundation/gezin/' + encodeURIComponent(sessie.code) + '/locaties', { headers:{ Authorization:'Bearer ' + sessie.token } }).then(json);
  }
  function kring() {
    return fetch('/api/rtf/leven/kring', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ code:sessie.code, token:sessie.token }) }).then(json);
  }
  function laad() {
    return Promise.allSettled([locaties(), kring()]).then(function (uit) {
      if (uit[0].status === 'fulfilled') { staat.locaties = uit[0].value.locaties || []; staat.ikDeel = !!uit[0].value.ikDeel; }
      if (uit[1].status === 'fulfilled') staat.kring = uit[1].value;
      W.alles(staat);
    });
  }
  function open(naam) {
    d.querySelectorAll('[data-vv-view]').forEach(function (v) { var aan = v.dataset.vvView === naam; v.hidden = !aan; v.classList.toggle('is-actief', aan); });
    d.querySelectorAll('[data-vv-tab]').forEach(function (b) { var aan = b.dataset.vvTab === naam; b.classList.toggle('is-actief', aan); if (aan) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    w.scrollTo({ top:0, behavior:'smooth' });
  }
  function deelStatus(knop) {
    var melding = d.getElementById('vvStatusMelding'), status = knop.dataset.vvStatus;
    knop.disabled = true; melding.className = 'vv-melding'; melding.textContent = 'Uw keuze wordt gedeeld met uw gezin.';
    Sessie.api('/gezin/locatie', { code:sessie.code, token:sessie.token, status:status }).then(function () {
      melding.className = 'vv-melding is-gelukt';
      melding.textContent = status === 'veilig thuis' ? 'Uw gezin ziet nu: veilig thuis.' : 'Uw gezin ziet nu: onderweg. Uw precieze locatie is niet gedeeld.';
      return laad();
    }).catch(function (e) { melding.className = 'vv-melding is-fout'; melding.textContent = e.message; }).finally(function () { knop.disabled = false; });
  }
  d.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-vv-tab],[data-vv-open]'), status = e.target.closest('[data-vv-status]');
    if (nav) { open(nav.dataset.vvTab || nav.dataset.vvOpen); return; }
    if (status) deelStatus(status);
  });
  W.alles(staat); laad();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(function () {});
})(window, document);
