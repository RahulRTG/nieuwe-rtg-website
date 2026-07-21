/* Domein "gebouw": het complete kantoorgebouw-systeem (Zuidas) voor
   partners met de gebouw-cap. De manager stuurt alles vanuit de
   leverancier-app; receptie, security, facilitair en de concierge werken
   met dezelfde endpoints vanaf de PDA (personeels-app). */
module.exports = (kern) => {
  const { app, db, supplierAuth, gebouw } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  function eisGebouw(req, res) {
    const caps = (db.data.supplierTypes[req.supplier.type] || {}).caps || [];
    if (!caps.includes('gebouw')) { res.status(403).json({ error: 'Dit is geen kantoorgebouw-partner.' }); return false; }
    return true;
  }
  const r = (pad, fn) => app.post('/api/supplier/gebouw' + pad, supplierAuth, (req, res) => {
    if (!eisGebouw(req, res)) return;
    stuur(res, fn(req.supplier.code, req.body || {}));
  });

  r('', (code) => gebouw.overzicht(code));
  r('/zaal', (code, b) => gebouw.zaalBoek(code, b));
  r('/zaal/weg', (code, b) => gebouw.zaalWeg(code, b.id));
  r('/bezoeker', (code, b) => gebouw.bezoekerMeld(code, b));
  r('/bezoeker/status', (code, b) => gebouw.bezoekerStatus(code, b.id, b.status));
  r('/badge', (code, b) => gebouw.badgeMaak(code, b));
  r('/badge/zet', (code, b) => gebouw.badgeZet(code, b.id, b.actief));
  r('/melding', (code, b) => gebouw.meldingMaak(code, b));
  r('/melding/status', (code, b) => gebouw.meldingStatus(code, b.id, b.status));
  r('/valet', (code, b) => gebouw.valetVraag(code, b));
  r('/valet/status', (code, b) => gebouw.valetStatus(code, b.id, b.status));
  r('/jetset', (code, b) => gebouw.jetsetVraag(code, b));
  r('/jetset/status', (code, b) => gebouw.jetsetStatus(code, b.id, b.status, b.notitie));
};
