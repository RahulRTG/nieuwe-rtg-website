/* Domein "gebouw": het complete kantoorgebouw-systeem (RTG Enterprise) voor
   partners met de gebouw-cap. De manager stuurt alles vanuit de
   leverancier-app; receptie, security, facilitair en de concierge werken
   met dezelfde endpoints vanaf de PDA (personeels-app). */
module.exports = (kern) => {
  const { app, db, supplierAuth, gebouw } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  function eisGebouw(req, res) {
    const caps = db.capsVan(req.supplier);
    if (!caps.includes('gebouw')) { res.status(403).json({ error: 'Dit is geen kantoorgebouw-partner.' }); return false; }
    return true;
  }
  /* De paden staan voluit en niet als '/api/supplier/gebouw' + pad. Een opgebouwd pad
     ziet scripts/schakelbaar.js niet, en wat die census niet ziet is vanuit
     de boardroom niet uit te zetten en niet per stad te sluiten
     (scripts/check.js regel 45). De controle eromheen blijft op EEN plek;
     alleen de registratie is uitgeschreven. */
  const doe = (fn) => (req, res) => {
    if (!eisGebouw(req, res)) return;
    stuur(res, fn(req.supplier.code, req.body || {}));
  };

  app.post('/api/supplier/gebouw', supplierAuth, doe((code) => gebouw.overzicht(code)));
  app.post('/api/supplier/gebouw/zaal', supplierAuth, doe((code, b) => gebouw.zaalBoek(code, b)));
  app.post('/api/supplier/gebouw/zaal/weg', supplierAuth, doe((code, b) => gebouw.zaalWeg(code, b.id)));
  app.post('/api/supplier/gebouw/bezoeker', supplierAuth, doe((code, b) => gebouw.bezoekerMeld(code, b)));
  app.post('/api/supplier/gebouw/bezoeker/status', supplierAuth, doe((code, b) => gebouw.bezoekerStatus(code, b.id, b.status)));
  app.post('/api/supplier/gebouw/badge', supplierAuth, doe((code, b) => gebouw.badgeMaak(code, b)));
  app.post('/api/supplier/gebouw/badge/zet', supplierAuth, doe((code, b) => gebouw.badgeZet(code, b.id, b.actief)));
  app.post('/api/supplier/gebouw/melding', supplierAuth, doe((code, b) => gebouw.meldingMaak(code, b)));
  app.post('/api/supplier/gebouw/melding/status', supplierAuth, doe((code, b) => gebouw.meldingStatus(code, b.id, b.status)));
  app.post('/api/supplier/gebouw/valet', supplierAuth, doe((code, b) => gebouw.valetVraag(code, b)));
  app.post('/api/supplier/gebouw/valet/status', supplierAuth, doe((code, b) => gebouw.valetStatus(code, b.id, b.status)));
  app.post('/api/supplier/gebouw/jetset', supplierAuth, doe((code, b) => gebouw.jetsetVraag(code, b)));
  app.post('/api/supplier/gebouw/jetset/status', supplierAuth, doe((code, b) => gebouw.jetsetStatus(code, b.id, b.status, b.notitie)));
};
