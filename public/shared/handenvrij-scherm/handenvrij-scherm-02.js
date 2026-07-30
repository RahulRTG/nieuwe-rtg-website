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

  zet('min', false);
  root.RTGChatScherm = { zet: function (s) { zet(s, true); }, stand: function () { return stand; }, greep: greep };
})(typeof self !== 'undefined' ? self : this);
