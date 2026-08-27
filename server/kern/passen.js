/* WELKE PASSEN BESTAAN ER? EEN ANTWOORD, VOOR IEDEREEN DIE HET VRAAGT.

   Zelfde soort bestand als ./pasprijs.js, en om precies dezelfde reden. Daar
   stond de vraag "wat kost een pas" op drie plekken; hier stond de vraag "welke
   passen zijn er" op vier:

   - kern/ledenbalie.js      const PASSEN       = ['gratis','rtg','lifestyle','business']
   - kern/ledenregister.js   const PAS_VOLGORDE = ['gratis','rtg','lifestyle','business']
   - kern/ledenregister.js   PAS_NAAM, de weergavenamen
   - kern/assets.js          const BETALENDE_PASSEN = ['rtg','lifestyle','business']

   De eerste twee droegen bovendien een IDENTIEKE afgeleide functie:

     ledenbalie     t    => (t    === 'guest' ? 'gratis' : (PASSEN.includes(t)       ? t    : 'rtg'))
     ledenregister  tier => (tier === 'guest' ? 'gratis' : (PAS_VOLGORDE.includes(tier) ? tier : 'rtg'))

   Twee kopieen van een regel die bepaalt welke pas een lid TOONT. Dat is
   LAT.md regel 4 in zijn zuiverste vorm, en het is niet theoretisch: de vierde
   plek (assets.js) heeft de gratis app er stilzwijgend uit gelaten omdat daar
   alleen betalende leden mogen kopen -- een terechte keuze, maar wel een die
   nergens naast de andere drie stond.

   HOE HET GEVONDEN IS, en dat hoort erbij. Niet door te lezen maar door te
   meten: scripts/semantiek.js zoekt catalogi die dezelfde waarheid dragen. Zijn
   eerste ronde groepeerde op NAAM en zag dit paar dus NIET -- `PASSEN` en
   `PAS_VOLGORDE` heten anders. Pas de tweede ronde, die op inhoud vergelijkt
   ongeacht naam, wees ze aan. Dat gat in de meter is daar met naam opgeschreven.

   BETALEND WORDT AFGELEID EN NIET OVERGETYPT. Zou je hem als eigen lijst
   neerzetten, dan is er een vijfde plek die kan verschuiven; nu volgt hij per
   definitie uit PASSEN. Wie een pas toevoegt, voegt hem op EEN plek toe en de
   rest beweegt mee.

   WAT HIER NIET IN HOORT: de toon-van-stem per pas. kern/aanmeldingen.js draagt
   ook een `PASSEN`, maar dat is een heel ander ding -- een tabel met welkomsttekst
   en aanspreekvorm per pas (CLAUDE.md: "je" bij RTG Pass, "u" bij Lifestyle en
   Business). Dezelfde naam, andere betekenis. Die hoort bij de intake en niet
   hier; hem erbij trekken zou een botsing repareren door er een dubbeling van te
   maken. */
'use strict';

/* De volgorde IS betekenisvol: van licht naar zwaar. Het ledenregister toont de
   kolommen in deze volgorde, dus een herschikking hier verschuift een scherm. */
const PASSEN = ['gratis', 'rtg', 'lifestyle', 'business'];

const PAS_NAAM = {
  gratis: 'Gratis app',
  rtg: 'RTG Pass',
  lifestyle: 'Lifestyle Pass',
  business: 'Business Pass'
};

/* Afgeleid, nooit overgetypt -- zie de kop. */
const BETALEND = PASSEN.filter(p => p !== 'gratis');

/* De pas van een lid uit zijn tier. Een gast/gratis lid heeft tier 'guest' en
   toont 'gratis'; een onbekende tier valt terug op 'rtg'.

   DIE TERUGVAL IS BEWUST EN HOORT UITGELEGD. Een onbekende tier is geen reden om
   een lid uit een overzicht te laten vallen -- dan telt het kantoor minder leden
   dan er zijn en niemand die het merkt (LAT.md regel 5: niets slaat stil over).
   'rtg' is de instappas, dus dat is de veiligste plek om zo'n rij te tonen.
   Beide bellers deden dit al zo; het staat hier zodat het een besluit is en geen
   toevalligheid die twee keer is overgeschreven. */
function pasVan(tier) {
  if (tier === 'guest') return 'gratis';
  return PASSEN.includes(tier) ? tier : 'rtg';
}

module.exports = { PASSEN, PAS_NAAM, BETALEND, pasVan };
