/* Domein "supplier" (deelmodule): content creator. Draait op de gedeelde kern.
   De carriere-app van een content creator: profiel, platforms, tarieven,
   portfolio, content-kalender en de AI content/script-helper. De logica zit in
   kern/creator.js. Samenwerkingen en financien lopen via de gedeelde lagen. */
module.exports = (kern) => {
  const { app, creator, logActivity, managerOnly, sseToSupplier, supplierAuth } = kern;

  function isCreator(s, res) {
    if (!creator.isCreator(s)) { res.status(409).json({ error: 'Dit is geen content-creator-account.' }); return false; }
    return true;
  }
  function sync(s) { sseToSupplier(s.code, 'sync', { scope: 'creator' }); }

  app.post('/api/supplier/creator/overzicht', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isCreator(s, res)) return;
    res.json(creator.overzicht(s));
  });

  const beheer = [
    ['profiel', 'zetProfiel'], ['platform', 'zetPlatform'], ['tarief', 'zetTarief'],
    ['portfolio', 'zetPortfolio'], ['idee', 'zetIdee']
  ];
  for (const [pad, fn] of beheer) {
    app.post('/api/supplier/creator/' + pad, supplierAuth, (req, res) => {
      if (!managerOnly(req, res)) return;
      const s = req.supplier; if (!isCreator(s, res)) return;
      const r = creator[fn](s, req.body || {});
      if (r.error) return res.status(400).json(r);
      sync(s); res.json(creator.overzicht(s));
    });
  }

  // de AI content/script-helper (manager)
  app.post('/api/supplier/creator/ai', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    const s = req.supplier; if (!isCreator(s, res)) return;
    const r = await creator.contentHulp(s, String(req.body.opdracht || ''), true);
    if (r.gedaan) { logActivity(s.code, req.actor, 'liet de AI content-helper iets doen'); sync(s); }
    res.json({ antwoord: r.antwoord, gedaan: !!r.gedaan, overzicht: creator.overzicht(s) });
  });
};
