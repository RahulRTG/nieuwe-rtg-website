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

  const leegBeleid = () => ({
    /* Standaard staat alles aan wat sowieso veilig is: tonen en wachten. */
    uit: [],
    horizon: HORIZON_STANDAARD
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
  function zet(key, invoer) {
    const r = pak(key);
    if (!r) return { status: 400, error: 'Geen sleutel.' };
    const v = invoer && typeof invoer === 'object' ? invoer : {};
    const was = { uit: r.uit.slice(), horizon: r.horizon };

    if (v.soort !== undefined) {
      const s = String(v.soort);
      if (!SOORTEN.includes(s)) return { status: 400, error: 'Dat soort voorstel bestaat niet.' };
      const aan = v.aan !== false;
      r.uit = aan ? r.uit.filter(x => x !== s) : (r.uit.includes(s) ? r.uit : r.uit.concat(s));
    }

    if (v.horizon !== undefined) {
      const n = Math.round(Number(v.horizon));
      if (!Number.isFinite(n) || n < HORIZON_MIN || n > HORIZON_MAX) {
        return { status: 400, error: 'Kies een horizon tussen ' + HORIZON_MIN + ' en ' + HORIZON_MAX + ' dagen.' };
      }
      r.horizon = n;
    }

    /* EEN HANDELING DIE NIETS VERANDERT, VERANDERT NIETS -- en wordt dus ook
       niet gemeld als wijziging. Die les staat in kern/geldbeleid/actielog.js:
       een log dat volloopt met kliks die niets deden, is met ruis leeg te
       spoelen. De aanroeper logt op `gewijzigd`. */
    const gewijzigd = was.horizon !== r.horizon ||
      was.uit.length !== r.uit.length || was.uit.some(x => !r.uit.includes(x));
    if (gewijzigd) save();
    return { status: 200, ok: true, gewijzigd, beleid: beleid(key) };
  }

  /* WAT HET BELEID BETEKENT VOOR EEN VOORSTEL. Twee vragen, en meer kan dit
     beleid niet: mag deze soort, en valt de datum binnen de horizon. Allebei
     versmallend. */
  function magSoort(key, soort) { return !kijk(key).uit.includes(String(soort)); }

  function binnenHorizon(key, datum, vandaag) {
    if (!datum) return true; // iets zonder datum valt buiten deze vraag
    const n = Math.round((new Date(datum + 'T12:00:00Z') - new Date(vandaag + 'T12:00:00Z')) / 86400000);
    return Number.isFinite(n) && n <= kijk(key).horizon;
  }

  return { socialebeleid: { beleid, zet, magSoort, binnenHorizon, SOORTEN,
    HORIZON_STANDAARD, HORIZON_MIN, HORIZON_MAX } };
};
