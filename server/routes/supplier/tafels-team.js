/* Supplier-submodule "tafels-team": Tafels en team: tafelstatussen en -beheer, de team-buzz, de security-knop
   en verlofbesluiten.
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



app.post('/api/supplier/table/status', supplierAuth, (req, res) => {
  const t = (req.supplier.tables || []).find(x => x.id === req.body.id);
  if (!t) return res.status(404).json({ error: 'Tafel niet gevonden.' });
  const status = String(req.body.status || '');
  if (!TABLE_STATUSES.includes(status)) return res.status(400).json({ error: 'Onbekende status.' });
  t.status = status;
  save();
  logActivity(req.supplier.code, req.actor, 'zette ' + t.name + ' op "' + status + '"');
  broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'tables' });
  res.json({ ok: true, tables: req.supplier.tables });
});

app.post('/api/supplier/table/add', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const name = String(req.body.name || '').trim().slice(0, 40);
  const seats = Math.min(20, Math.max(1, parseInt(req.body.seats, 10) || 2));
  if (!name) return res.status(400).json({ error: 'Geef de tafel een naam.' });
  req.supplier.tables = req.supplier.tables || [];
  req.supplier.tables.push({ id: crypto.randomBytes(3).toString('hex'), name, seats, status: 'vrij' });
  save();
  logActivity(req.supplier.code, req.actor, 'voegde ' + name + ' toe (' + seats + ' pers.)');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'tables' });
  res.json({ ok: true, tables: req.supplier.tables });
});

app.post('/api/supplier/table/remove', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const i = (req.supplier.tables || []).findIndex(x => x.id === req.body.id);
  if (i >= 0) {
    logActivity(req.supplier.code, req.actor, 'verwijderde ' + req.supplier.tables[i].name);
    req.supplier.tables.splice(i, 1);
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'tables' });
  }
  res.json({ ok: true, tables: req.supplier.tables || [] });
});

app.post('/api/supplier/team/buzz', supplierAuth, (req, res) => {
  const all = req.body.all === true;
  const target = req.body.staffId == null ? null : Number(req.body.staffId);
  let name = 'Beheer';
  if (!all && target != null) {
    const st = accounts.getStaffById(target);
    if (!st || String(st.supplier_code).toUpperCase() !== req.supplier.code) return res.status(404).json({ error: 'Teamlid niet gevonden.' });
    name = st.name;
  }
  let reached = 0;
  for (const c of sseClients) {
    if (c.sup !== req.supplier.code) continue;
    if (all) {
      // iedereen behalve de oproeper zelf
      if (c.staffId === (req.actor.staffId != null ? req.actor.staffId : null)) continue;
      sseSend(c.res, 'buzz', { from: req.actor.name, all: true }); reached++;
    } else if (target == null ? c.staffId == null : c.staffId === target) {
      sseSend(c.res, 'buzz', { from: req.actor.name }); reached++;
    }
  }
  logActivity(req.supplier.code, req.actor, all ? 'riep het hele team op (tril)' : 'riep ' + name + ' op (tril)');
  res.json({ ok: true, reached, name: all ? 'het hele team' : name });
});

app.post('/api/supplier/security', supplierAuth, (req, res) => {
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  const loc = (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng }
    : (req.supplier.loc ? { lat: req.supplier.loc.lat, lng: req.supplier.loc.lng } : null);
  const alarm = {
    from: req.actor.name,
    company: req.supplier.name,
    note: String(req.body.note || '').trim().slice(0, 140),
    loc, label: req.supplier.loc ? req.supplier.loc.label : null,
    at: new Date().toISOString()
  };
  logActivity(req.supplier.code, req.actor, 'SECURITY-ALARM' + (alarm.note ? ': ' + alarm.note : '') + (loc ? ' (locatie gedeeld)' : ''));
  notifySupplier(req.supplier.code, { icon: '🚨', title: 'NOODOPROEP ' + req.actor.name, body: (alarm.note || 'Directe assistentie nodig.') + (alarm.label ? ' Locatie: ' + alarm.label : '') });
  for (const c of sseClients) if (c.sup === req.supplier.code) sseSend(c.res, 'alarm', alarm);
  sseToOffice('notify', { icon: '🚨', title: 'Noodoproep bij ' + req.supplier.name, body: req.actor.name + (alarm.note ? ': ' + alarm.note : ' vraagt directe assistentie.') + (loc ? ' Locatie: ' + (alarm.label || lat.toFixed ? loc.lat.toFixed(4) + ', ' + loc.lng.toFixed(4) : '') : '') });
  res.json({ ok: true, alarm });
});

app.post('/api/supplier/leave/decide', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const v = (db.data.verlof[req.supplier.code] || []).find(x => x.id === req.body.id);
  if (!v) return res.status(404).json({ error: 'Aanvraag niet gevonden.' });
  if (v.status !== 'nieuw') return res.status(409).json({ error: 'Deze aanvraag is al behandeld.' });
  v.status = req.body.action === 'goedkeuren' ? 'goedgekeurd' : 'afgewezen';
  v.decidedBy = req.actor.name;
  save();
  logActivity(req.supplier.code, req.actor, (v.status === 'goedgekeurd' ? 'keurde verlof goed van ' : 'wees verlof af van ') + v.name);
  sseToSupplier(req.supplier.code, 'sync', { scope: 'verlof' });
  res.json({ ok: true, entry: v });
});

};
