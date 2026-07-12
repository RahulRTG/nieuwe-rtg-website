/* Gedeelde front-end-hulp voor alle apps. Eén plek voor het veilig tonen van
   door gebruikers ingevoerde tekst (codenamen, berichten), zodat elke app
   dezelfde XSS-verdediging gebruikt in plaats van een eigen kopie.
   Laden met <script src="/apps/util.js"></script>; bereikbaar als window.Util. */
(function (w) {
  var kaart = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  // Zet tekst om zodat hij nooit als HTML wordt uitgevoerd.
  function escapeHTML(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return kaart[c]; }); }
  // Initialen uit een codenaam (bijv. "Gouden Vos AB12" -> "GV").
  function initialen(cn) { return String(cn || '?').trim().split(/\s+/).map(function (x) { return x[0]; }).slice(0, 2).join('').toUpperCase(); }
  // Zet tekst veilig in een element (nooit innerHTML met ruwe invoer).
  function tekst(el, t) { if (el) el.textContent = String(t == null ? '' : t); }
  w.Util = { escapeHTML: escapeHTML, initialen: initialen, tekst: tekst };
})(window);
