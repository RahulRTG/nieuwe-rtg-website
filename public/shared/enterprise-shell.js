(function(){
  'use strict';
  if(document.querySelector('.rtge-top'))return;
  var path=location.pathname,query=new URLSearchParams(location.search),title=document.title.replace(/\s*[·|\u2013-].*$/,'').trim();
  var isPartner=/leverancier|partner/.test(path),isPda=/pda|personeel/.test(path),isBusiness=/app\.html$/.test(path)&&query.get('pas')==='business';
  if(!isPartner&&!isPda&&!isBusiness)return;
  var kind=isBusiness?'Business Pass':isPda?'PDA':'Partner',account=isBusiness?'Business-account':isPda?'Team-account':'Partner-account';
  var product=isBusiness?'Business Pass':(title||kind+' Suite');
  var nav=isBusiness?[
    ['⌂','Overzicht','/apps/app.html?pas=business'],['✉','RTMAIL','/apps/rtmail.html'],['◇','Office','/apps/office.html'],['◎','Netwerk','/apps/app.html?pas=business#zakelijk'],['▤','Financiën','/apps/app.html?pas=business#pay']
  ]:isPda?[
    ['⌂','Werkdag','/apps/personeel.html'],['✓','Taken',path+'#taken'],['◎','Team','/apps/personeel.html#team'],['◇','Planning','/apps/personeel.html#planning'],['✉','RTMAIL','/apps/leverancier-rtmail.html']
  ]:[
    ['⌂','Dashboard','/apps/leverancier.html'],['◎','Team','/apps/leverancier.html#team'],['◇','Operatie','/apps/leverancier.html#operatie'],['▤','Financiën','/apps/leverancier.html#financien'],['✉','RTMAIL','/apps/leverancier-rtmail.html']
  ];
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  function icon(pathData){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+pathData+'</svg>'}
  var activeIndex=nav.findIndex(function(n){return path===new URL(n[2],location.href).pathname});if(activeIndex<0)activeIndex=0;
  var top=document.createElement('header');top.className='rtge-top';top.setAttribute('role','banner');top.innerHTML='<div class="rtge-top-left"><a class="rtge-brand" href="/apps/index.html"><img src="/icon.svg" alt="RTG"><b>RTG</b><small>OS</small></a><div class="rtge-product"><strong>'+esc(product)+'</strong><span>Enterprise Suite</span></div><span class="rtge-license">Commercial</span></div><div class="rtge-top-right"><span class="rtge-clock"></span><a class="rtge-icon optional" href="/apps/index.html" aria-label="Alle apps">'+icon('<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>')+'</a><button class="rtge-icon optional" data-rtge-search aria-label="Zoeken">'+icon('<circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/>')+'</button><a class="rtge-icon optional" href="#meldingen" aria-label="Meldingen">'+icon('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M14 21h-4"/>')+'</a><a class="rtge-account" href="'+(isBusiness?'/apps/app.html?pas=business':isPda?'/apps/personeel.html':'/apps/leverancier.html')+'"><i></i><span>'+esc(account)+'</span></a></div>';
  var side=document.createElement('aside');side.className='rtge-side';side.setAttribute('aria-label','RTG Enterprise navigatie');side.style.setProperty('--rtge-items',nav.length);side.innerHTML='<div class="rtge-suite"><div class="rtge-seal">RT</div><div><b>'+esc(kind)+'</b><small>RTG Enterprise</small></div></div><nav class="rtge-nav"><div class="rtge-nav-label">Werkruimte</div>'+nav.map(function(n,i){return '<a class="'+(i===activeIndex?'active':'')+'" href="'+n[2]+'"><i>'+n[0]+'</i><span>'+n[1]+'</span></a>'}).join('')+'</nav><div class="rtge-trust"><b>Enterprise beveiligd</b><span>Geverifieerde toegang · versleutelde werkruimte · audit gereed</span></div>';
  document.body.classList.add('rtg-enterprise-shell');document.body.prepend(side);document.body.prepend(top);
  function clock(){var el=top.querySelector('.rtge-clock');if(el)el.textContent=new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}clock();setInterval(clock,30000);
  top.querySelector('[data-rtge-search]').onclick=function(){var el=document.querySelector('input[type="search"],input[placeholder*="Zoek" i],input[placeholder*="Search" i]');if(el){el.focus();el.scrollIntoView({behavior:'smooth',block:'center'})}}
})();
