/* Kern-module "socialebeleid": de regels van het lid over zijn eigen sociale
   wereld (LIFE.md par. 6, de tweede laag van het wereldpatroon).

   HET VERSCHIL MET GELDBELEID, EN DAT IS DE HELE REDEN DAT DIT BESTAND ANDERS
   IS. Bij geld heeft elke regel een NIVEAU (kijken, voorstellen, klaarzetten,
   automatisch): het lid kan een regel zo instellen dat er iets vanzelf gebeurt,
   binnen het eigen tegoed (GELD.md par. 3-4). Hier bestaat dat niveau niet, en
   het staat er niet omdat het vergeten is:

   > De grens van deze wereld is een ANDER MENS (LIFE.md par. 3). Er is geen
   > regel, geen instelling en geen vertrouwensniveau waarmee een handeling die
   > een tweede persoon bereikt "automatisch" wordt. Een beleidslaag met een
   > automatisch-stand zou precies de deur zijn waarlangs dat alsnog gebeurt.

   DIT BELEID KAN DUS ALLEEN VERSMALLEN, NOOIT VERRUIMEN. Elke regel hier zet
   iets UIT of maakt een venster KLEINER. Er is geen enkele instelling die Rahul
   meer laat doen dan hij zonder beleid al mag -- en dat is meteen de toets: komt
   er ooit een veld bij dat iets aanzet in plaats van uitzet, dan is dat geen
   uitbreiding maar een andere wereld.

   "GEEN REGEL, GEEN HANDELING" GELDT HIER DUS OMGEKEERD. Bij geld doet het
   systeem zonder regel niets. Hier doet het systeem zonder regel het minimum dat
   sowieso veilig is: voorstellen tonen, wachten op de mens. Beleid haalt daar
   vanaf. Dat is geen versoepeling maar de enige vorm die past bij een wereld
   waar niets vanzelf mag.

   OPSLAG PAS ALS ER ECHT IETS BEWAARD WORDT; kijken laat geen spoor achter --
   dezelfde afspraak als kern/geldbeleid en kern/levensband. Een rij per mens die
   een keer keek, is opslag die niemand heeft gevraagd. */
'use strict';

/* De tijd komt van de tijdmachine (server/lib/klok.js) en niet van het
   besturingssysteem: wie rechtstreeks aan het OS vraagt hoe laat het is, doet
   niet mee aan RTG_KLOK en is dus niet te beproeven op schrikkeldag, zomertijd
   of een verlopen mandaat. */
const { datum } = require('../../lib/klok');

/* DE SCHAKELAARS. Elk een aan/uit-knop met een naam en een uitleg, en elk
   VERSMALLEND: uitzetten haalt iets weg, aanzetten geeft niets terug dat er
   zonder beleid niet al was. De lijst staat hier en niet in het scherm, om
   dezelfde reden als de caps in kern/objectlaag/caps.js: twee plekken die weten
   wat instelbaar is, lopen uiteen.

   `bereik` bouwt VOORT op wat er al is en maakt geen tweede lijst: blokkeren
   woont in kern/sociaal en blijft daar. Deze knop gaat over wie een VERZOEK mag
   sturen, niet over wie geblokkeerd is -- dat zijn twee verschillende vragen, en
   ze samenvoegen zou een gedeelde waarheid op twee plekken zetten. */
const KNOPPEN = {
  bereik: {
    naam: 'Alleen verzoeken uit een gedeelde groep',
    uitleg: 'Verbindingsverzoeken van mensen met wie u geen genootschap deelt, komen niet in beeld. ' +
      'Blokkeren blijft waar het stond; dit is een filter en geen blokkade.'
  },
  vonk: {
    naam: 'Vonk en Rendez-vous meetellen',
    uitleg: 'Uitzetten houdt matches uit uw sociale beeld -- bijvoorbeeld op een gedeeld toestel. ' +
      'De apps zelf blijven gewoon werken.'
  },
  stilte: {
    naam: 'Weekend zonder voorstellen',
    uitleg: 'Op zaterdag en zondag zet Rahul niets klaar. Wat er ligt blijft zichtbaar in de stand; ' +
      'er wordt alleen niets voorgesteld.'
  }
};

/* De horizon: voorstellen alleen voor wat binnen zoveel dagen speelt. Nul zou
   betekenen "niets", en dat is wat `voorstellen: false` al doet; de ondergrens
   is dus een dag. De bovengrens is een jaar -- daarboven is het geen horizon
   meer maar de afwezigheid van een horizon, en dan hoort het veld gewoon op de
   standaard te staan. */
const HORIZON_MIN = 1;
const HORIZON_MAX = 365;
const HORIZON_STANDAARD = 60;

/* De soorten voorstel die uitgezet kunnen worden. De lijst komt uit
   kern/socialecommand/voorstellen.js en wordt hier MEEGEGEVEN, niet overgetikt:
   twee lijsten van wat een voorstel kan zijn, lopen uiteen zodra iemand er een
   toevoegt (LAT.md regel 4). */
module.exports = ({ db, save, soorten }) => {
  const SOORTEN = Array.isArray(soorten) && soorten.length ? soorten.slice() : ['antwoord'];

  const KNOPNAMEN = Object.keys(KNOPPEN);

  const leegBeleid = () => ({
    /* Standaard staat alles aan wat sowieso veilig is: tonen en wachten. */
    uit: [],
    horizon: HORIZON_STANDAARD,
    /* De schakelaars die UIT staan. Standaard geen: een lid dat niets instelt,
       krijgt het beeld zoals de wereld het ziet. Elke naam hierin haalt iets
       weg. */
    knopUit: []
  });

  function kijk(key) {
    const alles = db.data.socialebeleid;
    const k = String(key || '');
    const r = alles && alles[k];
    return r && typeof r === 'object' ? r : leegBeleid();
  }

  function pak(key) {
    if (!db.data.socialebeleid || typeof db.data.socialebeleid !== 'object') db.data.socialebeleid = {};
    const k = String(key || '');
    if (!k) return null;
    if (!db.data.socialebeleid[k] || typeof db.data.socialebeleid[k] !== 'object') {
      db.data.socialebeleid[k] = leegBeleid();
    }
    const r = db.data.socialebeleid[k];
    if (!Array.isArray(r.uit)) r.uit = [];
    if (!Number.isFinite(r.horizon)) r.horizon = HORIZON_STANDAARD;
    if (!Array.isArray(r.knopUit)) r.knopUit = [];
    return r;
  }

  /* Het beeld voor het scherm: wat er geldt, plus wat er te kiezen valt. De
     keuzes komen van hier en niet van het scherm, om dezelfde reden als bij de
     caps: twee plekken die weten wat instelbaar is, lopen uiteen. */
  function beleid(key) {
    const r = kijk(key);
    return {
      ok: true,
      horizon: r.horizon,
      horizonGrens: { min: HORIZON_MIN, max: HORIZON_MAX, standaard: HORIZON_STANDAARD },
      soorten: SOORTEN.map(s => ({ soort: s, aan: !r.uit.includes(s) })),
      /* De schakelaars, met hun uitleg erbij. Het scherm kent er geen bij naam
         en toont wat hier staat -- zelfde afspraak als bij de caps. */
      knoppen: KNOPNAMEN.map(k => ({ knop: k, naam: KNOPPEN[k].naam,
        uitleg: KNOPPEN[k].uitleg, aan: !(r.knopUit || []).includes(k) })),
      /* Dit veld staat er met opzet, en het is geen instelling maar een FEIT dat
         het scherm hoort te kunnen tonen: er bestaat hier geen automatische
         stand. Zonder deze zin zou een lid kunnen denken dat hij hem ergens
         moet zoeken. */
      automatischMogelijk: false
    };
  }

  /* ZETTEN. Alleen de twee velden die bestaan, en allebei versmallend. Een
     onbekend veld wordt genegeerd en niet stilzwijgend opgeslagen: opslag die
     niemand leest, is opslag die ooit iets gaat betekenen zonder dat iemand het
     bedoelde. */
  /* Eerst keuren, dan pakken, dan toepassen -- waarom: test/socialebeleid-volgorde.test.js */
  function zet(key, invoer) {
    if (!String(key || '')) return { status: 400, error: 'Geen sleutel.' };
    const v = invoer && typeof invoer === 'object' ? invoer : {};

    let soort = null, knop = null, horizon = null;
    if (v.soort !== undefined) {
      soort = String(v.soort);
      if (!SOORTEN.includes(soort)) return { status: 400, error: 'Dat soort voorstel bestaat niet.' };
    }
    if (v.knop !== undefined) {
      knop = String(v.knop);
      if (!KNOPNAMEN.includes(knop)) return { status: 400, error: 'Die schakelaar bestaat niet.' };
    }
    if (v.horizon !== undefined) {
      horizon = Math.round(Number(v.horizon));
      if (!Number.isFinite(horizon) || horizon < HORIZON_MIN || horizon > HORIZON_MAX) {
        return { status: 400, error: 'Kies een horizon tussen ' + HORIZON_MIN + ' en ' + HORIZON_MAX + ' dagen.' };
      }
    }

    const r = pak(key);
    if (!r) return { status: 400, error: 'Geen sleutel.' };
    const was = { uit: r.uit.slice(), horizon: r.horizon, knopUit: (r.knopUit || []).slice() };

    if (soort !== null) {
      const aan = v.aan !== false;
      r.uit = aan ? r.uit.filter(x => x !== soort) : (r.uit.includes(soort) ? r.uit : r.uit.concat(soort));
    }
    if (knop !== null) {
      const aan = v.aan !== false;
      r.knopUit = aan ? r.knopUit.filter(x => x !== knop) : (r.knopUit.includes(knop) ? r.knopUit : r.knopUit.concat(knop));
    }
    if (horizon !== null) r.horizon = horizon;

    /* EEN HANDELING DIE NIETS VERANDERT, VERANDERT NIETS -- en wordt dus ook
       niet gemeld als wijziging. Die les staat in kern/geldbeleid/actielog.js:
       een log dat volloopt met kliks die niets deden, is met ruis leeg te
       spoelen. De aanroeper logt op `gewijzigd`. */
    const gewijzigd = was.horizon !== r.horizon ||
      was.uit.length !== r.uit.length || was.uit.some(x => !r.uit.includes(x)) ||
      was.knopUit.length !== r.knopUit.length || was.knopUit.some(x => !r.knopUit.includes(x));
    if (gewijzigd) save();
    return { status: 200, ok: true, gewijzigd, beleid: beleid(key) };
  }

  /* WAT HET BELEID BETEKENT VOOR EEN VOORSTEL. Twee vragen, en meer kan dit
     beleid niet: mag deze soort, en valt de datum binnen de horizon. Allebei
     versmallend. */
  function magSoort(key, soort) { return !kijk(key).uit.includes(String(soort)); }

  /* Staat deze schakelaar aan? Alleen een NEE kan hieruit iets veranderen: een
     schakelaar die aan staat, is de wereld zoals hij zonder beleid ook is. */
  const knopAan = (key, knop) => !(kijk(key).knopUit || []).includes(String(knop));

  /* Het stiltevenster. Zaterdag en zondag; een vast venster en geen instelbaar
     uur, want een instelbaar venster is een tweede klok en de winst is nul --
     er zijn hier geen meldingen die iemand wakker maken. */
  function inStilte(key, nu) {
    if (knopAan(key, 'stilte')) return false;
    const d = (nu || datum()).getDay();
    return d === 0 || d === 6;
  }

  function binnenHorizon(key, datum, vandaag) {
    if (!datum) return true; // iets zonder datum valt buiten deze vraag
    const n = Math.round((new Date(datum + 'T12:00:00Z') - new Date(vandaag + 'T12:00:00Z')) / 86400000);
    return Number.isFinite(n) && n <= kijk(key).horizon;
  }

  return { socialebeleid: { beleid, zet, magSoort, binnenHorizon, knopAan, inStilte,
    SOORTEN, KNOPPEN, HORIZON_STANDAARD, HORIZON_MIN, HORIZON_MAX } };
};
