/* De uitgebreide command-workspace blijft los van de globale tabbedrading. */
(function(w){
  'use strict';
  var command=w.__rahulTabCommand;
  if(!command)return;
  var page=command.page;
  page.querySelector('.rtg-command-context').insertAdjacentHTML('beforeend','<section class="rtg-intent"><header><span>INTENT CANVAS</span><em>LIVE</em></header><div class="rtg-intent-grid"><div><small>BEDOELING</small><b data-intent-goal>Sneller resultaat</b></div><div><small>GRENS</small><b>Menselijk akkoord</b></div><div><small>TIJD</small><b>Nu voorbereiden</b></div><div><small>SUCCES</small><b>Minimale overdracht</b></div></div><button type="button" data-build-plan>Ontwerp route →</button></section>');
  page.querySelector('.rtg-command-chat h1').insertAdjacentHTML('afterend','<section class="rtg-twin"><header><span>ENTERPRISE TWIN · PRE-FLIGHT</span><em data-twin-state>GEREED VOOR SIMULATIE</em></header><div class="rtg-twin-flow"><div><i></i><b>Intent</b><small>begrepen</small></div><div><i></i><b>People</b><small>grens actief</small></div><div><i></i><b>Finance</b><small>niet gemeten</small></div><div><i></i><b>Partners</b><small>voorbereiden</small></div><div><i></i><b>Proof</b><small>mens akkoord</small></div></div><div class="rtg-twin-foot"><span>Veilige stappen parallel voorbereid</span><b data-twin-saving>0 uitvoeringen</b></div></section>');
  page.querySelector('.rtg-automation').insertAdjacentHTML('beforebegin','<section class="rtg-one"><header><span>ONE DECISION</span><em data-decision-state>VOORBEREID</em></header><h3>Eén akkoord.<br>Een volledige route.</h3><p>Rahul bundelt de onderlinge gevolgen. Alleen deze onomkeerbare grens blijft voor u over.</p><dl><div><dt>Uitvoering</dt><dd>nog geblokkeerd</dd></div><div><dt>Terugdraaibaar</dt><dd>waar mogelijk</dd></div><div><dt>Bewijs</dt><dd>volledig logboek</dd></div></dl><button type="button" data-one-decision>Controleer gebundeld akkoord →</button></section>');

  page.querySelector('[data-build-plan]').onclick=function(){
    var c=command.context();
    page.querySelector('[data-intent-goal]').textContent=c.deel+' optimaliseren';
    page.querySelector('[data-twin-state]').textContent='5 DOMEINEN GESIMULEERD';
    page.querySelector('[data-twin-saving]').textContent='4 voorbereid · 0 uitgevoerd';
    command.voeg('rahul','De uitvoeringsroute is ontworpen. Vier omkeerbare voorbereidingen kunnen parallel; één gebundeld menselijk akkoord blijft geblokkeerd.');
  };
  page.querySelector('[data-one-decision]').onclick=function(){
    var box=page.querySelector('.rtg-one'),aan;
    box.classList.toggle('approved');
    aan=box.classList.contains('approved');
    page.querySelector('[data-decision-state]').textContent=aan?'CONTROLE GEOPEND':'VOORBEREID';
    this.textContent=aan?'Sluit akkoordcontrole':'Controleer gebundeld akkoord →';
    command.voeg('rahul',aan?'Akkoordcontrole geopend. Ik toon eerst gevolgen, bronnen en terugdraaimogelijkheden; er is nog niets uitgevoerd.':'Akkoordcontrole gesloten. De voorbereide route blijft veilig bewaard.');
  };
})(window);
