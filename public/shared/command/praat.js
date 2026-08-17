/* DE MOND IN DE SCHILBALK: Rahul woont in de balk, niet in een paneel ernaast.

   WAAROM DIT BESTAAT. Rahul had op het beginscherm drie vormen die alle drie
   ergens anders vandaan kwamen: de balk onderaan het springboard (weg met dat
   scherm), de glasconsole van de werktafel (verborgen door
   shared/rahul-tab/style-base.js) en de handenvrij-balk, een zwevende strook die
   over de werktafel heen kwam liggen. Die laatste werkte, maar hij was een
   tweede meubel: een eigen bak met eigen knoppen boven een balk die er al was.

   Wat hier staat is één ding minder. De schilbalk onderaan DRAAGT hem: rechts
   staat de mond -- hetzelfde gezicht als overal in dit huis (shared/mond.js) --
   en een tik erop maakt van diezelfde balk een vraagveld. Geen paneel dat
   opkomt, geen tweede laag: de balk die je al had verandert van taak. Nog een
   tik, of Escape, en hij is weer de balk met je werkbladen.

   WAT DEZE LAAG NIET WEET, EN NIET MAG WETEN. Hij verzint geen antwoorden en
   kent Rahul niet. Een navigatie-opdracht ("open Reizen") gaat naar
   o.bestemming(), precies dezelfde router die de console gebruikt; al het andere
   naar RTGThuisRahul.vraag(). Wat er terugkomt leest hij van ÉÉN plek af: de
   draad #osAiDraad, die app-main vult. Dat is de reden dat hier een spiegel
   staat en geen tweede gesprekslijst -- twee lijsten die op verschillende
   momenten worden bijgewerkt, zíjn twee gesprekken (LAT.md regel 4).

   De spiegel houdt per bronregel bij welke regel van hem is (`_spiegel`), want
   Rahul zet eerst "Even kijken…" neer en vervangt de TEKST van diezelfde regel
   door zijn antwoord. Wie alleen op childList luistert, krijgt het antwoord
   nooit te zien; wie op characterData luistert zonder dit boekhoudinkje, krijgt
   hem twee keer. */
(function(w,d){
  'use strict';
  w.RTGCommandPraat=function(o){
    var root=o.root,mond=null,strip=null,veld=null,gespiegeld=null,kijker=null;

    function balk(){return root&&root.querySelector('.cmd-balk')}
    function aan(){var b=balk();return !!(b&&b.classList.contains('vraagt'))}

    /* De mond is een canvas dat pas beweegt als Rahul iets zegt. shared/mond.js
       wordt hier zo nodig alsnog opgehaald: op een pagina die hem niet vooraf
       laadt hoort de knop niet leeg te blijven staan. */
    function gezicht(knop){
      function zet(){if(!w.RTGMond)return false;mond=w.RTGMond.fab(knop,20);return true}
      if(zet())return;
      var s=d.createElement('script');s.src='/shared/mond.js';s.onload=zet;d.head.appendChild(s);
    }

    function regel(tekst,vanMij){
      if(!strip||!tekst)return null;
      var r=d.createElement('p');
      r.className='cmd-praatregel'+(vanMij?' mij':'');
      r.textContent=tekst;
      strip.appendChild(r);
      /* De strook gaat NIET vanzelf open. Bij het opbouwen staat er al een zin
         van Rahul in de draad, en die zette hem hier meteen in beeld -- een
         gesprek dat begint zonder dat je erom vroeg, precies boven de balk die
         zegt "kies een wereld". Openen is een handeling van een mens (open()),
         en tot dan schrijft dit alleen mee. */
      if(!strip.hidden)strip.scrollTop=strip.scrollHeight;
      if(!vanMij&&mond)try{mond.praat(Math.min(4200,420+tekst.length*38))}catch(e){}
      return r;
    }

    /* DE SPIEGEL van de draad die app-main vult. Hij loopt ook over regels die
       er al stonden voordat de werktafel werd gebouwd: wie Rahul opent hoort te
       zien wat hij eerder zei, niet een leeg vak. */
    function spiegel(){
      var bron=d.getElementById('osAiDraad');
      if(!bron||gespiegeld===bron||!w.MutationObserver)return;
      gespiegeld=bron;
      var haal=function(){
        [].forEach.call(bron.children,function(x){
          var tekst=(x.textContent||'').trim();
          if(!tekst)return;
          /* Het merkje telt alleen als het naar DEZE strook wijst. De werktafel
             wordt opnieuw opgebouwd zodra de stand wisselt (gesloten -> open na
             het inloggen), en dan is er een nieuwe strook. Zonder deze
             voorwaarde bleef het merkje van de vorige staan, wees het naar een
             weggehaald element, en kwam er in de nieuwe strook nooit meer een
             regel -- stil, want er ging niets kapot: er verscheen alleen niets. */
          if(x._spiegel&&x._spiegel.parentNode===strip){
            if(x._spiegel.textContent!==tekst){x._spiegel.textContent=tekst;
              if(!x.classList.contains('van-mij')&&mond)try{mond.praat(Math.min(4200,420+tekst.length*38))}catch(e){}}
            return}
          x._spiegel=regel(tekst,x.classList.contains('van-mij'));
        });
      };
      haal();
      kijker=new MutationObserver(haal);
      kijker.observe(bron,{childList:true,subtree:true,characterData:true});
    }

    function open(){
      var b=balk();if(!b)return;
      b.classList.add('vraagt');
      spiegel();
      if(strip&&strip.children.length)strip.hidden=false;
      if(veld)try{veld.focus({preventScroll:true})}catch(e){veld.focus()}
    }
    function sluit(){
      var b=balk();if(!b)return;
      b.classList.remove('vraagt');
      if(strip)strip.hidden=true;
      if(veld)veld.blur();
    }
    function wissel(){aan()?sluit():open()}

    /* Versturen. De route komt eerst: "open Geld" hoort een blad te openen en
       geen gesprek te beginnen. Pakt de router hem niet, dan gaat de vraag naar
       Rahul zelf -- en dan zetten we hier GEEN eigen regel neer, want hij zet
       zowel jouw vraag als zijn antwoord in de draad en de spiegel haalt ze op.
       Twee keer dezelfde zin is geen nadruk maar een fout. */
    function stuur(e){
      if(e)e.preventDefault();
      var q=veld?veld.value.trim():'';
      if(!q)return;
      veld.value='';
      spiegel();
      var route=o.bestemming&&o.bestemming(q);
      if(route){regel(q,true);regel(route,false);return}
      if(w.RTGThuisRahul&&w.RTGThuisRahul.vraag){w.RTGThuisRahul.vraag(q);return}
      regel(q,true);
      regel('Vrije hulp is nu niet actief. Navigatie en alle werkbladen blijven werken; kies een wereld in de bank.',false);
    }

    function bouw(){
      if(!root)return;
      var knop=root.querySelector('.cmd-mondknop'),vorm=root.querySelector('.cmd-vraagvorm');
      strip=root.querySelector('.cmd-praat');
      veld=root.querySelector('.cmd-vraagveld');
      if(knop){gezicht(knop);knop.onclick=wissel}
      if(vorm)vorm.onsubmit=stuur;
      d.addEventListener('keydown',opEscape);
      spiegel();
    }
    function opEscape(e){if(e.key==='Escape'&&aan())sluit()}

    /* AFBREKEN HOORT ERBIJ, en dat is hier duur geleerd. De werktafel wordt
       opnieuw opgebouwd zodra de stand wisselt (gesloten -> open na het
       inloggen). De oude laag verloor alleen zijn verwijzing: zijn waarnemer op
       de draad bleef luisteren en bleef regels bijzetten in een strook die al
       weg was. Erger nog, twee levende lagen kaatsten elkaars merkje heen en
       weer -- allebei zagen ze een spiegelregel die niet in HUN strook stond en
       maakten er een nieuwe bij, waarna de ander hetzelfde deed. Gevolg: elke
       zin dubbel, en bij elke herbouw een keer vaker. */
    function stop(){
      if(kijker){kijker.disconnect();kijker=null}
      gespiegeld=null;
      d.removeEventListener('keydown',opEscape);
    }

    return{bouw:bouw,open:open,sluit:sluit,wissel:wissel,aan:aan,stop:stop};
  };
})(window,document);
