/* ============================================================================
   AANVOER -- DE VIERDE BRON: ONDERNEMEN.

   Zie ./aanvoer.js voor het contract. Deze bron bestaat omdat een mens die zegt
   "ik wil een eigen bedrijf beginnen" bij een kaal doel werk-, opleiding- en
   opvangwegen kreeg en geen enkele ondernemersweg -- terwijl kern/onderneming/
   precies dat pad draagt (intake, verkenning, stress test, plan, rechtsvorm,
   oprichting). Het gat zat dus niet in de motor maar in de DEKKING van de kaart.

   WAT ER IS, EN WAT ER NIET IS -- nagezocht op 11 oktober 2026 en niet
   aangenomen. Voor de vier routes uit de vraag:

     een plan voorbereiden      ER IS.   /api/onderneming/nieuw en verder:
                                         verkenning, stress test, acht
                                         hoofdstukken (kern/onderneming/plan.js).
     rechtsvormen, plichten     ER IS.   kern/onderneming/rechtsvorm.js, met per
                                         vorm de aansprakelijkheid, de
                                         verplichtingen en de oprichtingsstappen.
     financiering               ER IS NIETS. Geen lening, krediet, subsidie of
                                         investeerder buiten het spel Magnaat, en
                                         een spelbank is geen financiering.
     andere ondernemers, een    ER IS NIETS. kern/rtfos/ondernemers.js is wat een
     eerste klant, een partner           BEDRIJF de RTFoundation aanbiedt, op een
                                         kantoorcode; de pijplijn volgt offertes
                                         die al binnenkomen.

   Wat er niet is, levert hier GEEN vondst en ook geen lege belofte: het staat in
   de `dektNiet` van het terrein (./openingen-kaart.js), want dat is de zin die
   een lezer anders zelf invult. Een vondst "zoek financiering" zonder bron
   erachter zou precies de opening zijn die dit huis niet kan waarmaken.

   WAAROM EEN REQUIRE EN GEEN OPHALER UIT DE KERN. De andere drie bronnen krijgen
   een late getter op de kern-tas, omdat hun bron STAAT draagt (vacatures, een
   bibliotheek met een eigen instantie, bezetting). Het rechtsvormregister is
   data zonder database, en ./rechtsvormwacht.js werkt hem IN PLACE bij -- de
   require-cache geeft dus hetzelfde levende object als de route die hem toont.
   Via de kern zou er een naam bij komen die een tweede domein deelt
   (`kernGedeeld` in scripts/grenzen.js, alleen omlaag), voor niets.

   EN DE GRENS DIE HIER LIGT, en die bij deze bron scherper is dan bij de andere:
   een rechtsvorm wordt in dit huis OPGEGEVEN en nooit afgeleid (kop van
   kern/onderneming/rechtsvorm.js -- "gokken zou hier betekenen dat iemand op de
   verkeerde belastingaangifte wordt gezet"). Deze bron noemt dus geen vorm die
   "bij u past" en kiest er geen een uit. Hij zegt wat er is, en dat het register
   per land is: welk land, dat weet deze laag niet en vraagt hij niet.
   ========================================================================== */
'use strict';

const { terreinenVan, KAART } = require('./openingen');

/* Het register zelf, laat opgehaald zodat een toets een ander register kan
   meegeven. Zonder argument: de echte, levende tabel. */
const echtRegister = () => require('../onderneming/rechtsvorm').RECHTSVORMEN;
const echteHoofdstukken = () => require('../onderneming/plan').HOOFDSTUKKEN;

function maakOndernemenbron(registerVan = echtRegister, hoofdstukkenVan = echteHoofdstukken) {
  const kaart = KAART.ondernemen;

  return function ondernemenbron(voorwaarde) {
    /* Ligt deze randvoorwaarde op `ondernemen`? Dat beslist ./openingen.js met
       dezelfde woordenlijst als de rest van de laag, en niet deze bron. */
    if (!terreinenVan(voorwaarde).includes('ondernemen')) return [];

    const register = typeof registerVan === 'function' ? registerVan() : null;
    const hoofdstukken = typeof hoofdstukkenVan === 'function' ? hoofdstukkenVan() : null;
    /* GOOIEN EN NIET ZWIJGEN: een leeg register zou lezen als "er zijn geen
       rechtsvormen", en dat is een uitspraak die niemand deed. */
    if (!register || typeof register !== 'object' || !Object.keys(register).length)
      throw new Error('aanvoer-ondernemen: het rechtsvormregister is leeg of niet bereikbaar');
    if (!Array.isArray(hoofdstukken) || !hoofdstukken.length)
      throw new Error('aanvoer-ondernemen: de hoofdstukken van het plan zijn niet bereikbaar');

    const vormen = Object.values(register);
    const landen = new Set(vormen.map((v) => v.land));
    /* De Nederlandse vormen bij naam, in de volgorde van het register. Dat is
       geen keuze voor Nederland als land van deze mens -- die kent deze laag
       niet -- maar de enige tabel waar de verplichtingen ook mee REKENEN
       (kern/onderneming/belasting.js weigert een ander land). */
    const nl = vormen.filter((v) => v.land === 'NL').map((v) => v.label);

    const vondsten = [
      {
        terrein: 'ondernemen',
        wat: vormen.length + ' rechtsvormen in ' + landen.size + ' landen, elk met de aansprakelijkheid, ' +
          'de verplichtingen en de oprichtingsstappen' + (nl.length ? ' (in Nederland: ' + nl.join(', ') + ')' : ''),
        ingang: kaart.ingang,
        dektNiet: 'Dit is voorlichting en geen advies welke vorm bij u past: een rechtsvorm wordt hier ' +
          'opgegeven en nooit afgeleid. Inschrijven bij de KvK, de notaris en de belastingdienst doet u ' +
          'zelf; RTG dient niets namens u in. Voor een land dat niet in deze lijst staat zegt RTG dat het ' +
          'de vormen niet kent, en zet het er geen Nederlandse lijst voor in de plaats.',
        beschikbaarheid: null
      },
      {
        terrein: 'ondernemen',
        wat: 'Een verkenning met stress test en een ondernemingsplan in ' + hoofdstukken.length +
          ' hoofdstukken (' + hoofdstukken.join(', ') + '), dat u zelf vastlegt',
        ingang: '/api/onderneming/nieuw',
        /* DE ZIN OVER WIE ERBIJ KAN STAAT ERIN, want deze vondst reist ook naar
           de gezinsingang (/api/rtf/knelpunt) en daar is deze deur dicht. Een
           vondst die naar een deur wijst die voor deze lezer dicht zit, is de
           stille non-bezorging uit de kop van ./aanvoer.js -- dus wordt het
           gezegd in plaats van dat de vondst wordt weggelaten. */
        dektNiet: 'Deze ingang vraagt een RTG-account; vanuit de gezinsingang van de RTFoundation is hij ' +
          'vandaag dicht. Het plan rekent met wat u zelf opgeeft en wordt niet met verzonnen alinea\'s ' +
          'aangevuld. Het is geen financiering, geen toezegging van een bank en geen oordeel of uw idee ' +
          'slaagt. Een advies "niet starten" uit de stress test kunt u bewust opzijzetten; dat wordt dan ' +
          'met het advies erbij vastgelegd.',
        beschikbaarheid: null
      }
    ];
    /* Het gevonden totaal gaat mee, ook al wordt er niets afgekapt: zonder dat
       getal staat `gevonden` op null, en dat leest als "niet nagegaan". */
    return { gevonden: vondsten.length, vondsten };
  };
}

module.exports = { maakOndernemenbron };
