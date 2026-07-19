/* Domein "supplier" (deelmodule): de defensie-toren. Paraatheid van
   eenheden, materieel en onderhoud, bevoorradingsverzoeken, de oefenagenda
   en de staf-AI (logistiek en planning, nooit wapeninzet). Logica in
   kern/defensie.js. Alleen manager-rollen (staf/commando) beheren; iedereen
   van de eenheid mag kijken. */
module.exports = (kern) => {
  const { app, defensie, zorgketen, findSupplier, logActivity, managerOnly, sseToSupplier, supplierAuth } = kern;
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
  // het veldhospitaal: gewondenopvang met triage en evacuatie naar het ziekenhuis
  app.post('/api/supplier/def/gewonde/maak', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isDef(s, res)) return;
    const r = defensie.gewondeMaak(s.code, req.body || {});
    if (!r.error) { logActivity(s.code, req.actor, 'nam een gewonde op (' + r.gewonde.triage + ')'); sync(s); }
    stuur(res, r);
  });
  app.post('/api/supplier/def/gewonde/zet', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isDef(s, res)) return;
    const r = defensie.gewondeZet(s.code, String(req.body.id || ''), String(req.body.status || ''));
    if (!r.error) sync(s);
    stuur(res, r);
  });
  app.post('/api/supplier/def/gewonde/evacueer', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isDef(s, res)) return;
    const zk = findSupplier(String(req.body.ziekenhuis || '').toUpperCase());
    if (!zk || zk.type !== 'ziekenhuis') return res.status(404).json({ error: 'Dit ziekenhuis kennen we niet.' });
    const r = defensie.gewondeEvac(s.code, String(req.body.id || ''), zk.name);
    if (r.error) return stuur(res, r);
    // de overdracht komt bij het ziekenhuis binnen op de eerste hulp (SEH)
    if (zorgketen) zorgketen.sehBinnen(zk.code, { klacht: r.gewonde.klacht + ' (veldevacuatie ' + s.name + ')', triage: r.gewonde.triage, via: 'veldevacuatie' });
    logActivity(s.code, req.actor, 'evacueerde een gewonde naar ' + zk.name);
    sync(s); sseToSupplier(zk.code, 'sync', { scope: 'zorg' });
    stuur(res, r);
  });
  // verplaatsingen: mensen, materieel en voorraad verzetten
  app.post('/api/supplier/def/verplaatsing/maak', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return; const s = req.supplier; if (!isDef(s, res)) return;
    const r = defensie.verplaatsingMaak(s.code, req.body || {});
    if (!r.error) { logActivity(s.code, req.actor, 'plande een verplaatsing (' + r.verplaatsing.lading + ' via ' + r.verplaatsing.soort + ')'); sync(s); }
    stuur(res, r);
  });
  app.post('/api/supplier/def/verplaatsing/zet', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isDef(s, res)) return;
    const r = defensie.verplaatsingZet(s.code, String(req.body.id || ''), String(req.body.status || ''));
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
