/* De ruimte onder de AI-balk.

   Op de gespreks-pagina's (Salon, Berichten, Genootschap, Metier) staat de
   balk van Rahul vast onderaan het scherm (position:fixed). Hij groeit mee met
   wat Rahul terugzegt: het antwoordvak mag tot 9rem hoog worden. De pagina's
   reserveerden daar een vaste 6rem voor. Dat klopt zolang de balk leeg is, en
   niet meer zodra er een antwoord in staat -- dan legt de balk zich over de
   onderste knoppen van de pagina heen. Op een klein scherm (een telefoon in
   liggende stand, een venster van 500px hoog) is dat een derde van het beeld,
   en is de laatste knop niet meer aan te klikken.

   Deze laag meet de balk zoals hij op dat moment werkelijk is en zet de
   reservering daarop: altijd precies genoeg ruimte eronder, en nooit meer dan
   nodig. Staat de balk er niet (of is hij weg), dan wint de eigen regel van de
   pagina weer. */
(function () {
  'use strict';

  function start() {
    var balk = document.querySelector('.aibalk');
    if (!balk) return;

    function meet() {
      var hoog = balk.hidden ? 0 : Math.ceil(balk.getBoundingClientRect().height);
      /* leeg zetten, niet op 0: dan geldt de padding-bottom uit de pagina zelf */
      document.body.style.paddingBottom = hoog ? 'calc(' + hoog + 'px + 1rem)' : '';
    }

    meet();
    /* de balk groeit als Rahul antwoordt */
    if (window.ResizeObserver) new ResizeObserver(meet).observe(balk);
    /* en hij komt met [hidden] tevoorschijn; dat ziet een ResizeObserver niet */
    if (window.MutationObserver) {
      new MutationObserver(meet).observe(balk, { attributes: true, attributeFilter: ['hidden'] });
    }
    window.addEventListener('resize', meet);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
