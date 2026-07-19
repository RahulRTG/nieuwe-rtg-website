/* Domein "supplier" (deelmodule): de hulpdiensten. De meldkamer (de
   klantenservice-room van het korps), eenheden over land, water en door de
   lucht, bijstand tussen korpsen (special forces alleen via de politie),
   het beddenbord en de opnames van het ziekenhuis, en de consulten van de
   huisarts. De logica zit in kern/hulpdienst.js; hier alleen de endpoints,
   de rechten en het realtime-seintje. */
module.exports = (kern) => {
  const { app, hulpdienst, logActivity, managerOnly, sseToSupplier, supplierAuth } = kern;

  function isKorps(s, res) {
    if (!hulpdienst.isHulp(s)) { res.status(409).json({ error: 'Dit is geen hulpdienst.' }); return false; }
    return true;
  }
  const sync = s => sseToSupplier(s.code, 'sync', { scope: 'hulpdienst' });
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  // het bord: iedereen van het korps mag kijken
  app.post('/api/supplier/hulp/overzicht', supplierAuth, (req, res) => {
    if (!isKorps(req.supplier, res)) return;
    stuur(res, hulpdienst.overzicht(req.supplier));
  });
  // eenheden beheren (manager): opvoeren en vrij/buiten-dienst zetten
  app.post('/api/supplier/hulp/eenheid/maak', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const s = req.supplier; if (!isKorps(s, res)) return;
    const r = hulpdienst.eenheidMaak(s.code, req.body.naam, String(req.body.soort || ''));
    if (!r.error) { logActivity(s.code, req.actor, 'zette eenheid ' + r.eenheid.naam + ' op het bord'); sync(s); }
    stuur(res, r);
  });
  app.post('/api/supplier/hulp/eenheid/zet', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isKorps(s, res)) return;
    const r = hulpdienst.eenheidZet(s.code, String(req.body.id || ''), String(req.body.status || ''));
    if (!r.error) sync(s);
    stuur(res, r);
  });
  // de meldkamer: aannemen, toewijzen, statusketen en bijstand
  app.post('/api/supplier/hulp/melding/maak', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isKorps(s, res)) return;
    const r = hulpdienst.meldingMaak(s.code, req.body || {});
    if (!r.error) { logActivity(s.code, req.actor, 'nam een melding aan (prio ' + r.melding.prio + ')'); sync(s); }
    stuur(res, r);
  });
  app.post('/api/supplier/hulp/melding/wijs', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isKorps(s, res)) return;
    const r = hulpdienst.meldingWijs(s.code, String(req.body.melding || ''), String(req.body.eenheid || ''));
    if (!r.error) sync(s);
    stuur(res, r);
  });
  app.post('/api/supplier/hulp/melding/status', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isKorps(s, res)) return;
    const r = hulpdienst.meldingStatus(s.code, String(req.body.melding || ''), String(req.body.status || ''));
    if (!r.error) sync(s);
    stuur(res, r);
  });
  app.post('/api/supplier/hulp/bijstand', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isKorps(s, res)) return;
    const r = hulpdienst.bijstandVraag(s.code, String(req.body.melding || ''), String(req.body.korps || '').toUpperCase());
    if (!r.error) { logActivity(s.code, req.actor, 'vroeg bijstand voor een melding'); sync(s); sseToSupplier(String(req.body.korps || '').toUpperCase(), 'sync', { scope: 'hulpdienst' }); }
    stuur(res, r);
  });
  // ziekenhuis: het beddenbord en de opnames
  app.post('/api/supplier/hulp/bedden', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const s = req.supplier; if (!isKorps(s, res)) return;
    if (s.type !== 'ziekenhuis') return res.status(403).json({ error: 'Alleen het ziekenhuis heeft een beddenbord.' });
    stuur(res, hulpdienst.beddenZet(s.code, req.body.totaal));
  });
  app.post('/api/supplier/hulp/overdracht', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isKorps(s, res)) return;
    const r = hulpdienst.overdrachtMaak(s.code, { ziekenhuis: String(req.body.ziekenhuis || '').toUpperCase(), triage: req.body.triage });
    if (!r.error) { logActivity(s.code, req.actor, 'kondigde een overdracht aan'); sseToSupplier(r.opname.ziekenhuis, 'sync', { scope: 'hulpdienst' }); }
    stuur(res, r);
  });
  app.post('/api/supplier/hulp/opname/zet', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isKorps(s, res)) return;
    const r = hulpdienst.opnameZet(s.code, String(req.body.id || ''), String(req.body.status || ''));
    if (!r.error) sync(s);
    stuur(res, r);
  });
  // huisarts: consulten met urgentie
  app.post('/api/supplier/hulp/consult/maak', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isKorps(s, res)) return;
    const r = hulpdienst.consultMaak(s.code, req.body || {});
    if (!r.error) sync(s);
    stuur(res, r);
  });
  app.post('/api/supplier/hulp/consult/zet', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isKorps(s, res)) return;
    const r = hulpdienst.consultZet(s.code, String(req.body.id || ''), String(req.body.status || ''));
    if (!r.error) sync(s);
    stuur(res, r);
  });
  // de meldkamer-AI: prioriteren en de juiste eenheid kiezen, eerlijk over de demo-aard
  app.post('/api/supplier/hulp/ai', supplierAuth, async (req, res) => {
    const s = req.supplier; if (!isKorps(s, res)) return;
    try { stuur(res, await hulpdienst.meldkamerAi(s, req.body.q)); }
    catch (e) { console.error('[hulpdienst]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
