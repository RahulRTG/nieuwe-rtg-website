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
  ['/api/inzagekaart', 'De inzagekaart', 'Wie heeft er in uw dossier gekeken, wanneer en met welke reden.',
    'zien wie in uw gegevens keek is hetzelfde AVG-recht als inzage zelf; een knop die dat dichtzet hoort niet te bestaan'],

  /* DE ZELFBEDIENING VAN HET LID OVER ZIJN EIGEN ACCOUNT.

     Zes prefixen die met de samenvoeging binnenkwamen en aan geen enkele
     functie hingen. Ze staan hier en niet in de functiecatalogus om dezelfde
     reden als /api/privacy drie regels hierboven: dit is geen dienst die je
     aanbiedt maar het beheer van je eigen account, en een schakelaar erop zet
     iets uit wat een lid altijd hoort te kunnen.

     Bij de beveiligingskant is dat het scherpst: een schakelaar op tweefactor
     of op het sluiten van sessies is een knop waarmee het huis de verdediging
     van een lid uitzet zonder dat dat lid er iets over te zeggen heeft. Bij het
     herstelkanaal geldt hetzelfde een slag erger -- wie daar de deur dichtzet,
     sluit iemand buiten zijn eigen account.

     De postkant is de enige waar je over kunt twijfelen, en daar staat het
     antwoord in het recht zelf: afmelden voor post is geen voorkeur die RTG
     mag intrekken. */
  ['/api/mijn/tweefactor', 'Tweefactor van het lid', 'Aanzetten, bevestigen, herstelcodes en weer uitzetten.',
    'een schakelaar hierop zet de verdediging van een lid uit zonder dat het lid daar iets over te zeggen heeft'],
  ['/api/mijn/sessies', 'Eigen sessies', 'Waar ben ik ingelogd, en het op afstand sluiten daarvan.',
    'een lid moet altijd een sessie kunnen sluiten die hij niet vertrouwt; dat is geen dienst maar een noodrem'],
  ['/api/mijn/herstelkanaal', 'Herstelkanaal', 'Het e-mailadres of telefoonnummer waarmee je weer binnenkomt.',
    'wie dit dichtzet sluit iemand buiten zijn eigen account'],
  ['/api/mijn/gegevens', 'Eigen gegevens', 'De gegevens die het lid over zichzelf beheert.',
    'zie privacyrechten: inzage in en beheer van je eigen gegevens is een recht en geen functie'],
  ['/api/mijn/post', 'Postvoorkeuren', 'Welke berichten wil ik wel en niet, en het volledig afmelden.',
    'afmelden voor post is een recht van de ontvanger; een schakelaar die dat intrekt hoort niet te bestaan'],
  ['/api/mijn/relaties', 'Eigen relaties', 'Met wie deelt dit account gegevens, en het intrekken daarvan.',
    'zie toestemming: het intrekken van een grondslag is niet schakelbaar'],
  /* Toestelbinding hoort bij de beveiligingskant hierboven en niet bij de
     zeggenschapskant: het bindt een sessie aan het toestel waarop zij draait
     (server/routes/member/toestellen.js), en intrekken sluit de sessies mee --
     kern/identiteit/bezitspaden.js noemt dat pad met zoveel woorden. Dezelfde
     verklaring staat al in kern/bestuursroutes.js regel 26; deze twee horen
     hetzelfde te zeggen. */
  ['/api/mijn/toestel', 'Eigen toestellen', 'Een sessie binden aan dit toestel, het een naam geven, en het weer intrekken.',
    'intrekken is een noodrem die sessies sluit; een schakelaar die dat wegneemt laat een verloren toestel ingelogd'],
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
    'de ingang van het huis is geen functie die je uit kunt zetten; zonder ingang is er niets om in te schakelen'],
  ['/scriptblok.js', 'Afgesplitst scriptblok', 'Een kaal <script>-blok dat als eigen bestand wordt bezorgd.',
    'de bezorging van de pagina zelf: zonder deze weg laadt het blok niet en is de pagina stuk, niet uitgeschakeld'],
  ['/stijlblok.css', 'Afgesplitst stijlblok', 'Een kaal <style>-blok dat als eigen bestand wordt bezorgd.',
    'zie het scriptblok: sinds style-src een nonce eist verhuist het blok naar een eigen adres, en dat is geen functie']
];
