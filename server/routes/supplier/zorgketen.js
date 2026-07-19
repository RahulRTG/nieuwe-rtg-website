/* Domein "supplier" (deelmodule): de zorgketen. Recepten (voorschrijver ->
   apotheek), de eerste hulp met triagekleuren (ziekenhuis), verwijzingen
   (huisarts/ziekenhuis -> specialist of beauty medical) en de afspraken van
   de specialist en beauty medical. De logica zit in kern/zorgketen.js. */
module.exports = (kern) => {
  const { app, zorgketen, logActivity, sseToSupplier, supplierAuth } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const sync = code => sseToSupplier(code, 'sync', { scope: 'zorg' });

  app.post('/api/supplier/zorg/overzicht', supplierAuth, (req, res) => stuur(res, zorgketen.zorgOverzicht(req.supplier)));
  // recepten: voorschrijven en afhandelen
  app.post('/api/supplier/zorg/recept/maak', supplierAuth, (req, res) => {
    const r = zorgketen.receptMaak(req.supplier.code, { apotheek: String(req.body.apotheek || '').toUpperCase(), middel: req.body.middel, dosering: req.body.dosering });
    if (!r.error) { logActivity(req.supplier.code, req.actor, 'schreef een recept voor'); sync(r.recept.apotheek); }
    stuur(res, r);
  });
  app.post('/api/supplier/zorg/recept/zet', supplierAuth, (req, res) => {
    const r = zorgketen.receptZet(req.supplier.code, String(req.body.id || ''), String(req.body.status || ''));
    if (!r.error) sync(req.supplier.code);
    stuur(res, r);
  });
  // de eerste hulp: binnenkomst en de rij
  app.post('/api/supplier/zorg/seh/binnen', supplierAuth, (req, res) => {
    const r = zorgketen.sehBinnen(req.supplier.code, req.body || {});
    if (!r.error) { logActivity(req.supplier.code, req.actor, 'nam een patient aan op de eerste hulp (' + r.patient.triage + ')'); sync(req.supplier.code); }
    stuur(res, r);
  });
  app.post('/api/supplier/zorg/seh/zet', supplierAuth, (req, res) => {
    const r = zorgketen.sehZet(req.supplier.code, String(req.body.id || ''), String(req.body.status || ''));
    if (!r.error) sync(req.supplier.code);
    stuur(res, r);
  });
  // verwijzingen: sturen en afhandelen
  app.post('/api/supplier/zorg/verwijs/maak', supplierAuth, (req, res) => {
    const r = zorgketen.verwijsMaak(req.supplier.code, { naar: String(req.body.naar || '').toUpperCase(), reden: req.body.reden });
    if (!r.error) { logActivity(req.supplier.code, req.actor, 'verwees een patient door'); sync(r.verwijzing.naar); }
    stuur(res, r);
  });
  app.post('/api/supplier/zorg/verwijs/zet', supplierAuth, (req, res) => {
    const r = zorgketen.verwijsZet(req.supplier.code, String(req.body.id || ''), String(req.body.status || ''));
    if (!r.error) sync(req.supplier.code);
    stuur(res, r);
  });
  // de medische receptie: aanmelden, oproepen naar een kamer, klaar
  app.post('/api/supplier/zorg/receptie/aan', supplierAuth, (req, res) => {
    const r = zorgketen.receptieAan(req.supplier.code, req.body || {});
    if (!r.error) { logActivity(req.supplier.code, req.actor, 'meldde een bezoek aan bij de receptie'); sync(req.supplier.code); }
    stuur(res, r);
  });
  app.post('/api/supplier/zorg/receptie/roep', supplierAuth, (req, res) => {
    const r = zorgketen.receptieRoep(req.supplier.code, String(req.body.id || ''), req.body.kamer);
    if (!r.error) sync(req.supplier.code);
    stuur(res, r);
  });
  app.post('/api/supplier/zorg/receptie/klaar', supplierAuth, (req, res) => {
    const r = zorgketen.receptieKlaar(req.supplier.code, String(req.body.id || ''));
    if (!r.error) sync(req.supplier.code);
    stuur(res, r);
  });
  // afspraken: specialist en beauty medical
  app.post('/api/supplier/zorg/afspraak/maak', supplierAuth, (req, res) => {
    const r = zorgketen.afspraakMaak(req.supplier.code, req.body || {});
    if (!r.error) sync(req.supplier.code);
    stuur(res, r);
  });
  app.post('/api/supplier/zorg/afspraak/zet', supplierAuth, (req, res) => {
    const r = zorgketen.afspraakZet(req.supplier.code, String(req.body.id || ''), String(req.body.status || ''));
    if (!r.error) sync(req.supplier.code);
    stuur(res, r);
  });
};
