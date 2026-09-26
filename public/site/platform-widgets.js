(function(w,d){
 'use strict';
 w.RTGPublicWidgets=function(v){
  var P=w.RTGPublicPlatform,node=P.node,button=P.button,icon=P.icon,photo=P.photo,lips=P.lips;
  var {o,data,company,favorites}=v;
  function refresh(){v.refresh();}
  function widget(card){
   var article=node('article',null,'wd-widget pp-widget');article.dataset.publicWidget=card.id;article.dataset.world=card.world;
   var head=button(null,function(){o.open(card.target);},'pp-widget-head');head.append(icon(card.icon),node('span',card.title),icon('next'));
   var inside=node('div',null,'pp-widget-body');
   if(card.type==='photo')inside.append(photo(card.photo,'pp-widget-photo'));
   if(card.type==='worlds'){var row=node('div',null,'pp-world-mini');['living','travel','work','foundation'].forEach(function(world){var b=button(null,function(){o.open(company?'worlds':'world:'+world);},'pp-mini-world');b.dataset.world=world;b.append(icon({living:'home',travel:'plane',work:'brief',foundation:'heart'}[world]));var label=node('span');label.textContent={living:'LivingOS',travel:'TravelOS',work:'WorkOS',foundation:'FoundationOS'}[world];b.append(label);row.append(b);});inside.append(row);}
   if(card.type==='chain'){var chain=node('div',null,'pp-chain');['wish','proposal','decision'].forEach(function(k,i){var el=node('span');el.append(icon(['people','list','shield'][i]),node('span',k));chain.append(el);});inside.append(chain);}
   if(card.type==='rahul'){inside.append(lips(),node('p',company?'controlBody':'whyBody','pp-widget-note'));}
   if(card.type==='language'){var row=node('div',null,'pp-language-options');['nl','en'].forEach(function(lang){var b=button(null,function(){w.RTGi18n.set(lang);},'pp-language-choice');b.textContent=lang.toUpperCase();b.dataset.publicLanguage=lang;row.append(b);});inside.append(row);}
   if(card.type==='permissions')inside.append(calendarControl());
   if(card.type==='questions'){['faq','support'].forEach(function(k){var b=button(k,function(){o.open(company?'questions':k==='faq'?'vragen':'service');},'pp-question-link');b.append(icon('next'));inside.append(b);});}
   if(card.type==='create')inside.append(icon('people'),node('p','optional','pp-widget-note'));
   inside.append(node('p',card.body),button(card.action,function(){o.open(card.target);},'pp-button'));
   article.append(head,inside);return article;
  }
  function calendarControl(){
   var label=node('label',null,'pp-toggle'),toggle=node('input');toggle.type='checkbox';toggle.dataset.publicCalendar='';toggle.setAttribute('role','switch');
   toggle.addEventListener('change',function(){if(o.calendar)o.calendar(toggle.checked);refresh();});label.append(toggle,node('span','calendarUse'));return label;
  }
  function favoritesPaint(){
   if(company){
    favorites.append(widget({id:'architectureSide',title:'architecture',target:'architecture',icon:'branch',type:'chain',body:'technologyBody',action:'architectureOpen'}),widget(data.cards.find(function(c){return c.id==='foundation';})));
   }else{
    var agenda=node('section',null,'wd-widget pp-side-widget');agenda.append(node('h2','calendar'),calendarControl(),node('p','unknown','pp-calendar-status'),button('clarify',function(){o.open('regie');}));
    var regie=node('section',null,'wd-widget pp-side-widget');regie.append(node('h2','regie'));
    ['plan','effects','decide'].forEach(function(k,i){var p=node('p',null,'pp-plan-row');p.append(icon(['plane','doc','shield'][i]),node('span',k));regie.append(p);});
    regie.append(node('p','nothing'),button('inspect',function(){o.open('uw-rtg');}));favorites.append(agenda,regie);
   }
  }
  return {widget:widget,calendarControl:calendarControl,favoritesPaint:favoritesPaint};
 };
})(window,document);
