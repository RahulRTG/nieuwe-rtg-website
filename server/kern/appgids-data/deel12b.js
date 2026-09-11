/* App-gids data, deel 12b: het vervolg van deel12, opgeknipt op de 10 kB-grens
   uit het modulebeleid -- zelfde patroon als deel10b en deel6b.

   De knip zit op een entry-grens die ook inhoudelijk een grens is: dit zijn de
   twee schermen van de persoonlijke controlelaag (MIJNRTG.md). Ze stellen
   dezelfde vraag vanaf twee kanten -- wie mag iets van mij, en wie mag mij
   bereiken -- en horen daarom bij elkaar in plaats van bij de festival- en
   Living OS-schermen waar ze naast stonden. */
const G = (wat, doe, tip) => ({ wat, doe, tip });

module.exports = {
  '/apps/foundation/zorg.html': G('Hulp & Zorg in FoundationOS: echte zorgmomenten, een rustige hulpwijzer en uw begeleider op een plek.',
    ['Bekijk wat er voor u of uw gezin aankomt', 'Vind zonder nieuw dossier een passende eerste stap bij uw vraag',
     'Controleer welke medische intake u tijdelijk met een aanbieder deelt'],
    'De app verzint geen begeleider of voortgang. Alleen gegevens uit uw Foundation-profiel en RTG Care verschijnen; delen blijft uw keuze.'),
  '/apps/mijn-gegevens.html': G('Wat weet RTG van mij: per soort gegeven waar het staat, hoe het bij ons kwam, waarvoor het mag worden gebruikt en of het weg kan.',
    ['Zie per gegeven of RTG het heeft -- en waar dat niet vast te stellen is, staat dat er als eigen uitslag',
     'Lees waarvoor elk gegeven gebruikt mag worden, en waar het fysiek staat',
     'Zie wat er blijft staan als je je account opheft, en waarom'],
    'Dit zijn SOORTEN en geen inhoud: hier staat dat RTG je adres heeft, niet welk. De inhoud haal je op met een uitvoer van je dossier onder Juridisch.'),
  '/apps/mijn-relaties.html': G('Wie heeft toegang tot mij: alle partijen die op dit moment iets van je mogen, per partij bij elkaar.',
    ['Zie per zaak of dienst wat zij precies mag en tot wanneer',
     'Vraag de gevolgen op voordat je een relatie sluit',
     'Sluit alles van een partij in een keer, of trek er een los in'],
    'Onderaan staat wat dit scherm NIET dekt, met de reden erbij; een overzicht dat er drie vergeet is erger dan geen overzicht.'),
  '/apps/mijn-post.html': G('Post van RTG: waarvoor je toestemming geeft om benaderd te worden, per soort en per kanaal.',
    ['Zet per soort post los aan of uit voor e-mail, sms en de app',
     'Zie wanneer je ja zei en via welk scherm dat gebeurde',
     'Zet alles in een handeling uit'],
    'Alles staat standaard UIT; afwezigheid is hier geen toestemming. Wat je hoe dan ook blijft krijgen -- beveiliging, facturen, wettelijke berichten -- staat er even groot bij en is geen schakelaar.'),
  /* De derde vraag van dezelfde laag. Deel12b vroeg "wie mag iets VAN mij" en
     "wie mag mij bereiken"; dit is "wie mag iets NAMENS mij" -- dezelfde mens,
     dezelfde controlevraag, en daarom hier en niet bij de werk-schermen. */
  '/apps/vertegenwoordiging.html': G('Mijn team: wie mag wat namens u, sinds wanneer, tot wanneer, en wat er namens u is gedaan.',
    ['Bekijk voor elke machtiging wat er opengaat - en even groot wat er met zekerheid niet opengaat',
     'Zet uw eigen grens: deze bevoegdheden geeft u aan niemand, ook niet aan wie u al gemachtigd heeft',
     'Trek een machtiging op elk moment in, per direct en zonder reden'],
    'Een machtiging versmalt wat u zelf al mocht; zij voegt er nooit iets aan toe. Aanvaarden doet u altijd zelf, en wat er namens u gebeurde blijft in uw spoor staan ook nadat u intrekt - intrekken stopt de toekomst en niet het verleden.'),
  /* En de vierde van dezelfde laag: niet wie iets mag, maar wat er GEBEURD is.
     Hij hoort hier omdat hij dezelfde controlevraag stelt als de drie hierboven
     -- wat staat er over mij, en wie heeft dat gezegd. */
  '/apps/loopbaan.html': G('Mijn loopbaan: wat er gebeurde, wanneer, en wie dat heeft bevestigd - chronologisch en per regel.',
    ['Schrijf op wat er gebeurd is; het staat er als door u opgegeven tot iemand anders het bevestigt',
     'Zie per bevestiging wat zij WEL vaststelt en wat zij niet zegt - RTG valideert de prestatie zelf nooit',
     'Deel EEN regel met een code die verloopt, zodat een club of sponsor iets kan nakijken zonder uw loopbaan te zien'],
    'Er staat hier geen cijfer, geen niveau en geen vergelijking met iemand anders; de zeven voorraden hebben met opzet geen totaal. Intrekken haalt niets weg - de regel blijft staan met uw reden erbij, want een loopbaan die je kunt poetsen is geen bewijs.'),
  '/apps/loopbaanbewijs.html': G('Een regel uit een loopbaan, geopend met de code die iemand u stuurde. Geen account nodig.',
    ['Bekijk het ene feit dat met u gedeeld is, met de dag waarop het gebeurde',
     'Lees per bevestiging wie ervoor instaat, en wat die bevestiging niet zegt',
     'Zie het even groot als er niemand heeft bevestigd, of als de regel is teruggenomen'],
    'U ziet een regel en nooit de loopbaan eromheen - ook niet welke categorieen leeg zijn, want ook dat is een mededeling over een mens. De code verloopt en de mens kan hem stoppen.'),
};
