(function (w, d) {
  if(w.RTGEdge)return;
  var I=w.RTGEdgeIcons||{},C=w.RTGEdgeWorlds||{},L=w.RTGEdgeLibrary,A=null,aiWatcher=null;
  function s(i){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(I[i]||I.spark||'')+'</svg>';}
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function alles(e){return e.cfg.all||e.cfg.tools||[];}
  function functie(e,id){return alles(e).find(function(x){return x[0]===id;});}
  function actief(t) {
    try {
      var hier = new URL(location.href), doel = new URL(t[3], location.href);
      if (hier.pathname !== doel.pathname) return false;
      var view = doel.searchParams.get('view');
      return !view || hier.searchParams.get('view') === view;
    } catch (fout) { return false; }
  }
  function start(o) {
    o = o || {};
    var inKader = false;
    try { inKader = w.self !== w.top; } catch (fout) { inKader = true; }
    if (inKader || new URLSearchParams(location.search).get('embed') === '1') { d.body.classList.add('rtg-edge-embed'); return null; }
    if (A) return api;
    var key = o.world || 'work', cfg = C[key] || C.work;
    var ctx = Object.assign({ scope: cfg.kort, title: d.title.replace(/\s*[|·-].*$/, ''), actie: cfg.actie, tool: '' }, o.context || {});
    d.body.dataset.rtgWorld = key;
    var root = d.createElement('div'); root.className = 'rtg-edge-chrome';
    root.innerHTML = L.casco(cfg, s);
    d.body.appendChild(root);
    A = { root: root, cfg: cfg, key: key, ctx: ctx, layout: 1, workspace: !!o.workspace, onTool: o.onTool || null, onAction: o.onAction || null };
    try {
      teken(); bind(); neemAI();
      d.body.classList.add('rtg-edge-host');
      d.body.setAttribute('data-rtg-edge-ready', 'true');
      var v2=d.createElement('script');v2.src='/shared/rtg-edge-2-loader.js';d.head.appendChild(v2);
      L.refresh(A); return api;
    } catch (fout) {
      if (root.parentNode) root.parentNode.removeChild(root);
      A = null; d.body.classList.remove('rtg-edge-host'); d.body.removeAttribute('data-rtg-edge-ready');
      throw fout;
    }
  }
  function teken() {
    if (!A) return;
    var e = A, c = e.ctx, t = e.cfg.tools, cr = e.root.querySelector('.rtg-edge-crumbs');
    cr.innerHTML = '<button type="button" data-crumb="home">' + esc(e.cfg.naam) + '</button><i aria-hidden="true">/</i><button type="button" data-crumb="scope">' + esc(c.scope) + '</button><i aria-hidden="true">/</i><button type="button" data-crumb="current">' + esc(c.title) + '</button>';
    /* DE WERELDEN STAAN IN DE BALK EN NIET MEER IN EEN EIGEN STROOK. Elk
       wereldscherm droeg zijn eigen `.os-switcher`: dezelfde vier namen, in
       eigen opmaak, op vier plekken overgetikt -- en boven een schil die die
       vier al kende (`.rtg-edge-worlds` in het menu). De opmaak komt uit
       dezelfde bibliotheek als die menulijst, dus in dezelfde volgorde en met
       hetzelfde adres: verdwijnt een wereld, dan verdwijnt hij op beide. */
    e.root.querySelector('.rtg-edge-worldbar').innerHTML = L.balk(e, C, esc);
    e.root.querySelector('.rtg-edge-scope').textContent = c.scope;
    e.root.querySelector('.rtg-edge-tools').innerHTML = t.map(function (x, i) { return '<a class="rtg-edge-tool" data-tool="' + x[0] + '" data-shortcut="' + (i + 1) + '" href="' + x[3] + '" aria-label="' + esc(x[1]) + '" ' + ((c.tool === x[0] || (!c.tool && actief(x))) ? 'aria-current="page"' : '') + '>' + s(x[2]) + '<span class="rtg-edge-tip">' + esc(x[1]) + '<kbd>Alt+' + (i + 1) + '</kbd></span></a>'; }).join('');
    e.root.querySelector('.rtg-edge-action button').textContent = c.actie || e.cfg.actie;
    e.root.querySelector('.rtg-edge-layout small').textContent = e.layout;
    e.root.querySelector('.rtg-edge-index').innerHTML = L.html(e, C, esc, s, actief);
    e.root.querySelector('.rtg-edge-status-panel').innerHTML = L.status();
    bindTools(); L.bind(e, sluitLagen); L.crumbs(e, openIndex, voerActie);
  }
  function bindTools() {
    A.root.querySelectorAll('[data-tool]').forEach(function (a) {
      a.onclick = function (ev) {
        ev.preventDefault();
        if (A.onTool) A.onTool(a.dataset.tool, a.getAttribute('href'));
        else location.href = A.cfg.workspace + (A.cfg.workspace.indexOf('?') >= 0 ? '&' : '?') + 'open=' + encodeURIComponent(a.dataset.tool);
        sluitLagen();
      };
    });
  }
  function openIndex(zoek) {
    if (!A) return;
    d.body.classList.remove('rtg-edge-fold'); sluitLagen();
    var idx = A.root.querySelector('.rtg-edge-index'), menu = A.root.querySelector('.rtg-edge-menu');
    idx.setAttribute('aria-hidden', 'false'); menu.setAttribute('aria-expanded', 'true');
    if (zoek) setTimeout(function () { var v = idx.querySelector('input'); if (v) v.focus(); }, 20);
  }
  function bind() {
    var e = A, r = e.root, menu = r.querySelector('.rtg-edge-menu'), idx = r.querySelector('.rtg-edge-index'), ai = r.querySelector('.rtg-edge-ai'), panel = r.querySelector('.rtg-edge-ai-panel'), status = r.querySelector('.rtg-edge-status-panel'), state = r.querySelector('.rtg-edge-state');
    menu.onclick = function () {
      var open = menu.getAttribute('aria-expanded') === 'true', fold = d.body.classList.contains('rtg-edge-fold');
      if(d.body.getAttribute('data-rtg-edge-2-rendered')==='true'){if(open)sluitLagen();else openIndex(false);return;}
      if (open) { sluitLagen(); d.body.classList.add('rtg-edge-fold'); }
      else if (fold) d.body.classList.remove('rtg-edge-fold');
      else openIndex(false);
    };
    r.querySelector('[data-go="back"]').onclick = function () { history.back(); };
    r.querySelector('[data-go="next"]').onclick = function () { history.forward(); };
    r.querySelector('.rtg-edge-layout').onclick = function () { if (!e.workspace) { location.href = e.cfg.workspace; return; } setLayout(e.layout === 1 ? 2 : e.layout === 2 ? 4 : 1); };
    r.querySelector('.rtg-edge-action button').onclick = voerActie;
    ai.onclick = function () { var open = ai.getAttribute('aria-expanded') !== 'true'; sluitLagen(); ai.setAttribute('aria-expanded', String(open)); panel.setAttribute('aria-hidden', String(!open)); if (open) neemAI(); };
    state.onclick = function () { var open = state.getAttribute('aria-expanded') !== 'true'; sluitLagen(); state.setAttribute('aria-expanded', String(open)); status.setAttribute('aria-hidden', String(!open)); if(open)L.refresh(e); };
    d.addEventListener('keydown', function (ev) {
      var invoer = /^(INPUT|TEXTAREA|SELECT)$/.test((ev.target && ev.target.tagName) || '');
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); ev.stopImmediatePropagation(); openIndex(true); return; }
      if (!invoer && ev.key === '/') { ev.preventDefault(); openIndex(true); return; }
      if (!invoer && ev.altKey && /^[1-9]$/.test(ev.key)) { var a = r.querySelector('[data-shortcut="' + ev.key + '"]'); if (a) { ev.preventDefault(); a.click(); } }
      if (ev.key === 'Escape') sluitLagen();
    }, true);
    w.addEventListener('resize', function () { if (innerWidth < 768 && e.layout !== 1) setLayout(1); });
    w.addEventListener('online', teken); w.addEventListener('offline', teken);
  }
  function voerActie() {
    if (!A) return;
    if (A.onAction) { A.onAction(A.ctx); return; }
    var f = functie(A, A.ctx.tool);
    if (f) location.href = f[3]; else location.href = A.cfg.home;
  }
  function sluitLagen() {
    if (!A) return;
    L.release(A);
    A.root.querySelector('.rtg-edge-index').setAttribute('aria-hidden', 'true');
    A.root.querySelector('.rtg-edge-menu').setAttribute('aria-expanded', 'false');
    A.root.querySelector('.rtg-edge-ai-panel').setAttribute('aria-hidden', 'true');
    A.root.querySelector('.rtg-edge-ai').setAttribute('aria-expanded', 'false');
    A.root.querySelector('.rtg-edge-status-panel').setAttribute('aria-hidden', 'true');
    A.root.querySelector('.rtg-edge-state').setAttribute('aria-expanded', 'false');
  }
  function neemAI() {
    if (!A) return;
    var mond = A.root.querySelector('.rtg-edge-mouth');
    if (w.RTGMond && mond && !mond.querySelector('canvas')) { var c = d.createElement('canvas'); c.width = 440; c.height = 200; c.setAttribute('aria-hidden', 'true'); c.style.cssText = 'width:31px;height:15px;display:block'; mond.textContent = ''; mond.appendChild(c); w.RTGMond.maak(c); }
    var p = A.root.querySelector('.rtg-edge-ai-panel'), x = d.querySelector('.mgz-blok') || d.querySelector('.lo-rahul');
    if (x && !p.contains(x)) { p.textContent = ''; p.appendChild(x); x.style.display = ''; }
    if (x || aiWatcher || !d.body || !w.MutationObserver) return;
    aiWatcher = new MutationObserver(function () { var gevonden = d.querySelector('.mgz-blok') || d.querySelector('.lo-rahul'); if (gevonden) { aiWatcher.disconnect(); aiWatcher = null; neemAI(); } });
    aiWatcher.observe(d.body, { childList: true, subtree: true });
    setTimeout(function () { if (aiWatcher) { aiWatcher.disconnect(); aiWatcher = null; } }, 10000);
  }
  function context(c) { if (!A) return; A.ctx = Object.assign({}, A.ctx, c || {}); teken(); }
  function setLayout(n) { if (!A) return; A.layout = innerWidth < 768 ? 1 : ([1, 2, 4].indexOf(+n) >= 0 ? +n : 1); d.body.dataset.rtgLayout = A.layout; A.root.querySelector('.rtg-edge-layout small').textContent = A.layout; w.dispatchEvent(new CustomEvent('rtg-edge-layout', { detail: { layout: A.layout } })); }
  var api = { start: start, setContext: context, setLayout: setLayout, openFunctions: function () { openIndex(true); }, get config() { return C; }, get layout() { return A ? A.layout : 1; }, get active() { return A; } };
  w.RTGEdge=api;
})(window,document);
