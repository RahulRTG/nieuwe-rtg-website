/* EEN VASTGELOPEN TERUGBETALING -- de regel en de knop op de lijst van de
   betaalkamer (Financien), bij /api/office/betalingen/terug/afhandel.

   De veegronde (server/kern/betaalwaarheid/terugveeg.js) vraagt een terugbetaling
   zonder providerbevestiging zes keer na en escaleert hem daarna naar een mens.
   Eigenaarsbesluit van 19 oktober 2026: die mens vindt hem hier, op de bestaande
   lijst, als "terugbetaling vastgelopen" -- geen nieuw scherm.

   Wat de knop doet, en wat niet:
   - hij legt vast wat de medewerker bij de provider ZAG: het geld is terug, of het
     is niet terug. Hij betaalt zelf niets terug en belt geen provider;
   - de naam komt uit de kantoorsessie (naamAuth); de gedeelde kantoorcode krijgt
     een weigering van de server, en dit scherm toont die gewoon;
   - een reden van ten minste tien tekens is verplicht en blijft bij de opdracht.

   Gebruik: RTGTerugVastgelopen({ api, meld, esc }) geeft { regel, bedraad }. */
window.RTGTerugVastgelopen = function (o) {
  'use strict';
  const { api, meld, esc } = o;
  const sleutel = p => esc(p.betalingId) + '|' + esc(p.opdrachtId);

  function regel(p) {
    const k = sleutel(p);
    return '<div class="betaal-waarschuwing" data-tvrij="' + k + '"><strong>Terugbetaling vastgelopen</strong> · ' +
      esc(String(p.tekst || '').replace(/^Terugbetaling vastgelopen:\s*/, '')) +
      '<div class="taakrij">' +
        '<input class="veld h-flex1" maxlength="300" data-tvreden="' + k + '" ' +
          'placeholder="Wat zag u bij de provider? (verplicht, ten minste tien tekens)">' +
        '<button class="knop" type="button" data-tvuit="terug" data-tv="' + k + '">Het geld is terug</button>' +
        '<button class="knop stil" type="button" data-tvuit="niet-terug" data-tv="' + k + '">Het geld is niet terug</button>' +
      '</div></div>';
  }

  function bedraad(wortel, herlaad) {
    wortel.querySelectorAll('button[data-tv]').forEach(b => b.addEventListener('click', async () => {
      const [betalingId, opdrachtId] = b.dataset.tv.split('|');
      const veld = wortel.querySelector('input[data-tvreden="' + b.dataset.tv + '"]');
      b.disabled = true;
      try {
        await api('betalingen/terug/afhandel', { betalingId, opdrachtId, uitkomst: b.dataset.tvuit, reden: veld ? veld.value : '' });
        meld(b.dataset.tvuit === 'terug'
          ? 'Vastgelegd op uw naam: het geld is terug. De terugbetaling telt nu.'
          : 'Vastgelegd op uw naam: het geld is niet terug. De betaling staat nu bij controle.');
        if (herlaad) herlaad();
      } catch (e) { b.disabled = false; meld(e.message); }
    }));
  }

  return { regel, bedraad };
};
