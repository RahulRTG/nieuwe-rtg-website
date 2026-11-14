/* Tab-local bookmarks, deep links and exact Back/Forward restoration. Shares the reader's original state; never clones content. */
(function(w,d){
 'use strict';
 w.RTGPublicMagazineHistory=function(c){
  var s=c.state,a=c.actions,o=c.options;
  function cardFor(id){return s.cards.findIndex(function(card){return card.id===id;});}
  function position(value){return typeof value==='number'&&isFinite(value)?Math.max(0,value):0;}
  function valid(value){
   if(!value||value.v!==1||value.edition!==s.edition||a.cardFor(value.page)<0)return false;
   var reading=a.readingNode(value.id),node=reading||d.getElementById(value.id);
   if(reading)return value.kind==='detail';
   return value.kind==='page'?a.cardFor(value.id)>=0:value.kind==='detail'&&!!node&&(s.source.contains(node)||s.detail.contains(node))&&node.hasAttribute('data-scene');
  }
  function snapshot(){
   var entry=s.current?s.lastFocus:d.activeElement,leaf=s.cards[s.current?s.savedPage:s.cardIndex],links=Array.from(leaf.querySelectorAll('a[href]'));
   var readingEntry=entry&&(entry===s.imprint||leaf.contains(entry))&&entry.hasAttribute('data-read-leaf')?entry.dataset.readLeaf:null;
   return {v:1,edition:s.edition,kind:s.current?'detail':'page',id:s.current||s.cards[s.cardIndex].id,page:s.cards[s.current?s.savedPage:s.cardIndex].id,
    scroll:s.current?a.position(w.scrollY):0,leaf:0,returnScroll:0,returnLeaf:0,
    entry:readingEntry?'blad:'+readingEntry:links.includes(entry)?entry.getAttribute('href'):null,entryIndex:links.indexOf(entry),depth:s.depth,hash:w.location.hash};
  }
  function write(push,url){
   if(s.booting||s.replaying)return;
   var value=a.snapshot(),state=Object.assign({},w.history.state||{});if(url!==undefined)value.hash=url;state.rtgMagazine=value;
   try{w.history[push?'pushState':'replaceState'](state,'',url===undefined?w.location.href:url);}catch(_){}
   // Tab-local reading coordinates only: no answers, form input or account data.
   try{w.sessionStorage.setItem(s.storageKey,JSON.stringify(value));}catch(_){}
  }
  function checkpoint(){w.clearTimeout(s.saveTimer);a.write(false);}
  function scheduleSave(){if(s.booting||s.replaying)return;w.clearTimeout(s.saveTimer);s.saveTimer=w.setTimeout(a.checkpoint,160);}
  function cancelReplay(){if(s.applyingReplay)return;++s.restoreToken;s.replaying=false;}
  function replayOpen(id){s.applyingReplay=true;try{if(a.readingNode(id))a.readLeaf(id);else o.open(id);}finally{s.applyingReplay=false;}}
  function detailHash(id){var params=new URLSearchParams();params.set('story',s.selected.id);params.set('detail',id);return '#rtg?'+params.toString();}
  function entryFor(value){
   var leaf=s.cards[a.cardFor(value.page)],links=Array.from(leaf.querySelectorAll('a[href]')),entry=links[value.entryIndex];
   if(value.entry==='blad:publicatie')return d.querySelector('.ds-public-edge [data-rtg-adaptive-action="context"]')||s.imprint;
   if(typeof value.entry==='string'&&value.entry.startsWith('blad:'))return Array.from(leaf.querySelectorAll('[data-read-leaf]')).find(function(button){return button.dataset.readLeaf===value.entry.slice(5);});
   return entry&&entry.getAttribute('href')===value.entry?entry:links.find(function(link){return link.getAttribute('href')===value.entry;});
  }
  function replay(value){
   var token=++s.restoreToken;s.replaying=true;s.pendingBack=false;w.clearTimeout(s.saveTimer);w.clearTimeout(s.settled);s.requested=null;
   a.replayOpen(value.id);
   s.savedPage=a.cardFor(value.page);s.savedScroll=0;s.savedLeaf=0;s.lastFocus=a.entryFor(value)||s.cards[s.savedPage];
   s.depth=value.kind==='detail'?Math.min(1000,Math.floor(a.position(value.depth))):0;
   function place(){
    if(token!==s.restoreToken)return;
    if(value.kind==='page'){a.move(a.cardFor(value.id),true);s.cards[s.cardIndex].scrollTop=0;(a.entryFor(value)||s.cards[s.cardIndex]).focus({preventScroll:true});}
    else s.title.focus({preventScroll:true});
    w.scrollTo({top:value.kind==='page'?0:a.position(value.scroll),behavior:'instant'});
   }
   place();w.requestAnimationFrame(function(){w.requestAnimationFrame(function(){if(token!==s.restoreToken)return;place();s.replaying=false;a.write(false);});});
  }
  function locationTarget(){
   var value=w.location.hash,id;
   try{id=value.startsWith('#rtg?')?new URLSearchParams(value.slice(5)).get('detail'):decodeURIComponent(value.slice(1));}catch(_){return null;}
   if(!id)return 'editie';if(a.readingNode(id))return id;var target=d.getElementById(id);
   return target&&(target===s.root||s.home.contains(target)||s.source.contains(target)||s.detail.contains(target))?id:null;
  }
  function navigateHistory(event){
   var id=a.locationTarget();if(!id)return;
   event.stopImmediatePropagation();s.pendingBack=false;
   // Our popstate restoration owns this route. The subsequent hashchange must
   // not let platform-app open it a second time and reset its reading position.
   if(event.type==='hashchange'&&s.replaying)return;
   var value=w.history.state&&w.history.state.rtgMagazine;
   if(a.valid(value)&&value.hash===w.location.hash){a.replay(value);return;}
   ++s.restoreToken;s.replaying=true;a.replayOpen(id);s.depth=0;s.replaying=false;a.write(false);
  }
  function back(){
   if(!s.current||s.pendingBack)return;a.checkpoint();
   var state=w.history.state&&w.history.state.rtgMagazine;
   if(a.valid(state)&&s.depth>0){s.pendingBack=true;w.history.go(-s.depth);return;}
   a.collapse();
  }
  Object.assign(a,{cardFor:cardFor,position:position,valid:valid,snapshot:snapshot,write:write,checkpoint:checkpoint,scheduleSave:scheduleSave,cancelReplay:cancelReplay,replayOpen:replayOpen,detailHash:detailHash,entryFor:entryFor,replay:replay,locationTarget:locationTarget,navigateHistory:navigateHistory,back:back});
  return function mount(){
   try{s.stored=JSON.parse(w.sessionStorage.getItem(s.storageKey));}catch(_){}
   w.addEventListener('popstate',a.navigateHistory);
   w.addEventListener('hashchange',a.navigateHistory);
   w.addEventListener('scroll',a.scheduleSave,{passive:true});
   s.track.addEventListener('scroll',a.scheduleSave,{passive:true,capture:true});
   w.addEventListener('pagehide',a.checkpoint);
   d.addEventListener('visibilitychange',function(){if(d.visibilityState==='hidden')a.checkpoint();});
   w.requestAnimationFrame(function(){
   s.booting=false;
   if('scrollRestoration' in w.history)w.history.scrollRestoration='manual';
   if(a.valid(s.initialState)&&s.initialState.hash===s.initialHash)a.replay(s.initialState);
   else if(a.valid(s.stored)&&(!s.initialHash||s.stored.hash===s.initialHash)){s.stored.depth=0;a.replay(s.stored);}
   else if(a.readingNode(a.locationTarget())){s.replaying=true;a.replayOpen(a.locationTarget());s.depth=0;s.lastFocus=a.readingNode(a.locationTarget())===s.footer?(d.querySelector('.ds-public-edge [data-rtg-adaptive-action="context"]')||s.imprint):s.cards[s.savedPage];s.replaying=false;a.write(false);}
   else a.write(false);
  });
  };
 };
})(window,document);
