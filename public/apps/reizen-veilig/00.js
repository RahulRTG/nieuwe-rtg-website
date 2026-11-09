// Initialiseert de gedeelde bediening van Reizen Veilig.
(function(){
  'use strict';
  var $=function(s){return document.querySelector(s)}, panes=[],actief=-1,meldAdaptief=function(){};
  var apps={reisbureau:['Reisbureau','/apps/reisbureau.html'],move:['Haal ik het?','/apps/move.html'],overzicht:['Vandaag',null],reisblad:['Reizen',null],vervoer:['Gaan','/apps/ov.html'],reizen:['Mijn reizen','/apps/reizen.html'],veilig:['RTG Veilig','/apps/veilig.html#wacht'],navigatie:['Navigatie','/apps/navigatie.html'],instellingen:['Instellingen','/apps/veilig.html#rust']};
  var bank=[['overzicht','Vandaag'],['vervoer','Gaan'],['reisblad','Reizen'],['veilig','RTG Veilig'],['navigatie','Navigatie'],['instellingen','Instellingen']];
  function ingebed(pad){
    try{var u=new URL(String(pad||''),location.href);if(u.origin!==location.origin||u.pathname.indexOf('/apps/')!==0)return null;u.searchParams.set('embed','1');return u.pathname+u.search+u.hash}
    catch(e){return null}
  }
  function commandHost(){
    try{return parent!==window&&document.documentElement.classList.contains('rtg-command-blad')&&
      parent.location.origin===location.origin&&parent.RTGCommand&&parent.RTGCommand.actief()}
    catch(e){return false}
  }
  function token(){try{return localStorage.getItem('rtg_member_token')}catch(e){return null}}
  async function api(pad,body){var r=await fetch(pad,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(token()||'')},body:JSON.stringify(body||{})}),j=await r.json().catch(function(){return {}});if(!r.ok)throw new Error(j.error||'Dit lukte niet.');return j}
  function open(id,naast,pad){var a=apps[id]||apps.overzicht,gevonden=panes.findIndex(function(p){return p.id===id});if(pad)a=[a[0],pad];if(gevonden>=0){var fr=pad&&panes[gevonden].el.querySelector('iframe'),verversAdres=pad&&ingebed(pad);if(fr&&verversAdres)fr.setAttribute('src',verversAdres);kies(gevonden);return}
    /* Binnen Command is de buitenste werktafel de enige frame-eigenaar. Een
       externe reismodule wordt daar een direct tweede blad; bron en module
       blijven dus bestaan zonder Command -> Reizen & Veilig -> app-nesting.
       Standalone blijft dezelfde lokale tweepaneel-werkruimte gebruiken. */
    if(a[1]&&commandHost()){
      var url=ingebed(a[1]);if(!url)return;
      parent.RTGCommand.open(url,a[0],'rechts');
      return;
    }
    if(!naast||innerWidth<761){panes.forEach(function(p){p.el.remove()});panes=[]}
    if(panes.length>=2){panes.shift().el.remove()}
    var el=document.createElement('section');el.className='ds-paneel';el.dataset.id=id;
    if(a[1]){var paneelFrameAdres=ingebed(a[1]);if(!paneelFrameAdres)return;var reisVeiligPaneelFrame=document.createElement('iframe');reisVeiligPaneelFrame.src=paneelFrameAdres;reisVeiligPaneelFrame.className='ds-kader';reisVeiligPaneelFrame.title=a[0];RTGMedia.kader(reisVeiligPaneelFrame);el.appendChild(reisVeiligPaneelFrame)}else el.appendChild($(id==='reisblad'?'#rvReizen':'#rvOverzicht').content.cloneNode(true));
    $('#rvPanes').appendChild(el);panes.push({id:id,titel:a[0],el:el});$('#rvPanes').classList.toggle('ds-panelen--twee',panes.length>1);kies(panes.length-1);haak(el);if(id==='overzicht'){laadMomenten(el);reis().volgende(el);reis().groet(el)}if(id==='reisblad')reis().aanbod(el)
  }
  function kies(i){actief=i;panes.forEach(function(p,n){p.el.toggleAttribute('data-actief',n===i)});teken();document.querySelectorAll('[data-open]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.open===panes[i].id))});context();meldAdaptief()}
  function teken(){var t=$('#rvTabs');t.innerHTML='';panes.forEach(function(p,i){var b=document.createElement('button');b.type='button';b.className='ds-chip';b.setAttribute('aria-pressed',String(i===actief));b.textContent=p.titel;b.dataset.rtgActionKey='reisveilig.'+p.id;b.onclick=function(){kies(i)};t.appendChild(b)})}
  function haak(el){el.querySelectorAll('[data-action]').forEach(function(b){b.onclick=function(){open(b.dataset.action,innerWidth>760)}});el.querySelectorAll('[data-circle=maak]').forEach(function(b){b.onclick=function(){$('#rvMomentFout').textContent='';$('#rvDialoog').showModal()}});gebaren(el)}
  /* Veeg over een regel van 'Uw eerstvolgende moment' (shared/gebaar.js): de
     veeg drukt de knop die de regel al heeft (LAT.md regel 4). */
  function gebaren(el){
    if(!window.RTGGebaar){document.addEventListener('rtg-gebaar',function(){gebaren(el)},{once:true});return}
    var K=window.RTGGebaar.klaar;
    window.RTGGebaar.lijst(el,'[data-lijn]',function(rij){
      var b=rij.querySelector('button'),kop=rij.querySelector('b');
      var doen=b?K.eigenKnop(b.textContent.replace(/[^\wÀ-ÿ ]/g,'').trim()||'Openen','openen','button')
               :{naam:'Moment starten',teken:'rahul',doe:function(){$('#rvMomentFout').textContent='';$('#rvDialoog').showModal()}};
      return {titel:kop?kop.textContent.trim():'',rechts:[doen],links:[K.overnemen()]};
    });
  }
