(function(){
  'use strict';

  var body=document.body;
  if(!body||!body.hasAttribute('data-workos-premium')) return;
  if(document.querySelector('.tabbar,.wk-bank,.hq-rail,.pn-rail,.workos-bottom')) return;

  var path=location.pathname;
  var workHome=body.getAttribute('data-workos-home')||'/apps/werk.html';
  var items=[
    {key:'today',label:'Vandaag',href:'/apps/werk.html',teken:'<path d="M4 11.5 12 4l8 7.5V20h-5v-5H9v5H4z"/>'},
    {key:'spaces',label:'Werkruimtes',href:'/apps/werkruimte.html',teken:'<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.4 2.2 3.5 4.8 3.5 8S14.4 17.8 12 20M12 4C9.6 6.2 8.5 8.8 8.5 12s1.1 5.8 3.5 8"/>'},
    {key:'work',label:'Werk',href:workHome,teken:'<rect x="4" y="7" width="16" height="12" rx="1"/><path d="M9 7V5h6v2M4 12h16M10 12v2h4v-2"/>'},
    {key:'messages',label:'Berichten',href:'/apps/comm.html',teken:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'},
    {key:'profile',label:'Profiel',href:'/apps/ik.html',teken:'<circle cx="12" cy="8" r="3"/><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6"/>'}
  ];

  var active='work';
  if(path==='/apps/werk.html') active='today';
  else if(path.indexOf('werkruimte')!==-1) active='spaces';
  else if(path==='/apps/comm.html') active='messages';
  else if(path==='/apps/ik.html'||path==='/apps/app.html') active='profile';

  var nav=document.createElement('nav');
  nav.className='workos-bottom';
  nav.setAttribute('aria-label','WorkOS hoofdmenu');
  items.forEach(function(item){
    var link=document.createElement('a');
    link.href=item.href;
    link.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+item.teken+'</svg><span>'+item.label+'</span>';
    if(item.key===active) link.setAttribute('aria-current','page');
    nav.appendChild(link);
  });

  body.classList.add('workos-has-bottom');
  body.appendChild(nav);
})();
