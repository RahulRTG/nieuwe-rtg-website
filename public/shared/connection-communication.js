(function (w) {
  'use strict';
  function create(options) {
    var product = options.product, token = options.token, contextId = null, host = null, timer = null;
    var status = null, pc = null, local = null, recordStream = null, callId = null, seen = {}, recorder = null, chunks = [], mee = null;
    function request(path, body, extra) {
      var init = { method:'POST', headers:Object.assign({Authorization:'Bearer '+token}, (extra && extra.headers) || {}) };
      if (extra && extra.raw) init.body = body;
      else { init.headers['Content-Type']='application/json'; init.body=JSON.stringify(body || {}); }
      return fetch('/api/connection/'+product+'/'+path, init).then(function (r) { return r.json().catch(function(){return {};})
        .then(function (b) { if (!r.ok) { var e=new Error(b.error||'De verbinding kon niet worden bijgewerkt.');e.code=b.code;e.status=r.status;throw e; } return b; }); });
    }
    function stopMedia() { if (local) try { local.getTracks().forEach(function(t){t.stop();}); } catch(e){} local=null;
      if (pc) try { pc.close(); } catch(e){} pc=null;if(mee&&mee.stop)mee.stop();mee=null;callId=null; }
    function render() {
      if (!host || !status) return;
      host.innerHTML = w.RTGConnectionCommunicationView.html(status);
      bind();
    }
    function load(silent) {
      if (!contextId) return Promise.resolve();
      return request('status',{id:contextId}).then(function(s){status=s;if(!(pc&&callId&&s.call&&s.call.id===callId))render();if(s.call) watchCall(s.call);return s;})
        .catch(function(e){if(e.status===403||e.status===404){stopMedia();clearInterval(timer);timer=null;if(host)host.replaceChildren();}if(!silent&&options.onError)options.onError(e);});
    }
    function bind() {
      var send=host.querySelector('[data-cc-send]'), input=host.querySelector('[data-cc-text]');
      send.onclick=function(){var text=input.value.trim();if(!text)return;send.disabled=true;request('text',{id:contextId,text:text}).then(function(){input.value='';return load(true);}).catch(fail).finally(function(){send.disabled=false;});};
      input.onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send.click();}};
      host.querySelectorAll('[data-cc-consent]').forEach(function(el){el.onchange=function(){request('consent',{id:contextId,capability:el.dataset.ccConsent,active:el.checked}).then(function(){return load(true);}).catch(fail);};});
      var image=host.querySelector('[data-cc-image]');image.onchange=function(){if(image.files&&image.files[0])upload(image.files[0],'image');};
      host.querySelector('[data-cc-record]').onclick=record;
      host.querySelectorAll('[data-cc-call]').forEach(function(el){el.onclick=function(){startCall(el.dataset.ccCall);};});
      var answer=host.querySelector('[data-cc-answer]');if(answer)answer.onclick=function(){answerCall(true);};
      var decline=host.querySelector('[data-cc-decline]');if(decline)decline.onclick=function(){answerCall(false);};
      var hang=host.querySelector('[data-cc-hangup]');if(hang)hang.onclick=endCall;
      host.querySelectorAll('[data-cc-remove]').forEach(function(el){el.onclick=function(){
        if(!w.confirm('Dit bericht voor jullie allebei verwijderen?'))return;
        request('message/remove',{id:contextId,messageId:el.dataset.ccRemove}).then(function(){return load(true);}).catch(fail);
      };});
      host.querySelectorAll('[data-cc-report]').forEach(function(el){el.onclick=function(){
        var reason=w.prompt('Wat wilt u over dit bericht melden?');if(!reason||!reason.trim())return;
        request('message/report',{id:contextId,messageId:el.dataset.ccReport,reason:reason.trim()}).then(function(){
          if(options.onNotice)options.onNotice('Het bericht is gemeld.');
        }).catch(fail);
      };});
    }
    function upload(file, kind) {
      var transcript=kind==='voice'?(host.querySelector('[data-cc-voice-text]').value||'').trim():'';
      request('message-media',file,{raw:true,headers:{'Content-Type':file.type,'X-RTG-Context':contextId,
        'X-RTG-Media-Kind':kind,'X-RTG-Transcript':transcript,'Idempotency-Key':w.RTGId('connection-media')}})
        .then(function(){return load(true);}).catch(fail);
    }
    function record(e) {
      var button=e.currentTarget;if(recorder&&recorder.state==='recording'){recorder.stop();return;}
      var transcript=(host.querySelector('[data-cc-voice-text]').value||'').trim();
      if(!transcript)return fail(new Error('Schrijf eerst een transcript of korte inhoud voor dit spraakbericht.'));
      if(!w.MediaRecorder)return fail(new Error('Spraak opnemen wordt op dit toestel niet ondersteund.'));
      w.RTGMedia.microfoon().then(function(s){recordStream=s;chunks=[];recorder=new MediaRecorder(s,{mimeType:MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm'});
        recorder.ondataavailable=function(x){if(x.data.size)chunks.push(x.data);};recorder.onstop=function(){var blob=new Blob(chunks,{type:'audio/webm'});try{recordStream.getTracks().forEach(function(t){t.stop();});}catch(x){}recordStream=null;button.textContent='Spraak opnemen';upload(blob,'voice');};recorder.start();button.textContent='Stop en verstuur';}).catch(fail);
    }
    function getMedia(type) { return w.RTGMedia.vraag({audio:true,video:type==='video'}).then(function(s){local=s;return s;}); }
    function makePeer(type) { return fetch('/api/ice',{headers:{Authorization:'Bearer '+token}}).then(function(r){return r.json();}).catch(function(){return {iceServers:[]};}).then(function(cfg){
      pc=new RTCPeerConnection({iceServers:cfg.iceServers||[]});local.getTracks().forEach(function(t){pc.addTrack(t,local);});
      pc.ontrack=function(e){var v=host.querySelector('[data-cc-remote]');if(v)v.srcObject=e.streams[0];};
      pc.onicecandidate=function(e){if(e.candidate)request('call/signal',{callId:callId,kind:'ice',payload:e.candidate}).catch(fail);};
      var own=host.querySelector('[data-cc-local]');if(own)own.srcObject=local;ensureCaptions();return pc; }); }
    function startCall(type) { getMedia(type).then(function(){return request('call/start',{id:contextId,type:type},{headers:{'Idempotency-Key':w.RTGId('connection-call')}});})
      .then(function(r){callId=r.call.id;openDialog();return makePeer(type);}).then(function(){return pc.createOffer();}).then(function(o){return pc.setLocalDescription(o).then(function(){return request('call/signal',{callId:callId,kind:'offer',payload:o});});}).then(pollCall).catch(function(e){stopMedia();fail(e);}); }
    function answerCall(accept) { var c=status.call;request('call/answer',{callId:c.id,accept:accept}).then(function(){if(!accept)return load(true);callId=c.id;return getMedia(c.type).then(function(){openDialog();return makePeer(c.type);}).then(pollCall);}).catch(fail); }
    function openDialog(){var d=host.querySelector('[data-cc-dialog]');if(d&&!d.open)d.showModal();}
    function watchCall(c){if(callId===c.id)return;callId=c.id;if(c.state==='ACTIVE'&&local)openDialog();}
    function pollCall(){if(!callId)return;request('call/poll',{callId:callId}).then(function(r){
      if(!['RINGING','ACTIVE'].includes(r.call.state)){stopMedia();return load(true);}return Promise.all((r.signals||[]).filter(function(s){if(seen[s.id])return false;seen[s.id]=true;return true;}).map(handleSignal)).then(function(){setTimeout(pollCall,700);});}).catch(function(){stopMedia();load(true);});}
    function ensureCaptions(){if(mee||!w.RTGMeelezen)return;mee=w.RTGMeelezen.maak({ik:'Jij',stroom:function(){return local;},stuur:function(text){request('call/signal',{callId:callId,kind:'caption',payload:{text:text}}).catch(fail);}});var d=host.querySelector('[data-cc-dialog]');if(d)d.appendChild(mee.el);}
    function handleSignal(s){if(s.kind==='caption'){ensureCaptions();if(mee)mee.voed(s.payload&&s.payload.text,{wie:'Ander',bron:'mens'});return Promise.resolve();}if(!pc)return Promise.resolve();if(s.kind==='offer')return pc.setRemoteDescription(s.payload).then(function(){return pc.createAnswer();}).then(function(a){return pc.setLocalDescription(a).then(function(){return request('call/signal',{callId:callId,kind:'answer',payload:a});});});
      if(s.kind==='answer')return pc.setRemoteDescription(s.payload);if(s.kind==='ice')return pc.addIceCandidate(s.payload).catch(function(){});return Promise.resolve();}
    function endCall(){if(!callId)return;request('call/end',{callId:callId}).catch(function(){}).finally(function(){stopMedia();load(true);});}
    function fail(e){if(options.onError)options.onError(e);}
    function mount(el,id){unmount();host=el;contextId=id;load(false);timer=setInterval(function(){load(true);},2500);}
    function unmount(){if(timer)clearInterval(timer);timer=null;if(callId)request('call/end',{callId:callId}).catch(function(){});if(recordStream)try{recordStream.getTracks().forEach(function(t){t.stop();});}catch(e){}recordStream=null;stopMedia();host=null;contextId=null;status=null;}
    return {mount:mount,unmount:unmount,refresh:function(){return load(true);}};
  }
  w.RTGConnectionCommunication={create:create};
})(window);
