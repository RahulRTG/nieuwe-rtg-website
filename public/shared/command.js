/* RTG Command: WIE ER NAAR BINNEN MAG, en waar Rahuls opdrachten heen gaan.

   Het meubel zelf (bank, tabbladen, bladen, scheiding, lade) staat in
   shared/command/werktafel.js. Dit bestand droeg allebei en groeide daarmee
   over de 10 KB uit regel 13 van scripts/check.js -- die grens is een dakpan,
   en erboven zat hier inderdaad een tweede onderwerp.

   Wat hier staat is de grendel, en die staat maar op EEN plek. */
(function (w,d) {
  'use strict';
  if (w.RTGCommand) return;
  var mq=w.matchMedia('(min-width:1000px)'),tafel=null,
      catalog=w.RTGCommandCatalog,appUit=catalog.appUit;

  function aangemeld(){var app=d.getElementById('app');return !!(app&&app.classList.contains('active'))}
  /* De intake is op elke breedte de enige grendel voor de werktafel. */
  function poortDicht(){var g=d.getElementById('onbGate');return !g||g.hidden}
  /* DE WERKTAFEL DRAAIT OVERAL; `mq` ZEGT ALLEEN NOG HOE HIJ ERUITZIET: op een
     telefoon komt de bank van onderen als lade en staat er een blad tegelijk in
     beeld (command.css). Hier stond `mq.matches` in de toegangsvoorwaarde, en
     dat maakte de breedte tot een vraag over het BESTAAN van de werktafel.
     breed() is een opmaakvraag en geen grendel. */
  function breed(){return mq.matches}
  function mag(){return aangemeld()&&poortDicht()}
  /* weg = intake, gesloten = inloggesprek, open = gewone werktafel. */
  function stand(){return !poortDicht()?'weg':(aangemeld()?'open':'gesloten')}
  function magBestaan(){return poortDicht()}
  /* Het inloggesprek staat in #gate en wordt door app-main gebouwd; wij
     verplaatsen dat blok alleen naar de werkvloer. De passkey is nu de eerste
     deur, dus een wereld aanraken zet de cursor daar. Pas na "Andere manier"
     is het antwoordveld zichtbaar en wordt dat de bestemming. */
  function inlog(){var p=d.getElementById('agPasskey'),i=d.getElementById('agIn');
    if(p&&!p.hidden)p.focus();else if(i)i.focus()}

  function bouwTafel(){
    if(!tafel)tafel=w.RTGCommandWerktafel({magBestaan:magBestaan,breed:breed,catalog:catalog,
      open:open,bestemming:bestemming,thuis:thuis,inlog:inlog,thuisAdres:thuisAdres,
      werelden:function(){return werelden},systeem:deuren});
    return tafel;
  }
  /* DE WERELDEN HINGEN OP DE BEZEL OM DE KLOK, en staan nu bovenaan de bank; de
     klok is met zijn beginscherm verdwenen (WERELD.md).

     De lijst wordt AANGEREIKT en niet hier verzonnen: app-main kent hem
     (MAPPEN), inclusief de vraag wat bij jouw pas hoort. Een tweede lijst hier
     zou twee waarheden geven over wat er bestaat -- LAT.md regel 4. Leeg is een
     geldige stand (een gast, een pagina zonder app-main). */
  var werelden=[];
  function zetWerelden(lijst){
    werelden=Array.isArray(lijst)?lijst:[];
    if(tafel)tafel.werelden();
  }
  /* app-main reikt systeempanelen aan; Command verzint geen tweede lijst. */
  var systeem=[];
  function zetSysteem(lijst){
    systeem=Array.isArray(lijst)?lijst:[];
    if(tafel)tafel.werelden();
  }
  /* RAHUL HOORT BIJ DE WERKTAFEL, dus levert de werktafel zijn deur zelf. Hij
     stond eerst in de lijst van app-main en riep RTGRahul.open() aan -- de
     zwevende handenvrij-balk. Dat is een tweede Rahul naast die in de schilbalk;
     nu wijzen ze allebei naar dezelfde. De deur blijft nodig naast de mond in
     die balk, want de balk bestaat alleen op een telefoon. */
  function deuren(){
    return [{naam:'Rahul',teken:'mens',doe:rahul}].concat(systeem);
  }
  function rahul(){if(!mag())return;bouwTafel().praat()}
  /* Home en het laatste blad sluiten eindigen leeg; inloggen hervat. */
  function thuis(){if(!tafel)return;tafel.wis();tafel.sync()}
  function land(){
    if(!mag())return false;
    var t=bouwTafel();
    t.zet('open');
    t.sync();
    return true;
  }

  /* Homealiases zijn de host, nooit een blad. Alleen een kale Home opent het
     Second Screen; een echte deep-link herlaadt de buitenste host. */
  function thuisAdres(url){
    try{var u=new w.URL(url,w.location.href);
      if(u.origin!==w.location.origin||!/^\/(?:apps(?:\/(?:app|index|bureau)\.html)?\/?)?$/.test(u.pathname))return null;
      return{url:u,diep:!!u.hash||!!(u.search&&u.search!=='?magnaat=1')}}catch(e){return null}
  }
  function open(url,titel,kant){
    if(!poortDicht())return null;
    if(!aangemeld()){location.href=url;return null}
    var t=bouwTafel(),home=thuisAdres(url);
    if(home){if(home.diep){w.location.href=home.url.href;return null}
      var s=t.staat(),second=s.root&&s.root.__rtgSecondScreen;
      if(second)second.setState(breed()?'workspace':'panel');else thuis();return null}
    return kant?t.openNaast([titel,url],kant):t.toon(url,titel);
  }

  function bestemming(tekst){var q=String(tekst||'').trim(),laag=q.toLowerCase(),links=null,rechts=null,m,t;
    if((m=laag.match(/(.+?)\s+links(?:\s+en|,)?\s+(.+?)\s+rechts/))){links=appUit(m[1]);rechts=appUit(m[2]);
      if(links&&rechts){if(!mag())return null;t=bouwTafel();t.wis();open(links[1],links[0]);t.openNaast(rechts,'rechts');t.select(1);
        return 'Ik heb '+links[0]+' links en '+rechts[0]+' rechts voor u geopend.'}}
    var a=appUit(laag);if(!a)return null;
    if(/ernaast|naast elkaar|rechts/.test(laag)){if(!mag())return null;bouwTafel().openNaast(a,'rechts');return 'Natuurlijk. '+a[0]+' staat ernaast.'}
    if(/links/.test(laag)){if(!mag())return null;bouwTafel().openNaast(a,'links');return a[0]+' staat links voor u klaar.'}
    if(/open|breng|ga naar|toon|laat zien|terug naar/.test(laag)){open(a[1],a[0]);return 'Natuurlijk. Ik breng u naar '+a[0]+'.'}
    return null}

  /* De wachter, en tegelijk de landing. Mag de werktafel er niet staan (geen
     sessie, of de overeenkomst is nog niet getekend), dan gaat hij weg -- dat
     is de grendel uit de vorige ronde. Mag hij er wel staan, dan bouwt hij zich
     hier op, want hij IS het beginscherm. Hier stond een uitzondering voor een
     opgevouwen werktafel; opvouwen kan niet meer, want er is niets om naar op te
     vouwen. */
  function probeer(){
    var s=stand();
    if(s==='weg'){if(tafel)tafel.sloop();return}
    bouwTafel().zet(s);
  }
  function init(){
    probeer();
    var app=d.getElementById('app'),poort=d.getElementById('onbGate');
    if(app&&w.MutationObserver)new MutationObserver(probeer).observe(app,{attributes:true,attributeFilter:['class']});
    if(poort&&w.MutationObserver)new MutationObserver(probeer).observe(poort,{attributes:true,attributeFilter:['hidden']});
  }
  /* Breedte verandert de VORM en niet meer het bestaan, dus is dit geen
     afbreekmoment meer maar een hertekening: de scheiding verschijnt of
     verdwijnt. probeer() blijft eerst, want sessie en poort kunnen intussen ook
     zijn veranderd. */
  mq.addEventListener&&mq.addEventListener('change',function(){probeer();if(tafel)tafel.sync()});
  /* actief() is de vraag "opent een app hier als BLAD of als pagina?", en het
     antwoord is precies mag(). Hij keek alleen naar de breedte: een tweede,
     mildere waarheid naast de grendel, waardoor de app-laag naar open() stuurde
     terwijl die zelf alsnog naar location.href terugviel. */
  w.RTGCommand={open:open,bestemming:bestemming,thuisAdres:thuisAdres,
    herken:function(q){var a=appUit(q);return a?{naam:a[0],url:a[1]}:null},
    actief:mag,
    land:land,
    werelden:zetWerelden,
    systeem:zetSysteem,
    rahul:rahul,
    uitKind:function(bron,url){return !!(tafel&&tafel.thuisUitKind(bron,url))},
    sluitAlles:function(){if(tafel)tafel.sluitAlles()}};
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
