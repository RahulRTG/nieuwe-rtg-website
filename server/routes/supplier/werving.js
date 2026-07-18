/* Domein "supplier" (deelmodule): personeelswerving. Uitnodigen met een kassacode,
   zelf aanmelden met een eigen RTG-account, en de sollicitatiestroom (vacature ->
   sollicitatie -> beslissing -> uitnodiging). De invite-helpers zijn hier lokaal
   omdat zowel het uitnodigen als het accepteren van een sollicitatie ze gebruikt.
   Draait op de gedeelde kern. */
const { eigenVeld } = require('../../kern/util'); // veilige objecttoegang (geen prototype-pollution)
module.exports = (kern) => {
  /* De personeels- en sollicitatielaag draaien als submodules op de gedeelde
     kern; de personeelslaag levert de invite-helpers aan de sollicitatie-
     stroom via de context. */
  const wctx = { kern };
  Object.assign(wctx, require('./werving/personeel')(wctx));
  require('./werving/sollicitaties')(wctx);
};
