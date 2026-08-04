/* ============================================================================
   DE SALON-REGEL: wanneer is een partner zichtbaar voor leden?

   Vier kleine functies met een grote gevolgtrekking. Ze stonden in de
   dienstenlaag, en dat is de verkeerde plek: dit is geen infrastructuur maar een
   REGEL over wie er in de leden-app verschijnt. Een partner zonder compleet
   Salon-profiel -- een bio van minstens vijftien tekens en minstens een foto --
   wordt niet aan leden getoond en kan niets publiceren.

   Nagemeten met scripts/blokscan.js: EEN naam erdoor (db), vier terug, nul
   draden. Zo klein en zo losstaand hoort dit niet ergens tussenin te staan.
   ========================================================================== */
'use strict';

module.exports = function maakSalonRegel(deps) {
  const { db } = deps;
/* ---- De Salon is verplicht: elke partner doet zijn marketing, producten en
   folders via De Salon (niet in de leden-app). Een partner met een onvolledig
   Salon-profiel wordt NIET aan leden getoond en kan niets publiceren. Compleet =
   een bio en minstens een profielfoto (of een foto op de bedrijfspagina). */
function salonProfielCompleet(s) {
  const bio = ((s.salon && s.salon.bio) || '').trim();
  const heeftFoto = !!(s.salon && s.salon.foto) || (Array.isArray(s.photos) && s.photos.length > 0);
  return bio.length >= 15 && heeftFoto;
}
// De ondernemer-poort: de klaar-checklist en de online-schakelaar per zaak. Een
// zaak is pas zichtbaar/boekbaar voor leden als de Salon-pagina compleet is EN
// de zaak online staat (bestaande zaken zijn online tenzij expliciet uitgezet).
const ondernemerpoort = require('../kern/ondernemerpoort')({ salonProfielCompleet });
function salonZichtbaar(s) { return salonProfielCompleet(s) && s.online !== false; }
// hoeveel Salon-items (posts/folders/deals/polls) deze partner al plaatste
function salonItemsVan(code) { return db.data.posts.filter(p => p.partnerCode === code).length; }

  return { ondernemerpoort, salonItemsVan, salonProfielCompleet, salonZichtbaar };
};
