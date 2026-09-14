/* ============================================================================
   DE EERSTE ECHTE BRON -- vacatures, als vondsten in plaats van als deur.

   ./openingen-kaart.js zegt voor het terrein `werk`: *"hier staan de
   vacatures"*. Dat is een deur. Dit is wat erachter staat: de openstaande
   vacatures zelf, gegoten in de etiketten van ./aanvoer.js.

   WAAROM WERK EN NIET EEN ANDER TERREIN. Het is het enige van de vijf waar de
   Adam-keten helemaal doorheen loopt (scripts/adamproef.js): van een doel naar
   een vacature naar een sollicitatie naar aangenomen naar een bericht dat
   aankomt. De andere vier hebben die keten niet, en een aanvoer bouwen op een
   terrein waarvan je de uitgang niet kent, is aanbod tonen dat nergens heen
   gaat.

   HIJ FILTERT NIET OP DE MENS, EN DAT IS DE HELE INZET. `openVacatures` neemt
   een `minLeeftijd` en die wordt hier bewust NIET meegegeven -- niet vergeten
   maar geweigerd. De aanvoerlaag krijgt de mens niet (zie de handtekening van
   `vondsten()` in ./aanvoer.js), dus er is hier geen leeftijd om op te filteren,
   en dat is precies FOUNDATION.md par. 5: een eligibility-motor mag alleen
   toevoegen. Wat een vacature van zichzelf EIST staat in `wat` -- zichtbaar
   voor de mens, en nooit door ons toegepast op de mens. Vergelijk
   /api/rtf/vacatures: die filtert wel, op een leeftijd die de CLIENT meestuurt,
   en dat is een keuze van dat scherm en niet van deze laag.

   DE AFKAP IS EEN AANTAL EN GEEN OORDEEL. Meer dan `MAX` vacatures worden niet
   gewogen maar afgekapt in de volgorde waarin de bron ze geeft, met het
   GEVONDEN totaal erbij. Sorteren zou een rangorde zijn, en EXECUTIE.md staat
   daar met de afkapgrens die midden in een GELIJKE score sneed: willekeur die
   eruitziet als een oordeel. Hier is de willekeur zichtbaar in plaats van
   verkleed.

   GEEN TWEEDE VACATURELIJST. Hij leest `openVacatures` uit kern/werk.js en
   bouwt niets eigens op -- dezelfde regel die in de kop van ./openingen.js
   staat: deze laag is LEZER van wat er al is.
   ========================================================================== */
'use strict';

const { terreinenVan, KAART } = require('./openingen');

/* Hoeveel vacatures er hoogstens als vondst terugkomen. Een getal en geen
   instelling: wie hem verhoogt, verhoogt het antwoord van een route. */
const MAX = 25;

/* Bouwt de werkbron op `openVacatures` uit kern/werk.js.

   HIJ KRIJGT EEN OPHALER EN NIET DE FUNCTIE ZELF, en dat is geen omslachtigheid
   maar een reparatie. De route wordt gemonteerd in opzet/aanbouw3.js, en de
   kern-tas is op dat moment nog niet volledig gevuld; wie daar
   `const { openVacatures } = kern` schrijft, bevriest `undefined`. De kop van
   dat bestand waarschuwt er letterlijk voor (*"een kopie op montagemoment zou
   undefined bevriezen"*) en het is hier prompt gebeurd: de bron gaf stilletjes
   een lege lijst, en dat zag er precies zo uit als "er zijn geen vacatures".
   Dezelfde vorm als `meldLidVan()` in kern/werk-bezorging.js.

   Geeft een functie die aan ./aanvoer.js past: EEN randvoorwaarde erin, een
   lijst ruwe vondsten eruit. Meer krijgt zij niet, en dat is de bedoeling. */
function maakWerkbron(openVacaturesVan) {
  const kaart = KAART.werk;

  return function werkbron(voorwaarde) {
    const openVacatures = typeof openVacaturesVan === 'function' ? openVacaturesVan() : null;
    /* GOOIEN EN NIET ZWIJGEN. Een lege lijst zou hier "er is niets gevonden"
       betekenen, terwijl het "deze bron is niet aangesloten" is. ./aanvoer.js
       vangt dit op en zet het in `geweigerd` met de reden -- zichtbaar, precies
       zoals kern/ontvanger.js het van zijn wegen eist. */
    if (typeof openVacatures !== 'function')
      throw new Error('openVacatures is hier niet beschikbaar; staat hij in GRENZEN.json voor dit domein, ' +
        'en wordt hij laat opgehaald in plaats van bij het monteren?');
    /* Ligt deze randvoorwaarde uberhaupt op `werk`? Die vraag wordt niet hier
       beantwoord maar door ./openingen.js, met dezelfde woordenlijst als de
       rest van de laag. Een tweede oordeel hier zou een tweede waarheid zijn
       over waar een knelpunt ligt. */
    if (!terreinenVan(voorwaarde).includes('werk')) return [];

    /* Geen leeftijd en geen land: de eerste kent deze laag niet, de tweede is
       een keuze van de mens en niet van ons. */
    const alle = openVacatures(null, null);
    if (!Array.isArray(alle))
      throw new Error('openVacatures gaf geen lijst terug');

    /* Het gevonden totaal gaat mee terug. Zonder dat getal leest "25
       vacatures" als "er zijn er 25", en dat is een stille onwaarheid -- de
       vorm staat in de kop van ./aanvoer-bronnen.js. */
    return { gevonden: alle.length, vondsten: alle.slice(0, MAX).map((v) => ({
      terrein: 'werk',
      /* Wat de vacature van zichzelf eist, staat hier -- zichtbaar en niet
         toegepast. */
      wat: [v.func, v.bedrijf && ('bij ' + v.bedrijf), v.plaats, v.uren,
        v.minLeeftijd ? ('vanaf ' + v.minLeeftijd + ' jaar') : null]
        .filter(Boolean).join(' - '),
      ingang: kaart.ingang,
      /* De dektNiet van de KAART en niet een eigen zin: een vacature is nog
         geen inkomen, en dat hoort overal hetzelfde te luiden. */
      dektNiet: kaart.dektNiet,
      /* Een vacature noemt geen aantal plekken. `null` leest als "niet
         nagegaan" en nooit als vol of leeg. */
      beschikbaarheid: null
    })) };
  };
}

module.exports = { maakWerkbron, MAX };
