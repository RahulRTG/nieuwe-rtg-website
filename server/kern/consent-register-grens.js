/* De grens van het Consent Center: wat het scherm NIET dekt, met de reden.
   Hoort bij ./consent-register.js (LAGEN) en wordt daar opnieuw uitgevoerd. */
'use strict';

/* Wat dit scherm NIET dekt, met reden. Deze regels gaan mee naar het scherm,
   want een lezer hoort te weten waar de lijst ophoudt. */
const NIET_GEDEKT = [
  { naam: 'Wat u in De Salon of een genootschap plaatst',
    reden: 'Dat is publiceren en geen toestemming: u haalt het weg bij de post zelf.' },
  { naam: 'Uw veiligheidskring (Thuiswacht, Codewoord, Vitaal)',
    reden: 'Die kring krijgt pas iets te zien als er een alarm afgaat; u beheert hem in de veiligheidsapps.' },
  { naam: 'Uw noodkaart',
    reden: 'Die toont u zelf op uw scherm. Er is geen route waarmee een zaak, een kantoor of een hulpverlener hem opvraagt, dus er valt ook niets in te trekken.' },
  { naam: 'Uw medicatieschema',
    reden: 'Dat is uw eigen lijst. Niemand anders kan hem opvragen of aanpassen -- ook een behandelaar niet, want die schrijft voor in zijn eigen systeem.' },
  { naam: 'Uw dagcheck-in en wat u daarbij opschreef',
    reden: 'Daar valt niets te delen: die notities verlaten uw account niet, en er is geen knop die dat wel zou doen.' },
  { naam: 'Uw gedachtenboek',
    reden: 'Daar leest niemand in mee, ook geen model: er bestaat geen route die die tekst ergens anders heen stuurt, dus er valt niets in te trekken.' },
  { naam: 'Een ID-/leeftijdscheck met het Zegel',
    reden: 'Dat toont u zelf: de zaak scant uw Zegel en leert alleen het bewezen feit (18-plus, welke pas), nooit uw naam. Er blijft niets openstaan, dus er valt ook niets in te trekken.' },
  { naam: 'Wat uw werkgever voor de loonadministratie opvraagt',
    reden: 'Dat is een wettelijke plicht en geen toestemming die u geeft. U krijgt van elke opvraging bericht, en ze staat met reden in het inzagejournaal.' },
  /* WERVING, GEVONDEN OP 23 SEPTEMBER 2026 (ARBEID.md par. 4 punt 7). Twee
     plekken waar gegevens van een mens naar een werkgever gaan stonden in geen
     van beide lijsten, want ze wonen in routes/ en hebben niet de vorm die
     test/consent-dekking.test.js zocht. Het zijn geen doorlopende toestemmingen
     -- vandaar hier en niet in LAGEN -- maar een lezer hoort te weten dat ze
     bestaan en waar ze ophouden. */
  { naam: 'Een sollicitatie die u instuurde',
    reden: 'Dat is een overdracht die u zelf doet aan een werkgever: die ziet uw naam, contact en cv omdat u solliciteerde, en de stand staat bij uw sollicitaties. Het is geen doorlopende toestemming die u hier intrekt. Wilt u dat een werkgever uw gegevens wist, vraag het hem in het gesprek.' },
  { naam: 'Anonieme werkinteresse vanuit de RTFoundation',
    reden: 'Die hoort bij een gezinsprofiel en niet bij dit account. De werkgever ziet alleen een kop, vaardigheden en het aantal ervaringen, nooit een naam of contact. Intrekken gaat in de Foundation-app, zolang de werkgever nog niet heeft gereageerd.' },
  /* HET AKKOORD MET DE VOORWAARDEN, GEVONDEN IN AFSPRAAK.md par. 7.1. Het stond
     in geen van beide lijsten, en de dekkingstoets kon het niet vinden: hij zocht
     `{ key, status: 'actief' }` en de onderteken-rij in kern/onboarding/lid.js is
     `{ versie, naam, at, hash }`. Elk account tekent haar, ook een gratis account
     en een RTF-gezin, en er zijn scopes per zaak. Het is geen toestemming voor
     gegevensgebruik maar een OVEREENKOMST -- vandaar hier en niet in LAGEN -- en een lezer hoort
     te weten waar hij haar wel vindt. test/consent-dekking.test.js kent die vorm
     nu ook, zodat een tweede tekenweg met dezelfde vorm er niet stil langs gaat. */
  { naam: 'De lidmaatschaps- en reisovereenkomst die u bij uw aanmelding ondertekende',
    reden: 'Dat is een overeenkomst en geen toestemming voor gegevensgebruik, dus er valt hier niets in te trekken: ' +
      'ze geldt zolang uw account bestaat. Heeft u een betaald lidmaatschap, dan zegt u dat op in RTG Geld, onder Lidmaatschap. ' +
      'Het eigen contract van een zaak waar u voor werkt, tekent u bij die zaak en staat daar.' },
  { naam: 'Wat een zaak van een boeking weet',
    reden: 'Dat hoort bij de boeking en verdwijnt met de boeking; het is geen losse toestemming.' }
];

module.exports = { NIET_GEDEKT };
