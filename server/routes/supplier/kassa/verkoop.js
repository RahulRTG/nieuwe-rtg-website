/* Kassa (deelmodule): de verkoop: de losse kassaverkoop (contant of RTG
   Pay, met keukenafboeking) en het innen of uitgeven op RTG-code. Krijgt
   de gedeelde kern een keer bij het opstarten vanuit
   routes/supplier/kassa.js. */
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
app.post('/api/supplier/pos/sale', supplierAuth, async (req, res) => {
  let total = Number(req.body.total);
  if (!(total > 0) || total > 100000) return res.status(400).json({ error: 'Geen geldig bedrag.' });
  const method = POS_METHODS.includes(req.body.method) ? req.body.method : 'contant';
  // op de tafel zetten kan alleen op een echte tafel; afrekenen komt later
  if (method === 'tafel' && !(req.supplier.tables || []).some(t => t.name === String(req.body.room || '')))
    return res.status(400).json({ error: 'Kies een tafel om de bon op te zetten.' });
  let items = Array.isArray(req.body.items)
    ? req.body.items.slice(0, 40).map(i => ({ name: String(i.name || '').slice(0, 80), qty: Math.max(1, parseInt(i.qty, 10) || 1), price: Math.max(0, Number(i.price) || 0) }))
    : null;
  /* Luchtzijde: de zaak staat op de luchthaven (achter security). De kassa
     rekent dan de luchthavenprijs (normale prijs + toeslag) en de bon draagt
     BEIDE prijzen: elke regel houdt zijn prijsNormaal naast de luchtprijs. */
  let luchtzijde = null;
  const stz = req.supplier.settings || {};
  if (stz.luchtzijde) {
    const pct = Number.isFinite(Number(stz.luchtToeslagPct)) ? Math.max(0, Math.min(100, Math.round(Number(stz.luchtToeslagPct)))) : 15;
    const f = 1 + pct / 100;
    luchtzijde = { pct, totaalNormaal: Math.round(total * 100) / 100 };
    total = Math.round(total * f * 100) / 100;
    if (items) items = items.map(i => ({ ...i, prijsNormaal: i.price, price: Math.round(i.price * f * 100) / 100 }));
  }
  // RTG Pay: de gast toont de betaalcode uit de app; die wordt eerst geind
  // in het grootboek. Lukt dat niet, dan is er ook geen bon.
  let betaler = null;
  if (method === 'rtgpay') {
    const p = await pay.kasInt({
      supplierCode: req.supplier.code, code: req.body.payCode,
      centen: Math.round(total * 100), oms: req.supplier.name,
      idem: req.body.idem
    });
    if (p.error) return res.status(p.status || 400).json({ error: p.error });
    betaler = p.van;
  }
  const sale = {
    id: crypto.randomBytes(4).toString('hex'),
    bon: pickupCode(),
    actor: req.actor.name,
    desc: String(req.body.desc || '').slice(0, 140),
    room: req.body.room ? String(req.body.room).slice(0, 60) : null,
    items, total, method, betaler, luchtzijde,
    at: new Date().toISOString()
  };
  const list = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
  list.unshift(sale);
  db.data.posSales[req.supplier.code] = list.slice(0, 300);
  save();
  // het keukenbrein boekt de ingredienten van de bon af via de recepten
  try { kern.keuken.boekVerkoopAf(req.supplier, items || [], 'kassa (' + req.actor.name + ')'); } catch (e) {}
  logActivity(req.supplier.code, req.actor, 'rekende € ' + total + ' af (' + method + (sale.room ? ', ' + sale.room : '') + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  // automatische factuur voor beide partijen; de koper wordt gekoppeld als er een
  // RTG-codenaam bij de betaling zat, anders krijgt alleen de zaak de bon.
  const factuurRegels = items && items.length
    ? items.map(i => ({ omschrijving: i.name || 'Artikel', aantal: i.qty, stuk: i.price || (total / items.reduce((n, x) => n + x.qty, 0)) }))
    : [{ omschrijving: sale.desc || 'Verkoop', aantal: 1, stuk: total }];
  facturatie.boekMetCodenaam({
    soort: 'verkoop', verkoperCode: req.supplier.code, verkoperNaam: req.supplier.name,
    koper: { naam: req.body.codenaam || betaler || sale.room || 'Kasklant' }, regels: factuurRegels, methode: method, ref: sale.id
  }, req.body.codenaam || betaler).catch(() => {});
  res.json({ ok: true, sale, betaler });
});

app.post('/api/supplier/pos/redeem', supplierAuth, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Voer een ophaalcode in.' });
  const o = ordersVanZaak(req.supplier.code).find(x => x.pickup === code);
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

};
