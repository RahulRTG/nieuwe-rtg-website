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
    var direct = null;
    function directNaar(url, verborgen) {
      var directLink = document.createElement('a'); directLink.className = 'wd-direct'; directLink.href = url;
      U.copy(directLink, 'direct'); directLink.hidden = verborgen;
      if (direct) direct.replaceWith(directLink); else o.surface.appendChild(directLink);
      direct = directLink;
    }
    directNaar('#', true);
    var retry = U.button('retry', function () { if (!current) return; var x = current; x.ready = false;
      clearTimeout(x.timer); U.copy(notice, 'frameLoading'); retry.hidden = true; direct.hidden = true;
      x.frame.contentWindow.location.replace(x.url); x.timer = setTimeout(function () { failed(x); }, 15000); }, 'wd-frame-retry');
    retry.hidden = true; o.surface.appendChild(retry);
    function refreshEdge() {
      var id = w.RTGWorldIdentity, scope = active(), url = scope && scope.win.location.href;
      var world = id && current && id.classify(url && url !== 'about:blank' ? url : current.url);
      if (world && id.VALUES.includes(world)) d.body.setAttribute('data-rtg-frame-world', world);
      else d.body.removeAttribute('data-rtg-frame-world');
      if (id && id.syncPalette) id.syncPalette(d);
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
        // Een blad kan naar een andere app navigeren: titel en herstel volgen
        // die werkelijke bestemming, zodat Agenda niet Food Court blijft heten.
        var actual = win.location.pathname + win.location.search + win.location.hash;
        if (o.paths.has(win.location.pathname) && actual !== x.url) {
          x.url = actual; x.currentTitle = doc.title; x.frame.title = doc.title;
          x.frame.dataset.desktopApp = actual;
          if (current === x) { title.textContent = doc.title; directNaar(actual, true); }
        }
        doc.body.classList.add('rtg-edge-embed');
        if (w.RTGAdaptiveEdgeClaim) w.RTGAdaptiveEdgeClaim.claim(doc, win);
        doc.addEventListener('input', function () { x.dirty = true; });
        doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !doc.querySelector('dialog[open]')) collapse(); });
        x.observer = new MutationObserver(function () { if (current === x) refreshEdge(); });
        x.observer.observe(doc.body, { subtree: true, childList: true, attributes: true,
          attributeFilter: ['disabled', 'hidden', 'aria-disabled', 'aria-selected'] });
        if (win.RTGi18n && win.document.documentElement.lang !== d.documentElement.lang) win.RTGi18n.set(d.documentElement.lang, false);
        x.ready = true; if (current === x) { notice.hidden = true; direct.hidden = true; retry.hidden = true; refreshEdge(); prepare(x.action); }
      } catch (e) { failed(x); }
    }
    function failed(x) {
      if (current !== x) return; U.copy(notice, 'frameError'); notice.hidden = false;
