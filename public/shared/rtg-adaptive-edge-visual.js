/* Beeldlaag voor dezelfde ene Edge. Zij presenteert apps, het actieve object
   en communicatiestaten, maar voert geen domeinhandeling zelfstandig uit. */
(function (w, d) {
  'use strict';
  if (w.RTGAdaptiveEdgeVisual) return;
  var active = null;
  var ROUTES = Object.freeze({
    'app:travel':'/apps/reizen.html', 'app:media':'/apps/media.html',
    'app:photos':'/apps/galerij.html', 'app:settings':'/apps/instellingen.html'
  });
  var APP_VISUAL = Object.freeze({
    'app:travel':['travel','/images/editorial/travel-inspiration.webp'],
    'app:media':['media','/images/music/rtg-sound-hero-v1.jpg'],
    'app:photos':['photos','/images/editorial/camera-studio.webp'],
    'app:settings':['settings','']
  });
  var GLYPHS = Object.freeze({
    bookmark:'<path d="M7 4h10v16l-5-3.4L7 20Z"/>', heart:'<path d="M20 8.7c0 4.7-8 10.3-8 10.3S4 13.4 4 8.7C4 6.1 5.8 4.5 8.1 4.5c1.6 0 3 .8 3.9 2 1-1.2 2.3-2 3.9-2C18.2 4.5 20 6.1 20 8.7Z"/>',
    share:'<circle cx="18" cy="5" r="2.2"/><circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="m8 11 8-5m-8 7 8 5"/>',
    trash:'<path d="M5 7h14M9 7V4h6v3m2 0-1 13H8L7 7m3 4v5m4-5v5"/>',
    phone:'<path d="M7.5 4.5 10 8 8.2 10c1.2 2.5 3.3 4.6 5.8 5.8l2-1.8 3.5 2.5-.7 3c-.2.9-1.1 1.5-2 1.4C9.5 20.1 3.9 14.5 3.1 7.2 3 6.3 3.6 5.4 4.5 5.2Z"/>',
    hangup:'<path d="M5 15.5c4.4-3.4 9.6-3.4 14 0l-2.1 3.2-3-1.5v-2.1c-1.3-.3-2.5-.3-3.8 0v2.1l-3 1.5Z"/>',
    mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21m-4 0h8"/>',
    speaker:'<path d="M5 10h4l5-4v12l-5-4H5Zm12-1c1 1 1 5 0 6m2-8c2.3 2.6 2.3 7.4 0 10"/>',
    send:'<path d="m4 5 17 7-17 7 3-7Zm3 7h14"/>',
    chat:'<path d="M4 5h16v12H9l-5 4Z"/>', mail:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m5 7 7 6 7-6"/>'
  });
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char];
    });
  }
  function visible(node) {
    if (!node || !node.getBoundingClientRect) return false;
    var box=node.getBoundingClientRect(), style=w.getComputedStyle(node);
    return box.width>50 && box.height>40 && style.display!=='none' && style.visibility!=='hidden';
  }
  function fallbackPhoto() {
    var world=d.body&&d.body.dataset.rtgWorld;
    return ({travel:'/images/editorial/travel-inspiration.webp',work:'/images/editorial/team-room.webp',foundation:'/images/editorial/foundation-family.webp'})[world] || '/images/editorial/living-home.webp';
  }
  function photo() {
    var image=Array.from(d.querySelectorAll('main img[src],picture img[src],[data-rtg-screen-root] img[src]')).find(visible);
    if (image) return image.currentSrc || image.src;
    var hero=Array.from(d.querySelectorAll('.dagkop,.prestatiekop,.wk-hero,.fo-hero,.hero,[data-rtg-component="EditorialHero"]')).find(visible);
    if (hero) {
      var match=w.getComputedStyle(hero).backgroundImage.match(/url\(["']?([^"')]+)/);
      if (match) return match[1];
    }
    return fallbackPhoto();
  }
  function glyph(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(GLYPHS[name]||'')+'</svg>'; }
  function markup(action, fallback) {
    var app=APP_VISUAL[action];
    if (app) return '<span class="rtg-edge-app-icon rtg-edge-app-icon--'+app[0]+'">'+
      (app[1]?'<img src="'+esc(app[1])+'" alt="">':'')+fallback+'</span>';
    if (action==='object') return '<span class="rtg-edge-object-thumb"><img src="'+esc(photo())+'" alt=""></span>';
    if (action==='contact') return '<span class="rtg-edge-contact-thumb"><img src="/images/editorial/discover-living.webp" alt=""></span>';
    return '';
  }
  function destination(action) { return ROUTES[action] || ''; }
  function edgeButton(doc, spec, slot, icon, services, detail, execute) {
    var node=doc.createElement('button'); node.type='button'; node.className='rtg-adaptive-item';
    node.dataset.rtgAdaptiveSlot=slot; node.dataset.rtgAdaptiveAction=spec[0]; node.setAttribute('aria-label',spec[1]);
    node.innerHTML=(markup(spec[0],icon(spec[3]))||(spec[0]==='ai'?services.lips():icon(spec[3])))+'<span class="rtg-adaptive-item-copy"><small>'+services.escape(spec[0]==='ai'?'Vraag of regel iets':spec[2]||spec[1])+'</small><b>'+services.escape(detail(spec[0]))+'</b></span>';
    node.onclick=function(){execute(spec[0]);}; return node;
  }
  function emit(kind, action, node) {
    var values={};
    if (node && node.closest) {
      var root=node.closest('.rtg-edge-live');
      if (root) root.querySelectorAll('input[name]').forEach(function(field){values[field.name]=field.value;});
    }
    w.dispatchEvent(new w.CustomEvent('rtg-edge-visual-action', { detail:{kind:kind,action:action,value:node&&node.value||'',values:values} }));
  }
  function button(label, action, kind, className, iconName) {
    var node=d.createElement('button'); node.type='button'; node.className=className||'';
    node.setAttribute('aria-label',label); node.innerHTML=glyph(iconName); node.onclick=function(){emit(kind,action,node);}; return node;
  }
  function input(label, name, value) {
    var node=d.createElement('input'); node.name=name; node.value=value||''; node.placeholder=label; node.setAttribute('aria-label',label); return node;
  }
  function present(spec) {
    spec=spec||{}; var kind=String(spec.kind||'object'); close();
    if (!w.RTGAdaptiveEdge || !w.RTGAdaptiveEdge.mountSurface) return false;
    var node=d.createElement('div'); node.className='rtg-edge-live rtg-edge-live--'+kind;
    if (/call/.test(kind)) {
      var avatar=d.createElement('span'); avatar.className='rtg-edge-live__avatar'; avatar.style.setProperty('--rtg-edge-avatar','url("'+esc(spec.avatar||'/images/editorial/discover-living.webp')+'")');
      var copy=d.createElement('span'); copy.className='rtg-edge-live__copy'; copy.innerHTML='<b>'+esc(spec.name||'Amira')+'</b><small>'+esc(spec.duration||(/active/.test(kind)?'00:00':'Inkomende oproep'))+'</small>';
      if (kind==='incoming-call') node.append(avatar,copy,mouth(),button('Weigeren','decline',kind,'rtg-edge-live__danger','hangup'),button('Opnemen','accept',kind,'rtg-edge-live__accept','phone'));
      else node.append(avatar,copy,button('Microfoon','microphone',kind,'rtg-edge-live__icon','mic'),mouth(),button('Luidspreker','speaker',kind,'rtg-edge-live__icon','speaker'),button('Ophangen','decline',kind,'rtg-edge-live__danger','hangup'));
    } else if (kind==='mail') {
      node.append(mark('mail'),input('Aan:','to',spec.to),mouth(),input('Onderwerp:','subject',spec.subject),button('Verstuur','send',kind,'rtg-edge-live__send','send'));
    } else if (kind==='chat') {
      node.append(mark('chat'),input('Bericht','message',spec.message),mouth(),button('Verstuur','send',kind,'rtg-edge-live__send','send'));
    } else {
      var thumb=d.createElement('span'); thumb.className='rtg-edge-object-thumb'; thumb.style.setProperty('--rtg-edge-object','url("'+esc(spec.image||photo())+'")');
      node.append(thumb,button('Bewaar','save',kind,'rtg-edge-live__icon','bookmark'),button('Favoriet','favorite',kind,'rtg-edge-live__icon','heart'),mouth(),button('Deel','share',kind,'rtg-edge-live__icon','share'),button('Verwijder','delete',kind,'rtg-edge-live__icon','trash'));
    }
    d.body.appendChild(node); var release=w.RTGAdaptiveEdge.mountSurface(node,{kind:kind,mouth:false});
    if (!release) { node.remove(); return false; }
    active={node:node,release:release}; return true;
  }
  function mouth() {
    var node=d.createElement('button'); node.type='button'; node.className='rtg-edge-live__mouth'; node.setAttribute('aria-label','Praat met Rahul');
    node.innerHTML=w.RTGAdaptiveEdgeServices.lips(); node.onclick=function(){emit('rahul','open',node);}; return node;
  }
  function mark(kind) { var node=d.createElement('span'); node.className='rtg-edge-live__mark rtg-edge-live__mark--'+kind; node.setAttribute('aria-hidden','true'); node.innerHTML=glyph(kind); return node; }
  function close() { if (!active) return; active.release(); active.node.remove(); active=null; }
  function update(spec) {
    if (!active || !spec) return false;
    var copy=active.node.querySelector('.rtg-edge-live__copy small');
    if (copy && spec.duration != null) copy.textContent=String(spec.duration);
    return true;
  }
  w.RTGAdaptiveEdgeVisual=Object.freeze({markup:markup,button:edgeButton,destination:destination,present:present,update:update,close:close,photo:photo});
}(window,document));
