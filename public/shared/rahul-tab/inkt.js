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

  var licht = helderheid(grondVan(tab.parentElement || tab)) > 0.35;
  tab.style.setProperty('color', licht ? '#3A3733' : '#F2EEE8', 'important');
  var sub = tab.querySelector('small');
  if (sub) sub.style.setProperty('color', licht ? '#5A5651' : '#8A8680', 'important');
})(window, document);
