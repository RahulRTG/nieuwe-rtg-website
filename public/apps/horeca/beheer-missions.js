(function(){
  'use strict';
  var K=window.RTGHoreca, voorstel=null, kandidaat=null;
  function $(id){return document.getElementById(id)}
  function esc(s){return K.esc(s)}
  function api(p,b){return K.api('/missions'+p,b||{}).then(function(r){if(r.body.error)throw new Error(r.body.error);return r.body})}
  function laad(){api('',{}).then(teken).catch(function(e){K.meld(e.message)})}
  function teken(d){
    $('hmLive').textContent=(d.team||[]).length;
    $('hmTeam').innerHTML=(d.team||[]).map(function(x){var n=(d.missies||[]).filter(function(m){return String(m.voorId)===String(x.id)&&/nieuw|bezig/.test(m.status)}).length;return '<div class="hm-person"><i></i><span><b>'+esc(x.name)+'</b><small>'+esc(x.func)+' · sinds '+new Date(x.sinds).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})+'</small></span><span class="hm-load">'+n+' actief</span></div>'}).join('')||'<p class="hm-empty">Nog niemand ingeklokt. Rahul wijst daarom niets toe.</p>';
    var actief=(d.missies||[]).filter(function(m){return !/klaar|geannuleerd/.test(m.status)});
    $('hmMissies').innerHTML=actief.map(function(m){return '<article class="hm-mission" data-prio="'+esc(m.prioriteit)+'"><i></i><span><b>'+esc(m.titel)+'</b><small>'+esc(m.sectie)+' · '+esc(m.voorNaam)+' · '+esc(m.status)+(m.hulp?' · HULP GEVRAAGD':'')+'</small></span><span class="hm-load">'+m.minuten+' min</span></article>'}).join('')||'<p class="hm-empty">Geen actieve missies. De vloer is bij.</p>';
  }
  function denk(){var tekst=$('hmVraag').value.trim();if(!tekst)return K.meld('Vertel Rahul eerst wat er nodig is.');$('hmDenk').disabled=true;api('/voorstel',{tekst:tekst}).then(function(d){voorstel=d.voorstel;kandidaat=d.kandidaat;$('hmVoorstel').innerHTML='<strong>'+esc(voorstel.titel)+'</strong><span>'+esc(voorstel.sectie)+' · '+voorstel.minuten+' min · '+esc(voorstel.prioriteit)+'</span><p>'+esc(d.uitleg)+'</p>'+(d.kanActiveren?'<button class="knop p" id="hmActiveer" type="button">Bevestig en stuur naar '+esc(kandidaat.name)+'</button>':'');var b=$('hmActiveer');if(b)b.addEventListener('click',activeer)}).catch(function(e){K.meld(e.message)}).finally(function(){$('hmDenk').disabled=false})}
  function activeer(){var b=$('hmActiveer');b.disabled=true;api('/activeer',{voorstel:voorstel,voorId:kandidaat&&kandidaat.id,reden:'Door chef bevestigd na voorstel van Rahul.'}).then(function(){$('hmVraag').value='';voorstel=kandidaat=null;$('hmVoorstel').innerHTML='<p>Missie staat op de PDA. Rahul blijft de voortgang volgen.</p>';K.meld('Missie verzonden naar de PDA.');laad()}).catch(function(e){K.meld(e.message);b.disabled=false})}
  if(!K.poort())return;$('hmDenk').addEventListener('click',denk);laad();setInterval(laad,15000);
})();
