/* DE BEWEGINGSLEER: scrollpositie als bestuurbare waarde.

   WAAROM DIT BESTAAT. Een scherm "met wat animaties" is een scherm met wat
   animaties: twintig losse listeners, twintig getallen die iemand ooit met de
   hand heeft uitgeprobeerd, en op de vijfde pagina weet niemand meer waarom
   iets op 872px begint. Dat schaalt niet naar de hoeveelheid schermen die dit
   huis heeft. Wat wel schaalt is EEN motor met EEN variabele: waar bevindt de
   lezer zich binnen deze scene, uitgedrukt als 0 tot 1.

   DE REGEL, IN EEN ZIN: beweging wordt GEDECLAREERD en niet geprogrammeerd --
   een scene zegt WAT er van waar naar waar gaat en tussen welke twee standen
   van de voortgang, en deze laag rekent daaruit elke frame de stand uit.

   Dit bestand is de LEER en niet het meubel: rekenen, de vormtaal van een
   declaratie, de budgetten per apparaat, en de keuring die zegt of een
   declaratie deugt. Geen DOM, geen listener, geen stijl -- die staan in
   shared/beweging/. Zo meet test/beweging.test.js deze regels in Node zonder
   browser, en meet hij de regel zelf en niet een kopie ervan (LAT.md regel 4).

   DRIE GRENZEN DIE NIET MOGEN SNEUVELEN.

   1. VERBERGEN BESTAAT NIET (ADAPTIEF.md). Een declaratie die inhoud naar
      opacity 0 brengt en daar laat staan, haalt die inhoud van het scherm af
      voor wie niet verder scrolt. Dat mag alleen als er iets anders voor in de
      plaats komt: een tekstwissel declareert zijn tegenhanger, of hij zakt.

   2. RUSTIG IS DE EINDSTAND EN NIET DE BEGINSTAND. Wie bewegingsanimaties uit
      heeft staan, hoort de pagina AF te zien -- niet leeggelopen op de eerste
      frame van een animatie die nooit komt. `rekenStand` met `rustig` geeft
      daarom de stand op voortgang 1 en zonder transform, en dat is niet iets
      wat een blad per ongeluk goed kan doen.

   3. DE TELEFOON HEEFT EEN EIGEN BUDGET. Dezelfde declaratie, kleinere
      uitslag: een scene die op een bureau prachtig loopt kost op een toestel
      van EUR 250 frames. Het budget staat hier als GRENS en niet als smaak --
      `keur` weigert een declaratie die er overheen gaat, met de reden erbij.

   Levert window.RTGBewegingLeer, en in Node module.exports. */
(function (root) {
  'use strict';

  /* --------------------------------------------------------- het rekenen --
     Drie functies, en alle drie puur. Alles wat deze laag verder doet is een
     samenstelling hiervan; daarom staat hier geen vierde. */

  /* Houdt een waarde binnen zijn oevers. */
  function klem(waarde, min, max) {
    return Math.min(Math.max(waarde, min), max);
  }

  /* Mengt twee waarden. t=0 geeft van, t=1 geeft naar. */
  function meng(van, naar, t) {
    return van + (naar - van) * t;
  }

  /* Snijdt een deeltijdlijn uit de voortgang. Een scene loopt van 0 tot 1;
     een onderdeel daarbinnen loopt bijvoorbeeld van 0,15 tot 0,55 en heeft
     daarbinnen zijn EIGEN 0 tot 1. Zonder dit gaat alles tegelijk bewegen, en
     dat is precies het verschil tussen levendig en onrustig.

     Een bereik van nul lengte is geen deling door nul maar een schakelaar:
     voor het punt 0, erna 1. Dat is de eerlijke uitkomst en niet NaN. */
  function bereik(voortgang, start, eind) {
    if (eind <= start) return voortgang < start ? 0 : 1;
    return klem((voortgang - start) / (eind - start), 0, 1);
  }

  /* ---------------------------------------------------- de versnellingen --
     Lineair ziet er mechanisch uit: een ding dat op volle snelheid begint en
     op volle snelheid stopt beweegt als een machine en niet als een voorwerp.
     Vier curves, meer heeft dit huis niet nodig; wie een vijfde toevoegt zet
     hem hier en niet in een blad. */
  var VERSNELLING = {
    lineair: function (t) { return t; },
    in: function (t) { return t * t; },
    uit: function (t) { return 1 - (1 - t) * (1 - t); },
    zacht: function (t) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
  };

  /* --------------------------------------------------------- de budgetten --
     GEMETEN OP EEN BUREAU, GEGOKT OP EEN TELEFOON -- dat is de eerlijke stand,
     en daarom zijn dit grenzen en geen streefwaarden. De telefooncijfers zijn
     de bovengrens waaronder een scene op een middenklassetoestel niet in de
     weg gaat zitten; ze zijn niet op een echt toestel gemeten. Wie dat wel
     doet, verzet ze hier en nergens anders.

     De vormgrens is 768 en niet 1000: ADAPTIEF.md's `bureau` gaat over WELKE
     handelingen er passen, dit gaat over HOEVEEL beweging een toestel trekt.
     Twee vragen, twee getallen -- ze horen niet op elkaar te lijken. */
  var BUDGET = {
    telefoon: {
      grens: 768,          /* px; hieronder geldt het telefoonbudget */
      hoogte: 220,         /* vh die een scene mag scrollen */
      schaal: 1.06,        /* hoeveel een beeld maximaal mag groeien */
      verschuiving: 60,    /* px die een laag maximaal mag verschuiven */
      lagen: 2             /* parallaxlagen naast de inhoud */
    },
    bureau: {
      hoogte: 300,
      schaal: 1.25,
      verschuiving: 200,
      lagen: 4
    }
  };

  /* ------------------------------------------------------ de vormtaal ------
     Een declaratie is data en geen code. Dat is het hele punt: een nieuwe
     spectaculaire pagina hoort een configuratie te zijn en geen tweede
     animatiebestand.

       { element: 'beeld',
         schaal:  { van: 0.85, naar: 1.15, start: 0.15, eind: 0.70, versnelling: 'zacht' },
         x:       { van: 160,  naar: 0,    start: 0.05, eind: 0.50 },
         opacity: { van: 0,    naar: 1,    start: 0,    eind: 0.20 } }

     De namen zijn de eigenschappen die de browser goedkoop kan verplaatsen.
     `left`, `top`, `width` en `height` staan er bewust NIET tussen: die laten
     de pagina elke frame opnieuw indelen, en dat is de duurste fout die je in
     deze laag kunt maken. Wie ze toch nodig heeft, heeft geen beweging nodig
     maar een andere indeling. */
  var KANALEN = {
    x: { eenheid: 'px', vorm: 'transform' },
    y: { eenheid: 'px', vorm: 'transform' },
    schaal: { eenheid: '', vorm: 'transform' },
    draai: { eenheid: 'deg', vorm: 'transform' },
    kantel: { eenheid: 'deg', vorm: 'transform' },
    opacity: { eenheid: '', vorm: 'opacity' },
    onthul: { eenheid: '%', vorm: 'clip-path' }
  };

  /* --------------------------------------------------------- het rekenen --
     Van een declaratie plus een voortgang naar de stand van een element.
     Puur: geen DOM, geen tijd, geen toeval. Twee keer dezelfde invoer geeft
     twee keer dezelfde uitvoer, en dat is wat hem toetsbaar maakt. */
  function baan(spec, voortgang) {
    if (!spec) return null;
    var f = VERSNELLING[spec.versnelling || 'zacht'] || VERSNELLING.zacht;
    var t = f(bereik(voortgang, spec.start == null ? 0 : spec.start,
      spec.eind == null ? 1 : spec.eind));
    return meng(spec.van, spec.naar, t);
  }

  function rekenStand(decl, voortgang, omgeving) {
    var omg = omgeving || {};
    /* GRENS 2. Rustig is de EINDSTAND. Niet "geen beweging" (dan blijft een
       element dat op opacity 0 begint onzichtbaar), maar: het scherm zoals het
       eruitziet als de animatie klaar is, meteen. */
    var p = omg.rustig ? 1 : klem(voortgang, 0, 1);
    var demping = omg.vorm === 'telefoon' ? dempingVoor(decl) : 1;

    var stukken = [];
    var x = baan(decl.x, p);
    var y = baan(decl.y, p);
    if (x != null || y != null) {
      stukken.push('translate3d(' + rond((x || 0) * demping) + 'px,' +
        rond((y || 0) * demping) + 'px,0)');
    }
    var s = baan(decl.schaal, p);
    if (s != null) stukken.push('scale(' + rond(1 + (s - 1) * demping) + ')');
    var d = baan(decl.draai, p);
    if (d != null) stukken.push('rotate(' + rond(d * demping) + 'deg)');
    /* Kantelen is rotateY en dus diepte. De `perspective` hoort daarbij op de
       OUDER en niet hier: deze laag schrijft de hele transform van het element,
       dus een perspective die het blad in diezelfde eigenschap zet, is bij de
       eerste frame weg. Dat is precies wat er gebeurde. */
    var k = baan(decl.kantel, p);
    if (k != null) stukken.push('rotateY(' + rond(k * demping) + 'deg)');

    var stand = {};
    /* Rustig krijgt geen transform mee. Een eindstand van scale(1.25) is nog
       steeds beweging die iemand niet gevraagd heeft; de inhoud hoort daar
       gewoon te staan zoals het blad hem zet. */
    if (stukken.length && !omg.rustig) stand.transform = stukken.join(' ');
    var o = baan(decl.opacity, p);
    if (o != null) stand.opacity = String(rond(klem(o, 0, 1)));
    var c = baan(decl.onthul, p);
    if (c != null) stand.clipPath = 'inset(0 0 0 ' + rond(klem(c, 0, 100)) + '%)';
    return stand;
  }

  /* Een telefoon krijgt dezelfde declaratie met minder uitslag, en de demping
     volgt uit het budget in plaats van uit een tweede, met de hand
     bijgehouden declaratie. Twee declaraties voor hetzelfde scherm lopen
     binnen een half jaar uit elkaar; deze niet. */
  function dempingVoor(decl) {
    var f = 1;
    if (decl.schaal) {
      var uitslag = Math.abs(decl.schaal.naar - decl.schaal.van);
      var mag = BUDGET.telefoon.schaal - 1;
      if (uitslag > mag) f = Math.min(f, mag / uitslag);
    }
    ['x', 'y'].forEach(function (as) {
      if (!decl[as]) return;
      var u = Math.abs(decl[as].naar - decl[as].van);
      if (u > BUDGET.telefoon.verschuiving) {
        f = Math.min(f, BUDGET.telefoon.verschuiving / u);
      }
    });
    return f;
  }

  function rond(n) { return Math.round(n * 1000) / 1000; }

  /* ---------------------------------------------------------- de keuring --
     Wat hier zakt, zakt vóór het op een scherm staat. Elke uitslag noemt WAT
     er mis is en HOE het wel kan -- een keuring die alleen "ongeldig" zegt,
     wordt omzeild in plaats van gevolgd. */
  function keur(scene) {
    var fouten = [];
    var bewegingen = (scene && scene.bewegingen) || [];
    if (!scene || !scene.soort) fouten.push('een scene zonder soort: zet `soort` op een naam uit het register');

    var hoogte = scene && scene.hoogte;
    if (hoogte != null && hoogte > BUDGET.bureau.hoogte) {
      fouten.push('scene van ' + hoogte + 'vh gaat over het budget van ' +
        BUDGET.bureau.hoogte + 'vh: knip hem in twee scenes');
    }

    bewegingen.forEach(function (b, i) {
      var waar = 'beweging ' + i + (b.element ? ' (' + b.element + ')' : '');
      if (!b.element) fouten.push(waar + ': geen element genoemd');
      Object.keys(b).forEach(function (sleutel) {
        if (sleutel === 'element' || sleutel === 'wisselt') return;
        if (!KANALEN[sleutel]) {
          fouten.push(waar + ': `' + sleutel + '` is geen kanaal van deze laag' +
            (sleutel === 'left' || sleutel === 'top' || sleutel === 'width' ||
              sleutel === 'height'
              ? ' -- die eigenschap deelt de pagina elke frame opnieuw in; gebruik x, y of schaal'
              : ' -- kies uit ' + Object.keys(KANALEN).join(', ')));
          return;
        }
        var spec = b[sleutel];
        if (!spec || typeof spec.van !== 'number' || typeof spec.naar !== 'number') {
          fouten.push(waar + ': `' + sleutel + '` mist `van` of `naar`');
          return;
        }
        var s = spec.start == null ? 0 : spec.start;
        var e = spec.eind == null ? 1 : spec.eind;
        if (s < 0 || e > 1) fouten.push(waar + ': `' + sleutel + '` loopt buiten 0..1 -- de voortgang van een scene kent geen elfde deel');
        if (e < s) fouten.push(waar + ': `' + sleutel + '` eindigt voor hij begint (' + s + ' -> ' + e + ')');
        if (spec.versnelling && !VERSNELLING[spec.versnelling]) {
          fouten.push(waar + ': versnelling `' + spec.versnelling + '` bestaat niet -- kies uit ' +
            Object.keys(VERSNELLING).join(', '));
        }
      });

      /* GRENS 1. Verbergen bestaat niet. Wie iets wegneemt, zegt wat ervoor in
         de plaats komt -- `wisselt` noemt het element dat de boodschap
         overneemt. Zonder dat is dit een handeling die op het scherm bestond
         en er daarna niet meer is, en dat is precies wat ADAPTIEF.md verbiedt. */
      if (b.opacity && b.opacity.naar === 0 && !b.wisselt) {
        fouten.push(waar + ': verdwijnt naar opacity 0 zonder `wisselt` -- ' +
          'noem het element dat de boodschap overneemt, of laat hem staan');
      }
    });

    return { deugt: fouten.length === 0, fouten: fouten };
  }

  /* --------------------------------------------------------- de omgeving --
     Welke vorm, en beweegt hij? In Node zonder browser is het antwoord
     `bureau` en rustig=false; dat is een aanname en geen meting, dus staat hij
     hier en niet verstopt in een blad. */
  function omgeving(venster) {
    var w = venster || (typeof window !== 'undefined' ? window : null);
    if (!w) return { vorm: 'bureau', rustig: false, gemeten: false };
    var rustig = false, breed = w.innerWidth || BUDGET.telefoon.grens + 1;
    try {
      rustig = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { /* een omgeving zonder matchMedia beweegt gewoon */ }
    return {
      vorm: breed <= BUDGET.telefoon.grens ? 'telefoon' : 'bureau',
      rustig: rustig,
      gemeten: true
    };
  }

  /* Hoe hoog een scene hoort te zijn, gegeven de vorm. Een blad dat dit zelf
     uitrekent, rekent het over een half jaar anders uit. */
  function sceneHoogte(scene, vorm) {
    var budget = BUDGET[vorm === 'telefoon' ? 'telefoon' : 'bureau'];
    var gevraagd = (scene && scene.hoogte) || BUDGET.bureau.hoogte;
    return Math.min(gevraagd, budget.hoogte);
  }

  var leer = {
    klem: klem, meng: meng, bereik: bereik,
    VERSNELLING: VERSNELLING, BUDGET: BUDGET, KANALEN: KANALEN,
    baan: baan, rekenStand: rekenStand, keur: keur,
    omgeving: omgeving, sceneHoogte: sceneHoogte
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = leer;
  if (root) root.RTGBewegingLeer = leer;
})(typeof window !== 'undefined' ? window : null);
