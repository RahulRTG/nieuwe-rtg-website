/* Domein "supplier" (deelmodule): samenwerkingen tussen content creators en
   leveranciers. Beschikbaar voor ELKE leverancier (creator of niet); de logica
   in kern/samenwerking.js kiest per rol wat mag. */
module.exports = (kern) => {
  const { app, samenwerking, managerOnly, supplierAuth } = kern;

  // lijsten om te bladeren
  app.post('/api/supplier/samenwerking/creators', supplierAuth, (req, res) => {
    res.json({ creators: samenwerking.creators(100) });
  });
  app.post('/api/supplier/samenwerking/leveranciers', supplierAuth, (req, res) => {
    res.json({ leveranciers: samenwerking.leveranciers(100) });
  });

  // mijn overzicht: voorstellen (in/uit), mijn oproepen, open oproepen
  app.post('/api/supplier/samenwerking/mijn', supplierAuth, (req, res) => {
    const s = req.supplier;
    res.json({
      isCreator: samenwerking.isCreator(s),
      voorstellen: samenwerking.mijn(s),
      mijnOproepen: samenwerking.mijnOproepen(s),
      openOproepen: samenwerking.openOproepen(s, 100)
    });
  });

  // EEN KNOP: een samenwerking voorstellen aan een andere partij
  app.post('/api/supplier/samenwerking/voorstel', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = samenwerking.stelVoor(req.supplier, req.body.naarCode, req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, id: r.id });
  });

  // beslissen over een binnenkomend voorstel
  app.post('/api/supplier/samenwerking/beslis', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = samenwerking.beslis(req.supplier, String(req.body.id || ''), req.body.actie === 'accepteren' ? 'accepteren' : 'afwijzen');
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, status: r.status });
  });

  // EEN KNOP (leverancier): een oproep voor creators plaatsen / sluiten
  app.post('/api/supplier/samenwerking/oproep', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = samenwerking.plaatsOproep(req.supplier, req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, id: r.id });
  });
  app.post('/api/supplier/samenwerking/oproep/sluit', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = samenwerking.sluitOproep(req.supplier, String(req.body.id || ''));
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true });
  });

  // creator reageert op een oproep
  app.post('/api/supplier/samenwerking/reageer', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = samenwerking.reageer(req.supplier, String(req.body.oproepId || ''), req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true });
  });

  // leverancier kiest een creator uit de reacties
  app.post('/api/supplier/samenwerking/kies', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = samenwerking.kies(req.supplier, String(req.body.oproepId || ''), String(req.body.creatorCode || '').toUpperCase());
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, id: r.id });
  });
};
