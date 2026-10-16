/* RTG EDITORIAL INTERFACE V4 ---------------------------------------------
   Eén responsieve presentatielaag voor telefoon, tablet en desktop.
   De runtime classificeert bestaande schermen, maar verplaatst geen
   domeinlogica en verleent geen rechten. */
(function (g, factory) {
  'use strict';
  var model = typeof module === 'object' && module.exports ? require('./rtg-editorial-v4-model') : g.RTGEditorialV4Model;
  var api = factory(model);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g && g.document) { g.RTGEditorialV4 = api; api.boot(g.document, g); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (model) {
  'use strict';
  var pathOf = model.pathOf, classify = model.classify, photoFor = model.photoFor;
  var worldName = model.worldName, screenLabel = model.screenLabel;

  function visible(el, win) {
    if (!el) return false;
    var style = win && win.getComputedStyle ? win.getComputedStyle(el) : null;
    return !style || (style.display !== 'none' && style.visibility !== 'hidden');
  }

  function title(doc) {
    var h1 = Array.from(doc.querySelectorAll('main h1,[data-rtg-screen-root] h1,body>header h1,h1'))
      .find(function (node) { return visible(node, doc.defaultView) && node.textContent.trim(); });
    if (h1) return h1.textContent.trim();
    return String(doc.title || 'RTG').replace(/^RTG\s*[·|\u2014:-]?\s*/i, '').trim() || 'RTG';
  }

  function make(doc, tag, className, text) {
    var node = doc.createElement(tag); node.className = className || '';
    if (text != null) node.textContent = text;
    return node;
  }

  function ensureSectionMasthead(doc, body, route, name) {
    if (body.dataset.rtgV4Kind === 'cover' || body.dataset.rtgV4Kind === 'canvas') return;
    var main = doc.querySelector('main,[data-rtg-screen-root="content"]');
    if (!main || main.querySelector(':scope > .rtg-v4-section-masthead')) return;
    var bar = make(doc, 'div', 'rtg-v4-section-masthead');
    bar.appendChild(make(doc, 'strong', '', screenLabel(route, name)));
    var more = make(doc, 'a', '', '•••'); more.href = '/apps/app.html#menu'; more.setAttribute('aria-label', 'Meer in RTG');
    bar.appendChild(more); main.insertBefore(bar, main.firstChild);
  }

  function ensureWorldTitle(doc, body, world) {
    if (body.dataset.rtgV4Kind !== 'cover') return;
    var hero = doc.querySelector('.dagkop,.prestatiekop,.wk-hero,.fo-hero,[data-rtg-component="EditorialHero"],[data-rtg-cinematic-lead="true"],.hero,.voorzijde-hero');
    if (!hero || hero.querySelector(':scope > .rtg-v4-world-title')) return;
    var heading = make(doc, 'div', 'rtg-v4-world-title', worldName(world));
    heading.setAttribute('aria-hidden', 'true');
    hero.insertBefore(heading, hero.firstChild);
  }

  function ensurePhotoLead(doc, body, route, world) {
    if (body.dataset.rtgV4Kind === 'cover' || body.dataset.rtgV4Kind === 'canvas') return;
    var main = doc.querySelector('main,[data-rtg-screen-root="content"]');
    if (!main || main.querySelector(':scope > .rtg-v4-photo-lead')) return;
    if (main.querySelector(':scope > :is(.mall-live,.mall-live__intro,.rtm-voorzijde,#dailyIntro,[data-rtg-cinematic-lead="true"],[data-rtg-component="EditorialHero"])')) return;
    var firstImage = main.querySelector('img,picture,[style*="background-image"]');
    if (firstImage && firstImage.getBoundingClientRect && firstImage.getBoundingClientRect().top < 520) return;
    var lead = make(doc, 'figure', 'rtg-v4-photo-lead');
    lead.setAttribute('aria-hidden', 'true');
    lead.style.setProperty('--v4-lead-image', 'url("' + photoFor(route, world) + '")');
    var caption = make(doc, 'figcaption', '', worldName(world) + ' · RTG EDITION');
    /* In taak-, collectie- en statusschermen is fotografie de redactionele
       afsluiting, zoals in het vaste RTG-referentieblad. Covers houden het
       beeld juist als volledige opening. */
    lead.appendChild(caption); main.appendChild(lead);
  }

  function icon(kind) {
    if (kind === 'search') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6"></path></svg>';
  }

  function buildHeader(doc, body, name) {
    var old = body.querySelector('[data-rtg-edge-2-contextual="native-header"], :scope > header:not(.rtg-v4-header), :scope > .wd-page > header:not(.rtg-v4-header)');
    var header = make(doc, 'header', 'rtg-v4-header');
    header.setAttribute('aria-label', 'RTG hoofdnavigatie');
    var home = make(doc, 'a', 'rtg-v4-brand', 'RTG'); home.href = '/apps/app.html';
    var context = make(doc, 'div', 'rtg-v4-context');
    context.append(make(doc, 'span', 'rtg-v4-world', worldName(body.dataset.rtgWorld)), make(doc, 'strong', 'rtg-v4-title', name));
    var actions = make(doc, 'div', 'rtg-v4-header-actions');
    var search = make(doc, 'a', 'rtg-v4-icon'); search.href = '/apps/wereld.html'; search.setAttribute('aria-label', 'Zoeken'); search.innerHTML = icon('search');
    var account = make(doc, 'a', 'rtg-v4-icon'); account.href = '/apps/mijn-gegevens.html'; account.setAttribute('aria-label', 'Account'); account.innerHTML = icon('account');
    actions.append(search, account); header.append(home, context, actions);

    if (old && body.dataset.rtgV4Kind !== 'canvas') {
      old.dataset.rtgV4LegacyHeader = 'true';
      Array.from(old.querySelectorAll(':scope > .terug,:scope > [data-rtg-edge-bar]')).forEach(function (node) {
        if (!node.closest('dialog,[role="dialog"]')) actions.insertBefore(node, search);
      });
    }
    body.insertBefore(header, body.firstChild);
    return header;
  }

  function annotate(doc, win) {
    var body = doc && doc.body;
    if (!body) return false;
    var identity = win && win.RTGWorldIdentity;
    var registry = win && win.RTGHeritageRegistry;
    var route = pathOf(win && win.location && win.location.href);
    var world = body.dataset.rtgWorld || (identity && identity.classify(route));
    if (!world || world === 'redirect') return false;
    var embedded = false;
    try { embedded = win.self !== win.top || new URLSearchParams(win.location.search).get('embed') === '1'; }
    catch (e) { embedded = false; }
    body.dataset.rtgEditorialV4 = 'true';
    body.dataset.rtgV4Kind = classify(route, body, registry);
    body.dataset.rtgV4Viewport = win.innerWidth < 700 ? 'phone' : (win.innerWidth < 1180 ? 'tablet' : 'desktop');
    if (embedded) body.dataset.rtgV4Embedded = 'true'; else delete body.dataset.rtgV4Embedded;
    var name = title(doc);
    body.dataset.rtgV4Title = name.slice(0, 120);
    var header = doc.querySelector('.rtg-v4-header');
    var canvasToolbar = body.dataset.rtgV4Kind === 'canvas' &&
      doc.querySelector('body > header:not(.rtg-v4-header),.wd-page > header:not(.rtg-v4-header)');
    if (canvasToolbar) canvasToolbar.dataset.rtgV4CanvasToolbar = 'true';
    /* Een canvas houdt zijn eigen functionele toolbar. */
    if (!embedded && !header && (body.dataset.rtgV4Kind !== 'canvas' || !canvasToolbar)) header = buildHeader(doc, body, name);
    if (header) {
      /* Edge 2 kan een routekop al vóór deze laag naar zijn contextlade hebben
         verplaatst. De V4-kop zelf hoort daar nooit in: hij is de ene schil. */
      if (header.parentNode !== body) body.insertBefore(header, body.firstChild);
      header.removeAttribute('data-rtg-edge-2-contextual');
      Array.from(doc.querySelectorAll('[data-rtg-edge-2-contextual="native-header"]')).forEach(function (legacy) {
        if (legacy !== header) legacy.dataset.rtgV4LegacyHeader = 'true';
      });
      if (body.dataset.rtgV4Kind !== 'canvas') Array.from(doc.querySelectorAll('.wd-page > header:not(.rtg-v4-header), body > header:not(.rtg-v4-header)')).forEach(function (legacy) {
        legacy.dataset.rtgV4LegacyHeader = 'true';
      });
      var worldNode = header.querySelector('.rtg-v4-world'), titleNode = header.querySelector('.rtg-v4-title');
      var worldText = worldName(world);
      /* textContent vervangen maakt ook bij gelijke tekst nieuwe DOM-nodes.
         In combinatie met de observer werd dat een zelfvoedende mutatielus en
         zag de bestaande wereldstart nooit zijn vereiste rustige venster. */
      if (worldNode && worldNode.textContent !== worldText) worldNode.textContent = worldText;
      if (titleNode && titleNode.textContent !== name) titleNode.textContent = name;
    }
    ensureWorldTitle(doc, body, world);
    ensureSectionMasthead(doc, body, route, name);
    ensurePhotoLead(doc, body, route, world);
    return true;
  }

  function boot(doc, win) {
    function start() {
      annotate(doc, win);
      var queued = false;
      /* Viewportclassificatie volgt het venster zelf. Een ResizeObserver op
         documentElement die daarna een attribuut op body schrijft, vormt in
         WebKit een terugkoppellus bij een iframe-overgang en produceert een
         echte pageerror. Resize heeft hier precies de benodigde semantiek. */
      var resizeQueued = false;
      win.addEventListener('resize', function () {
        if (resizeQueued) return;
        resizeQueued = true; win.requestAnimationFrame(function () {
          resizeQueued = false;
          var body = doc.body; if (!body) return;
          body.dataset.rtgV4Viewport = win.innerWidth < 700 ? 'phone' : (win.innerWidth < 1180 ? 'tablet' : 'desktop');
        });
      }, { passive:true });
      if (win.MutationObserver) new win.MutationObserver(function (records) {
        if (queued || !records.some(function (record) { return record.addedNodes && record.addedNodes.length; })) return;
        queued = true; win.requestAnimationFrame(function () { queued = false; annotate(doc, win); });
      }).observe(doc.body, { childList:true, subtree:true });
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once:true }); else start();
  }

  return Object.freeze({ classify:classify, pathOf:pathOf, annotate:annotate, boot:boot });
}));
