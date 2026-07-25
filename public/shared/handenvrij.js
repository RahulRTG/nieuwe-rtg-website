/* Handen vrij: het hele OS te bedienen zonder muis, met de mond of met typen.

   Wat er al was: Rahul kon via de doe-routes elke toegestane API-actie uitvoeren
   met de eigen inlog van de gebruiker, en er was een microfoon-KNOP per app.
   Wat ontbrak was precies wat je nodig hebt om de muis te laten liggen:

   1. navigeren. Rahul kon dingen DOEN maar niet ergens NAARTOE. "Open de Salon"
      had geen pad, dus je moest alsnog klikken om ergens te komen. Dat lost dit
      lokaal op, zonder ronde langs de server: een tik-vrije sprong hoort
      onmiddellijk te zijn en ook te werken als het netwerk hapert.
   2. luisteren zonder klik. De microfoon was een knop.
   3. antwoord terug in spraak. Wie praat, kijkt niet.
   4. beginnen met typen. Ergens tikken hoort in de balk te belanden.

   De grens die dit bestand nooit overschrijdt: het herkent NAVIGATIE en anders
   niets. Een zin die het niet als navigatie leest, gaat integraal naar Rahul --
   die heeft de geld-drempel, de bevestiging en de functie-schakelkast. Zou dit
   bestand zelf gaan gokken wat een half-verstane zin betekent, dan zou een
   spraakfoutje een echte handeling worden. Verkeerd navigeren is hinderlijk;
   verkeerd handelen niet.

   De pure zinsontleding (versta) staat los getoetst in test/handenvrij.test.js;
   de balk, de microfoon en de stem leven alleen in de browser. */
(function (root) {
  'use strict';

  /* ---------- normaliseren ----------
     Spraak levert hoofdletters, punten en soms accenten. We vergelijken op een
     kale vorm, zonder lidwoorden aan het begin (open DE salon == open salon). */
  function kaal(t) {
    return String(t == null ? '' : t)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function zonderLidwoord(t) { return kaal(t).replace(/^(de|het|een|mijn|m n)\s+/, ''); }
  // hoffelijkheid en stopwoorden achteraan ("...de Salon zien", "...maar even")
  function zonderStaart(t) { return String(t).replace(/(\s+(zien|maar|even|nu|graag|alsjeblieft|alsjeblief|please))+$/, '').trim(); }

  // de werkwoorden waarmee een zin ECHT een sprong is; alleen aan het begin,
  // zodat "boek een taxi naar huis" gewoon een opdracht voor Rahul blijft
  // Let op de volgorde: het langste alternatief moet voorgaan, anders eet "ga"
  // de "ga naar" op. En geen spaties IN de alternatieven; het \s+ erachter doet
  // het scheiden (daar ging het eerst mis bij "laat me de Salon zien").
  var SPRONG = /^(?:open|ga naar|ga|naar|toon|laat me|laat mij|laat|breng me naar|breng me|terug naar|wissel naar|schakel naar)\s+/;

  var VAST = [
    { soort: 'terug', re: /^(terug|vorige|ga terug|een stap terug)$/ },
    { soort: 'vooruit', re: /^(vooruit|verder|volgende pagina)$/ },
    { soort: 'sluit', re: /^(sluit|sluiten|dicht|weg|klaar|stop maar|laat maar)$/ },
    { soort: 'omhoog', re: /^(omhoog|naar boven|boven|scroll omhoog)$/ },
    { soort: 'omlaag', re: /^(omlaag|naar onder|onder|beneden|scroll omlaag|verder naar beneden)$/ },
    { soort: 'begin', re: /^(helemaal naar boven|naar het begin|bovenaan)$/ },
    { soort: 'eind', re: /^(helemaal naar onder|naar het eind|onderaan)$/ },
    { soort: 'lijst', re: /^(wat kan ik zeggen|wat kan je|welke plekken|help|hulp|lijst)$/ },
    { soort: 'stil', re: /^(stil|stil maar|niet praten|hou op met praten|zwijg)$/ },
    { soort: 'luid', re: /^(praat maar|zeg het maar|hardop|praat weer)$/ }
  ];

  /* Zoek de bedoelde plek tussen de bekende plekken. Bewust conservatief: exact,
     dan hele-woord, dan begint-met. Geen letterafstand-gokwerk -- liever niets
     herkennen (en de vraag aan Rahul geven) dan de gebruiker ergens neerzetten
     waar ze niet om vroeg. */
  function zoekPlek(doel, plekken) {
    var d = zonderLidwoord(doel);
    if (!d || !plekken || !plekken.length) return null;
    var lijst = plekken.map(function (p) { return { p: p, k: zonderLidwoord(p.naam) }; })
      .filter(function (x) { return x.k; });
    var op = function (test) { var r = lijst.filter(test); return r.length === 1 ? r[0].p : null; };
    return op(function (x) { return x.k === d; })
      || op(function (x) { return new RegExp('(^| )' + d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |$)').test(x.k); })
      || op(function (x) { return x.k.indexOf(d) === 0; })
      || null;
  }

  /* De zin -> een bedoeling. Geeft altijd iets terug; wat niet als navigatie te
     lezen is, komt terug als { soort: 'vraag' } met de ONGEWIJZIGDE zin, zodat
     Rahul precies hoort wat er gezegd is. */
  function versta(zin, plekken) {
    var ruw = String(zin == null ? '' : zin).trim();
    var k = kaal(ruw);
    if (!k) return { soort: 'niets', zin: ruw };

    for (var i = 0; i < VAST.length; i++) if (VAST[i].re.test(k)) return { soort: VAST[i].soort, zin: ruw };

    var m = k.match(SPRONG);
    if (m) {
      var rest = zonderStaart(k.slice(m[0].length).trim());
      var plek = zoekPlek(rest, plekken);
      if (plek) return { soort: 'ga', plek: plek, zin: ruw };
      // een sprongwerkwoord zonder bekende plek is geen sprong: "open de deur"
      // hoort bij Rahul, die echt een hoteldeur kan openen
      return { soort: 'vraag', zin: ruw, gezocht: rest };
    }
    // een kale plaatsnaam mag ook: "salon", "bestellen"
    var alleen = zoekPlek(k, plekken);
    if (alleen && k.split(' ').length <= 4) return { soort: 'ga', plek: alleen, zin: ruw };
    return { soort: 'vraag', zin: ruw };
  }

  /* Het wekwoord eraf halen. In handsfree staat de microfoon open, dus moet er
     een grens zijn tussen tegen Rahul praten en praten in dezelfde kamer.

     Drie uitkomsten, en het verschil tussen de laatste twee is wezenlijk:
       null  de zin was niet aan Rahul gericht -- negeren
       ''    hij werd wel aangesproken, maar er stond geen opdracht bij
       tekst de opdracht, zonder het wekwoord, met de oorspronkelijke tekst */
  function gericht(zin, wakker) {
    var s = String(zin == null ? '' : zin).trim();
    var m = s.match(/^(?:hey|hoi|h[eé]|ok|oke|okay)?\s*rahul\b[\s,.:!?-]*/i);
    if (m) return s.slice(m[0].length).trim();
    return wakker ? s : null;
  }

  var api = { versta: versta, kaal: kaal, zoekPlek: zoekPlek, gericht: gericht };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Handenvrij = api;

  /* De browserkant staat apart, zodat dit bestand de zinsontleding blijft en
     niets anders. Alleen als er iemand is ingelogd halen we de balk erbij; een
     bezoeker zonder inlog krijgt geen extra script en geen extra verkeer. */
  if (typeof document === 'undefined' || !root.addEventListener) return;
  var ingelogd = false;
  try { ingelogd = !!(localStorage.getItem('rtg_member_token') || localStorage.getItem('rtg_sup_token')); } catch (e) {}
  if (!ingelogd || root.__handenvrijBalk) return;
  var s = document.createElement('script');
  s.src = '/shared/handenvrij-balk.js'; s.defer = true;
  document.head.appendChild(s);
})(typeof self !== 'undefined' ? self : this);
