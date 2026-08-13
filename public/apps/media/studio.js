(function () {
  'use strict';
  var body=document.body, main=document.querySelector('.media-werk>main'), studio=document.getElementById('mediaStudio'), rechten=document.getElementById('mediaRechten');
  try { if(parent!==window&&parent.RTGCommand&&parent.RTGCommand.actief()) body.classList.add('media-in-werktafel'); } catch(e) {}
  function kies(naam){document.querySelectorAll('[data-media-ruimte]').forEach(function(b){b.setAttribute('aria-current',String(b.dataset.mediaRuimte===naam))})}
  function openStudio(){main.hidden=true;studio.hidden=false;kies('studio')}
  function sluitStudio(){studio.hidden=true;main.hidden=false;kies('wereld')}
  function openRechten(){rechten.hidden=false;document.getElementById('releaseStand').textContent='controle geopend';kies('rechten')}
  function sluitRechten(){rechten.hidden=true;kies(studio.hidden?'wereld':'studio')}
  document.getElementById('nieuwKnop').onclick=openStudio;
  document.getElementById('studioSluit').onclick=sluitStudio;
  document.getElementById('rechtenKnop').onclick=openRechten;
  document.getElementById('rechtenSluit').onclick=sluitRechten;
  document.querySelector('[data-media-ruimte=studio]').onclick=openStudio;
  document.querySelector('[data-media-ruimte=rechten]').onclick=openRechten;
  document.getElementById('ruimteBieb').onclick=function(){document.getElementById('biebKnop').click()};
  document.querySelectorAll('[data-media-ruimte=wereld],[data-media-ruimte=ontdek]').forEach(function(b){b.onclick=function(){sluitStudio();kies(b.dataset.mediaRuimte)}});
  document.getElementById('mediaBestand').addEventListener('change',function(){
    if(!this.files.length)return;
    var f=this.files[0], naam=f.name.replace(/\.[^.]+$/,'');
    document.getElementById('studioTitel').textContent=naam||'Nieuwe productie';
    document.getElementById('studioMeta').textContent=this.files.length+' '+(this.files.length===1?'bestand':'bestanden')+' · '+(f.type||'type wordt gecontroleerd')+' · concept';
    document.getElementById('studioVlak').hidden=true;
    document.getElementById('mediaProductie').hidden=false;
    document.getElementById('studioStand').textContent='concept · analyse gereedmaken';
    document.getElementById('releaseStand').textContent='controle nodig';
  });
})();
