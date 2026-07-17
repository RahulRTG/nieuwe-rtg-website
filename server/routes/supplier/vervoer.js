/* Domein "supplier" (deelmodule): vervoer (live locatie, ritten aannemen en
   toewijzen, rithistorie/CSV en de vloot). Draait op de gedeelde kern. */
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

app.post('/api/supplier/location', supplierAuth, (req, res) => {
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    req.supplier.loc = { lat, lng, label: String(req.body.label || req.supplier.loc.label || '').slice(0, 80) };
    save();
    logActivity(req.supplier.code, req.actor, 'deelde de live locatie');
  }
  // klanten met een actieve rit bij deze leverancier live bijwerken
  const rides = db.data.rides.filter(r => r.supplierCode === req.supplier.code && r.status !== 'gearriveerd');
  for (const r of rides) { broadcastSync([r.customerTier], 'orders'); sseToCustomer(r.customerKey || r.customerTier, 'sync', { scope: 'live' }); }
  res.json({ ok: true, loc: req.supplier.loc });
});

app.post('/api/supplier/ride/status', supplierAuth, (req, res) => {
  const r = db.data.rides.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!r) return res.status(404).json({ error: 'Rit niet gevonden.' });
  if (r.status === 'wacht-op-betaling') return res.status(409).json({ error: 'Deze rit is nog niet betaald.' });
  let status = String(req.body.status || '');
  if (RIT_LEGACY[status]) status = RIT_LEGACY[status];
  if (status !== 'geweigerd') {
    if (!RIT_KETEN.includes(status)) return res.status(400).json({ error: 'Onbekende status.' });
    // de keten mag alleen vooruit (overslaan mag, teruggaan niet)
    const nu = RIT_KETEN.indexOf(RIT_LEGACY[r.status] || r.status);
    const straks = RIT_KETEN.indexOf(status);
    if (straks <= nu) return res.status(409).json({ error: 'Deze rit is al ' + r.status + '.' });
  } else if (['aan-boord', 'afgerond'].includes(RIT_LEGACY[r.status] || r.status)) {
    return res.status(409).json({ error: 'Een lopende of afgeronde rit kan niet meer geweigerd worden.' });
  }
  ritVerder(req, res, r, status);
});

app.post('/api/supplier/ride/suggest', supplierAuth, (req, res) => {
  const r = db.data.rides.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!r) return res.status(404).json({ error: 'Rit niet gevonden.' });
  const { drukkeChauffeurs, bezetteVoertuigen } = ritBezetting(req.supplier.code);
  const staff = accounts.listStaff(req.supplier.code);
  const rijders = staff.filter(m => /chauffeur|piloot|pilot|crew|centrale|operations/i.test(m.func || ''));
  const pool = rijders.length ? rijders : staff;
  const chauffeur = pool.find(m => !drukkeChauffeurs.has(m.id)) || null;
  const voertuig = (req.supplier.fleet || []).find(v => v.active && v.seats >= (r.passengers || 1) && !bezetteVoertuigen.has(v.id))
    || (req.supplier.fleet || []).find(v => v.active && !bezetteVoertuigen.has(v.id)) || null;
  res.json({ ok: true,
    staffId: chauffeur ? chauffeur.id : null, staffName: chauffeur ? chauffeur.name : null,
    vehicleId: voertuig ? voertuig.id : null, vehicleName: voertuig ? voertuig.name : null });
});

app.post('/api/supplier/ride/assign', supplierAuth, (req, res) => {
  const r = db.data.rides.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!r) return res.status(404).json({ error: 'Rit niet gevonden.' });
  if (r.status === 'wacht-op-betaling') return res.status(409).json({ error: 'Deze rit is nog niet betaald.' });
  if (['afgerond', 'geweigerd'].includes(RIT_LEGACY[r.status] || r.status)) return res.status(409).json({ error: 'Deze rit is al afgerond.' });
  const staff = accounts.listStaff(req.supplier.code);
  const wilZelf = req.body.self === true;
  const staffId = wilZelf ? req.actor.staffId : Number(req.body.staffId);
  const m = staff.find(x => x.id === staffId);
  if (!m) return res.status(404).json({ error: 'Deze medewerker kennen we niet.' });
  if (!wilZelf && !req.actor.manager && req.actor.staffId !== staffId)
    return res.status(403).json({ error: 'Alleen een manager wijst ritten aan anderen toe.' });
  const v = (req.supplier.fleet || []).find(x => x.id === String(req.body.vehicleId || '')) || null;
  r.driver = { staffId: m.id, name: m.name };
  r.vehicle = v ? { id: v.id, name: v.name, plate: v.plate, seats: v.seats } : null;
  if ((RIT_LEGACY[r.status] || r.status) === 'aangevraagd') r.status = 'geaccepteerd';
  save();
  broadcastSync([r.customerTier], 'orders');
  sseToCustomer(r.customerKey || r.customerTier, 'sync', { scope: 'live' });
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  notify(r.customerTier, { icon: r.type === 'jet' ? '✈️' : '🚗', title: req.supplier.name,
    body: m.name.split(' ')[0] + ' komt u halen' + (v ? ' in de ' + v.name + ' (' + v.plate + ')' : '') + '.', scope: 'orders' });
  logActivity(req.supplier.code, req.actor, 'wees rit ' + r.ref + ' toe aan ' + m.name + (v ? ' met ' + v.name : ''));
  res.json({ ok: true, ride: r });
});

app.post('/api/supplier/ride/history', supplierAuth, (req, res) => {
  const q = String(req.body.q || '').trim().toLowerCase().slice(0, 60);
  const alle = db.data.rides
    .filter(r => r.supplierCode === req.supplier.code && (r.status === 'afgerond' || r.status === 'gearriveerd'))
    .filter(r => !q || [r.customerCodename, r.ref, r.from, r.to, r.driver && r.driver.name, r.vehicle && r.vehicle.name].join(' ').toLowerCase().includes(q))
    .sort((a, b) => String(b.finishedAt || b.at).localeCompare(String(a.finishedAt || a.at)));
  const per = 25;
  const pages = Math.max(1, Math.ceil(alle.length / per));
  const page = Math.min(pages, Math.max(1, Number(req.body.page) || 1));
  res.json({
    items: alle.slice((page - 1) * per, page * per),
    total: alle.length, page, pages,
    omzet: alle.reduce((s2, r) => s2 + (r.quote || 0), 0)
  });
});

app.get('/api/supplier/rides.csv', (req, res) => {
  const sess = sessionFor(String(req.query.token || ''));
  if (!sess || sess.role !== 'supplier') return res.status(401).end();
  const alle = db.data.rides
    .filter(r => r.supplierCode === sess.code && (r.status === 'afgerond' || r.status === 'gearriveerd'))
    .sort((a, b) => String(b.finishedAt || b.at).localeCompare(String(a.finishedAt || a.at)));
  const esc = factuur.csvCel; // csv-veilig + bescherming tegen formule-injectie
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ritten-' + sess.code.toLowerCase() + '-' + new Date().toISOString().slice(0, 10) + '.csv"');
  res.write('\uFEFF' + ['datum', 'referentie', 'gast', 'van', 'naar', 'km', 'personen', 'prijs', 'chauffeur', 'voertuig'].join(';') + '\n');
  for (const r of alle) {
    res.write([
      String(r.finishedAt || r.at).slice(0, 16).replace('T', ' '), r.ref, r.customerCodename,
      r.from || '', r.to || '', r.km || '', r.passengers || 1,
      (r.quote || 0).toFixed(2).replace('.', ','),
      r.driver ? r.driver.name : '', r.vehicle ? r.vehicle.name : ''
    ].map(esc).join(';') + '\n');
  }
  res.end();
});

app.post('/api/supplier/fleet', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const s = req.supplier;
  s.fleet = s.fleet || [];
  const a = String(req.body.action || '');
  if (a === 'add') {
    const name = schoon(req.body.name, 50), plate = schoon(req.body.plate, 16);
    if (!name) return res.status(400).json({ error: 'Geef het voertuig een naam.' });
    s.fleet.push({ id: 'v' + Date.now().toString(36), name, plate, seats: Math.min(20, Math.max(1, Number(req.body.seats) || 4)), active: true });
  } else if (a === 'remove') {
    s.fleet = s.fleet.filter(v => v.id !== req.body.id);
  } else if (a === 'toggle') {
    const v = s.fleet.find(x => x.id === req.body.id);
    if (v) v.active = !v.active;
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  save();
  sseToSupplier(s.code, 'sync', { scope: 'settings' });
  logActivity(s.code, req.actor, 'werkte de vloot bij');
  res.json({ ok: true, fleet: s.fleet });
});
};
