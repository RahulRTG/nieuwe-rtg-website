/* Domein "supplier" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
const { eigenVeld } = require('../kern/util'); // veilige objecttoegang (geen prototype-pollution)
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


  require('./supplier/kamers')(kern);
  require('./supplier/gastcontact')(kern);
  require('./supplier/tafels-team')(kern);
  require('./supplier/boekingen')(kern);
  require('./supplier/ai')(kern);
  require('./supplier/menukaart')(kern);
  require('./supplier/orders')(kern);
  require('./supplier/reserveringen')(kern);
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
  require('./supplier/werving')(kern);
};