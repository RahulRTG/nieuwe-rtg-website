/* RTG School: de veldkaarten van de Integration Fabric -- en hun herkomst.

   HIER STOND EEN GOK. Tot 19 augustus 2026 droeg dit bestand veldnamen die
   niemand had nagekeken. Ze klonken als een standaard en waren het niet, en
   dat is de gevaarlijkste soort code: ze ziet eruit als een koppeling.

   Daarom draagt elk veld nu een STAAT, en elke standaard een BRON:

     bevestigd    -- nagekeken in de specificatie zelf, met vindplaats erbij;
     onbevestigd  -- een werknaam die niemand heeft gecontroleerd.

   Er is geen derde staat en geen veld zonder staat. Wat wij niet konden
   nakijken heet onbevestigd, niet "waarschijnlijk goed".

   WAT WIJ OP 19 AUGUSTUS 2026 WEL EN NIET KONDEN LEZEN. De eduPerson-
   specificatie (REFEDS 202208 v4.4.0) is helemaal gelezen; dat is de
   attributentaal onder Entree. De specificaties van Edu-V, Edu-API en OSO
   waren vanaf deze machine niet te openen: edustandaard.nl,
   developers.wiki.kennisnet.nl, edu-v.atlassian.net, 1edtech.org en
   imsglobal.org geven geen verbinding. Wat daarover hieronder staat komt uit
   zoekresultaten -- tweedehands, en zo staat het er ook bij.

   EEN NULL IS OOK EEN BEWERING. Staat er `veld: null` met staat 'bevestigd',
   dan hebben wij in de specificatie NAGEKEKEN dat er geen veld voor is. Staat
   er null met 'onbevestigd', dan weten wij het niet. */

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

/* Edu-V. Hier stond een leerlingkaart met volledigeNaam, geboortedatum,
   opleidingCode en groepCode. Die namen zijn verzonnen, en waarschijnlijk is
   ook het IDEE fout: de openbare API-lijst die wij konden zien noemt
   Catalogue, Course, Association, Results, Usage, Employees en Delivery -- dat
   gaat over leermiddelen, toegang en gebruik, niet over een leerlingdossier.
   Wij konden de specificatie niet openen, dus wij vervangen de gok niet door
   een tweede gok: er staat nu wat wij niet weten. */
const EDUV = {
  naam: 'Edu-V',
  bron: 'Geen. edu-v.atlassian.net en edustandaard.nl waren op 19 augustus 2026 niet bereikbaar vanaf deze machine; alleen een lijst met API-namen uit zoekresultaten.',
  gelezen: false,
  heen: {
    naam: { veld: null, staat: 'onbevestigd',
      waarom: 'Hier stond volledigeNaam. Die naam is verzonnen en is verwijderd; wij hebben geen gecontroleerde veldnaam voor Edu-V.' },
    geboren: { veld: null, staat: 'onbevestigd',
      waarom: 'Hier stond geboortedatum. Ook verzonnen. Of Edu-V dit gegeven uberhaupt draagt, weten wij niet.' },
    opleiding: { veld: null, staat: 'onbevestigd',
      waarom: 'Hier stond opleidingCode. Verzonnen, en de API-lijst van Edu-V wijst niet op een leerlingadministratie.' },
    klasCode: { veld: null, staat: 'onbevestigd',
      waarom: 'Hier stond groepCode. Verzonnen; Edu-V kent wel een Association API, maar wat daar in staat hebben wij niet kunnen lezen.' }
  },
  kanNiet: ['wij weten het niet: er is voor Edu-V geen veldkaart die iemand heeft nagekeken',
    'de openbare API-lijst (Catalogue, Course, Association, Results, Usage, Employees, Delivery) wijst op leermiddelen en toegang, niet op een leerlingdossier']
};

/* Edu-API (1EdTech). Hier stond person.displayName, person.dateOfBirth,
   program.code en group.code. Een zoekresultaat noemt legalName.familyName,
   wat erop wijst dat de naam een samengesteld object is en niet displayName.
   Nagekeken is er niets: standards.1edtech.org en imsglobal.org waren niet te
   openen. */
const EDUAPI = {
  naam: 'Edu-API',
  bron: 'Geen. standards.1edtech.org, 1edtech.org en imsglobal.org waren op 19 augustus 2026 niet bereikbaar vanaf deze machine.',
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

/* OSO (overstapdossier). Wat er IN het dossier zit is publiek beschreven --
   administratieve gegevens, zorggegevens, begeleidingsgegevens en
   leerresultaten, opgevraagd met BSN of onderwijsnummer plus BRIN -- maar de
   veldnamen staan in de XSD op de Kennisnet-wiki en die konden wij niet
   openen. De namen hieronder zijn Nederlandse werknamen en geen elementen uit
   een schema. */
const OSO = {
  naam: 'OSO (overstapdossier)',
  bron: 'Geen schema gelezen. developers.wiki.kennisnet.nl en edustandaard.nl waren op 19 augustus 2026 niet bereikbaar; alleen beschrijvingen uit zoekresultaten (OSO Gegevensset en Profielen 2026.1).',
  gelezen: false,
  heen: {
    naam: { veld: 'naam', staat: 'onbevestigd', waarom: 'Werknaam. Het echte element staat in de OSO-XSD en die hebben wij niet gelezen.' },
    geboren: { veld: 'geboortedatum', staat: 'onbevestigd', waarom: 'Werknaam. Het echte element staat in de OSO-XSD en die hebben wij niet gelezen.' },
    opleiding: { veld: 'onderwijssoort', staat: 'onbevestigd', waarom: 'Werknaam. Het echte element staat in de OSO-XSD en die hebben wij niet gelezen.' },
    klasCode: { veld: 'groep', staat: 'onbevestigd', waarom: 'Werknaam. Het echte element staat in de OSO-XSD en die hebben wij niet gelezen.' },
    herkomst: { veld: 'vorigeSchool', staat: 'onbevestigd', waarom: 'Werknaam. OSO identificeert een school met een BRIN-nummer; hoe het element heet weten wij niet.' },
    overstappen: { veld: 'overstaphistorie', staat: 'onbevestigd', waarom: 'Werknaam. Of OSO een overstapgeschiedenis als veld kent, hebben wij niet kunnen nakijken.' }
  },
  kanNiet: ['leerdoelen en bewijs van beheersing zoals wij die kennen',
    'de reden waarom een gegeven wel of niet is meegestuurd',
    'zekerheid over de veldnamen hierboven: het schema is niet gelezen']
};

const STANDAARDEN = { eduv: EDUV, entree: ENTREE, eduapi: EDUAPI, oso: OSO };

module.exports = { STANDAARDEN };
