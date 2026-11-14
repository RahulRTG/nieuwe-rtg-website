/* Public magazine articles: enhance their real DOM, never build a second article. */
(function (w,d) {
  'use strict';
  var source=d.querySelector('.world-shell'), P=w.RTGPublicPlatform;
  if(!source||!P)return;
  function readingChanged(){w.dispatchEvent(new CustomEvent('rtg-public-reading-change'));}
  function readingTitle(el){var h=el.querySelector(':scope > summary,h1,h2');return h?(h.innerText||h.textContent).replace(/\s+/g,' ').trim():d.title;}
  // The reel owns its index; native details own their open state. This getter
  // only reads those owners and returns their original nodes, never a copy.
  var pageContext=function(){var el=source.querySelector('.world-hero,.explore-intro')||source;return {node:el,id:el.id||el.getAttribute('aria-labelledby')||'pagina',title:readingTitle(el),kind:'page',index:0,total:1};};
  function context(){
    var page=pageContext(),opened=Array.from(source.querySelectorAll('.ds-volume-library[open],.ds-volume-colophon[open]'));
    var anchor=w.innerHeight/3,article=opened.reduce(function(best,el){var r=el.getBoundingClientRect(),distance=r.top>anchor?r.top-anchor:r.bottom<anchor?anchor-r.bottom:0;return !best||distance<best.distance?{node:el,distance:distance}:best;},null);
    return article?{node:article.node,id:article.node.id,title:readingTitle(article.node),kind:'article',index:page.index,total:page.total}:page;
  }
  w.RTGPublicDetail={context:context};
  function node(tag,cls,text){var e=d.createElement(tag);e.className=cls||'';if(text)e.textContent=text;return e;}
  function link(label,url){var a=node('a','',label);a.setAttribute('href',url);return a;}
  var base=P.asset(), brand=source.querySelector('.ds-brand-mark');
  var home=brand?brand.href:new URL('../',base).href;
  var head=source.querySelector('.world-header,.explore-header')||node('header');
  var language=source.querySelector('[data-language-picker]');
  var original=node('nav','ds-public-page-actions');original.hidden=true;
  original.setAttribute('aria-label','Op deze pagina');original.dataset.publicPageActions='';
  head.querySelectorAll('a').forEach(function(a){if(a!==brand)original.append(a);});
  /* Explore's real search input and its listener move together, not a copy. */
  var search=head.querySelector('label');
  if(search){var searchBox=node('div','ds-public-search');searchBox.append(search);source.querySelector('.world-orbit').before(searchBox);}
  if(!brand)brand=P.brand(home);
  if(!language){language=node('button','','Taal');language.type='button';language.setAttribute('aria-label','Taal kiezen');language.onclick=function(){if(w.RTGi18n)w.RTGi18n.openModal();};}
  language.className='ds-public-language';
  var navigation=node('nav','ds-public-site-nav');navigation.setAttribute('aria-label','Hoofdnavigatie');
  [['Reizen','#reisverhaal'],['Lifestyle','#goedeleven'],['Ondernemen','#ondernemen'],['Lidmaatschap','#passen']].forEach(function(row){navigation.append(link(row[0],home+row[1]));});
  var tools=node('div','ds-brand-lockup-header__actions'),menu=node('button','ds-public-menu-button','Menu');
  menu.type='button';menu.dataset.publicMenu='';menu.setAttribute('aria-label','Menu openen');menu.setAttribute('aria-expanded','false');
  tools.append(language,menu);head.className='ds-brand-lockup-header ds-public-site-header';head.replaceChildren(brand,navigation,tools);
  source.before(head);source.append(original);
  source.querySelectorAll('h2').forEach(function(h,i){if(!h.id)h.id='onderdeel-'+i;original.append(link(h.textContent,'#'+h.id));});
  d.body.dataset.publicPlatform='detail';
  /* Paint leads. A single supporting photograph remains at its existing moment. */
  var moment=source.querySelector('.moment-visual');
  var image={living:'living-table-story',travel:'discover-travel',work:'discover-work',foundation:'foundation-family'}[d.body.dataset.world];
  if(moment&&image&&!moment.querySelector('img')){var img=document.createElement('img');img.src=new URL('images/editorial/'+image+'.webp',base).href;img.alt='';img.width=1448;img.height=1086;img.loading='lazy';img.decoding='async';moment.append(img);moment.setAttribute('aria-hidden','true');var credit=node('p','ds-public-image-credit','RTG-sfeerbeeld · AI-gegenereerd');moment.after(credit);}

  /* The folio only scrolls itself. No wheel interception, autoplay, duplicate
     content or hidden slides. Touch and no-JS keep the native scroll surface. */
  source.querySelectorAll('[data-editorial-reel]').forEach(function(reel){
    var track=reel.querySelector('[data-reel-track]'),pages=Array.from(reel.querySelectorAll('[data-reel-page]'));
    var previous=reel.querySelector('[data-reel-prev]'),next=reel.querySelector('[data-reel-next]'),status=reel.querySelector('[data-reel-status]');
    if(!track||pages.length<2||!previous||!next||!status)return;
    var current=0,requested=null,frame=0,settled;
    pageContext=function(){var el=pages[current];return {node:el,id:el.id||'blad-'+(current+1),title:readingTitle(el),kind:'page',index:current,total:pages.length};};
    function closest(){
      var bounds=track.getBoundingClientRect(),center=bounds.left+bounds.width/2;
      return pages.reduce(function(best,page,index){
        var r=page.getBoundingClientRect(),distance=Math.abs(r.left+r.width/2-center);
        return distance<best.distance?{index:index,distance:distance}:best;
      },{index:0,distance:Infinity}).index;
    }
    function paint(){
      var before=current;
      current=closest();
      previous.setAttribute('aria-disabled',String(current===0));
      next.setAttribute('aria-disabled',String(current===pages.length-1));
      var text=(current+1)+' / '+pages.length;
      if(status.textContent!==text)status.textContent=text;
      if(before!==current)readingChanged();
    }
    function move(index){
      index=Math.max(0,Math.min(pages.length-1,index));requested=index;
      var bounds=track.getBoundingClientRect(),r=pages[index].getBoundingClientRect();
      track.scrollBy({left:r.left+r.width/2-(bounds.left+bounds.width/2),behavior:w.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      w.clearTimeout(settled);settled=w.setTimeout(function(){requested=null;paint();},500);
    }
    previous.addEventListener('click',function(){if(previous.getAttribute('aria-disabled')!=='true')move((requested===null?current:requested)-1);});
    next.addEventListener('click',function(){if(next.getAttribute('aria-disabled')!=='true')move((requested===null?current:requested)+1);});
    track.addEventListener('keydown',function(e){
      if(e.target!==track||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
      var rtl=w.getComputedStyle(track).direction==='rtl',index=requested===null?current:requested;
      if(e.key==='ArrowRight')index+=rtl?-1:1;
      else if(e.key==='ArrowLeft')index+=rtl?1:-1;
      else if(e.key==='Home')index=0;
      else if(e.key==='End')index=pages.length-1;
      else return;
      e.preventDefault();move(index);
    });
    track.addEventListener('scroll',function(){
      if(!frame)frame=w.requestAnimationFrame(function(){frame=0;paint();});
      w.clearTimeout(settled);settled=w.setTimeout(function(){requested=null;paint();},160);
    },{passive:true});
    track.addEventListener('pointerdown',function(){requested=null;},{passive:true});
    // Tabbing into another leaf must reveal that leaf without scrolling the
    // document or changing the focus target. Forms keep their own arrow keys.
    track.addEventListener('focusin',function(e){
      var page=e.target.closest('[data-reel-page]');if(!page)return;
      var bounds=track.getBoundingClientRect(),r=page.getBoundingClientRect();
      track.scrollBy({left:r.left+r.width/2-(bounds.left+bounds.width/2),behavior:'instant'});
      requested=null;paint();
    });
    if(w.ResizeObserver)new w.ResizeObserver(function(){paint();}).observe(track);
    reel.querySelector('[data-reel-controls]').hidden=false;paint();
  });

  /* A short editorial front must not make the actual detail unreachable.
     Open the original details on direct links, reload and browser history. */
  if(d.body.classList.contains('ds-public-volume')){
    function reveal(hash,focus,scroll){
      var id;try{id=decodeURIComponent(hash.replace(/^#/,''));}catch(_){return;}
      var target=d.getElementById(id);if(!target)return;
      if(id==='verhaal')source.querySelectorAll('.ds-volume-library,.ds-volume-colophon').forEach(function(detail){detail.open=false;});
      var details=target.closest('details');
      while(details){details.open=true;details=details.parentElement.closest('details');}
      // Synchronous focus cannot arrive one frame late and steal focus from
      // the next link a keyboard user has already reached.
      if(scroll)target.scrollIntoView({block:'start',behavior:'instant'});
      if(focus){var f=target.matches('details')?target.querySelector('summary'):target;if(!f.hasAttribute('tabindex')&&!f.matches('a,button,input,select,summary'))f.setAttribute('tabindex','-1');f.focus({preventScroll:true});}
      w.requestAnimationFrame(readingChanged);
    }
    d.addEventListener('click',function(e){
      var a=e.target.closest('a[href]');if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
      var url=new URL(a.href,w.location.href);
      if(url.origin===w.location.origin&&url.pathname===w.location.pathname&&url.hash)reveal(url.hash,true,false);
    });
    w.addEventListener('hashchange',function(){reveal(w.location.hash,true,true);});
    source.addEventListener('toggle',function(e){if(e.target.matches('.ds-volume-library,.ds-volume-colophon'))readingChanged();},true);
    reveal(w.location.hash,false,true);
  }
})(window,document);
