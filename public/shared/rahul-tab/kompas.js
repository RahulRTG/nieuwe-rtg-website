/* Zichtbare vertrouwenslaag: route en privacy komen van de server, nooit uit
   de modeltekst. Los gehouden zodat de universele Rahul-tab klein blijft. */
(function(w){
  'use strict';
  var command=w.__rahulTabCommand;
  if(!command)return;
  var page=command.page;
  page.querySelector('.rtg-command-chat h1').insertAdjacentHTML('afterend','<section class="rtg-kompas" data-kompas><div class="rtg-kompas-dial" aria-hidden="true"><i></i><b>K</b></div><div><span>RTG KOMPAS</span><strong data-kompas-route>ROUTE NOG ONBEKEND</strong><small data-kompas-privacy>Nog geen actuele privacy-informatie ontvangen</small></div><em>MENS BESLIST</em></section>');
  var box=page.querySelector('[data-kompas]');
  function onbekend(){
    box.querySelector('[data-kompas-route]').textContent='ROUTE NOG ONBEKEND';
    box.querySelector('[data-kompas-privacy]').textContent='Nog geen actuele privacy-informatie ontvangen';
    box.dataset.route='onbekend';
  }
  w.RTGKompas={
    denkt:function(ja){box.classList.toggle('denkt',!!ja);if(ja)onbekend()},
    /* Wat er bij DIT antwoord gebeurde (server/ai-stand.js uitgevoerd), vóór wat
       de configuratie toestaat. Geen herkomst: dan '' en valt de tab terug op de stand. */
    regel:function(d){
      var u=d&&d.uitgevoerd;
      if(!u||typeof u!=='object'||Array.isArray(u)||d.error||d.ok===false)return'';
      var plaatsen=Array.isArray(u.plaatsen)?u.plaatsen:[];
      if(u.extern===true||plaatsen.indexOf('externe-provider')>=0)return'RTG Kompas · externe aanbieder gebruikt';
      if(u.zonderModel===true)return plaatsen.length?'':'RTG Kompas · beantwoord zonder model';
      if(!plaatsen.length||plaatsen.some(function(p){return p!=='eigen-netwerk'&&p!=='rtg-server'}))return'';
      return plaatsen.indexOf('eigen-netwerk')>=0?'RTG Kompas · lokaal in eigen omgeving':'RTG Kompas · eigen modelserver van RTG';
    },
    toon:function(d){
      var k=d&&d.kompas;
      if(!k||typeof k!=='object'||Array.isArray(k)||d.error||d.ok===false){onbekend();return;}
      var routes={'rtg-server':'EIGEN RTG-SERVER','eigen-netwerk':'EIGEN OMGEVING',hybride:'LOKAAL + ZICHTBARE UITWIJK',extern:'EXTERNE MODELROUTE',regels:'REGELROUTE'};
      var bekend=Object.prototype.hasOwnProperty.call(routes,k.route);
      box.querySelector('[data-kompas-route]').textContent=bekend?routes[k.route]:'ROUTE NOG ONBEKEND';
      box.querySelector('[data-kompas-privacy]').textContent=typeof k.privacy==='string'&&k.privacy.trim()?k.privacy:'Geen privacy-informatie ontvangen';
      box.dataset.route=bekend?k.route:'onbekend';
    }
  };
})(window);
