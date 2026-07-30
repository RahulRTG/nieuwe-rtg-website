  /* ---- Rahul voor het gezin: de kindveilige vraagbaak op elke RTF-pagina.
     Praat op het niveau van je leeftijdsgroep, belooft nooit iets dat geld
     kost (alles hier is gratis) en wijst bij zware onderwerpen liefdevol
     naar een vertrouwde grote. ---- */
  var rCss = '.rsm-rahul{position:fixed;right:1rem;bottom:3.6rem;z-index:35;background:var(--goud,#857007);color:#000;border:none;border-radius:999px;padding:.6rem 1rem;font:600 .83rem Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.4);}' +
    '.rsm-rsheet{position:fixed;right:1rem;bottom:3.6rem;z-index:37;width:min(340px,92vw);background:var(--paneel,#151312);border:1px solid var(--goud,#857007);border-radius:16px;padding:.9rem;display:flex;flex-direction:column;gap:.6rem;color:var(--txt,#eee);font-family:Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);}' +
    '.rsm-rsheet[hidden]{display:none;}.rsm-ruit{font-size:.84rem;color:var(--zacht,#bbb);line-height:1.55;max-height:38vh;overflow-y:auto;white-space:pre-wrap;}';
  var rSt = document.createElement('style'); rSt.textContent = rCss; document.head.appendChild(rSt);
  var rFab = maakEl('<button class="rsm-rahul" type="button" aria-label="Vraag Rahul">✶ Rahul</button>');
  var rSheet = maakEl('<section class="rsm-rsheet" aria-label="Vraag Rahul" hidden>' +
    '<div class="rsm-kop"><span>✶ Vraag het Rahul</span><button class="rsm-x" type="button" aria-label="Sluiten">✕</button></div>' +
    '<div class="rsm-ruit" aria-live="polite"></div>' +
    '<form class="rsm-rij"><input placeholder="Wat wil je weten?" maxlength="300" autocomplete="off" aria-label="Je vraag"><button class="rsm-go" type="submit" aria-label="Versturen">→</button></form></section>');
  document.body.appendChild(rFab); document.body.appendChild(rSheet);
  var rUit = rSheet.querySelector('.rsm-ruit'), rForm = rSheet.querySelector('form'), rInp = rForm.querySelector('input');
  rFab.addEventListener('click', function () {
    rSheet.hidden = false; rFab.hidden = true; rInp.focus();
    if (!rUit.textContent) rUit.textContent = 'Hoi! Vraag me wat je wilt: over de apps, over leren, of gewoon iets dat je bezighoudt. Alles hier is gratis en veilig.';
  });
  rSheet.querySelector('.rsm-x').addEventListener('click', function () { rSheet.hidden = true; rFab.hidden = false; });
  rForm.addEventListener('submit', function (ev) {
    ev.preventDefault(); var q = rInp.value.trim(); if (!q) return; rInp.value = '';
    rUit.textContent = 'Rahul denkt na…';
    fetch('/api/rtf/rahul', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: s.code, token: s.token, q: q }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { rUit.textContent = (d && (d.antwoord || d.error)) || 'Ik kwam er even niet uit; probeer het nog eens.'; })
      .catch(function () { rUit.textContent = 'Even geen verbinding; probeer het zo nog een keer.'; });
  });
})();
