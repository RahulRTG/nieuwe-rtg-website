  /* Een Salon-code is een sleutel, geen profielveld. Zij staat daarom alleen
     in dit vluchtige venster na uitgifte/rotatie en nooit in app-state,
     localStorage of een volgende API-response. */
  function toonSalonCode(code){
    const oud = document.getElementById('salonCodeEenmalig');
    if (oud) oud.remove();
    const ov = document.createElement('div');
    ov.id = 'salonCodeEenmalig';
    ov.style.cssText = 'position:fixed;inset:0;z-index:130;background:rgba(0,0,0,.7);display:grid;place-items:center;padding:1rem;';
    const kaart = document.createElement('div');
    kaart.setAttribute('role', 'dialog');
    kaart.setAttribute('aria-modal', 'true');
    kaart.setAttribute('aria-labelledby', 'salonCodeTitel');
    kaart.style.cssText = 'width:min(440px,100%);background:var(--bg);color:var(--txt);border:1px solid var(--gold);padding:1.2rem;box-shadow:0 24px 70px rgba(0,0,0,.45);';
    kaart.innerHTML = '<div id="salonCodeTitel" style="font-family:\'Bodoni Moda\',serif;font-size:1.35rem;">' +
      T('sal.codeeenmalig', 'Uw eenmalige claimcode') + '</div>' +
      '<p style="color:var(--soft);font-size:.8rem;line-height:1.55;">' +
      T('sal.codeuitleg', 'Bewaar of kopieer deze code nu. Voor uw veiligheid toont RTG haar hierna niet opnieuw.') + '</p>' +
      '<div id="salonCodeWaarde" style="padding:.85rem;border:1px solid var(--line);font-weight:700;letter-spacing:.08em;overflow-wrap:anywhere;"></div>' +
      '<div style="display:flex;gap:.55rem;margin-top:1rem;flex-wrap:wrap;">' +
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
    if (!c) return '<button class="js-claim" style="margin-top:.5rem;background:var(--knop);color:var(--knop-txt);border:none;padding:.45rem .95rem;font-size:.72rem;font-weight:600;font-family:inherit;cursor:pointer;">' +
      T('sal.claim','Claim deze aanbieding') + '</button>';
    const labels = { actief: T('sal.claimactief','Claim actief'),
      verzilverd: T('sal.claimverzilverd','Verzilverd'),
      ingetrokken: T('sal.claimingetrokken','Ingetrokken'),
      verlopen: T('sal.claimverlopen','Verlopen'),
      'legacy-gesloten': T('sal.claimvernieuw','Oude code veilig gesloten'),
      ongeldig: T('sal.claimongeldig','Code niet actief') };
    const status = labels[c.status] || T('sal.claimongeldig','Code niet actief');
    if (c.status === 'verzilverd') return '<div style="margin-top:.45rem;font-size:.76rem;color:var(--rtg-leesgoud,var(--gold));">✓ ' + status + '</div>';
    return '<div style="margin-top:.45rem;font-size:.76rem;color:var(--rtg-leesgoud,var(--gold));">' + status + '</div>' +
      '<div style="display:flex;gap:.45rem;flex-wrap:wrap;margin-top:.45rem;">' +
      '<button class="js-claim-rotate" style="background:var(--knop);color:var(--knop-txt);border:none;padding:.42rem .75rem;font:600 .68rem inherit;cursor:pointer;">' + T('sal.nieuwecode','Nieuwe code') + '</button>' +
      (c.status === 'actief' ? '<button class="js-claim-revoke" style="background:none;color:var(--soft);border:1px solid var(--line);padding:.42rem .75rem;font:600 .68rem inherit;cursor:pointer;">' + T('sal.trekin','Trek in') + '</button>' : '') + '</div>';
  }
