/* Public presentation of the reader's current page. The reader owns position;
   native Edge owns state/services; original links own navigation. No storage/IO. */
(function (w, d) {
  'use strict';
  var base = new URL('../images/', d.currentScript.src);
  var glyphs = {
    home: '<path d="m3.5 10 8.5-7 8.5 7M5.5 9v11h5v-6h3v6h5V9"/>',
    worlds: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18M5 6.5c4 2 10 2 14 0M5 17.5c4-2 10-2 14 0"/>',
    context: '<path d="M12 5.5C8 3.5 5 4 3 5v14c3-1.5 6-1 9 1 3-2 6-2.5 9-1V5c-2-1-5-1.5-9 .5Zm0 0V20M6 8h3M6 11h3M15 8h3M15 11h3"/>',
    menu: '<path d="M4 6h16M4 12h11M4 18h16"/>',
    back: '<path d="m10 5-7 7 7 7M3 12h18"/>',
    primary: '<path d="M5 5h14v14H5zM8 9h8M8 13h5"/>',
    status: '<path d="m12 3 8 3v6c0 4-4.5 7.5-8 9-3.5-1.5-8-5-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
    contact: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/>',
    presence: '<path d="M4 12h3l2-6 4 12 2-6h5"/>',
    'object:save': '<path d="M6 3h12v18l-6-4-6 4Z"/>',
    'object:share': '<path d="M12 15V3m-4 4 4-4 4 4M5 12v9h14v-9"/>',
    'object:more': '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    'app:travel': '<path d="m3 9 8 2 6-7 3-1-1 3-7 6 2 8-2 1-4-7-4-1-1 2-1-1 1-3-2-2Z"/>',
    'app:media': '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/>',
    'app:photos': '<rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="8" cy="10" r="1.5"/><path d="m3 17 5-3 4 2 4-5 5 6"/>',
    'app:settings': '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>'
  };
  function text(node) { return node ? node.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function setText(node, value) { if (node.textContent !== value) node.textContent = value; }
  function picture(node, url) {
    if (!(node instanceof HTMLImageElement)) return;
    if (node.src !== url) node.setAttribute('src', url);
  }
  function dress(root) {
    root.querySelectorAll('.rtg-adaptive-bar .rtg-adaptive-item').forEach(function (button) {
      var action = button.dataset.rtgAdaptiveAction, svg = button.querySelector('svg');
      if (svg && glyphs[action] && svg.dataset.editorialGlyph !== action) {
        svg.innerHTML = glyphs[action]; svg.dataset.editorialGlyph = action;
      }
      // Unknown/context-dependent actions keep their caption. Familiar symbols
      // show the existing caption only on hover/focus; aria-label stays intact.
      button.classList.toggle('ds-edge-icon-only', /^(home|worlds|context|menu|ai|back|object:save|object:share|object:more|app:travel|app:media|app:photos|app:settings)$/.test(action));
      var label = button.getAttribute('aria-label');
      if (label && button.title !== label) button.title = label;
    });
  }
  function mount(rt, options) {
    if (!rt || !options.read) return null;
    var root = rt.edge.root, sheet = rt.sheet, caption = d.createElement('small'), poster = d.createElement('img');
    caption.className = 'ds-edge-reading-caption'; rt.sheetTitle.before(caption);
    poster.className = 'ds-edge-reading-art'; poster.alt = ''; poster.decoding = 'async'; sheet.prepend(poster);
    if (!root.querySelector('.ds-edge-gallery')) {
      var figure = d.createElement('figure'), image = d.createElement('img'), copy = d.createElement('figcaption');
      figure.className = 'ds-edge-gallery'; image.alt = ''; image.decoding = 'async';
      copy.append(rt.sheetCopy); figure.append(image, copy); rt.modes.after(figure);
    }
    var links = d.createElement('nav'); links.className = 'ds-edge-reading-links'; links.setAttribute('aria-label', 'Bij deze pagina'); sheet.append(links);
    var linkKey = '', applying = false, actionLinks = null;
    function reading() {
      var value = options.read(); if (!value || !value.node) return null;
      var node = value.node, image = node.querySelector('.ds-public-cover img[src], .ds-volume-image[src], .ds-issue-visual img[src], img[src]:not(.ds-public-stroke):not(.ds-brand-mark__image)');
      if (!image && value.kind === 'article') {
        var cover = Array.from(d.querySelectorAll('[data-issue-page]')).find(function (page) {
          return Array.from(page.querySelectorAll('a[href]')).some(function (a) { return a.getAttribute('href') === '#' + value.id; });
        });
        image = cover && cover.querySelector('img[src]');
      }
      return { node: node, id: value.id, title: value.title || text(node.querySelector('h1,h2')), kind: value.kind,
        index: value.index, total: value.total, image: image ? image.currentSrc || image.src : new URL('brand/rtg-edge-garden.webp', base).href };
    }
    function entries(value) {
      var seen = new Set();
      return Array.from(value.node.querySelectorAll('.ds-magazine-textlink[href], .ds-issue-prose a[href], .ds-issue-notes-list a[href], .ds-issue-letters a[href], .world-actions a[href], .ds-volume-copy a[href], .ds-volume-caption a[href], .ds-volume-text a[href], .ds-volume-sheet a[href]')).filter(function (a) {
        if (!text(a) || seen.has(a.href) || !/^(https?:|#)/.test(a.href)) return false;
        seen.add(a.href); return true;
      }).slice(0, 2);
    }
    function fill(target, value) {
      target.replaceChildren();
      entries(value).forEach(function (source) {
        var readingLink = document.createElement('a'); readingLink.className = 'pp-menu-item'; readingLink.href = source.getAttribute('href');
        readingLink.textContent = text(source); readingLink.addEventListener('click', function () { w.RTGAdaptiveEdge.setState('dock'); }); target.append(readingLink);
      });
      if (w.RTGCommand && typeof w.RTGCommand.open === 'function') {
        var article = value.kind === 'article' ? value.node : null;
        if (!article) Array.from(value.node.querySelectorAll('a[href^="#artikel-"]')).some(function (a) { article = d.getElementById(a.getAttribute('href').slice(1)); return !!article; });
        var query = article ? text(article.querySelector('h2')) : '';
        var question = d.createElement('button'); question.type = 'button'; question.className = 'pp-menu-item';
        question.textContent = query ? 'Zoek bij dit verhaal' : 'Zoek in deze editie';
        question.addEventListener('click', function () { w.RTGAdaptiveEdge.setState('dock'); w.RTGCommand.open(query); }); target.append(question);
      }
    }
    function refill(target, value) {
      var controls = Array.from(target.querySelectorAll('a,button')), index = controls.indexOf(d.activeElement);
      fill(target, value);
      if (index >= 0 && target.children.length) target.children[Math.min(index, target.children.length - 1)].focus({ preventScroll: true });
    }
    function refresh() {
      if (applying) return; applying = true;
      try {
        dress(root);
        var value = reading(); if (!value) return;
        if (root.dataset.edgeReading !== value.id) root.dataset.edgeReading = value.id;
        setText(caption, value.title);
        var kind = value.kind === 'article' ? 'Bij dit verhaal' : value.total > 1 ? 'Blad ' + (value.index + 1) + ' · ' + value.total : 'Op deze pagina';
        if (caption.getAttribute('aria-label') !== kind + ': ' + value.title) caption.setAttribute('aria-label', kind + ': ' + value.title);
        picture(poster, value.image);
        if (!poster.dataset.editorialReady) poster.dataset.editorialReady = 'true';
        var gallery = root.querySelector('.ds-edge-gallery'), galleryImage = gallery && gallery.querySelector('img');
        picture(galleryImage, value.image);
        if (gallery) { var copy = gallery.querySelector('p'); if (copy) setText(copy, value.title); }
        var mode = rt.serviceMode || 'now', custom = sheet.hasAttribute('data-rtg-custom-panel');
        if (!custom && mode === 'now') setText(rt.sheetTitle, value.kind === 'article' ? 'Verder lezen' : 'Op dit blad');
        var key = value.id + '|' + value.title + '|' + entries(value).map(function (a) { return a.href + text(a); }).join('|');
        // Preserve focused controls on ordinary native renders and tab changes.
        if (key !== linkKey) {
          refill(links, value); linkKey = key;
          if (actionLinks && actionLinks.isConnected) { refill(actionLinks, value); actionLinks.setAttribute('aria-label', 'Bij ' + value.title); }
        }
        var hidden = custom || !links.children.length;
        if (links.hidden !== hidden) links.hidden = hidden;
      } finally { applying = false; }
    }
    function appendActions(panel) {
      var value = reading(); if (!value) return;
      var nav = d.createElement('nav'); nav.className = 'ds-edge-reading-actions'; nav.setAttribute('aria-label', 'Bij ' + value.title); fill(nav, value);
      panel.append(nav); actionLinks = nav; return value;
    }
    w.addEventListener('rtg-public-reading-change', function () { refresh(); if (options.changed) options.changed(); });
    w.addEventListener('rtglang', refresh);
    return { refresh: refresh, reading: reading, appendActions: appendActions };
  }
  w.RTGPublicEdgeEditorial = Object.freeze({ mount: mount, dress: dress });
})(window, document);
