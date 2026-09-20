(function () {
  'use strict';
  var editor=window.RTGMediaEditor,d=editor.onderdelen(),canvas=d.canvas,video=d.video,muziek=d.muziek;
  function download(blob,naam){var a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=naam;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},3000)}
  function naamVan(opt){return String(opt.naam||'RTG-productie').replace(/[^a-z0-9 _.-]/gi,'').trim()||'RTG-productie'}
  function foto(opt){return new Promise(function(ok,mis){var type=opt.type||'image/jpeg';canvas.toBlob(function(b){if(!b)return mis(new Error('Exporteren lukte niet.'));download(b,naamVan(opt)+(type==='image/png'?'.png':type==='image/webp'?'.webp':'.jpg'));ok({type:type})},type,.96)})}
  function videoExport(opt,bron){
    if(!window.MediaRecorder||!canvas.captureStream)return Promise.reject(new Error('Deze browser kan nog geen bewerkte video exporteren. Gebruik Chrome, Edge of Firefox.'));
    var begin=Number(document.getElementById('proVan').value)||0,eind=Number(document.getElementById('proTot').value)||bron.duur;
    return new Promise(function(ok,mis){
      var stream=canvas.captureStream(30),vs=video.captureStream?video.captureStream():null;
      if(vs)vs.getAudioTracks().forEach(function(t){stream.addTrack(t)});
      var ms=muziek.captureStream&&muziek.src?muziek.captureStream():null;
      if(ms)ms.getAudioTracks().forEach(function(t){stream.addTrack(t)});
      var mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':'video/webm';
      var rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:12000000}),delen=[],waak=null;
      rec.ondataavailable=function(e){if(e.data.size)delen.push(e.data)};
      rec.onerror=function(){if(waak)clearInterval(waak);mis(new Error('De video-export werd onderbroken.'))};
      rec.onstop=function(){download(new Blob(delen,{type:'video/webm'}),naamVan(opt)+'.webm');ok({type:'video/webm'})};
      video.pause();video.currentTime=begin;video.playbackRate=editor.staat().snelheid/100;
      video.onseeked=function start(){video.onseeked=null;rec.start(500);video.play();if(muziek.src){muziek.currentTime=0;muziek.play().catch(function(){})}d.render()};
      waak=setInterval(function(){if(video.currentTime>=eind||video.ended){clearInterval(waak);video.pause();muziek.pause();if(rec.state!=='inactive')rec.stop()}},50);
    });
  }
  editor.exporteer=function(opt){var bron=editor.bron();if(!bron)return Promise.reject(new Error('Open eerst een foto of video.'));editor.render();return bron.soort==='foto'?foto(opt):videoExport(opt,bron)};
  editor.project=function(){var bron=editor.bron();return{versie:1,bron:bron?{naam:bron.file.name,type:bron.file.type,w:bron.w,h:bron.h,duur:bron.duur}:null,staat:editor.staat()}};
})();
