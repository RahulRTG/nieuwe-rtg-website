/* Domein "supplier" (deelmodule): events, catering, keuken-menu en mise en place.
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
  const { dagContext } = require('../../kern/context');

app.post('/api/supplier/event', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!Array.isArray(s.events)) return res.status(400).json({ error: 'Events zijn er voor restaurants, bars en clubs.' });
  const a = String(req.body.action || '');
  if (a === 'add') {
    const name = String((req.body.event || {}).name || '').trim().slice(0, 80);
    const date = String((req.body.event || {}).date || '').slice(0, 10);
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Vul minimaal een naam en datum in.' });
    const e = {
      id: crypto.randomBytes(4).toString('hex'),
      name, date,
      time: String((req.body.event || {}).time || '').slice(0, 5),
      desc: String((req.body.event || {}).desc || '').trim().slice(0, 200),
      capacity: Math.min(2000, Math.max(1, parseInt((req.body.event || {}).capacity, 10) || 50)),
      price: Math.max(0, Number((req.body.event || {}).price) || 0),
      published: false, guests: [], runsheet: [],
      catering: { mode: 'geen', itemIds: [], note: '' }, allergies: [],
      at: new Date().toISOString()
    };
    s.events.unshift(e);
    s.events = s.events.slice(0, 40);
    logActivity(s.code, req.actor, 'maakte event "' + name + '" aan');
  } else {
    const e = s.events.find(x => x.id === req.body.id);
    if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
    if (a === 'publish') { e.published = !e.published; logActivity(s.code, req.actor, (e.published ? 'publiceerde' : 'haalde offline') + ' event "' + e.name + '"'); }
    else if (a === 'remove') { s.events = s.events.filter(x => x.id !== req.body.id); logActivity(s.code, req.actor, 'verwijderde event "' + e.name + '"'); }
    else return res.status(400).json({ error: 'Onbekende actie.' });
  }
  save();
  broadcastSync(['rtg', 'lifestyle', 'business'], 'events');
  sseToSupplier(s.code, 'sync', { scope: 'events' });
  res.json({ ok: true, events: s.events });
});

app.post('/api/supplier/event/checkin', supplierAuth, (req, res) => {
  const e = (req.supplier.events || []).find(x => x.id === req.body.eventId);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  const g = (e.guests || []).find(x => x.key === req.body.key);
  if (!g) return res.status(404).json({ error: 'Gast niet gevonden.' });
  g.checkedIn = !g.checkedIn;
  save();
  logActivity(req.supplier.code, req.actor, (g.checkedIn ? 'checkte ' : 'zette check-in terug voor ') + g.codename + ' in bij "' + e.name + '"');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e });
});

app.post('/api/supplier/event/runsheet', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  e.runsheet = e.runsheet || [];
  if (req.body.action === 'add') {
    const it = req.body.item || {};
    if (!String(it.text || '').trim()) return res.status(400).json({ error: 'Omschrijf wat er moet gebeuren.' });
    e.runsheet.push(runItem(it.time, it.station, it.text, it.daysBefore));
    if (e.runsheet.length > 60) e.runsheet = e.runsheet.slice(0, 60);
    sortRunsheet(e);
  } else if (req.body.action === 'remove') {
    e.runsheet = e.runsheet.filter(x => x.id !== req.body.itemId);
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e });
});

app.post('/api/supplier/event/runsheet/done', supplierAuth, (req, res) => {
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  const it = e && (e.runsheet || []).find(x => x.id === req.body.itemId);
  if (!it) return res.status(404).json({ error: 'Regel niet gevonden.' });
  it.done = !it.done;
  it.doneBy = it.done ? req.actor.name : null;
  save();
  if (it.done) logActivity(req.supplier.code, req.actor, 'vinkte af: ' + it.time + ' ' + it.text + ' (' + e.name + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e });
});

app.post('/api/supplier/event/runsheet/ai', supplierAuth, async (req, res) => {
  if (!managerOnly(req, res)) return;
  const e = (req.supplier.events || []).find(x => x.id === req.body.id);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  const mode = req.body.mode === 'import' ? 'import' : 'suggest';
  let items = null;
  if (anthropic) {
    try {
      const prompt = mode === 'import'
        ? 'Zet dit geplakte draaiboek om naar JSON. Bron:\n' + String(req.body.text || '').slice(0, 4000)
        : 'Stel een professioneel horeca-draaiboek op voor dit event: "' + e.name + '" op ' + e.date + (e.time ? ' om ' + e.time : '') + (e.desc ? ' (' + e.desc + ')' : '') + ', capaciteit ' + e.capacity + '.';
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 1200,
        system: 'Je bent een horeca-draaiboekplanner. Antwoord UITSLUITEND met een JSON-array van objecten {"time":"HH:MM","station":"keuken|bar|bediening|party|alle","text":"..."}. Maximaal 20 regels, Nederlands, praktisch en concreet. party = de party manager/deur.',
        messages: [{ role: 'user', content: prompt }]
      });
      const raw = (msg.content[0].text.match(/\[[\s\S]*\]/) || [null])[0];
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) items = arr.slice(0, 20).map(x => runItem(x.time, x.station, x.text));
    } catch (err) { items = null; }
  }
  if (!items) items = mode === 'import' ? parseRunsheetText(req.body.text) : fallbackRunsheet(e);
  if (!items.length) return res.status(400).json({ error: 'Geen bruikbare regels gevonden. Zet per regel een tijd en een taak.' });
  e.runsheet = [...(e.runsheet || []), ...items].slice(0, 60);
  sortRunsheet(e);
  save();
  logActivity(req.supplier.code, req.actor, (mode === 'import' ? 'importeerde' : 'liet de AI een') + ' draaiboek ' + (mode === 'import' ? 'voor' : 'opstellen voor') + ' "' + e.name + '" (' + items.length + ' regels)');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'events' });
  res.json({ ok: true, event: e, added: items.length, ai: !!anthropic });
});

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

app.post('/api/supplier/menu/recipe', supplierAuth, async (req, res) => {
  const m = (req.supplier.menu || []).find(x => x.id === req.body.itemId);
  if (!m) return res.status(404).json({ error: 'Gerecht niet gevonden.' });
  let recept = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 700,
        system: 'Je bent een chef-kok die werkinstructies schrijft voor nieuwe keukenkrachten. Antwoord in het Nederlands, platte tekst, maximaal 10 korte genummerde stappen: mise en place, bereiding, afwerking en bord. Concreet, geen inleiding.',
        messages: [{ role: 'user', content: 'Gerecht: ' + m.name + (m.desc ? ' (' + m.desc + ')' : '') + '. Keuken: ' + req.supplier.name + '. Allergenen: ' + ((m.allergens || []).join(', ') || 'geen') + '.' }]
      });
      recept = String(msg.content[0].text || '').trim().slice(0, 1500);
    } catch (err) { recept = null; }
  }
  if (!recept) {
    recept = '1. Mise en place: alle ingredienten voor ' + m.name + ' afwegen en klaarzetten.\n' +
      (m.desc ? '2. Basis: ' + m.desc + '\n' : '2. Basis volgens de huisreceptuur van ' + req.supplier.name + '.\n') +
      '3. Bereiden op de eigen sectie (' + (m.sectie || 'warm') + '); tussentijds proeven.\n' +
      ((m.allergens || []).length ? '4. LET OP allergenen: ' + m.allergens.join(', ') + '. Bij een allergie-bon strikt gescheiden werken.\n' : '') +
      '5. Afwerking en garnituur; bord vegen.\n' +
      '6. Doorgeven aan de pas; chef proeft steekproefsgewijs.\n' +
      '(Laat de manager dit recept aanscherpen in het Kantoor, of zet een ANTHROPIC_API_KEY voor een uitgewerkt recept.)';
  }
  m.recept = recept;
  save();
  logActivity(req.supplier.code, req.actor, 'zette het recept van ' + m.name + ' op de bon');
  // bewust geen sync-broadcast: het scherm dat het recept opvroeg werkt zijn
  // eigen menukopie bij, andere schermen zien het bij hun eerstvolgende refresh
  res.json({ ok: true, recept, ai: !!anthropic });
});

/* De gerechtenkennis op het keukenscherm: tik op een gerecht en vraag het
   recept, de bereidingswijze, de allergenen met vervangers of een drank-
   suggestie op. Elke soort wordt een keer gemaakt (Claude waar mogelijk,
   anders een vakkundige fallback) en daarna op het gerecht bewaard. */
const KENNIS_SOORTEN = {
  recept: {
    sys: 'Je bent een chef-kok die werkinstructies schrijft voor nieuwe keukenkrachten. Antwoord in het Nederlands, platte tekst, maximaal 10 korte genummerde stappen: mise en place, bereiding, afwerking en bord. Concreet, geen inleiding.',
    val: (s, m) => '1. Mise en place: alle ingredienten voor ' + m.name + ' afwegen en klaarzetten.\n' +
      (m.desc ? '2. Basis: ' + m.desc + '\n' : '2. Basis volgens de huisreceptuur van ' + s.name + '.\n') +
      '3. Bereiden op de eigen sectie (' + (m.sectie || 'warm') + '); tussentijds proeven.\n' +
      ((m.allergens || []).length ? '4. LET OP allergenen: ' + m.allergens.join(', ') + '. Bij een allergie-bon strikt gescheiden werken.\n' : '') +
      '5. Afwerking en garnituur; bord vegen.\n6. Doorgeven aan de pas; chef proeft steekproefsgewijs.'
  },
  bereiding: {
    sys: 'Je bent een sous-chef die de bereidingswijze uitlegt aan de kok op de sectie. Antwoord in het Nederlands, platte tekst, maximaal 8 genummerde stappen met concrete temperaturen, tijden en garingspunten (pan, oven, kerntemperatuur). Sluit af met een regel over de valkuil van dit gerecht. Geen inleiding.',
    val: (s, m) => {
      const tijd = { warm: 12, snack: 8, koud: 6, dessert: 5 }[m.sectie || 'warm'] || 8;
      return '1. Sectie ' + (m.sectie || 'warm') + ', richttijd ~' + tijd + ' min per uitgifte.\n' +
        '2. Werkplek en pannen voorverwarmen; gereedschap klaar.\n' +
        (m.desc ? '3. Kern: ' + m.desc + '\n' : '3. Volg de huisbereiding van ' + s.name + '.\n') +
        '4. Garing checken (kleur, kern, textuur) voor het doorgeven.\n' +
        '5. Warm doorgeven aan de pas; niet laten staan.\n' +
        'Valkuil: te vroeg starten; kijk naar het vuurplan op de bon zodat de tafel samen uitgaat.';
    }
  },
  allergenen: {
    sys: 'Je bent een chef-kok en allergenenexpert. Antwoord in het Nederlands, platte tekst, maximaal 8 regels: welke allergenen dit gerecht bevat, hoe kruisbesmetting op de lijn voorkomen wordt, en per allergeen een volwaardig vervangend ingredient of variant. Geen inleiding.',
    val: (s, m) => {
      const al = m.allergens || [];
      if (!al.length) return 'Geen geregistreerde allergenen voor ' + m.name + '.\nBij een allergie-bon toch altijd doorvragen en strikt gescheiden werken: schone snijplank, schoon gereedschap, aparte pan.';
      return al.map(a => {
        const idee = ALT_IDEE[a];
        return '⚠ ' + a + (idee ? ': vervang met ' + idee[0] + ' (' + idee[1] + ').' : ': overleg met de chef over een vervanger.');
      }).join('\n') + '\nAltijd: schone snijplank, schoon gereedschap, aparte pan; de allergie-bon gaat als laatste check langs de pas.';
    }
  },
  pairing: {
    sys: 'Je bent een sommelier. Antwoord in het Nederlands, platte tekst, maximaal 6 regels: twee wijnsuggesties (per glas), een cocktail of mocktail en een alcoholvrij alternatief bij dit gerecht, elk met een korte reden. Geen inleiding.',
    val: (s, m) => {
      const bar = (s.menu || []).filter(x => x.station === 'bar').slice(0, 3);
      return (bar.length ? 'Van de eigen kaart: ' + bar.map(b => b.name).join(', ') + '.\n' : '') +
        'Wit en fris bij lichte en koude gerechten; rond en rood bij ' + ((m.sectie || 'warm') === 'warm' ? 'dit warme gerecht' : 'de warme kant') + '.\n' +
        'Alcoholvrij: huisgemaakte citrus-tonic of verse munt-gember.';
    }
  }
};
app.post('/api/supplier/menu/kennis', supplierAuth, async (req, res) => {
  const m = (req.supplier.menu || []).find(x => x.id === req.body.itemId);
  if (!m) return res.status(404).json({ error: 'Gerecht niet gevonden.' });
  const soort = String(req.body.soort || '');
  const def = KENNIS_SOORTEN[soort];
  if (!def) return res.status(400).json({ error: 'Onbekende kennissoort.' });
  m.kennis = m.kennis || {};
  const bestaand = soort === 'recept' ? (m.recept || m.kennis.recept) : m.kennis[soort];
  if (bestaand && !req.body.opnieuw) return res.json({ ok: true, tekst: bestaand, cached: true, ai: !!anthropic });
  let tekst = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 700, system: def.sys,
        messages: [{ role: 'user', content: 'Gerecht: ' + m.name + (m.desc ? ' (' + m.desc + ')' : '') + '. Keuken: ' + req.supplier.name + '. Sectie: ' + (m.sectie || 'warm') + '. Allergenen: ' + ((m.allergens || []).join(', ') || 'geen') + '. ' + dagContext().zin }]
      });
      tekst = String(msg.content[0].text || '').trim().slice(0, 1500);
    } catch (err) { tekst = null; }
  }
  if (!tekst) tekst = def.val(req.supplier, m);
  m.kennis[soort] = tekst;
  if (soort === 'recept') m.recept = tekst;
  save();
  logActivity(req.supplier.code, req.actor, 'vroeg ' + soort + ' van ' + m.name + ' op');
  res.json({ ok: true, tekst, ai: !!anthropic });
});

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
