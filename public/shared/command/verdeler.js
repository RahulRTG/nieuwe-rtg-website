/* De SLEEPBARE SCHEIDING tussen twee bladen.

   Een eigen bestand omdat het een eigen onderwerp is: dit is het enige stuk van
   de werktafel dat alleen op een breed scherm bestaat. Op een telefoon staat er
   een blad in beeld en de rest als tabblad, dus valt er niets te verdelen.

   Hij tekent zichzelf elke keer opnieuw (de werktafel roept hem aan vanuit
   sync()), en dat is met opzet: het aantal bladen en de breedte kunnen allebei
   veranderd zijn. De inline `flex` die het slepen achterlaat wordt daarom eerst
   gewist -- zonder dat draagt een blad zijn desktopbreedte mee naar een smal
   venster. */
(function(w,d){
  'use strict';
  w.RTGCommandVerdeler=function(vak,panes,breed){
    var oud=vak.querySelector('.cmd-split');if(oud)oud.remove();
    panes.forEach(function(p){p.el.style.flex=''});
    if(panes.length!==2||!breed)return;
    var s=d.createElement('div');s.className='cmd-split';
    s.setAttribute('role','separator');s.setAttribute('aria-orientation','vertical');
    s.tabIndex=0;s.innerHTML='<i></i>';vak.insertBefore(s,panes[1].el);
    function zet(x){var r=vak.getBoundingClientRect(),pct=Math.max(30,Math.min(70,(x-r.left)/r.width*100));
      panes[0].el.style.flex='0 0 '+pct+'%';panes[1].el.style.flex='1 1 0'}
    /* Loslaten klikt vast op drie standen (35/50/65). Een vrije breedte
       onthouden zou een vierde bewaarplaats zijn naast de werkruimtes; drie
       standen zijn genoeg om te kiezen wat er dominant is. */
    function klaar(e){s.classList.remove('sleept');
      var r=vak.getBoundingClientRect(),p=(e.clientX-r.left)/r.width*100,n=p<42?35:p>58?65:50;
      panes[0].el.style.flex='0 0 '+n+'%';
      d.removeEventListener('pointermove',beweeg);d.removeEventListener('pointerup',klaar)}
    function beweeg(e){zet(e.clientX)}
    s.onpointerdown=function(e){e.preventDefault();s.classList.add('sleept');
      d.addEventListener('pointermove',beweeg);d.addEventListener('pointerup',klaar)};
    // met het toetsenbord: geen sleep maar meteen de buitenste twee standen
    s.onkeydown=function(e){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
      var n=e.key==='ArrowLeft'?35:65;panes[0].el.style.flex='0 0 '+n+'%'}};
  };
})(window,document);
