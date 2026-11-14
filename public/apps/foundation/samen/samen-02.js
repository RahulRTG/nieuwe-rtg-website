  /* ---- Rahul voor het gezin: de kindveilige vraagbaak op elke RTF-pagina.
     Praat op het niveau van je leeftijdsgroep, belooft nooit iets dat geld
     kost (alles hier is gratis) en wijst bij zware onderwerpen liefdevol
     naar een vertrouwde grote. ---- */
  /* Ook Rahul staat in de balk, niet zwevend in de hoek. Zie samen-01.js. */
  /* Rahul gebruikt dezelfde centrale Samen-component als de kamer. */
  var rFab = maakEl('<button class="rsm-rahul" type="button" aria-label="Vraag Rahul" aria-haspopup="dialog" data-stand="rahul-venster">✶ Rahul</button>');
  var rSheet = maakEl('<section class="rsm-rsheet" role="dialog" aria-modal="false" aria-label="Vraag Rahul" hidden>' +
    '<div class="rsm-kop"><span>✶ Vraag het Rahul</span><button class="rsm-x" type="button" aria-label="Sluiten">✕</button></div>' +
    '<div class="rsm-ruit" aria-live="polite"></div>' +
    '<form class="rsm-rij"><input placeholder="Wat wil je weten?" maxlength="300" autocomplete="off" aria-label="Je vraag"><button class="rsm-go" type="submit" aria-label="Versturen" data-contextactie>→</button></form></section>');
  (function dokR() {
    if (window.rtfDok && window.rtfDok(rFab)) return;
    var n = 0, tik = setInterval(function () {
      if ((window.rtfDok && window.rtfDok(rFab)) || ++n > 20) {
        clearInterval(tik);
        if (!rFab.parentNode) { var m = document.querySelector('main, .wrap') || document.body; m.insertBefore(rFab, m.firstChild); }
      }
    }, 150);
  })();
  document.body.appendChild(rSheet);
  var rUit = rSheet.querySelector('.rsm-ruit'), rForm = rSheet.querySelector('form'), rInp = rForm.querySelector('input');
  var rBezig = false, rStuur = rForm.querySelector('button');
  function rZelfdeProfiel() { var nu = Sessie.huidig(); return !!(nu && nu.code === s.code && nu.token === s.token &&
    (nu.profiel && nu.profiel.id) === (s.profiel && s.profiel.id)); }
  rFab.addEventListener('click', function () {
    rSheet.hidden = false; rFab.hidden = true; rInp.focus();
    if (!rUit.textContent) rUit.textContent = 'Hoi! Vraag me wat je wilt: over de apps, over leren, of gewoon iets dat je bezighoudt. Alles hier is gratis en veilig.';
  });
  rSheet.querySelector('.rsm-x').addEventListener('click', function () { sluitPaneel(rSheet, rFab); });
  paneelToets(rSheet, rFab);
  rForm.addEventListener('submit', function (ev) {
    ev.preventDefault(); var q = rInp.value.trim(); if (!q || rBezig || !rZelfdeProfiel()) return; rInp.value = '';
    rBezig = true; rStuur.disabled = true;
    rUit.textContent = 'Rahul denkt na…';
    fetch('/api/rtf/rahul', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: s.code, token: s.token, q: q }) })
      .then(function (r) { return r.json().then(function (d) {
        if (!r.ok || !d || d.error || d.ok === false || typeof d.antwoord !== 'string' || !d.antwoord.trim()) throw new Error(d && d.error || 'Geen antwoord');
        return d;
      }); })
      .then(function (d) {
        if (!rZelfdeProfiel()) { rUit.textContent = 'Je profiel is gewijzigd. Open deze ruimte opnieuw.'; return; }
        rUit.textContent = (d && (d.antwoord || d.error)) || 'Ik kwam er even niet uit; probeer het nog eens.'; })
      .catch(function () {
        if (!rZelfdeProfiel()) { rUit.textContent = 'Je profiel is gewijzigd. Open deze ruimte opnieuw.'; return; }
        rUit.textContent = 'Even geen verbinding; probeer het zo nog een keer.';
        if (!rInp.value) rInp.value = q;
      }).finally(function () { rBezig = false; rStuur.disabled = false; });
  });
})();
