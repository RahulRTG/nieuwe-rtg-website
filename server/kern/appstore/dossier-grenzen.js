/* ============================================================================
   HET INKOOPDOSSIER, DEEL "GRENZEN" -- wat voor ELKE app in dit kanaal geldt.

   Apart van ./dossier.js omdat het een echte naad is en niet alleen omvang: wat
   hier staat hangt van geen enkele app af. Wie een tweede app beoordeelt, hoeft
   dit deel niet opnieuw te lezen -- het is een eigenschap van de UITVOERING en
   niet van de leverancier.

   Dat onderscheid is precies wat een inkoper wil zien. Bij een gewone
   leverancier is "waar blijven mijn gegevens" een vraag per leverancier, met een
   antwoord dat per leverancier gecontroleerd moet worden. Hier is het een vraag
   per PLATFORM, met een antwoord dat volgt uit de CSP-kop van elke celrespons.

   Een bewijsregel draagt altijd vier dingen: wat er wordt beweerd, hoe het is
   vastgesteld, waar dat staat, en de gemeten waarde. Een bewering zonder die
   vier hoort hier niet in; dat is het verschil met een ingevulde vragenlijst.
   ========================================================================== */
'use strict';

const { MACHTIGINGEN, NIET_GEBOUWD } = require('./machtigingen');

const B = (claim, hoe, bron, waarde) => ({ claim, hoe, bron, waarde });

/* Deze lijst is de kern van het dossier voor een functionaris gegevensbescherming.
   Hij is geen beleid maar architectuur: er is geen instelling waarmee hij anders
   wordt, en geen leverancier die er een uitzondering op krijgt. */
const WAT_HET_NOOIT_KRIJGT = {
  punten: [
    'de echte naam, het e-mailadres, het telefoonnummer, het adres of de geboortedatum van een lid',
    'netwerktoegang: de app kan niets versturen en niets ophalen, ook niet naar RTG zelf',
    'camera en microfoon: het kader draagt een leeg allow',
    'toegang tot de RTG-pagina eromheen, de sessie, de cookies of de opslag van het lid',
    'inzage in wat een ANDERE app bij ditzelfde lid heeft opgeslagen'
  ],
  bewijs: [
    B('De app draait op een naamloze herkomst',
      'iframe met sandbox="allow-scripts" en niets erbij; de browser behandelt het document als een andere partij',
      'public/apps/appcel.html', 'sandbox=allow-scripts'),
    B('De app heeft geen netwerk',
      "de CSP van de celroute zet connect-src op 'none'; ook wie de URL los opent zit in dezelfde sandbox",
      'server/routes/appstore/cel.js (CEL_CSP)', "connect-src 'none'"),
    B('De brug KAN geen echte naam teruggeven',
      'kern/appstore/brug.js heeft geen verwijzing naar de identiteitskluis, dus het kan er niet uit komen -- niet omdat het niet mag',
      'test/appstore-cel.test.js toets 3', 'geen require naar accounts')
  ]
};

const WAAR_DE_GEGEVENS_BLIJVEN = {
  antwoord: 'Binnen RTG. De leverancier heeft geen kopie, en kan die ook niet krijgen.',
  toelichting: 'Wat deze app over een lid bewaart, staat in de RTG-opslag onder de sleutel van die app. Er is geen weg waarlangs het naar de leverancier gaat, want de app heeft geen netwerk. Dit is geen belofte in een verwerkersovereenkomst maar een eigenschap van de uitvoering.',
  bewijs: [
    B('Er is geen uitgaande verbinding mogelijk',
      "connect-src 'none' in de CSP van elke celrespons, afgedwongen door de browser",
      'server/routes/appstore/cel.js', 'per respons'),
    B('De keuring houdt een poging al tegen',
      'fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon, importScripts en serviceWorker worden bij het inzenden afgekeurd, met bestand en regelnummer',
      'kern/appstore/verboden.js (VERBODEN_JS)', 'bij inzending')
  ]
};

const UITGANG = {
  antwoord: 'Verwijderen is klaar zodra u het doet. Er is niets bij de leverancier om te laten wissen.',
  toelichting: 'Bij het verwijderen vervallen alle machtigingen. Wat de app voor u had opgeslagen blijft staan tot u het zelf wist -- dat is uw inhoud en niet die van de app -- en verdwijnt dan volledig. Omdat de app nooit netwerk had, bestaat er geen tweede kopie waarvan om verwijdering gevraagd moet worden.',
  bewijs: [
    B('Intrekken werkt onmiddellijk en overal',
      'winkel, startscherm van het lid en de cel stellen dezelfde vraag: staat deze hash live? Er is geen tweede plek die kan achterlopen',
      'kern/appstore/uitgifte.js (magCel)', 'een bron'),
    B('Er is een aantoonbare wisknop',
      'wis-opslag verwijdert wat deze app bij dit lid bewaarde, inclusief zijn berichtenbakje, en zet er een regel over in de tijdlijn van het lid',
      'kern/appstore/winkel.js (wisOpslag)', 'per lid per app')
  ]
};

/* WAT DIT DOSSIER NIET KAN ZEGGEN. Dit is geen restpost maar het deel dat het
   dossier bruikbaar maakt: een inkoper die dit leest, weet precies waar zijn
   eigen onderzoek moet beginnen. Een leverancierspak dat overal "ja" zegt is
   niets waard; een dat zegt waar het ophoudt, is te vertrouwen op de rest. */
const NIET_TE_ZEGGEN = {
  'beschikbaarheid van de leverancier': 'Er is geen server van de leverancier om te meten: de app draait in de browser van het lid, uit een bundel van ons. Een SLA over uptime van een derde bestaat hier dus niet, en zou nergens over gaan.',
  'penetratietest': 'RTG voert geen aanvalsproef uit op de code van een derde. Wat er wel gebeurt staat onder "wat de poort vond"; dat is een vormcontrole plus een menselijke beoordeling.',
  'SBOM en herleidbare build': 'De bundel wordt aangenomen zoals hij is ingezonden en daarna tegen zijn hash bewaakt. Er is geen koppeling met de broncode of de bouwomgeving van de leverancier, dus geen afhankelijkhedenlijst en geen reproduceerbare build.',
  'certificeringen van de leverancier': 'ISO 27001, SOC 2 en dergelijke worden hier niet gevraagd, niet gecontroleerd en niet getoond. RTG valideert geen certificaat dat het niet zelf heeft afgegeven.',
  'aansprakelijkheid en contract': 'Wat er juridisch geldt tussen u, RTG en de leverancier staat niet in dit dossier. Dit gaat over de techniek en de keuring.'
};

/* De machtigingencatalogus als bijlage: welke er zijn, en -- belangrijker --
   welke er met opzet NIET zijn. Een inkoper die wil weten of een app ooit bij
   betaalgegevens of locatie kan komen, leest hier het antwoord voor het hele
   kanaal in plaats van per app. */
const kanaal = () => ({
  machtigingen: MACHTIGINGEN.map(m => ({ id: m.id, label: m.label, geeft: m.geeft, nooit: m.nooit, risico: m.risico })),
  nietGebouwd: NIET_GEBOUWD,
  let: 'Dit geldt voor elke app in dit kanaal, niet alleen voor de app die u bekijkt. Wat hier niet staat, kan geen enkele app van derden vragen.'
});

module.exports = { WAT_HET_NOOIT_KRIJGT, WAAR_DE_GEGEVENS_BLIJVEN, UITGANG, NIET_TE_ZEGGEN, kanaal };
