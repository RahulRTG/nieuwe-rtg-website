/* Horeca OS (deellaag): de CORRECTIE op een rekeningregel.

   Afgesplitst van ./rekening.js, dat door deze route over de 10 KB ging
   (keuringsregel 13). De snede loopt op een echte grens: rekening.js gaat over
   wat er OP de rekening komt, dit over wat eraf gaat als het misging -- en dat
   is een andere handeling, met een andere bevoegdheid en een geldgevolg.

   De kern staat in kern/horeca/correctie.js; deze laag doet de poort en het
   opslaan. Waarom deze weg er is (een weigering die naar een niet-bestaande
   deur verwees), staat in de kop van die module.

   Gemount vanuit routes/supplier/horeca.js, na ./rekening.js -- die zet
   `kern.horecaCorrectie` en `kern.horecaRekVan` klaar. */
module.exports = (kern) => {
  const { app, save, supplierAuth, logActivity, sseToSupplier } = kern;
  const rekVan = kern.horecaRekVan;
  const correctie = kern.horecaCorrectie;
  const publiek = kern.horecaPubliek;

  app.post('/api/supplier/horeca/rekening/regel/corrigeer', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    if (r.status !== 'open' && r.status !== 'betaald')
      return res.status(409).json({ error: 'Deze rekening is ' + r.status + '; daar valt niets meer op te corrigeren.' });
    const uit = correctie.corrigeer(r, { regelId: req.body.regelId, grond: req.body.grond,
      reden: req.body.reden, door: req.actor.name });
    if (!uit.ok) return res.status(uit.status || 400).json(uit);
    save();
    logActivity(req.supplier.code, req.actor, 'corrigeerde ' + uit.correctie.naam + ' op ' +
      (r.tafel || r.id) + ': ' + uit.correctie.grondLabel);
    /* Twee schermen moeten dit weten: de keuken (het gerecht hoeft niet meer de
       deur uit) en de zaal (de rekening is veranderd). */
    sseToSupplier(req.supplier.code, 'sync', { scope: 'keuken' });
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json({ ok: true, correctie: uit.correctie, rekening: publiek(r) });
  });

};
