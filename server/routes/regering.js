/* Routes van het Regeringskantoor (minister-president), de Opvang-afdeling
   (AZC/COA) en de afdelingshotels. Alle drie horen bij RTG Kantoren en
   draaien dus achter de kantoor-inlog; de werkvormen-route hangt aan de
   leverancierskant zodat een zaak ziet welke gereedschapskisten zij heeft. */
module.exports = (kern) => {
  const { app, officeAuth, supplierAuth, regering, opvang, afdelingshotel, werkvormen, afdelingen } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const wie = req => String((req.body && req.body.naam) || '').trim();

  /* ---------- het Regeringskantoor ---------- */
  app.post('/api/office/regering', officeAuth, (req, res) => res.json(regering.situatie()));
  app.post('/api/office/regering/briefing', officeAuth, (req, res) => res.json(regering.briefing()));
  app.post('/api/office/regering/besluiten', officeAuth, (req, res) => res.json(regering.besluitLijst(req.body || {})));
  app.post('/api/office/regering/besluit', officeAuth, (req, res) => stuur(res, regering.besluitMaak(wie(req), req.body || {})));
  app.post('/api/office/regering/teken', officeAuth, (req, res) => stuur(res, regering.besluitTeken(wie(req), req.body.id)));

  /* ---------- de Opvang-afdeling (AZC/COA) ---------- */
  app.post('/api/office/opvang', officeAuth, (req, res) => res.json(opvang.bord()));
  app.post('/api/office/opvang/locaties', officeAuth, (req, res) => res.json(opvang.locatieLijst()));
  app.post('/api/office/opvang/locatie', officeAuth, (req, res) => stuur(res, opvang.locatieZet(req.body.locatie || {}, req.body.id ? String(req.body.id) : null)));
  app.post('/api/office/opvang/dossiers', officeAuth, (req, res) => res.json(opvang.dossierLijst(req.body || {})));
  app.post('/api/office/opvang/dossier', officeAuth, (req, res) => stuur(res, opvang.dossierMaak(req.body.dossier || {})));
  app.post('/api/office/opvang/fase', officeAuth, (req, res) => stuur(res, opvang.faseZet(req.body.nummer, req.body.fase, req.body.notitie)));
  app.post('/api/office/opvang/dienst', officeAuth, (req, res) => stuur(res, opvang.dienstZet(req.body.nummer, req.body.dienst, req.body.aan !== false)));

  /* ---------- het hotel van elke afdeling ---------- */
  const kamerNaam = id => {
    try { const k = (afdelingen.kamers().kamers || []).find(x => x.id === id); return k ? k.naam : id; }
    catch (e) { return id; }
  };
  app.post('/api/office/afdelingshotel', officeAuth, (req, res) => {
    const id = String(req.body.kamer || '');
    if (!id) return res.json(afdelingshotel.alle());
    stuur(res, afdelingshotel.overzicht(id, kamerNaam(id)));
  });
  app.post('/api/office/afdelingshotel/zet', officeAuth, (req, res) => stuur(res, afdelingshotel.hotelZet(String(req.body.kamer || ''), req.body || {})));
  app.post('/api/office/afdelingshotel/boek', officeAuth, (req, res) => {
    const id = String(req.body.kamer || '');
    stuur(res, afdelingshotel.boek(id, kamerNaam(id), req.body || {}));
  });
  app.post('/api/office/afdelingshotel/annuleer', officeAuth, (req, res) => stuur(res, afdelingshotel.annuleer(String(req.body.kamer || ''), req.body.ref)));

  /* ---------- de werkvormen van een zaak (leverancierskant) ----------
     Een zaak ziet hier welke gereedschapskisten zij automatisch heeft:
     wie ritten rijdt EN als zelfstandige werkt, krijgt allebei. */
  app.post('/api/supplier/werkvormen', supplierAuth, (req, res) => res.json(werkvormen.overzicht(req.supplier)));
};
