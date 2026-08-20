/* RTG School: de veldkaart van Edu-API (1EdTech) -- de enige die niet is
   nagekeken.

   Waarom apart van de andere drie: Entree, Edu-V en OSO zijn de Nederlandse
   onderwijsketen en die publiceert haar specificaties openbaar, dus die zijn
   te controleren. 1EdTech doet dat niet. Dat verschil is geen toeval van
   vandaag maar een eigenschap van de partij, en het bepaalt wat wij over die
   kaart kunnen zeggen. Zolang dat zo blijft, hoort deze kaart een eigen plek
   te hebben in plaats van mee te liften op het gezelschap van drie kaarten die
   wel zijn nagekeken.

   De regels (staat, bron, wat een null betekent) staan in
   ./koppelvlak-kaarten.js; die gelden hier onverkort.

   Op 20 augustus 2026 is hier een document van 1EdTech bij gelegd. Dat bleek
   de marketing-onepager te zijn (twee pagina's, "Power Smart, Secure, and
   Personalized Learning") en geen specificatie: er staat geen enkele veldnaam
   in. Hij is wel gelezen en levert een ding op dat telt -- de objectfamilies
   die Edu-API dekt: Courses, Programs, Learning Paths, Classes, Sections,
   Students, Teachers, Observers, People, Terms, Sessions, Grades, Mastery,
   Contact Info en Demographics.

   Daar zit een SIGNAAL in. Edu-API spreekt van Classes en Sections, niet van
   Groups -- dus `group.code` heeft waarschijnlijk al de verkeerde objectnaam.
   Dat is precies genoeg om de twijfel te vergroten en te weinig om er een
   nieuwe naam voor in de plaats te zetten: een tweede gok is geen correctie.
   Wat dit wel bevestigt, is dat de BEGRIPPEN bestaan (Programs voor opleiding,
   Classes voor een klas, Demographics voor een geboortedatum); alleen de
   sleutelnamen zijn onbekend.

   Wat deze kaart zou afmaken: het Edu-API informatiemodel of de JSON-schema's
   van standards.1edtech.org -- niet de brochure. */
const EDUAPI = {
  naam: 'Edu-API',
  bron: 'Geen specificatie. standards.1edtech.org en imsglobal.org zijn hier niet te openen, er is geen publieke spiegel op GitHub of npm, en het aangeleverde 1EdTech-document van 20 augustus 2026 is de marketing-onepager zonder veldnamen.',
  gelezen: false,
  heen: {
    naam: { veld: null, staat: 'onbevestigd',
      waarom: 'Hier stond person.displayName. Een zoekresultaat noemt legalName.familyName, dus de naam is daar vermoedelijk een samengesteld object; wij weten niet welke vorm en zetten er geen tweede gok voor in de plaats.' },
    geboren: { veld: 'person.dateOfBirth', staat: 'onbevestigd',
      waarom: 'Nooit nagekeken. Een werknaam, geen specificatie.' },
    opleiding: { veld: 'program.code', staat: 'onbevestigd',
      waarom: 'Nooit nagekeken. Een werknaam, geen specificatie.' },
    klasCode: { veld: 'group.code', staat: 'onbevestigd',
      waarom: 'Nooit nagekeken, en waarschijnlijk al fout op de objectnaam: 1EdTech spreekt van Classes en Sections, niet van Groups. Er staat geen tweede gok voor in de plaats -- dat zou de fout herhalen in plaats van hem oplossen.' }
  },
  kanNiet: ['zorg- en ondersteuningsgegevens; die vallen buiten wat een administratiekoppeling hoort te dragen',
    'onze leerdoelenstructuur met voorkennis en bewijs',
    'zekerheid over de veldnamen hierboven: de specificatie is niet gelezen, alleen de brochure']
};


module.exports = { EDUAPI };
