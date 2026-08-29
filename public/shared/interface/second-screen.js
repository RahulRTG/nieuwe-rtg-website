/* RTG Second Screen: een toestandslaag boven Command, geen tweede navigatie.
   De inhoud komt uit second-screen-modules.js; dit bestand beheert alleen
   Peek -> Panel -> Workspace -> Focus, ordening en toetsenbordgedrag. */
(function(w,d){
  'use strict';
  var KEY='rtg.interface.second-screen.v1';
  function el(tag,cls,text){var n=d.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
  function knop(text,actie,cls){var n=el('button',cls||'',text);n.type='button';n.dataset.ssAction=actie;if(text)n.setAttribute('aria-label',text);return n}
  function glyf(b,naam){var g=w.RTGGlyf&&w.RTGGlyf.svg(naam);if(g){g.classList.add('rtg-ss-mode-glyf');b.insertBefore(g,b.firstChild)}return b}
  function lees(ids){var x={order:ids.slice(),hidden:[]};try{var j=JSON.parse(w.localStorage.getItem(KEY)||'{}');if(Array.isArray(j.order))x.order=j.order.filter(function(id){return ids.indexOf(id)>=0});ids.forEach(function(id){if(x.order.indexOf(id)<0)x.order.push(id)});if(Array.isArray(j.hidden))x.hidden=j.hidden.filter(function(id){return ids.indexOf(id)>=0})}catch(e){}return x}
  function schrijf(x){try{w.localStorage.setItem(KEY,JSON.stringify(x))}catch(e){}}
  function focusbaar(root){return [].slice.call(root.querySelectorAll('button:not([hidden]):not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(function(n){return n.offsetParent!==null})}

  w.RTGInterfaceSecondScreen=function(o){
    var root=o.root,bank=root&&root.querySelector('.cmd-bank'),nav=bank&&bank.querySelector('.cmd-nav');
    if(!bank||!nav||!w.RTGInterfaceSecondScreenModules)return null;
    var state='peek',vorige='panel',editing=false,returnFocus=null,focusTerug=null,layout,mq=w.matchMedia('(min-width:1000px)'),uitvoerKijk=null;
    var eerste=mq.matches?'workspace':'peek';
    var modules=w.RTGInterfaceSecondScreenModules({nav:nav,open:function(url,title){
      if(w.matchMedia('(max-width:999px)').matches)zet('peek');o.open(url,title);
    }});
    layout=lees(modules.ids);
    var shell=el('div','rtg-ss-shell'),head=el('header','rtg-ss-header');
    var brand=el('div','rtg-ss-brand');brand.appendChild(el('span','rtg-ss-mark','RTG'));brand.appendChild(el('h2','','Second Screen'));head.appendChild(brand);
    var modes=el('div','rtg-ss-header-actions');
    modes.appendChild(glyf(knop('Panel','panel'),'paneel'));modes.appendChild(glyf(knop('Workspace','workspace'),'werk'));modes.appendChild(glyf(knop('Focus','focus'),'rtg'));modes.appendChild(knop('Sluiten','close','rtg-ss-close'));head.appendChild(modes);shell.appendChild(head);
    var scroll=el('div','rtg-ss-scroll'),lijst=el('div','rtg-ss-modules'),editor=el('section','rtg-ss-editor');editor.hidden=true;
    editor.appendChild(el('h3','','Modules ordenen'));var editorLijst=el('div','rtg-ss-editor-list');editor.appendChild(editorLijst);editor.appendChild(knop('Gereed','edit-done','rtg-ss-editor-done'));
    scroll.appendChild(lijst);scroll.appendChild(editor);shell.appendChild(scroll);
    var acties=el('div','rtg-ss-actions');acties.appendChild(knop('Module toevoegen','edit'));acties.appendChild(knop('Zelf invullen','ask'));shell.appendChild(acties);
    bank.insertBefore(shell,bank.querySelector('.cmd-bankvoet'));
    bank.id=bank.id||'rtgSecondScreen';var greep=root.querySelector('.cmd-lade');if(greep)greep.setAttribute('aria-controls',bank.id);
    /* De beginstand staat in dezelfde DOM-mutatie als de runtimeklasse. Anders
       ziet de browser heel even een zichtbaar paneel en animeert hij dat bij
       de eerste mobiele paint naar buiten: functioneel dicht, visueel een
       flits. Peek en Workspace worden zo meteen in hun echte eindstand gezet. */
    state=eerste;root.classList.add('rtg-interface-second-screen','rtg-ss-'+eerste);root.dataset.rtgSecondScreen=eerste;
    if(w.RTGUitvoer&&w.RTGUitvoer.mount)w.RTGUitvoer.mount(head,bank);
    function merkUitvoer(){var b=head.querySelector('.rtguitvoer-knop');if(!b||b.dataset.ssOutput)return;b.dataset.ssOutput='1';b.setAttribute('aria-label','Gegevens meenemen');glyf(b,'logboek')}
    merkUitvoer();if(w.MutationObserver){uitvoerKijk=new MutationObserver(merkUitvoer);uitvoerKijk.observe(root,{childList:true,subtree:true})}

    function teken(){
      lijst.textContent='';editorLijst.textContent='';
      layout.order.forEach(function(id){var m=modules.byId[id];if(!m)return;m.hidden=layout.hidden.indexOf(id)>=0;lijst.appendChild(m);
        var b=knop((m.querySelector('h3')||m).textContent+(m.hidden?' tonen':' verbergen'),m.hidden?'show':'hide');b.dataset.ssModuleId=id;editorLijst.appendChild(b)});
      bank.toggleAttribute('data-ss-editing',editing);editor.hidden=!editing;
    }
    function aria(s){var werk=root.querySelector('.cmd-werk'),focus=s==='focus';bank.setAttribute('aria-hidden',s==='peek'?'true':'false');bank.setAttribute('aria-label','RTG Second Screen');
      if(focus){bank.setAttribute('role','dialog');bank.setAttribute('aria-modal','true')}else{bank.removeAttribute('role');bank.removeAttribute('aria-modal')}
      if(werk){werk.toggleAttribute('inert',focus);if(focus)werk.setAttribute('aria-hidden','true');else werk.removeAttribute('aria-hidden')}}
    function zet(next){
      if(['peek','panel','workspace','focus'].indexOf(next)<0)return;
      if(next==='peek'&&mq.matches)next='workspace';
      var oud=state,vanPeek=oud==='peek'&&next!=='peek'&&d.activeElement&&d.activeElement!==d.body;
      if(next!=='peek'&&next!=='focus')vorige=next;if(vanPeek)returnFocus=d.activeElement;if(next==='focus'&&oud!=='focus')focusTerug=d.activeElement;
      root.classList.remove('rtg-ss-'+oud);state=next;root.classList.add('rtg-ss-'+state);root.dataset.rtgSecondScreen=state;
      root.classList.toggle('bank-open',state!=='peek');var grip=root.querySelector('.cmd-lade');if(grip)grip.setAttribute('aria-expanded',state==='peek'?'false':'true');aria(state);
      ['panel','workspace','focus'].forEach(function(s){var b=bank.querySelector('[data-ss-action="'+s+'"]');if(b)b.setAttribute('aria-pressed',state===s?'true':'false')});
      if(state==='focus'||vanPeek){var f=focusbaar(bank);if(f.length)f[0].focus()}
      if(oud==='focus'&&state!=='focus'&&focusTerug&&d.contains(focusTerug)){focusTerug.focus();focusTerug=null}
      if(state==='peek'&&returnFocus&&d.contains(returnFocus)){returnFocus.focus();returnFocus=null}
    }
    function verplaats(id,richting){var i=layout.order.indexOf(id),j=i+richting;if(i<0||j<0||j>=layout.order.length)return;var t=layout.order[j];layout.order[j]=id;layout.order[i]=t;schrijf(layout);teken()}
    function verberg(id,aan){var i=layout.hidden.indexOf(id);if(aan&&i<0)layout.hidden.push(id);if(!aan&&i>=0)layout.hidden.splice(i,1);schrijf(layout);teken()}
    function klik(e){var t=e.target.closest('[data-ss-action],[data-ss-url],[data-ss-context-id]');if(!t||!bank.contains(t))return;if(modules.handel(t)){e.preventDefault();return}var a=t.dataset.ssAction,id=t.dataset.ssModuleId||t.closest('[data-ss-module]')&&t.closest('[data-ss-module]').dataset.ssModule;
      if(a==='close')zet('peek');else if(a==='panel'||a==='workspace'||a==='focus')zet(a);else if(a==='edit'){editing=!editing;teken()}else if(a==='edit-done'){editing=false;teken()}else if(a==='ask'){if(o.vraag)o.vraag()}else if(a==='up')verplaats(id,-1);else if(a==='down')verplaats(id,1);else if(a==='hide')verberg(id,true);else if(a==='show')verberg(id,false)}
    function toets(e){if(e.defaultPrevented||(w.RTGUitvoer&&w.RTGUitvoer.zichtbaar&&w.RTGUitvoer.zichtbaar()))return;if(e.key==='Escape'&&state!=='peek'){e.preventDefault();zet(state==='focus'?vorige:'peek');return}if(e.key!=='Tab'||state!=='focus')return;var f=focusbaar(bank);if(!f.length)return;var eerste=f[0],laatste=f[f.length-1];if(e.shiftKey&&d.activeElement===eerste){e.preventDefault();laatste.focus()}else if(!e.shiftKey&&d.activeElement===laatste){e.preventDefault();eerste.focus()}}
    function vorm(e){if(e.matches&&state==='peek')zet('workspace');else if(!e.matches&&state==='workspace')zet('peek')}
    bank.addEventListener('click',klik);d.addEventListener('keydown',toets);if(mq.addEventListener)mq.addEventListener('change',vorm);else mq.addListener(vorm);teken();zet(eerste);
    var api={get state(){return state},setState:zet,refresh:modules.refresh,destroy:function(){d.removeEventListener('keydown',toets);bank.removeEventListener('click',klik);if(mq.removeEventListener)mq.removeEventListener('change',vorm);else mq.removeListener(vorm);if(uitvoerKijk)uitvoerKijk.disconnect();modules.destroy();aria('peek');
      var uit=head.querySelector('.rtguitvoer-knop');if(uit){delete uit.dataset.ssOutput;uit.removeAttribute('aria-label');var gg=uit.querySelector('.rtg-ss-mode-glyf');if(gg)gg.remove()}
      if(w.RTGUitvoer&&w.RTGUitvoer.unmount)w.RTGUitvoer.unmount();if(nav&&nav.parentNode!==bank)bank.insertBefore(nav,bank.querySelector('.cmd-bankvoet'));shell.remove();root.classList.remove('rtg-interface-second-screen','rtg-ss-'+state);delete root.dataset.rtgSecondScreen;delete root.__rtgSecondScreen;}};
    root.__rtgSecondScreen=api;return api;
  };
})(window,document);
