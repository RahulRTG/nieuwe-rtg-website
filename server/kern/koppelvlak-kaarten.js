/* RTG School: de veldkaarten van de Integration Fabric -- en hun herkomst.

   HIER STOND EEN GOK. Tot 19 augustus 2026 droeg dit bestand veldnamen die
   niemand had nagekeken. Ze klonken als een standaard en waren het niet, en
   dat is de gevaarlijkste soort code: ze ziet eruit als een koppeling.

   Daarom draagt elk veld een STAAT, en elke standaard een BRON:

     bevestigd    -- nagekeken in de specificatie zelf, met vindplaats erbij;
     onbevestigd  -- een werknaam die niemand heeft gecontroleerd.

   Er is geen derde staat en geen veld zonder staat. Wat wij niet konden
   nakijken heet onbevestigd, niet "waarschijnlijk goed".

   EN OP 20 AUGUSTUS 2026 IS ER BETER GEZOCHT. Drie van de vier stonden op
   onbevestigd omdat de websites van de standaarden hier niet te openen zijn.
   Dat klopte, maar het was geen reden om te stoppen: twee van de drie
   publiceren hun specificatie OOK op GitHub, en dat is hier wel te bereiken.
   Edu-V en OSO staan nu op bevestigd, uit het bestand zelf.

   WAAR IK MEE FOUT ZAT. Op 19 augustus schreef ik hier dat Edu-V waarschijnlijk
   helemaal geen leerlingadministratie kent -- afgeleid uit een lijst API-namen
   die ik in zoekresultaten zag. Die lijst was onvolledig. Er is een
   students-api.yaml, met een compleet Student-object. Een gevolgtrekking uit
   een lijst die je niet zelf hebt gezien, is ook een gok.

   EEN NULL IS OOK EEN BEWERING. Staat er `veld: null` met staat 'bevestigd',
   dan is in de specificatie NAGEKEKEN dat er geen enkelvoudig veld voor is --
   meestal omdat de standaard het gegeven over meer velden of over een ander
   object verdeelt. Staat er null met 'onbevestigd', dan weten wij het niet. */

/* Entree Federatie. De attributen zelf staan in REFEDS eduPerson 202208 en
   die hebben wij gelezen. Welke daarvan Entree feitelijk doorgeeft, staat op
   de KNF-wiki van Kennisnet en die konden wij niet openen: volgens
   zoekresultaten is de standaardset entree_uid, uid, eduPersonAffiliation,
   givenName, sn, nlEduPersonHomeOrganizationId en nlEduPersonHomeOrganization. */
const ENTREE = {
  naam: 'Entree Federatie',
  bron: 'REFEDS eduPerson (202208) v4.4.0, gelezen op 19 augustus 2026; de attributenset van Entree zelf alleen uit zoekresultaten van de KNF-wiki.',
  gelezen: true,
  heen: {
    naam: { veld: 'displayName', staat: 'onbevestigd',
      waarom: 'displayName bestaat in eduPerson (paragraaf 3.4), maar staat niet in de standaardset die Entree volgens tweedehands bronnen doorgeeft; daar staan givenName en sn. Een naam over twee velden splitsen doen wij niet op de gok.' },
    geboren: { veld: null, staat: 'bevestigd',
      waarom: 'eduPerson 202208 kent geen enkel geboorteattribuut. Entree is een inlogfederatie en geen administratie.' },
    opleiding: { veld: null, staat: 'bevestigd',
      waarom: 'Hier stond eduPersonAffiliation, en dat is fout: de toegestane waarden zijn faculty, student, staff, alum, member, affiliate, employee en library-walk-in. Dat zegt WAT voor iemand je bent, niet welke opleiding je volgt.' },
    klasCode: { veld: null, staat: 'bevestigd',
      waarom: 'Hier stond eduPersonOrgUnit; dat attribuut bestaat niet. eduPersonOrgUnitDN bestaat wel (paragraaf 2.2.5), maar dat is de distinguished name van een organisatieonderdeel en niet een klas.' }
  },
  kanNiet: ['een geboortedatum: in eduPerson 202208 komt geen geboorteattribuut voor',
    'een opleiding of een klas; de attributen die erop lijken zeggen iets anders (eduPersonAffiliation is een soort persoon, eduPersonOrgUnitDN een organisatieonderdeel)',
    'documenten en bewijsstukken van een leerling']
};

/* Edu-V, nagekeken in de OpenAPI-bestanden zelf (github.com/edu-v/afsprakenstelsel,
   apis/students-api.yaml en apis/association-api.yaml, opgehaald 20 augustus 2026).

   DE VORM VERRASTE. Een leerling is bij Edu-V niet een record met een klas en
   een opleiding erin: het Student-object draagt alleen identiteit en naam, en
   waar iemand zit staat ERNAAST -- een Group en een Enrollment in de
   Association API, die naar de leerling verwijzen. Twee van onze vier velden
   hebben daar dus geen veld maar een ander object. */
const EDUV = {
  naam: 'Edu-V',
  bron: 'github.com/edu-v/afsprakenstelsel, apis/students-api.yaml en apis/association-api.yaml, gelezen op 20 augustus 2026.',
  gelezen: true,
  heen: {
    naam: { veld: null, staat: 'bevestigd',
      waarom: 'Het Student-object splitst de naam over givenName, familyNamePrefix en familyName (plus preferredFirstName). Een naam over drie velden verdelen doen wij niet op de gok; het tussenvoegsel is precies waar dat misgaat.' },
    geboren: { veld: 'dateOfBirth', staat: 'bevestigd',
      waarom: 'Student.dateOfBirth, formaat YYYY-MM-DD. Komt alleen mee binnen de scope student.demographics: zonder die scope stuurt Edu-V het niet.' },
    opleiding: { veld: null, staat: 'bevestigd',
      waarom: 'Staat niet op de leerling. Edu-V legt dit vast als Enrollment met enrollmentType study, dat verwijst naar een studyOfferingId (en studyPublicId in RIO) plus een studyYear -- een ander object in de Association API.' },
    klasCode: { veld: null, staat: 'bevestigd',
      waarom: 'Staat niet op de leerling. De klas is een Group in de Association API met groupId en groupName, groupType class (de stamgroep), die naar zijn leerlingen verwijst in plaats van andersom.' }
  },
  kanNiet: ['een leerling met zijn klas en opleiding in een keer: die staan in aparte objecten (Group, Enrollment) in een andere API',
    'de overstapgeschiedenis van een leerling; daarvoor is OSO de standaard',
    'een geboortedatum zonder de scope student.demographics']
};

/* Edu-API (1EdTech). Hier stond person.displayName, person.dateOfBirth,
   program.code en group.code. Een zoekresultaat noemt legalName.familyName,
   wat erop wijst dat de naam een samengesteld object is en niet displayName.
   Nagekeken is er niets: standards.1edtech.org en imsglobal.org waren niet te
   openen. */
const EDUAPI = {
  naam: 'Edu-API',
  bron: 'Geen. standards.1edtech.org, 1edtech.org en imsglobal.org zijn hier niet te openen, en op 20 augustus 2026 is ook gezocht naar een publieke spiegel (GitHub, npm): die is er niet. 1EdTech publiceert achter zijn eigen standards-site.',
  gelezen: false,
  heen: {
    naam: { veld: null, staat: 'onbevestigd',
      waarom: 'Hier stond person.displayName. Een zoekresultaat noemt legalName.familyName, dus de naam is daar vermoedelijk een samengesteld object; wij weten niet welke vorm en zetten er geen tweede gok voor in de plaats.' },
    geboren: { veld: 'person.dateOfBirth', staat: 'onbevestigd',
      waarom: 'Nooit nagekeken. Een werknaam, geen specificatie.' },
    opleiding: { veld: 'program.code', staat: 'onbevestigd',
      waarom: 'Nooit nagekeken. Een werknaam, geen specificatie.' },
    klasCode: { veld: 'group.code', staat: 'onbevestigd',
      waarom: 'Nooit nagekeken. Een werknaam, geen specificatie.' }
  },
  kanNiet: ['zorg- en ondersteuningsgegevens; die vallen buiten wat een administratiekoppeling hoort te dragen',
    'onze leerdoelenstructuur met voorkennis en bewijs',
    'zekerheid over de veldnamen hierboven: die zijn niet nagekeken']
};

/* OSO, nagekeken in het schema zelf (github.com/edustandaard/oso-gegevensset,
   common/OSO_gegevensset.xsd, opgehaald 20 augustus 2026). Twee van mijn
   werknamen bleken toevallig goed en twee fout -- en dat is precies waarom een
   werknaam nooit als bevestigd mag staan. */
const OSO = {
  naam: 'OSO (overstapdossier)',
  bron: 'github.com/edustandaard/oso-gegevensset, common/OSO_gegevensset.xsd, gelezen op 20 augustus 2026.',
  gelezen: true,
  heen: {
    naam: { veld: null, staat: 'bevestigd',
      waarom: 'Het leerling-element splitst de naam over voornaam (meervoud toegestaan), voorletters-1, voorvoegsel, achternaam en roepnaam. Vijf velden; wij verdelen een naam niet op de gok.' },
    geboren: { veld: 'geboortedatum', staat: 'bevestigd',
      waarom: 'leerling/geboortedatum, type xs:date. Naast dit veld kent OSO geboortemaand: een anonieme variant voor leeftijdsbepaling.' },
    opleiding: { veld: null, staat: 'bevestigd',
      waarom: 'De gegevensset kent geen enkelvoudig opleidingveld. Wat er wel is, is iets anders: profiel is extra informatie uit een codelijst, en codelgfonderwijssoort gaat over een LGF-indicatie.' },
    klasCode: { veld: 'groepscode', staat: 'bevestigd',
      waarom: 'De code van de groep waarin de leerling geplaatst is, zoals de XSD het zelf zegt. Hier stond de werknaam groep; die bestaat niet.' },
    herkomst: { veld: null, staat: 'bevestigd',
      waarom: 'OSO kent geen vorige school als veld. Het dossier draagt huidigeschool: de school die overdraagt. Wie het ontvangt, is de vorige school van dat moment.' },
    overstappen: { veld: 'schoolloopbaanlijst', staat: 'bevestigd',
      waarom: 'Historie van scholen en schooljaren, met per schooljaar een schoolloopbaan-element (schooljaar, groepscode, groepsnaam). Hier stond de werknaam overstaphistorie; die bestaat niet.' }
  },
  kanNiet: ['leerdoelen en bewijs van beheersing zoals wij die kennen',
    'de reden waarom een gegeven wel of niet is meegestuurd',
    'een opleiding als enkelvoudig gegeven; de gegevensset kent dat veld niet']
};

const STANDAARDEN = { eduv: EDUV, entree: ENTREE, eduapi: EDUAPI, oso: OSO };

module.exports = { STANDAARDEN };
