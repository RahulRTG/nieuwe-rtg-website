/* Adapt the existing message/call controls; do not own messages, media,
   permissions, timing or success state. No new transport lives here. */
(function(w,d){
  'use strict';
  var release=null, kind=null, wrapper=null, originals=[];
  function restore(){
    if(release)release();release=null;kind=null;
    originals.forEach(function(x){x.parent.insertBefore(x.node,x.next&&x.next.parentNode===x.parent?x.next:null);});
    originals=[];if(wrapper)wrapper.remove();wrapper=null;
    delete d.body.dataset.rtgCommunication;
  }
  function take(node,parent){originals.push({node:node,parent:node.parentNode,next:node.nextSibling});(parent||wrapper).appendChild(node);}
  function sync(){
    var edge=w.RTGAdaptiveEdge;if(!edge||!edge.mountSurface)return;
    var call=d.getElementById('callScreen'), thread=d.getElementById('draad');
    var next=call&&call.classList.contains('open')?'call':thread&&!thread.hidden&&d.body.dataset.pane==='draad'?'chat':null;
    if(next===kind)return;
    restore();if(!next)return;
    wrapper=d.createElement('div');wrapper.className='rtg-communication-controls';
    d.body.appendChild(wrapper);
    if(next==='chat'){
      take(d.getElementById('antwoordop'));take(d.getElementById('invoerrij'));
      // Keep the original assist actions available to Edge while their old
      // composer is hidden. The owned strip itself remains visually hidden.
      take(d.querySelector('.invoer .hulprij'),d.body);
    }else{
      take(call.querySelector('.cs-top'));take(call.querySelector('.cs-foot'));
    }
    release=edge.mountSurface(wrapper,{kind:next});
    if(!release){restore();return;}
    kind=next;d.body.dataset.rtgCommunication=next;
  }
  var observer=new MutationObserver(sync);
  observer.observe(d.body,{attributes:true,attributeFilter:['data-pane']});
  var call=d.getElementById('callScreen');
  if(call)observer.observe(call,{attributes:true,attributeFilter:['class']});
  w.addEventListener('rtg-adaptive-ready',sync);sync();
  w.addEventListener('pagehide',function(e){if(e.persisted)return;observer.disconnect();restore();w.removeEventListener('rtg-adaptive-ready',sync);});
}(window,document));
