(function(g,factory){
'use strict';
var api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
if(g)g.RTGEditorialV4Header=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function adopt(doc,header,legacy){
  if(!header||!legacy||legacy===header)return;
  var actions=header.querySelector('.rtg-v4-header-actions');
  if(!actions)return;
  var bucket=actions.querySelector('.rtg-v4-route-actions');
  var nodes=Array.from(legacy.children).filter(function(node){
    if(!node.matches)return false;
    if(node.matches('nav,form,[role="tablist"],button,input,select,textarea,.zoekbalk,.tabs,.standen,.rtg-rahul-tab,[aria-live]'))return true;
    return !node.matches('h1,h2,h3,.ey,.rek,.sp')&&!!node.querySelector('button,input,select,textarea');
  });
  if(!nodes.length)return;
  if(!bucket){bucket=doc.createElement('div');bucket.className='rtg-v4-route-actions';actions.insertBefore(bucket,actions.firstChild);}
  nodes.forEach(function(node){bucket.appendChild(node);});
}
return Object.freeze({adopt:adopt});
}));
