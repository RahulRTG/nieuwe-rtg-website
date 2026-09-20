/* One public host for the existing, canonical Edge. */
(function(w,d){
 'use strict';
 w.RTGPublicEdge=function(o){
  var P=w.RTGPublicPlatform,E=w.RTGAdaptiveEdge,root=d.createElement('div'),panel=d.createElement('div');
  root.className='rtg-edge-chrome rtg-experience-edge pp-edge';panel.hidden=true;panel.className='pp-menu-panel';d.body.append(root,panel);
  function actions(){
   panel.replaceChildren();
   var rows=[['next',function(){o.shell.collapse();o.shell.next(1);}],['previous',function(){o.shell.collapse();o.shell.next(-1);}]];
   if(o.kind==='app')rows.push(['proposalOpen',o.proposal],['why',function(){o.open('uw-rtg');}],['reset',o.reset]);
   else rows.push(['architectureOpen',function(){o.open('architecture');}],['contact',function(){o.open('support');}]);
   rows.forEach(function(r){panel.append(P.button(r[0],function(){E.setState('dock');r[1]();},'pp-menu-item'));});
   E.openPanel(panel,{title:P.copy('actions')});
  }
  var host={root:root,cfg:{home:'#platform-home',kaart:'RTG'},ctx:{title:P.copy(o.kind==='company'?'company':'app')},onEdgeAction:function(action){
   if(action==='home'){o.shell.collapse();w.scrollTo({top:0,behavior:'instant'});}
   else if(action==='back')o.shell.collapse();
   else if(action==='worlds')o.shell.worlds();
   else if(action==='menu')o.shell.menu();
   else if(action==='ai')o.open(o.kind==='company'?'rahul':'rahul');
   else if(action==='status'||action==='presence')o.open(o.kind==='company'?'control':'regie');
   else if(['context','primary','connect'].includes(action))actions();
   else return false;
   return true;
  }};
  E.start(d,w,host);
  function labels(){
   var keys={home:'home',worlds:'worlds',menu:'menu',context:'actions',primary:'actions',connect:'actions',ai:'rahulAppCardTitle',back:'back',status:'regie',presence:'people'};
   root.querySelectorAll('.rtg-adaptive-item').forEach(function(el){var key=keys[el.dataset.rtgAdaptiveAction];if(!key)return;var value=P.copy(key),label=el.querySelector('small');if(label){label.dataset.i18n='public.'+key;label.dataset.i18nSource=w.RTGPublicContent.words[key][0];label.translate=false;if(label.textContent!==value)label.textContent=value;}el.dataset.i18nAria='public.'+key;if(el.getAttribute('aria-label')!==value)el.setAttribute('aria-label',value);});
   var caption=root.querySelector('.rtg-adaptive-caption'),value=P.copy(o.kind==='company'?'company':'app');if(caption&&caption.textContent!==value)caption.textContent=value;
  }
  new MutationObserver(labels).observe(root,{childList:true,subtree:true});w.addEventListener('rtglang',labels);labels();
  return {actions:actions,refresh:labels};
 };
})(window,document);
