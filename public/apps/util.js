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

  /* Veilige component-/DOM-bouwer (hyperscript). Bouwt elementen zonder ooit
     innerHTML met gebruikersinvoer te vullen: tekst gaat altijd via
     textContent, dus invoer kan nooit als HTML draaien. Zo bouw je schermen op
     uit kleine, herbruikbare stukjes in plaats van HTML-strings aan elkaar te
     plakken.
       el('div', { class:'rij', onclick: fn, dataset:{ id:'x' } }, 'tekst', el('b', null, naam))
     props: class, style (object), dataset (object), on<Event> (functie ->
     addEventListener), overige -> setAttribute. Kinderen: tekst, node, array of
     null/false (overgeslagen). */
  function el(tag, props) {
    var n = document.createElement(tag), i, k, v;
    if (props) for (k in props) {
      v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'style' && typeof v === 'object') for (var s in v) n.style[s] = v[s];
      else if (k === 'dataset' && typeof v === 'object') for (var d in v) n.dataset[d] = v[d];
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v === true ? '' : String(v));
    }
    function voeg(c) {
      if (c == null || c === false) return;
      if (Array.isArray(c)) { c.forEach(voeg); return; }
      n.appendChild(c && c.nodeType ? c : document.createTextNode(String(c)));
    }
    for (i = 2; i < arguments.length; i++) voeg(arguments[i]);
    return n;
  }
  // Leeg een container en zet er nieuwe kinderen (nodes/tekst/arrays) in.
  function vervang(container) {
    if (!container) return;
    container.textContent = '';
    for (var i = 1; i < arguments.length; i++) {
      var c = arguments[i];
      (Array.isArray(c) ? c : [c]).forEach(function (x) {
        if (x != null && x !== false) container.appendChild(x && x.nodeType ? x : document.createTextNode(String(x)));
      });
    }
  }

  w.Util = { escapeHTML: escapeHTML, initialen: initialen, tekst: tekst, el: el, vervang: vervang };
})(window);
