/* Zichtbare vertrouwenslaag: route en privacy komen van de server, nooit uit
   de modeltekst. Los gehouden zodat de universele Rahul-tab klein blijft. */
(function(w){
  'use strict';
  var command=w.__rahulTabCommand;
  if(!command)return;
  var page=command.page;
  page.querySelector('.rtg-command-chat h1').insertAdjacentHTML('afterend','<section class="rtg-kompas" data-kompas><div class="rtg-kompas-dial" aria-hidden="true"><i></i><b>K</b></div><div><span>RTG KOMPAS</span><strong data-kompas-route>VEILIGE ROUTE</strong><small data-kompas-privacy>De applicatie controleert privacy en bevoegdheid</small></div><em>MENS BESLIST</em></section>');
  var box=page.querySelector('[data-kompas]');
  w.RTGKompas={
    denkt:function(ja){box.classList.toggle('denkt',!!ja)},
    toon:function(d){var k=d&&d.kompas;if(!k)return;var route=box.querySelector('[data-kompas-route]');route.textContent=k.route==='op-dit-apparaat'?'LOKAAL OP DEZE MAC':k.route==='eigen-netwerk'?'EIGEN OMGEVING':k.route==='hybride'?'LOKAAL + ZICHTBARE UITWIJK':k.route==='extern'?'EXTERNE MODELROUTE':'CONTROLEERBARE REGELS';box.querySelector('[data-kompas-privacy]').textContent=k.privacy||'Privacyroute gecontroleerd';box.dataset.route=k.route||'regels'}
  };
})(window);
