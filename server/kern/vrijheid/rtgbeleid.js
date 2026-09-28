/* VRIJHEID: HET BELEID VAN RTG ZELF -- wat de eigenaar heeft besloten, en niets
   meer.

   Dit zijn de waarden die RTG als werkgever voor zijn eigen mensen kiest. Een
   andere organisatie in het ecosysteem heeft haar eigen beleid en erft dit NIET:
   een zaak die RTG Vrijheid gebruikt, zet zelf wat zij geeft.

   BESLUIT VAN DE EIGENAAR, 27 september 2026 (VRIJHEID.md par. 6):
     - tien RTG Days per kalenderjaar, bovenop het wettelijke en contractuele
       verlof;
     - valt een verjaardag op een dag waarop iemand al vrij is -- weekend,
       officiele feestdag, of een vaste vrije dag van een parttimer -- dan is de
       VORIGE werkdag vrij. Eén regel voor alle drie, zodat hij uit te leggen is
       en een parttimer niet slechter uitkomt.

   NOG NIET JURIDISCH GEVALIDEERD. Of deze dagen loonadministratief en fiscaal
   als betaalde arbeidsvoorwaarde gelden, en hoe ze op de loonstrook staan, is
   nog niet getoetst. Daarom staat `juridischGevalideerd` op false, en
   lus.js telt dat als blocker.

   WAT NIET BESLOTEN IS, STAAT HIER NIET: de nachtdienst over de verjaardag, 29
   februari in een gewoon jaar, de grens voor eerder weg zonder mens, en alle
   drempels. Die blijven open, en de motor zegt dan UNKNOWN met de reden. */
'use strict';
const { maakBeleid } = require('./beleid');

const BESLUIT = 'besluit eigenaar RTG, 27 september 2026';
const w = (waarde) => ({ waarde, bron: BESLUIT });

const LAGEN = Object.freeze({
  ORGANIZATION_POLICY: Object.freeze({
    'verjaardag.weekend': w('vorige-werkdag'),
    'verjaardag.feestdag': w('vorige-werkdag'),
    'verjaardag.geenWerkdag': w('vorige-werkdag')
  }),
  RTG_ADDITIONAL_BENEFIT: Object.freeze({
    'rtgDag.perJaar': w(10)
  })
});

const STAND = Object.freeze({ besluit: BESLUIT, juridischGevalideerd: false });

/* Het beleid van RTG, eventueel met lagen eronder die het recht leveren (de wet,
   een cao, het contract). Die komen uit de laag die ze kent en nooit uit hier. */
function rtgBeleid(onder) {
  return maakBeleid({ ...(onder || {}), ...LAGEN });
}

module.exports = { LAGEN, STAND, BESLUIT, rtgBeleid };
