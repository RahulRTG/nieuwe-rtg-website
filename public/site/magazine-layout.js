/* Finite horizontal leaf layout, keyboard paging and overflow entrances. Shares the reader's original state; never clones content. */
(function(w,d){
 'use strict';
 w.RTGPublicMagazineLayout=function(c){
  var s=c.state,a=c.actions,o=c.options;
  function fitLeaves(){
   s.fitFrame=0;if(s.home.hidden)return;
   s.cards.forEach(function(card){card.classList.remove('ds-issue-condensed');card.setAttribute('aria-labelledby',s.leafHeadings.get(card));card.scrollTop=0;});
   s.cards.forEach(function(card){if(card.scrollHeight>card.clientHeight+2||card.scrollWidth>card.clientWidth+2){card.classList.add('ds-issue-condensed');card.setAttribute('aria-labelledby',card.id+'-preview-title');}});
  }
  function scheduleFit(){if(!s.fitFrame)s.fitFrame=w.requestAnimationFrame(a.fitLeaves);}
  function closest(){
   var rect=s.track.getBoundingClientRect(),middle=rect.left+rect.width/2,best=Infinity,index=s.cardIndex;
   if(!rect.width)return index;
   s.cards.forEach(function(card,i){var r=card.getBoundingClientRect(),distance=Math.abs(r.left+r.width/2-middle);if(distance<best){best=distance;index=i;}});
   return index;
  }
  function paint(){
   if(s.home.hidden)return;
   var before=s.cardIndex;
   s.cardIndex=a.closest();s.previous.setAttribute('aria-disabled',String(s.cardIndex===0));s.forward.setAttribute('aria-disabled',String(s.cardIndex===s.cards.length-1));
   var label=(s.cardIndex+1)+' / '+s.cards.length;if(s.status.textContent!==label)s.status.textContent=label;
   s.caption.textContent=s.cards[s.cardIndex].dataset.issueLabel;
   a.scheduleSave();
   if(before!==s.cardIndex)a.readingChanged();
  }
  function move(index,instant){
   index=Math.max(0,Math.min(s.cards.length-1,index));s.requested=index;
   var bounds=s.track.getBoundingClientRect(),r=s.cards[index].getBoundingClientRect();
   s.track.scrollBy({left:r.left+r.width/2-(bounds.left+bounds.width/2),behavior:instant||w.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
   w.clearTimeout(s.settled);s.settled=w.setTimeout(function(){s.requested=null;a.paint();},500);
   if(instant)a.paint();
  }
  Object.assign(a,{fitLeaves:fitLeaves,scheduleFit:scheduleFit,closest:closest,paint:paint,move:move});
  return function mount(){
   s.cards.forEach(function(card,index){
   s.leafHeadings.set(card,card.getAttribute('aria-labelledby'));
   var preview=d.createElement('div'),kicker=d.createElement('p'),heading=d.createElement('h2'),open=d.createElement('button');
   preview.className='ds-issue-preview';kicker.className='ds-magazine-kicker';kicker.textContent='RTG JOURNAL · '+String(index+1).padStart(2,'0');
   heading.id=card.id+'-preview-title';heading.textContent=card.dataset.issueLabel;
   open.type='button';open.className='ds-magazine-textlink';open.textContent=card.id==='inhoudsopgave'?'Open de inhoud':'Open dit blad';open.dataset.readLeaf=card.id;
   preview.append(kicker,heading,open);card.append(preview);
  });
   s.imprint=d.createElement('button');
   s.imprint.type='button';
   s.imprint.className='ds-magazine-imprint';
   s.imprint.textContent='Info';
   s.imprint.setAttribute('aria-label','Open service, informatie en colofon');
   s.imprint.dataset.readLeaf='publicatie';
   d.querySelector('.ds-issue-topline').append(s.imprint);
   d.body.dataset.magazineView='cover';
   s.previous.addEventListener('click',function(){if(s.previous.getAttribute('aria-disabled')!=='true')a.next(-1);});
   s.forward.addEventListener('click',function(){if(s.forward.getAttribute('aria-disabled')!=='true')a.next(1);});
   s.track.addEventListener('scroll',function(){
   if(!s.frame)s.frame=w.requestAnimationFrame(function(){s.frame=0;a.paint();});
   w.clearTimeout(s.settled);s.settled=w.setTimeout(function(){s.requested=null;a.paint();},160);
  },{passive:true});
   s.track.addEventListener('pointerdown',function(){a.cancelReplay();s.requested=null;},{passive:true});
   s.track.addEventListener('wheel',a.cancelReplay,{passive:true});
   s.track.addEventListener('keydown',function(e){
   if(e.target!==s.track||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
   var rtl=w.getComputedStyle(s.track).direction==='rtl',index=s.requested===null?s.cardIndex:s.requested;
   if(e.key==='ArrowRight')index+=rtl?-1:1;
   else if(e.key==='ArrowLeft')index+=rtl?1:-1;
   else if(e.key==='Home')index=0;
   else if(e.key==='End')index=s.cards.length-1;
   else return;
   e.preventDefault();a.cancelReplay();a.move(index);
  });
   s.track.addEventListener('focusin',function(e){var leaf=e.target.closest('[data-issue-page]');if(leaf)a.move(s.cards.indexOf(leaf),true);});
   s.trackWidth=s.track.clientWidth;
   if(w.ResizeObserver)new w.ResizeObserver(function(){var width=s.track.clientWidth;if(width&&s.trackWidth&&width!==s.trackWidth&&!s.home.hidden)a.move(s.cardIndex,true);s.trackWidth=width;a.paint();a.scheduleFit();}).observe(s.track);
   w.addEventListener('resize',a.scheduleFit);
   if(w.visualViewport)w.visualViewport.addEventListener('resize',a.scheduleFit);
   new MutationObserver(a.scheduleFit).observe(d.documentElement,{attributes:true,attributeFilter:['style','class','dir']});
   if(d.fonts)d.fonts.ready.then(a.scheduleFit);
   d.querySelector('.ds-issue-controls').hidden=false;
  };
 };
})(window,document);
