// Laadt het gekozen voertuig en behandelt ontbrekende voertuiggegevens.
  function geenVoertuig(tekst) {
    $('#dit').hidden = true;
    $('#geen').hidden = false;
    document.body.dataset.dsSchermtype = 'collectie';
    $('#geenTekst').textContent = tekst;
    return false;
  }

  function laadfout(tekst) {
    leeg($('#vloot'));
    team = null;
    $('#vlootLet').textContent = 'Kies Ververs om de vloot opnieuw op te halen.';
    return geenVoertuig(tekst);
  }

  async function haalVloot() {
    if (!token) {
      return geenVoertuig('Dit scherm is van de vervoerder: meld u aan met uw personeelssleutel. Zonder sleutel wordt hier niets getoond -- dat is geen leeg scherm maar een gesloten deur.');
    }
    let r;
    try { r = await api('vloot'); }
    catch (e) { return laadfout('De vloot kon niet worden opgehaald. Controleer uw verbinding en kies Ververs om opnieuw te proberen.'); }
    if (r.status !== 200) {
      return laadfout((r.body && r.body.error) || 'De vloot kon niet worden geladen. Probeer opnieuw met Ververs.');
    }
    if (!r.body || !Array.isArray(r.body.assets) ||
        !r.body.assets.every(a => a && typeof a.id === 'string') ||
        (r.body.team != null && !Array.isArray(r.body.team))) {
      return laadfout('De vlootgegevens zijn niet compleet. Kies Ververs om opnieuw te proberen.');
    }
    const assets = r.body.assets;
    team = (r.body && r.body.team) || null;
    toonVloot(assets);
    if (!gevraagd) {
      geenVoertuig('Kies een voertuig uit de vloot hieronder, of open er een met een adres: ?voertuig=<id>.');
      return true;
    }
    const v = assets.find(a => a.id === gevraagd);
    if (!v) {
      /* Er wordt NIET geraden welk voertuig bedoeld werd: een vreemd id en een
         verdwenen id zeggen we niet uit elkaar, want dat verschil verraadt of
         een voertuig bij een ander bestaat. */
      return geenVoertuig('Voertuig "' + gevraagd + '" staat niet in deze vloot. Dat betekent of dat het niet (meer) bestaat, of dat het bij een andere vervoerder hoort; welke van de twee zegt dit scherm bewust niet.');
    }
    toonDit(v); toonPapieren(v); toonBestuurder(v);
    return true;
  }

  /* Ook de eerste lading en herladen na Bewaar lopen door dezelfde rij.
     Zo kan een eerder antwoord nooit een later opgehaalde stand vervangen. */
  let laden = null;
  function laad() {
    $('#ververs').disabled = true;
    const taak = (laden || Promise.resolve()).then(haalVloot, haalVloot);
    laden = taak;
    return taak.finally(() => {
      if (laden === taak) {
        laden = null;
        $('#ververs').disabled = false;
      }
    });
  }

  $('#ververs').addEventListener('click', async () => {
    if ($('#ververs').disabled) return;
    zeg('De vloot wordt opgehaald…');
    zeg(await laad() ? 'Bijgewerkt.' : 'Verversen mislukt. Bekijk de melding bij het voertuig.');
  });
  laad();
})();
