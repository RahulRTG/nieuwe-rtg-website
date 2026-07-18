/* De event- en keukenlaag: draaiboeken (runsheet), catering, de MEP-fallback,
   de vervangende-gerechten-tabel en de keukencoach.

   RUN_STATIONS en ALT_IDEE zijn pure data en worden rechtstreeks geexporteerd.
   coachCache is een gedeelde in-memory cache (per bedrijfscode). De functies
   dragen state (crypto voor id's, sectiesForOrder voor de coach) en komen uit
   maakEvents(state), zodat server.js dun blijft en de logica los te testen is. */

// draaiboek-posten horen bij de keuken, bar, bediening of de party manager (Events)
const RUN_STATIONS = ['keuken', 'bar', 'bediening', 'party', 'alle'];

// vervangend gerecht per allergeen (Claude verzint anders, dit is de vakkundige fallback)
const ALT_IDEE = {
  noten: ['krokant van geroosterde pompoen- en zonnebloempitten', 'zonder noten, met dezelfde textuur'],
  pinda: ['sesam-soja dressing in plaats van satesaus', 'vrij van pinda'],
  gluten: ['glutenvrije variant met rijstbloem en boekweit', 'volledig glutenvrij bereid'],
  lactose: ['romige basis van kokosmelk en cashewcreme', 'zonder zuivel'],
  melk: ['romige basis van kokosmelk', 'zonder zuivel'],
  vis: ['gegrilde groente met dashi van kombu', 'zonder vis, zelfde umami'],
  schaaldieren: ['knapperige tofu met yuzu-glaze', 'vrij van schaal- en schelpdieren'],
  soja: ['dressing op basis van miso-vrije bouillon en citrus', 'sojavrij'],
  ei: ['binding met aquafaba', 'zonder ei'],
  sesam: ['topping van geroosterde quinoa', 'sesamvrij']
};

// gedeelde keukencoach-cache: code -> { hash, lines, at }
const coachCache = new Map();

// nominale bereidingstijd per kant in minuten; prepMin op het gerecht wint.
// De bar telt als eigen kant mee, zodat drankjes en eten samen uitgaan.
const SECTIE_MIN = { warm: 12, koud: 6, snack: 8, dessert: 5, bar: 4 };

function maakEvents({ crypto, sectiesForOrder }) {
  /* De draaiboek- en coachlaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten. */
  const ctx = { crypto, sectiesForOrder, RUN_STATIONS, ALT_IDEE, coachCache, SECTIE_MIN };
  const deelDraaiboek = require('./events/draaiboek')(ctx);
  Object.assign(ctx, deelDraaiboek);
  const deelCoach = require('./events/coach')(ctx);
  const { runItem, runKey, sortRunsheet, fallbackRunsheet, parseRunsheetText, cateringDishes, eventCovers } = deelDraaiboek;
  const { sectieTijd, vuurplan, coachRules } = deelCoach;

  return { runItem, runKey, sortRunsheet, fallbackRunsheet, parseRunsheetText, cateringDishes, eventCovers, coachRules, vuurplan, sectieTijd };
}

module.exports = { RUN_STATIONS, ALT_IDEE, coachCache, SECTIE_MIN, maakEvents };
