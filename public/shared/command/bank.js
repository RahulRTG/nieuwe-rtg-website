/* DE BANK van RTG Command: de werelden, en de lade waarin ze op een telefoon
   zitten.

   Vanaf 1000px is de bank een vaste rail links; daaronder een lade die van
   onderen opkomt, met een greep in de tabbalk. Dat verschil is opmaak
   (command.css); wat hier staat is wat de bank TOONT en wanneer hij dichtgaat.

   Een eigen bestand omdat het een eigen onderwerp is -- de werktafel eromheen
   gaat over bladen, niet over navigatie. */
(function(w,d){
  'use strict';
  w.RTGCommandBank=function(o){
    var root=o.root, svg=o.svg, APPS=o.apps, dicht=o.stand==='gesloten';

    function sluit(){if(!root)return;root.classList.remove('bank-open');
      var k=root.querySelector('.cmd-lade');if(k)k.setAttribute('aria-expanded','false')}

    /* EEN DEUR IN DE BANK, en er is er maar een soort van.

       Een wereld en een stuk software zien er hier hetzelfde uit en gedragen
       zich hetzelfde: ze openen een blad. Het verschil zit in wat erachter zit,
       niet in de knop -- vandaar een bouwer in plaats van twee.

       Het teken komt van de aanroeper als die er een heeft (de werelden dragen
       hun eigen glyf, dezelfde als op hun huis), anders uit de ingebouwde set.
       Een glyf die niet te maken is, is geen reden om de deur weg te laten. */
    function deur(naam,url,teken,ico){
      var b=d.createElement('button'),g=null;
      try{g=teken&&teken()}catch(e){}
      if(g&&g.nodeType===1){var s=d.createElement('span');s.className='cmd-glyf';s.appendChild(g);b.appendChild(s)}
      else b.innerHTML=svg(ico||'home');
      var t=d.createElement('span');t.textContent=naam;b.appendChild(t);
      if(!dicht)b.dataset.url=url;
      /* Kiezen sluit de lade: op een telefoon ligt die over het blad dat je
         net opende. In de gesloten stand is er geen dode deur maar de cursor
         in het gesprek dat hem opent. */
      b.onclick=dicht?function(){sluit();o.inlog()}
                     :function(){sluit();o.open(url,naam)};
      return b;
    }
    function kopje(tekst){var p=d.createElement('p');p.className='cmd-kop';p.textContent=tekst;return p}

    /* DE WERELDEN STAAN BOVENAAN, EN DIT IS WAAR ZE WONEN.

       Ze hingen als merken op de bezel om de klok. Die klok wás het
       beginscherm en is dat niet meer -- de werktafel is het geworden -- dus
       zouden de werelden met hem verdwenen zijn. Ze staan nu hier, op de enige
       plek die nog navigatie is, boven de software.

       De lijst komt van BUITEN: app-main reikt hem aan uit MAPPEN, en dat is de
       enige lijst werelden die er is. Deze module houdt er geen kopie van (zie
       LAT.md regel 4) -- o.werelden() wordt elke keer opnieuw gelezen, zodat een
       pas die verandert niet een bank achterlaat die van gisteren is.

       Nul werelden is een geldige stand, geen storing: een gast, of een pagina
       die de lijst niet aanreikt. Dan staat er geen kopje en geen lege rij, en
       houdt de bank gewoon zijn software. */
    function vul(){
      var nav=root&&root.querySelector('.cmd-nav');if(!nav)return;
      var werelden=[];
      try{werelden=(o.werelden&&o.werelden())||[]}catch(e){}
      werelden=werelden.filter(function(x){return x&&x.naam&&x.url});
      nav.textContent='';
      if(werelden.length){
        nav.appendChild(kopje('Werelden'));
        werelden.forEach(function(x){nav.appendChild(deur(x.naam,x.url,x.teken))});
        nav.appendChild(kopje('Software'));
      }
      APPS.forEach(function(a){nav.appendChild(deur(a[0],a[1],null,a[2]))});
      /* DE SCHIL ONDER DE WERKTAFEL, onderaan want het is geen bestemming maar
         een uitweg. Hij heette "Beginscherm" en bracht je naar de klok; het
         beginscherm is de werktafel geworden, dus zou die naam nu naar het
         verkeerde scherm wijzen. Wat eronder ligt is je toestel: het
         bedieningspaneel, scannen, je Zegel, je meldingen en uitloggen -- en er
         is geen tweede weg daarheen, dus deze knop is niet optioneel.

         Voor het inloggen staat hij er NIET: dan zou hij je bij een toestel
         zonder inloggesprek achterlaten, en de weg vooruit is er maar een. */
      if(!dicht){
        var s=d.createElement('button');s.className='cmd-schil';
        s.innerHTML=svg('home')+'<span>Toestel</span>';
        s.onclick=function(){sluit();o.schil()};nav.appendChild(s);
      }
      // de kiezer achter de plus: hetzelfde aanbod, alleen op een breed scherm
      var kz=root.querySelector('.cmd-kiezer');
      if(!kz)return;
      kz.textContent='';
      werelden.map(function(x){return[x.naam,x.url]}).concat(APPS.map(function(a){return[a[0],a[1]]}))
        .forEach(function(p){var b=d.createElement('button');b.textContent=p[0];
          b.onclick=function(){kz.hidden=true;o.open(p[1],p[0])};kz.appendChild(b)});
    }

    function bouw(){
      vul();
      root.querySelector('.cmd-lade').onclick=function(){
        var aan=root.classList.toggle('bank-open');
        this.setAttribute('aria-expanded',aan?'true':'false');};
      /* Ook dicht door ernaast te tikken en met Escape: anders is de greep de
         enige uitweg, en dat is het soort scherm waar je op een telefoon in
         vast komt te zitten. Een tik OP de bank mag er niet doorheen vallen. */
      root.addEventListener('pointerdown',function(e){
        if(!root.classList.contains('bank-open'))return;
        if(e.target.closest('.cmd-bank')||e.target.closest('.cmd-lade'))return;
        sluit();});
      d.addEventListener('keydown',opEscape);
    }
    function opEscape(e){
      if(e.key!=='Escape'||!root||!root.classList.contains('bank-open'))return;
      var k=root.querySelector('.cmd-lade');sluit();if(k)k.focus();
    }
    return{bouw:bouw,sluit:sluit,vul:vul};
  };
})(window,document);
