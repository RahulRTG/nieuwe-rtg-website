/* De werkkopie van een verzoek, gezien vanaf een VROEGE commit (audit P0-1).

   Los van ./verzoekcontext.js, dat over de levensloop van een verzoek gaat: dit
   gaat over de vraag of een schrijfactie nog door een commit voor het antwoord
   wordt gedragen, en over de vakken die ./verzoekspoor.js meeneemt in een
   transactie die midden in het verzoek commit. Geknipt toen verzoekcontext.js
   daarmee over de 10 kB van keuringsregel 13 ging. */
'use strict';

const { huidige } = require('./verzoekcontext');
const heeft = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

/* KAN DE RESPONSPOORT DEZE SCHRIJFACTIE NOG BEVESTIGEN? In PostgreSQL-modus
   zet save() binnen een verzoek alleen een vlag, en de autoritatieve commit
   volgt voor het antwoord (./postgres-verzoeken.js). Een schrijfactie is daar
   dus bevestigd ALS het antwoord een succes is -- maar alleen zolang er nog een
   commit voor het antwoord komt: na de requestcommit, of in een open stroom,
   niet meer. Binnen een autoritatieve primitive (eigenWerk) commit die primitive
   zelf. Buiten een verzoek bevestigt niemand iets. */
function commitVoorAntwoord() {
  const ctx = huidige();
  if (!ctx) return false;
  if (ctx.eigenOpslag) return true;
  return !!(ctx.open && !ctx.stroom && !ctx.verzoekGecommit);
}

/* De stand van EEN collectie in deze werkkopie, voor een vroege commit die het
   auditspoor van het verzoek moet meenemen (./verzoekspoor.js). Zonder vak is
   de levende waarde de waarheid en is er niets gewijzigd. */
function vakStand(ctx, sleutel, ruw) {
  const vak = ctx && ctx.vakken && ctx.vakken.get(sleutel);
  if (vak) {
    const na = vak.bestaat ? JSON.stringify(vak.waarde) : null;
    return { basisBestaat: vak.basisBestaat, basisJson: vak.basisJson, bestaat: vak.bestaat,
      waardeJson: na, gewijzigd: !(vak.basisBestaat === vak.bestaat && vak.basisJson === na) };
  }
  const bron = (ctx && ctx.bron) || ruw;
  const bestaat = heeft(bron, sleutel);
  const json = bestaat ? JSON.stringify(bron[sleutel]) : null;
  return { basisBestaat: bestaat, basisJson: json, bestaat, waardeJson: json, gewijzigd: false };
}
/* Na een vroege commit die dit vak meenam: de werkkopie laat hem los, zodat
   wat er daarna in het verzoek bijkomt op de GECOMMITTE waarde verder bouwt in
   plaats van dezelfde regels een tweede keer aan te bieden. Is het vak
   intussen veranderd, dan laat hij hem staan en zegt dat (`false`). */
function laatVakLos(ctx, sleutel, verwachtJson) {
  const vak = ctx && ctx.vakken && ctx.vakken.get(sleutel);
  if (!vak) return true;
  const na = vak.bestaat ? JSON.stringify(vak.waarde) : null;
  if (na !== verwachtJson) return false;
  ctx.vakken.delete(sleutel);
  return true;
}

module.exports = { commitVoorAntwoord, vakStand, laatVakLos };
