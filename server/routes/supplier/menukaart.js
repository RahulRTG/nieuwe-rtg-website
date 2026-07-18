/* Supplier-submodule "menukaart": De menukaart en prijzen: menu bewerken met de ledenprijsgarantie
   (ledenprijs nooit boven de publieke prijs) en de menukaart voor het lid.
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
};
