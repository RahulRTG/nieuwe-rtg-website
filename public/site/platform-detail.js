/* Public articles use the same geometry as the app; all article nodes stay live. */
(function (w,d) {
  'use strict';
  var source=d.querySelector('.world-shell'), P=w.RTGPublicPlatform;
  if(!source||!P)return;
  function node(tag,cls,text){var e=d.createElement(tag);e.className=cls||'';if(text)e.textContent=text;return e;}
  function link(label,url){var a=node('a','wd-person',label);a.setAttribute('href',url);return a;}
  var world=d.body.dataset.rtgWorld||'living', base=P.asset();
  var publicWorld=['living','travel','work','foundation'].includes(d.body.dataset.world)&&!d.body.dataset.pass;
  if(publicWorld)d.body.dataset.publicWorld=world;
  var root=node('div','wd-shell pp-detail-shell ds-beleving'), head=node('header','rtg-edge-top pp-header pp-detail-header ds-beleving-kop');
  root.dataset.dsBeleving='publiek';
  var brand=P.brand();brand.href=new URL('../',base).href;head.dataset.publicWorld='living';head.append(brand);
  /* De taalknop van de pagina VERHUIST naar de nieuwe kop in plaats van te worden
     nagebouwd: .world-header staat hier op display:none, en een kopie zonder
     data-language-picker liet de echte (door i18n.js gebonden) knop onbereikbaar achter. */
  var language=source.querySelector('[data-language-picker]');
  if(language){language.classList.remove('login-link','language-link');language.classList.add('pp-icon-button','pp-language');}
  else{language=node('button','pp-icon-button pp-language','Taal');language.type='button';language.setAttribute('data-language-picker','');language.setAttribute('data-language-picker-ready','true');language.setAttribute('aria-label','Taal kiezen');language.onclick=function(){w.RTGi18n.openModal();};}
  head.append(node('span','pp-context','Ontdek RTG'),language);
  var appEntry=source.querySelector('[data-public-cover] .world-actions a');
  if(appEntry){var appLink=appEntry.cloneNode(true);appLink.className='ds-beleving-appkort pp-profile';head.append(appLink);}
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
  var hero=source.querySelector('.world-hero,[data-public-cover]'), image=getComputedStyle(d.body).getPropertyValue('--world-image').trim();
  var fallback=publicWorld?'images/worlds/owner-20261114/'+world+'.jpg':{community:'images/editorial/moment-family-support.webp',rtg:'images/editorial/living-home.webp','business-lite':'images/editorial/company-opportunity.webp',business:'images/editorial/company-control.webp',lifestyle:'images/editorial/moment-dinner.webp',tech:'images/editorial/company-technology.webp'}[d.body.dataset.pass||d.body.dataset.world];
  if(hero&&!hero.querySelector('.ds-reiscover__beeld')&&(fallback||/^url\(/.test(image))){var picture=node('div',hero.hasAttribute('data-public-cover')?'ds-reiscover__beeld':'wp-photo ds-beleving__beeld'),img=document.createElement('img');img.src=fallback?new URL(fallback,base).href:image.slice(4,-1).replace(/^['"]|['"]$/g,'');img.alt=publicWorld?{living:'Terras met uitzicht op de Griekse zee',travel:'Een hand op de armsteun van een roodleren auto-interieur',work:'Warm kantoor met planten en avondlicht',foundation:'Samen in de avondzon, met een rood gekostumeerd figuur'}[world]:'';img.fetchPriority='high';picture.appendChild(img);hero.appendChild(picture);}
})(window,document);
