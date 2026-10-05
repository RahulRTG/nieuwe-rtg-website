/* Shared public projection of the world-home layout. No identity runtime or private data. */
(function(w,d){
 'use strict';
 var D=w.RTGPublicContent;
 function copy(key){var pair=D.words[key]||[key,key];return w.RTGi18n?w.RTGi18n.t('public.'+key,pair[0]):pair[0];}
 function node(tag,key,cls){var el=d.createElement(tag);if(cls)el.className=cls;if(key){el.dataset.i18n='public.'+key;el.dataset.i18nSource=(D.words[key]||[key])[0];el.textContent=copy(key);}return el;}
 function icon(name){var el=node('span',null,'wd-icon');el.setAttribute('aria-hidden','true');el.innerHTML='<svg viewBox="0 0 24 24">'+((w.RTGEdgeIcons||{})[name]||w.RTGEdgeIcons.grid)+'</svg>';return el;}
 function button(key,run,cls){var el=node('button',null,cls||'pp-button');if(key)el.append(node('span',key));el.type='button';el.addEventListener('click',run);return el;}
 function photo(path,cls,eager){var img=node('img',null,cls),file=/\.[a-z0-9]+$/i.test(path)?path:path+'.webp';img.src=new URL('images/'+file,asset()).href;img.alt='';img.loading=eager?'eager':'lazy';if(eager)img.fetchPriority='high';return img;}
 function asset(){var meta=d.querySelector('meta[name="rtg-asset-base"]');return new URL(((meta&&meta.content)||'/').replace(/\/?$/,'/'),d.baseURI);}
 function lips(){var el=node('span',null,'pp-lips');el.setAttribute('aria-hidden','true');el.innerHTML='<svg class="rtg-adaptive-lips" viewBox="0 0 100 58"><path d="M2 30C18 28 30 18 43 10C48 7 52 13 56 15C60 13 65 7 70 10C82 18 91 27 98 30C80 34 68 34 55 31C42 34 23 35 2 30Z"/><path d="M3 31C22 34 39 33 55 31C71 34 84 34 97 31C85 42 73 51 55 52C36 50 17 42 3 31Z"/><path d="M8 31C25 35 40 33 55 31C70 34 83 34 92 31"/></svg>';return el;}
 function frontDoor(company,copy){var out={signal:null,world:null,count:null};if(company)return out;var meta=d.querySelector('meta[name="rtg-app-base"]'),secure=node('a','secureOpen','pp-secure-link'),root=new URL(meta&&meta.content?meta.content:'/',d.baseURI).href;secure.href=new URL('apps/app.html',root).href;copy.append(secure);var signal=node('p',null,'pp-technology-signal'),world=node('strong'),count=node('span','currentMap'),label=node('small',null,'pp-signal-label');label.textContent='RTG / SOCIAL TECHNOLOGY';signal.append(node('span',null,'pp-signal-pulse'),label,world,count);out.signal=signal;out.world=world;out.count=count;return out;}
 function desktop(){var script=d.createElement('script');script.src=new URL('shared/interface/world-desktop-copy.js',asset()).href;script.async=false;d.head.appendChild(script);}
 w.RTGPublicPlatform={node:node,icon:icon,button:button,copy:copy,photo:photo,lips:lips,asset:asset,frontDoor:frontDoor,desktop:desktop};
})(window,document);
