// Opent en herstelt wereldpanelen binnen het gedeelde bureaublad.
      directNaar(x.url, false); retry.hidden = false;
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
        var frame = document.createElement('iframe'); frame.src = url;
        if (w.RTGMedia && w.RTGMedia.kader) w.RTGMedia.kader(frame);
        frame.className = 'wd-app-frame'; frame.title = name; frame.dataset.desktopApp = url;
        x = { frame: frame, url: url, ready: false, dirty: false }; entries.push(x);
        frame.addEventListener('load', function () { ready(x); }); frame.addEventListener('error', function () { failed(x); });
        o.surface.appendChild(frame); x.timer = setTimeout(function () { failed(x); }, 15000);
      }
      current = x; title.textContent = x.currentTitle || name; directNaar(url, true); retry.hidden = true;
      U.copy(notice, 'frameLoading'); notice.hidden = x.ready;
      entries.forEach(function (entry) { entry.frame.hidden = entry !== x; });
      o.home.hidden = true; o.favorites.hidden = false; o.surface.hidden = false; o.root.classList.add('wd-expanded');
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
          b.dataset.rtgAdaptiveControl = 'app';
          /* Dit is bediening van het geopende werkblad, niet van de
             wereldpagina eromheen. Bewaar die eigenaar ook in de Edge-kloon. */
          b.dataset.rtgAdaptiveFrame = 'true';
          b.dataset.rtgAdaptiveSource = 'desktop-item:' + item.id; b.dataset.rtgAdaptiveRoute = 'true';
          b.onclick = function () { var latest = A.voorNu().find(function (i) { return i.id === item.id; });
            if (latest) { w.RTGAdaptiveEdge.setDeck('home'); w.RTGAdaptiveEdge.setState('dock'); buttons.voer(latest); } }; container.appendChild(b); });
      }
      collect(scope.doc, true, items).forEach(function (source) {
        var el = source.el, b = U.el('button', 'rtg-adaptive-sheet-action', el.getAttribute('aria-label') || el.textContent.trim());
        b.type = 'button'; b.dataset.rtgAdaptiveControl = 'app'; b.dataset.rtgAdaptiveFrame = 'true';
        b.dataset.desktopSource = el.id || ''; b.dataset.rtgAdaptiveSource = 'desktop-control:' +
          (el.id || el.getAttribute('aria-label') || el.textContent.trim());
        if (el.tagName === 'A' && el.getAttribute('href')) b.dataset.rtgAdaptiveRoute = 'true';
        b.disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
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
      entries.forEach(function (x) { try { if (x.frame.contentWindow.RTGi18n) x.frame.contentWindow.RTGi18n.set(d.documentElement.lang, false); } catch (e) {} });
    });
    w.addEventListener('pagehide', function () { entries.forEach(function (x) { clearTimeout(x.timer); if (x.observer) x.observer.disconnect(); }); });
    w.addEventListener('storage', function (e) { if (e.key == null || e.key === 'rtg_member_token' || e.key === 'rtf_sessie') w.location.reload(); });
    w.addEventListener('rtf-session-changed', function () { w.location.reload(); });
    return { open: open, collapse: collapse, active: active, controls: controls, prepare: prepare, isOpen: function () { return !!current; } };
  };
})(window, document);
