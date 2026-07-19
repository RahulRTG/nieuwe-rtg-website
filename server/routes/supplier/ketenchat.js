/* Domein "supplier" (deelmodule): de ketenchat van de hulpdiensten en de
   zorg. Eenmalig verbinden, het gezamenlijke ketenkanaal, besloten
   deelgroepen (meldkamer kijkt mee) en de interne noodknop draait op de
   bestaande /api/supplier/security. Logica in kern/ketenchat.js. */
module.exports = (kern) => {
  const { app, ketenchat, logActivity, sseToSupplier, supplierAuth } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/supplier/keten/status', supplierAuth, (req, res) => stuur(res, ketenchat.status(req.supplier, req.actor)));
  app.post('/api/supplier/keten/verzoek', supplierAuth, (req, res) => {
    const r = ketenchat.verzoek(req.supplier.code, String(req.body.korps || '').toUpperCase());
    if (!r.error) { logActivity(req.supplier.code, req.actor, 'nodigde een korps uit voor de keten'); sseToSupplier(String(req.body.korps || '').toUpperCase(), 'sync', { scope: 'keten' }); }
    stuur(res, r);
  });
  app.post('/api/supplier/keten/beslis', supplierAuth, (req, res) => {
    const r = ketenchat.beslis(req.supplier.code, String(req.body.korps || '').toUpperCase(), req.body.akkoord === true);
    if (!r.error) { logActivity(req.supplier.code, req.actor, 'besliste over een keten-uitnodiging: ' + r.status); sseToSupplier(String(req.body.korps || '').toUpperCase(), 'sync', { scope: 'keten' }); }
    stuur(res, r);
  });
  app.post('/api/supplier/keten/groep/maak', supplierAuth, (req, res) => {
    const r = ketenchat.groepMaak(req.supplier.code, req.actor, req.body || {});
    if (!r.error) {
      logActivity(req.supplier.code, req.actor, 'maakte ketengroep "' + r.groep.naam + '"');
      for (const k of r.groep.korpsen) sseToSupplier(k, 'sync', { scope: 'keten' });
    }
    stuur(res, r);
  });
  app.post('/api/supplier/keten/gesprek', supplierAuth, (req, res) => stuur(res, ketenchat.gesprek(req.supplier, req.actor, req.body.kanaal)));
  app.post('/api/supplier/keten/bericht', supplierAuth, (req, res) => {
    const r = ketenchat.bericht(req.supplier, req.actor, req.body.kanaal, req.body.tekst);
    if (!r.error) {
      // het seintje gaat naar alle betrokken korpsen, zodat elk scherm meeleest
      const k = String(req.body.kanaal || 'keten');
      const st = ketenchat.status(req.supplier, req.actor);
      const doelen = k === 'keten' ? (st.partners || []) : [];
      for (const d of new Set([...doelen, req.supplier.code])) sseToSupplier(d, 'sync', { scope: 'keten' });
    }
    stuur(res, r);
  });
};
