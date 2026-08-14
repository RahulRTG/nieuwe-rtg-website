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

    function bouw(){
      var nav=root.querySelector('.cmd-nav');
      /* De KLOK bovenaan: niet de landing, wel waar de werelden op hun bezel
         hangen (WERELD.md). Hij vouwt de werktafel op in plaats van een blad te
         openen. Voor het inloggen staat hij er NIET -- dan zou hij je bij een
         klok zonder inloggesprek achterlaten, en de weg vooruit is er maar een. */
      if(!dicht){
        var k=d.createElement('button');k.className='cmd-klok';
        k.innerHTML=svg('home')+'<span>Beginscherm</span>';
        k.onclick=function(){sluit();o.thuis()};nav.appendChild(k);
      }
      APPS.forEach(function(a){
        var b=d.createElement('button');b.innerHTML=svg(a[2])+'<span>'+a[0]+'</span>';
        if(!dicht)b.dataset.url=a[1];
        /* Kiezen sluit de lade: op een telefoon ligt die over het blad dat je
           net opende. In de gesloten stand is er geen dode deur maar de cursor
           in het gesprek dat hem opent. */
        b.onclick=dicht?function(){sluit();o.inlog()}
                       :function(){sluit();o.open(a[1],a[0]);};
        nav.appendChild(b);
      });
      // de kiezer achter de plus: dezelfde werelden, alleen op een breed scherm
      var kz=root.querySelector('.cmd-kiezer');
      APPS.forEach(function(a){var b=d.createElement('button');b.textContent=a[0];
        b.onclick=function(){kz.hidden=true;o.open(a[1],a[0])};kz.appendChild(b)});

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
    return{bouw:bouw,sluit:sluit};
  };
})(window,document);
