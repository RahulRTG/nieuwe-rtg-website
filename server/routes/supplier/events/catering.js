/* Supplier-events (deelmodule): catering per event, allergenen met vervangend gerecht en de event-MEP.
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

};
