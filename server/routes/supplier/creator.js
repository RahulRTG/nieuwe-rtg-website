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

  /* De paden staan voluit: een opgebouwd pad ziet scripts/schakelbaar.js niet,
     en wat die census niet ziet is vanuit de boardroom niet uit te zetten
     (scripts/check.js regel 45). De drie controles -- manager, creator-cap en
     het opslaan -- blijven op EEN plek staan. */
  const beheerDoe = (fn) => (req, res) => {
    if (!managerOnly(req, res)) return;
    const s = req.supplier; if (!isCreator(s, res)) return;
    const r = creator[fn](s, req.body || {});
    if (r.error) return res.status(400).json(r);
    sync(s); res.json(creator.overzicht(s));
  };

  app.post('/api/supplier/creator/profiel', supplierAuth, beheerDoe('zetProfiel'));
  app.post('/api/supplier/creator/platform', supplierAuth, beheerDoe('zetPlatform'));
  app.post('/api/supplier/creator/tarief', supplierAuth, beheerDoe('zetTarief'));
  app.post('/api/supplier/creator/portfolio', supplierAuth, beheerDoe('zetPortfolio'));
  app.post('/api/supplier/creator/idee', supplierAuth, beheerDoe('zetIdee'));

  // de AI content/script-helper (manager)
  app.post('/api/supplier/creator/ai', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    const s = req.supplier; if (!isCreator(s, res)) return;
    const r = await creator.contentHulp(s, String(req.body.opdracht || ''), true);
    if (r.gedaan) { logActivity(s.code, req.actor, 'liet de AI content-helper iets doen'); sync(s); }
    res.json({ antwoord: r.antwoord, gedaan: !!r.gedaan, overzicht: creator.overzicht(s) });
  });
};
