/* Domein "supplier" (deelmodule): de gereedschappen die ELKE zaak krijgt,
   ongeacht sector.

   1. Reviews & reputatie: op elke gastreview reageren (een keer, publiek
      zichtbaar en met een melding aan de gast), met een AI-conceptantwoord
      dat de toon aan de score aanpast.
   2. Voorraad: een lichte inventaris per zaak. Iedereen telt (erbij/eraf),
      het management beheert (nieuw, drempel, weg). Zakt een item door zijn
      minimum, dan gaat er een keer een melding uit; komt hij er weer boven,
      dan wapent de melding zich opnieuw. */
module.exports = (kern) => {
  const { app, db, save, crypto, supplierAuth, managerOnly, notifySupplier, sseToSupplier, schoon, reviewReageer, anthropic } = kern;

  // ---- 1. reviews & reputatie ----
  app.post('/api/supplier/review/reageer', supplierAuth, (req, res) => {
    const r = reviewReageer(req.supplier, String(req.body.id || ''), req.body.tekst);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  // het AI-concept: warm bij lof, oplossingsgericht bij kritiek; de zaak
  // past het altijd zelf aan voor het de deur uit gaat
  app.post('/api/supplier/review/concept', supplierAuth, async (req, res) => {
    const r = (db.data.reviews || []).find(x => x.id === String(req.body.id || '') && x.supplierCode === req.supplier.code);
    if (!r) return res.status(404).json({ error: 'Review niet gevonden.' });
    let concept;
    if (r.score >= 4) {
      concept = 'Dank u wel, ' + r.codename + '! Wat fijn om te lezen' + (r.tekst ? ' dat u zo genoten heeft' : '') + '. We geven het door aan het hele team en verwelkomen u graag opnieuw bij ' + req.supplier.name + '.';
    } else if (r.score === 3) {
      concept = 'Dank voor uw eerlijke beoordeling, ' + r.codename + '. Goed is voor ons niet goed genoeg; we gaan met uw punten aan de slag en hopen het u bij een volgend bezoek helemaal naar de zin te maken.';
    } else {
      concept = 'Dat spijt ons oprecht, ' + r.codename + '. Dit is niet het niveau dat u van ' + req.supplier.name + ' mag verwachten. We horen graag persoonlijk wat er misging; stuur ons een bericht via de app, dan maken we het goed.';
    }
    if (anthropic) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 200,
          system: 'Je schrijft namens ' + req.supplier.name + ' een korte, warme en professionele reactie (max 3 zinnen, Nederlands, geen hashtags) op een gastreview. Bij kritiek: erken, bied een oplossing, nodig uit tot contact. Nooit defensief.',
          messages: [{ role: 'user', content: 'Review (' + r.score + '/5) van ' + r.codename + ': ' + (r.tekst || '(geen tekst)') }]
        });
        concept = response.content[0].text.trim() || concept;
      } catch (e) { /* val terug op het sjabloon */ }
    }
    res.json({ ok: true, concept });
  });

  // ---- 2. voorraad ----
  const voorraadVan = s => (s.voorraad = Array.isArray(s.voorraad) ? s.voorraad : []);
  app.post('/api/supplier/voorraad', supplierAuth, (req, res) => res.json({ ok: true, voorraad: voorraadVan(req.supplier) }));

  app.post('/api/supplier/voorraad/zet', supplierAuth, (req, res) => {
    const s = req.supplier;
    const lijst = voorraadVan(s);
    const id = String(req.body.id || '');
    let item = id ? lijst.find(x => x.id === id) : null;
    if (id && !item) return res.status(404).json({ error: 'Voorraaditem niet gevonden.' });
    if (req.body.weg) {
      if (!managerOnly(req, res)) return;
      s.voorraad = lijst.filter(x => x.id !== id);
      save();
      sseToSupplier(s.code, 'sync', { scope: 'voorraad' });
      return res.json({ ok: true, voorraad: s.voorraad });
    }
    if (!item) {
      // nieuw item: alleen het management bepaalt wat er op de lijst staat
      if (!managerOnly(req, res)) return;
      const naam = schoon(req.body.naam, 60);
      if (!naam) return res.status(400).json({ error: 'Geef het item een naam.' });
      if (lijst.length >= 200) return res.status(409).json({ error: 'Maximaal 200 voorraaditems.' });
      item = { id: crypto.randomBytes(4).toString('hex'), naam, aantal: 0, min: 0, eenheid: schoon(req.body.eenheid, 12) || 'st', laagGemeld: false };
      lijst.push(item);
    }
    // tellen mag iedereen: de vloer weet wat er echt staat
    if (req.body.aantal != null) item.aantal = Math.max(0, Math.min(100000, Math.round(Number(req.body.aantal) || 0)));
    if (req.body.delta != null) item.aantal = Math.max(0, Math.min(100000, item.aantal + Math.round(Number(req.body.delta) || 0)));
    if (req.body.min != null) item.min = Math.max(0, Math.min(100000, Math.round(Number(req.body.min) || 0)));
    if (req.body.eenheid != null && String(req.body.eenheid).trim()) item.eenheid = schoon(req.body.eenheid, 12);
    // de drempelwachter: een melding per keer dat het item onder zijn minimum zakt
    if (item.min > 0 && item.aantal <= item.min && !item.laagGemeld) {
      item.laagGemeld = true;
      notifySupplier(s.code, { icon: '📉', title: 'Voorraad laag: ' + item.naam, body: 'Nog ' + item.aantal + ' ' + item.eenheid + ' (minimum ' + item.min + '). Zet hem op de AI-inkooplijst of bestel bij.' });
    } else if (item.aantal > item.min) {
      item.laagGemeld = false;
    }
    save();
    sseToSupplier(s.code, 'sync', { scope: 'voorraad' });
    res.json({ ok: true, item, voorraad: lijst });
  });
};
