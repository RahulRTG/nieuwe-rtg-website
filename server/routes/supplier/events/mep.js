/* Supplier-events (deelmodule): de dagelijkse mise-en-place-organisator (voorstel en afvinken).
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

app.post('/api/supplier/mep/daily', supplierAuth, async (req, res) => {
  const s = req.supplier;
  if (!s.dailyMeps) return res.status(400).json({ error: 'De dagelijkse mise en place is er voor restaurants, bars en clubs.' });
  const menu = (s.menu || []).filter(m => m.station !== 'bar');
  if (!menu.length) return res.status(409).json({ error: 'Zet eerst gerechten op de kaart; daar rekent de voorspelling mee.' });
  const dagen = req.body.day === 'morgen' ? 1 : 0;
  const doel = new Date(Date.now() + dagen * 86400000);
  const date = doel.toISOString().slice(0, 10);
  const [wkFactor, wkLabel] = weekdagFactor(doel);
  // de dagcontext weegt mee: warme avonden lopen vol (terras), gure dagen niet
  const ctx = dagContext(doel);
  const factor = Math.round(wkFactor * ctx.factor * 100) / 100;
  const factorLabel = wkLabel + ', ' + ctx.seizoen + ' ~' + ctx.temperatuurC + '°C';

  // historie: bestellingen van de afgelopen 21 dagen
  const sinds = Date.now() - 21 * 86400000;
  const hist = ordersVanZaak(s.code).filter(o => new Date(o.at).getTime() >= sinds && !['geweigerd', 'terugbetaald'].includes(o.status));
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
        system: 'Je bent een sous-chef. Antwoord UITSLUITEND met een JSON-array van {"time":"HH:MM","task":"..."}. Maximaal 10 taken voor de dagelijkse a la carte mise en place, Nederlands, concreet met aantallen. Weeg het seizoen en het weer mee (houdbaarheid, koeling, terrasdrukte, seizoensgarnituur).',
        messages: [{ role: 'user', content: 'Verwacht: ' + covers + ' couverts (' + factorLabel + '). ' + ctx.zin + ' Porties: ' + portions.map(p => p.name + ' ' + p.n + 'x').join('; ') + '.' }]
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
  // automatisch inkopen: staat de AI-agent op auto met een vaste leverancier,
  // dan ligt er direct na de voorspelling een inkoopvoorstel klaar voor de
  // gemachtigde (er wordt nooit besteld zonder goedkeuring)
  if (s.agent && s.agent.auto && s.agent.partnerCode) kern.agentVoorstel(s, 'AI-agent (na de MEP-voorspelling)');
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
};
