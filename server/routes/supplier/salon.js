/* Domein "supplier" (deelmodule): De Salon (marketing van de zaak). Draait op de
   gedeelde kern. Publiceren kan pas met een compleet Salon-profiel en met de
   Salon-marketing aan in de eigen boardroom. */
module.exports = (kern) => {
  const { ALT_IDEE, BOEK_KETEN, DEMO, DEMO_SUPPLIER, HK_STATUSES, LANDEN, POS_METHODS, RIT_KETEN, RIT_LEGACY, TABLE_STATUSES, VAC_SOORTEN, ZAAK_OPTIES, accounts, addTicket, aiFindDoor, aiFindRoom, alcoholGrensVan, anthropic, app, applyChatPubliek, applyChatVertaald, auth, beslisReservering, isFavoriet, broadcastSync,
    zetCollectie, zetArtikel, pasVoorraad, releaseDrop, klantProfiel, zetKlantMaten, voegKlantnotitie,
    legApart, vraagPaskamer, paskamerBreng, stuurStyling, retailVerkoop, voorraadZoek, retailState,
    RETAIL_MATEN, RETAIL_SEIZOENEN, PASPOORT_NIVEAUS, paspoortVraag, paspoortBekijk, paspoortIncident, paspoortPartner,
    cannedBoekhouder, cateringDishes, chatStuur, checkCred, coachCache, coachRules, crypto, db, ensureApplyChat, eventCovers, express, fallbackRunsheet, financeVoor, factuur, facturatie, boekhoudkennis, talen, findSupplier, gcCode, geborenVan, guestsFor, hasCred, i18n, ledenPrijs, leeftijdVan, logActivity, keyVanCodenaam, magBezorgen, haversine, etaMinutes, ticketsVoorSlot, loginFails, managerOnly, noteFailedTry, notify, notifyApplicant, notifySupplier, parseRunsheetText, pickupCode, pinFails, posDay, publicSupplier, pushLive, rememberSession, ritBezetting, ritVerder, runItem, salonNaarVolgers, salonProfielCompleet, salonItemsVan, save, scheduleFor, schoon, sectiesForOrder, sessionFor, setRoomHk, sortRunsheet, sseClients, sseSend, sseToCustomer, sseToOffice, sseToSupplier, stationsForOrder, supplierAuth, supplierState, tooManyTries, trChat, unlockDoor, weekdagFactor,
    zaakBoard, zaakZet, zaakFunctieAan, klantSalon, media,
    dpVerzoekMaak, dpVerzoekIntrek, dpOntvangsten, logInlog, pay,
    tafelplanning, reserveringTafel, reserveringKomst, walkIn, shiftSamenvatting,
    fluisterZeg, orderMetRef, ordersVanZaak, ordersVoegToe, boekingenVanZaak } = kern;

// De Salon is verplicht: publiceren (post/folder/deal/poll) kan pas met een
// compleet profiel (bio + foto). De bio/foto-endpoints zelf blijven altijd open.
// Bovendien kan de zaak zijn Salon-marketing in zijn eigen boardroom uitzetten.
function eisSalonProfiel(req, res) {
  if (!zaakFunctieAan(req.supplier, 'salon')) { res.status(409).json({ error: 'Salon-marketing staat uit in uw boardroom. Zet het aan om te publiceren.' }); return false; }
  if (salonProfielCompleet(req.supplier)) return true;
  res.status(409).json({ error: 'Vul eerst uw Salon-profiel in (een bio en een profielfoto). De Salon is de plek voor uw marketing, producten en folders.' });
  return false;
}
/* De publicatie- en profiellaag draaien als submodules op de gedeelde
   kern; eisSalonProfiel gaat als tweede argument mee. */
require('./salon/publiceren')(kern, eisSalonProfiel);
require('./salon/profiel')(kern, eisSalonProfiel);
};
