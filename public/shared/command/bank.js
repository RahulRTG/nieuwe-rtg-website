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

    /* DE VOET: HET SYSTEEM, EN WAAROM DAT GEEN WERELD IS.

       Hier stond één knop, Instellingen, en die gaat over het werkblad dat
       openstaat. Daar staat nu het bedieningspaneel naast: thema, helderheid,
       taal, achtergrond, en de tegels scannen, je Zegel, je backoffice, de pin,
       push, zoeken, meldingen en uitloggen.

       Dat paneel woont in de schil (apps/app.html) en niet hier. Het stond
       achter het springboard, en dat springboard is als scherm verdwenen -- dus
       zou je uitlogknop met hem mee zijn gegaan. De schil blijft daarom als
       doorzichtige la boven de werktafel staan (command.css) en dit is de kruk
       eraan.

       De lijst komt van BUITEN, net als de werelden: app-main weet welke
       panelen er zijn en hoe je ze opent, deze module niet. Een pagina zonder
       app-main krijgt hier gewoon niets extra's -- dan is er ook geen paneel om
       te openen. */
    function vulVoet(){
      var voet=root&&root.querySelector('.cmd-bankvoet');if(!voet)return;
      voet.querySelectorAll('[data-systeem]').forEach(function(b){b.remove()});
      if(dicht)return;                 // voor het inloggen valt er niets te bedienen
      var lijst=[];
      try{lijst=(o.systeem&&o.systeem())||[]}catch(e){}
      /* Omgekeerd doorlopen omdat elke deur VOOR de eerste wordt gezet: zo staat
         de lijst er straks in de volgorde waarin hij is aangereikt, met
         Instellingen (die hier vast staat) onderaan. */
      lijst.filter(function(x){return x&&x.naam&&typeof x.doe==='function'}).reverse()
        .forEach(function(x){
          var b=d.createElement('button');b.dataset.systeem='1';
          b.innerHTML=svg(x.teken||'instel');
          var t=d.createElement('span');t.textContent=x.naam;b.appendChild(t);
          b.onclick=function(){sluit();x.doe()};
          voet.insertBefore(b,voet.firstChild);
        });
    }

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
        nav.appendChild(kopje('Apps'));
        werelden.forEach(function(x){nav.appendChild(deur(x.naam,x.url,x.teken))});
      }
      vulVoet();
      // de kiezer achter de plus: hetzelfde aanbod, alleen op een breed scherm
      var kz=root.querySelector('.cmd-kiezer');
      if(!kz)return;
      kz.textContent='';
      werelden.map(function(x){return[x.naam,x.url]})
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
