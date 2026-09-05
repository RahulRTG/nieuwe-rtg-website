/* RTG Bank, deel "uitgang": waar geld het huis ECHT verlaat. De rest van de bank
   boekt; hier wordt er verstuurd, en dat zijn twee gebeurtenissen die los van
   elkaar mislukken.

   De RIJ zelf is gedeeld met RTG Pay en het fonds -- een huis, een getal voor
   "wat is er geboekt maar niet aangekomen" -- en wordt in server.js gebouwd.
   Wat hier woont is alleen de TERUGGANG van de bank: hoe het geld terugkomt als
   de rail de opdracht blijft weigeren, of als de provider achteraf meldt dat de
   payout is mislukt. Die kan hier en nergens anders wonen, want alleen deze kant
   weet dat het bank-grootboek het is en dat de tegenrekening extern:sepa heet. */
'use strict';

module.exports = (ctx) => {
  const { opdrachten, boek, boekAsync, grootboek, rekMeta, seintje,
    economischeBoekingEenmaal, geldModus } = ctx;
  const boekTerugEenmaal = require('../betaalopdracht/terugboeking');

  opdrachten.registreerTeruggang('sepa-uit', async (o) => {
    const terug = await boekTerugEenmaal({ domein: 'bank', grootboek, boek, boekAsync,
      boekEenmaal: economischeBoekingEenmaal, geldModus,
      van: 'extern:sepa', naar: o.bron, centen: o.centen,
      soort: 'sepa-terug', oms: 'SEPA niet verstuurd, teruggeboekt', ref: o.ledgerRef });
    if (terug.error) return terug;
    // het tarief hoort ook terug: er is geen dienst geleverd
    if (o.tariefCenten > 0) {
      const t = await boekTerugEenmaal({ domein: 'bank', grootboek, boek, boekAsync,
        boekEenmaal: economischeBoekingEenmaal, geldModus,
        van: 'rtg:reserve', naar: o.bron, centen: o.tariefCenten,
        soort: 'tarief-terug', oms: 'SEPA-tarief teruggeboekt', ref: o.ledgerRef });
      if (t.error) return t;
    }
    const m = rekMeta(o.bron);
    if (m) seintje(m.codenaam);
    return terug;
  });

  return opdrachten;
};
