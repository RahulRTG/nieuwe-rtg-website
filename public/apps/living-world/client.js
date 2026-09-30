(function(w,d){
'use strict';
var token;try{token=localStorage.getItem('rtg_member_token');}catch(e){token=null;}
var view=null,tab='world',selection=null,schema=null,action=null,preview=null,idem=null,busy=false,contextId=null;
var el=w.LivingWorldRender.el,dialog=d.getElementById('lwDialog'),form=d.getElementById('lwForm');
var status=d.getElementById('lwStatus'),error=d.getElementById('lwFormError'),submit=d.getElementById('lwSubmit');
async function api(path,body){
  var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},20000);
  try{
    var r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
      body:JSON.stringify(body||{}),signal:controller.signal});
    var out=await r.json();if(!r.ok||out.error)throw new Error(out.error||'Het verzoek is niet gelukt.');
    return out;
  }catch(e){if(e.name==='AbortError')throw new Error('Geen bevestiging ontvangen. Probeer dezelfde handeling opnieuw of vernieuw uw overzicht.');throw e;}
  finally{clearTimeout(timer);}
}
function readLocation(){
  var q=new URLSearchParams(location.search);tab=q.get('tab')||'world';selection=null;
  ['place','blueprint','plan','contribution'].some(function(t){if(q.get(t)){selection={type:t,id:q.get(t)};return true;}return false;});
}
function open(type,id){
  selection={type:type,id:id};history.pushState(null,'','?'+type+'='+encodeURIComponent(id));render();
  d.getElementById('lwContent').scrollIntoView({block:'start'});
}
function setTab(value){
  tab=value;selection=null;history.pushState(null,'','?tab='+encodeURIComponent(tab));render();
}
function render(){
  if(!view)return;
  d.querySelector('.lw-hero').hidden=!!selection||tab!=='world';
  d.querySelectorAll('[data-lw-tab]').forEach(function(b){if(b.dataset.lwTab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  w.LivingWorldRender.render(d.getElementById('lwContent'),view,selection,tab,startAction,open);
  syncEdge();
  d.dispatchEvent(new CustomEvent('rtg:living-world-render'));
}
async function load(){
  if(dialog.open||!token)return;
  status.textContent='Uw wereld wordt vernieuwd…';
  try{
    var q={};var media=new URLSearchParams(location.search).get('mediaRef');if(media)q.mediaRef=media;
    view=await api('/api/living-world/view',q);render();
    status.textContent='Bijgewerkt '+new Date(view.asOf).toLocaleTimeString()+'. U bepaalt welke ervaringen u opent.';
  }catch(e){status.textContent=e.message+' Opnieuw proberen: Vernieuwen. Getoonde gegevens zijn niet opnieuw gecontroleerd.';}
}
function drawFields(fields){
  var target=d.getElementById('lwFields');target.textContent='';
  fields.forEach(function(f){
    if(f.type==='checks'){
      if(!f.options.length)return;
      var group=el('fieldset'),legend=el('legend','',f.label);group.appendChild(legend);
      f.options.forEach(function(o){var label=el('label'),input=el('input');input.type='checkbox';input.name=f.name;input.value=o[0];input.checked=(f.value||[]).includes(o[0]);
        label.append(input,d.createTextNode(o[1]));group.appendChild(label);});target.appendChild(group);return;
    }
    var label=el('label','',f.label),input;
    if(f.type==='textarea'||f.type==='lines'){input=el('textarea');input.value=f.type==='lines'?(f.value||[]).join('\n'):(f.value||'');input.maxLength=2400;}
    else if(f.type==='select'){input=el('select');f.options.forEach(function(o){var option=el('option','',o[1]);option.value=o[0];input.appendChild(option);});input.value=f.value||'';}
    else{input=el('input');input.type=f.type==='checkbox'?'checkbox':f.type;if(f.type==='datetime-local')input.step='1';input.value=f.type==='checkbox'?'on':(f.value||'');if(f.type==='checkbox')input.checked=!!f.value;else input.maxLength=1600;}
    input.name=f.name;input.id='lwField-'+f.name;label.htmlFor=input.id;
    if(f.type==='checkbox')label.prepend(input);else label.appendChild(input);target.appendChild(label);
  });
}
function startAction(id,row){
  if(busy)return;
  action=id;schema=w.LivingWorldForms.shape(id,row,view);preview=null;idem=null;contextId=null;
  d.getElementById('lwDialogTitle').textContent=labelFor(id,row);
  d.getElementById('lwDialogIntro').textContent=schema.intro;
  drawFields(schema.fields);error.textContent='';d.getElementById('lwPreview').hidden=true;submit.textContent='Bekijk en bevestig';submit.disabled=false;
  dialog.showModal();
}
function labelFor(id,row){
  var a=(row.actions||[]).concat(view.createActions||[]).find(function(a){return a.id===id;});
  return a?a.label:id==='contribution.create'?'Iets achterlaten':'Ervaring maken';
}
form.addEventListener('input',function(){if(!busy){preview=null;idem=null;d.getElementById('lwPreview').hidden=true;submit.textContent='Bekijk en bevestig';}});
form.addEventListener('submit',async function(e){
  e.preventDefault();if(busy)return;busy=true;submit.disabled=true;error.textContent='';
  try{
    if(!preview){
      var parameters=w.LivingWorldForms.collect(form,schema,action);
      var boot=await api('/api/experience/bootstrap',{world:'travel'});contextId=boot.currentContext.id;
      var p=await api('/api/experience/intent/preview',{intent:'living-world.'+action,version:1,world:'travel',contextId:contextId,parameters:parameters});
      preview=p.preview;idem='lw-'+w.crypto.randomUUID();
      var box=d.getElementById('lwPreview');box.textContent=preview.confirmation.text+' '+schema.intro;box.hidden=false;
      submit.textContent='Bevestigen';
    }else{
      var done=await api('/api/experience/intent/execute',{previewId:preview.id,idempotencyKey:idem,confirmed:true});
      dialog.close();selection={type:done.type,id:done.id};history.pushState(null,'','?'+done.type+'='+encodeURIComponent(done.id));
      await load();status.textContent='Opgeslagen. U kunt dit hier later terugvinden.';
    }
  }catch(err){error.textContent=err.message;submit.textContent=preview?'Bevestiging opnieuw opvragen':'Bekijk en bevestig';}
  finally{busy=false;submit.disabled=false;}
});
d.getElementById('lwClose').onclick=function(){if(!busy)dialog.close();};
dialog.addEventListener('cancel',function(e){if(busy)e.preventDefault();});
d.getElementById('lwRefresh').onclick=load;
d.querySelectorAll('[data-lw-tab]').forEach(function(b){b.onclick=function(){setTab(b.dataset.lwTab);};});
w.addEventListener('popstate',function(){readLocation();render();});
w.addEventListener('online',load);
d.addEventListener('visibilitychange',function(){if(!d.hidden)load();});
setInterval(function(){if(!d.hidden&&!busy)load();},60000);
function syncEdge(){
  if(w.RTGAdaptief)w.RTGAdaptief.context({bron:'living-world',titel:selection?'Living World · '+selection.type:tab==='plans'?'Mijn ervaringen':tab==='studio'?'Werkplaats':'Living World'});
  var edge=w.RTGEdge&&w.RTGEdge.active;if(!edge)return;
  var b=edge.root.querySelector('[data-rtg-edge-primary]'),primary=d.querySelector('[data-lw-primary]');
  if(!b)return;
  edge.onAction=function(){if(w.RTGAdaptiveEdge)w.RTGAdaptiveEdge.setState('dock');var current=d.querySelector('[data-lw-primary]');if(current)current.click();else setTab('world');};
  var label=primary?primary.textContent:'Ontdek uw wereld';edge.ctx.actie=label;b.textContent=label;b.hidden=false;
  if(w.RTGAdaptiveEdge)w.RTGAdaptiveEdge.continueWith({title:'Living World',copy:label,presence:label,action:'primary'});
  if(w.RTGContinueKey&&w.RTGContinueKey.sync)w.RTGContinueKey.sync(d,w);
}
var observer=new MutationObserver(function(){if(w.RTGEdge&&w.RTGEdge.active){syncEdge();observer.disconnect();}});
observer.observe(d.body,{childList:true,subtree:true});setTimeout(function(){observer.disconnect();syncEdge();},15000);
readLocation();
if(!token){status.textContent='Log in om uw wereld te openen.';var a=el('a','','Naar inloggen');a.href='/apps/app.html';d.getElementById('lwContent').appendChild(a);}
else load();
})(window,document);
