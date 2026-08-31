/* Foundation OS (kern/rtfos), deel "basis": de gedeelde bodem waar alle andere
   delen op staan. Opslag, schoonmaak, het auditspoor, de zetels (wie is wie),
   de rechtenmatrix en de vlaggen per stad.

   WAAROM DIT EEN EIGEN LAAG IS. De RTFoundation is federatief: EEN landelijke
   stichting, meerdere stadsafdelingen die zelfstandig werken, en per stad een
   of meer lokale partnerstichtingen. Dat werkt alleen als "wie mag wat, waar"
   op EEN plek staat. Zodra elke module zijn eigen controle bedenkt, lopen ze
   uiteen -- en dan is het niet de code die de governance draagt maar het
   geheugen van wie hem las (LAT.md regel 4).

   DE ZETEL IS DE IDENTITEIT, NIET DE KANTOORCODE. Een zetel hangt aan de sleutel
   die kern/kantoor.js uit een ECHTE inlog haalt (boardroomWie): een RTG-account
   of een kantoorsessie met een naam erachter. De gedeelde kantoorcode levert
   geen sleutel op en krijgt dus nooit een zetel. Dat is met opzet: een stad
   besturen, geld goedkeuren en een casus openen zijn handelingen die herleidbaar
   moeten zijn tot een mens.

   Opslag: db.data.rtfos.{steden,zetels,partners,projecten,vrijwilligers,casussen,
   bronnen,uitgaven,subsidies,incidenten,gemeenten,ondernemers,voorraad,
   activiteiten,berichten,blauwdrukken,inkoop,uitleen,campagnes,audit}. */

/* De eenheid van geld staat op een plek, en dit deel rekent er niet naast. */
const EENHEID = require('../geld/eenheid');

/* De modules per stad. Elke stad zet ze zelf aan of uit; staat een module uit,
   dan geeft zijn ingang 403 met de reden, niet stilzwijgend een lege lijst
   (LAT.md regel 5: niets slaat stil over). */
const VLAGGEN = ['city_projects', 'volunteer_management', 'individual_cases', 'food_distribution',
  'clothing_distribution', 'youth_programs', 'elderly_support', 'transport_support',
  'business_sponsorships', 'municipal_reporting', 'subsidy_management', 'events',
  'warehouse_management', 'donations', 'crowdfunding', 'emergency_fund'];

/* De rollen, van binnen naar buiten. 'landelijk' staat er niet in: dat is geen
   zetel maar de boardroom zelf (de eigenaar en wie hij toegang gaf), en die
   heeft per definitie alles. */
const ROLLEN = ['stadsbestuur', 'projectleider', 'medewerker'];

const RECHTEN = {
  stadsbestuur: ['stad.lezen', 'stad.beheren', 'partner.beoordelen', 'project.beheren', 'project.besluit',
    'vrijwilliger.beheren', 'geld.beheren', 'uitgave.aanvragen', 'uitgave.besluit',
    'casus.lezen', 'casus.beheren', 'incident.melden', 'rapport.lezen'],
  projectleider: ['stad.lezen', 'project.beheren', 'vrijwilliger.beheren', 'uitgave.aanvragen',
    'uitgave.besluit', 'casus.lezen', 'casus.beheren', 'incident.melden', 'rapport.lezen'],
  medewerker: ['stad.lezen', 'incident.melden', 'rapport.lezen']
};

/* De goedkeuringsladder in centen. Dit is de landelijke bovengrens per rol; een
   stad mag hem verlagen, nooit verhogen (zie steden.js: limietZet). Boven de
   hoogste trede moet het landelijke bestuur eraan te pas komen. */
const LIMIET = { projectleider: 25000, stadsbestuur: 250000 };

module.exports = ({ db, save, crypto, boardroomWie, magBoardroom }) => {
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(6).toString('hex');
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const TEKENS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = pre => pre + '-' + Array.from(crypto.randomBytes(7)).map(b => TEKENS[b % TEKENS.length]).join('');
  // Bedragen gaan in centen door het hele OS. Euro's met komma's in een optelling
  // is hoe een boekhouding stil gaat afwijken.
  /* HEET naarCenten EN NIET `centen`: die naam stond op ZEVEN plekken en deed er
     drie dingen. Zie de kop van kern/geld/eenheid.js.

     EN DE BOVENGRENS IS VERSCHOVEN, dus dat staat er ook. Hier stond een eigen
     plafond van een miljard euro; EENHEID weigert al boven de tien miljoen, dus
     dat oude getal was dode code. Tien miljoen in EEN boeking van een stichting
     is geen bedrag maar een tikfout. Wat deze laag WEL zelf bepaalt: hier is een
     bedrag nooit negatief -- terugdraaien gaat via de uitgavenkant en niet via
     een minteken in het veld. */
  const naarCenten = v => {
    const n = EENHEID.naarCenten(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const euro = c => Math.round(Number(c) || 0) / 100;

  const LEEG = { steden: [], zetels: [], partners: [], projecten: [], vrijwilligers: [],
    casussen: [], bronnen: [], uitgaven: [], subsidies: [], incidenten: [],
    gemeenten: [], ondernemers: [], voorraad: [], activiteiten: [], berichten: [],
    blauwdrukken: [], inkoop: [], uitleen: [], campagnes: [],
    // de buurtruil: spullen tussen leden, zonder geld (./ruil.js)
    ruil: [],
    // fase drie, de governance-laag: het bestuur zelf, de regels die het stelt,
    // de verantwoording achteraf en de dingen die mis kunnen gaan
    vergaderingen: [], beleid: [], jaarverslagen: [], risicos: [], meldcodes: [],
    audit: [] };
  function S() {
    if (!db.data.rtfos || typeof db.data.rtfos !== 'object') db.data.rtfos = {};
    for (const k of Object.keys(LEEG)) if (!Array.isArray(db.data.rtfos[k])) db.data.rtfos[k] = [];
    return db.data.rtfos;
  }

  /* ---------- het auditspoor ----------
     Elke muterende handeling schrijft hier. Append-only voor iedereen: er is
     geen enkele functie die een auditregel wist of wijzigt, ook niet voor het
     landelijke bestuur. Een spoor dat de machtigste partij kan uitvegen is geen
     spoor. De staart wordt begrensd (de db is geen archief), maar met een
     TELLER erbij, zodat "er staat niets meer" en "er is nooit iets geweest"
     nooit hetzelfde lezen. */
  function audit(wie, wat, doel, extra) {
    const rij = S().audit;
    rij.unshift({ id: rid(), wie: schoon(wie, 60) || 'onbekend', wat: schoon(wat, 60),
      doel: schoon(doel, 80), extra: schoon(extra, 200), at: nu() });
    if (rij.length > 20000) {
      const weg = rij.length - 20000;
      rij.splice(20000, weg);
      S().auditAfgekapt = (Number(S().auditAfgekapt) || 0) + weg;
    }
    save();
  }

  /* ---------- wie ben je ----------
     Geeft de sleutel, of het landelijke bestuur meespreekt, en de zetels die
     deze sleutel heeft. Nooit een rol uit het verzoek: dat zou LAT.md regel 8
     zijn (een controle op vorm is geen controle). */
  function wie(req) {
    const key = boardroomWie(req) || null;
    const landelijk = !!key && magBoardroom(key);
    const zetels = key ? S().zetels.filter(z => z.key === key) : [];
    return { key, landelijk, zetels };
  }
  function rolIn(w, stadId) {
    if (!w) return null;
    if (w.landelijk) return 'landelijk';
    const z = w.zetels.find(x => x.stad === String(stadId || ''));
    return z ? z.rol : null;
  }
  function magRecht(w, stadId, recht) {
    const rol = rolIn(w, stadId);
    if (!rol) return false;
    if (rol === 'landelijk') return true;
    return (RECHTEN[rol] || []).includes(recht);
  }
  // De steden waar deze sleutel iets te zoeken heeft. Het landelijke bestuur
  // ziet alles; een zetel ziet uitsluitend de eigen stad.
  function bereik(w) {
    if (!w || !w.key) return [];
    if (w.landelijk) return S().steden.map(s => s.id);
    return [...new Set(w.zetels.map(z => z.stad))];
  }

  const stadVan = id => S().steden.find(s => s.id === String(id || '')) || null;

  /* De poort die elke stads-handeling passeert. Vier vragen op een rij, elk met
     een eigen antwoord -- want "u mag hier niet komen", "deze stad staat op
     slot" en "deze module staat hier uit" zijn voor de lezer drie verschillende
     dingen, en een gedeelde 403 maakt ze onzichtbaar. */
  function poort(w, stadId, recht, vlag) {
    const stad = stadVan(stadId);
    if (!stad) return { status: 404, error: 'Deze stadsafdeling bestaat niet.' };
    if (!magRecht(w, stad.id, recht)) {
      return { status: 403, error: 'U heeft in ' + stad.naam + ' geen bevoegdheid voor deze handeling.' };
    }
    if (vlag && !(stad.vlaggen || []).includes(vlag)) {
      return { status: 403, error: 'De module "' + vlag + '" staat uit voor ' + stad.naam + '. Het landelijke bestuur zet hem aan.' };
    }
    // Een geblokkeerde stad is leesbaar maar niet schrijfbaar: het toezicht
    // stopt de uitvoering, het wist de geschiedenis niet.
    const schrijft = recht !== 'stad.lezen' && recht !== 'rapport.lezen' && recht !== 'casus.lezen';
    if (schrijft && stad.status !== 'actief' && !w.landelijk) {
      return { status: 403, error: stad.naam + ' staat op "' + stad.status + '". Alleen het landelijke bestuur kan hier nog iets wijzigen.' };
    }
    return { ok: true, stad };
  }

  /* DE VOG IS EEN DATUM, GEEN VINKJE, en die regel staat hier omdat inmiddels
     drie modules hem stellen: het vrijwilligersregister, de activiteiten (geen
     jeugdactiviteit zonder begeleider met geldige VOG) en de uitwisseling
     tussen steden. Drie kopieen van dezelfde datumvergelijking is drie kansen
     om er een te vergeten bij te werken (LAT.md regel 4). */
  const vogGeldig = v => !!(v && v.vogGeldigTot) && Date.parse(v.vogGeldigTot) > Date.now();

  // De hoogste trede die deze rol zelfstandig mag goedkeuren, in centen.
  function limietVan(stad, rol) {
    if (rol === 'landelijk') return Infinity;
    const eigen = (stad && stad.limieten) || {};
    const land = LIMIET[rol];
    if (land === undefined) return 0;
    const gezet = Number(eigen[rol]);
    return Number.isFinite(gezet) && gezet >= 0 ? Math.min(gezet, land) : land;
  }

  return { nu, rid, schoon, code, naarCenten, euro, S, audit, wie, rolIn, magRecht, bereik,
    stadVan, poort, limietVan, vogGeldig, VLAGGEN, ROLLEN, RECHTEN, LIMIET };
};
module.exports.VLAGGEN = VLAGGEN;
module.exports.ROLLEN = ROLLEN;
module.exports.RECHTEN = RECHTEN;
module.exports.LIMIET = LIMIET;
