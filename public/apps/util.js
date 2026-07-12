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

  /* Klein reactief componentraamwerk. mount(container, render) tekent meteen en
     geeft een teken-functie terug; roep die na een wijziging aan en het scherm
     bouwt zichzelf opnieuw op uit el(). store(begin) is een piepklein
     reactief geheugen dat na set() alle gekoppelde mounts opnieuw tekent. */
  function mount(container, render) {
    function teken() { if (container) vervang(container, render()); }
    teken();
    return teken;
  }
  function store(begin) {
    var staat = begin || {}, kijkers = [];
    return {
      get: function (k) { return k == null ? staat : staat[k]; },
      set: function (nieuw) { for (var k in nieuw) staat[k] = nieuw[k]; kijkers.forEach(function (f) { f(staat); }); },
      koppel: function (f) { kijkers.push(f); return f; }
    };
  }

  /* Toegankelijkheid ---------------------------------------------------------
     toast(): een korte melding die schermlezers voorlezen (aria-live). */
  var liveEl = null;
  function toast(bericht, soort) {
    if (!liveEl) {
      liveEl = el('div', { id: 'util-live', role: 'status', 'aria-live': 'polite',
        style: { position: 'fixed', left: '50%', bottom: '1.4rem', transform: 'translateX(-50%)', zIndex: 10002,
          background: '#222', color: '#fff', padding: '.6rem 1rem', borderRadius: '10px', fontSize: '.85rem',
          boxShadow: '0 4px 20px rgba(0,0,0,.4)', opacity: '0', transition: 'opacity .2s', pointerEvents: 'none', maxWidth: '90vw' } });
      document.body.appendChild(liveEl);
    }
    tekst(liveEl, bericht);
    liveEl.style.opacity = '1';
    clearTimeout(liveEl._t);
    liveEl._t = setTimeout(function () { liveEl.style.opacity = '0'; }, (soort === 'lang' ? 5000 : 2800));
  }

  /* dialoog(el): maakt een overlay/dialog toegankelijk: focus gaat erin, blijft
     erin (focus-trap), Escape sluit, en de focus keert terug naar waar hij was.
     Roep aan bij openen; geeft een sluit-functie terug. */
  function focusbaar(root) {
    return [].slice.call(root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'))
      .filter(function (e) { return e.offsetParent !== null; });
  }
  function dialoog(root, opSluit) {
    var vorige = document.activeElement;
    root.setAttribute('role', root.getAttribute('role') || 'dialog');
    root.setAttribute('aria-modal', 'true');
    var eersten = focusbaar(root);
    if (eersten[0]) eersten[0].focus();
    function toets(e) {
      if (e.key === 'Escape') { sluit(); if (opSluit) opSluit(); return; }
      if (e.key !== 'Tab') return;
      var f = focusbaar(root); if (!f.length) return;
      var eerste = f[0], laatste = f[f.length - 1];
      if (e.shiftKey && document.activeElement === eerste) { e.preventDefault(); laatste.focus(); }
      else if (!e.shiftKey && document.activeElement === laatste) { e.preventDefault(); eerste.focus(); }
    }
    root.addEventListener('keydown', toets);
    function sluit() { root.removeEventListener('keydown', toets); if (vorige && vorige.focus) try { vorige.focus(); } catch (e) {} }
    return sluit;
  }

  w.Util = { escapeHTML: escapeHTML, initialen: initialen, tekst: tekst, el: el, vervang: vervang,
    mount: mount, store: store, toast: toast, dialoog: dialoog };
})(window);
