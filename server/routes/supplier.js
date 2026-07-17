/* Domein "supplier" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
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


/* ---- de eigen mini-boardroom van de zaak: functies, HR en marketing ---- */
app.post('/api/supplier/zaak/board', supplierAuth, (req, res) => {
  res.json(zaakBoard(req.supplier));
});
app.post('/api/supplier/zaak/functie', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const r = zaakZet(req.supplier, String(req.body.id || ''), req.body.aan !== false);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, functies: r.functies });
});

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
      logInlog('zaak', false, s.code + '#' + req.body.staffId, req);
      return res.status(401).json({ error: 'Onjuiste PIN.' });
    }
    pinFails.delete(fk);
    logInlog('zaak', true, s.code + ' · ' + staff.name, req);
    actor = { name: staff.name, role: staff.role, staffId: staff.id, manager: staff.role === 'manager' };
  } else if (hasCred(req.body)) {
    if (!DEMO) return res.status(403).json({ error: 'Demo-inlog is uitgeschakeld. Log in op uw naam met uw persoonlijke pincode.' });
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
  // Nieuw personeel gaat via een uitnodiging (kassacode) en een eigen RTG-account;
  // rechtstreeks toevoegen bestaat alleen nog in de demo.
  if (!DEMO) return res.status(403).json({ error: 'Nieuw personeel meldt zich zelf aan: maak een uitnodiging (kassacode) en geef die samen met de bedrijfsnaam door.' });
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

/* ---- personeel = RTG-account: uitnodigen (kassacode) en zelf aanmelden ----
   Nieuw personeel heeft altijd een eigen RTG-account; een betaalde pas is niet
   nodig, het gratis account is genoeg. Een manager nodigt iemand uit en krijgt
   een eenmalige kassacode; de medewerker meldt zich pas daarna zelf aan met de
   bedrijfsnaam en die kassacode, en bewijst met de eigen RTG-inlog dat het
   account echt is. Zo kan niemand zonder uitnodiging bij een bedrijf. */
const KASSA_ALFABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // zonder verwarrende tekens
function maakKassacode() {
  let c = '';
  for (let i = 0; i < 6; i++) c += KASSA_ALFABET[crypto.randomInt(KASSA_ALFABET.length)];
  return c;
}
function invitesVan(code) {
  db.data.staffInvites = db.data.staffInvites || {};
  db.data.staffInvites[code] = db.data.staffInvites[code] || [];
  return db.data.staffInvites[code];
}
function findSupplierByName(naam) {
  const n = String(naam || '').trim().toLowerCase();
  if (!n) return null;
  return (db.data.suppliers || []).find(s => String(s.name || '').trim().toLowerCase() === n) || null;
}

// Eenmalige uitnodiging aanmaken (gedeeld door /staff/invite en het aannemen
// van een sollicitant). Ruimt meteen verlopen/gebruikte codes op.
function maakInvite(supplier, actor, { naam, role, func }) {
  const lijst = invitesVan(supplier.code);
  const nu = Date.now();
  db.data.staffInvites[supplier.code] = lijst.filter(i => !i.used && i.expires > nu);
  const inv = {
    kassacode: maakKassacode(), naam: naam || null,
    role: role === 'manager' ? 'manager' : 'staff', func: func || null,
    door: actor.name, expires: nu + 30 * 86400000, // 30 dagen geldig
    used: false, createdAt: new Date().toISOString()
  };
  db.data.staffInvites[supplier.code].push(inv);
  save();
  logActivity(supplier.code, actor, actor.name + ' nodigde een medewerker uit' + (inv.naam ? ' (' + inv.naam + ')' : ''));
  return inv;
}

// Manager nodigt een medewerker uit: geeft een eenmalige kassacode terug.
app.post('/api/supplier/staff/invite', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan medewerkers uitnodigen.' });
  const inv = maakInvite(req.supplier, req.actor, {
    naam: schoon(req.body.name, 60), role: req.body.role, func: String(req.body.func || '').slice(0, 40)
  });
  res.json({ ok: true, invite: { kassacode: inv.kassacode, naam: inv.naam, role: inv.role, func: inv.func, expires: inv.expires }, bedrijf: req.supplier.name });
});

// Manager trekt een open uitnodiging in (kassacode wordt onbruikbaar).
app.post('/api/supplier/staff/invite/intrek', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan uitnodigingen intrekken.' });
  const kassacode = String(req.body.kassacode || '').trim().toUpperCase();
  const lijst = invitesVan(req.supplier.code);
  const idx = lijst.findIndex(i => i.kassacode === kassacode && !i.used);
  if (idx < 0) return res.status(404).json({ error: 'Deze uitnodiging bestaat niet (meer).' });
  lijst.splice(idx, 1);
  save();
  logActivity(req.supplier.code, req.actor, req.actor.name + ' trok een uitnodiging in');
  res.json({ ok: true });
});

// Manager reset de code van een collega (vergeten of misbruik): nieuwe pincode,
// eenmalig getoond, om door te geven.
app.post('/api/supplier/staff/reset-pin', supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan codes resetten.' });
  const st = accounts.getStaffById(Number(req.body.staffId));
  if (!st || String(st.supplier_code).toUpperCase() !== req.supplier.code)
    return res.status(404).json({ error: 'Dit teamlid kennen we niet.' });
  const pin = accounts.makePin();
  await accounts.setStaffPin(st.id, pin);
  logActivity(req.supplier.code, req.actor, req.actor.name + ' resette de code van ' + st.name);
  try { notifySupplier(req.supplier.code, { kind: 'team', text: 'De code van ' + st.name + ' is gereset door ' + req.actor.name + '.' }); } catch (e) {}
  res.json({ ok: true, staff: accounts.publicStaff(st), pin });
});

// Manager ziet de open uitnodigingen (om een kassacode opnieuw te tonen).
app.post('/api/supplier/staff/invites', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager ziet de uitnodigingen.' });
  const nu = Date.now();
  const lijst = (invitesVan(req.supplier.code)).filter(i => !i.used && i.expires > nu)
    .map(i => ({ kassacode: i.kassacode, naam: i.naam, role: i.role, func: i.func, expires: i.expires }));
  res.json({ ok: true, invites: lijst, bedrijf: req.supplier.name });
});

// De medewerker meldt zich aan: bedrijfsnaam + kassacode + eigen RTG-inlog.
app.post('/api/supplier/staff/join', async (req, res) => {
  const bucket = 'join:' + req.ip;
  if (tooManyTries(res, bucket)) return;
  const bedrijf = String(req.body.bedrijf || '').trim();
  const kassacode = String(req.body.kassacode || '').trim().toUpperCase();
  const pin = String(req.body.pin || '').trim();
  if (!bedrijf || !kassacode) { noteFailedTry(bucket); return res.status(400).json({ error: 'Vul de bedrijfsnaam en de kassacode in.' }); }
  if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'Kies een pincode van 4 cijfers voor uw dagelijkse inlog.' });
  // 1) bewijs dat u een eigen RTG-account hebt (een betaalde pas is niet nodig)
  const lid = accounts.findByLogin(req.body.login);
  if (!lid || !(await accounts.verifyPassword(String(req.body.password || ''), lid.password_hash))) {
    noteFailedTry(bucket);
    return res.status(401).json({ error: 'Onjuiste RTG-inloggegevens. Meld u aan met uw eigen RTG-account.' });
  }
  // 2) het bedrijf moet bestaan en de kassacode moet erbij horen (eenmalig)
  const s = findSupplierByName(bedrijf);
  if (!s) { noteFailedTry(bucket); return res.status(404).json({ error: 'We kennen geen bedrijf met die naam. Controleer de bedrijfsnaam bij uw werkgever.' }); }
  const lijst = invitesVan(s.code);
  const inv = lijst.find(i => i.kassacode === kassacode && !i.used && i.expires > Date.now());
  if (!inv) { noteFailedTry(bucket); return res.status(403).json({ error: 'Deze kassacode klopt niet, is al gebruikt of verlopen. Vraag uw werkgever om een nieuwe uitnodiging.' }); }
  // 3) niet dubbel aanmelden bij hetzelfde bedrijf
  if (accounts.staffByMember(s.code, lid.id)) {
    inv.used = true; save();
    return res.status(409).json({ error: 'U bent al aangemeld bij dit bedrijf. Log in met uw naam en pincode.' });
  }
  loginFails.delete(bucket);
  const naam = inv.naam || accounts.realNameOf(lid) || 'Medewerker';
  const staff = await accounts.createStaff({ supplierCode: s.code, name: naam, role: inv.role, func: inv.func, pin, memberId: lid.id, memberTier: lid.tier });
  inv.used = true; inv.memberId = lid.id; inv.usedAt = new Date().toISOString();
  save();
  logActivity(s.code, { name: naam, role: inv.role }, naam + ' meldde zich aan als teamlid (RTG-lid)');
  try { notifySupplier(s.code, { kind: 'team', text: naam + ' heeft zich aangemeld bij het team.' }); } catch (e) {}
  res.json({ ok: true, code: s.code, staffId: staff.id, name: naam, role: inv.role });
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

app.post('/api/supplier/chat/send', supplierAuth, (req, res) => {
  const chat = db.data.guestChats[String(req.body.key || '')];
  if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Gesprek niet gevonden.' });
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  chat.messages.push({ from: 'partner', who: req.actor.name, text, lang: talen.taalVan(req.body.lang), at: new Date().toISOString() });
  chat.messages = chat.messages.slice(-120);
  chat.unreadGuest += 1;
  chat.lastAt = new Date().toISOString();
  save();
  logActivity(req.supplier.code, req.actor, 'antwoordde ' + chat.codename + ' (' + (chat.dept || 'Team') + ')');
  notify(chat.tier, { icon: '💬', title: req.supplier.name + (chat.dept ? ' · ' + chat.dept : ''), body: text.slice(0, 90), scope: 'gchat' });
  sseToCustomer(chat.customerKey, 'sync', { scope: 'gchat' });
  sseToSupplier(req.supplier.code, 'sync', { scope: 'gchat' });
  trChat(chat.messages, talen.taalVan(req.body.lang)).then(messages => res.json({ ok: true, messages }));
});

app.post('/api/supplier/chat/history', supplierAuth, (req, res) => {
  const chat = db.data.guestChats[String(req.body.key || '')];
  if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Gesprek niet gevonden.' });
  if (chat.unreadPartner) { chat.unreadPartner = 0; save(); }
  trChat(chat.messages, talen.taalVan(req.body.lang)).then(messages => res.json({ messages, codename: chat.codename }));
});

/* De Salon van de klant zoals de partner die vooraf mag zien: privacy-first,
   dus alleen de codenaam, de pas en de eigen Salon-posts (nooit de echte naam).
   Zo bent u geen vreemden van elkaar. Alleen op te vragen als er echt een open
   lijn met deze klant is (het gesprek moet bij deze zaak horen). */
app.post('/api/supplier/klant/salon', supplierAuth, (req, res) => {
  const chat = db.data.guestChats[String(req.body.key || '')];
  if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Gesprek niet gevonden.' });
  res.json(klantSalon(chat.customerKey));
});

/* Rechtstreekse ontvangsten: wat er direct van klanten binnenkwam, plus het
   sturen en intrekken van betaalverzoeken (op codenaam). */
app.post('/api/supplier/ontvangsten', supplierAuth, (req, res) => {
  res.json(dpOntvangsten(req.supplier.code));
});
app.post('/api/supplier/betaalverzoek', supplierAuth, (req, res) => {
  const cent = req.body.centen != null ? Math.round(Number(req.body.centen)) : Math.round(Number(req.body.bedrag) * 100);
  const r = dpVerzoekMaak({ supplierCode: req.supplier.code, actorName: req.actor.name,
    naarCodename: req.body.codename, bedragCenten: cent, omschrijving: req.body.omschrijving });
  if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, 'stuurde een betaalverzoek van € ' + (cent / 100).toFixed(2));
  res.json(r);
});
app.post('/api/supplier/betaalverzoek/intrek', supplierAuth, (req, res) => {
  const r = dpVerzoekIntrek(req.supplier.code, String(req.body.ref || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
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
    return applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ ok: true, chat: c }));
  }
  if (req.body.action === 'aannemen') {
    // Aannemen maakt geen personeelsaccount meer aan: de nieuwe collega is een
    // RTG-lid en meldt zich zelf aan met de bedrijfsnaam + deze kassacode.
    const inv = maakInvite(req.supplier, req.actor, { naam: a.name, role: 'staff', func: a.func });
    a.status = 'aangenomen';
    ensureApplyChat(req.supplier.code, a); // ook aangenomen sollicitanten kunnen chatten om af te spreken
    save();
    logActivity(req.supplier.code, req.actor, 'nam ' + a.name + ' aan als ' + a.func);
    sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
    sseToOffice('sync', { scope: 'team' });
    notifyApplicant(a, req.supplier);
    // krijgt de sollicitant meldingen in de app, dan sturen we de kassacode direct mee
    if (a.key && db.data.notifications[a.key])
      notify(a.key, { icon: '🎉', title: 'Aangenomen bij ' + req.supplier.name, body: 'Meld u aan in de leverancier-app met bedrijfsnaam "' + req.supplier.name + '" en kassacode ' + inv.kassacode + '.' });
    return res.json({ ok: true, invite: { kassacode: inv.kassacode, naam: a.name, func: a.func }, bedrijf: req.supplier.name });
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
  applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ chat: c }));
});

app.post('/api/supplier/apply/chat/send', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const chat = db.data.applyChats[String(req.body.id || '')];
  if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Chat niet gevonden.' });
  const m = chatStuur(chat, 'werkgever', req.supplier.name, req.body.text, talen.taalVan(req.body.lang));
  if (!m) return res.status(400).json({ error: 'Typ een bericht.' });
  // de sollicitant krijgt een seintje
  const app = (db.data.applications[req.supplier.code] || []).find(x => x.id === chat.id);
  if (app && app.key && db.data.notifications[app.key])
    notify(app.key, { icon: '💬', title: 'Bericht van ' + chat.bedrijf, body: m.tekst.slice(0, 80) });
  applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ chat: c }));
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
  // gaat de zaak dicht, dan komt de shift-samenvatting vanzelf als bericht
  // naar het team: het avondbriefing-moment zonder dat iemand erom vraagt
  if (changed.includes('bestellingen dicht')) {
    try {
      const sh = shiftSamenvatting(req.supplier);
      const delen = [
        '€ ' + sh.omzet.toFixed(2) + ' omzet, ' + sh.bonnen + ' bon(nen)',
        sh.gasten.personen ? sh.gasten.personen + ' gasten aan tafel' : null,
        sh.gasten.noShows ? sh.gasten.noShows + ' no-show(s)' : null,
        sh.toppers.length ? 'topper: ' + sh.toppers[0].aantal + 'x ' + sh.toppers[0].naam : null,
        sh.derving ? '€ ' + sh.derving.toFixed(2) + ' derving' : null
      ].filter(Boolean);
      notifySupplier(req.supplier.code, { icon: '🌙', title: 'Shift-samenvatting ' + sh.datum, body: delen.join(' · ') });
    } catch (e) {}
  }
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
  const orders = ordersVanZaak(s.code).filter(o => o.paid && o.status !== 'geweigerd' && o.status !== 'terugbetaald');
  const ritten = db.data.rides.filter(r => r.supplierCode === s.code && r.paid && r.status !== 'geweigerd');
  const boekingen = boekingenVanZaak(s.code).filter(b => b.paid && b.status !== 'geweigerd');
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
  for (const o of ordersVanZaak(s.code)) {
    if (!o.paid || o.status !== 'nieuw') continue;
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

app.post('/api/supplier/ai', supplierAuth, async (req, res) => {
  const s = req.supplier;
  const q = String(req.body.q || '').trim().slice(0, 300);
  if (!q) return res.status(400).json({ error: 'Stel een vraag.' });
  const ql = q.toLowerCase();
  const A = (reply, did) => res.json({ reply, did: !!did });

  // het persoonlijke geheugen (dezelfde motor als De Butler van de leden):
  // onthouden, opvragen en wissen, per persoon binnen deze zaak
  if (fluisterZeg && (/^onthoud\b/i.test(q) || /vergeet alles/i.test(q) || /wat (weet|onthoud) je (over|van) mij/i.test(q))) {
    const fKey = 'zaak:' + s.code + ':' + (req.actor && req.actor.staffId != null ? req.actor.staffId : 'eigenaar');
    const r = await fluisterZeg(fKey, (req.actor && req.actor.name) || s.name, q);
    if (!r.error) return A(r.antwoord, !!r.geleerd);
  }

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
    const open = ordersVanZaak(s.code).filter(o => !['geserveerd', 'geweigerd', 'terugbetaald', 'bezorgd', 'opgehaald'].includes(o.status));
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
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  const list = db.data.supplierTeam[req.supplier.code] = (db.data.supplierTeam[req.supplier.code] || []);
  list.push({ who: req.actor.name, role: req.actor.role, text, at: new Date().toISOString() });
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
    // het vuurplan: eigen bereidingstijd in minuten (0 of leeg = nominale tijd per kant)
    prepMin: Math.min(90, Math.max(0, parseInt(m.prepMin, 10) || 0)) || undefined,
    // 86 en de opgebouwde gerechtenkennis overleven het bewerken van de kaart
    uitverkocht: !!m.uitverkocht || undefined,
    kennis: m.kennis && typeof m.kennis === 'object'
      ? Object.fromEntries(Object.entries(m.kennis).filter(([k]) => ['recept', 'bereiding', 'allergenen', 'pairing'].includes(k)).map(([k, v]) => [k, String(v).slice(0, 1500)]))
      : undefined,
    recept: String(m.recept || '').slice(0, 1500)
    };
  });
  save();
  logActivity(req.supplier.code, req.actor, 'werkte de menukaart bij');
  res.json({ ok: true, menu: req.supplier.menu });
});

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

app.post('/api/supplier/menu/get', auth, (req, res) => {
  const s = findSupplier(req.body.code);
  if (!s) return res.status(404).json({ error: 'Leverancier niet gevonden.' });
  const lang = req.body.lang;
  const menu = (s.menu || []).map(m => ({ ...m, name: i18n.localize(m.name, lang), desc: i18n.localize(m.desc, lang), cat: i18n.localize(m.cat, lang) }));
  // leeftijdsinfo voor de bestelflow: mag dit lid hier alcohol bestellen?
  const aInfo = alcoholGrensVan(s);
  const lftM = leeftijdVan(geborenVan(req.session));
  res.json({ supplier: { ...publicSupplier(s, lang), favoriet: isFavoriet(req.session.key, s.code) }, menu,
    alcohol: { grens: aInfo.grens, land: aInfo.land, geverifieerd: lftM != null, mag: lftM == null || lftM >= aInfo.grens } });
});


  // domein-deelmodules (aparte bestanden, zelfde gedeelde kern)
  require('./supplier/agent')(kern);
  require('./supplier/tools')(kern);
  require('./supplier/keuken')(kern);
  require('./supplier/verblijf')(kern);
  require('./supplier/gast')(kern);
  require('./supplier/pda')(kern);
  require('./supplier/bezorg')(kern);
  require('./supplier/tickets')(kern);
  require('./supplier/verhuur')(kern);
  require('./supplier/charter')(kern);
  require('./supplier/contract')(kern);
  require('./supplier/vastgoed')(kern);
  require('./supplier/boerderij')(kern);
  require('./supplier/creator')(kern);
  require('./supplier/samenwerking')(kern);
  require('./supplier/groothandel')(kern);
  require('./supplier/modebezorg')(kern);
  require('./supplier/autoverkoop')(kern);
  require('./supplier/beveiliging')(kern);
  require('./supplier/care')(kern);
  require('./supplier/retail')(kern);
  require('./supplier/paspoort')(kern);
  require('./supplier/salon')(kern);
  require('./supplier/events')(kern);
  require('./supplier/financien')(kern);
  require('./supplier/vervoer')(kern);
  require('./supplier/kassa')(kern);
};
