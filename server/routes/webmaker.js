/* Routes voor de Website-maker: de bouwkant, voor leden en zaken. De
   leeskant (de RTG-browser) staat in routes/webbrowser.js. */
module.exports = (kern) => {
  const { app, auth, webmaker, webplatform, webmakerAi, atelierweb, antivirus, media, supplierAuth, liveCodename } = kern;
  const FOTO_MAX_BYTES = 2 * 1024 * 1024; // ~2 MB per foto
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Een eigen website maken is voor leden. Word lid om te beginnen.' }); return true; }
    return false;
  };

  // ---- de maker (eigenaar) ----
  app.post('/api/site/mijn', auth, (req, res) => { if (geenGast(req, res)) return; res.json({ lijst: webmaker.mijn(req.session.key) }); });
  app.post('/api/site/haal', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const d = webmaker.haal(req.session.key, (req.body || {}).id);
    if (!d) return res.status(404).json({ error: 'Website niet gevonden.' });
    res.json({ design: d });
  });
  app.post('/api/site/bewaar', auth, (req, res) => { if (geenGast(req, res)) return; const b = req.body || {}; stuur(res, webmaker.bewaar(req.session.key, b.design || b)); });
  app.post('/api/site/verwijder', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, webmaker.verwijder(req.session.key, (req.body || {}).id)); });
  app.post('/api/site/publiceer', auth, (req, res) => { if (geenGast(req, res)) return; const b = req.body || {}; stuur(res, webmaker.publiceer(req.session.key, b.id, b.adres)); });
  app.post('/api/site/offline', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, webmaker.offline(req.session.key, (req.body || {}).id)); });

  /* ---- de persoonlijke site: ieders eigen plek op het RTG-web ----
     Op CODENAAM -- de echte naam blijft in de kluis. Zelfde principe als de
     bedrijfssite: een compleet startpunt in een keer, daarna van het lid. */
  app.post('/api/site/persoonlijk', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const codenaam = liveCodename(req.session);
    const adres = webmaker.slug(codenaam);
    // bestaat je persoonlijke site al, dan krijg je hem terug in plaats van een tweede
    const bestaande = webmaker.mijn(req.session.key).find(d => d.adres === adres);
    if (bestaande) return res.json({ ok: true, bestond: true, design: webmaker.haal(req.session.key, bestaande.id), adres });
    const r = webmaker.bewaar(req.session.key, webplatform.genereerPersoon(codenaam));
    if (r.error) return stuur(res, r);
    const p = webmaker.publiceer(req.session.key, r.design.id, adres);
    if (p.error) return stuur(res, p);
    res.json({ ok: true, design: webmaker.haal(req.session.key, r.design.id), adres: p.adres });
  });

  /* ---- AI in de maker ----
     De opdracht werkt op het ontwerp zoals het NU op het doek staat (ook
     onbewaard); het antwoord is een aangepast ontwerp dat de maker toont.
     Er wordt hier niets opgeslagen -- de gebruiker beoordeelt en bewaart
     zelf, en dan pas loopt het langs de gewone schoonmaak. */
  app.post('/api/site/ai', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    res.json(await webmakerAi.schrijf(b.design || {}, b.opdracht));
  });
  app.post('/api/supplier/site/ai', supplierAuth, async (req, res) => {
    const b = req.body || {};
    res.json(await webmakerAi.schrijf(b.design || {}, b.opdracht));
  });

  /* ---- de sjabloon-etalage van het Atelier ----
     Leden beginnen met een ontwerp van het huis in plaats van vanaf nul; wat
     het Atelier niet uitdrukkelijk heeft vrijgegeven, bestaat hier niet. */
  app.post('/api/site/sjablonen', auth, (req, res) => { if (geenGast(req, res)) return; res.json({ lijst: atelierweb.etalage() }); });
  app.post('/api/site/sjabloon', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const d = atelierweb.etalageHaal((req.body || {}).id);
    if (!d) return res.status(404).json({ error: 'Dit sjabloon staat niet in de etalage.' });
    res.json({ sjabloon: d });
  });

  // ---- eigen foto's: uploaden (na virusscan), tonen en weghalen ----
  app.post('/api/site/fotos', auth, (req, res) => { if (geenGast(req, res)) return; res.json({ fotos: webmaker.fotos(req.session.key) }); });
  app.post('/api/site/foto', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const dataUrl = String((req.body || {}).dataUrl || '');
    /* jpeg, png en webp, en met opzet geen gif: server/media.js slaat alleen
       die drie op en /media serveert alleen die drie. Stond gif hier wel
       toegestaan, dan kwam het bestand door deze deur en door de
       Ontsmetter heen om daarna te stranden op "kon niet worden
       opgeslagen" -- een onbegrijpelijke fout voor iets wat de app zelf
       zei aan te nemen. */
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) return res.status(400).json({ error: 'Kies een afbeelding (jpg, png of webp).' });
    if (dataUrl.length > FOTO_MAX_BYTES * 1.4) return res.status(400).json({ error: 'De foto is te groot (max ~2 MB).' });
    // eerst door de Ontsmetter: besmette bestanden komen er niet in
    const veilig = antivirus && antivirus.veiligeFoto ? antivirus.veiligeFoto(dataUrl, { bron: 'site-foto', door: req.session.key }) : { ok: true };
    if (!veilig.ok) return res.status(400).json({ error: veilig.error || 'De foto is geweigerd door de beveiliging.' });
    // dan versleuteld naar de mediastore; in db.data komt alleen de /media-url
    let url = null;
    try { url = media && media.bewaarPubliek ? await media.bewaarPubliek(dataUrl, FOTO_MAX_BYTES) : null; } catch (e) { url = null; }
    if (!url) return res.status(400).json({ error: 'De foto kon niet worden opgeslagen.' });
    stuur(res, webmaker.fotoBewaar(req.session.key, url));
  });
  app.post('/api/site/foto-weg', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, webmaker.fotoWeg(req.session.key, String((req.body || {}).url || ''))); });

  /* ---- de bedrijfssite (RTG Web Platform) ----

     De zaak zelf, achter supplierAuth. De site leeft in dezelfde opslag als
     ledensites, met eigenaar 'zaak:CODE' -- dat een site bij een bedrijf
     hoort komt uit de inlog, niet uit het verzoek. "Automatic first":
     genereren maakt in een keer een complete site uit het zaakprofiel en zet
     hem online; "customizable forever": daarna bewerkt de ondernemer hem met
     dezelfde maker als ieder lid. */
  const zaakKey = req => 'zaak:' + req.supplier.code;
  app.post('/api/supplier/site/genereer', supplierAuth, (req, res) => {
    const key = zaakKey(req);
    const bestaande = webmaker.mijn(key);
    const opnieuw = !!(req.body || {}).opnieuw;
    if (bestaande.length && !opnieuw) {
      // niet stil overschrijven wat de ondernemer zelf heeft aangepast
      return res.json({ ok: true, bestond: true, design: webmaker.haal(key, bestaande[0].id) });
    }
    const ontwerp = webplatform.genereer(req.supplier);
    if (bestaande.length) ontwerp.id = bestaande[0].id;
    const r = webmaker.bewaar(key, ontwerp, { zaakCode: req.supplier.code });
    if (r.error) return stuur(res, r);
    // meteen online op de bedrijfsnaam; is dat adres van een ander, dan naam-code
    let p = webmaker.publiceer(key, r.design.id, webmaker.slug(req.supplier.name));
    if (p.error && p.status === 409) p = webmaker.publiceer(key, r.design.id, webmaker.slug(req.supplier.name + '-' + req.supplier.code));
    if (p.error) return stuur(res, p);
    res.json({ ok: true, design: webmaker.haal(key, r.design.id), adres: p.adres });
  });
  app.post('/api/supplier/site/mijn', supplierAuth, (req, res) => res.json({ lijst: webmaker.mijn(zaakKey(req)) }));
  app.post('/api/supplier/site/haal', supplierAuth, (req, res) => {
    const d = webmaker.haal(zaakKey(req), (req.body || {}).id);
    if (!d) return res.status(404).json({ error: 'Website niet gevonden.' });
    res.json({ design: d });
  });
  app.post('/api/supplier/site/bewaar', supplierAuth, (req, res) => {
    const b = req.body || {};
    stuur(res, webmaker.bewaar(zaakKey(req), b.design || b, { zaakCode: req.supplier.code }));
  });
  app.post('/api/supplier/site/publiceer', supplierAuth, (req, res) => { const b = req.body || {}; stuur(res, webmaker.publiceer(zaakKey(req), b.id, b.adres)); });
  app.post('/api/supplier/site/offline', supplierAuth, (req, res) => { stuur(res, webmaker.offline(zaakKey(req), (req.body || {}).id)); });

};
