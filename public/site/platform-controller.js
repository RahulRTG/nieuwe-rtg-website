(function(w,d){
 'use strict';
 w.RTGPublicController=function(v){
  var P=w.RTGPublicPlatform,D=w.RTGPublicContent,copy=P.copy,photo=P.photo;
  var {o,data,company,root,detail,focus,focusTitle,home,favorites,library,title,body,picture,stories,stepper,overline,summary,language,search,filter,catalog,empty,gridButton,listButton,menuPanel,worldPanel}=v;
  var selected=data.stories[0],lastFocus=null,savedScroll=0,current=null,moved=null;
  function select(id,notify){
   var story=data.stories.find(function(s){return s.id===id;});if(!story)return;selected=story;
   if(picture.src!==photo(story.photo).src)picture.src=photo(story.photo).src;
   [title,body].forEach(function(el,i){var key=i?story.body:story.title;el.dataset.i18n='public.'+key;el.dataset.i18nSource=D.words[key][0];el.textContent=copy(key);});
   stories.querySelectorAll('[data-public-story]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.publicStory===id));});
   stepper.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.publicStep===id));});
   d.body.dataset.rtgWorld=story.world;d.body.dataset.rtgDesktop=story.world;
   if(notify&&o.select)o.select(story);
   if(company){overline.dataset.i18n='public.'+story.label;overline.dataset.i18nSource=D.words[story.label][0];overline.textContent=copy(story.label);}
   refresh();if(notify)saveHash();
  }
  function saveHash(){var h=new URLSearchParams();h.set('story',selected.id);if(current)h.set('detail',current);w.history.replaceState(null,'','#rtg?'+h.toString());}
  function filterCards(){
   var q=search.value.trim().toLocaleLowerCase();var count=0;
   catalog.querySelectorAll('[data-public-widget]').forEach(function(el){var card=data.cards.find(function(c){return c.id===el.dataset.publicWidget;}),matches=filter.value==='all'||(filter.value==='favorites'?!!el.querySelector('[data-company-pin][aria-pressed="true"]'):card.world===filter.value);el.hidden=!!(!matches||(q&&!(copy(card.title)+' '+copy(card.body)).toLocaleLowerCase().includes(q)));if(!el.hidden)count++;});empty.hidden=count>0;
  }
  function setView(list){catalog.classList.toggle('pp-list-view',list);gridButton.setAttribute('aria-pressed',String(!list));listButton.setAttribute('aria-pressed',String(list));}
  function collapse(){
   if(moved){moved.marker.replaceWith(moved.el);moved=null;}detail.replaceChildren();current=null;focus.hidden=true;home.hidden=false;favorites.hidden=false;library.hidden=false;root.classList.remove('wd-expanded');
   d.body.dataset.rtgWorld=selected.world;d.body.dataset.rtgDesktop=selected.world;
   if(w.RTGAdaptiveEdge)w.RTGAdaptiveEdge.setState('dock');saveHash();if(lastFocus&&lastFocus.isConnected){lastFocus.focus({preventScroll:true});w.scrollTo({top:savedScroll,behavior:'instant'});}o.detailChanged&&o.detailChanged(null);
  }
  function show(id,titleKey,content){
   if(!current){lastFocus=d.activeElement;savedScroll=w.scrollY;}
   if(moved){moved.marker.replaceWith(moved.el);moved=null;}
   detail.replaceChildren();
   if(content.parentNode){var marker=d.createComment('public-content:'+id);content.before(marker);moved={el:content,marker:marker};}
   detail.append(content);current=id;focusTitle.textContent=copy(titleKey);focusTitle.dataset.i18n='public.'+titleKey;focusTitle.dataset.i18nSource=(D.words[titleKey]||[titleKey])[0];
   focus.hidden=false;home.hidden=true;favorites.hidden=true;library.hidden=true;root.classList.add('wd-expanded');saveHash();
   if(w.RTGAdaptiveEdge)w.RTGAdaptiveEdge.setState('dock');focus.scrollIntoView({block:'start',behavior:'instant'});focusTitle.focus({preventScroll:true});o.detailChanged&&o.detailChanged(id);
  }
  function menu(){w.RTGAdaptiveEdge.openPanel(menuPanel,{title:copy(company?'company':'app')});}
  function worlds(){w.RTGAdaptiveEdge.openPanel(worldPanel,{title:copy('worlds')});}
  function refresh(){
   var state=o.state&&o.state();if(state){
    d.querySelectorAll('[data-public-calendar]').forEach(function(input){input.checked=state.permissions.calendar;});
    d.querySelectorAll('.pp-calendar-status').forEach(function(el){var key=state.permissions.calendar?'calendarOn':'unknown';el.dataset.i18n='public.'+key;el.dataset.i18nSource=D.words[key][0];el.textContent=copy(key);});
    summary.hidden=state.scenario!=='travel';summary.textContent='Amsterdam → Ibiza · '+(state.option==='late'?'17:50 → 20:50':'17:50');
   }
   language.textContent=(w.RTGi18n?w.RTGi18n.lang:d.documentElement.lang||'nl').toUpperCase();
  }
  return {filterCards:filterCards,setView:setView,root:root,detail:detail,select:select,show:show,collapse:collapse,refresh:refresh,menu:menu,worlds:worlds,selected:function(){return selected;},current:function(){return current;},next:function(delta){var i=data.stories.indexOf(selected);select(data.stories[(i+delta+data.stories.length)%data.stories.length].id,true);}};
 };
})(window,document);
