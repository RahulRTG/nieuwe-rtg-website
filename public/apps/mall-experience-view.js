/* Presentatie van de Living Mall. Domeinacties worden als callbacks geleend;
   deze module beslist niet over installeren, bestellen of bewaren. */
(function (w) {
  'use strict';
  var worldNames = { living: 'LivingOS', travel: 'TravelOS', work: 'WorkOS', foundation: 'FoundationOS' };
  var visualClasses = Array.from({ length: 59 }, function (_, i) { return 'mall-visual-' + i; });
  function locale() {
    try { return w.localStorage.getItem('rtg_lang') || document.documentElement.lang || w.navigator.language || undefined; }
    catch (_) { return document.documentElement.lang || w.navigator.language || undefined; }
  }
  function text(value) { return value == null ? '' : String(value); }
  function html(value) {
    return text(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(price) {
    if (!price || !Number.isFinite(Number(price.amount))) return 'Beschikbaar in RTG';
    var value = new Intl.NumberFormat(locale(), { style: 'currency', currency: price.currency || 'EUR' }).format(Number(price.amount));
    return (price.from ? 'Vanaf ' : '') + value + (price.unit ? ' · ' + price.unit : '');
  }
  function department(item) { return item.department === 'products' ? 'home' : item.department; }
  function create(ctx) {
    var els = ctx.els, state = ctx.state;
    function find(id) { return state.all.find(function (item) { return item.id === id; }); }
    function visualClass(item) {
      var index = Math.max(0, state.all.indexOf(item));
      return visualClasses[index % visualClasses.length];
    }
    function productCard(item) {
      var selected = state.current && state.current.id === item.id;
      return '<button class="mall-product" type="button" data-mall-item="' + html(item.id) + '" aria-current="' + selected + '">' +
        '<span class="mall-product__image ' + visualClass(item) + '" aria-hidden="true"></span>' +
        '<span class="mall-product__body"><span class="mall-product__state"><span>' + html(item.category || item.department) + '</span><span>' + html(item.stateLabel) + '</span></span>' +
        '<h3>' + html(item.title) + '</h3><p>' + html(item.description || 'Ontdek wat deze mogelijkheid toevoegt aan uw wereld.') + '</p>' +
        '<span class="mall-product__foot"><span>' + html(item.provider && item.provider.name || 'RTG') + '</span><span aria-hidden="true">→</span></span></span></button>';
    }
    function renderRail() {
      state.visible = state.all.filter(function (item) { return state.department === 'all' || department(item) === state.department; });
      if (!state.visible.length) {
        els.rail.innerHTML = '<p class="mall-empty">Deze afdeling vult zich rechtstreeks uit de verbonden RTG-bronnen.</p>';
        els.count.textContent = 'Nog geen actueel aanbod'; els.dots.textContent = ''; return;
      }
      if (!state.current || state.visible.indexOf(state.current) < 0) state.current = state.visible[0];
      els.rail.innerHTML = state.visible.map(productCard).join('');
      els.count.textContent = state.visible.length.toLocaleString(locale()) + ' mogelijkheden';
      var dots = Math.min(5, state.visible.length);
      els.dots.innerHTML = Array.from({ length: dots }, function (_, i) { return '<i' + (i === 0 ? ' data-active="true"' : '') + '></i>'; }).join('');
      els.rail.querySelectorAll('[data-mall-item]').forEach(function (button) {
        button.onclick = function () { ctx.onSelect(find(button.dataset.mallItem), true); };
      });
    }
    function sourceLabel(item) {
      var labels = { 'app-library': 'RTG App-Bibliotheek', 'rtg-own-catalog': 'RTG eigen catalogus' };
      return labels[item.source && item.source.kind] || 'verbonden bron';
    }
    function select(item, focus) {
      if (!item) return;
      state.current = item;
      els.rail.querySelectorAll('[data-mall-item]').forEach(function (button) { button.setAttribute('aria-current', String(button.dataset.mallItem === item.id)); });
      visualClasses.forEach(function (name) { els.visual.classList.remove(name); }); els.visual.classList.add(visualClass(item));
      els.visual.dataset.kind = item.department === 'experience' ? 'experience' : item.kind;
      els.category.textContent = item.category || item.department || 'RTG Mall'; els.state.textContent = item.stateLabel || item.state;
      els.title.textContent = item.title; els.description.textContent = item.description || 'Deze mogelijkheid is verbonden met de wereld waarin u haar gebruikt.';
      els.provider.textContent = (item.provider && item.provider.name || 'RTG') + ' · ' + sourceLabel(item);
      els.worlds.innerHTML = (item.worlds || []).map(function (world) { return '<span>' + html(worldNames[world] || world) + '</span>'; }).join('');
      els.price.innerHTML = html(money(item.price)) + (item.recurringPrice ? '<small>+ ' + html(money(item.recurringPrice)) + '</small>' : '');
      els.primary.textContent = item.action && item.action.label || 'Bekijk'; els.primary.disabled = item.state === 'UNAVAILABLE';
      els.save.disabled = !item.saveable; els.save.hidden = !item.saveable;
      els.compare.disabled = state.compare.some(function (entry) { return entry.id === item.id; });
      els.compare.textContent = els.compare.disabled ? 'In vergelijking' : 'Vergelijk'; loadReviews(item);
      if (w.RTGAdaptiveEdge) w.RTGAdaptiveEdge.continueWith({ title: item.title,
        copy: item.description || 'Bekijk deze mogelijkheid in RTG.', presence: item.stateLabel || 'Mall', action: 'primary' });
      if (focus) document.getElementById('mallStage').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function renderCompare() {
      els.compareItems.innerHTML = state.compare.map(function (item) {
        return '<article class="mall-compare-card"><p class="mall-live__eyebrow">' + html(item.category || item.department) + '</p><h3>' + html(item.title) + '</h3>' +
          '<dl><dt>Aanbieder</dt><dd>' + html(item.provider && item.provider.name || 'RTG') + '</dd><dt>Prijs</dt><dd>' + html(money(item.price)) + '</dd>' +
          '<dt>Wereld</dt><dd>' + html((item.worlds || []).map(function (x) { return worldNames[x] || x; }).join(' · ')) + '</dd>' +
          '<dt>Beschikbaarheid</dt><dd>' + html(item.stateLabel || item.state) + '</dd></dl>' +
          '<button class="mall-action" type="button" data-compare-remove="' + html(item.id) + '">Verwijder</button></article>';
      }).join('') || '<p class="mall-empty">Kies twee mogelijkheden uit de etalage.</p>';
      els.compareItems.querySelectorAll('[data-compare-remove]').forEach(function (button) { button.onclick = function () { ctx.onCompareRemove(button.dataset.compareRemove); }; });
    }
    function openCompare() {
      state.compareReturn = document.activeElement;
      renderCompare(); els.comparePanel.hidden = false; els.compareClose.focus();
    }
    function closeCompare() {
      els.comparePanel.hidden = true;
      if (state.compareReturn && typeof state.compareReturn.focus === 'function') state.compareReturn.focus();
      state.compareReturn = null;
    }
    async function loadReviews(item) {
      var code = item.provider && item.provider.code, request = ++state.reviewRequest;
      els.reviews.hidden = true; els.reviewList.textContent = ''; if (!code) return;
      try {
        var data = await ctx.post('/api/reviews', { supplierCode: code });
        if (request !== state.reviewRequest || state.current !== item) return;
        var reviews = data.reviews || [], rating = data.rating;
        if (!reviews.length && !(rating && rating.aantal)) return;
        els.reviewScore.textContent = rating && rating.aantal ? rating.score + ' · ' + rating.aantal + ' ervaringen' : reviews.length + ' ervaringen';
        els.reviewList.innerHTML = reviews.slice(0, 3).map(function (review) {
          return '<article class="mall-review"><div class="mall-review__stars" aria-label="' + review.score + ' van 5 sterren">' + '★'.repeat(review.score) + '☆'.repeat(5 - review.score) + '</div>' +
            '<p>' + html(review.tekst || 'Beoordeeld na een afgeronde ervaring.') + '</p><small>' + html(review.codename || 'RTG-lid') + '</small></article>';
        }).join(''); els.reviews.hidden = false;
      } catch (_) { /* De etalage blijft bruikbaar wanneer reviews tijdelijk ontbreken. */ }
    }
    function renderPartners(groups) {
      var suppliers = [];
      (groups || []).forEach(function (group) { (group.suppliers || []).forEach(function (supplier) {
        suppliers.push({ group: group.label, href: group.href, name: supplier.name, city: supplier.city });
      }); });
      els.partnerCount.textContent = suppliers.length.toLocaleString(locale()) + ' verbonden aanbieders';
      els.partners.innerHTML = suppliers.map(function (supplier) {
        return '<a class="mall-partner" href="' + html(supplier.href || '#') + '"><span>' + html(supplier.group) + '</span><h3>' + html(supplier.name) + '</h3><p>' + html(supplier.city || 'Beschikbaar binnen RTG') + '</p></a>';
      }).join('') || '<p class="mall-empty">Nieuwe goedgekeurde partners verschijnen hier vanuit hun eigen RTG-bron.</p>';
    }
    function updateDots() {
      var cards = els.rail.querySelectorAll('.mall-product'); if (!cards.length) return;
      var index = 0, left = els.rail.getBoundingClientRect().left;
      cards.forEach(function (card, i) { if (Math.abs(card.getBoundingClientRect().left - left) < Math.abs(cards[index].getBoundingClientRect().left - left)) index = i; });
      var dotIndex = Math.min(els.dots.children.length - 1, Math.floor(index / Math.max(1, Math.ceil(cards.length / Math.max(1, els.dots.children.length)))));
      Array.from(els.dots.children).forEach(function (dot, i) { if (i === dotIndex) dot.dataset.active = 'true'; else delete dot.dataset.active; });
    }
    return Object.freeze({ renderRail: renderRail, select: select, renderCompare: renderCompare, openCompare: openCompare,
      closeCompare: closeCompare, renderPartners: renderPartners, updateDots: updateDots, html: html });
  }
  w.RTGMallLivingView = Object.freeze({ create: create });
}(window));
