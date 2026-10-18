  /* Editorial V4 annotatie en levenscyclus: eigenaarschap, viewport en herstel. */
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

    var contentHeader = old && old.matches('.ritkop,[data-rtg-v4-content-header]');
    if (old && !contentHeader && body.dataset.rtgV4Kind !== 'canvas') {
      adoptHeaderControls(doc, header, old);
      old.dataset.rtgV4LegacyHeader = 'true';
      Array.from(old.querySelectorAll(':scope > .terug,:scope > [data-rtg-edge-bar]')).forEach(function (node) {
        if (!node.closest('dialog,[role="dialog"]')) actions.insertBefore(node, search);
      });
    }
    var skip = body.querySelector(':scope > a[href^="#"]');
    if (!skip) {
      var target = body.querySelector('main,[role="main"],.wd-page>main,.wrap,body>div');
      if (target) {
        if (!target.id) target.id = 'rtg-inhoud';
        skip = make(doc, 'a', 'skip', 'Naar inhoud'); skip.href = '#' + target.id;
        body.insertBefore(skip, body.firstChild);
      }
    }
    body.insertBefore(header, skip && skip.nextSibling ? skip.nextSibling : (skip ? null : body.firstChild));
    syncHeaderActions(doc, header);
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
    /* Eén universele bediening: elk scherm met een wereld krijgt de V4-kop en
       de gedeelde Edge. Er is geen opt-out per route. */
    var kind = classify(route, body, registry);
    body.dataset.rtgEditorialV4 = 'true';
    body.dataset.rtgV4Kind = kind;
    body.dataset.rtgV4Viewport = win.innerWidth < 700 ? 'phone' : (win.innerWidth < 1180 ? 'tablet' : 'desktop');
    setSurface(doc, win, body);
    if (embedded) body.dataset.rtgV4Embedded = 'true'; else delete body.dataset.rtgV4Embedded;
    var name = body.dataset.rtgV4Title || title(doc);
    body.dataset.rtgV4Title = name.slice(0, 120);
    var header = doc.querySelector('.rtg-v4-header');
    var canvasToolbar = body.dataset.rtgV4Kind === 'canvas' &&
      doc.querySelector('body > header:not(.rtg-v4-header),.wd-page > header:not(.rtg-v4-header)');
    if (canvasToolbar) canvasToolbar.dataset.rtgV4CanvasToolbar = 'true';
    if (!embedded && !header && (body.dataset.rtgV4Kind !== 'canvas' || !canvasToolbar)) header = buildHeader(doc, body, name);
    var jump = body.querySelector('a[href^="#"]'), main = doc.querySelector('main,[role="main"],#main');
    if (jump && main) { if (!main.id) main.id = 'rtg-inhoud'; jump.href = '#' + main.id; if (body.firstChild !== jump) body.insertBefore(jump, body.firstChild); }
    if (header) {
      if (header.parentNode !== body) body.insertBefore(header, body.firstChild);
      header.removeAttribute('data-rtg-edge-2-contextual');
      Array.from(doc.querySelectorAll('[data-rtg-edge-2-contextual="native-header"]')).forEach(function (legacy) {
        if (legacy !== header) {
          if (legacy.matches('.ritkop,[data-rtg-v4-content-header]')) delete legacy.dataset.rtgV4LegacyHeader;
          else { adoptHeaderControls(doc, header, legacy); legacy.dataset.rtgV4LegacyHeader = 'true'; }
        }
      });
      if (body.dataset.rtgV4Kind !== 'canvas') Array.from(doc.querySelectorAll('.wd-page > header:not(.rtg-v4-header), body > header:not(.rtg-v4-header)')).forEach(function (legacy) {
        if (legacy.matches('.ritkop,[data-rtg-v4-content-header]')) delete legacy.dataset.rtgV4LegacyHeader;
        else { adoptHeaderControls(doc, header, legacy); legacy.dataset.rtgV4LegacyHeader = 'true'; }
      });
      syncHeaderActions(doc, header);
      var worldNode = header.querySelector('.rtg-v4-world'), titleNode = header.querySelector('.rtg-v4-title');
      var worldText = worldName(world);
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
      var resizeQueued = false;
      win.addEventListener('resize', function () {
        if (resizeQueued) return;
        resizeQueued = true; win.requestAnimationFrame(function () {
          resizeQueued = false;
          var body = doc.body; if (!body) return;
          body.dataset.rtgV4Viewport = win.innerWidth < 700 ? 'phone' : (win.innerWidth < 1180 ? 'tablet' : 'desktop');
          setSurface(doc, win, body);
        });
      }, { passive:true });
      if (win.MutationObserver) new win.MutationObserver(function (records) {
        if (queued || !records.some(function (record) { return record.addedNodes && record.addedNodes.length; })) return;
        queued = true; win.requestAnimationFrame(function () { queued = false; annotate(doc, win); });
      }).observe(doc.body, { childList:true, subtree:true });
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once:true }); else start();
  }

  /* Het werkvlak blijft zichtbaar onder de V4-kop, behalve op het wereldbeginscherm. */
  function setSurface(doc, win, body) {
    var page = doc.querySelector('.wd-page');
    if (page && !body.hasAttribute('data-world-home')) page.style.setProperty('display', 'block', 'important');
  }

  return Object.freeze({ classify:classify, pathOf:pathOf, annotate:annotate, boot:boot });
}));
