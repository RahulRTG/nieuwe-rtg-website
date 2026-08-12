/* Spellen (deelmodule): DE GRENZEN. Twee vragen, twee antwoorden.

   Hier stond er EEN, en dat was te weinig. "Mag hier iets van bewaard worden"
   en "mag deze persoon dit doen" zijn verschillende vragen, en ze kregen
   hetzelfde antwoord omdat er maar een drempel was.

   ================== 1. DE PROGRESSIEGRENS: 18+ ==================

   Alles wat een PRESTATIE buiten het potje bewaart -- highscores, ranglijsten,
   standen, prestaties, de arcade -- bestaat alleen voor geverifieerd volwassen
   leden. Dat is dezelfde poort als die van Proost: `volwassen()` betekent "RTG
   heeft de paspoort-geboortedatum gecontroleerd EN die is 18+", dus een lid
   zonder gecontroleerd paspoort valt er ook buiten tot dat gedaan is.

   DEZE GRENS VERSCHUIFT NIET. `CLAUDE.md` verbiedt verslavende
   engagement-patronen, De Arena belooft tieners met zoveel woorden "alles telt
   alleen binnen het potje; er bestaat geen ranglijst", en de School-lat zegt
   "leren is geen wedstrijd". Een scorebord onder vrienden in dezelfde RTF-app
   spreekt dat tegen, op elke leeftijd onder de achttien. Onder de grens blijft
   elk spel volledig speelbaar -- er wordt alleen niets van bewaard.

   ================== 2. DE WERKGRENS: 16+, EN GETRAPT ==================

   Een WERKVERLEDEN is iets anders dan een score, en dat verschil is de reden
   dat het hier uiteen gaat. Een ranglijst zegt "jij bent beter dan hij". Een
   werkverleden zegt "dit heb je gedaan, en er was iemand bij". Het eerste is een
   wedstrijd, het tweede is een biografie.

   In het echt begint een leven ook niet op je achttiende. Je hebt een
   zaterdagbaan, je loopt stage, je leert een vak. Iedereen als volwassen
   ondernemer laten beginnen is niet veiliger, het is alleen minder waar.

   DRIE LAGEN, en ze doen niet aan "meer punten" maar aan WAT JE KUNT DOEN --
   precies zoals de rollen in magnaat/dienst-rollen.js. Een getal dat "meer mag"
   betekent is niet te lezen op een scherm en niet te toetsen; een lijst wel.

     kind (< 16)       speelt alles, er wordt niets van bewaard. Ongewijzigd.
     jong (16-17)      een bijbaan, een stage, een vak leren. Zijn eigen
                       werkverleden wordt bewaard, want dat is van hem.
     volwassen (18+)   de volledige laag: ondernemen, krediet, werkgeverschap,
                       bestuur, kapitaal.

   WAT DE MIDDELSTE LAAG NIET MAG, en let op WAAROM: het is geen bescherming die
   erbovenop is gelegd, het is wat een zestienjarige in het echt ook niet kan.
   Geen miljoenenkrediet, geen personeel in dienst, geen bestuurszetel, geen
   aandelenhandel. Dat het tegelijk uitsluit dat een volwassene een minderjarige
   aan zich bindt met schuld, zeggenschap of werkgeverschap, is geen toeval maar
   het is ook geen apart hek -- het volgt uit het realisme. Zie VERHAAL.md par.
   0c en grens 1.

   HIJ IS FAIL-CLOSED. `JONG_MAG` is een WITTE lijst: een handeling die er niet
   in staat, mag niet. Een nieuwe actie is dus vanzelf 18+ tot iemand besluit dat
   hij bij een bijbaan hoort. Een zwarte lijst zou betekenen dat elke vergeten
   toevoeging stilzwijgend voor zestienjarigen opengaat, en dat is de verkeerde
   kant om fout te gaan.

   ZONDER GECONTROLEERDE LEEFTIJD BEN JE `kind`. Niet "waarschijnlijk oud
   genoeg": geen gegeven is geen toestemming. */
'use strict';

const JONG_VANAF = 16;
const VOLWASSEN_VANAF = 18;

/* WAT EEN ZESTIENJARIGE MAG DOEN, als lijst en per spel-actienaam. Alles wat
   hoort bij WERKEN VOOR EEN ANDER en bij LEREN; niets wat hoort bij bezitten,
   lenen, aannemen of besturen. */
const JONG_MAG = [
  /* de bijbaan zelf: zoeken, aannemen van het aanbod, opzeggen */
  'solliciteren', 'dienst-opzeggen',
  /* meewerken in de zaak waar je in dienst bent; welke velden precies mag,
     bepaalt je ROL en niet je leeftijd (magnaat/dienst-rollen.js) */
  'werk-beleid',
  /* meepraten over wat de Foundation in je eigen stad bouwt. Kost niets,
     levert niets op, en neemt niemand iets af -- zie magnaat/governance.js */
  'foundation-stem',
  /* er even niet zijn mag altijd, op elke leeftijd */
  'vakantie-aan', 'vakantie-uit'
];

/* WELKE ROLLEN EEN ZESTIENJARIGE KAN VERVULLEN. Een bedrijfsleider runt een
   zaak en stuurt mensen aan; dat is werkgeverschap met een andere naam. */
const JONG_ROLLEN = ['hulp', 'vakkracht'];

module.exports = ({ volwassen, leeftijd }) => {
  /* De leeftijd is optioneel meegegeven zodat bestaande aanroepers (en toetsen)
     die alleen `volwassen` doorgeven blijven werken: dan is er geen middelste
     laag en gedraagt alles zich als voorheen. Stil terugvallen mag hier omdat de
     terugval de STRENGSTE kant op gaat. */
  const jaren = (handle) => (leeftijd ? leeftijd(handle) : (volwassen(handle) ? VOLWASSEN_VANAF : null));

  function laagVan(handle) {
    const n = jaren(handle);
    if (n == null) return 'kind';
    if (n >= VOLWASSEN_VANAF) return 'volwassen';
    if (n >= JONG_VANAF) return 'jong';
    return 'kind';
  }

  return {
    /* 1. de progressiegrens; ongewijzigd 18+ */
    progressieMag: (handle) => volwassen(handle),
    GEEN_PROGRESSIE: 'Scores en ranglijsten bestaan alleen voor leden met een geverifieerde volwassen leeftijd. Het spel zelf speel je gewoon.',

    /* 2. de werkgrens */
    JONG_VANAF, VOLWASSEN_VANAF, JONG_MAG, JONG_ROLLEN, laagVan,
    /* Mag er van DEZE persoon een werkverleden bewaard blijven? Vanaf 16, want
       een biografie is geen wedstrijd. */
    werkMag: (handle) => laagVan(handle) !== 'kind',
    /* Mag deze persoon deze handeling doen? Fail-closed voor `jong`. */
    magHandeling(handle, actie) {
      const laag = laagVan(handle);
      if (laag === 'volwassen') return true;
      if (laag === 'kind') return true;      // een kind speelt alles; er wordt niets bewaard
      return JONG_MAG.includes(String(actie));
    },
    magRolAannemen(handle, rol) {
      return laagVan(handle) !== 'jong' || JONG_ROLLEN.includes(String(rol));
    },
    GEEN_WERK: 'Een werkverleden wordt bewaard vanaf 16 jaar, met een geverifieerde geboortedatum. Het spel zelf speel je gewoon.',
    TE_JONG: 'Dat hoort bij de volwassen laag. Met een bijbaan, een stage en een vak leren kun je nu al beginnen.'
  };
};
module.exports.JONG_VANAF = JONG_VANAF;
module.exports.VOLWASSEN_VANAF = VOLWASSEN_VANAF;
module.exports.JONG_MAG = JONG_MAG;
module.exports.JONG_ROLLEN = JONG_ROLLEN;
