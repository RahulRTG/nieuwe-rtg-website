/* DE RECHTSVORMEN VAN CONTINENTAAL EUROPA (BE, DE, FR, ES).

   Apart van ./rechtsvorm-angelsaksisch.js, en niet alleen om de bestandsgrootte:
   deze landen delen een rechtstraditie waarin een kapitaalvennootschap bij de
   NOTARIS ontstaat en daarna in een register komt. Dat verschil zit in bijna
   elke oprichtingsstap hieronder, en het is precies waar iemand zich op
   verkijkt die een Britse Ltd met een Duitse GmbH vergelijkt.

   De regels waaraan deze tabel zich houdt -- geen verzonnen landen, geen
   Nederlandse instanties, geen Nederlandse fiscale begrippen -- staan in de kop
   van ./rechtsvorm-landen.js. */
'use strict';

const { PRIVE, RECHTSPERSOON_WINST } = require('./rechtsvorm-woorden');

const LANDEN = {
  BE: {
    naam: 'België',
    vormen: {
      'be-eenmanszaak': {
        label: 'Eenmanszaak (België)', kort: 'eenmanszaak',
        rechtspersoon: false, notarieel: false,
        aansprakelijk: 'U bent met uw privévermogen aansprakelijk voor de schulden van de zaak.',
        caps: [PRIVE, 'btw-aangifte'], verboden: ['aandelen', 'winstuitkering'],
        oprichting: ['Ondernemingsnummer aanvragen bij een ondernemingsloket',
          'Inschrijven in de KBO (Kruispuntbank van Ondernemingen)',
          'Btw-activering aanvragen', 'Aansluiten bij een sociaal verzekeringsfonds',
          'Zakelijke rekening openen']
      },
      'be-bv': {
        label: 'Besloten vennootschap (BV, België)', kort: 'bv',
        rechtspersoon: true, notarieel: true,
        aansprakelijk: 'De vennootschap is aansprakelijk; de oprichters wel bij een ontoereikend aanvangsvermogen.',
        caps: [RECHTSPERSOON_WINST, 'aandeelhouders', 'jaarrekening', 'ubo', 'notaris', 'bestuur'],
        verboden: [],
        oprichting: ['Financieel plan opstellen (verplicht bij de notaris)',
          'Statuten bij de notaris', 'Aandelen plaatsen', 'Inschrijven in de KBO',
          'UBO-register invullen', 'Btw-activering aanvragen', 'Zakelijke rekening openen']
      },
      'be-vzw': {
        label: 'Vereniging zonder winstoogmerk (vzw)', kort: 'vzw',
        rechtspersoon: true, notarieel: false,
        aansprakelijk: 'De vzw is aansprakelijk; bestuurders alleen bij een fout in het bestuur.',
        caps: ['bestuur', 'leden', 'ledenvergadering', 'jaarverslag', 'donaties', 'doelstelling', 'ubo'],
        verboden: ['winstuitkering', 'aandelen'],
        oprichting: ['Doelstelling formuleren', 'Ten minste twee oprichters samenbrengen',
          'Statuten opstellen en neerleggen bij de ondernemingsrechtbank',
          'Inschrijven in de KBO', 'UBO-register invullen', 'Bankrekening openen']
      }
    }
  },
  DE: {
    naam: 'Duitsland',
    vormen: {
      'de-einzelunternehmen': {
        label: 'Einzelunternehmen', kort: 'eenmanszaak',
        rechtspersoon: false, notarieel: false,
        aansprakelijk: 'U bent met uw privévermogen aansprakelijk voor de schulden van de zaak.',
        caps: [PRIVE, 'btw-aangifte'], verboden: ['aandelen', 'winstuitkering'],
        oprichting: ['Gewerbeanmeldung doen bij het Gewerbeamt',
          'Steuernummer aanvragen bij het Finanzamt',
          'Beoordelen of inschrijving in het Handelsregister verplicht is',
          'Aansluiten bij de IHK of HWK', 'Zakelijke rekening openen']
      },
      'de-gmbh': {
        label: 'Gesellschaft mit beschränkter Haftung (GmbH)', kort: 'gmbh',
        rechtspersoon: true, notarieel: true,
        aansprakelijk: 'De vennootschap is aansprakelijk, niet u privé -- behalve bij onbehoorlijk bestuur.',
        caps: [RECHTSPERSOON_WINST, 'aandeelhouders', 'jaarrekening', 'deponering', 'ubo', 'notaris', 'bestuur'],
        verboden: [],
        oprichting: ['Statuten bij de notaris', 'Stammkapital van 25.000 euro toezeggen',
          'Ten minste de helft van het kapitaal storten',
          'Inschrijven in het Handelsregister', 'Gewerbeanmeldung doen',
          'Transparenzregister invullen', 'Steuernummer aanvragen bij het Finanzamt']
      },
      'de-ug': {
        label: 'Unternehmergesellschaft (haftungsbeschränkt)', kort: 'ug',
        rechtspersoon: true, notarieel: true,
        aansprakelijk: 'Beperkt aansprakelijk als een GmbH, maar met een minimum kapitaal van één euro.',
        caps: [RECHTSPERSOON_WINST, 'aandeelhouders', 'jaarrekening', 'deponering', 'ubo', 'notaris', 'bestuur'],
        verboden: [],
        oprichting: ['Statuten bij de notaris (modelprotocol mogelijk)',
          'Stammkapital storten (vanaf één euro)',
          'Wettelijke reserve van een kwart van de winst inplannen',
          'Inschrijven in het Handelsregister', 'Gewerbeanmeldung doen',
          'Steuernummer aanvragen bij het Finanzamt']
      },
      'de-ev': {
        label: 'Eingetragener Verein (e.V.)', kort: 'vereniging',
        rechtspersoon: true, notarieel: false,
        aansprakelijk: 'De vereniging is aansprakelijk; bestuurders alleen bij een fout in het bestuur.',
        caps: ['bestuur', 'leden', 'ledenvergadering', 'contributie', 'jaarverslag', 'doelstelling'],
        verboden: ['winstuitkering', 'aandelen'],
        oprichting: ['Ten minste zeven leden samenbrengen', 'Satzung opstellen',
          'Oprichtingsvergadering houden en bestuur kiezen',
          'Inschrijven in het Vereinsregister bij de Amtsgericht',
          'Gemeinnützigkeit aanvragen bij het Finanzamt (optioneel)']
      }
    }
  },
  FR: {
    naam: 'Frankrijk',
    vormen: {
      'fr-entreprise-individuelle': {
        label: 'Entreprise individuelle', kort: 'eenmanszaak',
        rechtspersoon: false, notarieel: false,
        aansprakelijk: 'Sinds 2022 is uw privévermogen in beginsel afgescheiden van uw ondernemingsvermogen.',
        caps: [PRIVE, 'btw-aangifte'], verboden: ['aandelen', 'winstuitkering'],
        oprichting: ['Inschrijven via het guichet unique (INPI)',
          'Kiezen tussen het micro-regime en het gewone regime',
          'SIRET-nummer ontvangen', 'Aansluiten bij de URSSAF',
          'Zakelijke rekening openen']
      },
      'fr-sarl': {
        label: 'Société à responsabilité limitée (SARL)', kort: 'sarl',
        rechtspersoon: true, notarieel: false,
        aansprakelijk: 'De vennootschap is aansprakelijk; de vennoten tot hun inbreng.',
        caps: [RECHTSPERSOON_WINST, 'aandeelhouders', 'jaarrekening', 'bestuur'],
        verboden: [],
        oprichting: ['Statuts opstellen', 'Kapitaal storten op een geblokkeerde rekening',
          'Oprichting publiceren in een journal d\'annonces légales',
          'Inschrijven via het guichet unique (INPI)',
          'Registre des bénéficiaires effectifs invullen']
      },
      'fr-sas': {
        label: 'Société par actions simplifiée (SAS)', kort: 'sas',
        rechtspersoon: true, notarieel: false,
        aansprakelijk: 'De vennootschap is aansprakelijk; de aandeelhouders tot hun inbreng.',
        caps: [RECHTSPERSOON_WINST, 'aandeelhouders', 'aandeelhoudersregister', 'jaarrekening', 'bestuur'],
        verboden: [],
        oprichting: ['Statuts opstellen (grote vrijheid in de inrichting)',
          'Kapitaal storten', 'Président benoemen',
          'Oprichting publiceren in een journal d\'annonces légales',
          'Inschrijven via het guichet unique (INPI)']
      },
      'fr-association': {
        label: 'Association loi 1901', kort: 'vereniging',
        rechtspersoon: true, notarieel: false,
        aansprakelijk: 'De vereniging is aansprakelijk; bestuurders alleen bij een fout in het bestuur.',
        caps: ['bestuur', 'leden', 'ledenvergadering', 'contributie', 'donaties', 'doelstelling'],
        verboden: ['winstuitkering', 'aandelen'],
        oprichting: ['Doelstelling formuleren', 'Statuts opstellen met ten minste twee oprichters',
          'Aangifte doen bij de préfecture', 'Publicatie in het Journal officiel afwachten',
          'Bankrekening openen']
      }
    }
  },
  ES: {
    naam: 'Spanje',
    vormen: {
      'es-autonomo': {
        label: 'Empresario individual (autónomo)', kort: 'eenmanszaak',
        rechtspersoon: false, notarieel: false,
        aansprakelijk: 'U bent met uw privévermogen aansprakelijk voor de schulden van de zaak.',
        caps: [PRIVE, 'btw-aangifte'], verboden: ['aandelen', 'winstuitkering'],
        oprichting: ['NIF of NIE regelen', 'Alta censal doen bij de Agencia Tributaria (modelo 036/037)',
          'Aanmelden bij de RETA (socialezekerheidsregeling voor zelfstandigen)',
          'Gemeentelijke vergunningen navragen', 'Zakelijke rekening openen']
      },
      'es-sl': {
        label: 'Sociedad de responsabilidad limitada (SL)', kort: 'sl',
        rechtspersoon: true, notarieel: true,
        aansprakelijk: 'De vennootschap is aansprakelijk; de vennoten tot hun inbreng.',
        caps: [RECHTSPERSOON_WINST, 'aandeelhouders', 'jaarrekening', 'notaris', 'bestuur'],
        verboden: [],
        oprichting: ['Naam reserveren bij het Registro Mercantil Central',
          'Kapitaal storten', 'Escritura bij de notaris',
          'CIF aanvragen bij de Agencia Tributaria',
          'Inschrijven in het Registro Mercantil', 'Titularidad real opgeven']
      },
      'es-asociacion': {
        label: 'Asociación', kort: 'vereniging',
        rechtspersoon: true, notarieel: false,
        aansprakelijk: 'De vereniging is aansprakelijk; bestuurders alleen bij een fout in het bestuur.',
        caps: ['bestuur', 'leden', 'ledenvergadering', 'contributie', 'donaties', 'doelstelling'],
        verboden: ['winstuitkering', 'aandelen'],
        oprichting: ['Doelstelling formuleren', 'Estatutos opstellen met ten minste drie oprichters',
          'Acta fundacional ondertekenen', 'Inschrijven in het Registro de Asociaciones',
          'CIF aanvragen', 'Bankrekening openen']
      }
    }
  },
};

module.exports = { LANDEN };
