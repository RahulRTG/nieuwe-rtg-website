/* One editorial reader over the original DOM. No cloned scenes, publishing
   endpoint, tracking, automatic paging or second product state. */
(function(w,d){
 'use strict';
 w.RTGPublicMagazine=function(o){
  var source=o.source,root=d.getElementById('platform-home'),home=d.getElementById('magazineHome');
  var focus=d.getElementById('magazineDetail'),detail=d.getElementById('magazineDetailContent'),title=d.getElementById('magazineDetailTitle');
  var current=null,moved=null,lastFocus=null,savedScroll=0,savedPage=0,savedLeaf=0,selected={id:'overview',target:'moment',world:'travel'};
  var track=d.querySelector('[data-magazine-carousel]'),cards=Array.from(track.querySelectorAll('[data-issue-page]'));
  var previous=d.querySelector('[data-carousel-prev]'),forward=d.querySelector('[data-carousel-next]'),status=d.querySelector('[data-carousel-status]'),caption=d.querySelector('[data-issue-caption]');
  var cardIndex=0,requested=null,frame=0,settled,saveTimer,depth=0,booting=true,replaying=false,applyingReplay=false,pendingBack=false,restoreToken=0;
  var edition=cards.map(function(card){return card.id;}).join('|'),storageKey='rtg-magazine-reading-v1:'+w.location.pathname;
  var initialHash=w.location.hash,initialState=w.history.state&&w.history.state.rtgMagazine,stored=null;
  var footer=d.querySelector('.ds-magazine-footer'),fitFrame=0,leafHeadings=new Map();
  // Read the reader's own coordinates and original content node. Consumers
  // receive no second page state and cannot navigate through this projection.
  function context(){
   var node=current&&moved?moved.el:cards[cardIndex];
   return {node:node,id:current||node.id,title:current?title.textContent:node.dataset.issueLabel,kind:current?'article':'page',index:current?savedPage:cardIndex,total:cards.length};
  }
  function readingChanged(){w.dispatchEvent(new CustomEvent('rtg-public-reading-change'));}
  // A dense leaf opens its ORIGINAL node in the same reader. A small cover is
  // never made usable by clipping its source or cloning its actions.
  function readingNode(id){return id==='blad:publicatie'||(id&&footer&&footer.contains(d.getElementById(id)))?footer:typeof id==='string'&&id.startsWith('blad:')?cards.find(function(card){return card.id===id.slice(5);}):null;}
  cards.forEach(function(card,index){
   leafHeadings.set(card,card.getAttribute('aria-labelledby'));
   var preview=d.createElement('div'),kicker=d.createElement('p'),heading=d.createElement('h2'),open=d.createElement('button');
   preview.className='ds-issue-preview';kicker.className='ds-magazine-kicker';kicker.textContent='RTG JOURNAL · '+String(index+1).padStart(2,'0');
   heading.id=card.id+'-preview-title';heading.textContent=card.dataset.issueLabel;
   open.type='button';open.className='ds-magazine-textlink';open.textContent=card.id==='inhoudsopgave'?'Open de inhoud':'Open dit blad';open.dataset.readLeaf=card.id;
   preview.append(kicker,heading,open);card.append(preview);
  });
  var imprint=d.createElement('button');imprint.type='button';imprint.className='ds-magazine-imprint';imprint.textContent='Info';imprint.setAttribute('aria-label','Open service, informatie en colofon');imprint.dataset.readLeaf='publicatie';
  d.querySelector('.ds-issue-topline').append(imprint);
  d.body.dataset.magazineView='cover';
  function fitLeaves(){
   fitFrame=0;if(home.hidden)return;
   cards.forEach(function(card){card.classList.remove('ds-issue-condensed');card.setAttribute('aria-labelledby',leafHeadings.get(card));card.scrollTop=0;});
   cards.forEach(function(card){if(card.scrollHeight>card.clientHeight+2||card.scrollWidth>card.clientWidth+2){card.classList.add('ds-issue-condensed');card.setAttribute('aria-labelledby',card.id+'-preview-title');}});
  }
  function scheduleFit(){if(!fitFrame)fitFrame=w.requestAnimationFrame(fitLeaves);}
  try{stored=JSON.parse(w.sessionStorage.getItem(storageKey));}catch(_){}
  function cardFor(id){return cards.findIndex(function(card){return card.id===id;});}
  function position(value){return typeof value==='number'&&isFinite(value)?Math.max(0,value):0;}
  function valid(value){
   if(!value||value.v!==1||value.edition!==edition||cardFor(value.page)<0)return false;
   var reading=readingNode(value.id),node=reading||d.getElementById(value.id);
   if(reading)return value.kind==='detail';
   return value.kind==='page'?cardFor(value.id)>=0:value.kind==='detail'&&!!node&&(source.contains(node)||detail.contains(node))&&node.hasAttribute('data-scene');
  }
  function snapshot(){
   var entry=current?lastFocus:d.activeElement,leaf=cards[current?savedPage:cardIndex],links=Array.from(leaf.querySelectorAll('a[href]'));
   var readingEntry=entry&&(entry===imprint||leaf.contains(entry))&&entry.hasAttribute('data-read-leaf')?entry.dataset.readLeaf:null;
   return {v:1,edition:edition,kind:current?'detail':'page',id:current||cards[cardIndex].id,page:cards[current?savedPage:cardIndex].id,
    scroll:current?position(w.scrollY):0,leaf:0,returnScroll:0,returnLeaf:0,
    entry:readingEntry?'blad:'+readingEntry:links.includes(entry)?entry.getAttribute('href'):null,entryIndex:links.indexOf(entry),depth:depth,hash:w.location.hash};
  }
  function write(push,url){
   if(booting||replaying)return;
   var value=snapshot(),state=Object.assign({},w.history.state||{});if(url!==undefined)value.hash=url;state.rtgMagazine=value;
   try{w.history[push?'pushState':'replaceState'](state,'',url===undefined?w.location.href:url);}catch(_){}
   // Tab-local reading coordinates only: no answers, form input or account data.
   try{w.sessionStorage.setItem(storageKey,JSON.stringify(value));}catch(_){}
  }
  function checkpoint(){w.clearTimeout(saveTimer);write(false);}
  function scheduleSave(){if(booting||replaying)return;w.clearTimeout(saveTimer);saveTimer=w.setTimeout(checkpoint,160);}
  function cancelReplay(){if(applyingReplay)return;++restoreToken;replaying=false;}
  function replayOpen(id){applyingReplay=true;try{if(readingNode(id))readLeaf(id);else o.open(id);}finally{applyingReplay=false;}}
  function detailHash(id){var params=new URLSearchParams();params.set('story',selected.id);params.set('detail',id);return '#rtg?'+params.toString();}
  function restore(){if(moved){moved.el.classList.remove('ds-issue-reader');moved.marker.replaceWith(moved.el);moved=null;}}
  function readLeaf(id){
   var node=readingNode(id);if(!node)return;
   if(!current&&cards.includes(node))move(cards.indexOf(node),true);
   show(id,node===footer?'Service, informatie en colofon':node.dataset.issueLabel,node);
   node.classList.remove('ds-issue-condensed');node.classList.add('ds-issue-reader');
   if(leafHeadings.has(node))node.setAttribute('aria-labelledby',leafHeadings.get(node));
   var target=node===footer&&d.getElementById(id);
   if(target&&footer.contains(target)){
    var disclosure=target.closest('details');while(disclosure){disclosure.open=true;disclosure=disclosure.parentElement.closest('details');}
    var entrance=target.matches('details')?target.querySelector('summary'):target;if(!entrance.hasAttribute('tabindex'))entrance.tabIndex=-1;
    entrance.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'instant'});
   }
  }
  function closest(){
   var rect=track.getBoundingClientRect(),middle=rect.left+rect.width/2,best=Infinity,index=cardIndex;
   if(!rect.width)return index;
   cards.forEach(function(card,i){var r=card.getBoundingClientRect(),distance=Math.abs(r.left+r.width/2-middle);if(distance<best){best=distance;index=i;}});
   return index;
  }
  function paint(){
   if(home.hidden)return;
   var before=cardIndex;
   cardIndex=closest();previous.setAttribute('aria-disabled',String(cardIndex===0));forward.setAttribute('aria-disabled',String(cardIndex===cards.length-1));
   var label=(cardIndex+1)+' / '+cards.length;if(status.textContent!==label)status.textContent=label;
   caption.textContent=cards[cardIndex].dataset.issueLabel;
   scheduleSave();
   if(before!==cardIndex)readingChanged();
  }
  function move(index,instant){
   index=Math.max(0,Math.min(cards.length-1,index));requested=index;
   var bounds=track.getBoundingClientRect(),r=cards[index].getBoundingClientRect();
   track.scrollBy({left:r.left+r.width/2-(bounds.left+bounds.width/2),behavior:instant||w.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
   w.clearTimeout(settled);settled=w.setTimeout(function(){requested=null;paint();},500);
   if(instant)paint();
  }
  function collapse(restoreFocus){
   var wasOpen=!!current;
   if(wasOpen)checkpoint();
   restore();detail.replaceChildren();current=null;focus.hidden=true;home.hidden=false;d.body.dataset.rtgWorld='living';d.body.dataset.magazineView='cover';scheduleFit();
   if(w.RTGAdaptiveEdge)w.RTGAdaptiveEdge.setState('dock');
   if(wasOpen){move(savedPage,true);cards[savedPage].scrollTop=0;}
   w.scrollTo({top:0,behavior:'instant'});
   depth=0;
   if(restoreFocus!==false){
    if(lastFocus&&lastFocus.isConnected){lastFocus.focus({preventScroll:true});w.scrollTo({top:savedScroll,behavior:'instant'});}
    write(false,'#'+cards[cardIndex].id);
   }
   if(wasOpen)readingChanged();
  }
  function show(id,key,content){
   cancelReplay();
   if(current===id)return;
   checkpoint();
   if(!current){lastFocus=d.activeElement;savedScroll=0;savedPage=closest();savedLeaf=0;}
   if(booting){var owner=cards.findIndex(function(card){return !['editie','inhoudsopgave'].includes(card.id)&&Array.from(card.querySelectorAll('a[href]')).some(function(link){return link.getAttribute('href')==='#'+id;});});if(owner>=0){savedPage=owner;lastFocus=Array.from(cards[owner].querySelectorAll('a[href]')).find(function(link){return link.getAttribute('href')==='#'+id;});}}
   var nextDepth=depth+1;
   restore();detail.replaceChildren();
   var marker=d.createComment('public-content:'+id);content.before(marker);moved={el:content,marker:marker};
   detail.append(content);current=id;title.textContent=w.RTGPublicPlatform.copy(key);title.dataset.i18n='public.'+key;title.dataset.i18nSource=(w.RTGPublicContent.words[key]||[key])[0];home.hidden=true;focus.hidden=false;d.body.dataset.magazineView='article';
   if(w.RTGAdaptiveEdge)w.RTGAdaptiveEdge.setState('dock');title.focus({preventScroll:true});w.scrollTo({top:0,behavior:'instant'});
   if(!booting&&!replaying){depth=nextDepth;write(true,detailHash(id));}
   readingChanged();
  }
  function page(id,history){
   cancelReplay();
   if(readingNode(id)){readLeaf(id);return;}
   var target=d.getElementById(id),leaf=target&&target.closest('[data-issue-page]');
   if(!leaf)leaf=cards[0];var changed=!!current||cardIndex!==cards.indexOf(leaf);checkpoint();collapse(false);move(cards.indexOf(leaf),true);
   leaf.focus({preventScroll:true});root.scrollIntoView({block:'start',behavior:'instant'});
   write(changed||history===true,'#'+id);
  }
  function entryFor(value){
   var leaf=cards[cardFor(value.page)],links=Array.from(leaf.querySelectorAll('a[href]')),entry=links[value.entryIndex];
   if(value.entry==='blad:publicatie')return d.querySelector('.ds-public-edge [data-rtg-adaptive-action="context"]')||imprint;
   if(typeof value.entry==='string'&&value.entry.startsWith('blad:'))return Array.from(leaf.querySelectorAll('[data-read-leaf]')).find(function(button){return button.dataset.readLeaf===value.entry.slice(5);});
   return entry&&entry.getAttribute('href')===value.entry?entry:links.find(function(link){return link.getAttribute('href')===value.entry;});
  }
  function replay(value){
   var token=++restoreToken;replaying=true;pendingBack=false;w.clearTimeout(saveTimer);w.clearTimeout(settled);requested=null;
   replayOpen(value.id);
   savedPage=cardFor(value.page);savedScroll=0;savedLeaf=0;lastFocus=entryFor(value)||cards[savedPage];
   depth=value.kind==='detail'?Math.min(1000,Math.floor(position(value.depth))):0;
   function place(){
    if(token!==restoreToken)return;
    if(value.kind==='page'){move(cardFor(value.id),true);cards[cardIndex].scrollTop=0;(entryFor(value)||cards[cardIndex]).focus({preventScroll:true});}
    else title.focus({preventScroll:true});
    w.scrollTo({top:value.kind==='page'?0:position(value.scroll),behavior:'instant'});
   }
   place();w.requestAnimationFrame(function(){w.requestAnimationFrame(function(){if(token!==restoreToken)return;place();replaying=false;write(false);});});
  }
  function locationTarget(){
   var value=w.location.hash,id;
   try{id=value.startsWith('#rtg?')?new URLSearchParams(value.slice(5)).get('detail'):decodeURIComponent(value.slice(1));}catch(_){return null;}
   if(!id)return 'editie';if(readingNode(id))return id;var target=d.getElementById(id);
   return target&&(target===root||home.contains(target)||source.contains(target)||detail.contains(target))?id:null;
  }
  function navigateHistory(event){
   var id=locationTarget();if(!id)return;
   event.stopImmediatePropagation();pendingBack=false;
   // Our popstate restoration owns this route. The subsequent hashchange must
   // not let platform-app open it a second time and reset its reading position.
   if(event.type==='hashchange'&&replaying)return;
   var value=w.history.state&&w.history.state.rtgMagazine;
   if(valid(value)&&value.hash===w.location.hash){replay(value);return;}
   ++restoreToken;replaying=true;replayOpen(id);depth=0;replaying=false;write(false);
  }
  function back(){
   if(!current||pendingBack)return;checkpoint();
   var state=w.history.state&&w.history.state.rtgMagazine;
   if(valid(state)&&depth>0){pendingBack=true;w.history.go(-depth);return;}
   collapse();
  }
  function select(id,notify){selected={id:id,target:'moment',world:'travel'};if(notify&&o.select)o.select(selected);}
  function refresh(){var lang=d.querySelector('.ds-magazine-nav [data-language-picker]');if(lang)lang.textContent=(w.RTGi18n?w.RTGi18n.lang:'nl').toUpperCase()+' ⌄';paint();}
  var menuButton=d.querySelector('[data-magazine-menu]');
  function menu(){var panel=d.getElementById('explorePanel');w.RTGAdaptiveEdge.openPanel(panel,{title:'Ontdek RTG',onClose:function(){menuButton.setAttribute('aria-expanded','false');}});menuButton.setAttribute('aria-expanded',String(!panel.hidden));}
  function worlds(){w.RTGAdaptiveEdge.openPanel(d.getElementById('worldPanel'),{title:'Vier werelden'});}
  menuButton.addEventListener('click',menu);
  d.getElementById('experienceLanguage').addEventListener('click',function(){w.RTGAdaptiveEdge.setState('dock');},true);
  d.querySelector('[data-magazine-actions]').addEventListener('click',function(){w.RTGPublicApp.edge.actions();});
  function next(delta){cancelReplay();collapse(false);move((requested===null?cardIndex:requested)+delta);}
  previous.addEventListener('click',function(){if(previous.getAttribute('aria-disabled')!=='true')next(-1);});
  forward.addEventListener('click',function(){if(forward.getAttribute('aria-disabled')!=='true')next(1);});
  track.addEventListener('scroll',function(){
   if(!frame)frame=w.requestAnimationFrame(function(){frame=0;paint();});
   w.clearTimeout(settled);settled=w.setTimeout(function(){requested=null;paint();},160);
  },{passive:true});
  track.addEventListener('pointerdown',function(){cancelReplay();requested=null;},{passive:true});
  track.addEventListener('wheel',cancelReplay,{passive:true});
  track.addEventListener('keydown',function(e){
   if(e.target!==track||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
   var rtl=w.getComputedStyle(track).direction==='rtl',index=requested===null?cardIndex:requested;
   if(e.key==='ArrowRight')index+=rtl?-1:1;
   else if(e.key==='ArrowLeft')index+=rtl?1:-1;
   else if(e.key==='Home')index=0;
   else if(e.key==='End')index=cards.length-1;
   else return;
   e.preventDefault();cancelReplay();move(index);
  });
  track.addEventListener('focusin',function(e){var leaf=e.target.closest('[data-issue-page]');if(leaf)move(cards.indexOf(leaf),true);});
  var trackWidth=track.clientWidth;
  if(w.ResizeObserver)new w.ResizeObserver(function(){var width=track.clientWidth;if(width&&trackWidth&&width!==trackWidth&&!home.hidden)move(cardIndex,true);trackWidth=width;paint();scheduleFit();}).observe(track);
  w.addEventListener('resize',scheduleFit);
  if(w.visualViewport)w.visualViewport.addEventListener('resize',scheduleFit);
  new MutationObserver(scheduleFit).observe(d.documentElement,{attributes:true,attributeFilter:['style','class','dir']});
  if(d.fonts)d.fonts.ready.then(scheduleFit);
  // The Edge hides/moves this pager only AFTER mounting successfully.
  d.querySelector('.ds-issue-controls').hidden=false;
  d.getElementById('magazineBack').addEventListener('click',back);
  d.addEventListener('click',function(e){
   if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
   var read=e.target.closest('[data-read-leaf]');if(read){e.preventDefault();read.focus({preventScroll:true});readLeaf('blad:'+read.dataset.readLeaf);return;}
   var scenario=e.target.closest('[data-magazine-scenario]');if(scenario)w.RTGExperience.choose(scenario.dataset.magazineScenario,false);
   var a=e.target.closest('a[href^="#"]');if(!a||a.hasAttribute('data-go'))return;
   var id;try{id=decodeURIComponent(a.getAttribute('href').slice(1));}catch(_){return;}
   var target=d.getElementById(id);if(!target)return;
   if(target===root||home.contains(target)||cards.includes(target)){e.preventDefault();page(id,true);}
   else if(source.contains(target)||detail.contains(target)){
    e.preventDefault();
    // Safari does not focus a link on pointer activation. Remember the actual
    // reading entrance, so returning lands there for every input method.
    a.focus({preventScroll:true});o.open(id);
   }
  });
  root.addEventListener('keydown',function(e){if(e.key==='Escape'&&current&&!d.querySelector('dialog[open]')){e.preventDefault();back();}});
  w.addEventListener('popstate',navigateHistory);
  w.addEventListener('hashchange',navigateHistory);
  w.addEventListener('scroll',scheduleSave,{passive:true});
  track.addEventListener('scroll',scheduleSave,{passive:true,capture:true});
  w.addEventListener('pagehide',checkpoint);
  d.addEventListener('visibilitychange',function(){if(d.visibilityState==='hidden')checkpoint();});
  source.hidden=true;
  w.addEventListener('rtglang',function(){refresh();scheduleFit();});refresh();scheduleFit();
  w.requestAnimationFrame(function(){
   booting=false;
   if('scrollRestoration' in w.history)w.history.scrollRestoration='manual';
   if(valid(initialState)&&initialState.hash===initialHash)replay(initialState);
   else if(valid(stored)&&(!initialHash||stored.hash===initialHash)){stored.depth=0;replay(stored);}
   else if(readingNode(locationTarget())){replaying=true;replayOpen(locationTarget());depth=0;lastFocus=readingNode(locationTarget())===footer?(d.querySelector('.ds-public-edge [data-rtg-adaptive-action="context"]')||imprint):cards[savedPage];replaying=false;write(false);}
   else write(false);
  });
  return {root:root,detail:detail,collapse:collapse,back:back,show:show,page:page,select:select,refresh:refresh,menu:menu,worlds:worlds,current:function(){return current;},selected:function(){return selected;},next:next,context:context};
 };
})(window,document);
