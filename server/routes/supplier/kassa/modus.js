/* Kassa (deelmodule): de modus-laag onder De Kassa, de ene kassa-app voor
   elke leverancier, partner en enterprise. De zaak schakelt van modus
   (bakker, restaurant, discotheek, sportkantine, personeelskantine,
   groenteboer) en houdt daarnaast een eigen sneltoets-assortiment bij --
   met per artikel een prijs per stuk OF per kilo (de groenteboer typt het
   gewicht, de kassa rekent). Afrekenen loopt door de bestaande
   /api/supplier/pos/sale, dus dagoverzicht, keuken, boekhouding en
   facturen doen automatisch mee. */
module.exports = (kern) => {
  const { app, crypto, logActivity, managerOnly, save, schoon, sseToSupplier, supplierAuth } = kern;

  /* De modi: elke sector ter wereld valt op een van deze werkvormen terug.
     tafels: bonnen op een tafel parkeren; leeftijd: 18+-herinnering bij de
     deurverkoop; gewicht: artikelen per kilo; badge: interne verrekening. */
  const MODI = [
    { id: 'bakker', naam: 'Bakker & vers', hint: 'Snel afrekenen per stuk; de ochtendrij vraagt grote knoppen.' },
    { id: 'restaurant', naam: 'Restaurant & cafe', hint: 'Bonnen op tafels parkeren en later afrekenen.', tafels: true },
    { id: 'discotheek', naam: 'Discotheek & club', hint: 'Deurverkoop en bar; de kassa herinnert aan de 18+-controle (Zegel).', leeftijd: true },
    { id: 'sportkantine', naam: 'Sportkantine', hint: 'Vrijwilligers achter de bar: weinig knoppen, vaste prijzen.' },
    { id: 'personeelskantine', naam: 'Personeelskantine', hint: 'Interne verrekening: de bon draagt de naam van de collega.', badge: true },
    { id: 'groenteboer', naam: 'Groenteboer & markt', hint: 'Prijs per kilo: typ het gewicht, de kassa rekent.', gewicht: true }
  ];

  const kassaVan = (s) => {
    if (!s.kassa || typeof s.kassa !== 'object') s.kassa = { modus: 'bakker', artikelen: [] };
    if (!Array.isArray(s.kassa.artikelen)) s.kassa.artikelen = [];
    if (!Array.isArray(s.kassa.schermen)) s.kassa.schermen = [];
    return s.kassa;
  };

  /* Alles wat De Kassa nodig heeft in een antwoord: de modus, de modi-lijst,
     het eigen assortiment plus de menukaart en het bezorg-assortiment als
     sneltoetsen, en de tafels voor de restaurantmodus. Gebruikt de zaak
     meerdere kassaschermen, dan meldt het toestel zijn scherm-id mee: elk
     scherm heeft een eigen naam en (desgewenst) een eigen modus -- de
     deurkassa en de barkassa van dezelfde club zijn verschillende kassa's. */
  app.post('/api/supplier/kassa/instel', supplierAuth, (req, res) => {
    const s = req.supplier;
    const k = kassaVan(s);
    const scherm = req.body.scherm ? k.schermen.find(x => x.id === req.body.scherm) : null;
    if (req.body.modus !== undefined) {
      if (!managerOnly(req, res)) return;
      if (!MODI.some(m => m.id === req.body.modus)) return res.status(400).json({ error: 'Onbekende kassamodus.' });
      if (scherm) scherm.modus = String(req.body.modus);
      else k.modus = String(req.body.modus);
      save();
      logActivity(s.code, req.actor, 'zette ' + (scherm ? 'kassa "' + scherm.naam + '"' : 'De Kassa') + ' in de modus "' + req.body.modus + '"');
      sseToSupplier(s.code, 'sync', { scope: 'pos' });
    }
    const snel = [];
    for (const m of (s.menu || []).slice(0, 80)) snel.push({ id: 'menu:' + m.id, naam: m.name, prijs: m.price, bron: 'menukaart', station: m.station || null });
    for (const p of ((s.bezorg && s.bezorg.producten) || []).slice(0, 60)) snel.push({ id: 'bezorg:' + p.id, naam: p.name, prijs: p.price, bron: 'bezorg' });
    res.json({
      modus: (scherm && scherm.modus) || k.modus, modi: MODI,
      scherm: scherm ? { id: scherm.id, naam: scherm.naam, modus: scherm.modus || null } : null,
      schermen: k.schermen,
      artikelen: k.artikelen, sneltoetsen: snel,
      tafels: (s.tables || []).map(t => t.name),
      naam: s.name, type: s.type
    });
  });

  /* De kassaschermen van de zaak: elk toestel meldt zich aan onder een eigen
     naam ("Kassa deur", "Kassa bar", "Kassa 2"). Aanmaken kan elke
     medewerker (het toestel neerzetten hoort bij het werk); hernoemen en
     weghalen is voor de werkgever. */
  app.post('/api/supplier/kassa/scherm', supplierAuth, (req, res) => {
    const s = req.supplier;
    const k = kassaVan(s);
    if (req.body.weg || (req.body.id && req.body.naam !== undefined)) {
      if (!managerOnly(req, res)) return;
    }
    if (req.body.weg) {
      k.schermen = k.schermen.filter(x => x.id !== req.body.id);
      save(); sseToSupplier(s.code, 'sync', { scope: 'pos' });
      return res.json({ ok: true, schermen: k.schermen });
    }
    const naam = schoon(req.body.naam, 40);
    if (!naam) return res.status(400).json({ error: 'Geef de kassa een naam, bijvoorbeeld "Kassa bar".' });
    if (k.schermen.some(x => x.naam.toLowerCase() === naam.toLowerCase() && x.id !== req.body.id))
      return res.status(409).json({ error: 'Er is al een kassa met deze naam; kies een andere.' });
    let scherm;
    if (req.body.id) {
      scherm = k.schermen.find(x => x.id === req.body.id);
      if (!scherm) return res.status(404).json({ error: 'Kassascherm niet gevonden.' });
      scherm.naam = naam;
    } else {
      if (k.schermen.length >= 20) return res.status(400).json({ error: 'Een zaak kan tot 20 kassaschermen hebben.' });
      scherm = { id: 'ks' + crypto.randomBytes(3).toString('hex'), naam };
      k.schermen.push(scherm);
    }
    save();
    logActivity(s.code, req.actor, (req.body.id ? 'hernoemde' : 'zette') + ' kassascherm "' + naam + '"' + (req.body.id ? '' : ' erbij'));
    sseToSupplier(s.code, 'sync', { scope: 'pos' });
    res.json({ ok: true, scherm, schermen: k.schermen });
  });

  /* Het eigen kassa-assortiment: de werkgever (manager) voegt toe, past aan
     of haalt weg; perKg maakt er een weeg-artikel van (groenteboer). */
  app.post('/api/supplier/kassa/artikel', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const s = req.supplier;
    const k = kassaVan(s);
    if (req.body.weg) {
      k.artikelen = k.artikelen.filter(a => a.id !== req.body.id);
      save(); sseToSupplier(s.code, 'sync', { scope: 'pos' });
      return res.json({ ok: true, artikelen: k.artikelen });
    }
    const naam = schoon(req.body.naam, 60);
    const prijs = Number(req.body.prijs);
    if (!naam) return res.status(400).json({ error: 'Geef het artikel een naam.' });
    if (!(prijs > 0) || prijs > 10000) return res.status(400).json({ error: 'Geef een geldige prijs op.' });
    const perKg = !!req.body.perKg;
    if (req.body.id) {
      const a = k.artikelen.find(x => x.id === req.body.id);
      if (!a) return res.status(404).json({ error: 'Artikel niet gevonden.' });
      a.naam = naam; a.prijs = prijs; a.perKg = perKg;
    } else {
      if (k.artikelen.length >= 120) return res.status(400).json({ error: 'Het kassa-assortiment kan tot 120 artikelen hebben.' });
      k.artikelen.push({ id: 'ka' + crypto.randomBytes(3).toString('hex'), naam, prijs, perKg });
    }
    save();
    sseToSupplier(s.code, 'sync', { scope: 'pos' });
    res.json({ ok: true, artikelen: k.artikelen });
  });

};
