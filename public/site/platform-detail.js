/* Public articles use the same geometry as the app; all article nodes stay live. */
(function (w,d) {
  'use strict';
  var source=d.querySelector('.world-shell'), P=w.RTGPublicPlatform;
  if(!source||!P)return;
  function node(tag,cls,text){var e=d.createElement(tag);e.className=cls||'';if(text)e.textContent=text;return e;}
  function link(label,url){var a=node('a','wd-person',label);a.href=url;return a;}
  var world=d.body.dataset.rtgWorld||'living', base=P.asset();
  var root=node('div','wd-shell pp-detail-shell'), head=node('header','rtg-edge-top pp-header pp-detail-header');
  head.append(link('RTG',new URL('../',base).href));head.firstChild.className='rtg-edge-mark pp-brand';
  /* De taalknop van de pagina VERHUIST naar de nieuwe kop in plaats van te worden
     nagebouwd: .world-header staat hier op display:none, en een kopie zonder
     data-language-picker liet de echte (door i18n.js gebonden) knop onbereikbaar achter. */
  var language=source.querySelector('[data-language-picker]');
  if(language)language.classList.add('pp-icon-button','pp-language');
  else{language=node('button','pp-icon-button pp-language','Taal');language.type='button';language.setAttribute('data-language-picker','');language.setAttribute('data-language-picker-ready','true');language.setAttribute('aria-label','Taal kiezen');language.onclick=function(){w.RTGi18n.openModal();};}
  head.append(node('span','pp-context','Ontdek RTG'),language);
  var greeting=node('header','wd-greeting'), title=source.querySelector('h1');
  greeting.append(node('h1','',title?title.textContent:d.title));
  var left=node('nav','wd-people'), right=node('nav','wd-favorites'), library=node('nav','wd-library');
  left.setAttribute('aria-label','RTG werelden');right.setAttribute('aria-label','Op deze pagina');library.setAttribute('aria-label','Verder ontdekken');
  left.append(node('h2','','Werelden'));right.append(node('h2','','Op deze pagina'));
  [['LivingOS','livingos'],['TravelOS','travelos'],['WorkOS','workos'],['FoundationOS','foundationos']].forEach(function(row){left.append(link(row[0],new URL('site/werelden/'+row[1]+'.html',base).href));});
  source.querySelectorAll('h2').forEach(function(h,i){if(!h.id)h.id='onderdeel-'+i;right.append(link(h.textContent,'#'+h.id));});
  library.append(link('Ontdek RTG',new URL('../',base).href),link('Vergelijk de passen',new URL('../#passen',base).href));
  source.before(head,root);source.classList.add('wd-home');root.append(greeting,left,source,right,library);
  d.body.dataset.publicPlatform='detail';d.body.dataset.rtgDesktop=world;d.body.dataset.rtgDesktopState='ready';d.body.dataset.rtgLayout='standard';
  var hero=source.querySelector('.world-hero'), image=getComputedStyle(d.body).getPropertyValue('--world-image').trim();
  if(hero && /^url\(/.test(image)){var picture=node('div','wp-photo'), img=d.createElement('img');img.src=image.slice(4,-1).replace(/^['"]|['"]$/g,'');img.alt='';picture.appendChild(img);hero.appendChild(picture);}
  ['interface/world-desktop-copy.js'].forEach(function(file){var script=d.createElement('script');script.src=new URL('shared/'+file,base).href;script.async=false;d.head.appendChild(script);});
})(window,document);
