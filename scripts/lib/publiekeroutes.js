/* ============================================================================
   DE PUBLIEKE ROUTES, MET PER STUK DE REDEN.

   Alles hier is een BEWUSTE KEUZE en geen omissie. Wie een regel toevoegt,
   schrijft er een reden bij die klopt; kun je dat niet, dan is de route
   waarschijnlijk gewoon een gat.

   WAAROM DIT EEN EIGEN BESTAND IS. Deze lijst stond in scripts/check.js, waar
   regel 28 hem gebruikt om te controleren dat elke API-route een poort heeft.
   Hij is daar niet weg te denken -- maar hij is ook precies wat het
   mutatiecontractregister nodig heeft: een contract eist een toegangsklasse, en
   voor een publieke route is die klasse PUBLIC MET EEN REDEN. Die reden is hier
   al geschreven, door een mens, over deze route.

   Twee plekken die dezelfde waarheid vasthouden lopen uiteen (LAT.md regel 4),
   en dat zou hier duur zijn: de ene lijst zou een route publiek noemen die op de
   andere een poort heeft. Dus woont hij hier, en lezen check.js en
   scripts/mutatiecontract.js hem allebei.

   ELKE REDEN STAAT OP ZICHZELF, en `idem` bestaat hier niet meer. Elf regels
   verwezen naar de regel erboven -- leesbaar zolang je de lijst van boven naar
   beneden leest, en betekenisloos zodra hij ergens anders wordt gebruikt. Dat
   gebeurde ook: het mutatiecontractregister neemt deze reden over in het contract
   van die route, en daar stond toen "idem" onder een route waar niets boven
   staat. Een reden die alleen klopt in volgorde, is geen reden.

   Het formaat is bewust een Map en geen object: de sleutel is een routepad en
   die kan alles bevatten, ook een naam die op een prototype-eigenschap lijkt.
   ========================================================================== */
'use strict';

const PUBLIEK = new Map([
    // ---- de deuren zelf: hier kan per definitie nog geen sessie zijn ----
    ['/api/auth/register', 'registreren kan alleen zonder account'],
    ['/api/mail/ses', 'AWS SES bewijst bezit met een verse HMAC over envelop, controles en exacte berichtbytes; zonder 32+ teken geheim blijft de route dicht'],
    ['/api/auth/forgot', 'wachtwoord vergeten: wie buitengesloten is heeft geen token'],
    /* DE INLOGDEUR ZELF, en waarom hij hier hoort te staan in plaats van op de
       heuristiek te leunen.

       Hij stond nooit op deze lijst en werd toch goedgekeurd, want de regel
       telt "geeft ergens binnen achthonderd tekens een 401 of 403 terug" ook als
       poort. Dat klopte toevallig: de 401 stond net binnen dat venster. Toen de
       inlog er drie remmen, een beveiligingsregel en een hash-opwaardering bij
       kreeg, schoof diezelfde 401 erbuiten -- en meldde de poort een gat waar
       niets was veranderd aan wie er binnenkomt.

       Een groen dat aan tekstafstand hangt is geen groen (dezelfde les die
       hierboven bij het venster staat). Daarom staat hij nu bij naam. De REDEN
       is bovendien dezelfde als bij register en forgot hierboven: dit IS de
       deur, er kan per definitie nog geen sessie zijn, en een poort die een
       sessie eist zou inloggen onmogelijk maken.

       Wat hem beschermt staat er wel: drie remmen (per adres+account, per
       adres, per doelwit), een vertraging bij een belaagd account, en een regel
       in het beveiligingsjournaal bij elke mislukte poging. */
    /* Hij is hier op 20 augustus 2026 nog even AF geweest, met als reden dat de
       401 in de handler als poort telt. Dat is de heuristiek waarvoor het blok
       hierboven juist waarschuwt, en het ging binnen een dag opnieuw mis: toen
       de doelemmer zijn vertraging terugkreeg, schoof de 401 weer buiten het
       venster van achthonderd tekens en meldde deze regel een gat waar niets
       was veranderd aan wie er binnenkomt. De naam blijft dus staan. */
    ['/api/auth/login', 'dit IS de deur: wie inlogt heeft nog geen sessie; drie remmen, een vertraging bij een belaagd account en het beveiligingsjournaal beschermen hem'],
    /* Dezelfde deur, andere sleutel. /api/webauthn/opties staat hierboven al op
       de lijst met "het bewijs volgt bij /login" -- dit is dat /login. Het
       bewijs zit in het verzoek: een handtekening over de uitdaging die de
       server zelf net heeft uitgegeven, en die maar een keer geldig is. */
    ['/api/webauthn/login', 'de tegenhanger van /api/webauthn/opties: de ondertekende uitdaging IS het bewijs, en die geldt eenmalig'],
    ['/api/pin/herstel', 'pin vergeten: de eenmalige sleutel uit de mail IS het bewijs, net als bij /api/auth/reset'],
    ['/api/aanmelding/aanvraag', 'een aanstaande aanvrager is nog geen lid (met rem per ip)'],
    ['/api/foundation/registratie/aanvragen', 'een school, vrijwilliger of stichting heeft vóór toelating nog geen account of code (met rem per ip)'],
    ['/api/foundation/registratie/status', 'de willekeurige, gehashte statussleutel is de geloofsbrief en toont uitsluitend die ene aanvraag (met rem per ip)'],
    /* Het bewijsstuk voor de gereguleerde genres hoort bij dezelfde aanvraag en
       loopt dus dezelfde weg: wie een apotheek aanvraagt heeft op dat moment
       geen zaak, geen personeelslogin en soms geen account -- alleen zijn
       aanmeldings-id. Er valt hier NIETS mee te lezen: de route geeft alleen
       terug dat het stuk is ontvangen, dus een geraden id levert geen gegevens
       op. En hij verleent niets: aftekenen (de handeling die de zaak vrijgeeft)
       zit achter officeAuth en staat op een naam. */
    ['/api/aanmelding/bewijs', 'hoort bij de aanvraag zelf; de aanvrager heeft nog geen sessie, en aftekenen zit wel achter het kantoor'],
    /* De twee gastendeuren. Hier KAN nog geen tafelsleutel zijn: die ontstaat
       pas bij het aanschuiven, en het bewijs dat iemand aan tafel 12 zit is de
       QR op die tafel. Het token is dus de credential en geen gemakje -- het is
       negen bytes willekeur, het staat gehasht in de opslag, en beide routes
       hebben een rem per ip die bij een misser oploopt. */
    ['/api/gast/tafel', 'de QR op tafel IS het bewijs; een gast is vaak geen lid (met rem per ip)'],
    ['/api/gast/aanschuiven', 'aanschuiven maakt de tafelsessie die alle andere gastroutes eist (met rem per ip)'],
    ['/api/arrival/interpret', 'publieke wensontleding zonder opslag of uitvoering (met rem per ip)'],
    ['/api/arrival/request', 'gast maakt zelf een aanvraag; sterke bezitssleutel, idempotentie en rem per ip'],
    ['/api/supplier/apply', 'solliciteren bij een zaak kan zonder account'],
    ['/api/supplier/staff/join', 'personeel meldt zich aan met een uitnodigingscode'],
    ['/api/werving/kijk', 'wie een wervingslink krijgt heeft nog geen account; toont alleen de bedrijfsnaam en de functie, met een rem per ip'],
    ['/api/rtgid/start', 'de identiteitsstroom begint voordat er een sessie is'],
    ['/api/sso/waarheen', 'de SSO-heenweg draagt zijn eigen ondertekende staat'],
    ['/api/sso/start', 'idem; 404 op een onbekende of uitgezette koppeling'],
    ['/api/sso/saml/start', 'de SAML-heenweg; hetzelfde als /api/sso/start, met een verzoek-ID dat we bewaren om het antwoord tegen te houden'],
    ['/api/sso/saml/acs', 'de provider POST de assertie hierheen -- een sessie bestaat op dat moment nog niet; de POORT is de handtekening plus het eigen verzoek-ID (test/samlxsw.test.js)'],
    ['/api/sso/saml/metadata', 'wat een klant bij zijn provider invult: onze eigen entityID en antwoordadres, geen gegevens'],
    ['/api/kantoor/gesprek/start', 'het kantoorgesprek begint voor er een account is'],
    ['/api/kantoor/gesprek/zeg', 'loopt verder op het gespreks-id dat bij de start is uitgegeven'],
    ['/api/bedrijf/werkruimte/maak', 'een organisatie die nog geen werkruimte heeft, heeft ook nog geen sleutel; de maker krijgt het beheer-token'],
    ['/api/bedrijf/lid/aanmeld', 'aanmelden bij een werkruimte kan zonder sleutel -- het token dat je krijgt werkt pas na toelating (test/bedrijfkern.test.js)'],

    /* ---- DE ACHT DIE OP HUN BUURMAN LEUNDEN ----
       Deze stonden hier niet, en ze kwamen ook nergens door een poort: ze
       kwamen door omdat het venster van 800 tekens de code van de VOLGENDE
       route meelas en daar een 401 vond. Sinds die knip (zie hieronder bij
       `staart`) staan ze hier met een eigen reden -- of ze zijn geen gat. */
    ['/api/aanmeld/start', 'het aanmeldgesprek begint voor er een account is; rem van 40 berichten per minuut per ip'],
    ['/api/webauthn/opties', 'de uitdaging moet er zijn VOOR je hem kunt beantwoorden; het bewijs volgt bij /login'],
    ['/api/auth/verify-email', 'de bevestigingslink IS de geloofsbrief (verifyActionToken); ongeldig of verlopen geeft 400'],
    /* Zelfde vorm, en om dezelfde reden publiek: deze bevestiging komt uit de
       mailbox van het NIEUWE adres en dus zonder sessie. Dat is het hele punt --
       hij bewijst dat de aanvrager daar bij kan. De aanvraag zelf zit wel achter
       auth EN het wachtwoord (routes/member/herstelkanaal.js).

       Deze regel stond in scripts/check.js en is met de lijst meeverhuisd toen
       main hem naar dit bestand bracht; twee kopieen zouden uiteenlopen. */
    ['/api/mijn/herstelkanaal/email/bevestig', 'de bevestigingslink IS de geloofsbrief (verifyActionToken, doel mailwissel); komt uit de mailbox van het nieuwe adres en heeft dus geen sessie'],

    // ---- publiek, maar met een code in het lijf als geloofsbrief ----
    /* Dezelfde familie als metPartner hiernaast: clubs en stadspartners hebben
       geen RTG-account, hun code is de sleutel en het portaal toont uitsluitend
       het dossier dat bij die ene code hoort.

       Hier stond eerst de kanttekening dat er GEEN rem op zat en dat de sterkte
       dus volledig aan de lengte van de code hing. Die staat er nu wel: twee
       remmen in server/routes/rtfkantoor/codedeuren.js (20/min per bron tegen het afgrazen,
       60/min per code tegen veel bronnen op een code), vastgelegd in
       test/rtfcoderem.test.js. Wat blijft staan voor de externe toets (taak 22):
       codes zonder vervaldatum en zonder intrekknop. */
    ['/api/rtf/club/portaal', 'de clubcode is de geloofsbrief (vindCode); alleen het eigen clubdossier'],
    ['/api/rtf/club/bericht', 'idem: schrijft alleen in het logboek van die ene clubcode'],
    ['/api/rtf/partner/raad', 'de raadcode is de geloofsbrief (vindCode); alleen de eigen partnerkant'],

    /* HET RTF LIVING LAB (routes/livinglab/bewoner.js). Dezelfde familie, en om
       een reden die in het ontwerp zelf zit: een Living Lab waarin een bewoner
       een account nodig heeft om een vraag aan te dragen of zijn eigen
       onderzoek te openen, is geen Living Lab meer. Twee soorten deuren:

       - OP EEN CODE (de labpas, het labpaspoort). De pas is de geloofsbrief
         (mensen.opPas) en bepaalt de alias; die wordt nooit uit het lijf
         gelezen, want een alias staat in het teambeeld en bewijst dus niets
         (regel 8). Ze dragen dezelfde twee remmen als de andere codedeuren:
         20/min per bron tegen het afgrazen, 60/min per code tegen veel bronnen
         op een code.
       - ZONDER CODE (een vraag aandragen, stemmen, een klacht indienen, het
         publieke labbeeld). Die kennen geen geheim en horen dat ook niet te
         kennen. Ze geven per constructie alleen de BUITENSTE ring terug
         (kern/livinglab/studie.js: geen deelnemers, geen observaties, en bij een
         gescheiden studie zelfs geen vraagstelling), en de schrijfkant staat op
         10/min per bron omdat daar inhoud binnenkomt.

       De klacht staat er bewust zonder pas bij: een klacht kan juist gaan over
       hoe het onderzoek met je omging, en "log eerst in" is daar het verkeerde
       antwoord. Wat blijft staan voor de externe toets, net als bij de club- en
       raadcodes: passen zonder vervaldatum en zonder intrekknop. */
    ['/api/lab2/mijn', 'de labpas is de geloofsbrief (opPas); alleen het eigen onderzoek van die ene deelnemer'],
    ['/api/lab2/mijn/observatie', 'idem; de alias komt uit de pas en niet uit het lijf'],
    ['/api/lab2/mijn/reflectie', 'idem; juist het gedrag dat dit lab wil hebben, dus het mag geen drempel krijgen'],
    ['/api/lab2/mijn/terugtrekken', 'toestemming intrekken moet werken met wat de deelnemer zelf heeft: zijn pas'],
    ['/api/lab2/bewoner/themas', 'de vragen uit de buurt zijn openbaar; dat is de trechter vóór het onderzoek'],
    ['/api/lab2/bewoner/thema', 'een bewoner draagt een onderzoeksvraag aan zonder account (rem 10/min per bron)'],
    ['/api/lab2/bewoner/stem', 'stemmen op een thema; de teller hangt aan het THEMA en niet aan de stemmer (regel 7)'],
    ['/api/lab2/bewoner/overzicht', 'het publieke labbeeld: alleen de buitenste ring, nooit deelnemers of ruwe data'],
    ['/api/lab2/bewoner/studie', 'idem per onderzoek; bij een gescheiden studie niet meer dan titel en stap'],
    ['/api/lab2/bewoner/labs', 'welke Living Labs er zijn; zonder budget, tekenaars en partners'],
    ['/api/lab2/bewoner/klacht', 'de klachtenprocedure mag geen inlog vragen: de klacht kan over het onderzoek zelf gaan'],
    ['/api/lab2/bewoner/paspoort', 'de paspoortcode is de geloofsbrief; toont alleen punten, niveau en badges'],
    ['/api/lab2/bewoner/paspoort-maak', 'een labpaspoort aanmaken op een zelfgekozen roepnaam (rem 10/min per bron)'],
    ['/api/lab2/bewoner/kader', 'de spelregels van het lab: cyclus, methoden en bewijsgraden horen juist openbaar te zijn'],

    /* Dezelfde familie, in het Foundation OS (routes/rtfos/portalen.js). Een
       lokale stichting, een gemeente en een lokale ondernemer hebben geen
       RTG-account: hun code bepaalt het dossier, niet de vraagsteller. Ze
       dragen dezelfde twee remmen (20/min per bron, 60/min per code) en de
       gemeentekant geeft per constructie alleen getelde cijfers terug, nooit
       een casus of een naam (kern/rtfos/gemeente.js). */
    ['/api/rtfos/portaal/partner', 'de partnercode is de geloofsbrief (vindCode); alleen het eigen partnerdossier'],
    ['/api/rtfos/portaal/gemeente', 'de gemeentecode is de geloofsbrief; uitsluitend geaggregeerde cijfers van die ene stad'],
    ['/api/rtfos/portaal/ondernemer', 'de bedrijfscode is de geloofsbrief; alleen het eigen aanbod en waar het heen ging'],

    /* De drie doelgroepen zonder RTG-account (routes/rtfos/doelgroepen.js).
       De eerste twee dragen dezelfde twee remmen als de codes hierboven; de
       derde heeft geen code omdat er niets achter zit wat een code verdient --
       zie kern/rtfos/publiek.js, waar de maat letterlijk is: wat zou je op een
       poster in het buurthuis hangen? */
    ['/api/rtfos/portaal/vrijwilliger', 'de vrijwilligerscode is de geloofsbrief; alleen zijn eigen planning en uren, geen contactgegevens en geen evaluaties'],
    ['/api/rtfos/portaal/vrijwilliger/zet', 'idem: hij werkt zijn eigen beschikbaarheid bij; zijn VOG en status zet de afdeling'],
    ['/api/rtfos/portaal/vrijwilliger/uren', 'idem: uren die hij opgeeft komen binnen als MELDING en tellen pas na bevestiging'],
    ['/api/rtfos/portaal/deelnemer', 'de deelnemerscode is de geloofsbrief; uitsluitend de stand van die ene hulpvraag'],
    ['/api/rtfos/portaal/deelnemer/intrekken', 'wie ja zei mag nee zeggen; een recht waarvoor je moet bellen naar de organisatie die je wilde stoppen, is geen recht'],
    ['/api/rtfos/publiek/steden', 'de buurt-app: alleen wat op een poster in het buurthuis zou hangen, geen enkel getal over hulpvragen'],
    ['/api/rtfos/publiek/stad', 'idem, per stad: lopende projecten en open activiteiten'],
    ['/api/rtfos/publiek/campagnes', 'idem: welke landelijke campagnes lopen, zonder opgehaalde bedragen'],
    ['/api/rtfos/portaal/donateur', 'de gever op zijn eigen code (RTFS-): alleen zijn eigen giften en waar ze heen gingen, nooit wie er nog meer gaf. Twee remmen, per bron en per code'],
    ['/api/rtfos/portaal/donateur/bewijs', 'idem: het giftbewijs voor een van zijn eigen giften'],
    ['/api/rtfos/publiek/jaarverslagen', 'de ANBI-publicatieplicht: een jaarstuk achter een inlog is niet gepubliceerd. Alleen wat het bestuur heeft vastgesteld EN gepubliceerd, met bevroren cijfers'],

    // ---- publieke informatie: staat ook gewoon op de site ----
    ['/api/pasprijzen', 'de prijslijst is publieke informatie'],
    /* DE DRIE COMMERCIELE FEITEN. Ze staan hier om dezelfde reden als
       /api/pasprijzen erboven, en ze zijn de reparatie van het gat dat dit hele
       traject begon: artikel 1 van de partnervoorwaarden beloofde "0% commissie"
       terwijl de boardroom een commissieknop op 12 procent had. Dat kon bestaan
       omdat HTML, code en documenten onafhankelijk over hetzelfde getal praatten.
       De voorwaardenpagina's halen die getallen nu HIER op in plaats van ze zelf
       op te schrijven -- en een voorwaardenpagina lees je zonder in te loggen,
       dus een poort ervoor zou betekenen dat de pagina zijn eigen bedragen weer
       gaat overtypen. Alledrie geven alleen wat er publiek beloofd wordt; er komt
       geen ledendata langs. */
    ['/api/claims', 'de publieke claims voeden de voorwaardenpagina\'s, die je zonder inlog leest'],
    ['/api/betaaldiensttarief', 'het betaaldiensttarief staat in de partnervoorwaarden'],
    ['/api/sociaalbeleid', 'de sociale afdracht is een publieke belofte (RTFoundation)'],
    ['/api/rtf/vacatures', 'openstaande vacatures zijn openbaar'],
    ['/api/gids/app', 'de app-gids is openbaar'],
    ['/api/krant/gids', 'de krant is openbaar; er is een toets die dat vastlegt'],
    ['/api/krant/open', 'de krant is openbaar; er is een toets die dat vastlegt'],
    ['/api/krant/artikel', 'de krant is openbaar; er is een toets die dat vastlegt'],
    ['/api/partner', 'het partnerkanaal is bedoeld voor niet-leden'],
    ['/api/partnertrips', 'idem: het aanbod van het partnerkanaal'],
    ['/api/book', 'idem: boeken via het partnerkanaal is de hele opzet'],
    /* Een klaargezette reis wordt geopend door iemand die nog GEEN lid is --
       dat is de hele opzet van de reisuitnodiging. Het slot is de code zelf
       (128 bits uit crypto.randomBytes); wat er zonder opeisen te zien is,
       is bewust mager (bestemming, periode, hoeveel onderdelen) zodat een
       doorgestuurde link geen boekingsnummers lekt. Opeisen kan alleen mét
       sessie. Zie de kop van server/kern/reisuitnodiging.js. */
    ['/api/reis/uitnodiging/open', 'een klaargezette reis openen kan per definitie nog zonder account (met rem per ip)'],
    ['/api/talen', 'de talenlijst voedt de kiezer op het inlogscherm'],
    ['/api/vertaal/ui', 'de knopteksten van datzelfde inlogscherm'],
    ['/api/translate', 'het woordenboek is publiek; de AI-tak zit achter kern/aipoort.js'],
    ['/api/push/key', 'de VAPID-sleutel is per definitie de PUBLIEKE helft'],
    /* Het gedeelde scherm. Een televisie in een vakantiehuis heeft geen
       RTG-account, en er een op zetten zou betekenen dat er een ingelogde
       sessie op een gedeeld apparaat blijft staan. De CODE is de hele
       toegang, en hij is bewust weinig waard: hij komt van een SPELER van dat
       potje, hij geeft alleen `zicht.publiek` van dat ene potje, hij verloopt
       na twee uur, en er kan niets terug -- geen zet, geen chat. Wie hem heeft
       ziet wat iedereen in de kamer toch al ziet. Er staat een rem voor tegen
       brute kracht. Zie server/kern/spellen/projectie.js. */
    ['/api/projectie/:code', 'een gedeeld scherm heeft geen sessie; de code geeft alleen de publieke laag van EEN potje en verloopt'],
    /* De rechtsvormen zijn voorlichting, geen bedrijfsdata: wat een B.V. van
       een stichting onderscheidt, en waar je met elk van de twee aan vastzit,
       hoort iemand te kunnen lezen VOORDAT hij een account maakt. Er staat
       geen enkele onderneming in -- alleen de vaste tabel uit
       kern/onderneming/rechtsvorm.js. Alles wat wel over een echt bedrijf
       gaat, zit in dezelfde router achter auth. */
    ['/api/onderneming/rechtsvormen', 'de rechtsvormtabel is voorlichting; er staat geen enkele onderneming in'],
    /* Het algoritmeregister van de stad. Een register dat alleen achter een
       kantoorinlog te lezen is, geeft een inwoner precies niets -- en dat is
       de enige groep voor wie het bedoeld is. Er staan regels in, geen mensen:
       geen persoonsgegevens, geen bedrijfsgevoelige data, alleen wat er
       meerekent en wat het mag beslissen. */
    ['/api/stad/algoritmes', 'het openbare algoritmeregister: beschrijft regels, geen personen'],
    ['/api/stad/besluiten', 'het openbare besluitenregister: wat de stad besloot, met welke stemverhouding; fracties stemmen met zetels, geen personen'],
    ['/api/fout/client', 'een fout uit de browser: JUIST zonder poort, want een fout die het ' +
      'inloggen zelf sloopt komt nooit binnen achter een poort die inloggen vereist. Er wordt ' +
      'niets bewaard en niets uitgevoerd, alleen gelogd, met een rem per IP en afgekapte velden ' +
      '(zie server/routes/fout.js voor wat er wel en niet meegaat)'],
    ['/api/zegel/sleutel', 'idem: de publieke helft van het zegel'],
    ['/api/zegel/controleer', 'controleert een handtekening; het bewijs zit in het verzoek'],
    ['/api/ice', 'ijs-servers voor WebRTC; geen gegevens, wel een rem'],
    ['/api/munt/opties', 'welke munten er aan staan is prijslijst-informatie, net als /api/pasprijzen'],
    /* Bedrijfsstatus van de doos zelf (modus, journaalstand, versie, wifi,
       stroom) -- geen zaakdata en geen ledengegevens. Wel eerlijk vermelden:
       het is infrastructuurinformatie, en die hoort op het LAN van de zaak te
       blijven. Hangt een doos ooit rechtstreeks aan het internet, dan is dit
       de eerste route om alsnog achter een poort te zetten. */
    ['/api/doos/status', 'de doos vertelt hoe hij erbij staat; geen zaakdata (zie de opmerking hierboven)'],
    /* Bewust, en met een gemeten grens: de PDA-inlog toont eerst de namenlijst
       zodat personeel zichzelf kan aanwijzen. Zie de rem in toegang.js: dertig
       zaken per kwartier per ip, ruim voor wie van bedrijf wisselt en te weinig
       om alle partners leeg te trekken. */
    ['/api/supplier/roster', 'de PDA-inlog toont de namenlijst voor de pincode; met een eigen rem'],

    // ---- machine naar machine, met een eigen bewijs in het verzoek ----
    ['/api/betaal/webhook', 'ondertekend door de betaalprovider; een sessie bestaat hier niet'],
    ['/api/betaal/webhook/mollie', 'Mollie heeft geen RTG-sessie; RTG vertrouwt het id niet en haalt de betaling met de eigen geheime sleutel bij Mollie op'],
    ['/api/munt/webhook', 'idem, met een eigen webhook-secret'],
    ['/api/cluster/:actie', 'de clustersleutel zit in een eigen kop; zonder sleutel bestaat de route niet'],
    ['/api/werkmail/bezorg', 'inkomende post van de mailserver, met een eigen venster-rem per minuut'],
    ['/api/mail/binnen', 'de buitenpoort voor echte RFC 5322-post; een vreemde mailserver heeft geen inlog bij ons. Eigen venster-rem per minuut, alles landt in de ONBETROUWDE baan, en de ontvanger komt uit de To-kop en niet uit een parameter (anders was het een open relay)'],
    ['/api/stad/doos/hartslag', 'de stadsdoos stuurt zijn apparaatsleutel mee'],
    ['/api/stad/doos/meting', 'de stadsdoos stuurt zijn apparaatsleutel mee'],
    ['/api/rtgid/status', 'RTG iD draagt zijn bewijs als idToken in het LIJF, niet als sessie'],
    ['/api/rtgid/wie', 'idem; de kluis geeft alleen attributen op een geldig idToken'],
    ['/api/vracht/volg', 'volgen op een meegestuurde vrachtcode, zoals elke track-and-trace'],

    // ---- gezondheid: moet juist bereikbaar zijn als de rest dat niet is ----
    ['/api/health', 'de gezondheidscheck'],
    ['/api/ready', 'de load balancer moet dit kunnen lezen terwijl de opslagpoort dicht staat'],
    ['/api/pay/gezond', 'de gezondheidscheck van de betaallaag: die moet juist bereikbaar zijn als de rest dat niet is'],

    // ---- de lesmaker: werkt op een meegestuurd profiel, niet op een sessie ----
    ['/api/les/maak', 'de lesmaker werkt op een meegestuurd profiel'],
    ['/api/les/leraar', 'de lesmaker werkt op een meegestuurd profiel'],
    ['/api/les/apps', 'de lesmaker werkt op een meegestuurd profiel'],
    ['/api/les/volgende', 'de lesmaker werkt op een meegestuurd profiel'],
    ['/api/les/sluit', 'de lesmaker werkt op een meegestuurd profiel'],
    ['/api/les/mee', 'de lesmaker werkt op een meegestuurd profiel'],
    ['/api/les/kijk', 'de lesmaker werkt op een meegestuurd profiel'],
    ['/api/les/antwoord', 'de lesmaker werkt op een meegestuurd profiel'],

    // ---- bestaan alleen in NODE_ENV=test ----
    ['/api/test/bug', 'alleen geregistreerd als NODE_ENV=test; bestaat in productie niet'],
    ['/api/test/crash', 'alleen geregistreerd als NODE_ENV=test; bestaat in productie niet']
  ]);

module.exports = { PUBLIEK };
