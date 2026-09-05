  /* Een Salon-code is een sleutel, geen profielveld. Zij staat daarom alleen
     in dit vluchtige venster na uitgifte/rotatie en nooit in app-state,
     localStorage of een volgende API-response. */
  function toonSalonCode(code){
    const oud = document.getElementById('salonCodeEenmalig');
    if (oud) oud.remove();
    const ov = document.createElement('div');
    ov.id = 'salonCodeEenmalig';
    ov.className = 'salon-code-laag';
    const kaart = document.createElement('div');
    kaart.className = 'salon-code-kaart';
    kaart.setAttribute('role', 'dialog');
    kaart.setAttribute('aria-modal', 'true');
    kaart.setAttribute('aria-labelledby', 'salonCodeTitel');
    kaart.innerHTML = '<div id="salonCodeTitel" class="salon-code-titel">' +
      T('sal.codeeenmalig', 'Uw eenmalige claimcode') + '</div>' +
      '<p class="salon-code-uitleg">' +
      T('sal.codeuitleg', 'Bewaar of kopieer deze code nu. Voor uw veiligheid toont RTG haar hierna niet opnieuw.') + '</p>' +
      '<div id="salonCodeWaarde" class="salon-code-waarde"></div>' +
      '<div class="salon-code-acties">' +
      '<button id="salonCodeKopieer" class="knop">' + T('alg.kopieer', 'Kopieer') + '</button>' +
      '<button id="salonCodeSluit" class="knop secundair">' + T('alg.klaar', 'Klaar') + '</button></div>';
    ov.appendChild(kaart);
    document.body.appendChild(ov);
    kaart.querySelector('#salonCodeWaarde').textContent = String(code || '');
    const sluit = () => ov.remove();
    kaart.querySelector('#salonCodeSluit').addEventListener('click', sluit);
    kaart.querySelector('#salonCodeKopieer').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(String(code || '')); toast(T('alg.gekopieerd', 'Gekopieerd.')); }
      catch (e) { toast(T('sal.kopieermislukt', 'Kopiëren lukte niet. Selecteer de code handmatig.')); }
    });
    ov.addEventListener('click', e => { if (e.target === ov) sluit(); });
    kaart.querySelector('#salonCodeKopieer').focus();
  }
  function salonClaimBediening(deal){
    const c = deal && deal.mijnClaim;
    if (!c) return '<button class="js-claim salon-claim-hoofd">' +
      T('sal.claim','Claim deze aanbieding') + '</button>';
    const labels = { actief: T('sal.claimactief','Claim actief'),
      verzilverd: T('sal.claimverzilverd','Verzilverd'),
      ingetrokken: T('sal.claimingetrokken','Ingetrokken'),
      verlopen: T('sal.claimverlopen','Verlopen'),
      'legacy-gesloten': T('sal.claimvernieuw','Oude code veilig gesloten'),
      ongeldig: T('sal.claimongeldig','Code niet actief') };
    const status = labels[c.status] || T('sal.claimongeldig','Code niet actief');
    if (c.status === 'verzilverd') return '<div class="salon-claim-status">✓ ' + status + '</div>';
    return '<div class="salon-claim-status">' + status + '</div>' +
      '<div class="salon-claim-acties">' +
      '<button class="js-claim-rotate salon-claim-nieuw">' + T('sal.nieuwecode','Nieuwe code') + '</button>' +
      (c.status === 'actief' ? '<button class="js-claim-revoke salon-claim-intrek">' + T('sal.trekin','Trek in') + '</button>' : '') + '</div>';
  }
