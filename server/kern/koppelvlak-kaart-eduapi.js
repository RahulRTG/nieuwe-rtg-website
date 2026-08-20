/* RTG School: de veldkaart van Edu-API (1EdTech).

   Deze kaart stond het langst op onbevestigd, en om een reden die geen fout
   van vandaag was: 1EdTech publiceert zijn specificatie achter een eigen site
   die hier niet te openen is, en er is geen spiegel op GitHub. Op 20 augustus
   2026 is hij alsnog nagekeken langs een omweg -- zie de bron hieronder.

   WAT ER ONDERWEG IS GEBEURD, IN VOLGORDE.

   1. Vier veldnamen (person.displayName, person.dateOfBirth, program.code,
      group.code) stonden hier als werknaam. Alle vier waren verzonnen.
   2. Er werd een 1EdTech-document aangeleverd. Dat bleek de marketing-onepager
      (twee pagina's) zonder een enkele veldnaam. Wel bruikbaar: hij noemde de
      objectfamilies, en daaruit bleek dat Edu-API van Classes en Sections
      spreekt en niet van Groups -- genoeg om de twijfel te vergroten, te
      weinig om iets nieuws neer te zetten.
   3. Toen langs npm: @universis/eduapi levert de JSON-schema's mee. Elk van de
      dertig draagt een 1EdTech-PURL als $id
      (https://purl.imsglobal.org/spec/eduapi/v1p0/schema/json/...), dus dit is
      het model zelf en geen namaak.

   EN ALLE VIER DE WERKNAMEN WAREN FOUT. Niet een beetje: person.dateOfBirth
   heeft een voorvoegsel dat niet bestaat, program.code wijst naar een object
   dat de leerling niet draagt, en group.code noemt een objectsoort die Edu-API
   helemaal niet kent. Dat is precies waarom een werknaam nooit als bevestigd
   mag staan: hij klinkt goed tot je hem naast het schema legt.

   WAT EDU-API ANDERS MAAKT DAN DE DRIE NEDERLANDSE. Het is een model voor
   hoger onderwijs: cursussen, offerings, lectures en labs. Een stamgroep -- de
   klas waar een Nederlands kind het hele jaar in zit -- komt er niet in voor.
   Dat is geen tekortkoming van de standaard maar een verschil in onderwerp, en
   het hoort in de kaart te staan in plaats van weggepoetst te worden met een
   veld dat er toevallig op lijkt. */
const EDUAPI = {
  naam: 'Edu-API',
  bron: 'De officiele JSON-schema\'s van Edu-API v1.0, gelezen op 20 augustus 2026 uit @universis/eduapi 1.26.12 (npm). Alle dertig schema\'s dragen een 1EdTech-PURL als $id; de canonieke locatie purl.imsglobal.org is hiervandaan niet te openen, dus dit is het model langs een meelevende implementatie en niet van de site van 1EdTech zelf.',
  gelezen: true,
  heen: {
    naam: { veld: 'formattedName', staat: 'bevestigd',
      waarom: 'Person.formattedName: de lange, opgemaakte naam. Als enige van de vier standaarden heeft Edu-API hier wel een enkel veld voor. De ontlede vorm heet legalName (een PersonName met familyName, givenName, additionalName, patronymicName en familyNamePrefix); wie die nodig heeft, hoort hem te vullen en niet te laten afleiden.' },
    geboren: { veld: 'dateOfBirth', staat: 'bevestigd',
      waarom: 'Person.dateOfBirth. Hier stond person.dateOfBirth met een voorvoegsel dat niet bestaat: het is een gewone eigenschap van het Person-object.' },
    opleiding: { veld: null, staat: 'bevestigd',
      waarom: 'Staat niet op de persoon. Een opleiding is een Education of EducationOffering met een primaryCode, en een mens hangt eraan via een Enrollment (person + educationOffering). Hier stond program.code; er is geen Program-object.' },
    klasCode: { veld: null, staat: 'bevestigd',
      waarom: 'Edu-API kent geen groep en geen klas. Er is een CourseOffering en een ComponentOffering (een hoorcollege of practicum binnen zo een cursus). Hier stond group.code; die objectsoort bestaat niet, en een stamgroep evenmin.' }
  },
  kanNiet: ['een stamgroep of klas zoals het Nederlandse onderwijs die kent; het model gaat over cursussen en offerings',
    'zorg- en ondersteuningsgegevens; die vallen buiten wat een administratiekoppeling hoort te dragen',
    'onze leerdoelenstructuur met voorkennis en bewijs']
};

module.exports = { EDUAPI };
