/* Supplier (deelmodule): de toegang: de eigen mini-boardroom (functies
   aan/uit), het inloggen van de zaak (code of personeelslogin), de
   rooster-opzoek en de instellingen. Krijgt de gedeelde kern een keer bij
   het opstarten vanuit routes/supplier.js. */
module.exports = (kern) => {
  const { ALT_IDEE, BOEK_KETEN, DEMO, DEMO_SUPPLIER, HK_STATUSES, LANDEN, POS_METHODS, RIT_KETEN, RIT_LEGACY, TABLE_STATUSES, VAC_SOORTEN, ZAAK_OPTIES, accounts, addTicket, aiFindDoor, aiFindRoom, alcoholGrensVan, anthropic, app, applyChatPubliek, applyChatVertaald, auth, beslisReservering, isFavoriet, broadcastSync,
    zetCollectie, zetArtikel, pasVoorraad, releaseDrop, klantProfiel, zetKlantMaten, voegKlantnotitie,
    legApart, vraagPaskamer, paskamerBreng, stuurStyling, retailVerkoop, voorraadZoek, retailState,
    RETAIL_MATEN, RETAIL_SEIZOENEN, PASPOORT_NIVEAUS, paspoortVraag, paspoortBekijk, paspoortIncident, paspoortPartner,
    cannedBoekhouder, cateringDishes, chatStuur, checkCred, coachCache, coachRules, crypto, db, ensureApplyChat, eventCovers, express, fallbackRunsheet, financeVoor, factuur, facturatie, boekhoudkennis, talen, findSupplier, gcCode, geborenVan, guestsFor, hasCred, i18n, ledenPrijs, leeftijdVan, logActivity, keyVanCodenaam, magBezorgen, haversine, etaMinutes, ticketsVoorSlot, loginFails, managerOnly, noteFailedTry, notify, notifyApplicant, notifySupplier, parseRunsheetText, pickupCode, pinFails, posDay, publicSupplier, pushLive, rememberSession, ritBezetting, ritVerder, runItem, salonNaarVolgers, salonProfielCompleet, salonItemsVan, save, scheduleFor, schoon, sectiesForOrder, sessionFor, setRoomHk, sortRunsheet, sseClients, sseSend, sseToCustomer, sseToOffice, sseToSupplier, stationsForOrder, supplierAuth, supplierState, tooManyTries, trChat, unlockDoor, weekdagFactor,
    zaakBoard, zaakZet, zaakFunctieAan, klantSalon, media,
    dpVerzoekMaak, dpVerzoekIntrek, dpOntvangsten, logInlog, pay,
    tafelplanning, reserveringTafel, reserveringKomst, walkIn, shiftSamenvatting,
    fluisterZeg, orderMetRef, ordersVanZaak, ordersVoegToe, boekingenVanZaak,
    werkvensterVan, zetWerkvenster, magWerken, werkAdvies } = kern;


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
    // het werkvenster van de werkgever: buiten het venster geen sessie
    // (de manager valt er nooit onder; vrijstellingen stelt de zaak zelf in)
    const wv = magWerken(s, { staffId: staff.id, manager: staff.role === 'manager' }, null, req.body.positie);
    if (!wv.ok) {
      logInlog('zaak', false, s.code + ' · ' + staff.name + ' (werkvenster)', req);
      return res.status(403).json({ error: wv.error, venster: wv.venster || null, ...(wv.locatieNodig ? { locatieNodig: true } : {}) });
    }
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

/* Het werkvenster: lezen mag elk personeelslid (zodat de PDA kan tonen
   wanneer je terecht kunt); zetten is aan de manager. De afdwinging zelf zit
   bij de ingangen (login hierboven en het ene RTG-account), niet hier. */
app.post('/api/supplier/werkvenster', supplierAuth, (req, res) => {
  const b = req.body || {};
  const wilZetten = typeof b.aan === 'boolean' || (b.dagen && typeof b.dagen === 'object') || Array.isArray(b.vrijgesteld) ||
    b.plek !== undefined || (b.perStaff && typeof b.perStaff === 'object');
  if (wilZetten) {
    if (!managerOnly(req, res)) return;
    zetWerkvenster(req.supplier, b);
    logActivity(req.supplier.code, req.actor, 'stelde het werkvenster bij');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'settings' });
  }
  res.json({ ok: true, werkvenster: werkvensterVan(req.supplier) });
});

/* Rahuls werkadvies: kijkt naar geklokte uren en (alleen bij een sessie via
   het ene RTG-account) de eigen agenda en het eigen zorgprofiel. Advies is
   een zin of null; het blokkeert nooit iets. */
app.post('/api/supplier/werkadvies', supplierAuth, (req, res) => {
  res.json({ advies: werkAdvies({ code: req.supplier.code, staffId: req.actor.staffId, lidKey: req.actor.lidKey || null }) });
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
  // luchtzijde: de zaak staat op een luchthaven (achter security). De kassa
  // toont dan dubbele prijzen (normaal + luchthaven, met deze toeslag) en de
  // deur vraagt om een boarding pass (/api/supplier/lucht/pass).
  if (typeof req.body.luchtzijde === 'boolean' && st.luchtzijde !== req.body.luchtzijde) {
    st.luchtzijde = req.body.luchtzijde;
    changed.push('de luchtzijde-stand ' + (st.luchtzijde ? 'aan' : 'uit'));
  }
  if (req.body.luchtToeslagPct != null) {
    const p = Math.round(Number(req.body.luchtToeslagPct));
    if (Number.isFinite(p) && p >= 0 && p <= 100) { st.luchtToeslagPct = p; changed.push('de luchthaventoeslag op ' + p + '%'); }
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


};
