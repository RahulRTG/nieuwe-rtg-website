/* Domein "planners": weddings en prive-events, professionele diensten en
   verzekeringen (adviserend), elk achter een eigen cap ('weddings',
   'advies', 'polis'); de kern in server/kern/planners.js. */
module.exports = (kern) => {
  const { app, db, supplierAuth, weddings, advies, polis } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  const maak = (basis, capNaam, domein) => (pad, fn) => app.post(basis + pad, supplierAuth, (req, res) => {
    const caps = (db.data.supplierTypes[req.supplier.type] || {}).caps || [];
    if (!caps.includes(capNaam)) { res.status(403).json({ error: 'Deze zaak is geen ' + domein + '.' }); return; }
    stuur(res, fn(req.supplier.code, req.body || {}));
  });

  const w = maak('/api/supplier/weddings', 'weddings', 'wedding- en eventplanner');
  w('', (code) => weddings.overzicht(code));
  w('/event', (code, b) => weddings.eventMaak(code, b));
  w('/taak', (code, b) => weddings.taakMaak(code, b));
  w('/taak/klaar', (code, b) => weddings.taakKlaar(code, b.eventId, b.taakId));
  w('/event/status', (code, b) => weddings.eventStatus(code, b.id, b.status));

  const a = maak('/api/supplier/advies', 'advies', 'professionele praktijk');
  a('', (code) => advies.overzicht(code));
  a('/dossier', (code, b) => advies.dossierMaak(code, b));
  a('/dossier/status', (code, b) => advies.dossierStatus(code, b.id, b.status));
  a('/afspraak', (code, b) => advies.afspraakBoek(code, b));

  const p = maak('/api/supplier/polis', 'polis', 'verzekeringsadviseur');
  p('', (code) => polis.overzicht(code));
  p('/vraag', (code, b) => polis.adviesVraag(code, b));
  p('/zet', (code, b) => polis.adviesZet(code, b));
};
