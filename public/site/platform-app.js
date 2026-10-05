/* Existing demonstrations projected into the same layout as the world homes. */
(function(w,d){
 'use strict';
 var P=w.RTGPublicPlatform,X=w.RTGExperience;if(!P||!X)return;
 var hash=new URLSearchParams(w.location.hash.replace(/^#rtg\?/,'')),shell;
 var source=d.getElementById('inhoud');
 var titles={verhaal:'originCardTitle',versnippering:'fragmentationTitle',moment:'proposalOpen',rahul:'rahulAppCardTitle','uw-rtg':'why',werelden:'worlds',regie:'regie',service:'support',foundation:'foundationAppCardTitle',passen:'accessCardTitle',vragen:'faq',begin:'createCardTitle'};
 source.querySelectorAll('[data-scene]').forEach(function(el){
  if(titles[el.id])return;
  var key='section'+el.id, title=el.dataset.scene;
  w.RTGPublicContent.words[key]=[title,title];w.I18N.en['public.'+key]=title;titles[el.id]=key;
 });
 function open(id){
  if(id==='top'||id==='platform-home'){shell.collapse();return;}
  if(id==='language'){w.RTGi18n.openModal();return;}
  if(id.indexOf('world:')===0){X.world(id.slice(6),false);id='werelden';}
  var content=d.getElementById(id);if(!content||!titles[id])return;
  if(id==='vragen')X.allQuestions(false);
  shell.show(id,titles[id],content);
  if(id==='werelden'){d.body.dataset.rtgWorld=X.currentWorld();d.body.dataset.rtgDesktop=X.currentWorld();}
 }
 X.choose('dinner',false);
 shell=P.init({kind:'app',source:d.getElementById('inhoud'),open:open,state:X.snapshot,
  select:function(story){X.choose(story.id==='travelWorld'?'travel':story.id,false);},
  calendar:function(value){X.permission('calendar',value);}});
 w.RTGPublicApp={shell:shell,open:open};
 var sections=P.node('nav',null,'pp-section-index');sections.setAttribute('aria-label','Alle onderdelen');
 source.querySelectorAll('[data-scene]').forEach(function(el){var b=P.button(titles[el.id],function(){open(el.id);},'pp-button');sections.append(b);});
 d.querySelector('.wd-library').append(P.node('h3','moreRtg','pp-section-title'),sections);
 var footer=d.querySelector('.pp-footer'),nav=P.node('nav',null,'pp-footer-links');
 [['support','mailto:roellie.i@gmail.com'],['privacy','https://app.rahultravelgroup.com/apps/juridisch/privacy.html'],['terms','https://app.rahultravelgroup.com/apps/juridisch/voorwaarden.html']].forEach(function(row){var a=P.node('a',row[0],'pp-button');a.href=row[1];nav.append(a);});footer.append(nav);
 X.permission('calendar',false);
 d.addEventListener('rtg-public-state',shell.refresh);
 w.RTGPublicEdge({kind:'app',shell:shell,open:open,proposal:X.proposal,reset:function(){X.reset();shell.select('travel',false);shell.collapse();}});
 if(hash.get('story'))shell.select(hash.get('story'),true);
 if(hash.get('detail'))open(hash.get('detail'));
 else if(w.location.hash&&!w.location.hash.startsWith('#rtg?'))open(w.location.hash.slice(1));
 w.addEventListener('hashchange',function(){var h=new URLSearchParams(w.location.hash.replace(/^#rtg\?/,''));if(h.get('story'))shell.select(h.get('story'),false);if(h.get('detail'))open(h.get('detail'));else shell.collapse();});
 w.RTGi18n.apply(w.RTGi18n.lang);
})(window,document);
