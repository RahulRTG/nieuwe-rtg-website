/* Supplier-submodule "kamers": Kamers en huishouding: kamers toevoegen/schakelen, housekeeping-status,
   klussen (tickets), lost & found, foto's, de minibar en de slimme deuren.
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



app.post('/api/supplier/room/add', supplierAuth, (req, res) => {
  if (!Array.isArray(req.supplier.rooms)) return res.status(400).json({ error: 'Kamers zijn er alleen voor hotels en appartementen.' });
  const name = schoon(req.body.name, 60);
  const price = Math.max(0, Number(req.body.price) || 0);
  if (!name || !price) return res.status(400).json({ error: 'Vul een kamernaam en prijs in.' });
  const room = { id: crypto.randomBytes(3).toString('hex'), name, desc: String(req.body.desc || '').slice(0, 120), price, available: true, hk: { status: 'schoon' } };
  req.supplier.rooms.push(room);
  save();
  logActivity(req.supplier.code, req.actor, 'voegde kamer "' + name + '" toe');
  broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  res.json({ ok: true, rooms: req.supplier.rooms });
});

app.post('/api/supplier/room/toggle', supplierAuth, (req, res) => {
  const room = (req.supplier.rooms || []).find(r => r.id === req.body.id);
  if (!room) return res.status(404).json({ error: 'Kamer niet gevonden.' });
  room.available = !room.available;
  save();
  logActivity(req.supplier.code, req.actor, 'zette kamer "' + room.name + '" ' + (room.available ? 'aan' : 'uit'));
  broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  res.json({ ok: true, rooms: req.supplier.rooms });
});

app.post('/api/supplier/room/hk', supplierAuth, (req, res) => {
  const room = (req.supplier.rooms || []).find(r => r.id === req.body.id);
  if (!room) return res.status(404).json({ error: 'Kamer niet gevonden.' });
  const status = String(req.body.status || '');
  if (!HK_STATUSES.includes(status)) return res.status(400).json({ error: 'Onbekende status.' });
  setRoomHk(req.supplier, room, status, String(req.body.note || '').trim().slice(0, 140), req.actor);
  res.json({ ok: true, rooms: req.supplier.rooms });
});

/* Kamer is vrij: de overschot-techniek voor het hotel. Housekeeping geeft
   een schone kamer vrij voor vroege check-in; de receptie ziet het direct
   en de gasten-AI kan erop sturen. Elke andere hk-status haalt de vrijgave
   vanzelf weg. */
app.post('/api/supplier/room/vrij', supplierAuth, (req, res) => {
  const room = (req.supplier.rooms || []).find(r => r.id === req.body.id);
  if (!room) return res.status(404).json({ error: 'Kamer niet gevonden.' });
  if (!room.hk || room.hk.status !== 'schoon') return res.status(409).json({ error: 'Alleen een schone kamer kan vrijgegeven worden.' });
  room.vroegVrij = req.body.op === false ? undefined : { at: new Date().toISOString(), door: req.actor.name };
  if (!room.vroegVrij) delete room.vroegVrij;
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'rooms' });
  if (room.vroegVrij) notifySupplier(req.supplier.code, { icon: '\u{1F6CE}️', title: 'Vroege check-in mogelijk', body: room.name + ' is schoon en vrijgegeven door ' + req.actor.name + '.' });
  logActivity(req.supplier.code, req.actor, (room.vroegVrij ? 'gaf ' : 'trok de vrijgave in van ') + room.name + (room.vroegVrij ? ' vrij voor vroege check-in' : ''));
  res.json({ ok: true, rooms: req.supplier.rooms });
});

app.post('/api/supplier/ticket/add', supplierAuth, (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 160);
  if (!text) return res.status(400).json({ error: 'Omschrijf de klus.' });
  const t = addTicket(req.supplier.code, req.actor, text, String(req.body.room || '').slice(0, 60) || null);
  save();
  logActivity(req.supplier.code, req.actor, 'meldde een klus: ' + text.slice(0, 60));
  sseToSupplier(req.supplier.code, 'sync', { scope: 'rooms' });
  res.json({ ok: true, ticket: t });
});

app.post('/api/supplier/ticket/status', supplierAuth, (req, res) => {
  const t = (db.data.tickets[req.supplier.code] || []).find(x => x.id === req.body.id);
  if (!t) return res.status(404).json({ error: 'Klus niet gevonden.' });
  const status = ['open', 'bezig', 'klaar'].includes(req.body.status) ? req.body.status : 'open';
  t.status = status;
  if (status === 'bezig') { t.by = req.actor.name; }
  if (status === 'klaar') { t.doneBy = req.actor.name; t.doneAt = new Date().toISOString(); }
  save();
  logActivity(req.supplier.code, req.actor, (status === 'klaar' ? 'rondde een klus af: ' : status === 'bezig' ? 'pakte een klus op: ' : 'heropende een klus: ') + t.text.slice(0, 60));
  sseToSupplier(req.supplier.code, 'sync', { scope: 'rooms' });
  res.json({ ok: true, ticket: t });
});

app.post('/api/supplier/lost/add', supplierAuth, (req, res) => {
  const item = String(req.body.item || '').trim().slice(0, 100);
  if (!item) return res.status(400).json({ error: 'Omschrijf het voorwerp.' });
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    item, room: String(req.body.room || '').slice(0, 60) || null,
    storage: String(req.body.storage || '').trim().slice(0, 80) || null,
    status: 'bewaard', by: req.actor.name, at: new Date().toISOString()
  };
  const list = db.data.lostfound[req.supplier.code] = (db.data.lostfound[req.supplier.code] || []);
  list.unshift(entry);
  db.data.lostfound[req.supplier.code] = list.slice(0, 120);
  save();
  logActivity(req.supplier.code, req.actor, 'registreerde een gevonden voorwerp: ' + item + (entry.room ? ' (' + entry.room + ')' : ''));
  sseToSupplier(req.supplier.code, 'sync', { scope: 'rooms' });
  res.json({ ok: true, entry });
});

app.post('/api/supplier/lost/done', supplierAuth, (req, res) => {
  const e = (db.data.lostfound[req.supplier.code] || []).find(x => x.id === req.body.id);
  if (e) {
    e.status = 'opgehaald'; e.doneBy = req.actor.name; e.doneAt = new Date().toISOString();
    save();
    logActivity(req.supplier.code, req.actor, 'gaf een gevonden voorwerp mee: ' + e.item);
    sseToSupplier(req.supplier.code, 'sync', { scope: 'rooms' });
  }
  res.json({ ok: true });
});

app.post('/api/supplier/room/remove', supplierAuth, (req, res) => {
  const i = (req.supplier.rooms || []).findIndex(r => r.id === req.body.id);
  if (i >= 0) {
    logActivity(req.supplier.code, req.actor, 'verwijderde kamer "' + req.supplier.rooms[i].name + '"');
    req.supplier.rooms.splice(i, 1);
    save();
    broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  }
  res.json({ ok: true, rooms: req.supplier.rooms || [] });
});

app.post('/api/supplier/photo/add', express.json({ limit: '6mb' }), supplierAuth, async (req, res) => {
  const img = String(req.body.image || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(img)) return res.status(400).json({ error: 'Alleen JPG, PNG of WebP.' });
  if (img.length > 1.5 * 1024 * 1024) return res.status(413).json({ error: 'Foto te groot (max ~1 MB).' });
  req.supplier.photos = req.supplier.photos || [];
  if (req.supplier.photos.length >= 6) return res.status(409).json({ error: 'Maximaal 6 foto\'s. Verwijder er eerst een.' });
  // Bewaar de foto in de mediastore (schijf of S3); in db.data komt alleen de /media-URL.
  const ref = await media.bewaarPubliek(img, 1.5 * 1024 * 1024);
  if (!ref) return res.status(400).json({ error: 'Foto kon niet worden opgeslagen.' });
  req.supplier.photos.push(ref);
  save();
  logActivity(req.supplier.code, req.actor, 'plaatste een foto op de pagina');
  broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  res.json({ ok: true, count: req.supplier.photos.length });
});

app.post('/api/supplier/photo/remove', supplierAuth, (req, res) => {
  const i = parseInt(req.body.index, 10);
  if (req.supplier.photos && i >= 0 && i < req.supplier.photos.length) {
    req.supplier.photos.splice(i, 1);
    save();
    logActivity(req.supplier.code, req.actor, 'verwijderde een foto van de pagina');
    broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  }
  res.json({ ok: true, count: (req.supplier.photos || []).length });
});

app.post('/api/supplier/minibar/count', supplierAuth, (req, res) => {
  if (!Array.isArray(req.supplier.minibar)) return res.status(400).json({ error: 'Minibar is er alleen voor hotels en appartementen.' });
  const room = String(req.body.room || '').slice(0, 60);
  if (!room) return res.status(400).json({ error: 'Kies een kamer.' });
  const wanted = Array.isArray(req.body.items) ? req.body.items : [];
  const items = [];
  let total = 0;
  for (const w of wanted) {
    const m = req.supplier.minibar.find(x => x.id === w.id);
    const qty = Math.min(20, Math.max(0, parseInt(w.qty, 10) || 0));
    if (m && qty > 0) { items.push({ name: m.name, qty, price: m.price }); total += m.price * qty; }
  }
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    room, actor: req.actor.name, items, total,
    at: new Date().toISOString()
  };
  const list = db.data.minibarCounts[req.supplier.code] = (db.data.minibarCounts[req.supplier.code] || []);
  list.unshift(entry);
  db.data.minibarCounts[req.supplier.code] = list.slice(0, 300);
  // verbruik automatisch als kamerlast op de rekening (komt mee bij check-out)
  if (total > 0) {
    const sale = {
      id: crypto.randomBytes(4).toString('hex'),
      bon: pickupCode(),
      actor: req.actor.name,
      desc: 'Minibar: ' + items.map(i => i.qty + 'x ' + i.name).join(', '),
      room, items, total, method: 'kamer',
      at: new Date().toISOString()
    };
    const sales = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
    sales.unshift(sale);
    db.data.posSales[req.supplier.code] = sales.slice(0, 300);
  }
  save();
  logActivity(req.supplier.code, req.actor, 'telde de minibar van ' + room + (total > 0 ? ': € ' + total + ' verbruik, aanvullen: ' + items.map(i => i.qty + 'x ' + i.name).join(', ') : ': niets gebruikt'));
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  res.json({ ok: true, entry, charged: total });
});

app.post('/api/supplier/minibar/item/add', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return; // de minibar-catalogus is voor het management
  if (!Array.isArray(req.supplier.minibar)) return res.status(400).json({ error: 'Minibar is er alleen voor hotels en appartementen.' });
  const name = schoon(req.body.name, 60);
  const price = Math.max(0, Number(req.body.price) || 0);
  if (!name || !price) return res.status(400).json({ error: 'Vul een artikel en prijs in.' });
  req.supplier.minibar.push({ id: crypto.randomBytes(3).toString('hex'), name, price });
  save();
  logActivity(req.supplier.code, req.actor, 'zette "' + name + '" in de minibar-catalogus');
  res.json({ ok: true, minibar: req.supplier.minibar });
});

app.post('/api/supplier/minibar/item/remove', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return; // de minibar-catalogus is voor het management
  const i = (req.supplier.minibar || []).findIndex(x => x.id === req.body.id);
  if (i >= 0) { req.supplier.minibar.splice(i, 1); save(); }
  res.json({ ok: true, minibar: req.supplier.minibar || [] });
});

app.post('/api/supplier/door/toggle', supplierAuth, (req, res) => {
  const door = (req.supplier.doors || []).find(d => d.id === req.body.id);
  if (!door) return res.status(404).json({ error: 'Deur niet gevonden.' });
  if (door.locked) {
    unlockDoor(req.supplier, door, req.actor.name);
    logActivity(req.supplier.code, req.actor, 'opende "' + door.name + '" op afstand');
  } else {
    door.locked = true;
    door.lastBy = req.actor.name;
    door.lastAt = new Date().toISOString();
    save();
    logActivity(req.supplier.code, req.actor, 'vergrendelde "' + door.name + '"');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'doors' });
  }
  res.json({ ok: true, doors: req.supplier.doors });
});

};
