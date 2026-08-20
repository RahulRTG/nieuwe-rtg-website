/* Het platformregister (deelmodule): DE BEDIENING -- wat NIET schakelbaar is,
   en waarom.

   Een eigen bestand omdat het een TABEL is en geen logica, en omdat
   ../platformregister.js er met deze tabel erin over de 10 KB ging
   (keuringsregel 13). Die grens is een dakpan: eroverheen betekent dat er een
   tweede onderwerp in zit, en dat was hier ook zo.

   92 routes vallen buiten de functiecatalogus. Dat leek een gat en het is er
   geen: het is de bediening van het platform zelf. Een schakelaar die de
   schakelkast uitzet is geen schakelaar, en een gezondheidscontrole die je kunt
   uitzetten is geen gezondheidscontrole.

   Ze stonden alleen nergens ALS ZODANIG opgeschreven -- ze vielen gewoon door
   functieVoorPad() heen. Precies hetzelfde patroon als `mw` bij de bewakers: een
   restpost die leest als "vergeten" terwijl het een eigen soort is. Daarom hier
   met naam en reden, en de lijst is uitputtend: wat er niet op staat, komt als
   'onbenoemd' terug en valt op. */
module.exports = [
  ['/api/boardroom', 'De boardroom', 'Het hoogste bedieningspaneel: schakelen, storingen, onboarding, betalingen.',
    'de boardroom bedient de schakelkast; een schakelaar die de schakelkast uitzet is geen schakelaar'],
  ['/api/techniek', 'De technische pagina', 'Inzicht in de motor: logboeken, sleutels, herstel, uitrol.',
    'gereedschap van de eigenaar en de techniek; uitschakelbaar gereedschap is geen gereedschap'],
  ['/api/scim', 'SCIM-koppeling', 'De standaardkoppeling waarmee een werkgever accounts aanlevert en intrekt.',
    'een koppeling die stil uit kan staan laat accounts achter die hadden moeten verdwijnen'],
  ['/api/privacy', 'Privacyrechten', 'Inzage, export en verwijdering: de rechten van de betrokkene.',
    'een wettelijk recht is geen functie met een schakelaar'],
  ['/api/toestemming', 'Toestemming', 'Waar een lid ja of nee zegt tegen een verwerking.',
    'zie privacyrechten: de grondslag zelf is niet schakelbaar'],
  ['/api/metrics', 'Meetpoort', 'De cijfers voor de bewaking, achter een token of het interne net.',
    'de opstelling beslist hier (RTG_METRICS_TOKEN), niet een schakelaar op het bord'],
  ['/api/health', 'Gezondheidscontrole', 'Draait deze server, en is hij klaar voor verkeer.',
    'een gezondheidscontrole die je kunt uitzetten meldt nooit meer iets'],
  ['/api/ready', 'Gereedheidscontrole', 'Mag deze server verkeer krijgen van de verdeler.',
    'een verdeler die niet meer te vragen is of hij mag sturen, stuurt naar een server die nog niet klaar is'],
  ['/api/cluster', 'Clusterbediening', 'Het samenspel tussen meerdere servers.',
    'infrastructuur, geen ledenfunctie'],
  ['/api/sat', 'Satellietverbinding', 'De noodverbinding buiten het gewone net om.',
    'een noodweg hoort niet af te hangen van een schakelaar op het bord'],
  ['/api/toestel', 'Toestelregistratie', 'Welk apparaat is dit, en mag het meedoen.',
    'hoort bij de identiteit van het toestel, niet bij een functie'],
  ['/apps', 'De voordeur', 'De pagina-routes en de bundels die elke pagina dragen.',
    'zonder voordeur is er geen huis om iets in te schakelen'],
  /* DE VIER DIE DE STRENGE PADREGEL AAN HET LICHT BRACHT. Ze vielen eerst onder
     '/' omdat de eigen padmatcher hier geen grens kende; met de gedeelde regel
     (functies/toegang.js prefixLengte) kwamen ze als onbenoemd terug. Dat is
     precies waarvoor die lijst bestaat. */
  ['/scriptbundel.js', 'De scriptbundel', 'Het gebundelde javascript dat elke pagina van dit huis draagt.',
    'een bundel die je uit kunt zetten haalt in een klap elke pagina onderuit; dit is levering, geen functie'],
  ['/stijlbundel.css', 'De stijlbundel', 'De gebundelde stijl die elke pagina van dit huis draagt.',
    'zelfde reden als de scriptbundel: zonder stijl is er geen huis om iets in te schakelen'],
  ['/media', 'Medialevering', 'Het uitleveren van geuploade bestanden op naam.',
    'de levering zelf is geen functie; wat je met media MAG staat in de functies die ze maken en tonen'],
  /* WAARSCHIJNLIJK HOORT DEZE BIJ EEN FUNCTIE EN NIET HIER. /werken/:code is de
     publieke ingang van de wervingslink. De functie die daarbij hoort heet
     'werving' (cat-partners, pad /api/werving).

     Deze notitie noemde eerst 'tg-werving', en dat was een dubbele schakelaar
     die exact hetzelfde pad claimde en daardoor niets deed; die is inmiddels
     verwijderd. Een notitie die naar een verdwenen functie verwijst is precies
     de stille veroudering waar dit register tegen is gebouwd, dus hier de
     gecorrigeerde versie.

     Wat NIET is gedaan en waarom: /werken aan de functie 'werving' hangen zou
     betekenen dat het uitzetten van die functie ook de publieke ingang sluit.
     Dat is waarschijnlijk de bedoeling, maar het VERANDERT wat een schakelaar
     uitzet, en dat is een besluit en geen reparatie. */
  ['/werken', 'Wervingsingang', 'De publieke link waarmee een werkgever iemand binnenhaalt; stuurt door naar de inlog.',
    'staat hier als BEKENDE onvolkomenheid: hij hoort vermoedelijk bij de functie Wervingslink (werving), maar hem daar aanhangen verandert wat die schakelaar uitzet'],
  ['/', 'De ingang', 'Wie naar / gaat, komt via een interne herschrijving op de inlog uit.',
    'de ingang van het huis is geen functie die je uit kunt zetten; zonder ingang is er niets om in te schakelen']
];
