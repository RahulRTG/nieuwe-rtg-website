/* Supplier-events (deelmodule): events aanmaken, gastenlijst/check-in en de runsheet (incl. AI-voorstel).
   Draait op de gedeelde kern; gemount vanuit routes/supplier/events.js. */
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
  const { dagContext } = require('../../../kern/context');

app.post('/api/supplier/event', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!Array.isArray(s.events)) return res.status(400).json({ error: 'Events zijn er voor restaurants, bars en clubs.' });
  const a = String(req.body.action || '');
  if (a === 'add') {
    const name = String((req.body.event || {}).name || '').trim().slice(0, 80);
    const date = String((req.body.event || {}).date || '').slice(0, 10);
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Vul minimaal een naam en datum in.' });
    const e = {
      id: crypto.randomBytes(4).toString('hex'),
      name, date,
      time: String((req.body.event || {}).time || '').slice(0, 5),
      desc: String((req.body.event || {}).desc || '').trim().slice(0, 200),
      capacity: Math.min(2000, Math.max(1, parseInt((req.body.event || {}).capacity, 10) || 50)),
      price: Math.max(0, Number((req.body.event || {}).price) || 0),
      published: false, guests: [], runsheet: [],
      catering: { mode: 'geen', itemIds: [], note: '' }, allergies: [],
      at: new Date().toISOString()
    };
    s.events.unshift(e);
    s.events = s.events.slice(0, 40);
    logActivity(s.code, req.actor, 'maakte event "' + name + '" aan');
  } else {
    const e = s.events.find(x => x.id === req.body.id);
    if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
    if (a === 'publish') { e.published = !e.published; logActivity(s.code, req.actor, (e.published ? 'publiceerde' : 'haalde offline') + ' event "' + e.name + '"'); }
    else if (a === 'remove') { s.events = s.events.filter(x => x.id !== req.body.id); logActivity(s.code, req.actor, 'verwijderde event "' + e.name + '"'); }
    else return res.status(400).json({ error: 'Onbekende actie.' });
  }
  save();
  broadcastSync(['rtg', 'lifestyle', 'business'], 'events');
  sseToSupplier(s.code, 'sync', { scope: 'events' });
  res.json({ ok: true, events: s.events });
});

app.post('/api/supplier/event/checkin', supplierAuth, (req, res) => {
  const e = (req.supplier.events || []).find(x => x.id === req.body.eventId);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  const g = (e.guests || []).find(x => x.key === req.body.key);
  if (!g) return res.status(404).json({ error: 'Gast niet gevonden.' });
  g.checkedIn = !g.checkedIn;
  save();
  logActivity(req.supplier.code, req.actor, (g.checkedIn ? 'checkte ' : 'zette check-in terug voor ') + g.codename + ' in bij "' + e.name + '"');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e });
});

app.post('/api/supplier/event/runsheet', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  e.runsheet = e.runsheet || [];
  if (req.body.action === 'add') {
    const it = req.body.item || {};
    if (!String(it.text || '').trim()) return res.status(400).json({ error: 'Omschrijf wat er moet gebeuren.' });
    e.runsheet.push(runItem(it.time, it.station, it.text, it.daysBefore));
    if (e.runsheet.length > 60) e.runsheet = e.runsheet.slice(0, 60);
    sortRunsheet(e);
  } else if (req.body.action === 'remove') {
    e.runsheet = e.runsheet.filter(x => x.id !== req.body.itemId);
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e });
});

app.post('/api/supplier/event/runsheet/done', supplierAuth, (req, res) => {
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  const it = e && (e.runsheet || []).find(x => x.id === req.body.itemId);
  if (!it) return res.status(404).json({ error: 'Regel niet gevonden.' });
  it.done = !it.done;
  it.doneBy = it.done ? req.actor.name : null;
  save();
  if (it.done) logActivity(req.supplier.code, req.actor, 'vinkte af: ' + it.time + ' ' + it.text + ' (' + e.name + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e });
});

app.post('/api/supplier/event/runsheet/ai', supplierAuth, async (req, res) => {
  if (!managerOnly(req, res)) return;
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  const mode = req.body.mode === 'import' ? 'import' : 'suggest';
  let items = null;
  if (anthropic) {
    try {
      const prompt = mode === 'import'
        ? 'Zet dit geplakte draaiboek om naar JSON. Bron:\n' + String(req.body.text || '').slice(0, 4000)
        : 'Stel een professioneel horeca-draaiboek op voor dit event: "' + e.name + '" op ' + e.date + (e.time ? ' om ' + e.time : '') + (e.desc ? ' (' + e.desc + ')' : '') + ', capaciteit ' + e.capacity + '.';
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 1200,
        system: 'Je bent een horeca-draaiboekplanner. Antwoord UITSLUITEND met een JSON-array van objecten {"time":"HH:MM","station":"keuken|bar|bediening|party|alle","text":"..."}. Maximaal 20 regels, Nederlands, praktisch en concreet. party = de party manager/deur.',
        messages: [{ role: 'user', content: prompt }]
      });
      const raw = (msg.content[0].text.match(/\[[\s\S]*\]/) || [null])[0];
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) items = arr.slice(0, 20).map(x => runItem(x.time, x.station, x.text));
    } catch (err) { items = null; }
  }
  if (!items) items = mode === 'import' ? parseRunsheetText(req.body.text) : fallbackRunsheet(e);
  if (!items.length) return res.status(400).json({ error: 'Geen bruikbare regels gevonden. Zet per regel een tijd en een taak.' });
  e.runsheet = [...(e.runsheet || []), ...items].slice(0, 60);
  sortRunsheet(e);
  save();
  logActivity(req.supplier.code, req.actor, (mode === 'import' ? 'importeerde' : 'liet de AI een') + ' draaiboek ' + (mode === 'import' ? 'voor' : 'opstellen voor') + ' "' + e.name + '" (' + items.length + ' regels)');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e, added: items.length, ai: !!anthropic });
});

};
