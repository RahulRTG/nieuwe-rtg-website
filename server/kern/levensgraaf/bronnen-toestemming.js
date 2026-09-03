/* ============================================================================
   Levensgraaf, deelbestand "bronnen-toestemming": de vensters die aflopen.

   HDI.md par. 7 regel 7 -- de Advocate als LEZER, en niet meer dan dat.

   WAT HIER BINNENKOMT. Het Consent Center (kern/consent.js) weet sinds
   ./consent-register.js welke toestemmingen een EINDDATUM hebben: een intake bij
   een zorgaanbieder, een partner die uw identiteitsbewijs mag inzien, een dienst
   die met RTG iD uw gegevens ophaalt, iemand die namens u mag inloggen. Vier van
   de negen lagen; de andere vijf lopen door tot u ze stopt en horen hier dus
   niet -- een datum die niet bestaat, wordt hier niet verzonnen.

   WAAROM DIT EEN TERMIJN IS EN GEEN MELDING. Een toestemming die afloopt is
   precies het soort datum waar deze hele laag voor bestaat: hij staat in een
   scherm dat u alleen opent als u er al aan dacht. Een machtiging die volgende
   week verloopt terwijl uw moeder er nog mee moet inloggen, is hetzelfde soort
   probleem als een paspoort dat verloopt op de dag van vertrek.

   EN DE ANDERE KANT OP IS OOK WAAR, en dat is de reden dat dit geen luxe is: een
   venster dat afloopt terwijl u het nog nodig had, kost u iets. Een venster dat
   doorloopt terwijl u het niet meer nodig had, kost uw privacy. De tower zegt
   alleen DAT hij afloopt; wat er moet gebeuren beslist u.

   DE POORT STAAT DICHT OP HET LID, EN DAT IS HIER GEEN GEWOONTE MAAR DE KERN.
   Elke knoop draagt `deel: 'lid'` en `gevoelig: BESLOTEN`. Uw toestemmingen zijn
   van u: een concierge, een Rechterhand of een bureau hoort niet te zien bij
   welke zorgaanbieder u een intake deelde, ook niet als datum zonder naam --
   want de NAAM staat er nu juist bij, en dat is precies wat een lijst met
   "Dr. Y, loopt af op de 14e" verraadt. `graafVoor()` filtert hierop, en
   test/advocaat-lezer.test.js zakt zodra een van beide etiketten verschuift.

   DEZE BRON SCHRIJFT NIETS, VRAAGT NIETS EN STELT NIETS VOOR. Hij leest
   `consentVan(key)` -- dezelfde projectie die het scherm leest -- en maakt er
   knopen van. Er is hier geen intrekknop, geen verlengknop en geen advies. Dat
   is de grens uit HDI.md par. 5.6: de Advocate komt er eerst als LEZER, omdat
   VERTROUWEN.json op 0 bewezen staat en een laag die HANDELT dat bewijs nodig
   heeft. Wie hier ooit een knop bij zet, weerlegt eerst die paragraaf.

   Gemount via ./bronnen.js, als laatste. */
'use strict';

const H = require('./hulp');
const { BESLOTEN, isDatum } = H;

/* Alleen deze vier lagen dragen een venster met een datum. De lijst staat hier
   NIET nog een keer: hij komt uit de termijn die het Consent Center zelf per rij
   meegeeft (`termijn.soort === 'venster'`). Zou hier een eigen lijst laagnamen
   staan, dan is er een tweede plek die weet welke lagen aflopen, en die loopt
   uiteen zodra er een laag bijkomt (LAT.md regel 4). */
const TOESTEMMING = [
  { kamer: 'gezelschap', knopen(l, K, ctx) {
    const vraag = ctx && ctx.toestemmingen;
    const uit = vraag ? vraag(ctx.key) : null;
    const rijen = (uit && uit.toestemmingen) || [];
    const knopen = [];
    for (const r of rijen) {
      const t = r.termijn || {};
      if (t.soort !== 'venster') continue;      // geen datum, geen termijn
      if (!isDatum(t.tot)) continue;            // en een datum die geen datum is, evenmin
      knopen.push(K({
        id: 'toestemming-' + r.laag + '-' + r.id,
        soort: 'termijn',
        naam: 'uw toestemming aan ' + r.wie,
        kamer: 'gezelschap',
        bron: 'Toestemming',
        /* BESLOTEN en 'lid': zie de kop. Deze twee horen bij elkaar en niet
           los -- `gevoelig` zegt hoe zwaar het weegt, `deel` is de poort. */
        gevoelig: BESLOTEN,
        deel: 'lid',
        vervalt: t.tot,
        vervaltWat: 'toestemming'
      }));
    }
    return knopen;
  } }
];

module.exports = TOESTEMMING;
