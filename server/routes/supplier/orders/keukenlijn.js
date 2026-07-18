/* Orders (deelmodule): de keukenlijn: een bon aan een tafel koppelen,
   spoed vanaf de bediening, het overschot op de pas en het aanmelden op
   een kant van de lijn. Krijgt de gedeelde kern een keer bij het opstarten
   vanuit routes/supplier/orders.js. */
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

};
