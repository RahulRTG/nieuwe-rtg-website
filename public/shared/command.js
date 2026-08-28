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
  /* DE WERKTAFEL DRAAIT OVERAL; `mq` ZEGT ALLEEN NOG HOE HIJ ERUITZIET: op een
     telefoon komt de bank van onderen als lade en staat er een blad tegelijk in
     beeld (command.css). Hier stond `mq.matches` in de toegangsvoorwaarde, en
     dat maakte de breedte tot een vraag over het BESTAAN van de werktafel.
     breed() is een opmaakvraag en geen grendel. */
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
      open:open,bestemming:bestemming,thuis:thuis,inlog:inlog,
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
  /* DE SYSTEEMPANELEN, om dezelfde reden van buiten als de werelden.

     Hier stond schil(): die vouwde de werktafel op en zette je op het
     springboard eronder. Dat scherm is weg, dus is er ook niets meer om naar op
     te vouwen -- wat eronder lag en WEL moest blijven zijn de panelen (het
     bedieningspaneel met scannen, Zegel, backoffice, pin, taal, weergave, push,
     zoeken, meldingen en uitloggen). Die komen nu over de werktafel heen te
     liggen in plaats van eronder vandaan; zie de schil-regels in command.css.

     Wie ze kent is app-main, en dus reikt app-main ze aan. Deze module weet niet
     welke panelen er zijn en hoe je ze opent; dat blijft op één plek staan. */
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
  /* DRIE WEGEN, EN TWEE ERVAN EINDIGEN LEEG (WERELD.md, geheugen.js):

       thuis()  Home -> lege tafel, en dat is de enige knop die dat doet
       land()   inloggen -> je laatste bladen staan er weer
       sluiten  je laatste blad dicht -> lege tafel

     Hier stond t.wis() ook in land(), en dat WAS de oude regel: inloggen kwam
     altijd op een lege keuze uit. De werktafel hervat nu je bladen, en dan is
     wissen bij binnenkomst het tegenovergestelde van wat er beloofd wordt.
     thuis() wist wel, en moet dat blijven doen -- anders is er geen weg terug
     naar een schone tafel en is hervatten geen gemak maar een gevangenis.

     land() wordt rechtstreeks aangeroepen zodra de onboarding klaar is:
     probeer() volgt de sessie via DOM-waarnemers, en dat is een vangnet en
     geen navigatiebelofte. */
  function thuis(){if(!tafel)return;tafel.wis();tafel.sync()}
  function land(){
    if(!mag())return false;
    var t=bouwTafel();
    t.zet('open');
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
  w.RTGCommand={open:open,bestemming:bestemming,
    herken:function(q){var a=appUit(q);return a?{naam:a[0],url:a[1]}:null},
    actief:mag,
    land:land,
    werelden:zetWerelden,
    systeem:zetSysteem,
    rahul:rahul,
    sluitAlles:function(){if(tafel)tafel.sluitAlles()}};
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
