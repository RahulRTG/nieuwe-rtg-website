/* Het platformregister (deelmodule): WAT EEN MENS ALTIJD OVER ZICHZELF MAG --
   en dat is een andere reden dan de rest van ./bediening.js.

   WAAROM DIT UIT ./bediening.js IS GEKNIPT. Dat bestand ging over de 10 kB van
   keuringsregel 13, en de naad stond er al in: hij droeg TWEE soorten
   onschakelbaarheid met twee verschillende gronden, en een regel erbij duwde hem
   eroverheen.

     ./bediening.js     de besturing van het PLATFORM. Een schakelaar die de
                        schakelkast uitzet is geen schakelaar; een
                        gezondheidscontrole die je kunt uitzetten meldt nooit meer
                        iets. Hier gaat het over de machine.
     dit bestand        de RECHTEN VAN EEN MENS over zijn eigen account. Die
                        staan niet in de functiecatalogus omdat een knop erop
                        iets wegneemt wat een lid altijd hoort te kunnen. Hier
                        gaat het over de persoon.

   Dat verschil is niet cosmetisch. Wie de platformlijst leest, vraagt "kan dit
   uit zonder dat de server stuk gaat". Wie deze lijst leest, vraagt "mag RTG dit
   een mens afnemen". Dat tweede is een juridische en morele vraag en geen
   technische, en hij hoort niet tussen de gezondheidscontroles te staan.

   De beide lijsten worden in ./bediening.js weer samengevoegd, zodat
   ../platformregister.js en scripts/activering.js EEN lijst blijven zien. Er komt
   dus geen tweede register bij -- alleen een tweede bladzijde.

   DE LIJST IS UITPUTTEND. Wat er niet op staat en ook in geen functie zit, komt
   als 'onbenoemd' terug en valt op (scripts/activering.js). Een prefix hier
   zetten is dus een BESLUIT: het zegt dat RTG deze weg nooit centraal dichtdraait.
   Schrijf de grond erbij, en schrijf hem in de vorm van de regels hieronder --
   niet "dit hoort open te staan" maar wat er misgaat als hij dichtgaat. */
'use strict';

module.exports = [
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
  /* HET EIGEN LIDMAATSCHAP, en het hoort hier om dezelfde grond als de zes
     hierboven: wie zich mag verbinden, mag zich losmaken. Niet onder `tg-aanmeld`
     -- die schakelt de INSTROOM, en daaronder zou het sluiten van de inschrijving
     de bestaande leden opsluiten. Lezen en opzeggen staan onder EEN prefix; de
     afweging staat in AFSPRAAK.md par. 14.2. */
  ['/api/mijn/abonnement', 'Eigen lidmaatschap', 'Het lidmaatschap dat dit account heeft: wat er loopt, wat opzeggen gaat doen, en opzeggen.',
    'wie zich mag verbinden mag zich losmaken; een schakelaar hierop houdt een lid in een contract dat hij niet meer wil']
];
