/* Routes voor het Journalistiek-genre.
   - /api/supplier/redactie/*  : de redactie zelf (achter de leverancier-inlog)
   - /api/krant/*              : de gepubliceerde krant lezen (openbaar) */
module.exports = (kern) => {
  const { app, supplierAuth, journalistiek } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const code = req => req.supplier.code;

  app.post('/api/supplier/redactie/staat', supplierAuth, (req, res) => res.json(journalistiek.staat(code(req))));
  app.post('/api/supplier/redactie/artikelen', supplierAuth, (req, res) => res.json(journalistiek.artikelen(code(req), req.body || {})));
  app.post('/api/supplier/redactie/artikel/haal', supplierAuth, (req, res) => {
    const a = journalistiek.artikelVol(code(req), (req.body || {}).id);
    if (!a) return res.status(404).json({ error: 'Artikel niet gevonden.' });
    res.json({ artikel: a });
  });
  app.post('/api/supplier/redactie/artikel/bewaar', supplierAuth, (req, res) => stuur(res, journalistiek.bewaarArtikel(code(req), req.body || {}, req.actor)));
  app.post('/api/supplier/redactie/artikel/publiceer', supplierAuth, (req, res) => stuur(res, journalistiek.publiceer(code(req), (req.body || {}).id, req.actor)));
  app.post('/api/supplier/redactie/artikel/concept', supplierAuth, (req, res) => stuur(res, journalistiek.naarConcept(code(req), (req.body || {}).id)));
  app.post('/api/supplier/redactie/artikel/verwijder', supplierAuth, (req, res) => stuur(res, journalistiek.verwijderArtikel(code(req), (req.body || {}).id)));
  app.post('/api/supplier/redactie/snel', supplierAuth, (req, res) => stuur(res, journalistiek.snel(code(req), req.body || {}, req.actor)));
  app.post('/api/supplier/redactie/rubriek/bewaar', supplierAuth, (req, res) => stuur(res, journalistiek.rubriekBewaar(code(req), (req.body || {}).naam)));
  app.post('/api/supplier/redactie/rubriek/verwijder', supplierAuth, (req, res) => stuur(res, journalistiek.rubriekWeg(code(req), (req.body || {}).naam)));
  app.post('/api/supplier/redactie/huisstijl', supplierAuth, (req, res) => stuur(res, journalistiek.huisstijlBewaar(code(req), req.body || {})));
  app.post('/api/supplier/redactie/site/bewaar', supplierAuth, (req, res) => stuur(res, journalistiek.siteBewaar(code(req), (req.body || {}).design || req.body || {})));
  app.post('/api/supplier/redactie/assist', supplierAuth, async (req, res) => { try { res.json(await journalistiek.assist(code(req), req.body || {})); } catch (e) { res.json({ chapo: '', koppen: [] }); } });

  // openbaar: de krant lezen
  app.post('/api/krant/gids', (req, res) => res.json({ lijst: journalistiek.krantGids() }));
  app.post('/api/krant/open', (req, res) => stuur(res, journalistiek.krant(String((req.body || {}).code || '').toUpperCase())));
  app.post('/api/krant/artikel', (req, res) => stuur(res, journalistiek.leesArtikel(String((req.body || {}).code || '').toUpperCase(), (req.body || {}).id)));
};
