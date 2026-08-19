/* DE ROMP VAN HET MEUBEL: het enige stuk opmaak dat RTG Command zelf neerzet.

   Afgesplitst van werktafel.js toen dat over de 10 KB ging (LAT.md / check.js
   regel 13). De snede loopt langs een echte grens: hier staat HOE het meubel
   eruitziet, daar staat hoe het zich gedraagt. Het was ook het enige stuk waar
   je een knop kon toevoegen zonder een regel gedrag te schrijven, en dat hoort
   niet verstopt te zitten in een functie van tweeduizend tekens.

   De drie delen, van de ankerzijde naar de duimzijde en van boven naar onder:

     .cmd-bank      de werelden (nav) en de voet (Rahul, Instellingen,
                    Pagina-instellingen). Wat erin komt vult bank.js.
     .cmd-werk      de tabbladen, de bladen zelf, en de praatlaag
     .cmd-balk      de schilbalk onderin: lade, bladen, sluiten, Rahul.
                    Op een telefoon is dit het enige wat de schil laat zien
                    (ADAPTIEF.md).

   LINKS- OF RECHTSHANDIG, EN WAAROM DAT HIER STAAT EN NIET IN DE OPMAAK.
   ADAPTIEF.md zei "links is altijd de bank, rechts is altijd Rahul, nooit de
   plekken". Dat klopte maar voor een van de twee handen: de duimboog van een
   linkshandige is het spiegelbeeld, dus die had de bank onder zijn duim en
   Rahul buiten bereik. De regel is nu op ROLLEN geschreven -- de bank aan de
   ANKERZIJDE, Rahul aan de DUIMZIJDE -- en die belofte (er verschuift nooit
   iets) blijft daarmee heel, alleen per mens in plaats van per pixel.

   Spiegelen gebeurt hier in de DOM-VOLGORDE en niet met `order` in de opmaak.
   `order` verplaatst het beeld maar niet de leesvolgorde, en shared/adaptief/
   balk.js maakt daar met zoveel woorden een afspraak over: "een schermlezer
   leest ze waar ze staan". Een gespiegelde balk is een andere balk, geen
   omgeklapte.

   `svg` komt van buiten mee: de iconenset woont in werktafel.js en hoort niet
   op twee plekken te staan. */
(function (w, d) {
  'use strict';
  /* De hand kan MIDDEN IN EEN SESSIE wisselen, en dan moet het meubel opnieuw:
     de balk spiegelt in DOM-volgorde, dus omtekenen is de enige eerlijke manier.
     De luisteraar hangt hier en niet in werktafel.js, om twee redenen -- dit is
     de module die van de hand weet, en werktafel.js zat op 9966 van de 10240
     bytes (check.js regel 13).

     De open werkbladen krijgen het attribuut er meteen bij. Ze staan in een
     iframe met hun eigen document, en shared/hand.js draait daar pas bij een
     volgende lading; zonder deze lus zou een lid zijn schil zien spiegelen en
     het blad erin niet. Ze zijn altijd van dezelfde herkomst -- geheugen.js
     laat niets anders toe -- dus dit kan gewoon. */
  var opnieuw = null, geluisterd = false;
  function luister() {
    if (geluisterd) return;
    geluisterd = true;
    w.addEventListener('rtg-hand', function (e) {
      var h = (e && e.detail && e.detail.hand) || (w.RTGHand && w.RTGHand.is());
      [].forEach.call(d.querySelectorAll('.cmd-panes iframe'), function (f) {
        try { f.contentDocument.documentElement.setAttribute('data-hand', h); } catch (x) {}
      });
      if (opnieuw) opnieuw();
    });
  }
  w.RTGCommandRomp = function (svg, herbouw) {
    if (herbouw) opnieuw = herbouw;
    luister();
    var links = !!(w.RTGHand && w.RTGHand.links());
    /* De lade hoort aan de ankerzijde bij de bank, Rahul aan de duimzijde. Bij
       een linkshandige wisselen die twee uiteinden van plek; wat ertussen staat
       (de bladen en de sluitknop) houdt zijn eigen volgorde. */
    var lade = '<button class="cmd-lade" aria-label="Werelden" aria-expanded="false">' + svg('menu') + '</button>';
    var rahul = '<form class="cmd-vraagvorm"><input class="cmd-vraagveld" type="text" maxlength="300" autocomplete="off" aria-label="Vraag Rahul" placeholder="Vraag Rahul\u2026"><button class="cmd-vraagstuur" type="submit" aria-label="Stuur naar Rahul">' + svg('verder') + '</button></form><button class="cmd-mondknop" type="button" aria-label="Vraag Rahul"></button>';
    var midden = '<div class="cmd-balkbladen" role="tablist"></div><button class="cmd-balksluit" aria-label="Sluit dit werkblad" hidden>' + svg('kruis') + '</button>';
    var balk = '<div class="cmd-balk">' + (links ? rahul + midden + lade : lade + midden + rahul) + '</div>';
    return '<aside class="cmd-bank"><div class="cmd-adem"></div><nav class="cmd-nav" aria-label="Hoofdnavigatie"></nav><div class="cmd-bankvoet"><button data-cmd="settings">'+svg('instel')+'<span>Pagina-instellingen</span></button></div></aside><main class="cmd-werk"><div class="cmd-tabs" role="tablist"></div><button class="cmd-toevoeg" aria-label="Werkblad openen">'+svg('plus')+'</button><div class="cmd-kiezer" hidden></div><div class="cmd-panes"></div><div class="cmd-praat" role="log" aria-live="polite" hidden></div>' + balk + '</main>';
  };
})(window, document);
