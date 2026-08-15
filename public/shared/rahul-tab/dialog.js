/* Een app-dialoog heeft voorrang op de globale Rahul-tab. */
(function(w,d){
  'use strict';
  var z=w.__rahulTabDialoog;
  if(!z)return;
  function wijk(){
    var vensters=d.querySelectorAll('[role="dialog"],[aria-modal="true"],dialog[open]'),open=false;
    for(var i=0;i<vensters.length;i++){
      var v=vensters[i];
      if(v!==z.page&&!v.hidden&&v.getClientRects().length){open=true;break}
    }
    if(z.tab.hidden!==open)z.tab.hidden=open;
  }
  if(w.MutationObserver)new MutationObserver(wijk).observe(d.body,{subtree:true,childList:true,
    attributes:true,attributeFilter:['class','hidden','style','open','role','aria-modal']});
  wijk();
})(window,document);
