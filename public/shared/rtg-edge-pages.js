/* Native scroll/snap over existing controls, never a second app registry. */
(function (w,d) {
  'use strict';
  var rails = new Map(), frame = 0;
  function setup(rail) {
    var dots=d.createElement('div');dots.className='rtg-edge-page-dots';
    dots.setAttribute('role','group');dots.setAttribute('aria-label','Pagina kiezen');
    rail.after(dots);
    function update(){
      var nodes=Array.from(rail.children).filter(function(n){return n.matches('a,button')&&!n.hidden;});
      var width=rail.clientWidth, count=width?Math.ceil(rail.scrollWidth/width):0;
      // Count pages from the measured overflow, not a hard-coded app count.
      if(count<=1||!nodes.length||!rail.getClientRects().length){dots.hidden=true;return;}
      dots.hidden=false;
      if(dots.children.length!==count){
        dots.textContent='';
        for(var i=0;i<count;i++)(function(index){
          var b=d.createElement('button');b.type='button';b.setAttribute('aria-label','Pagina '+(index+1));
          b.onclick=function(){rail.scrollTo({left:(getComputedStyle(rail).direction==='rtl'?-1:1)*index*width,behavior:w.matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});};dots.appendChild(b);
        })(i);
      }
      var page=Math.min(count-1,Math.round(Math.abs(rail.scrollLeft)/width));
      Array.from(dots.children).forEach(function(b,index){b.setAttribute('aria-current',String(index===page));});
    }
    var size=new ResizeObserver(update);size.observe(rail);
    rail.addEventListener('scroll',update,{passive:true});
    rails.set(rail,{update:update,dots:dots,stop:function(){size.disconnect();rail.removeEventListener('scroll',update);dots.remove();}});update();
  }
  function refresh(){
    frame=0;
    rails.forEach(function(x,rail){if(!rail.isConnected){x.stop();rails.delete(rail);}});
    d.querySelectorAll('.rtg-edge-group,.rtg-adaptive-controls').forEach(function(rail){
      if(!rails.has(rail))setup(rail);else rails.get(rail).update();
    });
  }
  var observer=new MutationObserver(function(records){
    if(records.every(function(r){return r.target.closest&&r.target.closest('.rtg-edge-page-dots');}))return;
    if(!frame)frame=w.requestAnimationFrame(refresh);
  });
  var root=d.querySelector('.rtg-edge-chrome');
  if(root)observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','data-edge-face','data-catalogus-open','aria-hidden']});
  refresh();w.RTGEdgePages=Object.freeze({refresh:refresh});
  w.addEventListener('pagehide',function(e){if(e.persisted)return;observer.disconnect();rails.forEach(function(x){x.stop();});if(frame)w.cancelAnimationFrame(frame);});
}(window,document));
