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
  /* DE ONDERTEKENING WERD OP EEN BREED SCHERM OVERGESLAGEN.

     #app krijgt `active` zodra er een sessie is, maar de intake is dan nog niet
     af: de lidmaatschaps- en reisovereenkomst wordt getekend in #onbGate, modaal
     over de app (app-main.js, checkOnboarding). aangemeld() keek alleen naar die
     klasse, en de werktafel bouwde zich eroverheen -- #rtgCommand op z-index 210,
     #onbGate op 130. Zelfde account, zelfde token: bij 999px stond je voor de
     overeenkomst, bij 1001px erachter. Getekend was er niets.

     Onder 1000px viel het niet op omdat de werktafel daar toen niet bestond. Dat
     toevallige vangnet is weg: deze voorwaarde is nu op ELKE breedte het enige
     wat de deur dichthoudt. Een bron van waarheid -- dezelfde `hidden` die de
     onboarding zelf zet. Gaat de deur alsnog open (checkOnboarding is
     asynchroon), dan wijkt een werktafel die er al stond; zie init(). */
  function poortDicht(){var g=d.getElementById('onbGate');return !g||g.hidden}
  /* DE WERKTAFEL DRAAIT OVERAL; `mq` ZEGT ALLEEN NOG HOE HIJ ERUITZIET.

     Hier stond `mq.matches` in de voorwaarde, en dat maakte de breedte tot een
     vraag over het BESTAAN van de werktafel. Het is nu een vraag over zijn VORM:
     op een telefoon dezelfde bank en dezelfde tabbladen, alleen komt de bank van
     onderen als lade en staat er een blad tegelijk in beeld (command.css). Wat
     niet verandert is het beginscherm -- dat blijft op beide de klok.

     breed() is daarmee een opmaakvraag en geen grendel. Wie hem als grendel
     gebruikt zet de breedte terug in de toegangsregel, en dat was de fout
     hierboven. */
  function breed(){return mq.matches}
  function mag(){return aangemeld()&&poortDicht()}
  /* DRIE STANDEN, EN MAAR EEN DAARVAN IS "WEG".

     weg       de ondertekening ligt bovenop; hier mag niets overheen (zie
               poortDicht hierboven -- dat is de grendel, niet een vorm)
     gesloten  nog geen sessie: de bank staat er wel, maar de werkvloer draagt
               het inloggesprek van Rahul en een wereld aanraken start dat
               gesprek in plaats van een dode deur te openen
     open      sessie en getekend: de gewone werktafel

     `gesloten` bestaat omdat het inlogscherm dezelfde werktafel hoort te zijn:
     wat je na het inloggen krijgt staat er dan al, alleen nog gesloten. Wat het
     NIET mag worden is een rij deuren die niets doen -- vandaar dat de bank in
     deze stand naar het gesprek wijst. */
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
      open:open,bestemming:bestemming,thuis:thuis,inlog:inlog});
    return tafel;
  }
  /* THUIS IS DE KLOK, MAAR NIET MEER DE LANDING.

     De werktafel is het beginscherm geworden: inloggen brengt je daar, en het
     laatste blad sluiten laat hem leeg staan in plaats van hem af te breken.
     De klok blijft bestaan -- daar hangen de werelden op hun bezel (WERELD.md)
     -- en staat bovenaan de bank. Hem kiezen vouwt de werktafel op.

     `opgevouwen` bestaat omdat probeer() anders zijn werk terugdraait: die
     bouwt zodra het mag, en zou de klok bij de eerstvolgende hertekening (een
     resize, een klasse die verspringt) weer overdekken. Een keuze van een mens
     hoort niet door een waarnemer te worden overstemd. */
  var opgevouwen=false;
  function thuis(){opgevouwen=true;if(tafel)tafel.sloop()}

  /* INLOGGEN LANDT ALTIJD OP EEN LEGE KEUZE.

     probeer() houdt de werktafel normaal via DOM-waarnemers gelijk met de
     sessie. Dat is een goed vangnet, maar niet de navigatiebelofte zelf: een
     geslaagde inlog hoort niet afhankelijk te zijn van het moment waarop een
     class-mutatie wordt gezien. De inloglaag roept land() daarom rechtstreeks
     aan zodra de onboarding klaar is.

     Ook een eerder open blad wordt hier bewust gewist. Wie opnieuw binnenkomt
     kiest zelf een wereld; het huis opent geen activiteit of voorbeeld voor
     hem. */
  function land(){
    opgevouwen=false;
    if(!mag())return false;
    var t=bouwTafel();
    t.zet('open');
    t.wis();
    t.sync();
    return true;
  }

  /* TWEE REDENEN OM NIET TE OPENEN, MET TWEE VERSCHILLENDE UITKOMSTEN.

     Geen sessie is geen weigering maar een andere vorm: naar de pagina toe, die
     draagt zijn eigen poort. (Hier stond ook `!mq.matches`; dat klopte zolang de
     werktafel alleen breed bestond.)

     De poort is wel een weigering. Toen die voorwaarde met mag() gedeeld werd,
     viel open() met een openstaande intake terug op location.href -- precies de
     omweg die de deur moest tegenhouden, want /apps/vandaag.html draagt #onbGate
     niet. Zolang er niet getekend is, gebeurt hier dus niets. */
  function open(url,titel){
    if(!poortDicht())return null;
    if(!aangemeld()){location.href=url;return null}
    opgevouwen=false;                         // iets openen is terugkomen
    return bouwTafel().toon(url,titel);
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
     is de grendel uit de vorige ronde. Mag hij er wel staan, dan is hij het
     beginscherm en bouwt hij zich hier op, tenzij een mens hem heeft
     opgevouwen om de klok te zien. */
  function probeer(){
    var s=stand();
    if(s==='weg'){if(tafel)tafel.sloop();return}
    if(!opgevouwen)bouwTafel().zet(s);
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
  w.RTGCommand={open:open,bestemming:bestemming,
    herken:function(q){var a=appUit(q);return a?{naam:a[0],url:a[1]}:null},
    actief:mag,
    land:land,
    sluitAlles:function(){if(tafel)tafel.sluitAlles()}};
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
