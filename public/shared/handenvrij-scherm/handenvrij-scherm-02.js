  /* ---------- iets anders staat op vol scherm ---------- */
  function iemandAndersVolScherm() {
    var el = document.fullscreenElement || document.webkitFullscreenElement || null;
    return !!el && el !== chat && !chat.contains(el);
  }
  function kijkVolScherm() {
    var anders = iemandAndersVolScherm();
    if (anders && !weggeklapt) {
      weggeklapt = true; voorWeg = stand;
      document.body.classList.add('hv-weg');
    } else if (!anders && weggeklapt) {
      weggeklapt = false;
      document.body.classList.remove('hv-weg');
      zet(voorWeg === 'scherm' ? 'half' : voorWeg, false);
    } else if (!anders && stand === 'scherm' && !document.fullscreenElement) {
      // de gebruiker verliet ons volledige scherm met Escape
      zet('half', true);
    }
  }
  document.addEventListener('fullscreenchange', kijkVolScherm);
  document.addEventListener('webkitfullscreenchange', kijkVolScherm);

  /* BEGINNEN IN DE STAND DIE ER AL IS. Hier stond kaal `zet('min', false)`, en
     dat is bijna altijd goed: een verse pagina begint met een dicht paneel.

     BIJNA. Deze module is een eigen script en laadt op zijn eigen moment. Alles
     wat daarvóór het paneel opent -- een beurt uit handenvrij-chat.js, of de
     bevestigingskaart uit handenvrij-geld.js -- werd door deze ene regel weer
     dichtgeslagen, met inhoud en al. Na een herlaadactie is dat een echt venster
     van tientallen milliseconden. Het duurste geval is de bevestiging van een
     BETALING: die kaart zet de focus op "Ja, doorzetten" en Rahul vraagt hardop
     of hij het zal doorzetten, terwijl het paneel dicht is.

     `chat.hidden` staat bij het bouwen van de balk op true, dus false betekent
     hier: iemand heeft hem bewust opengedaan. Die neemt deze laag over in plaats
     van hem te overrulen. */
  zet(chat.hidden ? 'min' : bewaardeStand(), false);
  root.RTGChatScherm = { zet: function (s) { zet(s, true); }, stand: function () { return stand; }, greep: greep };
})(typeof self !== 'undefined' ? self : this);
