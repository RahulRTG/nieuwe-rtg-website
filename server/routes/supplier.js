/* Domein "supplier" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { ALT_IDEE, BOEK_KETEN, DEMO_SUPPLIER, HK_STATUSES, LANDEN, POS_METHODS, RIT_KETEN, RIT_LEGACY, TABLE_STATUSES, VAC_SOORTEN, ZAAK_OPTIES, accounts, addTicket, aiFindDoor, aiFindRoom, alcoholGrensVan, anthropic, app, applyChatPubliek, auth, broadcastSync, cannedBoekhouder, cateringDishes, chatStuur, checkCred, coachCache, coachRules, crypto, db, ensureApplyChat, eventCovers, express, fallbackRunsheet, financeVoor, findSupplier, gcCode, geborenVan, guestsFor, hasCred, i18n, ledenPrijs, leeftijdVan, logActivity, keyVanCodenaam, magBezorgen, haversine, etaMinutes, ticketsVoorSlot, loginFails, managerOnly, noteFailedTry, notify, notifyApplicant, notifySupplier, parseRunsheetText, pickupCode, pinFails, posDay, publicSupplier, pushLive, rememberSession, ritBezetting, ritVerder, runItem, salonNaarVolgers, save, scheduleFor, schoon, sectiesForOrder, sessionFor, setRoomHk, sortRunsheet, sseClients, sseSend, sseToCustomer, sseToOffice, sseToSupplier, stationsForOrder, supplierAuth, supplierState, tooManyTries, trChat, unlockDoor, weekdagFactor } = kern;

app.post('/api/supplier/login', async (req, res) => {
  let s, actor;
  if (req.body.staffId != null) {
    // Persoonlijke personeelslogin met PIN, binnen het bedrijfsaccount.
    s = findSupplier(req.body.code);
    if (!s) return res.status(404).json({ error: 'Deze leverancierscode kennen we niet.' });
    const fk = s.code + ':' + req.body.staffId;
    const fail = pinFails.get(fk);
    if (fail && fail.until > Date.now())
      return res.status(429).json({ error: 'Te veel foute pogingen. Wacht een minuut en probeer het opnieuw.' });
    const staff = await accounts.verifyStaffPin(Number(req.body.staffId), req.body.pin);
    if (!staff || String(staff.supplier_code).toUpperCase() !== s.code) {
      const n = ((fail && fail.n) || 0) + 1;
      pinFails.set(fk, n >= 5 ? { n: 0, until: Date.now() + 60000 } : { n, until: 0 });
      return res.status(401).json({ error: 'Onjuiste PIN.' });
    }
    pinFails.delete(fk);
    actor = { name: staff.name, role: staff.role, staffId: staff.id, manager: staff.role === 'manager' };
  } else if (hasCred(req.body)) {
    const bucket = 'sup:' + req.ip;
    if (tooManyTries(res, bucket)) return;
    if (!checkCred(req.body.username, req.body.password)) {
      noteFailedTry(bucket);
      return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord.' });
    }
    loginFails.delete(bucket);
    s = findSupplier(DEMO_SUPPLIER);
    actor = { name: 'Beheer', role: 'manager', manager: true };
  } else {
    // Geen anonieme toegang meer met alleen de bedrijfscode: iedereen logt in op
    // de eigen naam met een persoonlijke pincode (of het bedrijfsaccount met
    // gebruikersnaam en wachtwoord). Zo staat elke handeling op een persoon.
    return res.status(401).json({ error: 'Kies wie u bent en voer uw persoonlijke pincode in.' });
  }
  if (!s) return res.status(404).json({ error: 'Deze leverancierscode kennen we niet.' });
  const token = crypto.randomBytes(24).toString('hex');
  rememberSession(token, { role: 'supplier', code: s.code, actor: actor.name, staffId: actor.staffId, staffRole: actor.role, manager: actor.manager });
  logActivity(s.code, actor, actor.name + ' logde in');
  res.json({ token, state: supplierState(s, actor) });
});

app.post('/api/supplier/roster', (req, res) => {
  const s = findSupplier(req.body.code);
  if (!s) return res.status(404).json({ error: 'Deze leverancierscode kennen we niet.' });
  res.json({ supplier: { code: s.code, name: s.name, type: s.type }, staff: accounts.listStaff(s.code).map(accounts.publicStaff) });
});

app.post('/api/supplier/staff/add', supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan personeel toevoegen.' });
  const name = schoon(req.body.name, 60);
  if (!name) return res.status(400).json({ error: 'Vul een naam in.' });
  const pin = accounts.makePin();
  const staff = await accounts.createStaff({ supplierCode: req.supplier.code, name, role: req.body.role === 'manager' ? 'manager' : 'staff', func: String(req.body.func || '').slice(0, 40) || null, pin });
  logActivity(req.supplier.code, req.actor, req.actor.name + ' voegde ' + name + ' toe aan het team');
  res.json({ ok: true, staff: accounts.publicStaff(staff), pin });
});

app.post('/api/supplier/staff/remove', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan personeel verwijderen.' });
  const st = accounts.getStaffById(Number(req.body.staffId));
  if (st && String(st.supplier_code).toUpperCase() === req.supplier.code) {
    accounts.deactivateStaff(st.id);
    logActivity(req.supplier.code, req.actor, req.actor.name + ' verwijderde ' + st.name + ' uit het team');
  }
  res.json({ ok: true, staff: accounts.listStaff(req.supplier.code).map(accounts.publicStaff) });
});

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

app.post('/api/supplier/photo/add', express.json({ limit: '6mb' }), supplierAuth, (req, res) => {
  const img = String(req.body.image || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(img)) return res.status(400).json({ error: 'Alleen JPG, PNG of WebP.' });
  if (img.length > 1.5 * 1024 * 1024) return res.status(413).json({ error: 'Foto te groot (max ~1 MB).' });
  req.supplier.photos = req.supplier.photos || [];
  if (req.supplier.photos.length >= 6) return res.status(409).json({ error: 'Maximaal 6 foto\'s. Verwijder er eerst een.' });
  req.supplier.photos.push(img);
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

app.post('/api/supplier/salon/post', express.json({ limit: '6mb' }), supplierAuth, (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 600);
  if (!text) return res.status(400).json({ error: 'Schrijf eerst een tekst.' });
  let photo = null;
  const pi = parseInt(req.body.photoIndex, 10);
  if (Number.isInteger(pi) && req.supplier.photos && req.supplier.photos[pi]) photo = req.supplier.photos[pi];
  else if (typeof req.body.image === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(req.body.image) && req.body.image.length <= 1.5 * 1024 * 1024) photo = req.body.image;
  const post = {
    id: Date.now(),
    author: req.supplier.name, tier: 'partner', partner: true, partnerCode: req.supplier.code,
    place: req.supplier.city, visual: null, photo,
    text, lang: req.body.lang === 'en' ? 'en' : 'nl',
    at: new Date().toISOString(),
    baseLikes: 0, likedBy: {}, comments: []
  };
  db.data.posts.unshift(post);
  db.data.posts = db.data.posts.slice(0, 60);
  save();
  logActivity(req.supplier.code, req.actor, 'publiceerde op De Salon');
  salonNaarVolgers(req.supplier, text);
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  sseToOffice('sync', { scope: 'salon' });
  res.json({ ok: true, postId: post.id });
});

app.post('/api/supplier/salon/deal', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const titel = schoon(req.body.titel, 80);
  const text = schoon(req.body.text, 400);
  if (!titel || !text) return res.status(400).json({ error: 'Geef de aanbieding een titel en een tekst.' });
  const geldigTot = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.geldigTot || '')) ? req.body.geldigTot : null;
  const post = {
    id: Date.now(),
    author: req.supplier.name, tier: 'partner', partner: true, partnerCode: req.supplier.code,
    place: req.supplier.city, visual: null, photo: null,
    text, lang: 'nl', at: new Date().toISOString(), baseLikes: 0, likedBy: {}, comments: [],
    deal: { titel, geldigTot, claims: [] }
  };
  db.data.posts.unshift(post);
  db.data.posts = db.data.posts.slice(0, 60);
  save();
  logActivity(req.supplier.code, req.actor, 'zette een aanbieding op De Salon: "' + titel + '"');
  salonNaarVolgers(req.supplier, '🎁 ' + titel);
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true, postId: post.id });
});

app.post('/api/supplier/salon/deal/redeem', supplierAuth, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  for (const p of db.data.posts) {
    if (!p.deal || p.partnerCode !== req.supplier.code) continue;
    const claim = p.deal.claims.find(c => c.code === code);
    if (claim) {
      if (claim.used) return res.status(409).json({ error: 'Deze code is al verzilverd.' });
      claim.used = true;
      claim.usedAt = new Date().toISOString();
      save();
      logActivity(req.supplier.code, req.actor, 'verzilverde aanbiedingscode ' + code + ' (' + claim.codename + ')');
      return res.json({ ok: true, titel: p.deal.titel, codename: claim.codename });
    }
  }
  res.status(404).json({ error: 'Deze code kennen we hier niet.' });
});

app.post('/api/supplier/salon/poll', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const vraag = schoon(req.body.vraag, 140);
  const opties = (Array.isArray(req.body.opties) ? req.body.opties : []).map(o => schoon(o, 60)).filter(Boolean).slice(0, 4);
  if (!vraag || opties.length < 2) return res.status(400).json({ error: 'Geef een vraag en minstens twee opties.' });
  const post = {
    id: Date.now(),
    author: req.supplier.name, tier: 'partner', partner: true, partnerCode: req.supplier.code,
    place: req.supplier.city, visual: null, photo: null,
    text: vraag, lang: 'nl', at: new Date().toISOString(), baseLikes: 0, likedBy: {}, comments: [],
    poll: { vraag, opties: opties.map(t2 => ({ tekst: t2, stemmen: [] })) }
  };
  db.data.posts.unshift(post);
  db.data.posts = db.data.posts.slice(0, 60);
  save();
  logActivity(req.supplier.code, req.actor, 'zette een poll op De Salon');
  salonNaarVolgers(req.supplier, '📊 ' + vraag);
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true, postId: post.id });
});

app.post('/api/supplier/salon/bio', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  req.supplier.salon = req.supplier.salon || { bio: '', volgers: [], sinds: new Date().toISOString() };
  req.supplier.salon.bio = schoon(req.body.bio, 200);
  save();
  logActivity(req.supplier.code, req.actor, 'werkte het Salon-profiel bij');
  res.json({ ok: true, salon: { bio: req.supplier.salon.bio, volgers: req.supplier.salon.volgers.length } });
});

app.post('/api/supplier/salon/stats', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const s = req.supplier;
  const eigen = db.data.posts.filter(p => p.partnerCode === s.code);
  const likes = eigen.reduce((n, p) => n + p.baseLikes + Object.keys(p.likedBy).length, 0);
  const reacties = eigen.reduce((n, p) => n + p.comments.length, 0);
  res.json({
    volgers: (s.salon && s.salon.volgers.length) || 0,
    bio: (s.salon && s.salon.bio) || '',
    posts: eigen.length, likes, reacties,
    deals: eigen.filter(p => p.deal).map(p => ({
      titel: p.deal.titel, geldigTot: p.deal.geldigTot,
      claims: p.deal.claims.length, verzilverd: p.deal.claims.filter(c => c.used).length
    })),
    polls: eigen.filter(p => p.poll).map(p => ({
      vraag: p.poll.vraag,
      opties: p.poll.opties.map(o => ({ tekst: o.tekst, stemmen: o.stemmen.length }))
    }))
  });
});

app.post('/api/supplier/pos/sale', supplierAuth, (req, res) => {
  const total = Number(req.body.total);
  if (!(total > 0) || total > 100000) return res.status(400).json({ error: 'Geen geldig bedrag.' });
  const method = POS_METHODS.includes(req.body.method) ? req.body.method : 'pin';
  const items = Array.isArray(req.body.items)
    ? req.body.items.slice(0, 40).map(i => ({ name: String(i.name || '').slice(0, 80), qty: Math.max(1, parseInt(i.qty, 10) || 1), price: Math.max(0, Number(i.price) || 0) }))
    : null;
  const sale = {
    id: crypto.randomBytes(4).toString('hex'),
    bon: pickupCode(),
    actor: req.actor.name,
    desc: String(req.body.desc || '').slice(0, 140),
    room: req.body.room ? String(req.body.room).slice(0, 60) : null,
    items, total, method,
    at: new Date().toISOString()
  };
  const list = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
  list.unshift(sale);
  db.data.posSales[req.supplier.code] = list.slice(0, 300);
  save();
  logActivity(req.supplier.code, req.actor, 'rekende € ' + total + ' af (' + method + (sale.room ? ', ' + sale.room : '') + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  res.json({ ok: true, sale });
});

app.post('/api/supplier/pos/redeem', supplierAuth, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Voer een ophaalcode in.' });
  const o = db.data.orders.find(x => x.supplierCode === req.supplier.code && x.pickup === code);
  if (!o) return res.status(404).json({ error: 'Onbekende code voor dit bedrijf.' });
  if (o.refunded || o.status === 'geweigerd') return res.status(409).json({ error: 'Deze bestelling is geannuleerd.' });
  if (o.status === 'geserveerd') return res.status(409).json({ error: 'Code ' + code + ' is al uitgegeven.' });
  const wasPaid = o.paid;
  let sale = null;
  if (!o.paid) {
    // afrekenen via RTG-lidmaatschap; komt als omzet in het dagoverzicht
    o.paid = true;
    sale = {
      id: crypto.randomBytes(4).toString('hex'),
      bon: pickupCode(),
      actor: req.actor.name,
      desc: 'RTG-code ' + code + ' (' + o.ref + ')',
      room: null,
      items: o.items, total: o.total, method: 'rtg',
      at: new Date().toISOString()
    };
    const list = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
    list.unshift(sale);
    db.data.posSales[req.supplier.code] = list.slice(0, 300);
  }
  o.status = 'geserveerd';
  save();
  logActivity(req.supplier.code, req.actor, 'gaf bestelling ' + o.ref + ' uit op code ' + code + (wasPaid ? '' : ' en rekende € ' + o.total + ' af (RTG)'));
  broadcastSync([o.customerTier], 'orders');
  sseToCustomer(o.customerKey || o.customerTier, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  notify(o.customerTier, { icon: '✨', title: req.supplier.name, body: 'Uw bestelling is uitgegeven. Veel plezier.', scope: 'orders' });
  res.json({ ok: true, order: { ref: o.ref, codename: o.customerCodename, items: o.items, total: o.total, wasPaid }, sale });
});

app.post('/api/supplier/pos/checkout', supplierAuth, (req, res) => {
  const room = String(req.body.room || '').slice(0, 60);
  const method = ['pin', 'contant'].includes(req.body.method) ? req.body.method : 'pin';
  const list = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
  const open = list.filter(s => s.method === 'kamer' && !s.settled && s.room === room);
  if (!open.length) return res.status(404).json({ error: 'Geen open kamerlasten voor deze kamer.' });
  let total = 0;
  for (const s of open) { s.settled = true; total += s.total; }
  const sale = {
    id: crypto.randomBytes(4).toString('hex'),
    bon: pickupCode(),
    actor: req.actor.name,
    desc: 'Check-out ' + room + ' (' + open.length + ' post(en))',
    room, items: null, total, method,
    at: new Date().toISOString()
  };
  list.unshift(sale);
  db.data.posSales[req.supplier.code] = list.slice(0, 300);
  // na het uitchecken staat de kamer automatisch op "vuil" voor housekeeping
  const rm = (req.supplier.rooms || []).find(r => r.name === room);
  if (rm) rm.hk = { status: 'vuil', by: 'Systeem (check-out)', at: new Date().toISOString() };
  save();
  logActivity(req.supplier.code, req.actor, 'checkte ' + room + ' uit: € ' + total + ' (' + method + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  res.json({ ok: true, sale });
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

app.post('/api/supplier/chat/send', supplierAuth, (req, res) => {
  const chat = db.data.guestChats[String(req.body.key || '')];
  if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Gesprek niet gevonden.' });
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  chat.messages.push({ from: 'partner', who: req.actor.name, text, lang: req.body.lang === 'en' ? 'en' : 'nl', at: new Date().toISOString() });
  chat.messages = chat.messages.slice(-120);
  chat.unreadGuest += 1;
  chat.lastAt = new Date().toISOString();
  save();
  logActivity(req.supplier.code, req.actor, 'antwoordde ' + chat.codename + ' (' + (chat.dept || 'Team') + ')');
  notify(chat.tier, { icon: '💬', title: req.supplier.name + (chat.dept ? ' · ' + chat.dept : ''), body: text.slice(0, 90), scope: 'gchat' });
  sseToCustomer(chat.customerKey, 'sync', { scope: 'gchat' });
  sseToSupplier(req.supplier.code, 'sync', { scope: 'gchat' });
  trChat(chat.messages, req.body.lang === 'en' ? 'en' : 'nl').then(messages => res.json({ ok: true, messages }));
});

app.post('/api/supplier/chat/history', supplierAuth, (req, res) => {
  const chat = db.data.guestChats[String(req.body.key || '')];
  if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Gesprek niet gevonden.' });
  if (chat.unreadPartner) { chat.unreadPartner = 0; save(); }
  trChat(chat.messages, req.body.lang === 'en' ? 'en' : 'nl').then(messages => res.json({ messages, codename: chat.codename }));
});

app.post('/api/supplier/guest/connect', supplierAuth, (req, res) => {
  const codename = String(req.body.codename || '').trim();
  const key = Object.keys(db.data.live).find(k => db.data.live[k].active && db.data.live[k].codename === codename);
  if (!key) return res.status(404).json({ error: 'Deze gast is nu niet live onderweg.' });
  const L = db.data.live[key];
  L.connected = [...new Set([...(L.connected || []), req.supplier.code])];
  save();
  logActivity(req.supplier.code, req.actor, 'verbond met gast ' + codename);
  notify(L.tier, { icon: '🤝', title: req.supplier.name, body: 'Volgt uw aankomst om alles voor u klaar te zetten.', scope: 'live' });
  pushLive(key);
  res.json({ ok: true, guests: guestsFor(req.supplier.code) });
});

app.post('/api/supplier/apply', (req, res) => {
  const s = findSupplier(req.body.code);
  if (!s) return res.status(404).json({ error: 'Bedrijf niet gevonden.' });
  const name = schoon(req.body.name, 60);
  const func = String(req.body.func || '').trim().slice(0, 40);
  const contact = String(req.body.contact || '').trim().slice(0, 80);
  const note = String(req.body.note || '').trim().slice(0, 400);
  if (!name || !func || !contact) return res.status(400).json({ error: 'Vul uw naam, de functie en een telefoonnummer of e-mailadres in.' });
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    name, func, contact, note, status: 'nieuw',
    at: new Date().toISOString()
  };
  const list = db.data.applications[s.code] = (db.data.applications[s.code] || []);
  list.unshift(entry);
  db.data.applications[s.code] = list.slice(0, 100);
  save();
  notifySupplier(s.code, { icon: '📝', title: 'Nieuwe sollicitatie', body: name + ' solliciteert als ' + func + '.' });
  sseToSupplier(s.code, 'sync', { scope: 'team' });
  sseToOffice('sync', { scope: 'team' });
  res.json({ ok: true });
});

app.post('/api/supplier/apply/decide', supplierAuth, async (req, res) => {
  if (!managerOnly(req, res)) return;
  const a = (db.data.applications[req.supplier.code] || []).find(x => x.id === req.body.id);
  if (!a) return res.status(404).json({ error: 'Sollicitatie niet gevonden.' });
  if (req.body.action === 'uitnodigen') {
    // uitnodigen voor een gesprek: open de chat, nog geen personeelsaccount
    a.status = 'uitgenodigd';
    const chat = ensureApplyChat(req.supplier.code, a);
    if (!chat) return res.status(400).json({ error: 'Deze sollicitant heeft geen app-account; neem contact op via het opgegeven telefoonnummer of e-mailadres.' });
    if (!chat.berichten.length) chatStuur(chat, 'werkgever', req.supplier.name, 'Hallo ' + a.name + ', leuk dat je wilt komen werken als ' + a.func + '. Wanneer kun je langskomen voor een kennismaking?');
    save();
    logActivity(req.supplier.code, req.actor, 'nodigde ' + a.name + ' uit voor een gesprek');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
    notifyApplicant(a, req.supplier);
    return res.json({ ok: true, chat: applyChatPubliek(chat) });
  }
  if (req.body.action === 'aannemen') {
    const pin = accounts.makePin();
    const staff = await accounts.createStaff({ supplierCode: req.supplier.code, name: a.name, role: 'staff', func: a.func, pin });
    a.status = 'aangenomen';
    ensureApplyChat(req.supplier.code, a); // ook aangenomen sollicitanten kunnen chatten om af te spreken
    save();
    logActivity(req.supplier.code, req.actor, 'nam ' + a.name + ' aan als ' + a.func);
    sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
    sseToOffice('sync', { scope: 'team' });
    notifyApplicant(a, req.supplier);
    return res.json({ ok: true, staff: accounts.publicStaff(staff), pin });
  }
  a.status = 'afgewezen';
  save();
  logActivity(req.supplier.code, req.actor, 'wees de sollicitatie van ' + a.name + ' af');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
  notifyApplicant(a, req.supplier);
  res.json({ ok: true });
});

app.post('/api/supplier/apply/chat', supplierAuth, (req, res) => {
  const chat = db.data.applyChats[String(req.body.id || '')];
  if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Chat niet gevonden.' });
  res.json({ chat: applyChatPubliek(chat) });
});

app.post('/api/supplier/apply/chat/send', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const chat = db.data.applyChats[String(req.body.id || '')];
  if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Chat niet gevonden.' });
  const m = chatStuur(chat, 'werkgever', req.supplier.name, req.body.text);
  if (!m) return res.status(400).json({ error: 'Typ een bericht.' });
  // de sollicitant krijgt een seintje
  const app = (db.data.applications[req.supplier.code] || []).find(x => x.id === chat.id);
  if (app && app.key && db.data.notifications[app.key])
    notify(app.key, { icon: '💬', title: 'Bericht van ' + chat.bedrijf, body: m.tekst.slice(0, 80) });
  res.json({ chat: applyChatPubliek(chat) });
});

app.post('/api/supplier/vacature', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const b = req.body || {};
  const func = String(b.func || '').trim().slice(0, 60);
  if (!func) return res.status(400).json({ error: 'Geef de functie een naam.' });
  let minLeeftijd = parseInt(b.minLeeftijd, 10);
  if (!Number.isFinite(minLeeftijd) || minLeeftijd < 16) minLeeftijd = 16; // solliciteren mag vanaf 16
  if (minLeeftijd > 99) minLeeftijd = 99;
  const soort = VAC_SOORTEN.includes(b.soort) ? b.soort : 'bijbaan';
  const list = db.data.vacatures[req.supplier.code] = (db.data.vacatures[req.supplier.code] || []);
  const bestaand = b.id ? list.find(v => v.id === b.id) : null;
  const vac = bestaand || { id: crypto.randomBytes(4).toString('hex'), at: new Date().toISOString() };
  vac.func = func;
  vac.omschrijving = String(b.omschrijving || '').trim().slice(0, 500);
  vac.plaats = String(b.plaats || '').trim().slice(0, 60);
  vac.uren = String(b.uren || '').trim().slice(0, 40);
  vac.soort = soort;
  vac.minLeeftijd = minLeeftijd;
  vac.open = b.open !== false;
  if (!bestaand) { list.unshift(vac); db.data.vacatures[req.supplier.code] = list.slice(0, 40); }
  save();
  logActivity(req.supplier.code, req.actor, (bestaand ? 'wijzigde de vacature ' : 'plaatste een vacature ') + func);
  sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
  res.json({ ok: true, vacatures: (db.data.vacatures[req.supplier.code] || []).slice(0, 40) });
});

app.post('/api/supplier/vacature/verwijder', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const list = db.data.vacatures[req.supplier.code] || [];
  const i = list.findIndex(v => v.id === req.body.id);
  if (i < 0) return res.status(404).json({ error: 'Vacature niet gevonden.' });
  const soort = req.body.action === 'sluit' || req.body.action === 'open';
  if (soort) { list[i].open = req.body.action === 'open'; }
  else { list.splice(i, 1); }
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
  res.json({ ok: true, vacatures: list.slice(0, 40) });
});

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

app.post('/api/supplier/event/catering', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  const mode = ['menu', 'alacarte', 'geen'].includes(req.body.mode) ? req.body.mode : 'geen';
  const ids = Array.isArray(req.body.itemIds) ? req.body.itemIds.filter(id => (req.supplier.menu || []).some(m => m.id === id)).slice(0, 20) : [];
  e.catering = { mode, itemIds: mode === 'menu' ? ids : [], note: String(req.body.note || '').slice(0, 200) };
  save();
  logActivity(req.supplier.code, req.actor, 'stelde de eventkeuken in voor "' + e.name + '" (' + (mode === 'menu' ? ids.length + ' gangen' : mode) + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e });
});

app.post('/api/supplier/event/allergy', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  e.allergies = e.allergies || [];
  if (req.body.action === 'add') {
    const allergen = String(req.body.allergen || '').trim().toLowerCase().slice(0, 30);
    if (!allergen) return res.status(400).json({ error: 'Vul het allergeen in.' });
    if (e.allergies.some(a => a.allergen === allergen)) return res.status(409).json({ error: 'Dit allergeen staat er al.' });
    e.allergies.push({ id: crypto.randomBytes(3).toString('hex'), allergen, count: Math.min(500, Math.max(1, parseInt(req.body.count, 10) || 1)), alternative: null });
  } else if (req.body.action === 'remove') {
    e.allergies = e.allergies.filter(a => a.id !== req.body.allergyId);
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e });
});

app.post('/api/supplier/event/allergy/alt', supplierAuth, async (req, res) => {
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  const al = e && (e.allergies || []).find(a => a.id === req.body.allergyId);
  if (!al) return res.status(404).json({ error: 'Allergeen niet gevonden.' });
  const dishes = cateringDishes(req.supplier, e);
  const geraakt = dishes.filter(d => (d.allergens || []).some(x => String(x).toLowerCase().includes(al.allergen)));
  let alt = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 400,
        system: 'Je bent een chef-kok. Antwoord UITSLUITEND met JSON: {"name":"...","desc":"..."}. Bedenk een volwaardig vervangend gerecht in de stijl van de kaart, veilig voor het allergeen, kort en concreet in het Nederlands.',
        messages: [{ role: 'user', content: 'Allergeen: ' + al.allergen + '. Getroffen gerecht(en): ' + (geraakt.map(d => d.name + ' (' + (d.desc || '') + ')').join('; ') || 'onbekend') + '. Keuken: ' + req.supplier.name + '.' }]
      });
      alt = JSON.parse((msg.content[0].text.match(/\{[\s\S]*\}/) || ['{}'])[0]);
      if (!alt.name) alt = null;
    } catch (err) { alt = null; }
  }
  if (!alt) {
    const idee = ALT_IDEE[al.allergen] || ['aangepaste bereiding zonder ' + al.allergen, 'veilig voor ' + al.allergen];
    const basis = geraakt[0] ? geraakt[0].name : 'het hoofdgerecht';
    alt = { name: basis + ', variant zonder ' + al.allergen, desc: 'Zelfde opbouw als ' + basis.toLowerCase() + ', met ' + idee[0] + '; ' + idee[1] + '.' };
  }
  al.alternative = { name: String(alt.name).slice(0, 80), desc: String(alt.desc || '').slice(0, 200) };
  save();
  logActivity(req.supplier.code, req.actor, 'vervangend gerecht voor ' + al.allergen + ': "' + al.alternative.name + '" (' + e.name + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e, alternative: al.alternative, ai: !!anthropic });
});

app.post('/api/supplier/event/mep', supplierAuth, async (req, res) => {
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  const dishes = cateringDishes(req.supplier, e);
  if (!dishes.length && (!e.catering || e.catering.mode !== 'alacarte'))
    return res.status(409).json({ error: 'Stel eerst de eventkeuken in (vast menu of a la carte) in het Kantoor.' });
  const covers = eventCovers(e);
  let items = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 1400,
        system: 'Je bent een sous-chef die de mise en place plant. Antwoord UITSLUITEND met een JSON-array van {"daysBefore":0-3,"time":"HH:MM","task":"..."}. Maximaal 18 taken, Nederlands, concreet met aantallen. daysBefore 2 = twee dagen voor het event.',
        messages: [{ role: 'user', content: 'Event: ' + e.name + ' op ' + e.date + ', ' + covers + ' couverts. Gerechten: ' + (dishes.map(d => d.name).join('; ') || 'a la carte van de kaart') + '. Allergenen: ' + ((e.allergies || []).map(a => a.allergen + ' (' + a.count + 'x' + (a.alternative ? ', vervanger: ' + a.alternative.name : '') + ')').join('; ') || 'geen') + '.' }]
      });
      const arr = JSON.parse((msg.content[0].text.match(/\[[\s\S]*\]/) || ['[]'])[0]);
      if (Array.isArray(arr) && arr.length) items = arr.slice(0, 18).map(x => runItem(x.time, 'keuken', x.task, x.daysBefore, true));
    } catch (err) { items = null; }
  }
  if (!items) {
    items = [
      runItem('10:00', 'keuken', 'Bestellingen plaatsen en voorraad controleren voor ' + e.name + ' (' + covers + ' couverts)', 2, true),
      runItem('15:00', 'keuken', 'Fonds, sauzen en marinades opzetten die tijd nodig hebben', 2, true),
      runItem('09:00', 'keuken', 'Levering ontvangen en controleren op kwaliteit en aantallen', 1, true),
      runItem('11:00', 'keuken', 'Koeling indelen per gang, bakken labelen met datum en gerecht', 1, true)
    ];
    for (const d of dishes.slice(0, 8)) {
      items.push(runItem('13:00', 'keuken', 'Mise en place ' + d.name + ': snijwerk, portioneren (' + covers + ')', 1, true));
      items.push(runItem('14:00', 'keuken', 'Verse afwerking en garnituur ' + d.name + ', proeven met de chef', 0, true));
    }
    if (e.catering && e.catering.mode === 'alacarte')
      items.push(runItem('12:00', 'keuken', 'Parstock per station aanvullen voor a la carte (' + covers + ' couverts verwacht)', 1, true));
    for (const a of (e.allergies || [])) {
      items.push(runItem('12:00', 'keuken', 'Vervangend gerecht ' + (a.alternative ? '"' + a.alternative.name + '"' : 'voor ' + a.allergen) + ' voorbereiden, ' + a.count + 'x, strikt gescheiden werken (' + a.allergen + ')', 1, true));
      items.push(runItem('16:00', 'keuken', 'Aparte uitgifte klaarzetten voor gasten met ' + a.allergen + ' (' + a.count + 'x), pan en snijplank apart', 0, true));
    }
    items.push(runItem('10:00', 'keuken', 'MEP-briefing keukenteam: taken verdelen, tijden en allergenen doorspreken', 0, true));
  }
  // eerdere automatische MEP weggooien zodat opnieuw organiseren geen dubbels geeft
  e.runsheet = (e.runsheet || []).filter(x => !x.mep);
  e.runsheet = [...e.runsheet, ...items].slice(0, 90);
  sortRunsheet(e);
  save();
  logActivity(req.supplier.code, req.actor, 'organiseerde de mise en place voor "' + e.name + '" (' + items.length + ' taken, ' + covers + ' couverts)');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e, added: items.length, covers, ai: !!anthropic });
});

app.post('/api/supplier/menu/recipe', supplierAuth, async (req, res) => {
  const m = (req.supplier.menu || []).find(x => x.id === req.body.itemId);
  if (!m) return res.status(404).json({ error: 'Gerecht niet gevonden.' });
  let recept = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 700,
        system: 'Je bent een chef-kok die werkinstructies schrijft voor nieuwe keukenkrachten. Antwoord in het Nederlands, platte tekst, maximaal 10 korte genummerde stappen: mise en place, bereiding, afwerking en bord. Concreet, geen inleiding.',
        messages: [{ role: 'user', content: 'Gerecht: ' + m.name + (m.desc ? ' (' + m.desc + ')' : '') + '. Keuken: ' + req.supplier.name + '. Allergenen: ' + ((m.allergens || []).join(', ') || 'geen') + '.' }]
      });
      recept = String(msg.content[0].text || '').trim().slice(0, 1500);
    } catch (err) { recept = null; }
  }
  if (!recept) {
    recept = '1. Mise en place: alle ingredienten voor ' + m.name + ' afwegen en klaarzetten.\n' +
      (m.desc ? '2. Basis: ' + m.desc + '\n' : '2. Basis volgens de huisreceptuur van ' + req.supplier.name + '.\n') +
      '3. Bereiden op de eigen sectie (' + (m.sectie || 'warm') + '); tussentijds proeven.\n' +
      ((m.allergens || []).length ? '4. LET OP allergenen: ' + m.allergens.join(', ') + '. Bij een allergie-bon strikt gescheiden werken.\n' : '') +
      '5. Afwerking en garnituur; bord vegen.\n' +
      '6. Doorgeven aan de pas; chef proeft steekproefsgewijs.\n' +
      '(Laat de manager dit recept aanscherpen in het Kantoor, of zet een ANTHROPIC_API_KEY voor een uitgewerkt recept.)';
  }
  m.recept = recept;
  save();
  logActivity(req.supplier.code, req.actor, 'zette het recept van ' + m.name + ' op de bon');
  // bewust geen sync-broadcast: het scherm dat het recept opvroeg werkt zijn
  // eigen menukopie bij, andere schermen zien het bij hun eerstvolgende refresh
  res.json({ ok: true, recept, ai: !!anthropic });
});

app.post('/api/supplier/kitchen/coach', supplierAuth, async (req, res) => {
  const s = req.supplier;
  const lang = req.body.lang === 'en' ? 'en' : 'nl';
  const open = db.data.orders.filter(o => o.supplierCode === s.code && ['nieuw', 'in bereiding'].includes(o.status) && sectiesForOrder(s, o).length);
  if (!open.length) return res.json({ ok: true, lines: [], ai: !!anthropic });
  const hash = crypto.createHash('sha1').update(lang + JSON.stringify(open.map(o => [o.ref, o.status, o.table, o.secties, Math.floor((Date.now() - new Date(o.at)) / 300000)]))).digest('hex');
  const cached = coachCache.get(s.code);
  if (cached && cached.hash === hash) return res.json({ ok: true, lines: cached.lines, ai: !!anthropic, cached: true });
  let lines = null;
  if (anthropic) {
    try {
      const beeld = open.map(o => ({ bon: o.pickup, tafel: o.table || null, min: Math.round((Date.now() - new Date(o.at)) / 60000), items: o.items.map(i => i.qty + 'x ' + i.name), kanten: o.secties || {} }));
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 600,
        system: lang === 'en'
          ? 'You are a sous-chef running the line. Reply ONLY with a JSON array of at most 6 short English instructions (strings): what to fire now, what to batch, which table leaves together, who gets priority.'
          : 'Je bent een sous-chef die de lijn aanstuurt. Antwoord UITSLUITEND met een JSON-array van maximaal 6 korte Nederlandse aanwijzingen (strings): wat nu maken, wat batchen, welke tafel samen uitgaat, wie voorrang krijgt.',
        messages: [{ role: 'user', content: JSON.stringify(beeld) }]
      });
      const arr = JSON.parse((msg.content[0].text.match(/\[[\s\S]*\]/) || ['[]'])[0]);
      if (Array.isArray(arr) && arr.length) lines = arr.slice(0, 6).map(x => String(x).slice(0, 160));
    } catch (err) { lines = null; }
  }
  if (!lines) lines = coachRules(s, open, lang);
  coachCache.set(s.code, { hash, lines, at: Date.now() });
  res.json({ ok: true, lines, ai: !!anthropic });
});

app.post('/api/supplier/mep/daily', supplierAuth, async (req, res) => {
  const s = req.supplier;
  if (!s.dailyMeps) return res.status(400).json({ error: 'De dagelijkse mise en place is er voor restaurants, bars en clubs.' });
  const menu = (s.menu || []).filter(m => m.station !== 'bar');
  if (!menu.length) return res.status(409).json({ error: 'Zet eerst gerechten op de kaart; daar rekent de voorspelling mee.' });
  const dagen = req.body.day === 'morgen' ? 1 : 0;
  const doel = new Date(Date.now() + dagen * 86400000);
  const date = doel.toISOString().slice(0, 10);
  const [factor, factorLabel] = weekdagFactor(doel);

  // historie: bestellingen van de afgelopen 21 dagen
  const sinds = Date.now() - 21 * 86400000;
  const hist = db.data.orders.filter(o => o.supplierCode === s.code && new Date(o.at).getTime() >= sinds && !['geweigerd', 'terugbetaald'].includes(o.status));
  const perGerecht = {}; let histQty = 0; const histDagen = new Set();
  for (const o of hist) {
    histDagen.add(String(o.at).slice(0, 10));
    for (const it of (o.items || [])) {
      const m = menu.find(x => x.id === it.id);
      if (m) { perGerecht[m.id] = (perGerecht[m.id] || 0) + it.qty; histQty += it.qty; }
    }
  }
  const stoelen = (s.tables || []).reduce((n, t) => n + (t.seats || 0), 0) || 24;
  const basis = Math.round(stoelen * 2 * factor);                 // twee zittingen
  const histGem = histDagen.size ? Math.round((histQty / histDagen.size) * factor) : 0;
  const covers = Math.max(basis, histGem);
  const portions = menu.map(m => {
    const aandeel = histQty ? (perGerecht[m.id] || 0) / histQty : 1 / menu.length;
    return { name: m.name, n: Math.max(5, Math.ceil((covers * aandeel) / 5) * 5) };
  });

  let tasks = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 900,
        system: 'Je bent een sous-chef. Antwoord UITSLUITEND met een JSON-array van {"time":"HH:MM","task":"..."}. Maximaal 10 taken voor de dagelijkse a la carte mise en place, Nederlands, concreet met aantallen.',
        messages: [{ role: 'user', content: 'Verwacht: ' + covers + ' couverts (' + factorLabel + '). Porties: ' + portions.map(p => p.name + ' ' + p.n + 'x').join('; ') + '.' }]
      });
      const arr = JSON.parse((msg.content[0].text.match(/\[[\s\S]*\]/) || ['[]'])[0]);
      if (Array.isArray(arr) && arr.length) tasks = arr.slice(0, 10).map(x => ({ id: crypto.randomBytes(3).toString('hex'), time: /^\d{2}:\d{2}$/.test(x.time) ? x.time : '12:00', task: String(x.task).slice(0, 160), done: false, doneBy: null }));
    } catch (err) { tasks = null; }
  }
  if (!tasks) {
    const t = (time, task) => ({ id: crypto.randomBytes(3).toString('hex'), time, task, done: false, doneBy: null });
    tasks = [
      t('09:00', 'Voorraad naast de voorspelling leggen (' + covers + ' couverts, ' + factorLabel + ') en bijbestellen'),
      t('10:30', 'Koeling checken, alles labelen; parstock per station bepalen'),
      ...portions.slice(0, 8).map(p => t('13:00', 'MEP ' + p.name + ': ' + p.n + ' porties (snijwerk, sauzen, portioneren)')),
      t('15:30', 'Garnituren en verse afwerking klaarzetten per station'),
      t('16:30', 'Lijn-check met de chef: proeven, aantallen aftekenen, briefing service')
    ];
  }
  s.dailyMeps[date] = { date, covers, factorLabel, portions, tasks, by: req.actor.name, at: new Date().toISOString() };
  // oude dagen opruimen
  const gisteren = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  for (const k of Object.keys(s.dailyMeps)) if (k < gisteren) delete s.dailyMeps[k];
  save();
  logActivity(s.code, req.actor, 'voorspelde de mise en place voor ' + date + ' (' + covers + ' couverts)');
  sseToSupplier(s.code, 'sync', { scope: 'events' });
  res.json({ ok: true, plan: s.dailyMeps[date], histDagen: histDagen.size, ai: !!anthropic });
});

app.post('/api/supplier/mep/daily/done', supplierAuth, (req, res) => {
  const plan = s => (s.dailyMeps || {})[req.body.date];
  const p = plan(req.supplier);
  const it = p && (p.tasks || []).find(x => x.id === req.body.taskId);
  if (!it) return res.status(404).json({ error: 'Taak niet gevonden.' });
  it.done = !it.done;
  it.doneBy = it.done ? req.actor.name : null;
  save();
  if (it.done) logActivity(req.supplier.code, req.actor, 'vinkte af: ' + it.time + ' ' + it.task.slice(0, 60));
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, plan: p });
});

app.post('/api/supplier/settings', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const st = req.supplier.settings = req.supplier.settings || { ordersOpen: true, reservationsOpen: true };
  const changed = [];
  if (typeof req.body.ordersOpen === 'boolean' && st.ordersOpen !== req.body.ordersOpen) { st.ordersOpen = req.body.ordersOpen; changed.push('bestellingen ' + (st.ordersOpen ? 'open' : 'dicht')); }
  if (typeof req.body.reservationsOpen === 'boolean' && st.reservationsOpen !== req.body.reservationsOpen) { st.reservationsOpen = req.body.reservationsOpen; changed.push('reserveringen ' + (st.reservationsOpen ? 'open' : 'dicht')); }
  if (req.body.opties && typeof req.body.opties === 'object') {
    st.opties = st.opties || {};
    for (const k of Object.keys(ZAAK_OPTIES)) {
      if (typeof req.body.opties[k] === 'boolean' && st.opties[k] !== req.body.opties[k]) {
        st.opties[k] = req.body.opties[k];
        changed.push(ZAAK_OPTIES[k] + ' ' + (req.body.opties[k] ? 'aan' : 'uit'));
      }
    }
  }
  // boekhouding: het land bepaalt de tarieven en regels, het uurloon de personeelskosten
  if (typeof req.body.land === 'string' && LANDEN[req.body.land] && st.land !== req.body.land) {
    st.land = req.body.land;
    changed.push('het land op ' + LANDEN[req.body.land].naam);
  }
  if (req.body.uurloon != null) {
    const u = Number(req.body.uurloon);
    if (Number.isFinite(u) && u >= 0 && u <= 500) { st.uurloon = Math.round(u * 100) / 100; changed.push('het uurloon bij'); }
  }
  // vervoerders: het tarief dat elke nieuwe rit direct een vaste prijs geeft
  if (req.body.tarief && typeof req.body.tarief === 'object') {
    const t = st.tarief = st.tarief || {};
    for (const k of ['start', 'perKm', 'minimum']) {
      const v = Number(req.body.tarief[k]);
      if (Number.isFinite(v) && v >= 0 && v <= 100000) t[k] = Math.round(v * 100) / 100;
    }
    changed.push('het tarief bij');
  }
  save();
  if (changed.length) logActivity(req.supplier.code, req.actor, 'zette ' + changed.join(' en '));
  broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'settings' });
  res.json({ ok: true, settings: st });
});

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

app.post('/api/supplier/backoffice', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const s = req.supplier;
  const en = req.body.lang === 'en';
  const nu = Date.now();
  const dag = iso => String(iso || '').slice(0, 10);
  const vandaag = new Date().toISOString().slice(0, 10);
  const orders = db.data.orders.filter(o => o.supplierCode === s.code && o.paid && o.status !== 'geweigerd' && o.status !== 'terugbetaald');
  const ritten = db.data.rides.filter(r => r.supplierCode === s.code && r.paid && r.status !== 'geweigerd');
  const boekingen = db.data.boekingen.filter(b => b.supplierCode === s.code && b.paid && b.status !== 'geweigerd');
  // kassaverkopen zonder dubbeltellingen: RTG-codes zijn al app-omzet,
  // kamerlasten tellen pas bij het uitchecken
  const kassa = (db.data.posSales[s.code] || []).filter(v => v.method !== 'rtg' && v.method !== 'kamer');
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(nu - i * 86400000).toISOString().slice(0, 10);
    week.push({
      date: d,
      label: new Date(d + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'short' }),
      omzet: orders.filter(o => dag(o.paidAt || o.at) === d).reduce((x, o) => x + (o.total || 0), 0)
        + ritten.filter(r => dag(r.paidAt || r.at) === d).reduce((x, r) => x + (r.quote || 0), 0)
        + boekingen.filter(b => dag(b.paidAt || b.at) === d).reduce((x, b) => x + (b.price || 0), 0)
        + kassa.filter(v => dag(v.at) === d).reduce((x, v) => x + (v.total || 0), 0),
      aantal: orders.filter(o => dag(o.paidAt || o.at) === d).length
        + ritten.filter(r => dag(r.paidAt || r.at) === d).length
        + boekingen.filter(b => dag(b.paidAt || b.at) === d).length
        + kassa.filter(v => dag(v.at) === d).length
    });
  }
  // toppers: wat verkoopt het best, app, kassa en boekingen samen
  const teller = {};
  const telItems = lijst => { for (const it of (lijst || [])) { if (!it.name) continue; const t = teller[it.name] = teller[it.name] || { naam: it.name, aantal: 0, omzet: 0 }; t.aantal += it.qty || 1; t.omzet += (it.price || 0) * (it.qty || 1); } };
  for (const o of orders) telItems(o.items);
  for (const v of kassa) telItems(v.items);
  for (const b of boekingen) { const t2 = teller[b.service.name] = teller[b.service.name] || { naam: b.service.name, aantal: 0, omzet: 0 }; t2.aantal += 1; t2.omzet += b.price || 0; }
  const toppers = Object.values(teller).sort((a, b) => b.omzet - a.omzet).slice(0, 8);
  // actiecentrum van de zaak
  const alerts = [];
  const minGeleden = iso => Math.round((nu - new Date(iso)) / 60000);
  for (const o of db.data.orders) {
    if (o.supplierCode !== s.code || !o.paid || o.status !== 'nieuw') continue;
    const m = minGeleden(o.paidAt || o.at);
    if (m >= 10) alerts.push({ level: 'rood', text: en
      ? 'Order ' + o.ref + ' has been untouched for ' + m + ' min (' + o.customerCodename + ').'
      : 'Bestelling ' + o.ref + ' staat al ' + m + ' min onaangeroerd (' + o.customerCodename + ').' });
  }
  for (const r of db.data.rides) {
    if (r.supplierCode !== s.code || !r.paid || r.status !== 'aangevraagd' || r.driver) continue;
    const straks = r.plannedFor && (new Date(r.plannedFor) - nu) > 45 * 60000;
    if (!straks && minGeleden(r.paidAt || r.at) >= 10)
      alerts.push({ level: 'rood', text: en ? 'Ride ' + r.ref + ' is still waiting for a driver.' : 'Rit ' + r.ref + ' wacht nog op een chauffeur.' });
    else if (straks && (new Date(r.plannedFor) - nu) < 24 * 3600000)
      alerts.push({ level: 'amber', text: en
        ? 'Scheduled ride ' + r.ref + ' (' + String(r.plannedFor).slice(0, 16).replace('T', ' ') + ') has no driver yet.'
        : 'Geplande rit ' + r.ref + ' (' + String(r.plannedFor).slice(0, 16).replace('T', ' ') + ') heeft nog geen chauffeur.' });
  }
  for (const b of db.data.boekingen) {
    if (b.supplierCode !== s.code || !b.paid || b.status !== 'aangevraagd') continue;
    if (minGeleden(b.paidAt || b.at) >= 30) alerts.push({ level: 'amber', text: en
      ? 'Booking ' + b.ref + ' (' + b.service.name + ') is still waiting for your confirmation.'
      : 'Boeking ' + b.ref + ' (' + b.service.name + ') wacht nog op uw bevestiging.' });
  }
  const verlofN = (db.data.verlof[s.code] || []).filter(v => v.status === 'nieuw').length;
  if (verlofN) alerts.push({ level: 'amber', text: en ? verlofN + ' leave request(s) await your decision (HR & team).' : verlofN + ' verlofaanvraag/aanvragen wachten op uw besluit (HR & team).' });
  const sollN = (db.data.applications[s.code] || []).filter(a => a.status === 'nieuw').length;
  if (sollN) alerts.push({ level: 'info', text: en ? sollN + ' open application(s) (HR & team).' : sollN + ' open sollicitatie(s) (HR & team).' });
  const chatsN = Object.values(db.data.guestChats).filter(c => c.supplierCode === s.code && c.unreadPartner).length;
  if (chatsN) alerts.push({ level: 'amber', text: en ? chatsN + ' guest chat(s) waiting for a reply.' : chatsN + ' gastchat(s) wachten op een antwoord.' });
  const klussenN = (db.data.tickets[s.code] || []).filter(t => t.status !== 'klaar').length;
  if (klussenN) alerts.push({ level: 'info', text: en ? klussenN + ' open job(s) or maintenance.' : klussenN + ' open klus(sen) of onderhoud.' });
  const vuilN = (s.rooms || []).filter(r => r.hk && r.hk.status === 'vuil').length;
  if (vuilN) alerts.push({ level: 'amber', text: en ? vuilN + ' room(s) still to clean.' : vuilN + ' kamer(s) nog schoon te maken.' });
  const volg = { rood: 0, amber: 1, info: 2 };
  alerts.sort((a, b) => volg[a.level] - volg[b.level]);
  const kassaVandaag = kassa.filter(v => dag(v.at) === vandaag).reduce((x, v) => x + (v.total || 0), 0);
  const stats = {
    omzetVandaag: week[6].omzet,
    transactiesVandaag: week[6].aantal,
    kassaVandaag,
    omzetWeek: week.reduce((x, d2) => x + d2.omzet, 0),
    binnenNu: [...new Set((db.data.klok[s.code] || []).filter(e => e.in.slice(0, 10) === vandaag && !e.out).map(e => e.name))].length,
    openActies: alerts.length
  };
  // dagbriefing in gewone taal, altijd uit de echte cijfers
  const eurF = n => '€ ' + Number(n).toLocaleString(en ? 'en-US' : 'nl-NL');
  const zin = [];
  zin.push(en
    ? 'Today ' + s.name + ' processed ' + stats.transactiesVandaag + ' transaction(s) for ' + eurF(stats.omzetVandaag) + ' (of which ' + eurF(kassaVandaag) + ' at the register); this week stands at ' + eurF(stats.omzetWeek) + '.'
    : 'Vandaag verwerkte ' + s.name + ' ' + stats.transactiesVandaag + ' transactie(s), goed voor ' + eurF(stats.omzetVandaag) + ' (waarvan ' + eurF(kassaVandaag) + ' via de kassa); de week staat op ' + eurF(stats.omzetWeek) + '.');
  if (toppers[0]) zin.push(en
    ? 'Best seller: ' + toppers[0].naam + ' (' + toppers[0].aantal + 'x, ' + eurF(toppers[0].omzet) + ').'
    : 'Topper: ' + toppers[0].naam + ' (' + toppers[0].aantal + 'x, ' + eurF(toppers[0].omzet) + ').');
  zin.push(stats.binnenNu
    ? (en ? stats.binnenNu + ' colleague(s) are clocked in right now.' : stats.binnenNu + ' collega(s) zijn nu ingeklokt.')
    : (en ? 'Nobody is clocked in right now.' : 'Er is nu niemand ingeklokt.'));
  const rood = alerts.filter(a => a.level === 'rood').length;
  zin.push(rood
    ? (en ? rood + ' item(s) are stuck; see the action list.' : rood + ' zaak/zaken lopen vast; zie de actielijst.')
    : alerts.length
      ? (en ? 'Nothing is stuck; ' + alerts.length + ' routine item(s) remain.' : 'Niets loopt vast; nog ' + alerts.length + ' routinepunt(en).')
      : (en ? 'Everything is running smoothly.' : 'Alles loopt.'));
  zin.push(en ? 'RTG charges 0% commission: this revenue is fully yours.' : 'RTG rekent 0% commissie: deze omzet is volledig van u.');
  res.json({ stats, week, toppers, alerts: alerts.slice(0, 12), briefing: zin.join(' ') });
});

app.post('/api/supplier/booking/status', supplierAuth, (req, res) => {
  const b = db.data.boekingen.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
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

app.post('/api/supplier/giftcard/sell', supplierAuth, (req, res) => {
  const bedrag = Math.round(Number(req.body.bedrag));
  if (!(bedrag >= 10 && bedrag <= 5000)) return res.status(400).json({ error: 'Kies een bedrag tussen € 10 en € 5.000.' });
  const kaart = { code: gcCode(), supplierCode: req.supplier.code, supplierName: req.supplier.name, bedrag, saldo: bedrag,
    kocht: req.actor.name + ' (kassa)', customerKey: null, at: new Date().toISOString(), verzilveringen: [] };
  db.data.giftcards.unshift(kaart);
  db.data.giftcards = db.data.giftcards.slice(0, 20000);
  save();
  logActivity(req.supplier.code, req.actor, 'verkocht een cadeaukaart van € ' + bedrag + ' (' + kaart.code + ')');
  res.json({ ok: true, kaart });
});

app.post('/api/supplier/giftcard/redeem', supplierAuth, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const g = (db.data.giftcards || []).find(x => x.code === code && x.supplierCode === req.supplier.code);
  if (!g) return res.status(404).json({ error: 'Deze cadeaukaart kennen we hier niet.' });
  const bedrag = Math.round(Number(req.body.bedrag) * 100) / 100;
  if (!(bedrag > 0)) return res.status(400).json({ error: 'Geen geldig bedrag.' });
  if (bedrag > g.saldo) return res.status(409).json({ error: 'Onvoldoende saldo: er staat nog € ' + g.saldo + ' op deze kaart.' });
  g.saldo = Math.round((g.saldo - bedrag) * 100) / 100;
  g.verzilveringen = g.verzilveringen || [];
  g.verzilveringen.push({ bedrag, at: new Date().toISOString(), actor: req.actor.name });
  save();
  logActivity(req.supplier.code, req.actor, 'inde € ' + bedrag + ' van cadeaukaart ' + g.code + ' (rest € ' + g.saldo + ')');
  res.json({ ok: true, saldo: g.saldo, kaart: { code: g.code, saldo: g.saldo } });
});

app.post('/api/supplier/finance', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  res.json(financeVoor(req.supplier));
});

app.post('/api/supplier/accountant', supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const vraag = String(req.body.question || '').trim().slice(0, 400);
  if (!vraag) return res.status(400).json({ error: 'Stel een vraag.' });
  const fin = financeVoor(req.supplier);
  const L = LANDEN[fin.land];
  let answer = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 500,
        system: 'Je bent de AI-boekhouder van RTG voor ' + req.supplier.name + ' (' + req.supplier.type + ') in ' + L.naam + '. ' +
          'Regels: ' + fin.regels.join(' ') + ' Zakelijke aftrek: ' + Object.values(L.zakelijk).join(' ') + ' ' +
          'Cijfers deze maand: btw ' + JSON.stringify(fin.btw) + ', af te dragen € ' + fin.btwTotaal + '; personeel ' + JSON.stringify(fin.personeel) + '; cadeaukaarten ' + JSON.stringify(fin.giftcards) + '. ' +
          'Antwoord in het Nederlands, maximaal 130 woorden, praktisch en concreet. Sluit af met: dit is voorlichting, geen bindend fiscaal advies.',
        messages: [{ role: 'user', content: vraag }]
      });
      answer = msg.content[0].text;
    } catch (err) { answer = null; }
  }
  if (!answer) answer = cannedBoekhouder(vraag, fin, L);
  res.json({ answer, land: fin.land, ai: !!anthropic });
});

app.post('/api/supplier/ai', supplierAuth, async (req, res) => {
  const s = req.supplier;
  const q = String(req.body.q || '').trim().slice(0, 300);
  if (!q) return res.status(400).json({ error: 'Stel een vraag.' });
  const ql = q.toLowerCase();
  const A = (reply, did) => res.json({ reply, did: !!did });

  // ---- acties ----
  // kamerstatus: "zet <kamer> op schoon/vuil/bezig/bezet" of "meld <kamer> defect: reden"
  const hkWord = { schoon:'schoon', clean:'schoon', vuil:'vuil', dirty:'vuil', bezig:'bezig', bezet:'bezet', occupied:'bezet', defect:'defect', kapot:'defect', stuk:'defect' };
  const hkHit = Object.keys(hkWord).find(w => ql.includes(w));
  const room = aiFindRoom(s, ql);
  if (room && hkHit && /\b(zet|meld|maak|markeer|set|mark|is)\b/.test(ql)) {
    const status = hkWord[hkHit];
    const note = (q.split(/[:,]/)[1] || '').trim().slice(0, 140);
    setRoomHk(s, room, status, status === 'defect' ? (note || 'gemeld via AI') : '', req.actor);
    return A(status === 'defect'
      ? room.name + ' staat op defect: uit de verkoop en er staat een klus klaar voor onderhoud.'
      : room.name + ' staat nu op "' + status + '".', true);
  }
  // deuren: "open de voordeur" / "vergrendel machiya 1"
  if (/\b(open|vergrendel|lock|sluit)\b/.test(ql) && (s.doors || []).length) {
    const door = aiFindDoor(s, ql);
    if (door) {
      if (/\b(vergrendel|lock|sluit)\b/.test(ql)) {
        door.locked = true; door.lastBy = req.actor.name; door.lastAt = new Date().toISOString(); save();
        logActivity(s.code, req.actor, 'vergrendelde "' + door.name + '" via de AI-assistent');
        sseToSupplier(s.code, 'sync', { scope: 'doors' });
        return A(door.name + ' is vergrendeld.', true);
      }
      unlockDoor(s, door, req.actor.name);
      logActivity(s.code, req.actor, 'opende "' + door.name + '" via de AI-assistent');
      return A(door.name + ' is open en vergrendelt zichzelf over 10 seconden.', true);
    }
  }
  // klus melden: "meld klus: lamp kapot" / "nieuwe klus ..."
  const klusMatch = q.match(/(?:meld(?:\s+een)?\s+klus|nieuwe\s+klus|new\s+job)[:\s]+(.{3,})/i);
  if (klusMatch) {
    const t = addTicket(s.code, req.actor, klusMatch[1].trim(), room ? room.name : null);
    save();
    logActivity(s.code, req.actor, 'meldde een klus via de AI-assistent: ' + t.text.slice(0, 50));
    sseToSupplier(s.code, 'sync', { scope: 'rooms' });
    return A('Klus genoteerd' + (t.room ? ' voor ' + t.room : '') + ': "' + t.text + '". Onderhoud ziet hem in de klussenlijst.', true);
  }

  // ---- vragen ----
  if (/(omzet|dagtotaal|z.rapport|verdiend|revenue|kassa)/.test(ql)) {
    const p = posDay(s.code);
    const methods = Object.entries(p.byMethod).map(([m, v]) => m + ' € ' + v).join(', ');
    const open = Object.entries(p.openRooms || {}).map(([r, v]) => r + ' € ' + v.total).join(', ');
    return A('Vandaag ontvangen: € ' + p.total + ' over ' + p.count + ' bon(nen)' + (methods ? ' (' + methods + ')' : '') +
      (open ? '. Nog open op kamers: ' + open + '.' : '.'));
  }
  if (/(vuil|schoon|status|kamers?\b).*(kamer|room|status)|welke kamers/.test(ql) && (s.rooms || []).length) {
    const lines = s.rooms.map(r => r.name + ': ' + ((r.hk && r.hk.status) || 'schoon') + (r.available ? '' : ' (uit de verkoop)'));
    return A('Kamerstatus. ' + lines.join('. ') + '.');
  }
  if (/(klus|onderhoud|jobs?|tickets?)/.test(ql)) {
    const open = (db.data.tickets[s.code] || []).filter(t => t.status !== 'klaar');
    return A(open.length
      ? 'Er staan ' + open.length + ' klus(sen) open: ' + open.map(t => t.text + (t.room ? ' (' + t.room + ')' : '') + (t.status === 'bezig' ? ', wordt opgepakt' : '')).join('; ') + '.'
      : 'Er zijn geen openstaande klussen.');
  }
  if (/(onderweg|gast(en)?\b|eta|guests?)/.test(ql)) {
    const g = guestsFor(s.code);
    return A(g.length
      ? g.map(x => x.codename + (x.arrived ? ' is gearriveerd' : x.etaMin != null ? ' arriveert over ~' + x.etaMin + ' min' : ' is onderweg')).join('. ') + '.'
      : 'Er is nu geen gast live onderweg naar u.');
  }
  if (/(bericht|chat|onbeantwoord|messages?)/.test(ql)) {
    const chats = Object.values(db.data.guestChats).filter(c => c.supplierCode === s.code && c.unreadPartner > 0);
    return A(chats.length
      ? 'U heeft ' + chats.reduce((n, c) => n + c.unreadPartner, 0) + ' onbeantwoord(e) bericht(en): ' + chats.map(c => c.codename + ' (' + (c.dept || 'Team') + '): "' + c.messages[c.messages.length - 1].text.slice(0, 40) + '"').join('; ') + '.'
      : 'Alle gastberichten zijn beantwoord.');
  }
  if (/(minibar)/.test(ql) && Array.isArray(s.minibar)) {
    const today = new Date().toISOString().slice(0, 10);
    const counted = [...new Set((db.data.minibarCounts[s.code] || []).filter(e => e.at.slice(0, 10) === today).map(e => e.room))];
    const todo = (s.rooms || []).map(r => r.name).filter(n => !counted.includes(n));
    return A(todo.length ? 'Nog te tellen: ' + todo.join(', ') + '.' : 'Alle minibars zijn vandaag geteld.');
  }
  if (/(bestelling|orders?|bon(nen)?\b)/.test(ql)) {
    const open = db.data.orders.filter(o => o.supplierCode === s.code && !['geserveerd', 'geweigerd', 'terugbetaald', 'bezorgd', 'opgehaald'].includes(o.status));
    return A(open.length
      ? open.length + ' open bestelling(en): ' + open.map(o => o.customerCodename + ' € ' + o.total + ' (' + o.status + ', code ' + o.pickup + ')').join('; ') + '.'
      : 'Er zijn geen open bestellingen.');
  }
  if (/(rooster|dienst|schedule|shift)/.test(ql)) {
    const wk = scheduleFor(s.code);
    const today = wk.days[0];
    return A('Vandaag: ' + today.staff.map(x => x.name + ' ' + x.shift).join('; ') + '. Het volledige rooster staat in de personeels-app.');
  }

  // vrije vraag: Claude met bedrijfscontext, anders hulptekst
  if (anthropic) {
    try {
      const p = posDay(s.code);
      const ctx = 'Bedrijf: ' + s.name + ' (' + s.type + ', ' + s.city + '). Vandaag ontvangen: € ' + p.total + '. ' +
        'Kamers: ' + (s.rooms || []).map(r => r.name + '=' + ((r.hk && r.hk.status) || 'schoon')).join(', ') + '. ' +
        'Open klussen: ' + (db.data.tickets[s.code] || []).filter(t => t.status !== 'klaar').length + '.';
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 300,
        system: 'Je bent de AI-assistent van een RTG-partner. Antwoord kort en concreet in de taal van de vraag. Context: ' + ctx,
        messages: [{ role: 'user', content: q }]
      });
      return A(response.content[0].text);
    } catch (e) { /* val terug op hulptekst */ }
  }
  return A('Dat begrijp ik nog niet helemaal. U kunt mij bijvoorbeeld vragen: "dagomzet", "welke kamers zijn vuil", "zet Riverside suite op schoon", "meld Garden kamer defect: douche lekt", "open de voordeur", "meld klus: lamp vervangen", "wie is er onderweg", "onbeantwoorde berichten", "welke minibars nog tellen" of "open bestellingen".');
});

app.post('/api/supplier/schedule', supplierAuth, (req, res) => res.json(scheduleFor(req.supplier.code)));

app.post('/api/supplier/team/message', supplierAuth, (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 500);
  let audio = null;
  if (typeof req.body.audio === 'string' && /^data:audio\//.test(req.body.audio) && req.body.audio.length <= 2 * 1024 * 1024)
    audio = req.body.audio;
  if (!text && !audio) return res.status(400).json({ error: 'Leeg bericht.' });
  const list = db.data.supplierTeam[req.supplier.code] = (db.data.supplierTeam[req.supplier.code] || []);
  list.push({ who: req.actor.name, role: req.actor.role, text: text || (audio ? '' : text), audio, at: new Date().toISOString() });
  // walkie-talkie: spraakmemo's klinken direct bij iedereen die de app open heeft
  if (audio) {
    for (const c of sseClients) {
      if (c.sup !== req.supplier.code) continue;
      if (c.staffId === (req.actor.staffId != null ? req.actor.staffId : null)) continue;
      sseSend(c.res, 'ptt', { from: req.actor.name, audio });
    }
  }
  db.data.supplierTeam[req.supplier.code] = list.slice(-100);
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
  res.json({ ok: true });
});

app.get('/api/supplier/stream', (req, res) => {
  const sess = sessionFor(req.query.token);
  if (!sess || sess.role !== 'supplier') return res.status(401).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' });
  res.write('retry: 3000\n\n');
  const client = { sup: sess.code, staffId: sess.staffId != null ? sess.staffId : null, res };
  sseClients.push(client);
  sseSend(res, 'hello', { unread: (db.data.supplierNotifications[sess.code] || []).filter(n => !n.read) });
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); const i = sseClients.indexOf(client); if (i >= 0) sseClients.splice(i, 1); });
});

app.post('/api/supplier/state', supplierAuth, (req, res) => res.json({ state: supplierState(req.supplier, req.actor) }));

app.post('/api/supplier/notifications/read', supplierAuth, (req, res) => {
  (db.data.supplierNotifications[req.supplier.code] || []).forEach(n => n.read = true);
  save();
  res.json({ ok: true });
});

app.post('/api/supplier/price', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return; // dynamische prijzen naar RTG zijn management
  const service = String(req.body.service || '').trim().slice(0, 120);
  const price = Number(req.body.price);
  if (!service || !(price > 0)) return res.status(400).json({ error: 'Vul een dienst en geldige prijs in.' });
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    supplierCode: req.supplier.code, supplierName: req.supplier.name, type: req.supplier.type,
    service, price, at: new Date().toISOString()
  };
  db.data.supplierPrices.unshift(entry);
  db.data.supplierPrices = db.data.supplierPrices.slice(0, 200);
  save();
  // backoffice ziet het live binnenkomen
  sseToOffice('sync', { scope: 'prices' });
  sseToOffice('notify', { icon: '💶', title: 'Nieuwe dynamische prijs', body: req.supplier.name + ': ' + service + ', € ' + price });
  logActivity(req.supplier.code, req.actor, 'gaf een prijs door: ' + service + ' (€ ' + price + ')');
  res.json({ ok: true, entry });
});

app.post('/api/supplier/menu', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return; // de kaart en de prijzen zijn voor het management
  if (!Array.isArray(req.body.menu)) return res.status(400).json({ error: 'Menu ontbreekt.' });
  req.supplier.menu = req.body.menu.slice(0, 100).map(m => {
    // ledenprijsgarantie: de publieke prijs is het plafond; als er geen aparte
    // publieke prijs is meegegeven, is de opgegeven prijs meteen de publieke.
    const publiek = Math.max(0, Number(m.publiekePrijs != null ? m.publiekePrijs : m.price) || 0);
    return {
    id: String(m.id || crypto.randomBytes(3).toString('hex')),
    cat: schoon(m.cat || 'Overig', 40),
    name: schoon(m.name, 80),
    desc: schoon(m.desc, 200),
    publiekePrijs: publiek,
    price: ledenPrijs(publiek, m.price),
    allergens: Array.isArray(m.allergens) ? m.allergens.slice(0, 12).map(a => String(a).slice(0, 20)) : [],
    station: m.station === 'bar' ? 'bar' : 'keuken',
    sectie: ['warm', 'koud', 'snack', 'dessert'].includes(m.sectie) ? m.sectie : 'warm',
    recept: String(m.recept || '').slice(0, 1500)
    };
  });
  save();
  logActivity(req.supplier.code, req.actor, 'werkte de menukaart bij');
  res.json({ ok: true, menu: req.supplier.menu });
});

app.post('/api/supplier/order/table', supplierAuth, (req, res) => {
  const o = db.data.orders.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  o.table = String(req.body.table || '').slice(0, 24);
  save();
  logActivity(req.supplier.code, req.actor, 'zette ' + o.ref + ' op ' + (o.table || 'geen tafel'));
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  res.json({ ok: true, order: o });
});

app.post('/api/supplier/order/sectie', supplierAuth, (req, res) => {
  const o = db.data.orders.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  const sectie = String(req.body.sectie || '');
  if (!['warm', 'koud', 'snack', 'dessert'].includes(sectie)) return res.status(400).json({ error: 'Onbekende sectie.' });
  const phase = req.body.phase === 'klaar' ? 'klaar' : 'bezig';
  o.secties = o.secties || {};
  o.secties[sectie] = phase;
  if (o.status === 'nieuw') o.status = 'in bereiding';
  const nodig = sectiesForOrder(req.supplier, o);
  const wasKlaar = o.status === 'klaar';
  if (nodig.length && nodig.every(x => o.secties[x] === 'klaar')) {
    o.stations = o.stations || {};
    o.stations.keuken = 'klaar';                            // de hele keuken is klaar
    const stNodig = stationsForOrder(req.supplier, o);
    if (stNodig.every(st => o.stations[st] === 'klaar')) o.status = 'klaar';
  }
  save();
  broadcastSync([o.customerTier], 'orders');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  if (o.status === 'klaar' && !wasKlaar)
    notify(o.customerTier, { icon: '\u2705', title: req.supplier.name, body: 'Uw bestelling is klaar. Ophaalcode: ' + o.pickup + '.', scope: 'orders' });
  logActivity(req.supplier.code, req.actor, sectie + ': ' + o.ref + ' ' + (phase === 'klaar' ? 'klaar' : 'in bereiding'));
  res.json({ ok: true, order: o });
});

app.post('/api/supplier/order/station', supplierAuth, (req, res) => {
  const o = db.data.orders.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  const station = req.body.station === 'bar' ? 'bar' : 'keuken';
  const phase = req.body.phase === 'klaar' ? 'klaar' : 'bezig';
  o.stations = o.stations || {};
  o.stations[station] = phase;
  if (o.status === 'nieuw') o.status = 'in bereiding';
  const needed = stationsForOrder(req.supplier, o);
  const wasKlaar = o.status === 'klaar';
  if (needed.every(st => o.stations[st] === 'klaar')) o.status = 'klaar';
  save();
  broadcastSync([o.customerTier], 'orders');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  if (o.status === 'klaar' && !wasKlaar)
    notify(o.customerTier, { icon: '\u2705', title: req.supplier.name, body: 'Uw bestelling is klaar. Ophaalcode: ' + o.pickup + '.', scope: 'orders' });
  logActivity(req.supplier.code, req.actor, (station === 'bar' ? 'bar' : 'keuken') + ': ' + o.ref + ' ' + (phase === 'klaar' ? 'klaar' : 'in bereiding'));
  res.json({ ok: true, order: o });
});

app.post('/api/supplier/order/status', supplierAuth, (req, res) => {
  const o = db.data.orders.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  const allowed = ['nieuw', 'in bereiding', 'klaar', 'geserveerd', 'geweigerd', 'onderweg', 'bezorgd', 'opgehaald'];
  const status = String(req.body.status || '');
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Onbekende status.' });
  o.status = status;
  save();
  broadcastSync([o.customerTier], 'orders');
  sseToOffice('sync', { scope: 'orders' });
  notify(o.customerTier, { icon: '🍽️', title: req.supplier.name, body: 'Uw bestelling is nu: ' + status + '.', scope: 'orders' });
  logActivity(req.supplier.code, req.actor, 'zette ' + o.ref + ' op "' + status + '"');
  res.json({ ok: true, order: o });
});

app.post('/api/supplier/refund', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return; // geld terugstorten is een management-handeling
  const o = db.data.orders.find(x => x.ref === req.body.ref && x.supplierCode === req.supplier.code);
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
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
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

app.post('/api/supplier/menu/get', auth, (req, res) => {
  const s = findSupplier(req.body.code);
  if (!s) return res.status(404).json({ error: 'Leverancier niet gevonden.' });
  const lang = req.body.lang;
  const menu = (s.menu || []).map(m => ({ ...m, name: i18n.localize(m.name, lang), desc: i18n.localize(m.desc, lang), cat: i18n.localize(m.cat, lang) }));
  // leeftijdsinfo voor de bestelflow: mag dit lid hier alcohol bestellen?
  const aInfo = alcoholGrensVan(s);
  const lftM = leeftijdVan(geborenVan(req.session));
  res.json({ supplier: publicSupplier(s, lang), menu,
    alcohol: { grens: aInfo.grens, land: aInfo.land, geverifieerd: lftM != null, mag: lftM == null || lftM >= aInfo.grens } });
});

/* ================== de ophaal/bezorgdienst van de zaak ==================
   Beheer (assortiment + schakelaars) is voor managers; de bezorgersritten
   zijn voor iedereen met een PDA-login: ritten staan op naam (staffId). */
function bezorgVan(s) {
  if (!s.bezorg || typeof s.bezorg !== 'object') s.bezorg = { aan: false, ophalen: true, bezorgen: true, producten: [] };
  if (!Array.isArray(s.bezorg.producten)) s.bezorg.producten = [];
  return s.bezorg;
}

app.post('/api/supplier/bezorg/instellingen', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!magBezorgen(s)) return res.status(409).json({ error: 'Deze sector heeft geen ophaal/bezorgdienst; die is voor horeca en zelfstandigen.' });
  const b = bezorgVan(s);
  if (req.body.ophalen != null) b.ophalen = !!req.body.ophalen;
  if (req.body.bezorgen != null) b.bezorgen = !!req.body.bezorgen;
  if (req.body.aan != null) {
    if (req.body.aan && !b.producten.length)
      return res.status(400).json({ error: 'Zet eerst producten in het assortiment; dan kan de dienst aan.' });
    b.aan = !!req.body.aan;
  }
  if (!b.ophalen && !b.bezorgen) b.aan = false; // zonder kanaal geen dienst
  save();
  logActivity(s.code, req.actor, 'zette de ophaal/bezorgdienst ' + (b.aan ? 'aan' : 'uit'));
  sseToSupplier(s.code, 'sync', { scope: 'bezorg' });
  res.json({ ok: true, bezorg: b });
});

app.post('/api/supplier/bezorg/product', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!magBezorgen(s)) return res.status(409).json({ error: 'Deze sector heeft geen ophaal/bezorgdienst.' });
  const b = bezorgVan(s);
  if (req.body.weg) {
    b.producten = b.producten.filter(p => p.id !== req.body.id);
    if (!b.producten.length) b.aan = false; // leeg assortiment: dienst dicht
    save(); sseToSupplier(s.code, 'sync', { scope: 'bezorg' });
    return res.json({ ok: true, producten: b.producten, aan: b.aan });
  }
  const name = schoon(req.body.name, 60);
  const price = Number(req.body.price);
  if (!name) return res.status(400).json({ error: 'Geef het product een naam.' });
  if (!(price > 0) || price > 10000) return res.status(400).json({ error: 'Geef een geldige prijs op.' });
  const desc = schoon(req.body.desc, 140);
  if (req.body.id) {
    const p = b.producten.find(x => x.id === req.body.id);
    if (!p) return res.status(404).json({ error: 'Product niet gevonden.' });
    p.name = name; p.price = price; p.desc = desc;
  } else {
    if (b.producten.length >= 60) return res.status(400).json({ error: 'Het assortiment kan tot 60 producten hebben.' });
    b.producten.push({ id: 'bz' + crypto.randomBytes(3).toString('hex'), name, desc, price });
  }
  save();
  sseToSupplier(s.code, 'sync', { scope: 'bezorg' });
  res.json({ ok: true, producten: b.producten });
});

/* Alles wat er nu loopt: voor de zaak-tab en de bezorger-PDA. */
app.post('/api/supplier/bezorg/overzicht', supplierAuth, (req, res) => {
  const s = req.supplier;
  const lopend = db.data.orders.filter(o => o.supplierCode === s.code && o.levering &&
    !['geweigerd', 'terugbetaald', 'bezorgd', 'opgehaald'].includes(o.status) && o.status !== 'wacht-op-betaling').slice(0, 60);
  const vandaag = new Date().toISOString().slice(0, 10);
  const klaarVandaag = db.data.orders.filter(o => o.supplierCode === s.code && o.levering &&
    ['bezorgd', 'opgehaald'].includes(o.status) && String(o.finishedAt || o.at).slice(0, 10) === vandaag);
  res.json({ bezorg: bezorgVan(s), lopend, vandaag: { aantal: klaarVandaag.length, omzet: klaarVandaag.reduce((x, o) => x + (o.total || 0), 0) } });
});

/* De bezorger neemt een of meer leveringen tegelijk aan, op eigen naam. */
app.post('/api/supplier/bezorg/neem', supplierAuth, (req, res) => {
  const s = req.supplier;
  const refs = (Array.isArray(req.body.refs) ? req.body.refs : [req.body.ref]).filter(Boolean).slice(0, 8);
  const genomen = [];
  for (const ref of refs) {
    const o = db.data.orders.find(x => x.ref === ref && x.supplierCode === s.code);
    if (!o || o.levering !== 'bezorgen' || o.bezorger || !o.paid) continue;
    if (['geweigerd', 'terugbetaald', 'bezorgd', 'opgehaald'].includes(o.status)) continue;
    o.bezorger = { staffId: req.actor.staffId || null, name: req.actor.name };
    genomen.push(o.ref);
    sseToCustomer(o.customerKey || o.customerTier, 'bezorg', { ref: o.ref, kind: 'bezorger', bezorger: req.actor.name });
  }
  if (!genomen.length) return res.status(409).json({ error: 'Geen van deze leveringen is nog vrij.' });
  save();
  logActivity(s.code, req.actor, 'nam ' + genomen.length + ' bezorging(en) aan');
  sseToSupplier(s.code, 'sync', { scope: 'bezorg' });
  res.json({ ok: true, genomen });
});

/* Statusovergangen van de rit, ook voor meerdere refs tegelijk (de hele rit
   vertrekt of komt aan). Alleen de eigen rit, tenzij je manager bent. */
app.post('/api/supplier/bezorg/status', supplierAuth, (req, res) => {
  const s = req.supplier;
  const status = String(req.body.status || '');
  if (!['onderweg', 'bezorgd', 'opgehaald'].includes(status)) return res.status(400).json({ error: 'Onbekende status.' });
  const refs = (Array.isArray(req.body.refs) ? req.body.refs : [req.body.ref]).filter(Boolean).slice(0, 8);
  const bijgewerkt = [];
  for (const ref of refs) {
    const o = db.data.orders.find(x => x.ref === ref && x.supplierCode === s.code);
    if (!o || !o.levering) continue;
    if (status === 'opgehaald' && o.levering !== 'ophalen') continue;
    if (status !== 'opgehaald' && o.levering !== 'bezorgen') continue;
    if (status !== 'opgehaald' && o.bezorger && req.actor.staffId && o.bezorger.staffId !== req.actor.staffId && !req.actor.manager) continue;
    o.status = status;
    if (status !== 'onderweg') { o.finishedAt = new Date().toISOString(); delete o.etaMin; }
    bijgewerkt.push(o.ref);
    notify(o.customerTier, { icon: status === 'onderweg' ? '\u{1F6F5}' : '\u2705', title: s.name,
      body: status === 'onderweg' ? 'Uw bestelling is onderweg.' : status === 'bezorgd' ? 'Uw bestelling is bezorgd. Eet smakelijk!' : 'Uw bestelling is opgehaald. Dank u wel!', scope: 'orders' });
    sseToCustomer(o.customerKey || o.customerTier, 'bezorg', { ref: o.ref, kind: 'status', status });
  }
  if (!bijgewerkt.length) return res.status(404).json({ error: 'Geen levering gevonden om bij te werken.' });
  save();
  logActivity(s.code, req.actor, 'zette ' + bijgewerkt.join(', ') + ' op "' + status + '"');
  sseToSupplier(s.code, 'sync', { scope: 'bezorg' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true, refs: bijgewerkt });
});

/* GPS van de bezorger: vluchtig (geen save), de klant krijgt positie en
   verwachte aankomsttijd live via SSE. */
app.post('/api/supplier/bezorg/gps', supplierAuth, (req, res) => {
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Geen geldige positie.' });
  const s = req.supplier;
  const B = db.data.bezorgers = db.data.bezorgers || {};
  B[s.code + ':' + (req.actor.staffId || 'beheer')] = { lat, lng, at: new Date().toISOString(), staffId: req.actor.staffId || null, name: req.actor.name };
  const mijnOnderweg = db.data.orders.filter(o => o.supplierCode === s.code && o.status === 'onderweg' &&
    o.bezorger && o.bezorger.staffId === (req.actor.staffId || null));
  const eta = [];
  for (const o of mijnOnderweg) {
    const m = o.geo && Number.isFinite(o.geo.lat) ? haversine({ lat, lng }, o.geo) : null;
    const e = m != null ? etaMinutes(m, 'driving') : null;
    if (e != null) o.etaMin = e;
    eta.push({ ref: o.ref, etaMin: e, meters: m });
    sseToCustomer(o.customerKey || o.customerTier, 'bezorg', { ref: o.ref, kind: 'gps', lat, lng, etaMin: e });
  }
  res.json({ ok: true, eta });
});

/* ================== tickets: activiteiten, tours en musea ================== */
function heeftTickets(s) {
  return ((db.data.supplierTypes[s.type] || {}).caps || []).includes('tickets');
}

app.post('/api/supplier/activiteit', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!heeftTickets(s)) return res.status(409).json({ error: 'Deze sector verkoopt geen tickets.' });
  if (!Array.isArray(s.activiteiten)) s.activiteiten = [];
  if (req.body.weg) {
    s.activiteiten = s.activiteiten.filter(a => a.id !== req.body.id);
    save(); sseToSupplier(s.code, 'sync', { scope: 'tickets' });
    return res.json({ ok: true, activiteiten: s.activiteiten });
  }
  const name = schoon(req.body.name, 60);
  const prijs = Number(req.body.prijs);
  const capaciteit = Math.min(500, Math.max(1, parseInt(req.body.capaciteit, 10) || 0));
  const tijden = (Array.isArray(req.body.tijden) ? req.body.tijden : String(req.body.tijden || '').split(','))
    .map(t => String(t).trim()).filter(t => /^\d{2}:\d{2}$/.test(t)).slice(0, 12);
  if (!name) return res.status(400).json({ error: 'Geef de activiteit een naam.' });
  if (!(prijs >= 0) || prijs > 10000) return res.status(400).json({ error: 'Geef een geldige prijs op.' });
  if (!capaciteit) return res.status(400).json({ error: 'Geef de capaciteit per tijdslot op.' });
  if (!tijden.length) return res.status(400).json({ error: 'Geef minstens een tijdslot op (bijv. 10:00).' });
  const velden = { name, desc: schoon(req.body.desc, 140), prijs, capaciteit, duur: schoon(req.body.duur, 30), tijden };
  if (req.body.id) {
    const a = s.activiteiten.find(x => x.id === req.body.id);
    if (!a) return res.status(404).json({ error: 'Activiteit niet gevonden.' });
    Object.assign(a, velden);
  } else {
    if (s.activiteiten.length >= 30) return res.status(400).json({ error: 'Tot 30 activiteiten per zaak.' });
    s.activiteiten.push({ id: 'a' + crypto.randomBytes(3).toString('hex'), ...velden });
  }
  save();
  logActivity(s.code, req.actor, 'werkte het activiteitenaanbod bij');
  sseToSupplier(s.code, 'sync', { scope: 'tickets' });
  res.json({ ok: true, activiteiten: s.activiteiten });
});

/* Het dagprogramma: per activiteit en tijdslot de bezetting en de gastenlijst.
   Voor de zaak-tab en de PDA (gids, security, ticketbalie). */
app.post('/api/supplier/programma', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!heeftTickets(s)) return res.status(409).json({ error: 'Deze sector verkoopt geen tickets.' });
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.datum || '')) ? req.body.datum : new Date().toISOString().slice(0, 10);
  const slots = [];
  for (const a of (s.activiteiten || [])) {
    for (const tijd of (a.tijden || [])) {
      const kaartjes = ticketsVoorSlot(s.code, a.id, datum, tijd).filter(t => t.paid);
      slots.push({
        activiteitId: a.id, naam: a.name, tijd, capaciteit: a.capaciteit,
        verkocht: kaartjes.reduce((n, t) => n + (t.personen || 1), 0),
        binnen: kaartjes.filter(t => t.checkin).reduce((n, t) => n + (t.personen || 1), 0),
        gasten: kaartjes.map(t => ({ codename: t.customerCodename, personen: t.personen || 1, code: t.code, binnen: !!t.checkin }))
      });
    }
  }
  slots.sort((x, y) => x.tijd.localeCompare(y.tijd));
  res.json({ datum, slots });
});

/* Check-in aan de deur: het personeelslid (security, gids, balie) vinkt de
   entreecode af, op eigen naam. Een ticket kan maar een keer naar binnen. */
app.post('/api/supplier/ticket/checkin', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!heeftTickets(s)) return res.status(409).json({ error: 'Deze sector verkoopt geen tickets.' });
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Voer de entreecode in.' });
  const t = db.data.boekingen.find(b => b.kind === 'ticket' && b.supplierCode === s.code && b.code === code);
  if (!t) return res.status(404).json({ error: 'Deze code hoort niet bij een ticket van uw zaak.' });
  if (!t.paid) return res.status(409).json({ error: 'Dit ticket is nog niet betaald.' });
  if (t.checkin) return res.status(409).json({ error: 'Al binnen: om ' + String(t.checkin.at).slice(11, 16) + ' afgevinkt door ' + t.checkin.door + '.' });
  const vandaag = new Date().toISOString().slice(0, 10);
  if (t.datum !== vandaag) return res.status(409).json({ error: 'Dit ticket is voor ' + t.datum + ' (' + t.tijd + '), niet voor vandaag.' });
  t.checkin = { at: new Date().toISOString(), door: req.actor.name, staffId: req.actor.staffId || null };
  t.status = 'afgerond';
  save();
  logActivity(s.code, req.actor, 'checkte ' + t.customerCodename + ' in (' + t.service.name + ', ' + (t.personen || 1) + 'p)');
  sseToCustomer(t.customerKey || t.customerTier, 'sync', { scope: 'tickets' });
  sseToSupplier(s.code, 'sync', { scope: 'tickets' });
  res.json({ ok: true, ticket: { naam: t.service.name, tijd: t.tijd, personen: t.personen || 1, codename: t.customerCodename } });
});

/* De eigen transferdienst van een activiteitenzaak: chauffeurs van de zaak
   halen gasten op; prijs 0 = inclusief bij het ticket, anders het afgesproken
   vaste bedrag per rit. De ritten zelf lopen via de gewone rittenmachinerie. */
app.post('/api/supplier/transfer', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (s.type !== 'activiteit') return res.status(409).json({ error: 'De transferdienst is voor activiteitenzaken.' });
  if (!s.transfer || typeof s.transfer !== 'object') s.transfer = { aan: false, prijs: 0 };
  if (req.body.aan != null) s.transfer.aan = !!req.body.aan;
  if (req.body.prijs != null) {
    const p = Number(req.body.prijs);
    if (!(p >= 0) || p > 1000) return res.status(400).json({ error: 'Geef een prijs tussen 0 (inclusief) en 1000 op.' });
    s.transfer.prijs = Math.round(p);
  }
  save();
  logActivity(s.code, req.actor, 'zette de transferdienst ' + (s.transfer.aan ? 'aan (\u20AC ' + s.transfer.prijs + ')' : 'uit'));
  sseToSupplier(s.code, 'sync', { scope: 'tickets' });
  res.json({ ok: true, transfer: s.transfer });
});

/* ================== autoverhuur: de zaak-kant ==================
   Vloot met vaste dagprijs, en de veiligheidsregels die schimmig verhuren
   onmogelijk maken: uitgeven kan pas MET voor-foto's, afronden pas MET
   na-foto's, en alles blijft vastgelegd met RTG als scheidsrechter. */
function isVerhuur(s, res) {
  if (s.type !== 'verhuur') { res.status(409).json({ error: 'Dit is geen verhuurzaak.' }); return false; }
  return true;
}
function huurVan(s, ref) {
  return db.data.boekingen.find(b => b.kind === 'huur' && b.supplierCode === s.code && b.ref === String(ref || ''));
}
function fotosVan(ref) { return db.data.huurFotos[ref] = db.data.huurFotos[ref] || { voor: [], na: [] }; }

app.post('/api/supplier/auto', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!isVerhuur(s, res)) return;
  if (!Array.isArray(s.autos)) s.autos = [];
  if (req.body.weg) {
    const a = s.autos.find(x => x.id === req.body.id);
    if (a) a.actief = false; // nooit echt weg: lopende huren verwijzen ernaar
    save(); sseToSupplier(s.code, 'sync', { scope: 'huur' });
    return res.json({ ok: true, autos: s.autos });
  }
  const name = schoon(req.body.name, 60);
  const dagprijs = Number(req.body.dagprijs);
  if (!name) return res.status(400).json({ error: 'Geef de auto een naam.' });
  if (!(dagprijs > 0) || dagprijs > 5000) return res.status(400).json({ error: 'Geef een geldige dagprijs op.' });
  const keuze = (v, opties, standaard) => opties.includes(v) ? v : standaard;
  const getal = (v, min, max, standaard) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : standaard; };
  const velden = {
    name, plate: schoon(req.body.plate, 12), dagprijs: Math.round(dagprijs), actief: true,
    categorie: schoon(req.body.categorie, 40) || 'Personenauto',
    transmissie: keuze(req.body.transmissie, ['handgeschakeld', 'automaat'], 'handgeschakeld'),
    brandstof: keuze(req.body.brandstof, ['benzine', 'diesel', 'elektrisch', 'hybride'], 'benzine'),
    stoelen: getal(req.body.stoelen, 1, 9, 5), deuren: getal(req.body.deuren, 2, 5, 4),
    airco: req.body.airco !== false, bagage: getal(req.body.bagage, 0, 9, 2),
    kmPerDag: getal(req.body.kmPerDag, 0, 2000, 0), // 0 = onbeperkt
    meerKm: Math.min(5, Math.max(0, Number(req.body.meerKm) || 0)),
    borg: getal(req.body.borg, 0, 5000, 0),
    minLeeftijd: getal(req.body.minLeeftijd, 18, 30, 21),
    icoon: schoon(req.body.icoon, 4) || '\uD83D\uDE97'
  };
  if (req.body.id) {
    const a = s.autos.find(x => x.id === req.body.id);
    if (!a) return res.status(404).json({ error: 'Auto niet gevonden.' });
    Object.assign(a, velden);
  } else {
    if (s.autos.length >= 60) return res.status(400).json({ error: 'Tot 60 auto\'s per zaak.' });
    s.autos.push({ id: 'c' + crypto.randomBytes(3).toString('hex'), ...velden });
  }
  save();
  logActivity(s.code, req.actor, 'werkte de verhuurvloot bij');
  sseToSupplier(s.code, 'sync', { scope: 'huur' });
  res.json({ ok: true, autos: s.autos });
});

app.post('/api/supplier/huur/overzicht', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVerhuur(s, res)) return;
  const vandaag = new Date().toISOString().slice(0, 10);
  const lijst = db.data.boekingen
    .filter(b => b.kind === 'huur' && b.supplierCode === s.code && b.paid &&
      (!['afgerond', 'geweigerd'].includes(b.status) || String(b.finishedAt || b.at).slice(0, 10) === vandaag))
    .slice(0, 40)
    .map(b => {
      const f = db.data.huurFotos[b.ref] || { voor: [], na: [] };
      const loc = db.data.huurLocaties[b.ref] || null;
      const auto = (s.autos || []).find(a => a.id === b.autoId) || null;
      return { ref: b.ref, codename: b.customerCodename, auto: b.autoNaam, kenteken: b.kenteken,
        van: b.van, tot: b.tot, dagen: b.dagen, prijs: b.price, status: b.status,
        borg: auto ? auto.borg : 0, spec: auto,
        uitgifte: b.uitgifte || null, inname: b.inname || null,
        fotosVoor: f.voor.length, fotosNa: f.na.length,
        sos: (b.sos || []).filter(x => !x.ok), sosAfgehandeld: (b.sos || []).filter(x => x.ok).length,
        locatie: loc && loc.aan && Number.isFinite(loc.lat) ? { lat: loc.lat, lng: loc.lng, at: loc.at } : null };
    });
  res.json({ huren: lijst });
});

/* De foto's zelf, per huur (zwaar: los van het overzicht opvragen). */
app.post('/api/supplier/huur/fotos', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVerhuur(s, res)) return;
  const h = huurVan(s, req.body.ref);
  if (!h) return res.status(404).json({ error: 'Huur niet gevonden.' });
  res.json({ fotos: db.data.huurFotos[h.ref] || { voor: [], na: [] } });
});

app.post('/api/supplier/huur/foto', express.json({ limit: '1.5mb' }), supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVerhuur(s, res)) return;
  const h = huurVan(s, req.body.ref);
  if (!h) return res.status(404).json({ error: 'Huur niet gevonden.' });
  const fase = req.body.fase === 'na' ? 'na' : 'voor';
  if (fase === 'voor' && h.status !== 'aangevraagd') return res.status(409).json({ error: 'Voor-foto\'s horen bij de uitgifte.' });
  if (fase === 'na' && h.status !== 'lopend') return res.status(409).json({ error: 'Na-foto\'s horen bij het inleveren.' });
  const foto = String(req.body.foto || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(foto) || foto.length > 400000)
    return res.status(400).json({ error: 'Stuur een foto (jpeg/png/webp, tot ~300 kB).' });
  const f = fotosVan(h.ref);
  if (f[fase].filter(x => x.door !== 'huurder').length >= 8) return res.status(400).json({ error: 'Tot acht foto\'s per kant.' });
  f[fase].push({ foto, door: req.actor.name, at: new Date().toISOString() });
  save();
  sseToCustomer(h.customerKey || h.customerTier, 'sync', { scope: 'huur' });
  res.json({ ok: true, aantal: f[fase].length });
});

/* Uitgeven en innemen, met de foto-eis als harde regel. */
app.post('/api/supplier/huur/status', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVerhuur(s, res)) return;
  const h = huurVan(s, req.body.ref);
  if (!h) return res.status(404).json({ error: 'Huur niet gevonden.' });
  const status = String(req.body.status || '');
  const f = db.data.huurFotos[h.ref] || { voor: [], na: [] };
  if (status === 'lopend') {
    if (h.status !== 'aangevraagd') return res.status(409).json({ error: 'Deze huur is niet klaar voor uitgifte.' });
    if (!h.paid) return res.status(409).json({ error: 'Nog niet betaald.' });
    if (!f.voor.length) return res.status(409).json({ error: 'Eerst de staat vastleggen: minstens een voor-foto (klant of balie).' });
    // km-stand en tankniveau bij uitgifte vastleggen (het startpunt, onbetwistbaar)
    const kmStart = Number(req.body.kmStart);
    if (!Number.isFinite(kmStart) || kmStart < 0) return res.status(400).json({ error: 'Vul de km-stand bij uitgifte in.' });
    h.uitgifte = { kmStart: Math.round(kmStart), tankStart: Math.min(8, Math.max(0, parseInt(req.body.tankStart, 10) || 8)), door: req.actor.name, at: new Date().toISOString() };
  } else if (status === 'afgerond') {
    if (h.status !== 'lopend') return res.status(409).json({ error: 'Deze huur loopt niet.' });
    if (!f.na.length) return res.status(409).json({ error: 'Eerst de staat bij inname vastleggen: minstens een na-foto.' });
    const kmEind = Number(req.body.kmEind);
    if (!Number.isFinite(kmEind) || (h.uitgifte && kmEind < h.uitgifte.kmStart))
      return res.status(400).json({ error: 'Vul de km-stand bij inname in (niet lager dan bij uitgifte).' });
    const tankEind = Math.min(8, Math.max(0, parseInt(req.body.tankEind, 10) || 8));
    // transparante meerkosten: extra km boven de vrije km, en het tankverschil
    const auto = (s.autos || []).find(a => a.id === h.autoId) || {};
    const gereden = h.uitgifte ? Math.round(kmEind) - h.uitgifte.kmStart : 0;
    const vrij = (auto.kmPerDag || 0) * (h.dagen || 1);
    const extraKm = (auto.kmPerDag && gereden > vrij) ? gereden - vrij : 0;
    const kmKosten = Math.round(extraKm * (auto.meerKm || 0) * 100) / 100;
    const tankTekort = h.uitgifte ? Math.max(0, h.uitgifte.tankStart - tankEind) : 0; // in achtsten
    const tankKosten = Math.round(tankTekort / 8 * 60 * 100) / 100; // ~60 euro voor een volle tank
    h.inname = { kmEind: Math.round(kmEind), tankEind, gereden, extraKm, kmKosten, tankTekort, tankKosten,
      meerkosten: Math.round((kmKosten + tankKosten) * 100) / 100, door: req.actor.name, at: new Date().toISOString() };
    h.finishedAt = new Date().toISOString();
    delete db.data.huurLocaties[h.ref];
  } else if (status === 'geweigerd') {
    if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager annuleert een huur.' });
    if (h.status === 'lopend') return res.status(409).json({ error: 'Een lopende huur annuleer je niet; rond hem af met na-foto\'s.' });
    h.finishedAt = new Date().toISOString();
  } else return res.status(400).json({ error: 'Onbekende status.' });
  h.status = status;
  save();
  logActivity(s.code, req.actor, (status === 'lopend' ? 'gaf ' : status === 'afgerond' ? 'nam in: ' : 'annuleerde ') + (h.autoNaam || h.ref) + ' (' + h.customerCodename + ')');
  notify(h.customerTier, { icon: '\u{1F697}', title: s.name,
    body: status === 'lopend' ? 'Goede reis! De staat is vastgelegd met ' + f.voor.length + ' foto(\u2019s) en ' + h.uitgifte.kmStart + ' km op de teller.'
      : status === 'afgerond' ? 'Ingeleverd. ' + (h.inname.meerkosten > 0 ? 'Meerkosten: \u20AC ' + h.inname.meerkosten + ' (' + h.inname.extraKm + ' extra km, tank).' : 'Geen meerkosten. Uw borg wordt vrijgegeven.') + ' Dank u wel!'
      : 'De huur is geannuleerd.', scope: 'orders' });
  sseToCustomer(h.customerKey || h.customerTier, 'sync', { scope: 'huur' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true, huur: { ref: h.ref, status: h.status } });
});

app.post('/api/supplier/huur/sos-ok', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVerhuur(s, res)) return;
  const h = huurVan(s, req.body.ref);
  if (!h || !Array.isArray(h.sos)) return res.status(404).json({ error: 'Geen SOS gevonden.' });
  let n = 0;
  for (const x of h.sos) if (!x.ok) { x.ok = { door: req.actor.name, at: new Date().toISOString() }; n++; }
  if (!n) return res.status(409).json({ error: 'Alles is al afgehandeld.' });
  save();
  logActivity(s.code, req.actor, 'handelde de SOS van ' + h.customerCodename + ' af');
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true, afgehandeld: n });
});

/* ================== contracten: opstellen en ondertekenen ==================
   Elke zaak kan een contract maken (verhuur, personeel of algemeen), gericht
   aan een lid (op codenaam) of aan een eigen personeelslid (staffId). Beide
   partijen tekenen digitaal: getypte naam + akkoord + tijdstempel. Eenmaal
   getekend verandert er niets meer aan de tekst: dat is het bewijs. */
function contractPubliek(c) {
  return { ref: c.ref, soort: c.soort, supplierCode: c.supplierCode, supplierName: c.supplierName,
    titel: c.titel, tekst: c.tekst, velden: c.velden || [],
    partij: c.partij.kind === 'lid' ? { kind: 'lid', codename: c.partij.codename } : { kind: 'staff', naam: c.partij.naam },
    status: c.status, tekenZaak: c.tekenZaak || null, tekenPartij: c.tekenPartij || null,
    huurRef: c.huurRef || null, at: c.at };
}

app.post('/api/supplier/contract/maak', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  const soort = ['verhuur', 'personeel', 'algemeen'].includes(req.body.soort) ? req.body.soort : 'algemeen';
  const titel = schoon(req.body.titel, 80);
  const tekst = schoon(req.body.tekst, 4000);
  if (!titel) return res.status(400).json({ error: 'Geef het contract een titel.' });
  if (!tekst || tekst.length < 20) return res.status(400).json({ error: 'Zet de voorwaarden in het contract (minstens een paar regels).' });
  const velden = (Array.isArray(req.body.velden) ? req.body.velden : []).slice(0, 20)
    .map(v => ({ label: schoon(v.label, 40), waarde: schoon(v.waarde, 120) })).filter(v => v.label);
  // ontvanger: een lid op codenaam, of een eigen personeelslid
  let partij;
  if (req.body.staffId != null) {
    const m = accounts.getStaffById(Number(req.body.staffId));
    if (!m || String(m.supplier_code).toUpperCase() !== s.code) return res.status(404).json({ error: 'Dit personeelslid kennen we niet bij uw zaak.' });
    partij = { kind: 'staff', staffId: m.id, naam: m.name };
  } else {
    const lid = keyVanCodenaam(req.body.codenaam);
    if (!lid) return res.status(404).json({ error: 'Geen lid gevonden met die codenaam. Vraag de klant naar de exacte codenaam uit de app.' });
    partij = { kind: 'lid', key: lid.key, codename: lid.codename };
  }
  let huurRef = null;
  if (soort === 'verhuur' && req.body.huurRef) {
    const h = db.data.boekingen.find(b => b.kind === 'huur' && b.ref === String(req.body.huurRef) && b.supplierCode === s.code);
    if (h) { huurRef = h.ref; if (partij.kind === 'lid' && !req.body.codenaam) partij = { kind: 'lid', key: h.customerKey, codename: h.customerCodename }; }
  }
  const c = {
    ref: 'RTG-C-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    soort, supplierCode: s.code, supplierName: s.name, titel, tekst, velden, partij, huurRef,
    status: 'wacht', tekenZaak: null, tekenPartij: null, at: new Date().toISOString()
  };
  db.data.contracten.unshift(c);
  db.data.contracten = db.data.contracten.slice(0, 20000);
  save();
  logActivity(s.code, req.actor, 'stelde een contract op (' + soort + ') voor ' + (partij.codename || partij.naam));
  if (partij.kind === 'lid') { notify(partij.key, { icon: '\u{1F4DD}', title: s.name + ' \u2013 contract', body: titel + ': klaar om te ondertekenen in uw app.', scope: 'contract' }); sseToCustomer(partij.key, 'sync', { scope: 'contract' }); }
  sseToSupplier(s.code, 'sync', { scope: 'contract' });
  res.json({ ok: true, contract: contractPubliek(c) });
});

app.post('/api/supplier/contracten', supplierAuth, (req, res) => {
  const s = req.supplier;
  // managers zien alle contracten van de zaak; personeel alleen dat van henzelf
  const lijst = db.data.contracten.filter(c => c.supplierCode === s.code &&
    (req.actor.manager || (c.partij.kind === 'staff' && c.partij.staffId === req.actor.staffId)))
    .slice(0, 200).map(contractPubliek);
  res.json({ contracten: lijst });
});

/* Ondertekenen vanuit de zaak-app of de PDA: een manager tekent namens de
   zaak; het aangeschreven personeelslid tekent zijn eigen kant. */
app.post('/api/supplier/contract/teken', supplierAuth, (req, res) => {
  const s = req.supplier;
  const c = db.data.contracten.find(x => x.ref === String(req.body.ref || '') && x.supplierCode === s.code);
  if (!c) return res.status(404).json({ error: 'Contract niet gevonden.' });
  if (c.status === 'geweigerd') return res.status(409).json({ error: 'Dit contract is geweigerd.' });
  const naam = schoon(req.body.naam, 60);
  if (!naam || req.body.akkoord !== true) return res.status(400).json({ error: 'Typ uw naam en vink akkoord aan om te tekenen.' });
  const zijde = (c.partij.kind === 'staff' && c.partij.staffId === req.actor.staffId) ? 'partij' : (req.actor.manager ? 'zaak' : null);
  if (!zijde) return res.status(403).json({ error: 'Dit contract staat niet op uw naam.' });
  if (zijde === 'zaak' && c.tekenZaak) return res.status(409).json({ error: 'De zaak heeft al getekend.' });
  if (zijde === 'partij' && c.tekenPartij) return res.status(409).json({ error: 'U heeft al getekend.' });
  const teken = { naam, at: new Date().toISOString() };
  if (zijde === 'zaak') c.tekenZaak = teken; else c.tekenPartij = teken;
  if (c.tekenZaak && c.tekenPartij) c.status = 'getekend';
  save();
  logActivity(s.code, req.actor, 'tekende contract ' + c.ref);
  if (c.partij.kind === 'lid') sseToCustomer(c.partij.key, 'sync', { scope: 'contract' });
  sseToSupplier(s.code, 'sync', { scope: 'contract' });
  res.json({ ok: true, contract: contractPubliek(c) });
});

/* ================== vastgoed: het makelaarskantoor ==================
   Panden aanbieden (gericht aan gekozen leden of publiek), biedingen,
   bezichtigingen met keyless toegang, en snelle contracten. */
function isVastgoed(s, res) {
  if (s.type !== 'vastgoed') { res.status(409).json({ error: 'Dit is geen makelaarskantoor.' }); return false; }
  return true;
}
function pandVan(s, id) { return (s.panden || []).find(p => p.id === id); }
function keylessCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 6; i++) c += A[crypto.randomInt(A.length)]; return c; }

app.post('/api/supplier/pand', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  if (!Array.isArray(s.panden)) s.panden = [];
  if (req.body.weg) {
    s.panden = s.panden.filter(p => p.id !== req.body.id);
    save(); sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
    return res.json({ ok: true, panden: s.panden });
  }
  const titel = schoon(req.body.titel, 80);
  const prijs = Number(req.body.prijs);
  if (!titel) return res.status(400).json({ error: 'Geef het pand een titel.' });
  if (!(prijs > 0)) return res.status(400).json({ error: 'Geef een geldige prijs op.' });
  const num = (v, max) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 && n <= max ? n : 0; };
  const velden = {
    titel, prijs: Math.round(prijs),
    soort: ['woning', 'appartement', 'villa', 'commercieel', 'grond'].includes(req.body.soort) ? req.body.soort : 'woning',
    transactie: req.body.transactie === 'huur' ? 'huur' : 'koop',
    plaats: schoon(req.body.plaats, 60), adres: schoon(req.body.adres, 80),
    slaapkamers: num(req.body.slaapkamers, 30), badkamers: num(req.body.badkamers, 20),
    oppervlakte: num(req.body.oppervlakte, 100000), perceel: num(req.body.perceel, 10000000),
    tuin: !!req.body.tuin, zwembad: !!req.body.zwembad, garage: num(req.body.garage, 20),
    energielabel: schoon(req.body.energielabel, 3) || null,
    omschrijving: schoon(req.body.omschrijving, 1200),
    keyless: !!req.body.keyless,
    status: ['beschikbaar', 'onder-optie', 'verkocht', 'verhuurd'].includes(req.body.status) ? req.body.status : undefined
  };
  if (req.body.id) {
    const p = pandVan(s, req.body.id);
    if (!p) return res.status(404).json({ error: 'Pand niet gevonden.' });
    if (velden.status === undefined) delete velden.status;
    Object.assign(p, velden);
  } else {
    if ((s.panden || []).length >= 300) return res.status(400).json({ error: 'Tot 300 panden per kantoor.' });
    s.panden.push({ id: 'p' + crypto.randomBytes(3).toString('hex'), fotos: [], status: 'beschikbaar', ...velden });
  }
  save();
  logActivity(s.code, req.actor, 'werkte het vastgoedaanbod bij');
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true, panden: s.panden });
});

/* Een foto bij een pand (los opgeslagen, net als de huurfoto's). */
app.post('/api/supplier/pand/foto', express.json({ limit: '1.5mb' }), supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  if (!managerOnly(req, res)) return;
  const p = pandVan(s, req.body.id);
  if (!p) return res.status(404).json({ error: 'Pand niet gevonden.' });
  const foto = String(req.body.foto || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(foto) || foto.length > 500000) return res.status(400).json({ error: 'Stuur een foto (tot ~400 kB).' });
  p.fotos = p.fotos || [];
  if (req.body.weg != null) { p.fotos.splice(Number(req.body.weg), 1); }
  else { if (p.fotos.length >= 12) return res.status(400).json({ error: 'Tot 12 foto\'s per pand.' }); p.fotos.push(foto); }
  save();
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true, aantal: p.fotos.length });
});

/* Aanbieden: kies specifieke leden (op codenaam), of publiek/naar de volgers.
   Gerichte leden krijgen een melding en zien het pand prive in hun app. */
app.post('/api/supplier/aanbieding', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  const p = pandVan(s, req.body.pandId);
  if (!p) return res.status(404).json({ error: 'Pand niet gevonden.' });
  const codenamen = Array.isArray(req.body.codenamen) ? req.body.codenamen : String(req.body.codenamen || '').split(',');
  const aanKeys = [], nietGevonden = [];
  for (const cn of codenamen.map(x => String(x).trim()).filter(Boolean)) {
    const lid = keyVanCodenaam(cn);
    if (lid) aanKeys.push(lid.key); else nietGevonden.push(cn);
  }
  const publiek = !!req.body.publiek;
  if (!publiek && !aanKeys.length) return res.status(400).json({ error: 'Kies minstens een lid (op codenaam) of maak het aanbod publiek.' });
  const a = { ref: 'RTG-A-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    supplierCode: s.code, pandId: p.id, aanKeys, publiek, at: new Date().toISOString() };
  db.data.vastgoedAanbod.unshift(a);
  db.data.vastgoedAanbod = db.data.vastgoedAanbod.slice(0, 20000);
  // gerichte leden persoonlijk op de hoogte brengen
  for (const key of aanKeys) {
    notify(key, { icon: '\u{1F3E1}', title: s.name, body: 'Voor u geselecteerd: ' + p.titel + ' \u00B7 \u20AC ' + p.prijs.toLocaleString('nl-NL'), scope: 'vastgoed' });
    sseToCustomer(key, 'sync', { scope: 'vastgoed' });
  }
  // en desgewenst op De Salon voor de volgers
  if (publiek && req.body.salon) salonNaarVolgers(s, p.titel + ' \u2013 ' + p.plaats + ' \u00B7 \u20AC ' + p.prijs.toLocaleString('nl-NL') + '. ' + (p.omschrijving || '').slice(0, 140));
  save();
  logActivity(s.code, req.actor, 'bood ' + p.titel + ' aan (' + (publiek ? 'publiek' : aanKeys.length + ' lid/leden') + ')');
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true, aanbieding: { ref: a.ref, aan: aanKeys.length, publiek, nietGevonden } });
});

/* De slimme backoffice: kerncijfers, panden, en alles wat aandacht vraagt. */
app.post('/api/supplier/vastgoed/overzicht', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  const panden = s.panden || [];
  const bez = db.data.bezichtigingen.filter(b => b.supplierCode === s.code).slice(0, 100);
  const bod = db.data.biedingen.filter(b => b.supplierCode === s.code).slice(0, 100);
  const pandTitel = id => (panden.find(p => p.id === id) || {}).titel || id;
  res.json({
    stats: {
      totaal: panden.length,
      beschikbaar: panden.filter(p => p.status === 'beschikbaar').length,
      onderOptie: panden.filter(p => p.status === 'onder-optie').length,
      verkocht: panden.filter(p => p.status === 'verkocht' || p.status === 'verhuurd').length,
      openBezichtigingen: bez.filter(b => b.status === 'aangevraagd').length,
      openBiedingen: bod.filter(b => b.status === 'open').length,
      portefeuille: panden.filter(p => p.status !== 'verkocht' && p.status !== 'verhuurd').reduce((n, p) => n + (p.transactie === 'koop' ? p.prijs : 0), 0)
    },
    panden,
    aanbiedingen: db.data.vastgoedAanbod.filter(a => a.supplierCode === s.code).slice(0, 60)
      .map(a => ({ ref: a.ref, pand: pandTitel(a.pandId), aan: a.aanKeys.length, publiek: a.publiek, at: a.at })),
    bezichtigingen: bez.map(b => ({ ref: b.ref, pand: pandTitel(b.pandId), codename: b.codename, wens: b.wens, status: b.status, moment: b.moment || null, keyless: !!b.keyless })),
    biedingen: bod.map(b => ({ ref: b.ref, pand: pandTitel(b.pandId), codename: b.codename, bedrag: b.bedrag, status: b.status, tegenbod: b.tegenbod || null }))
  });
});

/* Bezichtiging bevestigen (met moment) en, als het pand keyless is, een
   toegangsvenster verlenen; of afwijzen. */
app.post('/api/supplier/bezichtiging/beslis', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  const b = db.data.bezichtigingen.find(x => x.ref === String(req.body.ref || '') && x.supplierCode === s.code);
  if (!b) return res.status(404).json({ error: 'Bezichtiging niet gevonden.' });
  const p = pandVan(s, b.pandId) || {};
  if (req.body.actie === 'afwijzen') { b.status = 'afgewezen'; }
  else if (req.body.actie === 'bevestigen') {
    const moment = String(req.body.moment || '');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(moment)) return res.status(400).json({ error: 'Kies datum en tijd voor de bezichtiging.' });
    b.status = 'bevestigd'; b.moment = moment;
    // keyless: een venster rond het afgesproken moment (30 min voor tot 2 uur na)
    if (p.keyless) {
      const t = new Date(moment).getTime();
      b.keyless = { code: keylessCode(), van: new Date(t - 30 * 60000).toISOString(), tot: new Date(t + 120 * 60000).toISOString(), gebruikt: [] };
    }
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  save();
  notify(b.customerTier || b.key, { icon: '\u{1F3E1}', title: s.name,
    body: req.body.actie === 'bevestigen'
      ? 'Bezichtiging van ' + p.titel + ' bevestigd: ' + String(b.moment).replace('T', ' ').slice(0, 16) + (b.keyless ? ' \u00B7 keyless toegang staat klaar.' : '')
      : 'De bezichtiging van ' + p.titel + ' kon helaas niet.', scope: 'vastgoed' });
  sseToCustomer(b.key, 'sync', { scope: 'vastgoed' });
  logActivity(s.code, req.actor, (req.body.actie === 'bevestigen' ? 'bevestigde' : 'wees af') + ' bezichtiging ' + b.ref);
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true });
});

/* Een bod behandelen: accepteren, afwijzen of een tegenbod doen. */
app.post('/api/supplier/bod/beslis', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  const b = db.data.biedingen.find(x => x.ref === String(req.body.ref || '') && x.supplierCode === s.code);
  if (!b) return res.status(404).json({ error: 'Bod niet gevonden.' });
  if (b.status !== 'open') return res.status(409).json({ error: 'Dit bod is al behandeld.' });
  const p = pandVan(s, b.pandId) || {};
  if (req.body.actie === 'accepteren') { b.status = 'geaccepteerd'; if (pandVan(s, b.pandId)) pandVan(s, b.pandId).status = 'onder-optie'; }
  else if (req.body.actie === 'afwijzen') { b.status = 'afgewezen'; }
  else if (req.body.actie === 'tegenbod') {
    const tb = Number(req.body.tegenbod);
    if (!(tb > 0)) return res.status(400).json({ error: 'Geef een geldig tegenbod.' });
    b.status = 'tegenbod'; b.tegenbod = Math.round(tb);
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  save();
  notify(b.customerTier || b.key, { icon: '\u{1F3E1}', title: s.name,
    body: b.status === 'geaccepteerd' ? 'Uw bod op ' + p.titel + ' is geaccepteerd! We stellen een contract op.'
      : b.status === 'tegenbod' ? 'Tegenbod op ' + p.titel + ': \u20AC ' + b.tegenbod.toLocaleString('nl-NL')
      : 'Uw bod op ' + p.titel + ' is helaas afgewezen.', scope: 'vastgoed' });
  sseToCustomer(b.key, 'sync', { scope: 'vastgoed' });
  logActivity(s.code, req.actor, 'behandelde bod ' + b.ref + ' (' + b.status + ')');
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true, status: b.status });
});
};
