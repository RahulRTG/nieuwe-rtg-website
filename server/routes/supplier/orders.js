/* Supplier-submodule "orders": Orders op de vloer: tafelbestellingen, spoed, overschot, de lijn, secties
   en stations (KDS), de statusketen en terugbetalingen.
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



app.post('/api/supplier/order/table', supplierAuth, (req, res) => {
  const o = (x => x && x.supplierCode === req.supplier.code ? x : undefined)(orderMetRef(req.body.ref));
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  o.table = String(req.body.table || '').slice(0, 24);
  save();
  logActivity(req.supplier.code, req.actor, 'zette ' + o.ref + ' op ' + (o.table || 'geen tafel'));
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  res.json({ ok: true, order: o });
});

/* De spoedbon van de bediening: een enkel gerecht komt als GEWONE bon op de
   schermen (en telt dus gewoon mee in maak-nu en all day; in de drukte kijk
   je toch alleen hoeveel je van iets moet maken). Bewust geen bel of flits;
   de bon sorteert wel bovenaan. Intrekken kan zolang hij niet klaar is. */
app.post('/api/supplier/order/spoed', supplierAuth, (req, res) => {
  // intrekken: alleen eigen interne spoedbonnen
  if (req.body.op === false) {
    const o = (x => x && x.supplierCode === req.supplier.code && x.intern ? x : undefined)(orderMetRef(req.body.ref));
    if (!o) return res.status(404).json({ error: 'Spoedbon niet gevonden.' });
    if (['klaar', 'geserveerd'].includes(o.status)) return res.status(409).json({ error: 'Deze spoedbon is al klaar.' });
    o.status = 'geweigerd';
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
    logActivity(req.supplier.code, req.actor, 'trok spoedbon ' + o.ref + ' in');
    return res.json({ ok: true, order: o });
  }
  const m = (req.supplier.menu || []).find(x => x.id === req.body.itemId);
  if (!m) return res.status(404).json({ error: 'Gerecht niet gevonden.' });
  const qty = Math.min(10, Math.max(1, parseInt(req.body.qty, 10) || 1));
  const o = {
    ref: 'SP' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    supplierCode: req.supplier.code,
    customerTier: null, customerKey: null,
    customerCodename: 'naloop · ' + req.actor.name,
    items: [{ id: m.id, name: m.name, qty, price: 0 }],
    total: 0, paid: true, pickup: pickupCode(),
    table: String(req.body.table || '').slice(0, 24) || null,
    status: 'nieuw', at: new Date().toISOString(),
    spoed: { at: new Date().toISOString(), door: req.actor.name }, intern: true
  };
  ordersVoegToe(o, { achteraan: true }); // dezelfde plek als de oude push: interne spoedbon achteraan
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  logActivity(req.supplier.code, req.actor, 'zette een spoedbon op de lijn: ' + qty + 'x ' + m.name + (o.table ? ' (' + o.table + ')' : ''));
  res.json({ ok: true, order: o });
});

/* Het overschot: te veel gemaakt is geen afval maar voorraad op de pas.
   "Is over" melden kan op elk pas-scherm; de AI verrekent het overal
   (maak-nu, all day en de coach: gebruik eerst wat er ligt). Generiek per
   zaak, zodat elk genre dezelfde techniek kan gebruiken. Na twee uur
   vervalt een melding vanzelf (voedselveiligheid). */
const OVERSCHOT_TTL = 2 * 3600000;
function overschotVers(s) {
  s.overschot = (s.overschot || []).filter(x => Date.now() - new Date(x.at) < OVERSCHOT_TTL);
  return s.overschot;
}
app.post('/api/supplier/overschot', supplierAuth, (req, res) => {
  const s = req.supplier;
  const lijst = overschotVers(s);
  const op = String(req.body.op || 'erbij');
  if (op === 'erbij') {
    const m = (s.menu || []).find(x => x.id === req.body.itemId);
    if (!m) return res.status(404).json({ error: 'Gerecht niet gevonden.' });
    const qty = Math.min(20, Math.max(1, parseInt(req.body.qty, 10) || 1));
    const rij = lijst.find(x => x.itemId === m.id);
    if (rij) { rij.qty += qty; rij.at = new Date().toISOString(); }
    else lijst.push({ id: crypto.randomBytes(3).toString('hex'), itemId: m.id, name: m.name, qty, at: new Date().toISOString(), door: req.actor.name });
    logActivity(s.code, req.actor, 'meldde over op de pas: ' + qty + 'x ' + m.name);
  } else {
    const rij = lijst.find(x => x.id === req.body.id || x.itemId === req.body.itemId);
    if (!rij) return res.status(404).json({ error: 'Niets gevonden op de pas.' });
    if (op === 'gebruikt') {
      rij.qty -= 1;
      if (rij.qty <= 0) s.overschot = lijst.filter(x => x !== rij);
      logActivity(s.code, req.actor, 'gebruikte van de pas: ' + rij.name);
    } else {
      s.overschot = lijst.filter(x => x !== rij);
      logActivity(s.code, req.actor, 'schreef af van de pas: ' + rij.qty + 'x ' + rij.name);
    }
  }
  save();
  sseToSupplier(s.code, 'sync', { scope: 'orders' });
  res.json({ ok: true, overschot: s.overschot });
});

/* De lijnbezetting: meld je aan op een kant (warm, koud, snacks, desserts,
   pas of bar). De schermen rekenen met het aantal aangemelde koks: werklast
   per kok, batchgrootte en het advies van de coach. Een kok staat op een
   kant tegelijk; nog een keer tikken meldt af. */
app.post('/api/supplier/lijn', supplierAuth, (req, res) => {
  const sectie = String(req.body.sectie || '');
  if (!['warm', 'koud', 'snack', 'dessert', 'pas', 'bar'].includes(sectie)) return res.status(400).json({ error: 'Onbekende kant.' });
  const s = req.supplier;
  s.lijn = s.lijn || {};
  const ik = { id: req.actor.staffId, name: req.actor.name };
  const stond = (s.lijn[sectie] || []).some(x => x.id === ik.id);
  for (const k of Object.keys(s.lijn)) s.lijn[k] = (s.lijn[k] || []).filter(x => x.id !== ik.id);
  if (!stond) (s.lijn[sectie] = s.lijn[sectie] || []).push(ik);
  save();
  logActivity(s.code, req.actor, stond ? 'meldde zich af van de kant ' + sectie : 'meldde zich aan op de kant ' + sectie);
  sseToSupplier(s.code, 'sync', { scope: 'orders' });
  res.json({ ok: true, lijn: s.lijn, aangemeld: !stond });
});

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
