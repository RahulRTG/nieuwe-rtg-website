/* One public host for the existing, canonical Edge. */
(function(w,d){
 'use strict';
 var imageBase=new URL('../images/',d.currentScript.src);
 w.RTGPublicEdge=function(o){
  var P=w.RTGPublicPlatform,E=w.RTGAdaptiveEdge,root=d.createElement('div'),panel=d.createElement('div');
  root.className='rtg-edge-chrome rtg-experience-edge pp-edge'+(d.getElementById('magazineHome')?' ds-public-edge ds-edge':'');panel.hidden=true;panel.className='pp-menu-panel';d.body.append(root,panel);
  if(d.getElementById('magazineHome'))root.dataset.rtgWorld='living';
  var magazineControls=d.querySelector('.ds-issue-controls'),editorial=null;
  function actions(){
   if(magazineControls)magazineControls.remove();
   panel.replaceChildren();
   if(d.getElementById('magazineHome')){
    var reading=editorial&&editorial.appendActions(panel);
    if(magazineControls){magazineControls.hidden=false;panel.append(magazineControls);}
    function action(label,run){var button=d.createElement('button');button.type='button';button.className='pp-menu-item';button.textContent=label;button.addEventListener('click',function(){E.setState('dock');run();});panel.append(button);}
    if(o.shell.current())action('Terug naar de editie',o.shell.back);
    action('Inhoud van deze editie',function(){o.shell.page('inhoudsopgave');});
    action('Zoek in RTG',function(){w.RTGCommand.open();});
    action('Service, informatie en colofon',function(){o.shell.page('blad:publicatie');});
    action(P.copy('proposalOpen'),o.proposal);
    action(P.copy('why'),function(){o.open('uw-rtg');});
    action(P.copy('reset'),o.reset);
    E.openPanel(panel,{title:reading&&reading.kind==='article'?'Bij dit verhaal':'Op dit blad'});return;
   }
   var rows=[['next',function(){o.shell.collapse();o.shell.next(1);}],['previous',function(){o.shell.collapse();o.shell.next(-1);}]];
   if(o.kind==='app')rows.push(['proposalOpen',o.proposal],['why',function(){o.open('uw-rtg');}],['reset',o.reset]);
   else rows.push(['architectureOpen',function(){o.open('architecture');}],['contact',function(){o.open('support');}]);
   rows.forEach(function(r){panel.append(P.button(r[0],function(){E.setState('dock');r[1]();},'pp-menu-item'));});
   E.openPanel(panel,{title:P.copy('actions')});
  }
  var host={root:root,cfg:{home:'#platform-home',kaart:'RTG'},ctx:{title:P.copy(o.kind==='company'?'company':'app')},onEdgeAction:function(action){
   if(action==='home'){if(o.shell.page)o.shell.page('editie');else o.shell.collapse();w.scrollTo({top:0,behavior:'instant'});}
   else if(action==='back'){if(o.shell.back)o.shell.back();else o.shell.collapse();}
   else if(action==='worlds')o.shell.worlds();
   else if(action==='menu')o.shell.menu();
   else if(action==='ai'){if(d.getElementById('magazineHome'))E.setState('dock');o.open(o.kind==='company'?'rahul':'rahul');}
   else if(action==='status'||action==='presence')o.open(o.kind==='company'?'control':'regie');
   else if(['context','primary','connect'].includes(action))actions();
   else return false;
   return true;
  }};
  var runtime=E.start(d,w,host);
  if(!runtime||runtime.edge.root!==root){root.remove();panel.remove();return null;}
  /* Public navigation does not evaluate a member mandate. Keep the native surface without a false verification badge. */
  root.querySelector('.rtg-adaptive-guard').remove();
  if(d.getElementById('magazineHome')){
   d.documentElement.classList.add('ds-edge-aan');
   d.body.classList.add('ds-public-edge-page');
   /* Dock/peek are the quiet public doorway; deck/expanded remain owned by
      the native runtime. Hover or reading must never open the website bar. */
   var door=d.createElement('button'),mark=d.createElement('img'),close=d.createElement('span');
   door.type='button';door.className='ds-public-edge-toggle';
   mark.src=new URL('brand/rtg-edge-lips.webp',imageBase).href;mark.alt='';mark.width=56;mark.height=38;
   close.textContent='×';close.setAttribute('aria-hidden','true');door.append(mark,close);
   runtime.bar.id='publicEdgeBar';door.setAttribute('aria-controls',runtime.bar.id);runtime.host.append(door);
   function syncDoor(){
    var open=['deck','expanded'].includes(runtime.host.dataset.rtgAdaptiveState);
    door.setAttribute('aria-expanded',String(open));door.setAttribute('aria-label',open?'Edge sluiten':'Edge openen');
    if(!open&&d.activeElement!==door&&runtime.host.contains(d.activeElement))door.focus({preventScroll:true});
   }
   door.addEventListener('click',function(event){event.stopPropagation();E.setState(door.getAttribute('aria-expanded')==='true'?'dock':'deck');syncDoor();});
   d.addEventListener('keydown',function(event){
    if(event.key!=='Escape'||d.querySelector('dialog[open]'))return;
    var state=runtime.host.dataset.rtgAdaptiveState;
    if(state==='deck')E.setState('dock');
    if(state==='deck'||state==='expanded')w.requestAnimationFrame(function(){if(runtime.host.dataset.rtgAdaptiveState==='dock'&&!d.querySelector('dialog[open]'))door.focus({preventScroll:true});});
   },true);
   d.addEventListener('pointerdown',function(event){if(runtime.host.dataset.rtgAdaptiveState==='deck'&&!root.contains(event.target))E.setState('dock');},{passive:true});
   new MutationObserver(syncDoor).observe(runtime.host,{attributes:true,attributeFilter:['data-rtg-adaptive-state']});syncDoor();
   if(magazineControls)magazineControls.hidden=true;
   var menu=d.querySelector('#explorePanel .ds-discover-service')||d.getElementById('explorePanel');
   [['Inhoud van deze editie',function(){o.shell.page('inhoudsopgave');}],['Zoek in RTG',function(){w.RTGCommand.open();}],['Service, informatie en colofon',function(){o.shell.page('blad:publicatie');}]].forEach(function(row){
    var button=d.createElement('button');button.type='button';button.textContent=row[0];button.addEventListener('click',function(){E.setState('dock');row[1]();});menu.append(button);
   });
  }
  /* Public presentation only: the canonical service buttons keep their nodes,
     closures and routes. The gallery reads their pressed state, never owns it. */
  var gallery=null,art=null,nowLinks=null,sheet=root.querySelector('.rtg-adaptive-sheet'),pages=null,flow=null,pagination=null,previous=null,next=null,pageStatus=null,pageFrame=0,controlFrame=0,pageTimer=0,pageKey='',resetPage=false,requestedPage=null;
  var leaves=[],wrappers=[],owners=[],summaries=[],captionSplit=null,observer=null,quietDepth=0,atomic='a,button,summary,p,h1,h2,h3,h4,small,form,fieldset,label,dl,img,input,textarea,select,.ds-issue-controls';
  var discoverArt=d.querySelector('#explorePanel .ds-discover-art'),artPlace=null,discoverService=d.querySelector('#explorePanel .ds-discover-service');
  if(discoverArt&&discoverService){artPlace=d.createComment('original discover artwork');discoverArt.before(artPlace);}
  function desktopFolio(){return w.matchMedia('(min-width: 1100px)').matches;}
  var observation={childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-pressed','data-rtg-custom-panel','hidden','open']};
  function quietly(action){
   if(!quietDepth++&&observer)observer.disconnect();
   try{return action();}finally{if(!--quietDepth&&observer)observer.observe(root,observation);}
  }
  if(d.getElementById('magazineHome')){
   gallery=d.createElement('figure');gallery.className='ds-edge-gallery';gallery.hidden=true;
   art=d.createElement('img');art.alt='';art.loading='lazy';art.decoding='async';
   var caption=d.createElement('figcaption');caption.append(sheet.querySelector('.rtg-adaptive-sheet-head p'));
   gallery.append(art,caption);sheet.querySelector('.rtg-adaptive-modes').after(gallery);
   nowLinks=d.createElement('nav');nowLinks.className='ds-edge-now';nowLinks.hidden=true;nowLinks.setAttribute('aria-label','Verder in het magazine');
   var contents=d.createElement('a');contents.href='#inhoudsopgave';contents.textContent='Inhoud van deze editie';contents.addEventListener('click',function(){E.setState('dock');});
   nowLinks.append(contents,P.button('actions',actions));sheet.append(nowLinks);
   /* Explicit leaves stay INSIDE each original owner. A native service render
      may discard its children; the pager must never resurrect those nodes. */
   pages=d.createElement('div');pages.className='ds-edge-pages';pages.id='publicEdgePages';pages.tabIndex=0;pages.setAttribute('aria-label','Bladen in dit menu');
   flow=d.createElement('div');flow.className='ds-edge-flow';pages.append(flow);
   pagination=d.createElement('nav');pagination.className='ds-edge-pagination';pagination.setAttribute('aria-label','Blader door dit menu');
   previous=d.createElement('button');previous.type='button';previous.dataset.edgePage='-1';previous.setAttribute('aria-label','Vorig menublad');previous.textContent='←';
   next=d.createElement('button');next.type='button';next.dataset.edgePage='1';next.setAttribute('aria-label','Volgend menublad');next.textContent='→';
   [previous,next].forEach(function(button){button.setAttribute('aria-controls',pages.id);});
   pageStatus=d.createElement('span');pageStatus.className='ds-edge-page-status';pageStatus.setAttribute('role','status');pageStatus.setAttribute('aria-live','polite');
   pagination.append(previous,pageStatus,next);sheet.append(pages,pagination);
   previous.addEventListener('click',function(){turnPage(-1);});next.addEventListener('click',function(){turnPage(1);});
   pages.addEventListener('scroll',function(){queueControls();w.clearTimeout(pageTimer);pageTimer=w.setTimeout(function(){requestedPage=null;turnPage(0);},150);},{passive:true});
   pages.addEventListener('pointerdown',function(){requestedPage=null;},{passive:true});
   pages.addEventListener('keydown',function(event){
    if(event.target!==pages||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();var state=pageState(),index=requestedPage===null?state.index:requestedPage;
    goPage(event.key==='Home'?0:event.key==='End'?state.count-1:index+(event.key==='ArrowRight'?1:-1)*state.direction);
   });
   pages.addEventListener('focusin',function(event){
    if(event.target===pages)return;
    var leaf=event.target.closest('.ds-edge-leaf'),index=leaves.indexOf(leaf);if(index>=0)goPage(index,true);
   });
   var modeNav=sheet.querySelector('.rtg-adaptive-modes');
   function revealMode(button){
    var box=modeNav.getBoundingClientRect(),rect=button.getBoundingClientRect(),start=box.left+modeNav.clientLeft,end=start+modeNav.clientWidth;
    var offset=rect.left<start?rect.left-start:rect.right>end?rect.right-end:0;
    if(Math.abs(offset)>.5)modeNav.scrollBy({left:offset,behavior:'instant'});
   }
   modeNav.addEventListener('focusin',function(event){
    var button=event.target.closest('[data-rtg-adaptive-mode]');if(!button)return;
    revealMode(button);w.requestAnimationFrame(function(){if(d.activeElement===button)revealMode(button);});
   });
   if(w.ResizeObserver)new w.ResizeObserver(queuePages).observe(pages);
   w.addEventListener('resize',queuePages);if(w.visualViewport)w.visualViewport.addEventListener('resize',queuePages);
   if(d.fonts){d.fonts.ready.then(queuePages);d.fonts.addEventListener('loadingdone',queuePages);}
   root.addEventListener('load',function(event){if(event.target.tagName==='IMG')queuePages();},true);
   new MutationObserver(queuePages).observe(d.documentElement,{attributes:true,attributeFilter:['style','class','dir']});
  }
  function pageState(){
   var box=pages.getBoundingClientRect(),centre=box.left+box.width/2,index=0,distance=Infinity;
   leaves.forEach(function(leaf,i){var rect=leaf.getBoundingClientRect(),offset=Math.abs(rect.left+rect.width/2-centre);if(offset<distance){distance=offset;index=i;}});
   return {direction:w.getComputedStyle(pages).direction==='rtl'?-1:1,count:Math.max(1,leaves.length),index:index};
  }
  function pageControls(){
   controlFrame=0;if(!pages||sheet.hidden)return;
   quietly(function(){var state=pageState(),index=Math.min(state.count-1,state.index),label=(index+1)+' / '+state.count;
    if(pageStatus.textContent!==label)pageStatus.textContent=label;
    previous.disabled=index===0;next.disabled=index>=state.count-1;
   });
  }
  function queueControls(){if(pages&&!controlFrame)controlFrame=w.requestAnimationFrame(pageControls);}
  function queuePages(){if(pages&&!pageFrame)pageFrame=w.requestAnimationFrame(layoutPages);}
  function goPage(index,instant){
   if(!pages||sheet.hidden||!leaves.length)return;index=Math.max(0,Math.min(leaves.length-1,index));requestedPage=index;
   var box=pages.getBoundingClientRect(),rect=leaves[index].getBoundingClientRect(),offset=rect.left+rect.width/2-(box.left+box.width/2);
   if(Math.abs(offset)>.5)pages.scrollBy({left:offset,behavior:instant||w.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
   else requestedPage=null;
   queueControls();
  }
  function turnPage(delta,instant){var state=pageState();goPage((requestedPage===null?state.index:requestedPage)+delta,instant);}
  function restorePages(){
   if(captionSplit){
    var split=captionSplit,children=Array.from(split.node.childNodes);
    // Restore only our untouched fragments. A native textContent render wins.
    if(children.length===split.spans.length&&children.every(function(child,i){return child===split.spans[i];})&&split.node.textContent===split.text)split.node.replaceChildren.apply(split.node,split.original);
    else split.spans.forEach(function(span){if(span.parentNode===split.node)span.replaceWith.apply(span,Array.from(span.childNodes));});
    captionSplit=null;
   }
   if(gallery)gallery.classList.remove('ds-edge-gallery-paged');
   wrappers.forEach(function(leaf){if(leaf.isConnected)leaf.replaceWith.apply(leaf,Array.from(leaf.childNodes));});
   owners.forEach(function(owner){owner.classList.remove('ds-edge-owner','ds-edge-details');});
   summaries.forEach(function(summary){summary.classList.remove('ds-edge-leaf','ds-edge-summary-leaf');});
   wrappers=[];owners=[];summaries=[];leaves=[];
  }
  function visible(node){return !node.hidden&&w.getComputedStyle(node).display!=='none';}
  function own(node){
   node.classList.add('ds-edge-owner');owners.push(node);
   // Native openPanel forces display:block. Its original root remains visible
   // here through the DS owner contract, and native closePanel still owns it.
   if(node.matches('.experience-panel,.pp-menu-panel')&&node.style.getPropertyValue('display')==='block')node.style.removeProperty('display');
  }
  function newLeaf(owner,before,artwork){
   var leaf=d.createElement('div');leaf.className='ds-edge-leaf'+(artwork?' ds-edge-art-leaf':'');
   owner.insertBefore(leaf,before||null);wrappers.push(leaf);leaves.push(leaf);return leaf;
  }
  function packGallery(){
   var leaf=newLeaf(flow,gallery,true);leaf.append(gallery);
   if(leaf.scrollHeight<=pages.clientHeight+1)return;
   var caption=gallery.querySelector('figcaption'),paragraph=caption&&caption.querySelector('p');
   if(!paragraph||!paragraph.textContent)return;
   leaf.before(gallery);leaf.remove();wrappers=wrappers.filter(function(item){return item!==leaf;});leaves=leaves.filter(function(item){return item!==leaf;});
   gallery.classList.add('ds-edge-gallery-paged');own(gallery);own(caption);own(paragraph);
   var imageLeaf=newLeaf(gallery,art,true);imageLeaf.append(art);
   var text=paragraph.textContent,original=Array.from(paragraph.childNodes),spans=[],tokens=text.match(/\S+\s*|\s+/g)||[],current=null;
   paragraph.replaceChildren();captionSplit={node:paragraph,original:original,spans:spans,text:text};
   function fragment(){var span=d.createElement('span');span.className='ds-edge-leaf ds-edge-caption-leaf';paragraph.append(span);spans.push(span);leaves.push(span);return span;}
   tokens.forEach(function(token){
    if(!current)current=fragment();
    var previousText=current.textContent;current.textContent=previousText+token;
    if(current.scrollHeight<=pages.clientHeight+1)return;
    if(previousText){current.textContent=previousText;current=fragment();current.textContent=token;}
    if(current.scrollHeight<=pages.clientHeight+1)return;
    // An unusually long unbroken word can also continue on the next leaf.
    current.textContent='';Array.from(token).forEach(function(character){
     var before=current.textContent;current.textContent=before+character;
     if(before&&current.scrollHeight>pages.clientHeight+1){current.textContent=before;current=fragment();current.textContent=character;}
    });
   });
  }
  function pack(owner){
   if(!visible(owner))return;
   if(owner.matches(atomic)){var single=newLeaf(owner.parentNode,owner,false);single.append(owner);return;}
   own(owner);var leaf=null;
   Array.from(owner.children).forEach(function(node){
    if(!visible(node))return;
    if(node.tagName==='DETAILS'){
     leaf=null;own(node);node.classList.add('ds-edge-details');
     var summary=Array.from(node.children).find(function(child){return child.tagName==='SUMMARY';});
     if(summary){summary.classList.add('ds-edge-leaf','ds-edge-summary-leaf');summaries.push(summary);leaves.push(summary);}
     if(node.open)Array.from(node.children).forEach(function(child){if(child!==summary)pack(child);});
     return;
    }
    var artwork=node===gallery||(node.matches('.ds-discover-art')&&!desktopFolio());
    if(!artwork&&node.children.length&&!node.matches(atomic)){leaf=null;pack(node);return;}
    if(artwork){leaf=newLeaf(owner,node,true);leaf.append(node);leaf=null;return;}
    if(!leaf)leaf=newLeaf(owner,node,false);
    leaf.append(node);
    if(leaf.children.length>1&&leaf.scrollHeight>pages.clientHeight+1){var nextLeaf=newLeaf(owner,leaf.nextSibling,false);nextLeaf.append(node);leaf=nextLeaf;}
   });
  }
  function layoutPages(){
   pageFrame=0;if(!pages)return;
   quietly(function(){
    var active=d.activeElement,oldLeaf=leaves[pageState().index],anchor=active&&pages.contains(active)?active:oldLeaf&&(oldLeaf.matches('summary')?oldLeaf:oldLeaf.firstElementChild),captionBookmark=null;
    // Text leaves are presentation fragments, not durable owners. Keep the
    // reader's character offset when a late image load or resize rebuilds them.
    if(captionSplit&&captionSplit.spans.includes(oldLeaf)){
     var offset=0;captionSplit.spans.some(function(span){if(span===oldLeaf)return true;offset+=span.textContent.length;return false;});
     captionBookmark={node:captionSplit.node,offset:offset};
    }
    restorePages();
    // On desktop the sheet's painted left page already supplies the artwork.
    // Keep the ORIGINAL art link in its original panel as a service caption;
    // phone layouts restore its image leaf. No duplicated links or handlers.
    if(artPlace){
     if(desktopFolio()){if(discoverArt.parentNode!==discoverService)discoverService.prepend(discoverArt);}
     else if(discoverArt.previousSibling!==artPlace)artPlace.after(discoverArt);
    }
    if(sheet.hidden)return;
    if(pages.clientWidth<1||pages.clientHeight<1)return;
    Array.from(flow.children).forEach(function(owner){
     if(!visible(owner))return;
     if(owner===gallery)packGallery();else pack(owner);
    });
    if(!leaves.length)newLeaf(flow,null,false);
    leaves=Array.from(pages.querySelectorAll('.ds-edge-leaf'));
    leaves.forEach(function(leaf){if(leaf.scrollHeight>pages.clientHeight+1)leaf.dataset.edgePageOverflow='true';else delete leaf.dataset.edgePageOverflow;});
    var target=!resetPage&&anchor&&anchor.closest('.ds-edge-leaf');
    if(!resetPage&&captionBookmark&&captionBookmark.node.isConnected){
     target=captionBookmark.node.closest('.ds-edge-leaf');
     if(captionSplit&&captionSplit.node===captionBookmark.node){
      var start=0;target=captionSplit.spans.find(function(span){var end=start+span.textContent.length,contains=captionBookmark.offset>=start&&captionBookmark.offset<end;start=end;return contains;})||captionSplit.spans[captionSplit.spans.length-1];
     }
    }
    var index=leaves.indexOf(target);resetPage=false;
    if(active&&active.isConnected&&pages.contains(active))active.focus({preventScroll:true});
    goPage(index<0?0:index,true);pageControls();
   });
  }
  function presentation(){
   if(!gallery)return;
   var active=sheet.querySelector('[data-rtg-adaptive-mode][aria-pressed="true"]'),mode=active?active.dataset.rtgAdaptiveMode:'now';
   var custom=sheet.hasAttribute('data-rtg-custom-panel'),hidden=custom||sheet.hidden;
   if(gallery.hidden!==hidden)gallery.hidden=hidden;
   if(!editorial){var url=new URL('brand/rtg-painted-horizon.webp',imageBase).href;if(art.src!==url)art.src=url;}
   if(gallery.dataset.mode!==mode)gallery.dataset.mode=mode;
   var controls=sheet.querySelector('.rtg-adaptive-controls'),empty=!controls||!controls.children.length;
   var hideLinks=!!editorial||hidden||mode!=='now'||!empty;
   if(nowLinks.hidden!==hideLinks)nowLinks.hidden=hideLinks;
   var activeElement=d.activeElement,movedFocus=false;
   Array.from(sheet.children).forEach(function(node){if(node!==pages&&node!==pagination&&!node.matches('.rtg-adaptive-sheet-head,.rtg-adaptive-modes,.ds-edge-reading-art')){if(node.contains(activeElement))movedFocus=true;flow.append(node);}});
   if(movedFocus&&activeElement.isConnected)activeElement.focus({preventScroll:true});
   var customNode=flow.querySelector('.experience-panel:not([hidden]),.pp-menu-panel:not([hidden])'),key=custom?'custom:'+(customNode?customNode===panel?'actions':customNode.id||'panel':''):mode;
   if(pageKey!==key){pageKey=key;resetPage=true;var modes=sheet.querySelector('.rtg-adaptive-modes');if(active){var bounds=modes.getBoundingClientRect(),rect=active.getBoundingClientRect();if(rect.left<bounds.left||rect.right>bounds.right)modes.scrollBy({left:rect.left+rect.width/2-(bounds.left+bounds.width/2),behavior:'instant'});}}
   queuePages();
  }
  /* Changing a tab starts at its heading, including after scrolling a long
     account/menu sheet. No history or service action is changed here. */
  sheet.querySelector('.rtg-adaptive-modes').addEventListener('click',function(event){if(event.target.closest('[data-rtg-adaptive-mode]'))sheet.scrollTop=0;});
  function labels(){quietly(function(){
   if(d.getElementById('magazineHome')){
    root.querySelector('.rtg-adaptive-bar').classList.add('ds-edge__balk');
    root.querySelectorAll('.rtg-adaptive-item').forEach(function(button){
     button.classList.add('ds-edge__knop');
     var rahul=button.dataset.rtgAdaptiveSlot==='2'&&button.dataset.rtgAdaptiveAction==='ai';
     button.classList.toggle('ds-edge__knop--rahul',rahul);
     // Presentation only: keep the native button, handler and accessible label.
     if(rahul&&!button.querySelector('.ds-edge-painted-lips')){
      var lips=d.createElement('img'),icon=button.querySelector('svg');
      lips.className='rtg-adaptive-lips ds-edge-painted-lips';lips.src=new URL('brand/rtg-edge-lips.webp',imageBase).href;
      lips.alt='';lips.width=56;lips.height=38;
      if(icon)icon.replaceWith(lips);else button.prepend(lips);
     }
    });
   }
   var heading=root.querySelector('.rtg-adaptive-sheet-head small:not(.ds-edge-reading-caption)'),headingKey=o.kind==='company'?'company':'app';if(heading){var headingText=P.copy(headingKey);heading.dataset.i18n='public.'+headingKey;heading.dataset.i18nSource=w.RTGPublicContent.words[headingKey][0];if(heading.textContent!==headingText)heading.textContent=headingText;}
   var keys={home:'home',worlds:'worlds',menu:'menu',context:'actions',primary:'actions',connect:'actions',ai:'rahulAppCardTitle',back:'back',status:'regie',presence:'people'};
   root.querySelectorAll('.rtg-adaptive-item').forEach(function(el){var key=keys[el.dataset.rtgAdaptiveAction];if(!key)return;var value=P.copy(key),label=el.querySelector('small');if(label){label.dataset.i18n='public.'+key;label.dataset.i18nSource=w.RTGPublicContent.words[key][0];label.translate=false;if(label.textContent!==value)label.textContent=value;}el.dataset.i18nAria='public.'+key;if(el.getAttribute('aria-label')!==value)el.setAttribute('aria-label',value);});
   var caption=root.querySelector('.rtg-adaptive-caption'),value=P.copy(o.kind==='company'?'company':'app');if(caption&&caption.textContent!==value)caption.textContent=value;
   if(editorial)editorial.refresh();presentation();
  });}
  if(d.getElementById('magazineHome')&&w.RTGPublicEdgeEditorial)editorial=w.RTGPublicEdgeEditorial.mount(runtime,{read:o.shell.context,changed:labels});
  observer=new MutationObserver(labels);observer.observe(root,observation);w.addEventListener('rtglang',labels);labels();
  return {actions:actions,refresh:labels};
 };
})(window,document);
