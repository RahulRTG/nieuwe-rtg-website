/* Domein "supplier" (deelmodule): de defensie-toren. Paraatheid van
   eenheden, materieel en onderhoud, bevoorradingsverzoeken, de oefenagenda
   en de staf-AI (logistiek en planning, nooit wapeninzet). Logica in
   kern/defensie.js. Alleen manager-rollen (staf/commando) beheren; iedereen
   van de eenheid mag kijken. */
module.exports = (kern) => {
  const { app, defensie, logActivity, managerOnly, sseToSupplier, supplierAuth } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const sync = s => sseToSupplier(s.code, 'sync', { scope: 'defensie' });
  function isDef(s, res) { if (!defensie.isDef(s)) { res.status(409).json({ error: 'Dit is geen defensie-organisatie.' }); return false; } return true; }

  app.post('/api/supplier/def/overzicht', supplierAuth, (req, res) => {
    if (!isDef(req.supplier, res)) return;
    stuur(res, defensie.overzicht(req.supplier));
  });
  // eenheden en paraatheid
  app.post('/api/supplier/def/eenheid/maak', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return; const s = req.supplier; if (!isDef(s, res)) return;
    const r = defensie.eenheidMaak(s.code, req.body || {});
    if (!r.error) { logActivity(s.code, req.actor, 'zette eenheid ' + r.eenheid.naam + ' op het bord'); sync(s); }
    stuur(res, r);
  });
  app.post('/api/supplier/def/paraat', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isDef(s, res)) return;
    const r = defensie.paraatZet(s.code, String(req.body.id || ''), String(req.body.paraat || ''), req.body.reden);
    if (!r.error) { logActivity(s.code, req.actor, 'meldde paraatheid ' + r.eenheid.paraat + ' voor ' + r.eenheid.naam); sync(s); }
    stuur(res, r);
  });
  // materieel en onderhoud
  app.post('/api/supplier/def/materieel/maak', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return; const s = req.supplier; if (!isDef(s, res)) return;
    const r = defensie.materieelMaak(s.code, req.body || {});
    if (!r.error) sync(s);
    stuur(res, r);
  });
  app.post('/api/supplier/def/materieel/zet', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isDef(s, res)) return;
    const r = defensie.materieelZet(s.code, String(req.body.id || ''), String(req.body.staat || ''), req.body.notitie);
    if (!r.error) sync(s);
    stuur(res, r);
  });
  // bevoorrading
  app.post('/api/supplier/def/bevoorrading/maak', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isDef(s, res)) return;
    const r = defensie.bevoorradingMaak(s.code, req.body || {});
    if (!r.error) { logActivity(s.code, req.actor, 'vroeg bevoorrading aan (' + r.verzoek.prioriteit + ')'); sync(s); }
    stuur(res, r);
  });
  app.post('/api/supplier/def/bevoorrading/zet', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return; const s = req.supplier; if (!isDef(s, res)) return;
    const r = defensie.bevoorradingZet(s.code, String(req.body.id || ''), String(req.body.status || ''));
    if (!r.error) sync(s);
    stuur(res, r);
  });
  // oefeningen
  app.post('/api/supplier/def/oefening/maak', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return; const s = req.supplier; if (!isDef(s, res)) return;
    const r = defensie.oefeningMaak(s.code, req.body || {});
    if (!r.error) sync(s);
    stuur(res, r);
  });
  app.post('/api/supplier/def/oefening/zet', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isDef(s, res)) return;
    const r = defensie.oefeningZet(s.code, String(req.body.id || ''), String(req.body.status || ''));
    if (!r.error) sync(s);
    stuur(res, r);
  });
  // de staf-AI: logistiek en planning, weigert wapeninzet
  app.post('/api/supplier/def/ai', supplierAuth, async (req, res) => {
    const s = req.supplier; if (!isDef(s, res)) return;
    try { stuur(res, await defensie.stafAi(s, req.body.q)); }
    catch (e) { console.error('[defensie]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
