/* Horeca OS (deellaag): DE WIJK -- welke tafels zijn van wie.

   De regels staan in kern/horeca/wijk.js; hier staat de deur. Twee soorten
   handelingen, en ze horen bij verschillende mensen:

     indelen   wie welke tafels krijgt is een besluit van de leiding, dus
               manager-werk. Een bediening die zijn eigen wijk kan hertekenen,
               kan er ook de drukste tafels uit halen.
     nemen     een wijk oppakken en loslaten doet de bediening zelf, aan het
               begin en het eind van een dienst. Dat is geen planning maar een
               handeling van een halve seconde -- planning vooraf klopt op een
               drukke avond toch nooit. */
'use strict';

module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, managerOnly, logActivity, sseToSupplier, horeca } = kern;
  const { H } = horeca;
  const wijk = require('../../../kern/horeca/wijk')({ horeca, schoon });

  const wieVan = (req) => ({ staffId: req.actor.staffId == null ? null : String(req.actor.staffId),
    naam: req.actor.name, manager: !!req.actor.manager });
  const duw = (code) => sseToSupplier(code, 'sync', { scope: 'horeca' });

  app.post('/api/supplier/horeca/wijken', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const ik = wieVan(req);
    const rijen = wijk.lijst(h).map((w) => Object.assign({}, w,
      { vanMij: !!(w.van && String(w.van.staffId) === String(ik.staffId)) }));
    res.json({ ok: true, wijken: rijen,
      mijne: rijen.filter((w) => w.vanMij).map((w) => w.naam),
      tafels: (req.supplier.tables || []).map((t) => t.name),
      let: 'Een tafel die in geen wijk zit en een wijk die niemand draagt, zijn van ' +
        'iedereen. Een wijk verdeelt werk en verbergt het nooit.' });
  });

  app.post('/api/supplier/horeca/wijk/zet', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const h = H(req.supplier.code);
    const uit = wijk.zet(h, { wijkId: req.body.wijkId, naam: req.body.naam, tafels: req.body.tafels });
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    save();
    logActivity(req.supplier.code, req.actor, 'zette wijk "' + uit.wijk.naam + '" op ' + uit.wijk.tafels.length + ' tafel(s)');
    duw(req.supplier.code);
    res.json(uit);
  });

  app.post('/api/supplier/horeca/wijk/weg', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const h = H(req.supplier.code);
    const uit = wijk.weg(h, req.body.wijkId);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    save();
    logActivity(req.supplier.code, req.actor, 'haalde wijk "' + uit.wijk.naam + '" weg');
    duw(req.supplier.code);
    res.json(uit);
  });

  app.post('/api/supplier/horeca/wijk/neem', supplierAuth, (req, res) => {
    const ik = wieVan(req);
    if (ik.staffId == null) return res.status(403).json({ error: 'Alleen vanaf een persoonlijke inlog.' });
    const h = H(req.supplier.code);
    const uit = wijk.neem(h, req.body.wijkId, ik);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error, code: uit.code || null, van: uit.van });
    if (!uit.al) {
      save();
      logActivity(req.supplier.code, req.actor, 'nam wijk "' + uit.wijk.naam + '"');
      duw(req.supplier.code);
    }
    res.json(uit);
  });

  app.post('/api/supplier/horeca/wijk/laat', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const uit = wijk.laat(h, req.body.wijkId, wieVan(req));
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    save();
    logActivity(req.supplier.code, req.actor, 'liet een wijk los');
    duw(req.supplier.code);
    res.json(uit);
  });
};
