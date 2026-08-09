/* DE RECHTSVORM-AS.

   `kern/werkvormen.js` weet wat een zaak DOET; deze module weet wat zij
   JURIDISCH IS. Dat zijn twee assen en niet een, want ze staan los van
   elkaar: een glazenwasser doet hetzelfde werk als eenmanszaak en als B.V.,
   maar de B.V. heeft aandeelhouders, een UBO-opgave, DGA-loon,
   vennootschapsbelasting en een jaarrekening, en de eenmanszaak heeft
   urencriterium en startersaftrek. Wie die twee op een hoop gooit, krijgt
   een stichting met een aandeelhoudersregister.

   ANDERS DAN EEN WERKVORM WORDT EEN RECHTSVORM NIET AFGELEID. Een werkvorm
   volgt uit gedrag (er staat een auto in de vloot, dus rittools), en dat mag
   afgeleid worden omdat het gedrag zelf de waarheid is. Een rechtsvorm is een
   juridisch feit dat bij de notaris en de KvK is vastgelegd; die kun je niet
   uit gedrag raden, en gokken zou hier betekenen dat iemand op de verkeerde
   belastingaangifte wordt gezet. Hij wordt dus opgegeven. Wat eruit VOLGT --
   de verplichtingen, het gereedschap en de oprichtingsstappen -- staat hier
   als data, zodat het maar op een plek staat.

   VERBODEN IS GEEN TWEEDE CAPSLIJST MAAR HET TEGENDEEL ERVAN, en hij bestaat
   apart omdat een verbod anders verliest van een andere as. Een stichting mag
   geen winst uitkeren. Zou 'winstuitkering' alleen ONTBREKEN in haar caps, dan
   zet de eerste as die hem wel meebrengt de knop er alsnog neer -- en dat is
   precies hoe een grendel stil verdwijnt. Daarom trekt capsSamen() de verboden
   er NA het samenvoegen af: wat verboden is, wint altijd. */
'use strict';

/* De caps van de B.V. staan hier los, omdat de holding ze erft. Overtypen zou
   betekenen dat een nieuwe bv-verplichting stil buiten de holding blijft. */
const BV_CAPS = ['vpb', 'dga-loon', 'aandeelhouders', 'aandeelhoudersregister',
  'ubo', 'jaarrekening', 'deponering', 'notaris'];
/* Wat een rechtspersoon met aandelen nooit mag: de ondernemersaftrekken uit de
   inkomstenbelasting. Ook los, om dezelfde reden. */
const IB_AFTREK = ['urencriterium', 'startersaftrek', 'mkb-winstvrijstelling'];

const RECHTSVORMEN = {
  eenmanszaak: {
    label: 'Eenmanszaak', kort: 'zzp', rechtspersoon: false, notarieel: false,
    aansprakelijk: 'U bent met uw privévermogen aansprakelijk voor de schulden van de zaak.',
    caps: ['ib-aangifte', 'urencriterium', 'startersaftrek', 'mkb-winstvrijstelling', 'kleineondernemersregeling'],
    verboden: ['aandelen', 'dga-loon', 'winstuitkering'],
    oprichting: ['bedrijfsnaam kiezen', 'inschrijven bij de KvK', 'btw-nummer aanvragen',
      'zakelijke rekening openen', 'aansprakelijkheidsverzekering', 'algemene voorwaarden']
  },
  vof: {
    label: 'Vennootschap onder firma', kort: 'vof', rechtspersoon: false, notarieel: false,
    aansprakelijk: 'Elke vennoot is hoofdelijk aansprakelijk -- ook voor de schulden die een ander aangaat.',
    caps: ['ib-aangifte', 'urencriterium', 'startersaftrek', 'mkb-winstvrijstelling',
      'kleineondernemersregeling', 'vennoten', 'vennootschapscontract'],
    verboden: ['aandelen', 'dga-loon', 'winstuitkering'],
    oprichting: ['bedrijfsnaam kiezen', 'vennootschapscontract opstellen', 'winstverdeling vastleggen',
      'inschrijven bij de KvK', 'btw-nummer aanvragen', 'zakelijke rekening openen']
  },
  bv: {
    label: 'Besloten vennootschap', kort: 'bv', rechtspersoon: true, notarieel: true,
    aansprakelijk: 'De vennootschap is aansprakelijk, niet u privé -- behalve bij onbehoorlijk bestuur.',
    caps: BV_CAPS.slice(),
    verboden: IB_AFTREK.slice(),
    oprichting: ['bedrijfsnaam controleren', 'statuten bij de notaris', 'aandelen verdelen',
      'inschrijven bij de KvK', 'UBO-opgave doen', 'zakelijke rekening openen',
      'DGA-salaris vaststellen', 'aandeelhoudersregister aanleggen']
  },
  holding: {
    label: 'Holding met werkmaatschappij(en)', kort: 'holding', rechtspersoon: true, notarieel: true,
    aansprakelijk: 'Elke vennootschap is apart aansprakelijk; de holding houdt de aandelen.',
    caps: BV_CAPS.concat(['deelnemingen', 'intercompany', 'consolidatie', 'fiscale-eenheid']),
    verboden: IB_AFTREK.slice(),
    oprichting: ['structuur bepalen', 'statuten bij de notaris', 'holding oprichten',
      'werkmaatschappij oprichten', 'aandelen storten', 'inschrijven bij de KvK',
      'UBO-opgave doen', 'managementovereenkomst opstellen']
  },
  stichting: {
    label: 'Stichting', kort: 'stichting', rechtspersoon: true, notarieel: true,
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
    label: 'Vereniging', kort: 'vereniging', rechtspersoon: true, notarieel: false,
    aansprakelijk: 'Zonder notariële akte zijn de bestuurders hoofdelijk aansprakelijk.',
    caps: ['bestuur', 'leden', 'ledenvergadering', 'contributie', 'ubo', 'jaarverslag', 'anbi'],
    verboden: ['winstuitkering', 'aandelen', 'dga-loon'].concat(IB_AFTREK),
    oprichting: ['doelstelling formuleren', 'bestuur samenstellen', 'statuten opstellen',
      'ledenvergadering beleggen', 'inschrijven bij de KvK', 'contributie vaststellen']
  },
  cooperatie: {
    label: 'Coöperatie', kort: 'coöperatie', rechtspersoon: true, notarieel: true,
    aansprakelijk: 'De coöperatie is aansprakelijk; de aansprakelijkheid van de leden staat in de statuten.',
    caps: ['bestuur', 'leden', 'ledenvergadering', 'vpb', 'ubo', 'jaarrekening', 'notaris'],
    verboden: IB_AFTREK.slice(),
    oprichting: ['doelstelling formuleren', 'leden werven', 'statuten bij de notaris',
      'aansprakelijkheid kiezen (WA/BA/UA)', 'inschrijven bij de KvK', 'UBO-opgave doen']
  }
};

const isRechtsvorm = (id) => Object.prototype.hasOwnProperty.call(RECHTSVORMEN, id);

/* De rechtsvorm of null. Null en niet een standaardwaarde: "ik weet nog niet
   wat ik word" is een echte stand in de ideefase, en die mag geen eenmanszaak
   worden genoemd omdat dat toevallig de meest voorkomende is. */
function rechtsvormVan(id) {
  return isRechtsvorm(id) ? Object.assign({ id }, RECHTSVORMEN[id]) : null;
}

const capsVanRechtsvorm = (id) => (isRechtsvorm(id) ? RECHTSVORMEN[id].caps.slice() : []);
const verbodenVanRechtsvorm = (id) => (isRechtsvorm(id) ? RECHTSVORMEN[id].verboden.slice() : []);

/* De samenvoeging van alle assen, met de verboden er NA afgetrokken.
   Geeft ook terug WAT er is weggehouden en waarom, zodat een scherm kan
   uitleggen waarom een knop er niet staat -- een functie die zonder uitleg
   ontbreekt, leest als een storing. */
function capsSamen(lijsten, verboden) {
  const uit = new Set();
  for (const l of lijsten) for (const c of (l || [])) uit.add(c);
  const weg = [];
  for (const v of (verboden || [])) if (uit.delete(v)) weg.push(v);
  return { caps: [...uit].sort(), geweerd: weg.sort() };
}

module.exports = { RECHTSVORMEN, isRechtsvorm, rechtsvormVan, capsVanRechtsvorm, verbodenVanRechtsvorm, capsSamen };
