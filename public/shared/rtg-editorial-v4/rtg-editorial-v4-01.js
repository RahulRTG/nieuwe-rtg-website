/* Editorial V4 presentatiehelpers: titel, beeld, sectiekop en gedeelde kopacties. */
(function (g, factory) {
  'use strict';
  var model = typeof module === 'object' && module.exports ? require('./rtg-editorial-v4-model') : g.RTGEditorialV4Model;
  var headerDom = typeof module === 'object' && module.exports ? require('./rtg-editorial-v4-header') : g.RTGEditorialV4Header;
  var api = factory(model, headerDom);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g && g.document) { g.RTGEditorialV4 = api; api.boot(g.document, g); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (model, headerDom) {
  'use strict';
  var pathOf = model.pathOf, classify = model.classify, ownsPresentation = model.ownsPresentation, photoFor = model.photoFor;
  var worldName = model.worldName, screenLabel = model.screenLabel;
  var adoptHeaderControls = headerDom.adopt;

  function visible(el, win) {
    if (!el) return false;
    var style = win && win.getComputedStyle ? win.getComputedStyle(el) : null;
    return !style || (style.display !== 'none' && style.visibility !== 'hidden');
  }

  function title(doc) {
    /* De routekop wint van de tijdelijke desktopbegroeting. */
    var native = doc.querySelector('.wd-page>header:not(.rtg-v4-header) h1,body>header:not(.rtg-v4-header) h1');
    var h1 = Array.from(doc.querySelectorAll('main h1,[data-rtg-screen-root] h1,body>header h1,h1'))
      .find(function (node) { return !node.closest('.wd-greeting,.rtg-v4-header,.rtg-v4-section-masthead') &&
        visible(node, doc.defaultView) && node.textContent.trim(); });
    h1 = native || h1;
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
    if (main && main.querySelector(':scope > #dailyIntro')) return;
    if (!main || main.querySelector(':scope > .rtg-v4-section-masthead')) return;
    var bar = make(doc, 'div', 'rtg-v4-section-masthead');
    bar.appendChild(make(doc, 'h1', '', screenLabel(route, name)));
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
    lead.appendChild(caption); main.appendChild(lead);
  }

  function icon(kind) {
    if (kind === 'search') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6"></path></svg>';
  }

  function syncHeaderActions(doc, header) {
    if (!header) return;
    var actions = header.querySelector('.rtg-v4-header-actions');
    var search = actions && actions.querySelector('.rtg-v4-icon');
    if (!actions) return;
    /* Het markerattribuut staat op het bedienbare element zelf. Daardoor
       overleeft het een eerdere presentatieadapter die een vormwikkel
       ontleedt. Elke annotatieronde herstelt de ene eigenaar: de V4-kop. */
    Array.from(doc.querySelectorAll('[data-rtg-v4-header-action],header[data-rtg-v4-legacy-header="true"] .rtguitvoer-knop')).forEach(function (node) {
      if (!node.closest('dialog,[role="dialog"]') && node.parentNode !== actions) actions.insertBefore(node, search || null);
    });
    /* De statusknop hoort functioneel bij de bestaande Edge-root. Een kleine
       proxy in de universele kop houdt dat contract intact: de echte knop en
       het bestaande statuspaneel blijven eigenaar van gedrag en toestand. */
    var source = doc.querySelector('.rtg-edge-chrome .rtg-edge-state');
    var proxy = actions.querySelector('.rtg-v4-edge-state');
    if (source && !proxy) {
      proxy = make(doc, 'button', 'rtg-edge-state rtg-v4-edge-state');
      proxy.type = 'button'; proxy.innerHTML = source.innerHTML;
      proxy.setAttribute('aria-label', source.getAttribute('aria-label') || 'Beveiliging en systeemstatus');
      if (source.getAttribute('aria-controls')) proxy.setAttribute('aria-controls', source.getAttribute('aria-controls'));
      proxy.setAttribute('aria-expanded', source.getAttribute('aria-expanded') || 'false');
      proxy.addEventListener('click', function () {
        source.click();
        proxy.setAttribute('aria-expanded', source.getAttribute('aria-expanded') || 'false');
      });
      actions.insertBefore(proxy, search || null);
    }
  }
