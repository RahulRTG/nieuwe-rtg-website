/* DE INKT VAN DE RAHUL-TAB HANGT AF VAN DE BALK WAAR HIJ IN HANGT.

   style-base.js zet twee vaste grijzen (#99918a voor het woord, #746d67 voor
   KOMPAS) en die zijn gekozen voor een donkere balk. De a11y-scan mat wat dat
   oplevert:

     bestellen.html  balk #F7F5F1 (licht)   #99918a  ->  2,85:1
     wereld.html     balk #0C0C0B (donker)  #746d67  ->  3,78:1

   Allebei te weinig, en in tegengestelde richting -- op een lichte balk is het
   grijs te licht, op een donkere is de KOMPAS-regel te donker. Een derde vast
   grijs lost dat niet op: er bestaat geen middengrijs dat op #F7F5F1 EN op
   #0C0C0B 4,5:1 haalt. Dus meten we de grond en kiezen we de inkt, hetzelfde
   patroon als de dagkleur-inkt in shared/dagkleur.css.

   De gekozen waarden, doorgerekend: op donker #F2EEE8 (ruim) en #8A8680
   (5,41:1, de --grey-soft uit CLAUDE.md); op licht #3A3733 (10,9:1) en #5A5651
   (6,18:1). !important omdat style-base.js dat ook gebruikt.

   WAAROM DIT EEN EIGEN DEELBESTAND IS. Het stond eerst in shared/rahul-tab.js
   zelf, en dat bestand kwam daarmee op 12,0 KB -- over de grens van 10 KB die
   check.js regel 13 bewaakt. Die grens is geen formaliteit: rahul-tab.js draagt
   de tab, het venster, het gesprek en de goedkeuringen, en elke bladzijde die
   erbij komt maakt hem moeilijker te lezen. De naad lag er al: dit bestand hoort
   bij de rij delen die de tab zelf inlaadt (style-base, style-twin, helpers,
   dialog, kompas, workspace). Die worden met async=false geladen en draaien dus
   NA het script dat de tab maakt -- de tab bestaat hier gegarandeerd al. */
(function (w, d) {
  'use strict';
  var tab = d.querySelector('.rtg-rahul-tab');
  if (!tab) return;

  function grondVan(el) {
    for (var n = el; n && n !== d.documentElement; n = n.parentElement) {
      var m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(n).backgroundColor || '');
      if (m && (m[4] === undefined || Number(m[4]) > 0.5)) return [+m[1], +m[2], +m[3]];
    }
    var b = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(d.body).backgroundColor || '');
    return b ? [+b[1], +b[2], +b[3]] : [12, 12, 11];   // zonder grond: de huiskleur, donker
  }
  function helderheid(rgb) {
    var k = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
  }

  /* GEEN DREMPEL MEER, MAAR EEN VERGELIJKING -- en dat is de aanvulling van
     19 augustus 2026.

     Hierboven stond `helderheid(grond) > 0.35` en daarachter twee vaste paren.
     Een drempel werkt zolang de grond een van de twee uitersten is. Zodra de
     contrastronde verlopen kon lezen bleek er een derde soort te bestaan: een
     MIDDENTOON. Op de goudgetinte tab haalde de KOMPAS-regel 4,07:1 en op een
     lichte pagina, waar de balk naar grijs composeert, 2,37. Allebei onder de
     norm, en allebei onzichtbaar voor een drempel -- die zegt alleen licht of
     donker, nooit "geen van beide genoeg".

     Ik heb eerst geprobeerd de GRONDMETING slimmer te maken (doorzichtige lagen
     mengen). Dat keerde de keuze op sommige schermen om: de tab koos de lichte
     inkt op een donkere grond. Die poging staat hier niet meer, want een meting
     die ik niet kan narekenen is geen verbetering.

     Wat er nu staat kan niet omklappen: van de twee inkten wint degene met de
     hoogste gemeten verhouding tot de grond. Geen grens om verkeerd te zetten.
     De zachte onderregel mag alleen zacht blijven als hij zelf de norm haalt --
     8px halfvet is geen grote tekst, dus 4,5 en niet 3. */
  function verhouding(a, b) {
    var l1 = helderheid(a), l2 = helderheid(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function rgbVan(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }

  var grond = grondVan(tab.parentElement || tab);
  var opLicht = verhouding(rgbVan('#14110E'), grond);
  var opDonker = verhouding(rgbVan('#FFFFFF'), grond);
  var licht = opLicht > opDonker;                 // welke kant geeft meer contrast?
  var woord = licht ? '#3A3733' : '#F2EEE8';
  if (verhouding(rgbVan(woord), grond) < 4.5) woord = licht ? '#14110E' : '#FFFFFF';
  /* DE ZACHTERE ONDERREGEL IS VERVALLEN, en dat is een besluit met een reden.
     Hij stond op #5A5651 of #8A8680 en zakte op elke MIDDENTOON: 4,07:1 op de
     goudgetinte tab, 2,37 op een lichte pagina. Die toon veilig houden vraagt een
     grondmeting die klopt, en grondVan() hierboven meet iets anders dan de
     keuring -- die mengt doorzichtige lagen, deze niet. Ik heb geprobeerd hem
     gelijk te trekken en dat keerde de inktkeuze op sommige schermen om.
     Een verschil dat je niet kunt narekenen, mag geen leesbaarheid dragen. Dus
     draagt de onderregel dezelfde inkt als het woord: iets minder zacht, en
     altijd te lezen. */
  var zacht = woord;
  tab.style.setProperty('color', woord, 'important');
  var sub = tab.querySelector('small');
  if (sub) sub.style.setProperty('color', zacht, 'important');
})(window, document);
