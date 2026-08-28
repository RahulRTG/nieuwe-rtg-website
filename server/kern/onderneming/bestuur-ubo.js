/* HET BESTUUR, deel "UBO": wie er uiteindelijk belanghebbende is.

   Afgesplitst uit ./bestuur.js toen dat door de 10 kB van keuringsregel 13
   ging. De naad ligt hier goed: het register gaat over wie er IN staat, deze
   module over wat daar UIT volgt. Dat zijn twee dingen, en het tweede is een
   rekenregel die je los hoort te kunnen lezen en toetsen.

   DE UBO WORDT AFGELEID EN NIET INGEVULD. Wie meer dan 25% van de aandelen
   houdt, is uiteindelijk belanghebbende; is er niemand die daarboven uitkomt,
   dan gelden de statutair bestuurders als UBO. Dat is een REGEL en geen oordeel,
   dus hij hoort gerekend te worden en niet aangevinkt -- een aangevinkte UBO
   blijft staan als de aandelen verschuiven, en dan klopt het register precies
   op het moment dat het ertoe doet niet meer.

   EN WAT DIT NIET IS: een UBO-opgave bij de Kamer van Koophandel. Die doet u
   daar, met echte namen en identiteitsbewijzen. Dit is het beeld waarmee u die
   opgave voorbereidt en bijhoudt. Het staat in het antwoord zelf, want een
   register dat zich voordoet als de officiële opgave, is er een die niemand
   meer indient. */

'use strict';

/* De drempel waarboven iemand uiteindelijk belanghebbende is. MEER dan 25%,
   niet 25% of meer: die grens is de wet en niet onze afronding. */
const UBO_DREMPEL = 25;

module.exports = ({ zittend, nu, ROLLEN }) => {
  /* ---- de UBO-afleiding ----
     Twee trappen, in deze volgorde, want zo staat de regel. Nooit allebei
     tegelijk: een pseudo-UBO naast een echte zou suggereren dat er twee soorten
     belanghebbenden zijn. */
  function ubo(b, kanAandelen) {
    if (kanAandelen) {
      const groot = nu(b).filter(a => a.percentage > UBO_DREMPEL)
        .sort((x, y) => y.percentage - x.percentage);
      if (groot.length) {
        return { soort: 'belang', drempel: UBO_DREMPEL,
          personen: groot.map(a => ({ codenaam: a.codenaam, percentage: a.percentage })),
          regel: 'Wie meer dan ' + UBO_DREMPEL + '% van de aandelen houdt, is uiteindelijk belanghebbende.' };
      }
    }
    /* Niemand boven de drempel (of geen aandelen mogelijk): dan de statutair
       bestuurders. Commissarissen en adviseurs tellen niet mee -- zij
       vertegenwoordigen de onderneming niet. */
    const tekenaars = zittend(b).filter(x => ROLLEN[x.rol] && ROLLEN[x.rol].tekent);
    if (!tekenaars.length) {
      return { soort: 'geen', drempel: UBO_DREMPEL, personen: [],
        regel: 'Er is niemand met een belang boven ' + UBO_DREMPEL + '% en er staat geen statutair bestuurder ingeschreven.',
        let: 'Zolang dit zo is, kunt u geen UBO-opgave doen. Elke rechtspersoon heeft er een.' };
    }
    return { soort: 'pseudo', drempel: UBO_DREMPEL,
      personen: tekenaars.map(x => ({ codenaam: x.codenaam, rol: x.rol })),
      regel: 'Niemand houdt meer dan ' + UBO_DREMPEL + '% van de aandelen. Dan gelden de statutair bestuurders als UBO.',
      let: 'Dit heet een pseudo-UBO. Hij is niet minder geldig, maar hij verandert zodra iemand wél boven de drempel uitkomt.' };
  }

  return { ubo };
};

module.exports.UBO_DREMPEL = UBO_DREMPEL;
