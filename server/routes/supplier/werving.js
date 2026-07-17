/* Domein "supplier" (deelmodule): personeelswerving. Uitnodigen met een kassacode,
   zelf aanmelden met een eigen RTG-account, en de sollicitatiestroom (vacature ->
   sollicitatie -> beslissing -> uitnodiging). De invite-helpers zijn hier lokaal
   omdat zowel het uitnodigen als het accepteren van een sollicitatie ze gebruikt.
   Draait op de gedeelde kern. */
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
};
