/* Shared public projection of the world-home layout. No identity runtime or private data. */
(function(w,d){
 'use strict';
 var D=w.RTGPublicContent;
 function copy(key){var pair=D.words[key]||[key,key];return w.RTGi18n?w.RTGi18n.t('public.'+key,pair[0]):pair[0];}
 function node(tag,key,cls){var el=d.createElement(tag);if(cls)el.className=cls;if(key){el.dataset.i18n='public.'+key;el.dataset.i18nSource=(D.words[key]||[key])[0];el.textContent=copy(key);}return el;}
 function icon(name){var el=node('span',null,'wd-icon');el.setAttribute('aria-hidden','true');el.innerHTML='<svg viewBox="0 0 24 24">'+((w.RTGEdgeIcons||{})[name]||w.RTGEdgeIcons.grid)+'</svg>';return el;}
 function arrow(){var el=node('span',null,'ds-beleving-pijl');el.setAttribute('aria-hidden','true');el.textContent='↗';return el;}
 function button(key,run,cls){var el=node('button',null,cls||'pp-button');if(key)el.append(node('span',key));if(cls==='ds-beleving-link')el.append(arrow());el.type='button';el.addEventListener('click',run);return el;}
 function photo(path,cls,eager){var img=document.createElement('img'),file=/\.[a-z0-9]+$/i.test(path)?path:path+'.webp';if(cls)img.className=cls;img.src=new URL('images/'+file,asset()).href;img.alt='';img.loading=eager?'eager':'lazy';if(eager)img.fetchPriority='high';return img;}
 function asset(){var meta=d.querySelector('meta[name="rtg-asset-base"]');return new URL(((meta&&meta.content)||'/').replace(/\/?$/,'/'),d.baseURI);}
 function brand(){var a=node('a',null,'rtg-edge-mark pp-brand ds-beleving-merk'),img=photo('brand/owner-20261114/lips.jpg',null,true);img.alt='RTG';img.width=96;img.height=64;a.append(img);return a;}
 function brandEdge(root){
  root.classList.add('ds-beleving-bediening');root.dataset.publicWorld='living';
  function paint(){
   root.querySelectorAll('svg.rtg-adaptive-lips').forEach(function(svg){svg.replaceWith(photo('brand/owner-20261114/lips.jpg','ds-beleving-edge-merk',true));});
   var bar=root.querySelector('.rtg-adaptive-bar');if(!bar)return;
   bar.classList.add('ds-beleving-edgebar');
   if(!bar.querySelector('.ds-beleving-edgeverf')){var texture=photo('brand/edge-painted-20261114/texture.jpg','ds-beleving-edgeverf',true);texture.setAttribute('aria-hidden','true');bar.append(texture);}
   bar.querySelectorAll('.rtg-adaptive-item-copy,.rtg-adaptive-deck-dots').forEach(function(label){label.remove();});
   bar.querySelectorAll('svg:not([data-public-icon])').forEach(function(svg){
    var action=svg.closest('button').dataset.rtgAdaptiveAction,icons=w.RTGEdgeIcons;
    if(action==='worlds')svg.innerHTML='<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>';
    else if(action==='context'&&icons)svg.innerHTML=icons.book;
    svg.dataset.publicIcon='true';
   });
  }
  new MutationObserver(paint).observe(root,{childList:true,subtree:true});paint();
 }
 function lips(){var el=node('span',null,'pp-lips');el.setAttribute('aria-hidden','true');el.innerHTML='<svg class="rtg-adaptive-lips" viewBox="0 0 100 58"><path d="M2 30C18 28 30 18 43 10C48 7 52 13 56 15C60 13 65 7 70 10C82 18 91 27 98 30C80 34 68 34 55 31C42 34 23 35 2 30Z"/><path d="M3 31C22 34 39 33 55 31C71 34 84 34 97 31C85 42 73 51 55 52C36 50 17 42 3 31Z"/><path d="M8 31C25 35 40 33 55 31C70 34 83 34 92 31"/></svg>';return el;}
 function appLink(cls,key){var meta=d.querySelector('meta[name="rtg-app-base"]'),link=node('a',null,cls),root=new URL(meta&&meta.content?meta.content:'/',d.baseURI).href;link.append(node('span',key||'secureOpen'),arrow());link.href=new URL('apps/app.html',root).href;return link;}
 function frontDoor(company,target){var out={signal:null,world:null,count:null};if(company)return out;target.insertBefore(appLink('pp-secure-link ds-beleving-app'),target.lastElementChild);return out;}
 /* De kopietaal is een statische documentafhankelijkheid. Alle hosts laden
    haar vóór platform-shell/detail; zo blijft de volgorde zichtbaar in HTML
    en ontstaat geen tweede runtime-loader met een berekende basis. */
 function desktop(){return w.RTGDesktopUI||null;}
 function editorial(feature,heading){
  feature.classList.add('ds-beleving-intro--reis');feature.dataset.publicWorld='travel';
  var frame=feature.querySelector('.ds-beleving-intro__beeld'),image=frame.querySelector('img');image.width=1672;image.height=941;
  heading.classList.add('ds-beleving-manifest');
  var ribbon=photo('brand/owner-20261114/brush-ribbon.jpg','ds-beleving-penseel');ribbon.width=1280;ribbon.height=426;heading.prepend(ribbon);
  var signature=node('section',null,'ds-beleving-signatuur'),art=photo('brand/owner-20261114/brush-orbit.jpg'),text=node('div');art.width=960;art.height=1200;text.append(node('span','artCaption','ds-beleving-kunstbijschrift'),node('h2','signatureTitle'),node('p','signatureBody'));signature.append(art,text);heading.parentElement.append(signature);
 }
 w.RTGPublicPlatform={node:node,icon:icon,button:button,copy:copy,photo:photo,lips:lips,asset:asset,brand:brand,brandEdge:brandEdge,frontDoor:frontDoor,desktop:desktop,appLink:appLink,editorial:editorial};
})(window,document);
