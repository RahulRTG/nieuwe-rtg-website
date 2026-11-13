/* Public detail pages use the very same five-slot Edge as the product. */
(function (w, d) {
  'use strict';
  if ((!d.body.classList.contains('world-story') && d.body.dataset.publicPlatform !== 'detail') || !w.RTGAdaptiveEdge) return;
  var edge = w.RTGAdaptiveEdge, root = d.createElement('div'), panel = d.createElement('div'), editorial = null;
  var painted = d.documentElement.hasAttribute('data-ds');
  root.className = painted ? 'rtg-experience-edge ds-public-edge ds-edge' : 'rtg-experience-edge'; panel.className = 'story-edge-panel'; panel.hidden = true;
  var nav = d.createElement('nav'); nav.setAttribute('aria-label', 'Ontdek RTG'); panel.appendChild(nav);
  var actionPanel = d.createElement('div'); actionPanel.className = 'story-edge-panel'; actionPanel.hidden = true;
  d.body.append(panel, actionPanel, root);
  var reelActions = d.createElement('div'); reelActions.className = 'ds-public-reel-actions';
  d.querySelectorAll('[data-reel-controls]').forEach(function(controls){reelActions.append(controls.closest('.ds-volume-bar')||controls);});
  actionPanel.append(reelActions);
  reelActions.addEventListener('click',function(event){if(event.target.closest('[data-reel-prev],[data-reel-next],a[href]'))edge.setState('dock');},true);
  var originLink = d.querySelector('.ds-brand-mark') || d.querySelector('.world-back'), home = new URL('../../../', d.baseURI).href;
  // The page's real home link also supports a static GitHub Pages project prefix.
  if (originLink) home = new URL(originLink.href).href.split('#')[0];
  function link(label, href) { var a = d.createElement('a'); a.textContent = label; a.setAttribute('href', href); nav.appendChild(a); }
  var assetBase=w.RTGPublicPlatform?w.RTGPublicPlatform.asset():new URL('../',d.currentScript.src);
  ['living', 'travel', 'work', 'foundation'].forEach(function (key) {
    var names = { living: 'LivingOS', travel: 'TravelOS', work: 'WorkOS', foundation: 'FoundationOS, altijd 100% gratis' };
    link(names[key], new URL('site/werelden/' + key + 'os.html', assetBase).href);
  });
  link('Ontdek het hele verhaal', home); link('Vergelijk alle passen', home + '#passen'); link('Bekijk alle vragen', home + '#vragen');
  var original = d.querySelector('[data-public-page-actions]');
  if (original) { original.hidden = false; panel.appendChild(original); }
  else d.querySelectorAll('.ds-public-site-header nav a').forEach(function(a){nav.append(a);});
  var lang = d.querySelector('.ds-public-site-header [data-language-picker]');
  if(lang)lang.addEventListener('click',function(){edge.setState('dock');},true);
  else {lang=d.createElement('button');lang.type='button';lang.textContent='Kies uw taal';lang.addEventListener('click',function(){edge.setState('dock');if(w.RTGi18n)w.RTGi18n.openModal();});}
  nav.appendChild(lang);
  panel.addEventListener('click', function (e) { if (e.target.closest('a')) edge.setState('dock'); });
  var label = d.querySelector('.world-label'), title = label ? label.textContent.trim() : 'Ontdek RTG';
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
    actionPanel.replaceChildren();if(editorial)editorial.appendActions(actionPanel);actionPanel.append(list,reelActions);
    edge.openPanel(actionPanel, { title: title, copy: 'U bepaalt uw volgende stap.' });
  }
  var runtime=edge.start(d, w, { root: root, cfg: { home: home, kaart: title }, ctx: { title: title }, onEdgeAction: function (action) {
    if (action === 'home') w.location.assign(home);
    else if (action === 'worlds' || action === 'menu') edge.openPanel(panel, { title: 'Vier werelden. Eén RTG.', copy: 'Verken wat bij u past.' });
    else if (action === 'ai') w.location.assign(home + '#rahul');
    else if (['context', 'primary', 'connect'].includes(action)) actions();
    else return false;
    return true;
  } });
  if(!runtime)return;
  if(painted){
    // Public dock/peek are quiet; the native state machine still owns opening.
    var door=d.createElement('button'),mark=document.createElement('img'),close=d.createElement('span');
    door.type='button';door.className='ds-public-edge-toggle';
    mark.src=new URL('images/brand/rtg-edge-lips.webp',assetBase).href;mark.alt='';mark.width=56;mark.height=38;
    close.textContent='×';close.setAttribute('aria-hidden','true');door.append(mark,close);
    runtime.bar.id='publicEdgeBar';door.setAttribute('aria-controls',runtime.bar.id);runtime.host.append(door);
    function syncDoor(){
      var open=['deck','expanded'].includes(runtime.host.dataset.rtgAdaptiveState);
      door.setAttribute('aria-expanded',String(open));door.setAttribute('aria-label',open?'Edge sluiten':'Edge openen');
      if(!open&&d.activeElement!==door&&runtime.host.contains(d.activeElement))door.focus({preventScroll:true});
    }
    door.addEventListener('click',function(event){event.stopPropagation();edge.setState(door.getAttribute('aria-expanded')==='true'?'dock':'deck');syncDoor();});
    d.addEventListener('keydown',function(event){
      if(event.key!=='Escape'||d.querySelector('dialog[open]'))return;
      var state=runtime.host.dataset.rtgAdaptiveState;
      if(state==='deck')edge.setState('dock');
      if(state==='deck'||state==='expanded')w.requestAnimationFrame(function(){if(runtime.host.dataset.rtgAdaptiveState==='dock'&&!d.querySelector('dialog[open]'))door.focus({preventScroll:true});});
    },true);
    d.addEventListener('pointerdown',function(event){if(runtime.host.dataset.rtgAdaptiveState==='deck'&&!root.contains(event.target))edge.setState('dock');},{passive:true});
    new MutationObserver(syncDoor).observe(runtime.host,{attributes:true,attributeFilter:['data-rtg-adaptive-state']});syncDoor();
    // The shared runtime remains the owner; the app DS supplies its form only.
    function dress(){
      var bar=root.querySelector('.rtg-adaptive-bar');if(!bar)return;bar.classList.add('ds-edge__balk');
      bar.querySelectorAll('.rtg-adaptive-item').forEach(function(button){
        button.classList.add('ds-edge__knop');
        var rahul=button.dataset.rtgAdaptiveSlot==='2'&&button.dataset.rtgAdaptiveAction==='ai';
        button.classList.toggle('ds-edge__knop--rahul',rahul);
        if(rahul&&!button.querySelector('.ds-edge-painted-lips')){
          var lips=document.createElement('img'),icon=button.querySelector('svg');
          lips.className='rtg-adaptive-lips ds-edge-painted-lips';lips.src=new URL('images/brand/rtg-edge-lips.webp',assetBase).href;
          lips.alt='';lips.width=56;lips.height=38;
          if(icon)icon.replaceWith(lips);else button.prepend(lips);
        }
      });
      if(editorial)editorial.refresh();
    }
    if(w.RTGPublicEdgeEditorial&&w.RTGPublicDetail)editorial=w.RTGPublicEdgeEditorial.mount(runtime,{read:w.RTGPublicDetail.context});
    dress();new MutationObserver(dress).observe(root,{childList:true,subtree:true});
    d.documentElement.classList.add('ds-edge-aan');d.body.classList.add('ds-public-edge-page');d.body.dataset.publicEdgeReady='true';
    var guard=root.querySelector('.rtg-adaptive-guard');if(guard)guard.remove();
  }
  // One original information source, reachable through the Edge instead of a
  // static website footer. Its links, disclosures and provenance stay alive.
  var footer=d.querySelector('.world-footer,.explore-footer');
  if(footer){
    var info=d.createElement('section');info.id='publicPageInfo';info.className='story-edge-panel ds-public-info';info.hidden=true;info.append(footer);d.body.append(info);
    var infoButton=d.createElement('button');infoButton.type='button';infoButton.dataset.publicInfo='';infoButton.textContent='Info';infoButton.setAttribute('aria-controls',info.id);nav.append(infoButton);
    function openInfo(target){
      if(info.hidden)edge.openPanel(info,{title:'Service, informatie en colofon'});
      if(target){var ancestor=target.closest('details');while(ancestor){ancestor.open=true;ancestor=ancestor.parentElement.closest('details');}target.scrollIntoView({block:'nearest'});if(!target.matches('a,button,input,summary'))target.tabIndex=-1;target.focus({preventScroll:true});}
    }
    function infoHash(){var id;try{id=decodeURIComponent(w.location.hash.slice(1));}catch(_){return;}var target=id&&d.getElementById(id);if(target&&info.contains(target))openInfo(target);}
    infoButton.addEventListener('click',function(){openInfo();});
    info.addEventListener('click',function(event){var a=event.target.closest('a[href]');if(!a)return;var url=new URL(a.href,w.location.href),target;try{target=url.hash&&d.getElementById(decodeURIComponent(url.hash.slice(1)));}catch(_){}if(url.origin===w.location.origin&&url.pathname===w.location.pathname&&target&&info.contains(target))openInfo(target);else edge.setState('dock');});
    w.addEventListener('hashchange',infoHash);infoHash();
  }
  edge.continueWith({ title: title, copy: 'Ontdek. Probeer. Kies zelf.' });
  var menu = d.querySelector('[data-public-menu]');
  if (menu) {
    menu.addEventListener('click', function () {
      if (menu.getAttribute('aria-expanded') === 'true') { edge.setState('dock'); return; }
      edge.openPanel(panel, { title: 'Ontdek RTG', copy: 'Reizen. Verbinden. Leven.' });
    });
    var sync = function () { menu.setAttribute('aria-expanded', String(panel.isConnected && !panel.hidden && panel.getClientRects().length > 0)); };
    new MutationObserver(sync).observe(root, { subtree: true, attributes: true, attributeFilter: ['hidden', 'data-state', 'class'] });
    var actionsButton = d.createElement('button'); actionsButton.type = 'button'; actionsButton.textContent = 'Acties op deze pagina'; actionsButton.addEventListener('click', actions); nav.appendChild(actionsButton);
  }
  if (painted) return;
  var progress = d.createElement('div'); progress.className = 'story-progress'; progress.setAttribute('aria-hidden', 'true'); d.body.appendChild(progress);
  var pending = false;
  function measure() { pending = false; var range = d.documentElement.scrollHeight - w.innerHeight;
    progress.style.setProperty('--story-progress', String(range > 0 ? Math.min(1, Math.max(0, w.scrollY / range)) : 0)); }
  w.addEventListener('scroll', function () { if (!pending) { pending = true; w.requestAnimationFrame(measure); } }, { passive: true });
  w.addEventListener('resize', measure); measure();
}(window, document));
