/* Supplier-submodule "reserveringen": Reserveringen: bevestigen/weigeren, de tafelplanning, een tafel toewijzen,
   komst melden en de walk-in.
   Verbatim afgesplitst uit routes/supplier.js; alleen de routes, de helpers
   komen via het kern-object binnen. */
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



app.post('/api/supplier/reservering/beslis', supplierAuth, (req, res) => {
  const action = req.body.action === 'bevestig' ? 'bevestig' : 'weiger';
  const r = beslisReservering(req.supplier, String(req.body.id || ''), action);
  if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, (action === 'bevestig' ? 'bevestigde' : 'weigerde') + ' de reservering van ' + r.reservering.customerCodename + ' (' + r.reservering.datum + ' ' + r.reservering.tijd + ')');
  res.json(r);
});

/* De tafelplanning: de hele dag in een oogopslag (aanvragen, bevestigd,
   toegewezen tafels, walk-ins), plus de vloerhandelingen: tafel toewijzen,
   komst melden en een walk-in plaatsen. Voor iedereen die op de vloer staat. */
app.post('/api/supplier/tafelplan', supplierAuth, (req, res) => {
  res.json(tafelplanning(req.supplier, req.body.datum));
});
app.post('/api/supplier/reservering/tafel', supplierAuth, (req, res) => {
  const r = reserveringTafel(req.supplier, String(req.body.id || ''), req.body.tafel);
  if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, 'wees tafel ' + r.reservering.tafel + ' toe aan ' + r.reservering.customerCodename + ' (' + r.reservering.datum + ' ' + r.reservering.tijd + ')');
  res.json(r);
});
app.post('/api/supplier/reservering/komst', supplierAuth, (req, res) => {
  const r = reserveringKomst(req.supplier, String(req.body.id || ''), String(req.body.actie || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, 'meldde de reservering van ' + r.reservering.customerCodename + ' als ' + r.reservering.status);
  res.json(r);
});
app.post('/api/supplier/walkin', supplierAuth, (req, res) => {
  const r = walkIn(req.supplier, req.body.tafel, req.body.personen, req.actor.name);
  if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, 'plaatste een walk-in (' + r.reservering.personen + 'p) aan tafel ' + r.reservering.tafel);
  res.json(r);
});

};
