(function () {
  'use strict';
  var E=window.RTGMediaEditor,canvas=E.onderdelen().canvas;
  var stijlen={
    clean:{belichting:6,contrast:8,hooglichten:-8,schaduwen:8,warmte:2,verzadiging:5},
    cinema:{belichting:-3,contrast:20,hooglichten:-24,schaduwen:12,warmte:8,verzadiging:-12,fade:7,vignet:24},
    golden:{belichting:7,contrast:10,hooglichten:-15,schaduwen:10,warmte:32,verzadiging:12,vignet:12},
    editorial:{belichting:3,contrast:24,hooglichten:-18,schaduwen:-4,warmte:-5,verzadiging:-8,korrel:13},
    mono:{belichting:4,contrast:25,hooglichten:-15,schaduwen:8,verzadiging:-100,korrel:18,vignet:16}
  };
  E.preset=function(naam){E.reeks(stijlen[naam]||{})};
  E.auto=function(){
    if(!E.bron())return;E.render();var c=canvas.getContext('2d'),w=Math.min(160,canvas.width),h=Math.min(90,canvas.height),d=c.getImageData(0,0,w,h).data,s=0;
    for(var i=0;i<d.length;i+=4)s+=(d[i]+d[i+1]+d[i+2])/3;
    var gem=s/(d.length/4);E.reeks({belichting:Math.round(Math.max(-25,Math.min(25,(128-gem)/3))),contrast:12,hooglichten:-16,schaduwen:10,verzadiging:6});
  };
})();
