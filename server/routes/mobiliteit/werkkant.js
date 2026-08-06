/* Domein "mobiliteit" (deelmodule): de WERKKANT. De vervoerder, de dispatcher
   en RTG zelf. De reizigers- en chauffeurskant staat in ../mobiliteit.js; die
   mount deze module met dezelfde kern, zodat er maar een bedrading is.

   Afgesplitst omdat het geheel over de 10 kB-grens van de omvangregel liep. De
   naad is niet willekeurig: hierboven staat wie een rit VRAAGT, hieronder wie
   hem UITVOERT en wie bepaalt welk vervoer er in een gebied bestaat. */
module.exports = (kern, hulp) => {
  const { app, supplierAuth, managerOnly, officeAuth, schoon, plekLijst,
    modBord, modZet, modStoring, modAan,
    assetZet, assetLijst,
    matchGewichten, matchGewichtenZet,
    dispatchBeeld, dispatchVoorstel, dispatchWijsToe, dispatchOverboek, dispatchTelefoonboeking, dispatchSpoor,
    pendelZet, pendelLijst, pendelRooster, pendelPlan, pendelNoShow } = kern;
  const { stuur } = hulp;

  /* ---------------- de vervoerder en de dispatcher ---------------- */
  app.post('/api/supplier/mob/vloot', supplierAuth, (req, res) => {
    stuur(res, assetLijst(req.supplier.code, { vervoerder: req.supplier.code }));
  });
  app.post('/api/supplier/mob/voertuig', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, assetZet(req.supplier.code, req.body || {}));
  });
  app.post('/api/supplier/mob/dispatch', supplierAuth, (req, res) => {
    stuur(res, dispatchBeeld(req.supplier.code, { vervoerder: req.supplier.code }));
  });
  app.post('/api/supplier/mob/voorstel', supplierAuth, (req, res) => {
    stuur(res, dispatchVoorstel(req.supplier.code, req.body.ref, { vervoerder: req.supplier.code }));
  });
  app.post('/api/supplier/mob/toewijzen', supplierAuth, (req, res) => {
    stuur(res, dispatchWijsToe(req.supplier.code, req.actor && req.actor.name, req.body || {}));
  });
  app.post('/api/supplier/mob/overboeken', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, dispatchOverboek(req.supplier.code, req.actor && req.actor.name, req.body || {}));
  });
  app.post('/api/supplier/mob/telefoon', supplierAuth, (req, res) => {
    stuur(res, dispatchTelefoonboeking(req.supplier.code, req.actor && req.actor.name, req.body || {}));
  });
  /* Dezelfde bestemmingenlijst als de reiziger ziet, maar zonder sessie: de
     dispatcher kiest "Sal de Mar" uit onze eigen zaken in plaats van een adres
     in te tikken. Bewust geen favorieten -- die zijn van het lid. */
  app.post('/api/supplier/mob/plekken', supplierAuth, (req, res) => {
    stuur(res, plekLijst(req.body.bij || req.supplier.loc, null, req.body || {}));
  });
  app.post('/api/supplier/mob/spoor', supplierAuth, (req, res) => {
    stuur(res, dispatchSpoor(req.supplier.code, req.body.ref));
  });
  /* De wegingen van de toewijzing. Alleen de manager: dit is beleid over hoe
     werk verdeeld wordt, geen instelling van een dienst. */
  app.post('/api/supplier/mob/wegingen', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    if (!req.body || !req.body.gewichten) return res.json({ ok: true, gewichten: matchGewichten({ vervoerder: req.supplier.code }) });
    stuur(res, matchGewichtenZet(Object.assign({}, req.body, { vervoerder: req.supplier.code })));
  });

  // de werkgeverskant van de bedrijfspendel
  app.post('/api/supplier/mob/pendel', supplierAuth, (req, res) => {
    stuur(res, pendelLijst(req.supplier.code));
  });
  app.post('/api/supplier/mob/pendel/zet', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, pendelZet(req.supplier.code, req.body || {}));
  });
  app.post('/api/supplier/mob/pendel/rooster', supplierAuth, (req, res) => {
    const r = pendelRooster(schoon(req.body.id, 40), req.body.datum);
    if (!r.error && r.pendel && r.pendel.werkgever !== req.supplier.code)
      return res.status(403).json({ error: 'Deze pendeldienst hoort bij een ander bedrijf.' });
    stuur(res, r);
  });
  app.post('/api/supplier/mob/pendel/plan', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, pendelPlan(req.supplier.code, req.body || {}));
  });
  app.post('/api/supplier/mob/pendel/noshow', supplierAuth, (req, res) => {
    stuur(res, pendelNoShow(req.supplier.code, req.body || {}));
  });

  /* ---------------- RTG zelf: het moduleregister ---------------- */
  app.post('/api/office/mob/modules', officeAuth, (req, res) => {
    stuur(res, modBord(req.body || {}));
  });
  app.post('/api/office/mob/module/zet', officeAuth, (req, res) => {
    stuur(res, modZet(req.body || {}));
  });
  /* De storingsknop: een module die stuk is meteen uit, overal. Bewust apart
     van 'zet', zodat na het herstel te zien blijft wat een storing was en wat
     iemand bewust had uitgezet. */
  app.post('/api/office/mob/storing', officeAuth, (req, res) => {
    stuur(res, modStoring(schoon(req.body.id, 40), req.body.reden));
  });
  app.post('/api/office/mob/proef', officeAuth, (req, res) => {
    stuur(res, { ok: true, oordeel: modAan(schoon(req.body.id, 40), req.body.waar || {}) });
  });
};
