(function (w) {
  'use strict';
  var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
  function row(m){var content=m.kind==='text'?'<p>'+esc(m.text)+'</p>':m.kind==='voice'
    ?'<audio controls preload="none" src="'+esc(m.media&&m.media.src)+'"></audio><p class="connection-transcript">'+esc(m.media&&m.media.transcript)+'</p>'
    :'<img loading="lazy" src="'+esc(m.media&&m.media.src)+'" alt="Gedeelde foto">';
    return '<div class="connection-message'+(m.mine?' is-mine':'')+'">'+content+'<div class="connection-message-meta"><time>'+esc(new Date(m.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))+'</time>'+
      (m.mine?'<button type="button" data-cc-remove="'+esc(m.id)+'">Verwijderen</button>':'<button type="button" data-cc-report="'+esc(m.id)+'">Melden</button>')+'</div></div>';}
  function html(status){var call=status.call,incoming=call&&call.incoming&&call.state==='RINGING';return '<section class="connection-conversation" aria-label="Besloten gesprek">'+
    '<div class="connection-messages" role="log" aria-live="polite">'+(status.messages||[]).map(row).join('')+'</div>'+ 
    '<div class="connection-compose"><input data-cc-text maxlength="1200" aria-label="Bericht" placeholder="Schrijf een bericht"><button data-cc-send type="button">Verstuur</button></div>'+ 
    '<div class="connection-media-actions"><label><span>Foto</span><input data-cc-image type="file" accept="image/jpeg,image/png"></label><label class="connection-voice-copy"><span>Transcript of korte inhoud</span><input data-cc-voice-text maxlength="1200"></label><button data-cc-record type="button">Spraak opnemen</button></div>'+ 
    '<details class="connection-consent"><summary>Gespreksinstellingen</summary><label><input data-cc-consent="connection.voice" type="checkbox"'+((status.ownConsent||status.consent).voice?' checked':'')+'> Live audio toestaan</label><label><input data-cc-consent="connection.video" type="checkbox"'+((status.ownConsent||status.consent).video?' checked':'')+'> Video toestaan</label><p>Een oproep verschijnt pas nadat jullie dit allebei aanzetten. Intrekken stopt een actieve oproep.</p></details>'+ 
    '<div class="connection-live">'+(status.consent.voice?'<button data-cc-call="voice" type="button">Voice</button>':'')+(status.consent.video?'<button data-cc-call="video" type="button">Video</button>':'')+(incoming?'<button data-cc-answer type="button">Neem op</button><button data-cc-decline type="button">Niet nu</button>':'')+'</div></section>'+ 
    '<dialog class="connection-call" data-cc-dialog aria-label="Live gesprek"><div class="connection-call-stage"><video data-cc-remote autoplay playsinline></video><video data-cc-local autoplay playsinline muted></video></div><p data-cc-call-state aria-live="assertive">Verbinding wordt gemaakt...</p><button data-cc-hangup type="button">Beëindig gesprek</button></dialog>';}
  w.RTGConnectionCommunicationView={html:html};
}(window));
