/* De zonnewijzer voor de RTFoundation-apps. Zet twee dingen klaar zodat
   stijl.css het 4x4-palet kan tekenen:
   1. data-rtf-groep op <html> (de leeftijdsgroep van de app-ingang), zodat
      elke leeftijd zijn eigen grond en wasdiepte krijgt;
   2. shared/seizoen.js, die data-seizoen en data-dagdeel bijhoudt.
   De kleur van het scherm hangt zo af van leeftijd, seizoen en dagdeel.
   Zonder JavaScript blijft de vaste donkere huisstijl gewoon staan. */
(function (d) {
  'use strict';
  try {
    var g = localStorage.getItem('rtf_app_groep');
    d.documentElement.setAttribute('data-rtf-groep',
      ['mini', 'kind', 'tiener', 'jong', 'volw'].indexOf(g) >= 0 ? g : 'volw');
  } catch (e) {
    d.documentElement.setAttribute('data-rtf-groep', 'volw');
  }
  var l = d.createElement('link');
  l.rel = 'stylesheet';
  l.href = '/shared/dagkleur.css';
  d.head.appendChild(l);
  var s = d.createElement('script');
  s.src = '/shared/seizoen.js';
  s.defer = true;
  d.head.appendChild(s);
})(document);
