/* DE PAPIEREN: wat Rahul uitvraagt in plaats van een [VUL IN]-lijst.

   Hier stond eerst een rij placeholders in twee markdown-bestanden. Dat werkt
   niet: een invullijst leest niemand, en wat niemand leest wordt niet ingevuld.
   Rahul vraagt het nu uit, één vraag per keer, met erbij waaróm het nodig is.

   EEN HARDE REGEL, EN DE BELANGRIJKSTE VAN DIT BESTAND:

     RAHUL VERZINT HIER NOOIT EEN ANTWOORD.

   Dit zijn juridische feiten -- een KvK-nummer, wie er beslist bij een datalek,
   of er een verwerkersovereenkomst ligt. Een verzonnen KvK-nummer is oneindig
   veel erger dan een leeg veld: een leeg veld ziet iedereen, een verzonnen
   nummer gelooft iedereen. Rahul mag vragen, uitleggen, aandringen en
   terugvragen als iets onwaarschijnlijk lijkt. Invullen doet de mens.

   Weet de eigenaar het even niet, dan mag hij parkeren. Dat wordt eerlijk
   opgeslagen als "nog niet bekend" en telt gewoon als open -- de go-live-keuring
   blijft er dus op blokkeren. Parkeren mag, doen alsof niet.

   soort: 'tekst' (vrij antwoord) | 'ja-nee-reden' (ja of nee, mét toelichting)
   veld:  de plek in het document waar het antwoord landt ({{veld}}) */

const { nuTermijn } = require('./huidig'); // wat het systeem vandaag doet

const VRAGEN = [
  // ---------- wie is de verantwoordelijke ----------
  { id: 'verantwoordelijke', groep: 'Het bedrijf', veld: 'verantwoordelijke', soort: 'tekst', min: 10,
    vraag: 'Onder welke juridische naam draait RTG, en wat is het KvK-nummer en het vestigingsadres?',
    waarom: 'Dit is de verwerkingsverantwoordelijke uit de AVG. Een betrokkene moet weten wie hij aanspreekt, en een toezichthouder wie hij aanschrijft. Zonder dit is het hele register een anoniem document.',
    voorbeeld: 'Rahul Travel Group B.V., KvK 12345678, Voorbeeldstraat 1, Rotterdam' },

  { id: 'privacycontact', groep: 'Het bedrijf', veld: 'privacycontact', soort: 'tekst', min: 6,
    vraag: 'Wie is bij RTG het aanspreekpunt voor privacyvragen, en op welk e-mailadres is die bereikbaar?',
    waarom: 'Leden hebben recht op inzage, correctie en verwijdering. Die verzoeken moeten ergens binnenkomen bij een mens die ze kan afhandelen -- niet in een algemene inbox waar ze blijven liggen.',
    voorbeeld: 'Naam Achternaam, privacy@rtg.example' },

  { id: 'fg', groep: 'Het bedrijf', veld: 'fg', soort: 'ja-nee-reden',
    vraag: 'Is er een Functionaris Gegevensbescherming aangesteld?',
    waarom: 'Een FG is verplicht bij grootschalige verwerking van bijzondere persoonsgegevens -- en RTG verwerkt zorg- en allergiegegevens. Is er geen FG, dan moet er een onderbouwing liggen waarom dat hier niet hoeft. "We hebben er geen" is geen onderbouwing.',
    jaVraag: 'Wie is het, en hoe is die bereikbaar?',
    neeVraag: 'Waarom is een FG hier niet verplicht? Noem de reden die u aan een toezichthouder zou geven.' },

  // ---------- bewaartermijnen die alleen RTG kan bepalen ----------
  { id: 'kyctermijn', groep: 'Bewaartermijnen', veld: 'kyctermijn', soort: 'tekst', min: 4,
    vraag: 'Hoe lang bewaart RTG het geüploade identiteitsbewijs na een geslaagde verificatie?',
    waarom: 'Een paspoortscan is het gevoeligste bestand dat we hebben. Mijn advies: het document verwijderen zodra de verificatie rond is en alleen de uitkomst bewaren. Maar dit is uw besluit, niet het mijne.',
    huidig: nuTermijn('id'),
    voorbeeld: 'Direct na goedkeuring verwijderen; alleen de uitkomst blijft' },

  { id: 'locatietermijn', groep: 'Bewaartermijnen', veld: 'locatietermijn', soort: 'tekst', min: 3,
    vraag: 'Hoe lang blijven locatiegegevens van een rit of bezorging bewaard nadat die rit is afgelopen?',
    waarom: 'Locatie draait op toestemming (art. 6 lid 1 a). Toestemming voor "tijdens de rit" dekt niet "voor altijd". Er moet een termijn staan die u kunt uitleggen.',
    huidig: nuTermijn('locatie'),
    voorbeeld: '24 uur na afronding van de rit' },

  { id: 'dpia', groep: 'Bewaartermijnen', veld: 'dpia', soort: 'ja-nee-reden',
    vraag: 'Is er een DPIA (gegevensbeschermingseffectbeoordeling) uitgevoerd voor de zorg- en allergiegegevens?',
    waarom: 'Zorggegevens zijn een bijzondere categorie (art. 9). Bij grootschalige verwerking daarvan is een DPIA in de regel verplicht vóór je begint -- niet achteraf.',
    jaVraag: 'Door wie is die uitgevoerd en wanneer?',
    neeVraag: 'Wanneer wordt die uitgevoerd, en door wie? Een datum is genoeg.' },

  // ---------- verwerkersovereenkomsten (art. 28) ----------
  { id: 'vwoHosting', groep: 'Verwerkers', veld: 'vwoHosting', soort: 'ja-nee-reden',
    vraag: 'Ligt er een verwerkersovereenkomst met de hostingpartij of VPS-leverancier?',
    waarom: 'Alles wat op die schijf staat, staat bij hen. Zonder overeenkomst is dat een overtreding en ligt de aansprakelijkheid volledig bij RTG.',
    jaVraag: 'Met welke partij, en per wanneer?', neeVraag: 'Wanneer wordt die geregeld?' },

  { id: 'vwoCdn', groep: 'Verwerkers', veld: 'vwoCdn', soort: 'ja-nee-reden',
    vraag: 'Ligt er een verwerkersovereenkomst met de CDN- of WAF-partij (bijvoorbeeld Cloudflare)?',
    waarom: 'Die partij ziet alle IP-adressen en verzoeken van uw leden. Een IP-adres is een persoonsgegeven.',
    jaVraag: 'Met welke partij, en per wanneer?', neeVraag: 'Wanneer wordt die geregeld, of gebruikt u geen CDN?' },

  { id: 'vwoBetaal', groep: 'Verwerkers', veld: 'vwoBetaal', soort: 'ja-nee-reden',
    vraag: 'Ligt er een verwerkersovereenkomst met de betaalprovider?',
    waarom: 'Betaalgegevens en bedragen zijn herleidbaar tot personen. Betaalproviders hebben hier standaard een overeenkomst voor; het is meestal een kwestie van accepteren, niet van onderhandelen.',
    jaVraag: 'Met welke partij, en per wanneer?', neeVraag: 'Wanneer wordt die geregeld?' },

  { id: 'vwoSmtp', groep: 'Verwerkers', veld: 'vwoSmtp', soort: 'ja-nee-reden',
    vraag: 'Ligt er een verwerkersovereenkomst met de e-mailverzender (SMTP-partij)?',
    waarom: 'Daar gaan e-mailadressen én de inhoud van berichten doorheen: bevestigingen, herstel-links, besluiten over aanmeldingen.',
    jaVraag: 'Met welke partij, en per wanneer?', neeVraag: 'Wanneer wordt die geregeld, of verstuurt u zelf?' },

  { id: 'vwoAi', groep: 'Verwerkers', veld: 'vwoAi', soort: 'ja-nee-reden',
    vraag: 'Ligt er een verwerkersovereenkomst met de AI-aanbieder, voor het geval er met een echte sleutel wordt gedraaid?',
    waarom: 'Zonder sleutel draait alles op vaste demo-antwoorden en gaat er niets naar buiten. Mét sleutel gaat alles wat een lid mij typt naar die partij toe. Dat is een verwerking, en vaak ook een doorgifte buiten de EU.',
    jaVraag: 'Met welke partij, en per wanneer?', neeVraag: 'Wanneer wordt die geregeld, of blijft de AI op demo-antwoorden?' },

  { id: 'vwoFouten', groep: 'Verwerkers', veld: 'vwoFouten', soort: 'ja-nee-reden',
    vraag: 'Wordt er een externe foutentracker gebruikt, en ligt daar een verwerkersovereenkomst voor?',
    waarom: 'Foutmeldingen bevatten vaak meer context dan je denkt. RTG heeft een eigen foutaggregatie, dus dit kan ook gewoon "nee" zijn -- dan is er niets te regelen.',
    jaVraag: 'Met welke partij, en per wanneer?', neeVraag: 'Bevestig dat er geen externe tracker draait.' },

  { id: 'vwoPartners', groep: 'Verwerkers', veld: 'vwoPartners', soort: 'ja-nee-reden',
    vraag: 'Zit er een verwerkersbepaling in de partnerovereenkomst die elke zaak tekent?',
    waarom: 'Dit is de makkelijkste om te vergeten en de grootste in aantal: elke horecazaak, elk hotel en elke vervoerder die de app gebruikt is een verwerker. Dit hoort in het onboarding-proces te zitten, niet in een los mapje.',
    jaVraag: 'In welk document staat die bepaling?', neeVraag: 'Wanneer wordt die in de partnerovereenkomst opgenomen?' },

  { id: 'doorgifte', groep: 'Verwerkers', veld: 'doorgifte', soort: 'tekst', min: 8,
    vraag: 'Welke van deze partijen verwerkt gegevens buiten de EU, en welke waarborg geldt daarvoor?',
    waarom: 'Doorgifte buiten de EU mag alleen met een geldige grondslag, bijvoorbeeld standaardcontractbepalingen. Let vooral op de AI-aanbieder en een eventuele foutentracker; die zitten er vaak buiten.',
    voorbeeld: 'Alleen de AI-aanbieder (VS), op basis van standaardcontractbepalingen' },

  // ---------- het datalek-draaiboek: wie doet wat ----------
  { id: 'rolBeslisser', groep: 'Bij een datalek', veld: 'rolBeslisser', soort: 'tekst', min: 6,
    vraag: 'Wie beslist bij een datalek of er gemeld wordt bij de toezichthouder, en hoe is die persoon buiten kantooruren bereikbaar?',
    waarom: 'De klok van 72 uur begint te lopen zodra iemand het lek ontdekt, niet zodra het uitkomt. Als op zondagavond niemand weet wie mag beslissen, is die klok al aan het tikken terwijl u zoekt.',
    voorbeeld: 'Naam Achternaam, 06-12345678, ook buiten kantooruren' },

  { id: 'rolTechniek', groep: 'Bij een datalek', veld: 'rolTechniek', soort: 'tekst', min: 6,
    vraag: 'Wie dicht bij een datalek het technische gat, en hoe is die bereikbaar?',
    waarom: 'Melden is de ene helft; het lek dicht krijgen is de andere. Die twee zijn zelden dezelfde persoon en moeten allebei bereikbaar zijn.',
    voorbeeld: 'Naam Achternaam, 06-12345678' },

  { id: 'rolCommunicatie', groep: 'Bij een datalek', veld: 'rolCommunicatie', soort: 'tekst', min: 6,
    vraag: 'Wie schrijft en verstuurt het bericht aan de leden als die geïnformeerd moeten worden?',
    waarom: 'Bij hoog risico moeten de betrokkenen zelf worden geïnformeerd, in gewone taal. Dat is werk dat iemand vooraf toegewezen moet krijgen, niet iets wat je op het moment zelf verdeelt.',
    voorbeeld: 'Naam Achternaam, 06-12345678' },

  { id: 'rolJurist', groep: 'Bij een datalek', veld: 'rolJurist', soort: 'tekst', min: 6,
    vraag: 'Welke jurist of DPO wordt bij een datalek gebeld, en op welk nummer?',
    waarom: 'De afweging of iets meldplichtig is, is juridisch. Die wilt u niet op het moment zelf zelf maken, en al helemaal niet met mij.',
    voorbeeld: 'Kantoornaam, mr. Naam, 010-1234567' }
];

module.exports = { VRAGEN };
