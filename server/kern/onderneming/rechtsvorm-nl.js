/* DE NEDERLANDSE RECHTSVORMEN.

   Los van ./rechtsvorm.js omdat dat bestand over de 10 kB van het modulebeleid
   ging, en langs dezelfde naad als de buitenlandse tabellen: hier staat WAT er
   is, daar staat wat je ermee doet (samenvoegen, verboden aftrekken, per land
   opvragen). Waarom `verboden` apart van `caps` bestaat, staat in de kop van
   ./rechtsvorm.js -- dat is de grendel waar deze tabel op leunt.

   De ids zijn kaal ('bv', 'stichting') en blijven dat: ze staan in de opslag
   van bestaande ondernemingen, en een hernoemde id laat een bestaand bedrijf
   achter zonder rechtsvorm. */
'use strict';

/* De caps van de B.V. staan hier los, omdat de holding ze erft. Overtypen zou
   betekenen dat een nieuwe bv-verplichting stil buiten de holding blijft. */
/* `bestuur` staat er bij, en dat is geen detail: een B.V. heeft altijd een
   statutair bestuur. Het ontbrak, en dat viel pas op toen kern/onderneming/
   bestuur.js op deze cap ging leunen -- een B.V. kon toen geen bestuurder
   inschrijven. Zo hoort het ook op te vallen: de as is de waarheid. */
const BV_CAPS = ['vpb', 'dga-loon', 'bestuur', 'aandeelhouders', 'aandeelhoudersregister',
  'ubo', 'jaarrekening', 'deponering', 'notaris'];
/* Wat een rechtspersoon met aandelen nooit mag: de ondernemersaftrekken uit de
   inkomstenbelasting. Ook los, om dezelfde reden. */
const IB_AFTREK = ['urencriterium', 'startersaftrek', 'mkb-winstvrijstelling'];

const NL = {
  eenmanszaak: {
    label: 'Eenmanszaak', kort: 'zzp', land: 'NL', rechtspersoon: false, notarieel: false,
    aansprakelijk: 'U bent met uw privévermogen aansprakelijk voor de schulden van de zaak.',
    caps: ['ib-aangifte', 'urencriterium', 'startersaftrek', 'mkb-winstvrijstelling', 'kleineondernemersregeling'],
    verboden: ['aandelen', 'dga-loon', 'winstuitkering'],
    oprichting: ['bedrijfsnaam kiezen', 'inschrijven bij de KvK', 'btw-nummer aanvragen',
      'zakelijke rekening openen', 'aansprakelijkheidsverzekering', 'algemene voorwaarden']
  },
  vof: {
    label: 'Vennootschap onder firma', kort: 'vof', land: 'NL', rechtspersoon: false, notarieel: false,
    aansprakelijk: 'Elke vennoot is hoofdelijk aansprakelijk -- ook voor de schulden die een ander aangaat.',
    caps: ['ib-aangifte', 'urencriterium', 'startersaftrek', 'mkb-winstvrijstelling',
      'kleineondernemersregeling', 'vennoten', 'vennootschapscontract'],
    verboden: ['aandelen', 'dga-loon', 'winstuitkering'],
    oprichting: ['bedrijfsnaam kiezen', 'vennootschapscontract opstellen', 'winstverdeling vastleggen',
      'inschrijven bij de KvK', 'btw-nummer aanvragen', 'zakelijke rekening openen']
  },
  bv: {
    label: 'Besloten vennootschap', kort: 'bv', land: 'NL', rechtspersoon: true, notarieel: true,
    aansprakelijk: 'De vennootschap is aansprakelijk, niet u privé -- behalve bij onbehoorlijk bestuur.',
    caps: BV_CAPS.slice(),
    verboden: IB_AFTREK.slice(),
    oprichting: ['bedrijfsnaam controleren', 'statuten bij de notaris', 'aandelen verdelen',
      'inschrijven bij de KvK', 'UBO-opgave doen', 'zakelijke rekening openen',
      'DGA-salaris vaststellen', 'aandeelhoudersregister aanleggen']
  },
  holding: {
    label: 'Holding met werkmaatschappij(en)', kort: 'holding', land: 'NL', rechtspersoon: true, notarieel: true,
    aansprakelijk: 'Elke vennootschap is apart aansprakelijk; de holding houdt de aandelen.',
    caps: BV_CAPS.concat(['deelnemingen', 'intercompany', 'consolidatie', 'fiscale-eenheid']),
    verboden: IB_AFTREK.slice(),
    oprichting: ['structuur bepalen', 'statuten bij de notaris', 'holding oprichten',
      'werkmaatschappij oprichten', 'aandelen storten', 'inschrijven bij de KvK',
      'UBO-opgave doen', 'managementovereenkomst opstellen']
  },
  stichting: {
    label: 'Stichting', kort: 'stichting', land: 'NL', rechtspersoon: true, notarieel: true,
    aansprakelijk: 'De stichting is aansprakelijk; bestuurders alleen bij onbehoorlijk bestuur.',
    caps: ['bestuur', 'ubo', 'jaarverslag', 'donaties', 'anbi', 'doelstelling', 'notaris'],
    /* Een stichting heeft geen eigenaar en geen winstoogmerk. Deze vier zijn de
       reden dat verboden apart bestaat: ze mogen door GEEN enkele andere as
       alsnog aangezet worden. */
    verboden: ['winstuitkering', 'aandelen', 'dga-loon'].concat(IB_AFTREK),
    oprichting: ['doelstelling formuleren', 'bestuur samenstellen', 'statuten bij de notaris',
      'inschrijven bij de KvK', 'UBO-opgave doen', 'bankrekening openen',
      'beleidsplan opstellen', 'ANBI-status aanvragen (optioneel)']
  },
  vereniging: {
    label: 'Vereniging', kort: 'vereniging', land: 'NL', rechtspersoon: true, notarieel: false,
    aansprakelijk: 'Zonder notariële akte zijn de bestuurders hoofdelijk aansprakelijk.',
    caps: ['bestuur', 'leden', 'ledenvergadering', 'contributie', 'ubo', 'jaarverslag', 'anbi'],
    verboden: ['winstuitkering', 'aandelen', 'dga-loon'].concat(IB_AFTREK),
    oprichting: ['doelstelling formuleren', 'bestuur samenstellen', 'statuten opstellen',
      'ledenvergadering beleggen', 'inschrijven bij de KvK', 'contributie vaststellen']
  },
  cooperatie: {
    label: 'Coöperatie', kort: 'coöperatie', land: 'NL', rechtspersoon: true, notarieel: true,
    aansprakelijk: 'De coöperatie is aansprakelijk; de aansprakelijkheid van de leden staat in de statuten.',
    caps: ['bestuur', 'leden', 'ledenvergadering', 'vpb', 'ubo', 'jaarrekening', 'notaris'],
    verboden: IB_AFTREK.slice(),
    oprichting: ['doelstelling formuleren', 'leden werven', 'statuten bij de notaris',
      'aansprakelijkheid kiezen (WA/BA/UA)', 'inschrijven bij de KvK', 'UBO-opgave doen']
  }
};


module.exports = { NL, BV_CAPS, IB_AFTREK };
