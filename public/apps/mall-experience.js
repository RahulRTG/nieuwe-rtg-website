/* Controller van de Living Mall. De view presenteert; bestaande domeinen
   installeren, bewaren, bestellen en navigeren. */
(function (w, d) {
  'use strict';
  var root = d.getElementById('mallLiving'), factory = w.RTGMallLivingView;
  if (!root || !factory || !d.body.classList.contains('rtg-mall-living')) return;
  var els = {
    departments: d.getElementById('mallDepartments'), rail: d.getElementById('mallSelectionRail'),
    count: d.getElementById('mallSelectionCount'), dots: d.getElementById('mallSelectionDots'),
    visual: d.getElementById('mallStageVisual'), category: d.getElementById('mallStageCategory'),
    state: d.getElementById('mallStageState'), title: d.getElementById('mallStageTitle'),
    description: d.getElementById('mallStageDescription'), provider: d.getElementById('mallStageProvider'),
    worlds: d.getElementById('mallStageWorlds'), price: d.getElementById('mallStagePrice'),
    primary: d.getElementById('mallPrimary'), compare: d.getElementById('mallCompare'), save: d.getElementById('mallSave'),
    partners: d.getElementById('mallPartnersRail'), partnerCount: d.getElementById('mallPartnerCount'),
    reviews: d.getElementById('mallReviews'), reviewScore: d.getElementById('mallReviewScore'), reviewList: d.getElementById('mallReviewList'),
    comparePanel: d.getElementById('mallComparePanel'), compareItems: d.getElementById('mallCompareItems'), compareClose: d.getElementById('mallCompareClose'),
    complete: d.getElementById('mallCompleteTrigger'), source: d.getElementById('mallSourceState'), edge: d.getElementById('mallEdgeControls')
  };
  var state = { all: [], visible: [], current: null, department: 'all', compare: [], compareReturn: null, reviewRequest: 0 };
  function token() { try { return w.localStorage.getItem('rtg_member_token') || ''; } catch (_) { return ''; } }
  function locale() {
    try { return w.localStorage.getItem('rtg_lang') || d.documentElement.lang || w.navigator.language || undefined; }
    catch (_) { return d.documentElement.lang || w.navigator.language || undefined; }
  }
  async function post(path, body, retry) {
    var response = await w.fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: JSON.stringify(body || {}) });
    var data = await response.json().catch(function () { return {}; });
    var gate = retry ? null : (w.RTGGegevensPoort && w.RTGGegevensPoort.vang(data, response.status,
      function () { return post(path, body, true); }, post));
    if (gate) return gate; if (!response.ok) throw new Error(data.error || 'Dit lukte niet.'); return data;
  }
  function announce(message) {
    var notice = d.getElementById('melding');
    if (notice) { notice.textContent = message; notice.style.opacity = '1'; w.clearTimeout(notice._mallTimer); notice._mallTimer = w.setTimeout(function () { notice.style.opacity = '0'; }, 2400); }
  }
  var view = factory.create({ els: els, state: state, post: post,
    onSelect: function (item, focus) { view.select(item, focus); },
    onCompareRemove: function (id) {
      state.compare = state.compare.filter(function (item) { return item.id !== id; });
      view.renderCompare(); if (state.current) view.select(state.current, false);
    }
  });
  async function primary() {
    var item = state.current, action = item && item.action; if (!item || !action) return;
    if ((action.type === 'OPEN' || action.type === 'NAVIGATE') && action.href) { w.location.href = action.href; return; }
    if (action.type === 'INSTALL') {
      els.primary.disabled = true; els.primary.textContent = 'Wordt toegevoegd…';
      try {
        var response = await post('/api/mall/apps/installeer', { id: action.appId });
        item.state = 'ACTIVE'; item.stateLabel = 'In uw wereld';
        item.action = response.app && response.app.url ? { type: 'OPEN', label: 'Open in uw wereld', href: response.app.url } : { type: 'OPEN', label: 'Geïnstalleerd', href: null };
        announce((response.app && response.app.naam || item.title) + ' staat nu in uw wereld.');
        view.renderRail(); view.select(item, false);
      } catch (error) { announce(error.message); els.primary.disabled = false; els.primary.textContent = action.label; }
      return;
    }
    if (action.type === 'ORDER') {
      if (typeof w.koopEigen === 'function') w.koopEigen(action.slug, item.title);
      else { openComplete(); d.getElementById('vast').scrollIntoView({ behavior: 'smooth' }); }
    }
  }
  async function saveCurrent() {
    var item = state.current; if (!item || !item.saveable) return; els.save.disabled = true;
    try {
      var result = await post('/api/mall/bewaar', { aanbodId: item.offerId });
      els.save.textContent = result.bewaard ? 'Bewaard' : 'Bewaar'; announce(result.bewaard ? 'Bewaard in uw Mall.' : 'Verwijderd uit Bewaard.');
    } catch (error) { announce(error.message); } finally { els.save.disabled = false; }
  }
  function addCompare() {
    var item = state.current; if (!item || state.compare.some(function (entry) { return entry.id === item.id; })) return;
    if (state.compare.length === 2) state.compare.shift(); state.compare.push(item); view.renderCompare();
    els.compare.disabled = true; els.compare.textContent = 'In vergelijking';
    announce(state.compare.length === 1 ? 'Kies nog één mogelijkheid om te vergelijken.' : 'Vergelijking staat klaar.');
    if (state.compare.length === 2) view.openCompare();
  }
  function setDepartment(department) {
    state.department = department;
    els.departments.querySelectorAll('[data-department]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.department === department)); });
    view.renderRail(); view.select(state.current, false);
  }
  function openComplete() {
    var open = !d.body.classList.contains('mall-complete-open'); d.body.classList.toggle('mall-complete-open', open);
    els.complete.setAttribute('aria-expanded', String(open)); els.complete.textContent = open ? 'Sluit de volledige Mall' : 'Open de volledige Mall';
    if (open) d.getElementById('zoek').focus({ preventScroll: false });
  }
  function mountEdge() {
    if (!els.edge || els.edge.classList.contains('is-mounted')) return;
    /* De Mall leende vroeger vijf eigen knoppen aan de onderste schil. Dat
       maakte de universele Edge op deze route een tweede, bredere navigatie.
       De bestaande echte Mall-knoppen worden al door de centrale actielade
       gevonden; de zichtbare Edge blijft daarom overal hetzelfde object. */
    if (w.RTGAdaptiveEdge) { els.edge.hidden = true; return; }
    els.edge.classList.add('is-fallback');
  }
  function bind() {
    els.departments.onclick = function (event) { var button = event.target.closest('[data-department]'); if (button) setDepartment(button.dataset.department); };
    els.primary.onclick = primary; els.save.onclick = saveCurrent; els.compare.onclick = addCompare;
    els.compareClose.onclick = view.closeCompare; els.complete.onclick = openComplete;
    els.comparePanel.onclick = function (event) { if (event.target === els.comparePanel) view.closeCompare(); };
    d.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !els.comparePanel.hidden) view.closeCompare(); });
    var ticking = false;
    els.rail.addEventListener('scroll', function () { if (!ticking) w.requestAnimationFrame(function () { view.updateDots(); ticking = false; }); ticking = true; }, { passive: true });
    if (els.edge) els.edge.onclick = function (event) {
      var button = event.target.closest('[data-mall-edge]'); if (!button) return;
      if (button.dataset.mallEdge === 'discover') d.getElementById('mallStage').scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (button.dataset.mallEdge === 'compare') state.compare.length ? view.openCompare() : announce('Kies eerst een mogelijkheid om te vergelijken.');
      if (button.dataset.mallEdge === 'save') saveCurrent();
    };
    w.addEventListener('rtg-adaptive-ready', mountEdge); w.setTimeout(mountEdge, 1400);
  }
  async function start() {
    bind();
    try {
      var data = await post('/api/mall/living', {});
      if (!data || data.projection !== 'rtg.mall.living' || !Array.isArray(data.items)) throw new Error('De Mall-bronnen gaven geen geldige etalage terug.');
      state.all = data.items; view.renderRail(); view.renderPartners(data.supplierGroups); view.select(state.current, false);
      var count = (data.sources.software || 0) + (data.sources.hardware || 0) + (data.sources.offers || 0);
      els.source.textContent = count.toLocaleString(locale()) + ' actuele mogelijkheden uit App-Bibliotheek, RTG-eigen aanbod en verbonden leveranciers.' +
        ((data.sources.partial || []).length ? ' Sommige externe bronnen zijn tijdelijk onvolledig.' : ' Alle geraadpleegde bronnen antwoordden.');
    } catch (error) {
      els.rail.innerHTML = '<p class="mall-empty">' + view.html(error.message) + '</p>'; els.count.textContent = 'Niet geladen';
      els.source.textContent = 'De bestaande volledige Mall blijft hieronder beschikbaar.'; d.body.classList.add('mall-complete-open');
      els.complete.setAttribute('aria-expanded', 'true'); els.complete.textContent = 'Sluit de volledige Mall';
    } finally { root.setAttribute('aria-busy', 'false'); }
  }
  start();
}(window, document));
