/* One public host for the existing, canonical Edge. */
(function(w,d){
 'use strict';
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
   w.RTGPublicEdgeDoor.mount(runtime,root);
   if(magazineControls)magazineControls.hidden=true;
   var menu=d.querySelector('#explorePanel .ds-discover-service')||d.getElementById('explorePanel');
   [['Inhoud van deze editie',function(){o.shell.page('inhoudsopgave');}],['Zoek in RTG',function(){w.RTGCommand.open();}],['Service, informatie en colofon',function(){o.shell.page('blad:publicatie');}]].forEach(function(row){
    var button=d.createElement('button');button.type='button';button.textContent=row[0];button.addEventListener('click',function(){E.setState('dock');row[1]();});menu.append(button);
   });
  }
  var sheet=runtime.sheet,observer=null,quietDepth=0,pager=null;
  var observation={childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-pressed','data-rtg-custom-panel','hidden','open']};
  function quietly(action){
   if(!quietDepth++&&observer)observer.disconnect();
   try{return action();}finally{if(!--quietDepth&&observer)observer.observe(root,observation);}
  }
  if(d.getElementById('magazineHome'))pager=w.RTGPublicEdgePager(runtime,{panel:panel,actions:actions,quietly:quietly,isEditorial:function(){return !!editorial;}});
  /* Changing a tab starts at its heading, including after scrolling a long
     account/menu sheet. No history or service action is changed here. */
  sheet.querySelector('.rtg-adaptive-modes').addEventListener('click',function(event){if(event.target.closest('[data-rtg-adaptive-mode]'))sheet.scrollTop=0;});
  function labels(){quietly(function(){
   if(d.getElementById('magazineHome'))w.RTGPublicEdgeDoor.dress(root);
   var heading=root.querySelector('.rtg-adaptive-sheet-head small:not(.ds-edge-reading-caption)'),headingKey=o.kind==='company'?'company':'app';if(heading){var headingText=P.copy(headingKey);heading.dataset.i18n='public.'+headingKey;heading.dataset.i18nSource=w.RTGPublicContent.words[headingKey][0];if(heading.textContent!==headingText)heading.textContent=headingText;}
   var keys={home:'home',worlds:'worlds',menu:'menu',context:'actions',primary:'actions',connect:'actions',ai:'rahulAppCardTitle',back:'back',status:'regie',presence:'people'};
   root.querySelectorAll('.rtg-adaptive-item').forEach(function(el){var key=keys[el.dataset.rtgAdaptiveAction];if(!key)return;var value=P.copy(key),label=el.querySelector('small');if(label){label.dataset.i18n='public.'+key;label.dataset.i18nSource=w.RTGPublicContent.words[key][0];label.translate=false;if(label.textContent!==value)label.textContent=value;}el.dataset.i18nAria='public.'+key;if(el.getAttribute('aria-label')!==value)el.setAttribute('aria-label',value);});
   var caption=root.querySelector('.rtg-adaptive-caption'),value=P.copy(o.kind==='company'?'company':'app');if(caption&&caption.textContent!==value)caption.textContent=value;
   if(editorial)editorial.refresh();if(pager)pager.refresh();
  });}
  if(d.getElementById('magazineHome')&&w.RTGPublicEdgeEditorial)editorial=w.RTGPublicEdgeEditorial.mount(runtime,{read:o.shell.context,changed:labels});
  observer=new MutationObserver(labels);observer.observe(root,observation);w.addEventListener('rtglang',labels);labels();
  return {actions:actions,refresh:labels};
 };
})(window,document);
