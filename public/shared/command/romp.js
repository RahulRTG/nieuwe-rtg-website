/* DE ROMP VAN HET MEUBEL: het enige stuk opmaak dat RTG Command zelf neerzet.

   Afgesplitst van werktafel.js toen dat over de 10 KB ging (LAT.md / check.js
   regel 13). De snede loopt langs een echte grens: hier staat HOE het meubel
   eruitziet, daar staat hoe het zich gedraagt. Het was ook het enige stuk waar
   je een knop kon toevoegen zonder een regel gedrag te schrijven, en dat hoort
   niet verstopt te zitten in een functie van tweeduizend tekens.

   De drie delen, van links naar rechts en van boven naar onder:

     .cmd-bank      de werelden (nav) en de voet (Rahul, Instellingen,
                    Pagina-instellingen). Wat erin komt vult bank.js.
     .cmd-werk      de tabbladen, de bladen zelf, en de praatlaag
     .cmd-balk      de schilbalk onderin: lade, bladen, sluiten, Rahul.
                    Op een telefoon is dit het enige wat de schil laat zien
                    (ADAPTIEF.md).

   `svg` komt van buiten mee: de iconenset woont in werktafel.js en hoort niet
   op twee plekken te staan. */
(function (w) {
  'use strict';
  w.RTGCommandRomp = function (svg) {
    return '<aside class="cmd-bank"><div class="cmd-adem"></div><nav class="cmd-nav" aria-label="Hoofdnavigatie"></nav><div class="cmd-bankvoet"><button data-cmd="settings">'+svg('instel')+'<span>Pagina-instellingen</span></button></div></aside><main class="cmd-werk"><div class="cmd-tabs" role="tablist"></div><button class="cmd-toevoeg" aria-label="Werkblad openen">'+svg('plus')+'</button><div class="cmd-kiezer" hidden></div><div class="cmd-panes"></div><div class="cmd-praat" role="log" aria-live="polite" hidden></div><div class="cmd-balk"><button class="cmd-lade" aria-label="Werelden" aria-expanded="false">'+svg('menu')+'</button><div class="cmd-balkbladen" role="tablist"></div><button class="cmd-balksluit" aria-label="Sluit dit werkblad" hidden>'+svg('kruis')+'</button><form class="cmd-vraagvorm"><input class="cmd-vraagveld" type="text" maxlength="300" autocomplete="off" aria-label="Vraag Rahul" placeholder="Vraag Rahul\u2026"><button class="cmd-vraagstuur" type="submit" aria-label="Stuur naar Rahul">'+svg('verder')+'</button></form><button class="cmd-mondknop" type="button" aria-label="Vraag Rahul"></button></div></main>';;
  };
})(window);
