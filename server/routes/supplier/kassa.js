/* Domein "supplier" (deelmodule): de kassa (POS: verkoop, RTG-code innen,
   uitchecken) en cadeaukaarten. Draait op de gedeelde kern. */
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
  const total = Number(req.body.total);
  if (!(total > 0) || total > 100000) return res.status(400).json({ error: 'Geen geldig bedrag.' });
  const method = POS_METHODS.includes(req.body.method) ? req.body.method : 'contant';
  // op de tafel zetten kan alleen op een echte tafel; afrekenen komt later
  if (method === 'tafel' && !(req.supplier.tables || []).some(t => t.name === String(req.body.room || '')))
    return res.status(400).json({ error: 'Kies een tafel om de bon op te zetten.' });
  const items = Array.isArray(req.body.items)
    ? req.body.items.slice(0, 40).map(i => ({ name: String(i.name || '').slice(0, 80), qty: Math.max(1, parseInt(i.qty, 10) || 1), price: Math.max(0, Number(i.price) || 0) }))
    : null;
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
    items, total, method, betaler,
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

app.post('/api/supplier/pos/checkout', supplierAuth, async (req, res) => {
  const room = String(req.body.room || '').slice(0, 60);
  const method = ['rtgpay', 'contant'].includes(req.body.method) ? req.body.method : 'contant';
  const list = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
  const open = list.filter(s => (s.method === 'kamer' || s.method === 'tafel') && !s.settled && s.room === room);
  if (!open.length) return res.status(404).json({ error: 'Geen open rekening voor deze kamer of tafel.' });
  let total = 0;
  for (const s of open) total += s.total;
  // eerst het geld (bij RTG Pay via de betaalcode), dan pas de lasten sluiten
  let betaler = null;
  if (method === 'rtgpay') {
    const p = await pay.kasInt({
      supplierCode: req.supplier.code, code: req.body.payCode,
      centen: Math.round(total * 100), oms: 'Check-out ' + room + ', ' + req.supplier.name,
      idem: req.body.idem
    });
    if (p.error) return res.status(p.status || 400).json({ error: p.error });
    betaler = p.van;
  }
  for (const s of open) s.settled = true;
  const sale = {
    id: crypto.randomBytes(4).toString('hex'),
    bon: pickupCode(),
    actor: req.actor.name,
    desc: (open[0].method === 'tafel' ? 'Rekening ' : 'Check-out ') + room + ' (' + open.length + ' post(en))',
    room, items: null, total, method, betaler,
    at: new Date().toISOString()
  };
  list.unshift(sale);
  db.data.posSales[req.supplier.code] = list.slice(0, 300);
  // na het uitchecken staat de kamer automatisch op "vuil" voor housekeeping
  const rm = (req.supplier.rooms || []).find(r => r.name === room);
  if (rm) rm.hk = { status: 'vuil', by: 'Systeem (check-out)', at: new Date().toISOString() };
  // en een afgerekende tafel staat weer vrij voor de volgende gasten
  const tf = (req.supplier.tables || []).find(t => t.name === room);
  if (tf) tf.status = 'vrij';
  save();
  logActivity(req.supplier.code, req.actor, 'checkte ' + room + ' uit: € ' + total + ' (' + method + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  /* Splitsen vanaf de rekening: de betaler rekent het geheel af met RTG Pay
     en de tafelgenoten krijgen meteen een Klompje voor hun deel, uit naam
     van de betaler. Ketst het splitsen af (onbekende codenaam), dan blijft
     de betaling gewoon staan en komt de reden mee terug. */
  let gesplitst = null, splitsFout = null;
  const splitsMet = Array.isArray(req.body.splitsMet) ? req.body.splitsMet.filter(x => typeof x === 'string' && x.trim()).slice(0, 10) : [];
  if (betaler && splitsMet.length) {
    const v = await pay.verzoekMaak({
      van: betaler, aan: splitsMet, totaalCenten: Math.round(total * 100),
      oms: 'Rekening ' + room + ', ' + req.supplier.name, splitsMetMij: true
    });
    if (v.error) splitsFout = v.error;
    else gesplitst = { vrienden: splitsMet.length, perPersoon: v.perPersoon };
  }
  res.json({ ok: true, sale, betaler, gesplitst, splitsFout });
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
};
