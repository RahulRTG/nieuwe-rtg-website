/* DE RECHTSVORMEN VAN DE ANGELSAKSISCHE LANDEN (GB, US).

   Apart van ./rechtsvorm-europa.js, en niet alleen om de bestandsgrootte: hier
   ontstaat een vennootschap door REGISTRATIE en niet bij de notaris, en in de
   Verenigde Staten is het bedrijfsrecht bovendien van de staat en niet van de
   federatie. Dat laatste staat als `let` bij het land zelf, want een landelijke
   lijst leest anders als een landelijke waarheid.

   De regels waaraan deze tabel zich houdt staan in de kop van
   ./rechtsvorm-landen.js. */
'use strict';

const { PRIVE, RECHTSPERSOON_WINST } = require('./rechtsvorm-woorden');

const LANDEN = {
  GB: {
    naam: 'Verenigd Koninkrijk',
    vormen: {
      'gb-sole-trader': {
        label: 'Sole trader', kort: 'eenmanszaak',
        rechtspersoon: false, notarieel: false,
        aansprakelijk: 'U bent met uw privévermogen aansprakelijk voor de schulden van de zaak.',
        caps: [PRIVE], verboden: ['aandelen', 'winstuitkering'],
        oprichting: ['Registreren voor Self Assessment bij HMRC',
          'National Insurance-bijdrage regelen',
          'Beoordelen of btw-registratie (VAT) verplicht is', 'Zakelijke rekening openen']
      },
      'gb-ltd': {
        label: 'Private company limited by shares (Ltd)', kort: 'ltd',
        rechtspersoon: true, notarieel: false,
        aansprakelijk: 'De vennootschap is aansprakelijk; de aandeelhouders tot het bedrag van hun aandelen.',
        caps: [RECHTSPERSOON_WINST, 'aandeelhouders', 'aandeelhoudersregister', 'jaarrekening', 'deponering', 'bestuur'],
        verboden: [],
        oprichting: ['Naam controleren bij Companies House', 'Articles of association vaststellen',
          'Director(s) en shareholders benoemen', 'Registreren bij Companies House',
          'Register of people with significant control aanleggen',
          'Corporation Tax aanmelden bij HMRC']
      },
      'gb-llp': {
        label: 'Limited liability partnership (LLP)', kort: 'llp',
        rechtspersoon: true, notarieel: false,
        aansprakelijk: 'De LLP is aansprakelijk; de partners in beginsel tot hun inbreng.',
        caps: [PRIVE, 'vennoten', 'vennootschapscontract', 'jaarrekening', 'deponering'],
        verboden: ['aandelen'],
        oprichting: ['Ten minste twee designated members aanwijzen',
          'LLP agreement opstellen', 'Registreren bij Companies House',
          'Elke partner apart aanmelden voor Self Assessment bij HMRC']
      }
    }
  },
  US: {
    naam: 'Verenigde Staten',
    /* Het bedrijfsrecht is hier van de STAAT en niet van de federatie. Wat
       hieronder staat geldt in grote lijnen overal, maar de instantie, de
       kosten en de jaarplichten verschillen per staat -- en dat staat in het
       antwoord, niet alleen hier. */
    let: 'In de Verenigde Staten is het bedrijfsrecht van de staat en niet van de federatie. Welke instantie, welke kosten en welke jaarplichten er gelden, verschilt per staat. Ga dit altijd na voor de staat waar u zich vestigt.',
    vormen: {
      'us-sole-proprietorship': {
        label: 'Sole proprietorship', kort: 'eenmanszaak',
        rechtspersoon: false, notarieel: false,
        aansprakelijk: 'U bent met uw privévermogen aansprakelijk voor de schulden van de zaak.',
        caps: [PRIVE], verboden: ['aandelen', 'winstuitkering'],
        oprichting: ['Beoordelen of een DBA-registratie ("doing business as") nodig is',
          'EIN aanvragen bij de IRS als u personeel krijgt',
          'Staats- en gemeentevergunningen navragen', 'Zakelijke rekening openen']
      },
      'us-llc': {
        label: 'Limited liability company (LLC)', kort: 'llc',
        rechtspersoon: true, notarieel: false,
        aansprakelijk: 'De LLC is aansprakelijk; de leden in beginsel niet privé.',
        caps: [PRIVE, 'bestuur', 'aandeelhouders'],
        verboden: [],
        oprichting: ['Staat kiezen om in op te richten',
          'Articles of organization indienen bij de secretary of state',
          'Registered agent aanwijzen', 'Operating agreement opstellen',
          'EIN aanvragen bij de IRS',
          'Fiscale behandeling kiezen (standaard loopt de winst door naar de leden)']
      },
      'us-c-corp': {
        label: 'C corporation', kort: 'corporation',
        rechtspersoon: true, notarieel: false,
        aansprakelijk: 'De vennootschap is aansprakelijk; de aandeelhouders tot hun inbreng.',
        caps: [RECHTSPERSOON_WINST, 'aandeelhouders', 'aandeelhoudersregister', 'jaarrekening', 'bestuur'],
        verboden: [],
        oprichting: ['Staat kiezen om in op te richten',
          'Articles of incorporation indienen bij de secretary of state',
          'Bylaws vaststellen', 'Board of directors benoemen', 'Aandelen uitgeven',
          'EIN aanvragen bij de IRS']
      },
      'us-nonprofit': {
        label: 'Nonprofit corporation (501(c)(3)-kandidaat)', kort: 'stichting',
        rechtspersoon: true, notarieel: false,
        aansprakelijk: 'De rechtspersoon is aansprakelijk; bestuurders alleen bij een fout in het bestuur.',
        caps: ['bestuur', 'donaties', 'jaarverslag', 'doelstelling'],
        verboden: ['winstuitkering', 'aandelen'],
        oprichting: ['Doelstelling formuleren die aan 501(c)(3) voldoet',
          'Articles of incorporation indienen bij de secretary of state',
          'Bylaws en conflict-of-interest-beleid vaststellen', 'Board benoemen',
          'EIN aanvragen bij de IRS', 'Form 1023 indienen voor de belastingvrijstelling']
      }
    }
  }
};

module.exports = { LANDEN };
