/* Physical menu paging and focus. Reads native service state; never owns it. */
(function(w,d){'use strict';
 var imageBase=new URL('../images/',d.currentScript.src);
 w.RTGPublicEdgePager=function(runtime,o){
  var P=w.RTGPublicPlatform,E=w.RTGAdaptiveEdge,root=runtime.edge.root,panel=o.panel,actions=o.actions,quietly=o.quietly;
  var sheet=runtime.sheet,gallery,art,nowLinks,pages,flow,pagination,previous,next,pageStatus;
  var pageFrame=0,controlFrame=0,pageTimer=0,pageKey='',resetPage=false,requestedPage=null,leaves=[];
  var discoverArt=d.querySelector('#explorePanel .ds-discover-art'),artPlace=null,discoverService=d.querySelector('#explorePanel .ds-discover-service');
  if(discoverArt&&discoverService){artPlace=d.createComment('original discover artwork');discoverArt.before(artPlace);}
  function desktopFolio(){return w.matchMedia('(min-width: 1100px)').matches;}
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
  var layout=w.RTGPublicEdgeLayout({pages:pages,flow:flow,gallery:gallery,art:art,sheet:sheet,discoverArt:discoverArt,discoverService:discoverService,artPlace:artPlace,desktopFolio:desktopFolio});
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
  function layoutPages(){
   pageFrame=0;if(!pages)return;
   quietly(function(){
    var active=d.activeElement,oldLeaf=leaves[pageState().index],anchor=active&&pages.contains(active)?active:oldLeaf&&(oldLeaf.matches('summary')?oldLeaf:oldLeaf.firstElementChild),mark=layout.bookmark(oldLeaf);
    leaves=layout.render();
    if(sheet.hidden||pages.clientWidth<1||pages.clientHeight<1)return;
    var target=!resetPage&&anchor&&anchor.closest('.ds-edge-leaf');
    if(!resetPage&&mark&&mark.node.isConnected)target=layout.locate(mark);
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
   if(!o.isEditorial()){var url=new URL('brand/rtg-painted-horizon.webp',imageBase).href;if(art.src!==url)art.src=url;}
   if(gallery.dataset.mode!==mode)gallery.dataset.mode=mode;
   var controls=sheet.querySelector('.rtg-adaptive-controls'),empty=!controls||!controls.children.length;
   var hideLinks=!!o.isEditorial()||hidden||mode!=='now'||!empty;
   if(nowLinks.hidden!==hideLinks)nowLinks.hidden=hideLinks;
   var activeElement=d.activeElement,movedFocus=false;
   Array.from(sheet.children).forEach(function(node){if(node!==pages&&node!==pagination&&!node.matches('.rtg-adaptive-sheet-head,.rtg-adaptive-modes,.ds-edge-reading-art')){if(node.contains(activeElement))movedFocus=true;flow.append(node);}});
   if(movedFocus&&activeElement.isConnected)activeElement.focus({preventScroll:true});
   var customNode=flow.querySelector('.experience-panel:not([hidden]),.pp-menu-panel:not([hidden])'),key=custom?'custom:'+(customNode?customNode===panel?'actions':customNode.id||'panel':''):mode;
   if(pageKey!==key){pageKey=key;resetPage=true;var modes=sheet.querySelector('.rtg-adaptive-modes');if(active){var bounds=modes.getBoundingClientRect(),rect=active.getBoundingClientRect();if(rect.left<bounds.left||rect.right>bounds.right)modes.scrollBy({left:rect.left+rect.width/2-(bounds.left+bounds.width/2),behavior:'instant'});}}
   queuePages();
  }
  return {refresh:presentation};
 };
})(window,document);
