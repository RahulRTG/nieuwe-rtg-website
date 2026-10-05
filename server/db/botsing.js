/* Een verloren update tussen processen hoorbaar maken (RTG-V1-RELEASE C6).

   ./merge.js laat bij twee wijzigingen van hetzelfde blad de onze winnen; de
   andere verdwijnt. In productie mag SQLite daarom maar een schrijvend proces
   hebben (../config/productie-opslag.js), maar bij een overname in het trio
   kan het korte venster er toch zijn. Dan hoort het er te staan in plaats van
   stil te gebeuren: een regel per botsing, met de collectie en het pad, en een
   teller die een meting kan lezen.

   Bewust GEEN inhoud in de melding: een saldo of een naam hoort niet in een
   logregel, alleen WAAR het botste. */
'use strict';

const teller = { aantal: 0 };

function melder(sleutel) {
  return (pad) => {
    teller.aantal += 1;
    console.warn('[db] botsing tussen processen in ' + sleutel + (pad ? ' bij ' + pad : '') +
      ': beide kanten wijzigden hetzelfde veld, de laatste schrijver wint (' + teller.aantal + ' sinds de start).');
  };
}

module.exports = { melder, teller };
