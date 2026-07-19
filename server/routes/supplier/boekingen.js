/* Supplier-submodule "boekingen": Boekingen van diensten: de statusketen van een afspraak (bevestigen,
   afronden, weigeren) met nette meldingen naar de klant.
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



app.post('/api/supplier/booking/status', supplierAuth, (req, res) => {
  const b = (x => x && x.supplierCode === req.supplier.code ? x : undefined)(kern.boekingMetRef(req.body.ref));
  if (!b) return res.status(404).json({ error: 'Boeking niet gevonden.' });
  if (b.status === 'wacht-op-betaling') return res.status(409).json({ error: 'Deze boeking is nog niet betaald.' });
  const status = String(req.body.status || '');
  if (status !== 'geweigerd') {
    if (!BOEK_KETEN.includes(status)) return res.status(400).json({ error: 'Onbekende status.' });
    if (BOEK_KETEN.indexOf(status) <= BOEK_KETEN.indexOf(b.status)) return res.status(409).json({ error: 'Deze boeking is al ' + b.status + '.' });
  } else if (b.status === 'afgerond') {
    return res.status(409).json({ error: 'Deze boeking is al afgerond.' });
  }
  b.status = status;
  if (status === 'afgerond') b.finishedAt = new Date().toISOString();
  save();
  const MELDING = { bevestigd: 'Uw afspraak is bevestigd.', afgerond: 'Dank u wel; uw afspraak is afgerond.', geweigerd: 'Uw aanvraag kon helaas niet worden bevestigd.' };
  notify(b.customerTier, { icon: '🗓️', title: req.supplier.name, body: MELDING[status] + (b.wanneer && status === 'bevestigd' ? ' (' + b.wanneer + ')' : ''), scope: 'orders' });
  sseToCustomer(b.customerKey || b.customerTier, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  logActivity(req.supplier.code, req.actor, 'zette boeking ' + b.ref + ' op "' + status + '"');
  res.json({ ok: true, boeking: b });
});

app.post('/api/supplier/service', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor de eigenaar.' });
  const s = req.supplier;
  s.services = s.services || [];
  const a = String(req.body.action || '');
  if (a === 'add') {
    const name = schoon(req.body.name, 80);
    const price = Math.round(Number(req.body.price) * 100) / 100;
    if (!name || !(price > 0)) return res.status(400).json({ error: 'Geef de dienst een naam en een prijs.' });
    s.services.push({
      id: 'sv' + Date.now().toString(36),
      name, desc: schoon(req.body.desc, 140), price,
      duurMin: Number(req.body.duurMin) > 0 ? Math.round(Number(req.body.duurMin)) : null,
      soort: req.body.soort === 'product' ? 'product' : 'dienst'
    });
  } else if (a === 'remove') {
    s.services = s.services.filter(x => x.id !== req.body.id);
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  save();
  logActivity(s.code, req.actor, 'werkte het aanbod bij');
  sseToSupplier(s.code, 'sync', { scope: 'settings' });
  broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  res.json({ ok: true, services: s.services });
});

/* Het vakwerk-dashboard: het vandaag-bord, de aanvragen die op bevestiging
   wachten, het aanbod met boek-cijfers en de KPI's van de dienstverlener
   (zzp, chef, wellness), plus de genre-bewuste AI-assistent. */
app.post('/api/supplier/vak/bord', supplierAuth, (req, res) => {
  const r = kern.vakwerk.bord(req.supplier.code);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json(r);
});
app.post('/api/supplier/vak/ai', supplierAuth, async (req, res) => {
  try {
    const r = await kern.vakwerk.adviseur(req.supplier.code, req.body.q);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    logActivity(req.supplier.code, req.actor, 'vroeg de vakwerk-assistent om advies');
    res.json(r);
  } catch (e) { console.error('[vakwerk]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
});

};
