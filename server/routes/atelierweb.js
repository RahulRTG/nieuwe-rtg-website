/* Routes voor de Website-studio van het RTG Atelier. Achter de kantoor-inlog
   (officeAuth): het ontwerpbureau bewaart, opent, lijst en verwijdert zijn
   eigen website-sjablonen. Losstaand van de echte site. */
module.exports = (kern) => {
  const { app, officeAuth, atelierweb, antivirus, media } = kern;
  const FOTO_MAX_BYTES = 2 * 1024 * 1024; // ~2 MB per foto
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/office/atelierweb/lijst', officeAuth, (req, res) => {
    res.json({ lijst: atelierweb.lijst() });
  });

  // ---- eigen foto's: uploaden (na virusscan), tonen en weghalen ----
  app.post('/api/office/atelierweb/fotos', officeAuth, (req, res) => res.json({ fotos: atelierweb.fotos() }));
  app.post('/api/office/atelierweb/foto', officeAuth, async (req, res) => {
    const dataUrl = String((req.body || {}).dataUrl || '');
    if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(dataUrl)) return res.status(400).json({ error: 'Kies een afbeelding (jpg, png, webp of gif).' });
    if (dataUrl.length > FOTO_MAX_BYTES * 1.4) return res.status(400).json({ error: 'De foto is te groot (max ~2 MB).' });
    // eerst door de Ontsmetter: besmette bestanden komen er niet in
    const veilig = antivirus && antivirus.veiligeFoto ? antivirus.veiligeFoto(dataUrl, { bron: 'atelier-foto' }) : { ok: true };
    if (!veilig.ok) return res.status(400).json({ error: veilig.error || 'De foto is geweigerd door de beveiliging.' });
    // dan versleuteld naar de mediastore; in db.data komt alleen de /media-url
    let url = null;
    try { url = media && media.bewaarPubliek ? await media.bewaarPubliek(dataUrl, FOTO_MAX_BYTES) : null; } catch (e) { url = null; }
    if (!url) return res.status(400).json({ error: 'De foto kon niet worden opgeslagen.' });
    stuur(res, atelierweb.fotoBewaar(url));
  });
  app.post('/api/office/atelierweb/foto-weg', officeAuth, (req, res) => stuur(res, atelierweb.fotoWeg(String((req.body || {}).url || ''))));

  // beeld "Uit De Salon" als bron in de studio
  app.post('/api/office/atelierweb/salon', officeAuth, (req, res) => {
    res.json({ fotos: require('../kern/salonpromo').salonPromoFotos(kern.db) });
  });
  app.post('/api/office/atelierweb/haal', officeAuth, (req, res) => {
    const d = atelierweb.haal((req.body || {}).id);
    if (!d) return res.status(404).json({ error: 'Sjabloon niet gevonden.' });
    res.json({ design: d });
  });
  app.post('/api/office/atelierweb/bewaar', officeAuth, (req, res) => {
    const b = req.body || {};
    const design = atelierweb.bewaar(b.design || b);
    res.json({ ok: true, design });
  });
  app.post('/api/office/atelierweb/verwijder', officeAuth, (req, res) => {
    res.json(atelierweb.verwijder((req.body || {}).id));
  });
};
