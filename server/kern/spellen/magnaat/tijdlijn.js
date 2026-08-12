/* Magnaat: DE TIJDLIJN VAN DE CAMPAGNE -- waar de tafel het over heeft.

   Fase D, het laatste stuk: `chat-integratie` (GAMEHALL.md 12.9). En net als
   bij de ondernemerskring begint hij bij wat hij NIET doet, want "een spel
   koppelen aan de chat" is de kortste weg naar twee dingen die niet mogen.

   ============ HIJ STUURT NIETS ============

   Deze module SCHRIJFT NERGENS. Geen bericht, geen sein, geen duwtje, geen
   push. Hij rekent uit wat er in deze campagne gebeurd is en geeft dat terug;
   de client zet het naast het gesprek dat er al is. Dat is een besluit met een
   voorgeschiedenis: een spellaag die zelf gaat sturen kan een mens buiten het
   spel om bereiken, en dan is de vraag "mag dit bericht" op twee plekken
   beantwoord. `routes/member/werk.js` kneep daar al op.

   ============ HIJ MAAKT GEEN GESPREK ============

   Praten in een potje loopt langs ../praat.js, en die legt de regel op die
   erboven staat: EEN POTJE GEEFT GEEN NIEUW RECHT OM IEMAND TE BEREIKEN. Elk
   PAAR aan tafel moet elkaar buiten dit potje ook al mogen bereiken. Deze laag
   raakt dat niet aan -- hij weet niet eens wie er praat. Zonder gesprek is hij
   gewoon een lijstje op een scherm.

   ============ WAT ER IN MAG ============

   Alleen wat AL PUBLIEK IS. Nieuws, wat de Foundation bouwde, wie de tafel
   verliet en aan wie. Geen kas, geen omzet, geen vermogen, geen contract tussen
   twee anderen -- dat zijn iemands boeken, en die zijn niet van jou
   (./weergave.js). De toets leest de uitkomst na op bedragen.

   En hij wordt GEREKEND en niet bewaard, uit de staat van het potje. Dus mist
   niemand een regel doordat hij weg was, en verandert er niets doordat je
   kijkt -- dezelfde eigenschap als de klok die bijrekent in plaats van tikt. */
'use strict';
const F = require('./foundation');
const { kaart } = require('./kaart');

module.exports = ({ codenaamVan }) => {
  return function tijdlijn(potje) {
    const st = potje.staat || {};
    const k = kaart(st.stad) || { zones: [] };
    const zone = (id) => (k.zones.find(z => z.id === id) || { naam: id }).naam;
    const rijen = [];

    /* WAT DE FOUNDATION BOUWDE. Het duidelijkste gedeelde moment dat een
       campagne heeft: er staat iets in de stad dat er niet was, en niemand kan
       zeggen dat het van hem is. */
    for (const g of (st.foundation || { gedaan: [] }).gedaan) {
      const p = F.PROJECTEN.find(x => x.id === g.id);
      if (!p) continue;
      rijen.push({ soort: 'foundation', maand: g.maand === undefined ? null : g.maand,
        zin: p.naam + ' is gebouwd in ' + zone(g.zone) + '.' });
    }

    /* WIE DE TAFEL VERLIET, en aan wie. Op codenaam, want dat is hoe de tafel
       elkaar kent -- en het staat toch al op de eindstand (./eindstand.js). */
    for (const [h, w] of Object.entries(st.uit || {})) {
      const wie = codenaamVan(h);
      rijen.push({ soort: 'uitstap', maand: w.maand,
        zin: w.naar
          ? wie + ' stopte ermee; ' + codenaamVan(w.naar) + ' ging verder waar hij ophield.'
          : wie + ' stopte ermee en wikkelde zijn zaken af.' });
    }

    /* HET WERELDNIEUWS STAAT HIER NIET, en dat is geen weglating. ./nieuws.js
       REKENT het per maand uit een hash op de partij-id -- er is geen log, en er
       hoort er ook geen te komen: een tweede voorraad naast een deterministische
       som is een tweede waarheid. Wat er nu speelt staat op het publieke scherm
       (./weergave.js), en dat is de plek waar het hoort.

       Wat hier WEL in staat, staat er omdat het echt een gebeurtenis is die in
       de staat is opgeschreven en niet meer verandert. */

    /* OP DE MAAND, en bij gelijke maand op de volgorde waarin ze hierboven
       staan -- vast en niet op toeval, want twee mensen horen dezelfde tijdlijn
       te zien. Een regel zonder maand (uit een oudere partij) gaat vooraan. */
    return rijen
      .map((r, i) => Object.assign({ i }, r))
      .sort((a, b) => (a.maand === null ? -1 : b.maand === null ? 1 : a.maand - b.maand) || a.i - b.i)
      .map(({ i, ...r }) => r);
  };
};
