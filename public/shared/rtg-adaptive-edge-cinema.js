/* Het fotografische scherm dat uit dezelfde Edge groeit. Het kiest en toont
   context; navigatie en uitvoering blijven bij de bestaande apps. */
(function(w,d){
  'use strict';
  if(w.RTGAdaptiveEdgeCinema)return;
  var WORLDS=Object.freeze([
    {id:'living',eyebrow:'A MORE BEAUTIFUL LIFE',title:'Leven, samen.',copy:'Uw mensen, plaatsen en momenten in één rustige wereld.',image:'/images/editorial/living-home.webp',route:'/apps/rtg.html'},
    {id:'travel',eyebrow:'A WIDER PERSPECTIVE',title:'Reizen en ervaren.',copy:'Uw reis beweegt mee, van eerste idee tot thuiskomst.',image:'/images/editorial/travel-inspiration.webp',route:'/apps/reizen.html'},
    {id:'work',eyebrow:'DISCIPLINE BUILDS FREEDOM',title:'Ambitie wordt impact.',copy:'Mensen, besluiten en voortgang zonder de menselijke maat te verliezen.',image:'/images/editorial/company-technology.webp',route:'/apps/kantoor.html'},
    {id:'foundation',eyebrow:'A FAIRER BRIGHTER TOMORROW',title:'Morgen begint dichtbij.',copy:'Zorg, leren en samenleven met aandacht voor wat werkelijk telt.',image:'/images/editorial/foundation-care.webp',route:'/apps/foundation/os-publiek.html'}
  ]);
  var index=0,node=null,opened=false;
  function esc(value){return String(value||'').replace(/[&<>'"]/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c];});}
  function current(){return WORLDS[index];}
  function startIndex(){var id=d.body&&d.body.dataset.rtgWorld;var found=WORLDS.findIndex(function(x){return x.id===id;});return found<0?1:found;}
  function draw(){
    var x=current();
    node.style.setProperty('--rtg-cinema-image','url("'+x.image+'")');
    node.innerHTML='<div class="rtg-edge-cinema__head"><span>'+esc(x.id.toUpperCase()+'OS')+'</span><span><i></i> OVERZICHT</span><button type="button" data-cinema="close" aria-label="Sluiten">×</button></div>'+
      '<div class="rtg-edge-cinema__story"><button type="button" data-cinema="prev" aria-label="Vorige wereld">‹</button><div><small>'+esc(x.eyebrow)+'</small><h2>'+esc(x.title)+'</h2><p>'+esc(x.copy)+'</p></div><button type="button" data-cinema="next" aria-label="Volgende wereld">›</button></div>'+
      '<div class="rtg-edge-cinema__foot"><button type="button" data-cinema="explain">Leg dit scherm uit</button><a href="'+x.route+'">Bekijk '+esc(x.id)+'OS</a></div>';
  }
  function close(){opened=false;if(w.RTGAdaptiveEdge)w.RTGAdaptiveEdge.setState('dock');}
  function open(){
    if(!w.RTGAdaptiveEdge)return false;
    if(!node){node=d.createElement('section');node.className='rtg-edge-cinema';node.hidden=true;d.body.appendChild(node);node.addEventListener('click',act);}
    index=startIndex();draw();w.RTGAdaptiveEdge.setDeck('home');opened=!!w.RTGAdaptiveEdge.openPanel(node,{title:'RTG Edge',copy:'',onClose:function(){opened=false;}});return opened;
  }
  function assistant(copy){close();w.RTGAdaptiveEdge.continueWith({title:'Rahul',copy:copy});w.RTGAdaptiveEdge.openView('rahul');}
  function control(){var b=d.createElement('button');b.type='button';b.className='rtg-adaptive-sheet-action rtg-adaptive-cinema-action';b.textContent='Open filmisch RTG-overzicht';b.addEventListener('click',open);return b;}
  function render(container,model){if(model.deck==='rahul')container.append(control());}
  function act(event){
    var b=event.target.closest('[data-cinema]');if(!b)return;var a=b.dataset.cinema;
    if(a==='close'){close();return;}
    if(a==='prev'||a==='next'){index=(index+(a==='next'?1:-1)+WORLDS.length)%WORLDS.length;draw();if(node.animate&&!w.matchMedia('(prefers-reduced-motion: reduce)').matches)node.animate([{opacity:.72},{opacity:1}],{duration:220});return;}
    if(a==='explain'){assistant('Leg dit scherm kort uit en toon alleen de relevante volgende stappen.');return;}
    if(a==='people')w.location.href='/apps/comm.html';
    else if(a==='journey')w.location.href='/apps/reizen.html';
  }
  w.RTGAdaptiveEdgeCinema=Object.freeze({open:open,close:close,render:render,worlds:WORLDS});
}(window,document));
