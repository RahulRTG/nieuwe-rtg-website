/* The sole public magazine reader: original DOM ownership and reading state.
   Layout and browser-history adapters consume this state, not copies of it. */
(function(w,d){
 'use strict';
 w.RTGPublicMagazine=function(o){
  var s={source:o.source,root:d.getElementById('platform-home'),home:d.getElementById('magazineHome'),
   focus:d.getElementById('magazineDetail'),detail:d.getElementById('magazineDetailContent'),title:d.getElementById('magazineDetailTitle'),
   current:null,moved:null,lastFocus:null,savedScroll:0,savedPage:0,savedLeaf:0,selected:{id:'overview',target:'moment',world:'travel'},
   track:d.querySelector('[data-magazine-carousel]'),previous:d.querySelector('[data-carousel-prev]'),forward:d.querySelector('[data-carousel-next]'),status:d.querySelector('[data-carousel-status]'),caption:d.querySelector('[data-issue-caption]'),
   cardIndex:0,requested:null,frame:0,depth:0,booting:true,replaying:false,applyingReplay:false,pendingBack:false,restoreToken:0,
   initialHash:w.location.hash,initialState:w.history.state&&w.history.state.rtgMagazine,stored:null,
   footer:d.querySelector('.ds-magazine-footer'),fitFrame:0,leafHeadings:new Map(),menuButton:d.querySelector('[data-magazine-menu]')};
  s.cards=Array.from(s.track.querySelectorAll('[data-issue-page]'));
  s.edition=s.cards.map(function(card){return card.id;}).join('|');
  s.storageKey='rtg-magazine-reading-v1:'+w.location.pathname;
  var a={},c={state:s,actions:a,options:o};
  function context(){
   var node=s.current&&s.moved?s.moved.el:s.cards[s.cardIndex];
   return {node:node,id:s.current||node.id,title:s.current?s.title.textContent:node.dataset.issueLabel,kind:s.current?'article':'page',index:s.current?s.savedPage:s.cardIndex,total:s.cards.length};
  }
  function readingChanged(){w.dispatchEvent(new CustomEvent('rtg-public-reading-change'));}
  function readingNode(id){return id==='blad:publicatie'||(id&&s.footer&&s.footer.contains(d.getElementById(id)))?s.footer:typeof id==='string'&&id.startsWith('blad:')?s.cards.find(function(card){return card.id===id.slice(5);}):null;}
  function restore(){if(s.moved){s.moved.el.classList.remove('ds-issue-reader');s.moved.marker.replaceWith(s.moved.el);s.moved=null;}}
  function readLeaf(id){
   var node=a.readingNode(id);if(!node)return;
   if(!s.current&&s.cards.includes(node))a.move(s.cards.indexOf(node),true);
   a.show(id,node===s.footer?'Service, informatie en colofon':node.dataset.issueLabel,node);
   node.classList.remove('ds-issue-condensed');node.classList.add('ds-issue-reader');
   if(s.leafHeadings.has(node))node.setAttribute('aria-labelledby',s.leafHeadings.get(node));
   var target=node===s.footer&&d.getElementById(id);
   if(target&&s.footer.contains(target)){
    var disclosure=target.closest('details');while(disclosure){disclosure.open=true;disclosure=disclosure.parentElement.closest('details');}
    var entrance=target.matches('details')?target.querySelector('summary'):target;if(!entrance.hasAttribute('tabindex'))entrance.tabIndex=-1;
    entrance.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'instant'});
   }
  }
  function collapse(restoreFocus){
   var wasOpen=!!s.current;
   if(wasOpen)a.checkpoint();
   a.restore();s.detail.replaceChildren();s.current=null;s.focus.hidden=true;s.home.hidden=false;d.body.dataset.rtgWorld='living';d.body.dataset.magazineView='cover';a.scheduleFit();
   if(w.RTGAdaptiveEdge)w.RTGAdaptiveEdge.setState('dock');
   if(wasOpen){a.move(s.savedPage,true);s.cards[s.savedPage].scrollTop=0;}
   w.scrollTo({top:0,behavior:'instant'});
   s.depth=0;
   if(restoreFocus!==false){
    if(s.lastFocus&&s.lastFocus.isConnected){s.lastFocus.focus({preventScroll:true});w.scrollTo({top:s.savedScroll,behavior:'instant'});}
    a.write(false,'#'+s.cards[s.cardIndex].id);
   }
   if(wasOpen)a.readingChanged();
  }
  function show(id,key,content){
   a.cancelReplay();
   if(s.current===id)return;
   a.checkpoint();
   if(!s.current){s.lastFocus=d.activeElement;s.savedScroll=0;s.savedPage=a.closest();s.savedLeaf=0;}
   if(s.booting){var owner=s.cards.findIndex(function(card){return !['editie','inhoudsopgave'].includes(card.id)&&Array.from(card.querySelectorAll('a[href]')).some(function(link){return link.getAttribute('href')==='#'+id;});});if(owner>=0){s.savedPage=owner;s.lastFocus=Array.from(s.cards[owner].querySelectorAll('a[href]')).find(function(link){return link.getAttribute('href')==='#'+id;});}}
   var nextDepth=s.depth+1;
   a.restore();s.detail.replaceChildren();
   var marker=d.createComment('public-content:'+id);content.before(marker);s.moved={el:content,marker:marker};
   s.detail.append(content);s.current=id;s.title.textContent=w.RTGPublicPlatform.copy(key);s.title.dataset.i18n='public.'+key;s.title.dataset.i18nSource=(w.RTGPublicContent.words[key]||[key])[0];s.home.hidden=true;s.focus.hidden=false;d.body.dataset.magazineView='article';
   if(w.RTGAdaptiveEdge)w.RTGAdaptiveEdge.setState('dock');s.title.focus({preventScroll:true});w.scrollTo({top:0,behavior:'instant'});
   if(!s.booting&&!s.replaying){s.depth=nextDepth;a.write(true,a.detailHash(id));}
   a.readingChanged();
  }
  function page(id,history){
   a.cancelReplay();
   if(a.readingNode(id)){a.readLeaf(id);return;}
   var target=d.getElementById(id),leaf=target&&target.closest('[data-issue-page]');
   if(!leaf)leaf=s.cards[0];var changed=!!s.current||s.cardIndex!==s.cards.indexOf(leaf);a.checkpoint();a.collapse(false);a.move(s.cards.indexOf(leaf),true);
   leaf.focus({preventScroll:true});s.root.scrollIntoView({block:'start',behavior:'instant'});
   a.write(changed||history===true,'#'+id);
  }
  function select(id,notify){s.selected={id:id,target:'moment',world:'travel'};if(notify&&o.select)o.select(s.selected);}
  function refresh(){var lang=d.querySelector('.ds-magazine-nav [data-language-picker]');if(lang)lang.textContent=(w.RTGi18n?w.RTGi18n.lang:'nl').toUpperCase()+' ⌄';a.paint();}
  function menu(){var panel=d.getElementById('explorePanel');w.RTGAdaptiveEdge.openPanel(panel,{title:'Ontdek RTG',onClose:function(){s.menuButton.setAttribute('aria-expanded','false');}});s.menuButton.setAttribute('aria-expanded',String(!panel.hidden));}
  function worlds(){w.RTGAdaptiveEdge.openPanel(d.getElementById('worldPanel'),{title:'Vier werelden'});}
  function next(delta){a.cancelReplay();a.collapse(false);a.move((s.requested===null?s.cardIndex:s.requested)+delta);}
  Object.assign(a,{context:context,readingChanged:readingChanged,readingNode:readingNode,restore:restore,readLeaf:readLeaf,collapse:collapse,show:show,page:page,select:select,refresh:refresh,menu:menu,worlds:worlds,next:next});
  var mountLayout=w.RTGPublicMagazineLayout(c),mountHistory=w.RTGPublicMagazineHistory(c);
  mountLayout();
  s.menuButton.addEventListener('click',a.menu);
  d.getElementById('experienceLanguage').addEventListener('click',function(){w.RTGAdaptiveEdge.setState('dock');},true);
  d.querySelector('[data-magazine-actions]').addEventListener('click',function(){w.RTGPublicApp.edge.actions();});
  d.getElementById('magazineBack').addEventListener('click',a.back);
  d.addEventListener('click',function(e){
   if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
   var read=e.target.closest('[data-read-leaf]');if(read){e.preventDefault();read.focus({preventScroll:true});a.readLeaf('blad:'+read.dataset.readLeaf);return;}
   var scenario=e.target.closest('[data-magazine-scenario]');if(scenario)w.RTGExperience.choose(scenario.dataset.magazineScenario,false);
   var link=e.target.closest('a[href^="#"]');if(!link||link.hasAttribute('data-go'))return;
   var id;try{id=decodeURIComponent(link.getAttribute('href').slice(1));}catch(_){return;}
   var target=d.getElementById(id);if(!target)return;
   if(target===s.root||s.home.contains(target)||s.cards.includes(target)){e.preventDefault();a.page(id,true);}
   else if(s.source.contains(target)||s.detail.contains(target)){
    e.preventDefault();
    // Safari does not focus a link on pointer activation. Remember the actual
    // reading entrance, so returning lands there for every input method.
    link.focus({preventScroll:true});o.open(id);
   }
  });
  s.root.addEventListener('keydown',function(e){if(e.key==='Escape'&&s.current&&!d.querySelector('dialog[open]')){e.preventDefault();a.back();}});
  s.source.hidden=true;
  w.addEventListener('rtglang',function(){a.refresh();a.scheduleFit();});
  a.refresh();
  a.scheduleFit();
  mountHistory();
  return {root:s.root,detail:s.detail,collapse:a.collapse,back:a.back,show:a.show,page:a.page,select:a.select,refresh:a.refresh,menu:a.menu,worlds:a.worlds,current:function(){return s.current;},selected:function(){return s.selected;},next:a.next,context:a.context};
 };
})(window,document);
