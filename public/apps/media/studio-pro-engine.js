(function () {
  'use strict';
  var canvas=document.getElementById('proCanvas'), ctx=canvas.getContext('2d');
  var video=document.getElementById('proVideo'), muziek=document.getElementById('proMuziek');
  var bron=null, laag=null, bronUrl=null, laagUrl=null, muziekUrl=null, vergelijk=false, raf=0;
  var basis={belichting:0,contrast:0,hooglichten:0,schaduwen:0,warmte:0,verzadiging:0,fade:0,
    vignet:0,korrel:0,scherpte:0,zoom:100,x:0,y:0,hoek:0,snelheid:100,tekstGrootte:52,
    tekstY:78,bronVolume:100,muziekVolume:35,fadeIn:0,fadeUit:0,ratio:'bron',spiegel:false,
    ducking:false,dempen:false,tekst:'',tekstKleur:'#ffffff',tekstAchter:'#130d09',cues:[],keys:[]};
  var staat=Object.assign({},basis), historie=[], positie=-1, luisteraars=[];
  function kopie(){return JSON.parse(JSON.stringify(staat))}
  function meld(soort,extra){luisteraars.forEach(function(f){f(soort,extra||{})})}
  function bewaar(){historie=historie.slice(0,positie+1);historie.push(kopie());if(historie.length>60)historie.shift();positie=historie.length-1;meld('historie',{undo:positie>0,redo:false})}
  function herstel(s){staat=Object.assign({},basis,s||{});render();meld('staat',{staat:kopie()});meld('historie',{undo:positie>0,redo:positie<historie.length-1})}
  function undo(){if(positie<=0)return;positie--;herstel(historie[positie])}
  function redo(){if(positie>=historie.length-1)return;positie++;herstel(historie[positie])}
  function maat(){
    if(!bron)return{w:1280,h:720};var w=bron.w,h=bron.h,r=staat.ratio==='bron'?w/h:Number(staat.ratio);
    var keuze=document.getElementById('proKwaliteit').value;
    var max=keuze==='source'?(r>=1?h:w):(Number(keuze)||720);
    if(r>=1)return{w:Math.round(max*r),h:max};return{w:max,h:Math.round(max/r)};
  }
  function bronBeeld(){return bron&&bron.soort==='video'?video:(bron&&bron.element)}
  function getal(k,t){
    if(!staat.keys.length||!bron||bron.soort!=='video')return Number(staat[k]);
    var ks=staat.keys.slice().sort(function(a,b){return a.t-b.t}),a=ks[0],b=ks[ks.length-1];
    ks.forEach(function(x,i){if(x.t<=t)a=x;if(x.t>=t&&b.t<t)b=x;if(i&&ks[i-1].t<=t&&x.t>=t){a=ks[i-1];b=x}});
    if(!a.v||!b.v||a===b)return Number((a.v||staat)[k]);var p=(t-a.t)/Math.max(.001,b.t-a.t);
    return Number(a.v[k])+(Number(b.v[k])-Number(a.v[k]))*Math.max(0,Math.min(1,p));
  }
  function tijd(){return bron&&bron.soort==='video'?video.currentTime:0}
  function filterVoor(t){
    var bel=getal('belichting',t),con=getal('contrast',t),sat=getal('verzadiging',t),warm=getal('warmte',t),hoog=getal('hooglichten',t),schaduw=getal('schaduwen',t),detail=getal('scherpte',t);
    return 'brightness('+(100+bel*.65+schaduw*.15+hoog*.05)+'%) contrast('+(100+con*.72-schaduw*.1+hoog*.15+detail*.12)+'%) saturate('+(100+sat)+'%) sepia('+Math.max(0,warm*.32)+'%) hue-rotate('+(warm<0?warm*.22:-warm*.08)+'deg)';
  }
  function cueOp(t){for(var i=0;i<staat.cues.length;i++)if(t>=staat.cues[i].van&&t<=staat.cues[i].tot)return staat.cues[i].tekst;return''}
  function tekstblok(tekst,y,groot,kleur,achter){
    if(!tekst)return;ctx.save();ctx.font='600 '+groot+'px Inter,Arial,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    var max=canvas.width*.82,woorden=tekst.split(/\s+/),regels=[],regel='';
    woorden.forEach(function(w){var n=(regel+' '+w).trim();if(ctx.measureText(n).width>max&&regel){regels.push(regel);regel=w}else regel=n});if(regel)regels.push(regel);
    var lh=groot*1.22,cy=canvas.height*y/100-(regels.length-1)*lh/2;
    regels.forEach(function(r,i){var breed=ctx.measureText(r).width;ctx.globalAlpha=.82;ctx.fillStyle=achter;ctx.fillRect((canvas.width-breed)/2-groot*.35,cy+i*lh-lh*.48,breed+groot*.7,lh);ctx.globalAlpha=1;ctx.fillStyle=kleur;ctx.fillText(r,canvas.width/2,cy+i*lh)});ctx.restore();
  }
  function render(){
    if(!bron)return;var m=maat(),beeld=bronBeeld(),t=tijd();canvas.width=m.w;canvas.height=m.h;ctx.clearRect(0,0,m.w,m.h);ctx.save();
    var bw=bron.w,bh=bron.h,hoek=getal('hoek',t)*Math.PI/180,kw=Math.abs(Math.cos(hoek))*bw+Math.abs(Math.sin(hoek))*bh,kh=Math.abs(Math.sin(hoek))*bw+Math.abs(Math.cos(hoek))*bh;
    var schaal=Math.max(m.w/kw,m.h/kh)*(getal('zoom',t)/100);ctx.translate(m.w/2+getal('x',t)*m.w/220,m.h/2+getal('y',t)*m.h/220);ctx.rotate(hoek);ctx.scale(staat.spiegel?-schaal:schaal,schaal);
    ctx.filter=vergelijk?'none':filterVoor(t);try{ctx.drawImage(beeld,-bw/2,-bh/2,bw,bh)}catch(e){}ctx.restore();ctx.filter='none';
    if(!vergelijk){
      var fade=getal('fade',t)/100;if(fade){ctx.fillStyle='rgba(219,195,166,'+(fade*.18)+')';ctx.fillRect(0,0,m.w,m.h)}
      var vig=getal('vignet',t)/100;if(vig){var g=ctx.createRadialGradient(m.w/2,m.h/2,Math.min(m.w,m.h)*.22,m.w/2,m.h/2,Math.max(m.w,m.h)*.7);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,'+(vig*.8)+')');ctx.fillStyle=g;ctx.fillRect(0,0,m.w,m.h)}
      var kor=getal('korrel',t);if(kor){ctx.globalAlpha=Math.min(.18,kor/500);for(var i=0;i<m.w*m.h/1700;i++){var v=Math.random()>0.5?255:0;ctx.fillStyle='rgb('+v+','+v+','+v+')';ctx.fillRect(Math.random()*m.w,Math.random()*m.h,1+kor/35,1+kor/35)}ctx.globalAlpha=1}
      if(laag){var lw=m.w*.22,lh=lw*laag.h/laag.w;ctx.drawImage(laag.element,m.w-lw-m.w*.04,m.h*.05,lw,lh)}
      tekstblok(staat.tekst,getal('tekstY',t),getal('tekstGrootte',t),staat.tekstKleur,staat.tekstAchter);
      tekstblok(cueOp(t),88,Math.max(22,m.w/34),'#ffffff','#050505');
    }
    if(bron.soort==='video'&&!video.paused){var duur=bron.duur||0,van=Number(document.getElementById('proVan').value)||0,tot=Number(document.getElementById('proTot').value)||duur,basisVol=staat.muziekVolume/100,randIn=staat.fadeIn?Math.min(1,(t-van)/staat.fadeIn):1,randUit=staat.fadeUit?Math.min(1,(tot-t)/staat.fadeUit):1;muziek.volume=Math.max(0,basisVol*randIn*randUit*(staat.ducking ? .35 : 1));meld('tijd',{tijd:t,duur:duur});raf=requestAnimationFrame(render)}else meld('tijd',{tijd:t,duur:bron.duur||0});
  }
  function laad(file){
    if(!file||(!/^image\//.test(file.type)&&!/^video\//.test(file.type)))return Promise.reject(new Error('Kies een foto- of videobestand.'));
    if(bronUrl)URL.revokeObjectURL(bronUrl);bronUrl=URL.createObjectURL(file);cancelAnimationFrame(raf);
    return new Promise(function(resolve,reject){
      if(/^image\//.test(file.type)){var im=new Image();im.onload=function(){bron={soort:'foto',element:im,w:im.naturalWidth,h:im.naturalHeight,duur:0,file:file};staat=Object.assign({},basis);historie=[];positie=-1;bewaar();render();meld('geladen',{bron:bron});resolve(bron)};im.onerror=function(){reject(new Error('Deze foto kon niet worden gelezen.'))};im.src=bronUrl;return}
      video.onloadedmetadata=function(){bron={soort:'video',element:video,w:video.videoWidth,h:video.videoHeight,duur:video.duration||0,file:file};video.currentTime=0;staat=Object.assign({},basis);historie=[];positie=-1;bewaar();render();meld('geladen',{bron:bron});resolve(bron)};video.onerror=function(){reject(new Error('Deze video kon niet worden gelezen.'))};video.src=bronUrl;video.load();
    });
  }
  function zet(k,v,commit){staat[k]=v;if(k==='snelheid')video.playbackRate=Number(v)/100;if(k==='bronVolume'||k==='dempen')video.volume=staat.dempen?0:Number(staat.bronVolume)/100;if(k==='muziekVolume')muziek.volume=Number(v)/100;render();if(commit)bewaar();meld('staat',{staat:kopie()})}
  function speel(){if(!bron||bron.soort!=='video')return;if(video.paused){if(video.currentTime>=Number(document.getElementById('proTot').value)-.05)video.currentTime=Number(document.getElementById('proVan').value)||0;video.playbackRate=staat.snelheid/100;video.play();if(muziek.src){muziek.currentTime=Math.max(0,video.currentTime-(Number(document.getElementById('proVan').value)||0));muziek.play().catch(function(){})}render()}else{video.pause();muziek.pause()}meld('speel',{aan:!video.paused})}
  function zoek(t){if(!bron||bron.soort!=='video')return;video.currentTime=Math.max(0,Math.min(bron.duur,Number(t)||0));render()}
  function key(){if(!bron||bron.soort!=='video')return;var t=video.currentTime,v={};['belichting','contrast','warmte','verzadiging','zoom','x','y','hoek','tekstGrootte','tekstY'].forEach(function(k){v[k]=staat[k]});staat.keys=staat.keys.filter(function(k){return Math.abs(k.t-t)>.05});staat.keys.push({t:t,v:v});bewaar();render();meld('keys',{keys:staat.keys})}
  function cues(tekst){var uit=[];String(tekst||'').split(/\n/).forEach(function(r){var m=r.match(/^\s*(\d+):(\d+(?:\.\d+)?)\s*-\s*(\d+):(\d+(?:\.\d+)?)\s+(.+)$/);if(m)uit.push({van:Number(m[1])*60+Number(m[2]),tot:Number(m[3])*60+Number(m[4]),tekst:m[5].trim().slice(0,220)})});staat.cues=uit;bewaar();render();return uit.length}
  function voegLaag(file){if(!file||!/^image\//.test(file.type))return Promise.reject(new Error('Kies een afbeeldingslaag.'));if(laagUrl)URL.revokeObjectURL(laagUrl);laagUrl=URL.createObjectURL(file);return new Promise(function(ok,mis){var im=new Image();im.onload=function(){laag={element:im,w:im.naturalWidth,h:im.naturalHeight};render();ok()};im.onerror=mis;im.src=laagUrl})}
  function voegMuziek(file){if(!file||!/^audio\//.test(file.type))return Promise.reject(new Error('Kies een audiobestand.'));if(muziekUrl)URL.revokeObjectURL(muziekUrl);muziekUrl=URL.createObjectURL(file);muziek.src=muziekUrl;muziek.volume=staat.muziekVolume/100;meld('muziek',{naam:file.name})}
  video.addEventListener('timeupdate',function(){var eind=Number(document.getElementById('proTot').value)||Infinity;if(video.currentTime>=eind){video.pause();muziek.pause();render();meld('speel',{aan:false})}});
  window.RTGMediaEditor={laad:laad,zet:zet,reeks:function(v){Object.assign(staat,v||{});bewaar();render();meld('staat',{staat:kopie()})},undo:undo,redo:redo,speel:speel,zoek:zoek,key:key,cues:cues,voegLaag:voegLaag,voegMuziek:voegMuziek,render:render,vergelijk:function(v){vergelijk=v;render()},staat:function(){return kopie()},bron:function(){return bron},luister:function(f){luisteraars.push(f)},onderdelen:function(){return{canvas:canvas,video:video,muziek:muziek,render:render}}};
})();
