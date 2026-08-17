/* De RTG-signatuurmond: EEN mond voor het hele systeem, nu in 3D. Duizenden
   lichtpuntjes op een eigen canvas (geen extern beeld): bordeaux als basis, goud
   erdoorheen geweven, een enkel wit puntje als glinstering, en een gouden
   lichtgolf die om de paar seconden door de lippen trekt. De onderlip beweegt
   mee als Rahul "praat".

   Nieuw: waar WebGL kan, leeft de mond echt. Dezelfde puntenwolk krijgt diepte
   (de lippen bollen naar je toe), een zachte parallax die met de muis/kanteling
   meebeweegt, en additief oplichtende puntjes. Kan het toestel geen WebGL of
   wil de bezoeker minder beweging (prefers-reduced-motion), dan valt hij netjes
   terug op exact het bestaande 2D-beeld. Zelfde API, zelfde gezicht.

   Het puntenveld zelf (de lipvorm + diepte) is een pure functie die ook in Node
   draait en los getoetst is (test/mond.test.js).

   Gebruik: geef een <canvas width="440" height="200"> mee; het CSS bepaalt de
   getoonde maat. RTGMond.maak(canvas) tekent en geeft { praat(ms) } terug om de
   onderlip kort te laten bewegen. Het tekenen pauzeert zodra het canvas uit
   beeld is (offsetParent === null), dus het is goedkoop als het niet zichtbaar is. */
(function (root) {
  'use strict';

  /* De mond ontsluit overal dezelfde Rahul-tab; de module kiest alleen een
     bestaande werkbladstrook en maakt nooit een zwevende balk. */
  if (typeof document !== 'undefined' && !root.__rahulTabStandaard) {
    var rahulTab = document.createElement('script');
    rahulTab.src = '/shared/rahul-tab.js?v=command6'; rahulTab.defer = true;
    document.head.appendChild(rahulTab);
  }

  /* ---- de pure kern: het puntenveld met diepte (ook in Node) ----
     De lipvormen als functies: de middellijn met cupidoboog, de boog van de
     bovenlip en de boog van de onderlip (mondhoeken op x=50 en x=170). Elk punt
     krijgt een z: de lippen bollen naar de kijker toe, de middellijn ligt terug. */
  function puntenVeld(rand) {
    var rnd = rand || Math.random;
    var PUNTEN = [];
    var midden = function (x) { return 52 - 6 * Math.exp(-Math.pow(x - 110, 2) / 98); };
    var boven = function (x) { var t = (x - 110) / 60; return 52 - 24 * Math.pow(Math.max(0, 1 - t * t), 0.8) + 7 * Math.exp(-Math.pow(x - 110, 2) / 72); };
    var onder = function (x) { var t = (x - 110) / 60; return 52 + 27 * Math.pow(Math.max(0, 1 - t * t), 0.9); };
    var bult = function (x) { return Math.exp(-Math.pow(x - 110, 2) / 2600); };   // lipvolume naar het midden toe
    for (var i = 0; i < 2400; i++) {
      var lip = rnd() < 0.45 ? 'b' : 'o';
      var x = 50 + rnd() * 120;
      var y1 = lip === 'b' ? boven(x) : midden(x), y2 = lip === 'b' ? midden(x) : onder(x);
      if (y2 - y1 < 0.8) continue;
      var r = rnd();
      var diep = (y2 - y1) > 0 ? (((y1 + (y2 - y1) / 2) - y1) / (y2 - y1)) : 0;
      // z: de bovenlip iets naar voren, de onderlip iets voller; puntjes aan de
      // rand van de lip liggen wat verder terug dan het midden van de lip
      var lipMidden = 1 - Math.abs((0.5 - ((((y1 + (y2 - y1) / 2)) - y1) / Math.max(0.001, y2 - y1))) * 2);
      var z = (lip === 'b' ? 0.20 : 0.26) * bult(x) * (0.55 + 0.45 * lipMidden);
      PUNTEN.push({ x: x, y: y1 + rnd() * (y2 - y1), lip: lip,
        fase: rnd() * Math.PI * 2, maat: 0.5 + rnd() * 0.9,
        kleur: r < 0.62 ? '#9E1C40' : (r < 0.9 ? '#C9A24B' : '#FFFFFF'),
        diep: diep, z: z });
    }
    // de gouden middellijn loopt door tot voorbij de mondhoeken en vervaagt; ligt terug
    for (var j = 0; j < 420; j++) {
      var mx = 14 + rnd() * 192;
      PUNTEN.push({ x: mx, y: midden(Math.min(170, Math.max(50, mx))) + (rnd() - 0.5) * 1.6,
        lip: 'm', fase: rnd() * Math.PI * 2, maat: 0.4 + rnd() * 0.7,
        kleur: '#C9A24B', rand: Math.min(1, Math.min(mx - 14, 206 - mx) / 55), diep: 0, z: -0.05 });
    }

    /* DE TEKENING IN HET MIDDEN VAN ZIJN EIGEN DOEK.

       Beide tekenaars gebruiken y=52 als draaipunt: WebGL rekent -(y-52)/60 en
       de 2D-terugval schaalt om diezelfde lijn. Maar de mond zelf loopt van
       ongeveer 35 tot 79, dus zijn werkelijke midden ligt op 57 -- vijf eenheden
       LAGER dan het draaipunt. Gevolg: de mond hing in zijn doek naar beneden,
       met bovenin een strook leegte. Op de poort was dat te zien als een gat
       tussen de wijzerplaat en de lippen: de dozen overlapten keurig 10px,
       maar de INKT begon pas 21px onder de klok. Twee keer heb ik dat aan de
       doos gemeten en niet aan wat er staat.

       Het midden wordt hier UITGEREKEND en niet ingetikt, zodat het klopt
       blijft als iemand de lipvormen aanpast. Meteen wordt het draaipunt van
       de "breed"-vervorming het echte midden, dus die duwt de mond nu ook niet
       meer scheef. */
    var laag = Infinity, hoog = -Infinity;
    for (var q = 0; q < PUNTEN.length; q++) {
      if (PUNTEN[q].lip === 'm') continue;          // de vervagende middellijn telt niet mee
      if (PUNTEN[q].y < laag) laag = PUNTEN[q].y;
      if (PUNTEN[q].y > hoog) hoog = PUNTEN[q].y;
    }
    if (laag < hoog) {
      var schuif = 52 - (laag + hoog) / 2;
      for (var w = 0; w < PUNTEN.length; w++) PUNTEN[w].y += schuif;
    }
    return PUNTEN;
  }

  /* ---- de spraakmotor: hoe een echte mond beweegt ----

     Een sinus op de onderlip leest als een pratende brievenbus. Een echte mond
     doet drie dingen tegelijk, en juist de combinatie maakt het levend:

       kaak     de onderlip zakt met de kaak mee -- traag, want een kaak heeft
                massa. Dit is de grootste beweging en loopt achter op de rest.
       spreiding een "ie" trekt de mondhoeken breed en maakt de lippen dun; een
                "oe" duwt ze samen en vooruit. Dat is een aparte spier en dus
                een aparte, snellere golf.
       ronding  de tuit: lippen naar voren, mondhoeken naar binnen.

     Die drie samen zijn in de praktijk wat animators visemen noemen. We wekken
     ze met drie trage ruisgolven van verschillende snelheid, zodat er nooit een
     herkenbaar patroon ontstaat -- spraak is onregelmatig, en precies dat
     onregelmatige overtuigt. Er zit ook stilte in: tussen twee lettergrepen valt
     de mond even bijna dicht, en aan het eind van een zin sluit hij helemaal.

     Alles is een pure functie van de tijd, dus zowel WebGL als 2D gebruiken hem
     en hij is in Node te toetsen. */
  function golfje(t, snelheid, zaad) {   // vloeiende pseudo-ruis, [0,1]
    var x = t * snelheid + zaad;
    return 0.5 + 0.5 * (Math.sin(x) * 0.6 + Math.sin(x * 1.7 + 1.3) * 0.3 + Math.sin(x * 2.9 + 2.7) * 0.1);
  }
  /* De stand van de mond op tijdstip t, gegeven hoe lang er nog gepraat wordt.
     Geeft: kaak (0..1 open), breed (-1 getuit .. +1 gespreid), duw (0..1 naar
     voren), scheef (kleine asymmetrie: geen mens is symmetrisch). */
  function mondStand(t, praatTot) {
    var over = praatTot - t;
    if (over <= 0) return { kaak: 0, breed: 0, duw: 0, scheef: 0 };
    // in- en uitloop: een zin begint en eindigt niet met een klap
    var aan = Math.min(1, Math.max(0, over / 180));                  // laatste 180ms: dichtvallen
    var lettergreep = golfje(t, 0.011, 0);                           // ~2,5 per seconde: het ritme
    var stilte = Math.max(0, 1 - Math.pow(Math.max(0, lettergreep - 0.28) / 0.72, 0.7));
    var kaak = Math.max(0, lettergreep - 0.26) / 0.74;               // onder de drempel is de mond dicht
    kaak = Math.pow(kaak, 1.35) * (1 - stilte * 0.55) * aan;         // niet-lineair: dicht blijft dicht
    var breed = (golfje(t, 0.0072, 11.3) - 0.5) * 2 * (0.35 + 0.65 * kaak) * aan;
    var duw = Math.max(0, -breed) * 0.8 * aan;                       // getuit = naar voren
    var scheef = (golfje(t, 0.0041, 27.1) - 0.5) * 0.22 * aan;
    return { kaak: kaak, breed: breed, duw: duw, scheef: scheef };
  }

  var api = { puntenVeld: puntenVeld, mondStand: mondStand };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
