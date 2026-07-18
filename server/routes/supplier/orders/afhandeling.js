/* Orders (deelmodule): de afhandeling: de sectie- en stationsfasen van
   een bon, de orderstatusketen en de terugbetaling. Krijgt de gedeelde
   kern een keer bij het opstarten vanuit routes/supplier/orders.js. */
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
app.post('/api/supplier/order/sectie', supplierAuth, (req, res) => {
  const o = (x => x && x.supplierCode === req.supplier.code ? x : undefined)(orderMetRef(req.body.ref));
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  const sectie = String(req.body.sectie || '');
  if (!['warm', 'koud', 'snack', 'dessert'].includes(sectie)) return res.status(400).json({ error: 'Onbekende sectie.' });
  const phase = req.body.phase === 'klaar' ? 'klaar' : 'bezig';
  o.secties = o.secties || {};
  o.secties[sectie] = phase;
  if (o.status === 'nieuw') o.status = 'in bereiding';
  const nodig = sectiesForOrder(req.supplier, o);
  const wasKlaar = o.status === 'klaar';
  const keukenWasKlaar = (o.stations || {}).keuken === 'klaar';
  if (nodig.length && nodig.every(x => o.secties[x] === 'klaar')) {
    o.stations = o.stations || {};
    o.stations.keuken = 'klaar';                            // de hele keuken is klaar
    if (!keukenWasKlaar) o.pasAt = new Date().toISOString(); // vanaf nu staat het op de pas
    const stNodig = stationsForOrder(req.supplier, o);
    if (stNodig.every(st => o.stations[st] === 'klaar')) o.status = 'klaar';
  }
  save();
  broadcastSync([o.customerTier], 'orders');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  // de keuken praat met de bediening: bon compleet op de pas -> live belletje
  // op de bedieningspost, de PDA en de kassa (zelfde SSE-kanaal van de zaak)
  if (!keukenWasKlaar && (o.stations || {}).keuken === 'klaar')
    sseToSupplier(req.supplier.code, 'pas', { ref: o.ref, pickup: o.pickup, table: o.table || null });
  sseToOffice('sync', { scope: 'orders' });
  if (o.status === 'klaar' && !wasKlaar && o.customerTier)
    notify(o.customerTier, { icon: '\u2705', title: req.supplier.name, body: 'Uw bestelling is klaar. Ophaalcode: ' + o.pickup + '.', scope: 'orders' });
  logActivity(req.supplier.code, req.actor, sectie + ': ' + o.ref + ' ' + (phase === 'klaar' ? 'klaar' : 'in bereiding'));
  res.json({ ok: true, order: o });
});

app.post('/api/supplier/order/station', supplierAuth, (req, res) => {
  const o = (x => x && x.supplierCode === req.supplier.code ? x : undefined)(orderMetRef(req.body.ref));
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  const station = req.body.station === 'bar' ? 'bar' : 'keuken';
  const phase = req.body.phase === 'klaar' ? 'klaar' : 'bezig';
  o.stations = o.stations || {};
  const keukenWasKlaar = o.stations.keuken === 'klaar';
  o.stations[station] = phase;
  if (station === 'keuken' && phase === 'klaar' && !keukenWasKlaar) o.pasAt = new Date().toISOString();
  if (o.status === 'nieuw') o.status = 'in bereiding';
  const needed = stationsForOrder(req.supplier, o);
  const wasKlaar = o.status === 'klaar';
  if (needed.every(st => o.stations[st] === 'klaar')) o.status = 'klaar';
  save();
  broadcastSync([o.customerTier], 'orders');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  // de keuken praat met de bediening: bon op de pas -> live belletje
  if (!keukenWasKlaar && o.stations.keuken === 'klaar')
    sseToSupplier(req.supplier.code, 'pas', { ref: o.ref, pickup: o.pickup, table: o.table || null });
  sseToOffice('sync', { scope: 'orders' });
  if (o.status === 'klaar' && !wasKlaar && o.customerTier)
    notify(o.customerTier, { icon: '\u2705', title: req.supplier.name, body: 'Uw bestelling is klaar. Ophaalcode: ' + o.pickup + '.', scope: 'orders' });
  logActivity(req.supplier.code, req.actor, (station === 'bar' ? 'bar' : 'keuken') + ': ' + o.ref + ' ' + (phase === 'klaar' ? 'klaar' : 'in bereiding'));
  res.json({ ok: true, order: o });
});

app.post('/api/supplier/order/status', supplierAuth, (req, res) => {
  const o = (x => x && x.supplierCode === req.supplier.code ? x : undefined)(orderMetRef(req.body.ref));
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  const allowed = ['nieuw', 'in bereiding', 'klaar', 'geserveerd', 'geweigerd', 'onderweg', 'bezorgd', 'opgehaald'];
  const status = String(req.body.status || '');
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Onbekende status.' });
  o.status = status;
  save();
  broadcastSync([o.customerTier], 'orders');
  sseToOffice('sync', { scope: 'orders' });
  if (o.customerTier) notify(o.customerTier, { icon: '🍽️', title: req.supplier.name, body: 'Uw bestelling is nu: ' + status + '.', scope: 'orders' });
  logActivity(req.supplier.code, req.actor, 'zette ' + o.ref + ' op "' + status + '"');
  res.json({ ok: true, order: o });
});

// tafelreservering bevestigen of weigeren (elke medewerker, op eigen naam)

app.post('/api/supplier/refund', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return; // geld terugstorten is een management-handeling
  const o = (x => x && x.supplierCode === req.supplier.code ? x : undefined)(orderMetRef(req.body.ref));
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  if (!o.paid) return res.status(409).json({ error: 'Deze bestelling is niet betaald.' });
  o.paid = false;
  o.refunded = true;
  o.status = 'terugbetaald';
  save();
  logActivity(req.supplier.code, req.actor, 'stortte € ' + o.total + ' terug (' + o.ref + ')');
  broadcastSync([o.customerTier], 'orders');
  sseToOffice('sync', { scope: 'orders' });
  notify(o.customerTier, { icon: '↩️', title: req.supplier.name + ', terugstorting', body: 'U ontvangt € ' + o.total + ' retour.', scope: 'orders' });
  res.json({ ok: true, order: o });
});

};
