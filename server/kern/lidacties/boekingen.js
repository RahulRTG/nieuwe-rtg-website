/* Lidacties (deelmodule): EEN BOEKING BETALEN -- huur, charter, tickets en
   diensten uit Ter plaatse, via /api/booking/pay.

   Dit pad zette `paid = true` en maakte een factuur, maar boekte geen cent via
   RTG Pay. Het lid had dus een betaalde huur zonder te betalen, de zaak kreeg
   "Nieuwe boeking (betaald)" voor geld dat nooit binnenkwam, en annuleren sloeg
   de teruggave over omdat `payBetaaldCenten` ontbrak (zie de kop van
   ../ervaring/leden/annuleren.js). Gevonden door TravelOS.

   Nu in dezelfde volgorde als de bestelling en de rit: EERST het geld via
   ./afrekenen.js (die het tegoed teruggeeft als het misgaat of een herhaling
   is), DAN `paid`, de marker en de factuur. Weigert de betaling, dan blijft de
   boeking onbetaald en is er geen factuur. test/verhuur-geld.test.js. */
module.exports = (ctx) => {
  const { boekingMetRef, pasTegoedToe, ledenvoordeelVoor, findSupplier, subsidie, verdienPunten,
    openLijnVoor, save, factuurVoorLid, notifySupplier, sseToSupplier, sseToOffice } = ctx;
  const { rekenAf } = require('./afrekenen')(ctx);

  async function betaalBoekingVoor(session, body) {
    const b = boekingMetRef(body.ref);
    if (!b || (b.customerKey || b.customerTier) !== session.key) return { status: 404, error: 'Boeking niet gevonden.' };
    if (b.paid) return { status: 409, error: 'Al betaald.' };
    /* Een geannuleerde boeking blijft geannuleerd. Zonder deze regel valt de enige
       poort weg zodra er is terugbetaald -- de annulering zet paid weer op false --
       en kan dezelfde retour-boeking opnieuw afgerekend worden. Zelfde vorm als bij
       de bestelling en de rit. */
    if (b.refunded || ['geweigerd', 'terugbetaald', 'geannuleerd'].includes(b.status))
      return { status: 409, error: 'Deze boeking is geannuleerd (' + b.status + ') en kan niet opnieuw betaald worden.' };
    if (b.status === 'wacht-op-betaling' && Date.now() - new Date(b.at) > 30 * 60000)
      return { status: 410, error: 'Deze aanvraag is verlopen. Boek opnieuw.' };
    // punten-tegoed (RTG legt bij) en het RTG-ledenvoordeel per genre (de boardroom bepaalt)
    const prijs = b.price || 0;
    const korting = pasTegoedToe(session.key, prijs);
    const voordeel = ledenvoordeelVoor(findSupplier(b.supplierCode), prijs - korting);
    const geld = await rekenAf({ session, supplierCode: b.supplierCode, supplierNaam: b.supplierName,
      bedrag: prijs, korting, voordeel, soort: 'boeking', ref: b.ref, idem: 'boeking:' + b.ref });
    if (geld.error) return geld;   // rekenAf gaf het tegoed al terug
    /* Twee tikken tegelijk komen allebei langs `b.paid`; de tweede krijgt van
       RTG Pay dezelfde boeking terug (herhaald) en mag niets meer doen. */
    if (geld.herhaald) return { status: 409, error: 'Deze boeking is al betaald.' };
    if (korting) b.puntenKorting = korting;
    if (voordeel) { b.regieKorting = voordeel; b.voordeelOpbouw = subsidie.opbouwVan(prijs - korting, voordeel); }
    b.payBetaaldCenten = geld.betaaldCenten;
    b.payBijgelegdCenten = geld.bijgelegdCenten;
    b.paid = true;
    b.paidAt = new Date().toISOString();
    if (b.status === 'wacht-op-betaling') b.status = 'aangevraagd';
    verdienPunten(session.key, prijs - korting - voordeel, b.supplierName);
    openLijnVoor(findSupplier(b.supplierCode), session);
    save();
    factuurVoorLid({ soort: 'dienst', supplierCode: b.supplierCode, supplierNaam: b.supplierName,
      codenaam: b.customerCodename, ref: b.ref, methode: 'rtg',
      regels: [{ omschrijving: (b.service && b.service.name) || 'Dienst', aantal: 1, stuk: prijs }] });
    notifySupplier(b.supplierCode, { icon: 'agenda', title: 'Nieuwe boeking (betaald)', body: b.customerCodename + ': ' + b.service.name + (b.wanneer ? ' · ' + b.wanneer : '') + ' · € ' + prijs });
    sseToSupplier(b.supplierCode, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
    return { ok: true, boeking: b };
  }

  return { betaalBoekingVoor };
};
