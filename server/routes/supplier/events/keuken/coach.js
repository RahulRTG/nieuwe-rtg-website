/* Supplier-events-keuken (deelmodule): de 86-lijst (gerecht is op) en de
   keukencoach die de lijn aanstuurt. Draait op de gedeelde kern; gemount
   vanuit routes/supplier/events/keuken.js. */
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
  const { dagContext } = require('../../../../kern/context');

/* 86: een gerecht is op. Elke keukenkracht mag het melden; het bestellen
   wordt per direct geblokkeerd en alle schermen zien het. Weer beschikbaar
   melden kan net zo snel. */
app.post('/api/supplier/menu/86', supplierAuth, (req, res) => {
  const m = (req.supplier.menu || []).find(x => x.id === req.body.itemId);
  if (!m) return res.status(404).json({ error: 'Gerecht niet gevonden.' });
  m.uitverkocht = !!req.body.op;
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
  logActivity(req.supplier.code, req.actor, (m.uitverkocht ? 'meldde 86 (uitverkocht): ' : 'meldde weer beschikbaar: ') + m.name);
  res.json({ ok: true, uitverkocht: m.uitverkocht });
});

app.post('/api/supplier/kitchen/coach', supplierAuth, async (req, res) => {
  const s = req.supplier;
  const lang = talen.taalVan(req.body.lang);
  const open = ordersVanZaak(s.code).filter(o => ['nieuw', 'in bereiding'].includes(o.status) && sectiesForOrder(s, o).length);
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
        system: (lang === 'en'
          ? 'You are a sous-chef running the line. Mission: every table leaves in ONE go with HOT food; no plate waits under the pass. Cook times: warm ~12 min, snack ~8, koud ~6, dessert ~5, bar ~4 (a station marked "bezig" is roughly halfway). Reply ONLY with a JSON array of at most 6 short English instructions (strings): what to fire now, what to hold and for how many minutes, what to batch, which table leaves together, who gets priority. ' + dagContext().zinEn + ' Weigh that in (terrace weather, hot versus cold dishes, quiet or busy hours).'
          : 'Je bent een sous-chef die de lijn aanstuurt. Missie: elke tafel gaat in EEN keer met WARM eten uit; geen bord staat te wachten onder de pas. Bereidingstijden: warm ~12 min, snack ~8, koud ~6, dessert ~5, bar ~4 (een kant op "bezig" is ongeveer halverwege). Antwoord UITSLUITEND met een JSON-array van maximaal 6 korte Nederlandse aanwijzingen (strings): wat nu afvuren, wat vasthouden en hoeveel minuten, wat batchen, welke tafel samen uitgaat, wie voorrang krijgt. ' + dagContext().zin + ' Weeg dat mee (terrasweer, warme versus koude kaart, rustige of drukke uren).'),
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

};
