/* Public detail pages use the very same five-slot Edge as the product. */
(function (w, d) {
  'use strict';
  if (!d.body.classList.contains('world-story') || !w.RTGAdaptiveEdge) return;
  var edge = w.RTGAdaptiveEdge, root = d.createElement('div'), panel = d.createElement('div');
  root.className = 'rtg-experience-edge'; panel.className = 'story-edge-panel'; panel.hidden = true;
  var nav = d.createElement('nav'); nav.setAttribute('aria-label', 'Ontdek RTG'); panel.appendChild(nav);
  var actionPanel = d.createElement('div'); actionPanel.className = 'story-edge-panel'; actionPanel.hidden = true;
  d.body.append(panel, actionPanel, root);
  var originLink = d.querySelector('.world-back'), home = new URL('../../../', d.baseURI).href;
  // The page's real home link also supports a static GitHub Pages project prefix.
  if (originLink) home = new URL(originLink.href).href.split('#')[0];
  function link(label, href) { var a = d.createElement('a'); a.textContent = label; a.href = href; nav.appendChild(a); }
  ['living', 'travel', 'work', 'foundation'].forEach(function (key) {
    var names = { living: 'LivingOS', travel: 'TravelOS', work: 'WorkOS', foundation: 'FoundationOS, altijd 100% gratis' };
    link(names[key], new URL('../werelden/' + key + 'os.html', d.baseURI).href);
  });
  link('Ontdek het hele verhaal', home); link('Vergelijk alle passen', home + '#passen'); link('Bekijk alle vragen', home + '#vragen');
  var lang = d.createElement('button'); lang.type = 'button'; lang.textContent = 'Kies uw taal';
  lang.addEventListener('click', function () { edge.setState('dock'); if (w.RTGi18n) w.RTGi18n.openModal(); }); nav.appendChild(lang);
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) edge.setState('dock'); });
  var title = d.querySelector('.world-label').textContent.trim();
  function actions() {
    var rows = [];
    if (w.RTGWorldStory) {
      rows.push({ label: 'Verander het voorbeeld', run: w.RTGWorldStory.proposal });
      rows.push({ label: 'Begin het voorbeeld opnieuw', run: w.RTGWorldStory.reset });
    }
    var open = d.querySelector('.world-actions a');
    if (open) rows.push({ label: open.textContent, run: function () { w.location.assign(open.href); } });
    rows.push({ label: 'Stel uw vraag over RTG', run: function () { w.location.assign(home + '#vragen'); } });
    var list = d.createElement('nav');
    rows.forEach(function (r) { var b = d.createElement('button'); b.type = 'button'; b.textContent = r.label;
      b.onclick = function () { edge.setState('dock'); r.run(); }; list.appendChild(b); });
    actionPanel.replaceChildren(list);
    edge.openPanel(actionPanel, { title: title, copy: 'U bepaalt uw volgende stap.' });
  }
  edge.start(d, w, { root: root, cfg: { home: home, kaart: title }, ctx: { title: title }, onEdgeAction: function (action) {
    if (action === 'home') w.location.assign(home);
    else if (action === 'worlds' || action === 'menu') edge.openPanel(panel, { title: 'Vier werelden. Eén RTG.', copy: 'Verken wat bij u past.' });
    else if (action === 'ai') w.location.assign(home + '#rahul');
    else if (['context', 'primary', 'connect'].includes(action)) actions();
    else return false;
    return true;
  } });
  edge.continueWith({ title: title, copy: 'Ontdek. Probeer. Kies zelf.' });
  var progress = d.createElement('div'); progress.className = 'story-progress'; progress.setAttribute('aria-hidden', 'true'); d.body.appendChild(progress);
  var pending = false;
  function measure() { pending = false; var range = d.documentElement.scrollHeight - w.innerHeight;
    progress.style.setProperty('--story-progress', String(range > 0 ? Math.min(1, Math.max(0, w.scrollY / range)) : 0)); }
  w.addEventListener('scroll', function () { if (!pending) { pending = true; w.requestAnimationFrame(measure); } }, { passive: true });
  w.addEventListener('resize', measure); measure();
}(window, document));
