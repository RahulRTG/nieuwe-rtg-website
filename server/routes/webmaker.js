/* Routes voor de Website-maker (leden) en de RTG-browser.

   Bouwen en publiceren zit achter de gewone leden-inlog en is voor echte leden
   (geen gast). De browser-gids en het openen van een site mag elk ingelogd lid,
   zodat je door het RTG-web kunt bladeren. */
module.exports = (kern) => {
  const { app, auth, webmaker, antivirus, media } = kern;
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

  // ---- de browser (elk ingelogd lid mag bladeren) ----
  app.post('/api/browser/gids', auth, (req, res) => { res.json({ lijst: webmaker.gids() }); });
  app.post('/api/browser/open', auth, (req, res) => { stuur(res, webmaker.open((req.body || {}).adres)); });
};
