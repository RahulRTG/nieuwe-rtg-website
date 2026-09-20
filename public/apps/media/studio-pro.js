(function () {
  'use strict';
  var $=function(s){return document.querySelector(s)},$$=function(s){return Array.from(document.querySelectorAll(s))};
  var E=window.RTGMediaEditor,status=$('#proStatus'),bronBestand=null;
  function zeg(t){status.textContent=t}
  function tijd(t){t=Math.max(0,Number(t)||0);var m=Math.floor(t/60),s=(t-m*60).toFixed(1).padStart(4,'0');return String(m).padStart(2,'0')+':'+s}
  function synchroniseer(st){
    $$('[data-pro-waarde]').forEach(function(i){if(st[i.dataset.proWaarde]!=null){i.value=st[i.dataset.proWaarde];i.nextElementSibling.textContent=st[i.dataset.proWaarde]}});
    $('#proTekst').value=st.tekst||'';$('#proTekstKleur').value=st.tekstKleur||'#ffffff';$('#proTekstAchter').value=st.tekstAchter||'#130d09';
    $('#proSpiegel').setAttribute('aria-pressed',String(!!st.spiegel));$('#proDucking').setAttribute('aria-pressed',String(!!st.ducking));$('#proDempen').setAttribute('aria-pressed',String(!!st.dempen));
    $$('[data-pro-ratio]').forEach(function(b){b.setAttribute('aria-pressed',String(String(st.ratio)===b.dataset.proRatio))});
  }
  function markeerKeys(keys,duur){var vak=$('#proKeys');vak.textContent='';(keys||[]).forEach(function(k){var i=document.createElement('i');i.style.left=(duur?k.t/duur*100:0)+'%';i.title='Keyframe op '+tijd(k.t);vak.appendChild(i)});$('#proKeyframeStand').textContent=(keys||[]).length?(keys.length+' keyframe'+(keys.length===1?'':'s')+' in deze productie.'):'Geen keyframes. Voeg er een toe om beweging of grading door de tijd te laten verlopen.'}
  E.luister(function(soort,d){
    if(soort==='historie'){$('#proUndo').disabled=!d.undo;$('#proRedo').disabled=!d.redo}
    if(soort==='staat')synchroniseer(d.staat);
    if(soort==='keys'){var b=E.bron();markeerKeys(d.keys,b&&b.duur)}
    if(soort==='tijd'){var duur=d.duur||0,p=duur?d.tijd/duur*100:0;$('#proTijd').textContent=tijd(d.tijd)+' / '+tijd(duur);$('#proScrub').value=d.tijd;$('#proKop').style.left=p+'%'}
    if(soort==='speel')$('#proSpeel').textContent=d.aan?'Pauze':'Afspelen';
  });
  $$('[data-pro-tab]').forEach(function(b){b.addEventListener('click',function(){$$('[data-pro-tab]').forEach(function(x){x.setAttribute('aria-current',String(x===b))});$$('[data-pro-paneel]').forEach(function(p){p.hidden=p.dataset.proPaneel!==b.dataset.proTab})})});
  $$('[data-pro-waarde]').forEach(function(i){i.addEventListener('input',function(){i.nextElementSibling.textContent=i.value;E.zet(i.dataset.proWaarde,Number(i.value),false)});i.addEventListener('change',function(){E.zet(i.dataset.proWaarde,Number(i.value),true)})});
  $$('[data-pro-preset]').forEach(function(b){b.addEventListener('click',function(){$$('[data-pro-preset]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});E.preset(b.dataset.proPreset);zeg('Kleurstijl toegepast. U kunt iedere waarde nog verfijnen.')})});
  $$('[data-pro-ratio]').forEach(function(b){b.addEventListener('click',function(){E.zet('ratio',b.dataset.proRatio,true);$$('[data-pro-ratio]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))})})});
  $('#proAuto').addEventListener('click',function(){E.auto();zeg('Rahul heeft licht en kleurbalans gemeten en niet-destructief afgewerkt.')});
  $('#proUndo').addEventListener('click',E.undo);$('#proRedo').addEventListener('click',E.redo);
  $('#proSpeel').addEventListener('click',E.speel);$('#proScrub').addEventListener('input',function(){E.zoek(this.value)});
  $('#proKwaliteit').addEventListener('change',E.render);
  $('#proVergelijk').addEventListener('pointerdown',function(){E.vergelijk(true);this.setAttribute('aria-pressed','true')});
  ['pointerup','pointerleave','pointercancel'].forEach(function(n){$('#proVergelijk').addEventListener(n,function(){E.vergelijk(false);this.setAttribute('aria-pressed','false')})});
  $('#proSpiegel').addEventListener('click',function(){var v=!E.staat().spiegel;E.zet('spiegel',v,true);this.setAttribute('aria-pressed',String(v))});
  $('#proSafeKnop').addEventListener('click',function(){var v=$('#proSafe').hidden;$('#proSafe').hidden=!v;this.setAttribute('aria-pressed',String(v))});
  $('#proDucking').addEventListener('click',function(){var v=!E.staat().ducking;E.zet('ducking',v,true);this.setAttribute('aria-pressed',String(v))});
  $('#proDempen').addEventListener('click',function(){var v=!E.staat().dempen;E.zet('dempen',v,true);this.setAttribute('aria-pressed',String(v))});
  $('#proTekst').addEventListener('input',function(){E.zet('tekst',this.value,false);$('#proTekstSpoor').textContent=this.value||'Titel en ondertiteling'});$('#proTekst').addEventListener('change',function(){E.zet('tekst',this.value,true)});
  $('#proTekstKleur').addEventListener('input',function(){E.zet('tekstKleur',this.value,false)});$('#proTekstKleur').addEventListener('change',function(){E.zet('tekstKleur',this.value,true)});
  $('#proTekstAchter').addEventListener('input',function(){E.zet('tekstAchter',this.value,false)});$('#proTekstAchter').addEventListener('change',function(){E.zet('tekstAchter',this.value,true)});
  $('#proKeyframe').addEventListener('click',function(){E.key();var s=E.staat(),b=E.bron();markeerKeys(s.keys,b&&b.duur);zeg('Keyframe toegevoegd op de huidige tijd.')});
  $('#proOndertitelPas').addEventListener('click',function(){var n=E.cues($('#proOndertitels').value);$('#proTekstSpoor').textContent=n?n+' ondertitelregels':'Geen geldige tijdregels';zeg(n?n+' ondertitelregels toegepast.':'Gebruik per regel: 00:00 - 00:03 tekst')});
  $('#proLaagBestand').addEventListener('change',function(){var f=this.files[0];if(f)E.voegLaag(f).then(function(){zeg('Beeldlaag toegevoegd.')}).catch(function(e){zeg(e.message)})});
  $('#proMuziekBestand').addEventListener('change',function(){var f=this.files[0];if(!f)return;E.voegMuziek(f);$('#proMuziekStand').textContent=f.name+', lokaal, '+Math.round(f.size/1024)+' KB';$('#proAudioSpoor').textContent='Brongeluid + '+f.name;zeg('Muzieklaag toegevoegd. Controleer zelf de gebruiksrechten.')});
  function trim(){var b=E.bron();if(!b||b.soort!=='video')return;var van=Math.max(0,Number($('#proVan').value)||0),tot=Math.min(b.duur,Number($('#proTot').value)||b.duur);if(tot<=van)tot=Math.min(b.duur,van+.1);$('#proVan').value=van.toFixed(1);$('#proTot').value=tot.toFixed(1);$('#proClip').style.left=(van/b.duur*100)+'%';$('#proClip').style.right=((b.duur-tot)/b.duur*100)+'%';E.zoek(van)}
  $('#proVan').addEventListener('change',trim);$('#proTot').addEventListener('change',trim);
  $('#proOndertitelAuto').addEventListener('click',async function(){
    if(!bronBestand)return zeg('Open eerst een video of audiobestand.');if(bronBestand.size>2*1024*1024)return zeg('Lokale transcriptie werkt hier per fragment tot 2 MB. Knip eerst een kort fragment of voer tijdregels handmatig in.');
    var token=null;try{token=localStorage.getItem('rtg_member_token')}catch(e){};if(!token)return zeg('Log in om het lokale RTG-spraakmodel te gebruiken.');zeg('Het lokale spraakmodel luistert. Het bestand wordt niet bewaard.');
    try{var r=await fetch('/api/ondertiteling/fragment',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':bronBestand.type,'X-RTG-Taal':'nl'},body:bronBestand}),j=await r.json();if(!r.ok||!j.tekst)throw new Error(j.error||'Geen spraak herkend.');var b=E.bron(),eind=Math.min((b&&b.duur)||6,6);$('#proOndertitels').value='00:00 - 00:'+String(eind.toFixed(1)).padStart(4,'0')+' '+j.tekst;$('#proOndertitelPas').click()}catch(e){zeg(e.message)}
  });
  $('#mediaBestand').addEventListener('change',function(){
    var f=Array.from(this.files).find(function(x){return /^image\//.test(x.type)||/^video\//.test(x.type)});if(!f){zeg('Kies ten minste één foto of video.');return}bronBestand=f;zeg('Bron wordt lokaal voorbereid.');E.laad(f).then(function(b){
      $('#proScrub').max=b.duur||1;$('#proVan').max=b.duur||0;$('#proTot').max=b.duur||0;$('#proVan').value='0';$('#proTot').value=(b.duur||0).toFixed(1);$('#proSpeel').disabled=b.soort!=='video';$('#proExportNaam').value=(f.name.replace(/\.[^.]+$/,'')||'RTG-productie')+' - RTG master';$('#proAudioSpoor').textContent=b.soort==='video'?'Brongeluid':'Geen brongeluid';markeerKeys([],b.duur);zeg((b.soort==='video'?'Video':'Foto')+' gereed, '+b.w+' x '+b.h+', blijft op dit toestel');
    }).catch(function(e){zeg(e.message)})
  });
  $('#proExport').addEventListener('click',async function(){var knop=this,oud=$('#proKwaliteit').value,prof=$('#proProfiel').value;knop.disabled=true;knop.textContent='Master wordt opgebouwd';if(prof)$('#proKwaliteit').value=prof;E.render();zeg('Export wordt lokaal opgebouwd. Houd dit scherm open.');try{var r=await E.exporteer({naam:$('#proExportNaam').value,type:$('#proFotoFormaat').value});zeg('Master gereed, '+r.type+', zonder watermerk.')}catch(e){zeg(e.message)}finally{$('#proKwaliteit').value=oud;knop.disabled=false;knop.textContent='Exporteer master'}});
  $('#proProjectBewaar').addEventListener('click',function(){var p=E.project();if(!p.bron)return zeg('Open eerst een productie.');try{localStorage.setItem('rtg_studio_pro_laatst',JSON.stringify(p));zeg('Bewerkingsrecept lokaal bewaard. Het bronbestand blijft apart op uw toestel.')}catch(e){zeg('Dit toestel kon het projectrecept niet bewaren.')}});
})();
