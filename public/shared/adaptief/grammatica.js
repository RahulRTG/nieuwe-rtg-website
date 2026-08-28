/* DE GRAMMATICA: de vaste manier waarop alle RTG-software op een telefoon denkt.

   shared/adaptief.js zegt WAAR een handeling terechtkomt (welke presentatie op
   welke vorm). Dit bestand zegt HOE je hem aanraakt en WAT hij weegt. Samen zijn
   ze de taal; GRAMMATICA.md schrijft ze uit in zinnen.

   Waarom dat een taal moet zijn en geen verzameling gewoontes: er staan 184
   schermen in dit huis. Als lang drukken in Docs "meer gereedschap" betekent en
   in Geld "verwijderen", dan heeft een lid geen taal geleerd maar 184 dialecten,
   en durft hij nergens meer iets vast te houden. Een gebaar heeft hier dus EEN
   betekenis, overal.

   Drie tabellen, en ze zijn alle drie gesloten:

     GEBAREN    wat een aanraking betekent. Vijf, en niet meer.
     GEWICHT    wat een handeling kost als hij fout gaat, en hoeveel zekerheid
                daarbij hoort. Vijf trappen, van direct tot plechtig.
     VERHINDERD waarom iets niet kan. Nooit alleen grijs.

   Puur: geen DOM, geen globale staat. test/grammatica.test.js meet deze regels
   in Node, en meet daarmee de regel zelf en niet een kopie ervan.

   Levert window.RTGGrammatica, en in Node module.exports. */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------- de gebaren --
     EEN GEBAAR, EEN BETEKENIS. Dat is de hele afspraak, en hij is streng
     bedoeld: wie hier een zesde bijzet, of `lang` in zijn scherm iets anders
     laat doen, breekt de taal voor alle andere schermen mee.

     `omkeerbaar` zegt of het gebaar zelf iets verandert. Tikken doet dat, de
     andere vier niet -- die openen, leggen uit of tonen. Dat is de reden dat
     alleen `tik` een gewicht kan dragen: een gebaar dat alleen laat zien, hoeft
     nooit bevestigd te worden. */
  var GEBAREN = {
    tik:      { doet: 'doe of open',        verandert: true  },
    lang:     { doet: 'leg uit of toon',    verandert: false },
    omhoog:   { doet: 'meer gereedschap',   verandert: false },
    selectie: { doet: 'verander de acties', verandert: false },
    orb:      { doet: 'stel voor',          verandert: false }
  };

  /* ---------------------------------------------------------- het gewicht --
     LAGE GEVOLGEN = SNELHEID, HOGE GEVOLGEN = ZEKERHEID. Niet overal dezelfde
     wrijving, en vooral niet overal dezelfde vraag: een systeem met twintig
     "weet u het zeker?"-meldingen voelt niet veilig, het leert mensen op ja
     drukken. Dan staat die vraag er ook bij de ene keer dat het ertoe deed.

     De trappen, met wat ze KOSTEN aan handelingen van de gebruiker:

     licht     vet maken, een kop zetten. Gebeurt. Nul extra handelingen.
     terug     archiveren, delen met een collega. Gebeurt, en er staat een
               regel "Ongedaan maken" -- sneller EN veiliger dan vooraf vragen.
     bewust    extern delen. Je ziet eerst WIE het krijgt en WELKE
               classificatie eraan hangt. Een vraag met inhoud, geen "zeker?".
     zwaar     tienduizend salarissen uitvoeren. Vasthouden om te bevestigen,
               met een reden, en het gaat het journaal in.
     plechtig  een kwart miljoen overmaken. Klaarzetten, nakijken, en een MENS
               bevestigt. Nooit in een keer, en nooit door de AI.

     `ongedaan` betekent: deze trap belooft een weg terug. `reden` betekent: er
     wordt om een reden gevraagd en die wordt bewaard. `mens` betekent: dit mag
     niet door een geautomatiseerde stap worden afgemaakt -- dezelfde grens die
     GELD.md trekt (geld verlaat het huis nooit vanzelf) en LIFE.md (samenstellen
     en klaarzetten mag, bevestigen doet de mens). */
  var GEWICHT = {
    licht:    { trap: 0, vraagt: false, ongedaan: false, reden: false, mens: false },
    terug:    { trap: 1, vraagt: false, ongedaan: true,  reden: false, mens: false },
    bewust:   { trap: 2, vraagt: true,  ongedaan: true,  reden: false, mens: false },
    zwaar:    { trap: 3, vraagt: true,  ongedaan: false, reden: true,  mens: false },
    plechtig: { trap: 4, vraagt: true,  ongedaan: false, reden: true,  mens: true  }
  };
  var TRAPPEN = Object.keys(GEWICHT);

  /* Hoe lang je moet vasthouden, per trap. Alleen `zwaar` en `plechtig` kennen
     dat; de rest is een gewone tik. 900ms is lang genoeg om niet per ongeluk te
     gebeuren en kort genoeg om niet als kapot te voelen -- en er loopt een
     zichtbare vulling mee, want een knop die niets doet terwijl je hem
     vasthoudt, IS kapot voor wie het niet weet. */
  var VASTHOUD = { zwaar: 900, plechtig: 1200 };

  /* -------------------------------------------------------- verhinderd --
     WAAROM KAN IK DIT NIET? Een grijze knop is een raadsel, en een raadsel in
     bedrijfssoftware wordt een telefoontje naar de beheerder.

     Een verhindering draagt daarom altijd twee dingen: een REDEN in gewone taal,
     en de BRON die hem stelt -- beleid, classificatie, een ontbrekend stuk, een
     bevoegdheid, of de toestand van het moment. Zonder bron is "dat mag niet"
     een mening; met bron is het een verwijzing die iemand kan natrekken.

     `los` zegt of de gebruiker er zelf iets aan kan doen. Dat is geen detail:
     "vraag Finance om goedkeuring" is een volgende stap, "dit document is
     Vertrouwelijk" is een feit waar je omheen moet werken. */
  var BRONNEN = {
    beleid:        { los: false, zin: 'Het beleid van uw organisatie staat dit niet toe.' },
    classificatie: { los: false, zin: 'De classificatie van dit stuk staat dit niet toe.' },
    bevoegdheid:   { los: true,  zin: 'U heeft hier zelf geen bevoegdheid voor.' },
    bewijs:        { los: true,  zin: 'Er ontbreekt een stuk dat hiervoor nodig is.' },
    toestand:      { los: true,  zin: 'Dit kan nu even niet; de toestand is nog niet rond.' }
  };

  function lijst(x) { return Array.isArray(x) ? x.slice() : (x ? [x] : []); }

  /* De verhindering in zijn vaste vorm. Een string mag ook binnenkomen -- dan is
     dat de reden en is de bron `toestand`, want "het kan nu niet" is de enige
     verhindering die zonder verdere uitleg te begrijpen is. */
  function verhindering(v) {
    if (!v) return null;
    if (typeof v === 'string') v = { reden: v };
    var bron = BRONNEN[v.bron] ? v.bron : 'toestand';
    return { reden: String(v.reden || ''), bron: bron, los: BRONNEN[bron].los,
      stap: v.stap ? String(v.stap) : '' };
  }

  /* Wat een verhinderde handeling ZEGT. De reden van de aanroeper gaat voor:
     "Extern delen is uitgeschakeld omdat dit document als Vertrouwelijk is
     geclassificeerd" is beter dan welke algemene zin ook. De algemene zin is het
     vangnet, niet het antwoord. */
  function uitleg(v) {
    var h = verhindering(v);
    if (!h) return '';
    return h.reden || BRONNEN[h.bron].zin;
  }

  /* ------------------------------------------------------------ de keuring --
     Vier bevindingen, en ze komen alle vier uit dezelfde zorg: een taal die op
     een plek anders wordt gesproken, is geen taal meer.

     `gebaar`      een gebaar dat niet bestaat, of dat iets anders doet dan zijn
                   betekenis. `lang` mag nooit iets veranderen -- lang drukken op
                   een knop waarvan je niet weet wat hij doet, is precies het
                   moment waarop je NIET wilt dat er iets gebeurt.
     `gewicht`     een trap die niet bestaat.
     `redenloos`   een verhindering zonder reden. Dat is de grijze knop die dit
                   hele stuk moet uitbannen.
     `zwaarzonder` een zware of plechtige handeling zonder weg terug EN zonder
                   dat er om een reden wordt gevraagd. Dan is er niets: geen
                   herstel en geen spoor. */
  function keur(specs) {
    var uit = [];
    (Array.isArray(specs) ? specs : []).forEach(function (c) {
      var waar = (c && c.id) || '(zonder id)';
      var g = (c && c.gewicht) || 'licht';
      if (!GEWICHT[g]) { uit.push({ soort: 'gewicht', id: waar, wat: 'gewicht "' + g + '" bestaat niet' }); g = 'licht'; }
      lijst(c && c.gebaren).forEach(function (naam) {
        if (!GEBAREN[naam]) uit.push({ soort: 'gebaar', id: waar, wat: 'gebaar "' + naam + '" bestaat niet' });
      });
      if (c && c.verhinderd) {
        var h = verhindering(c.verhinderd);
        if (!h.reden) uit.push({ soort: 'redenloos', id: waar, wat: 'verhinderd zonder reden in gewone taal' });
      }
      var G = GEWICHT[g];
      if (G.trap >= 3 && !G.reden && !G.ongedaan) {
        uit.push({ soort: 'zwaarzonder', id: waar, wat: g + ' hoort een reden of een weg terug te hebben' });
      }
    });
    return uit;
  }

  /* Mag deze handeling zonder meer gebeuren zodra iemand tikt? Alleen de twee
     lichtste trappen. De rest gaat langs shared/adaptief/gewicht.js. */
  function directMag(gewicht) {
    var G = GEWICHT[gewicht] || GEWICHT.licht;
    return !G.vraagt;
  }

  var gram = { GEBAREN: GEBAREN, GEWICHT: GEWICHT, TRAPPEN: TRAPPEN, VASTHOUD: VASTHOUD,
    BRONNEN: BRONNEN, verhindering: verhindering, uitleg: uitleg, keur: keur, directMag: directMag };

  if (typeof module !== 'undefined' && module.exports) { module.exports = gram; return; }
  root.RTGGrammatica = gram;
})(typeof self !== 'undefined' ? self : this);
