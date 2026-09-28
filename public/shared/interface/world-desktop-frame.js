/* Same-origin legacy app surface. No copied forms, new authentication or
   postMessage authority. The original app and backend execute every action. */
(function (w, d) {
  'use strict';
  w.RTGDesktopFrameHost = function (o) {
    var U = w.RTGDesktopUI, entries = [], current = null, returnFocus = null, scroll = 0;
    var head = U.el('header', 'wd-focus-head'), title = U.el('h2'); title.tabIndex = -1;
    head.appendChild(title); head.appendChild(U.button('collapse', collapse, 'wd-text-button'));
    head.appendChild(U.button('close', close, 'wd-text-button')); o.surface.appendChild(head);
    var notice = U.el('p', 'wd-frame-notice'); notice.setAttribute('role', 'status'); o.surface.appendChild(notice);
    var direct = U.copy(U.el('a', 'wd-direct'), 'direct'); direct.hidden = true; o.surface.appendChild(direct);
    var retry = U.button('retry', function () { if (!current) return; var x = current; x.ready = false;
      clearTimeout(x.timer); U.copy(notice, 'frameLoading'); retry.hidden = true; direct.hidden = true;
      x.frame.src = x.url; x.timer = setTimeout(function () { failed(x); }, 15000); }, 'wd-frame-retry');
    retry.hidden = true; o.surface.appendChild(retry);
    function refreshEdge() {
      if (w.RTGAdaptiveEdge && d.body.dataset.rtgAdaptiveState === 'expanded') w.RTGAdaptiveEdge.setState('expanded');
    }
    function active() {
      if (!current || o.surface.hidden) return null;
      try {
        var doc = current.frame.contentDocument;
        if (!doc || current.frame.contentWindow.location.origin !== w.location.origin) return null;
        return { doc: doc, win: current.frame.contentWindow };
      } catch (e) { return null; }
    }
    function collapse() {
      if (current) {
        var id = new URL(current.url, w.location.origin).pathname.slice(6).replace(/\.html/g, '').replace(/[^a-z0-9]+/g, '-');
        d.dispatchEvent(new CustomEvent('rtg-widget-changed', { detail: { id: id } }));
      }
      current = null; o.surface.hidden = true; o.home.hidden = false; o.favorites.hidden = false;
      o.root.classList.remove('wd-expanded'); entries.forEach(function (x) { x.frame.hidden = true; });
      refreshEdge(); w.scrollTo({ top: scroll, behavior: 'instant' });
      if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
    }
    function close() {
      if (!current || current.dirty && !w.confirm(U.value('discard'))) return;
      var x = current; collapse(); if (x.observer) x.observer.disconnect(); clearTimeout(x.timer);
      x.frame.remove(); entries.splice(entries.indexOf(x), 1);
    }
    function ready(x) {
      clearTimeout(x.timer); if (x.observer) x.observer.disconnect();
      try {
        var doc = x.frame.contentDocument, win = x.frame.contentWindow;
        if (!doc || win.location.origin !== w.location.origin) throw new Error('unavailable');
        doc.body.classList.add('rtg-edge-embed');
        if (w.RTGAdaptiveEdgeClaim) w.RTGAdaptiveEdgeClaim.claim(doc, win);
        doc.addEventListener('input', function () { x.dirty = true; });
        doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !doc.querySelector('dialog[open]')) collapse(); });
        x.observer = new MutationObserver(function () { if (current === x) refreshEdge(); });
        x.observer.observe(doc.body, { subtree: true, childList: true, attributes: true,
          attributeFilter: ['disabled', 'hidden', 'aria-disabled', 'aria-selected'] });
        if (win.RTGi18n && win.document.documentElement.lang !== d.documentElement.lang) win.RTGi18n.set(d.documentElement.lang);
        x.ready = true; if (current === x) { notice.hidden = true; direct.hidden = true; retry.hidden = true; refreshEdge(); prepare(x.action); }
      } catch (e) { failed(x); }
    }
    function failed(x) {
      if (current !== x) return; U.copy(notice, 'frameError'); notice.hidden = false;
      direct.href = x.url; direct.hidden = false; retry.hidden = false;
    }
    function open(url, name, source) {
      // Every target must belong to the actual route manifest, not to design metadata.
      var parsed = new URL(url, w.location.origin);
      if (parsed.origin !== w.location.origin || !o.paths.has(parsed.pathname) || /(?:^|\/)\.\.(?:\/|$)/.test(url)) return false;
      var x = entries.find(function (entry) { return entry.url === url; });
      if (!x && entries.length >= 4) { o.announce(U.value('limit')); return false; }
      if (!current) scroll = w.scrollY;
      returnFocus = source || d.activeElement;
      if (!x) {
        var frame = U.el('iframe', 'wd-app-frame'); frame.title = name; frame.dataset.desktopApp = url;
        x = { frame: frame, url: url, ready: false, dirty: false }; entries.push(x);
        frame.addEventListener('load', function () { ready(x); }); frame.addEventListener('error', function () { failed(x); });
        frame.src = url; o.surface.appendChild(frame); x.timer = setTimeout(function () { failed(x); }, 15000);
      }
      current = x; title.textContent = name; direct.href = url; direct.hidden = true; retry.hidden = true;
      U.copy(notice, 'frameLoading'); notice.hidden = x.ready;
      entries.forEach(function (entry) { entry.frame.hidden = entry !== x; });
      o.home.hidden = true; o.favorites.hidden = true; o.surface.hidden = false; o.root.classList.add('wd-expanded');
      o.surface.scrollIntoView({ block: 'start', behavior: 'instant' }); title.focus({ preventScroll: true }); refreshEdge(); return true;
    }
    function controls(container, collect) {
      if (!current) return false;
      container.appendChild(U.button('collapse', collapse, 'rtg-adaptive-sheet-action'));
      var scope = active(); if (!scope) return true;
      var A = scope.win.RTGAdaptief, items = A && A.voorNu ? A.voorNu() : [];
      if (items.length && scope.win.RTGAdaptiefBalkKnoppen) {
        var buttons = scope.win.RTGAdaptiefBalkKnoppen({ items: function () { return A.voorNu(); }, titel: function () { return A.context().titel; } });
        items.forEach(function (item) { var b = U.el('button', 'rtg-adaptive-sheet-action', item.naam); b.type = 'button';
          b.onclick = function () { var latest = A.voorNu().find(function (i) { return i.id === item.id; });
            if (latest) { w.RTGAdaptiveEdge.setDeck('home'); w.RTGAdaptiveEdge.setState('dock'); buttons.voer(latest); } }; container.appendChild(b); });
      }
      collect(scope.doc, true, items).forEach(function (source) {
        var el = source.el, b = U.el('button', 'rtg-adaptive-sheet-action', el.getAttribute('aria-label') || el.textContent.trim());
        b.type = 'button'; b.dataset.desktopSource = el.id || ''; b.disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
        b.onclick = function () {
          if (!collect(scope.doc, true, items).some(function (s) { return s.el === el; }) || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
          w.RTGAdaptiveEdge.setDeck('home'); w.RTGAdaptiveEdge.setState('dock'); el.click();
        }; container.appendChild(b);
      }); return true;
    }
    function prepare(action) {
      if (!current || action !== 'newList' || new URL(current.url, w.location.origin).pathname !== '/apps/notities.html') return;
      current.action = action;
      if (!current.ready || !w.RTGIdentityRuntime().authenticated()) return;
      var source = current.frame.contentDocument.getElementById('nieuwLijst');
      if (source && !source.disabled) { current.action = null; source.click(); }
    }
    w.addEventListener('rtglang', function () {
      entries.forEach(function (x) { try { if (x.frame.contentWindow.RTGi18n) x.frame.contentWindow.RTGi18n.set(d.documentElement.lang); } catch (e) {} });
    });
    w.addEventListener('pagehide', function () { entries.forEach(function (x) { clearTimeout(x.timer); if (x.observer) x.observer.disconnect(); }); });
    w.addEventListener('storage', function (e) { if (e.key == null || e.key === 'rtg_member_token' || e.key === 'rtf_sessie') w.location.reload(); });
    w.addEventListener('rtf-session-changed', function () { w.location.reload(); });
    return { open: open, collapse: collapse, active: active, controls: controls, prepare: prepare, isOpen: function () { return !!current; } };
  };
})(window, document);
