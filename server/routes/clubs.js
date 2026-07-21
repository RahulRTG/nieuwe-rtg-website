/* Domein "clubs": de golf- en countryclub en de sport- en fitnessclub.
   Beide draaien in de leverancier-app achter hun eigen cap ('golf' en
   'fitclub'); de kern in server/kern/clubs.js. */
module.exports = (kern) => {
  const { app, db, supplierAuth, golfclub, fitclub } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  const maak = (basis, capNaam, domein) => (pad, fn) => app.post(basis + pad, supplierAuth, (req, res) => {
    const caps = (db.data.supplierTypes[req.supplier.type] || {}).caps || [];
    if (!caps.includes(capNaam)) { res.status(403).json({ error: 'Deze zaak is geen ' + domein + '.' }); return; }
    stuur(res, fn(req.supplier.code, req.body || {}));
  });

  const g = maak('/api/supplier/golf', 'golf', 'golfclub');
  g('', (code) => golfclub.overzicht(code));
  g('/tee', (code, b) => golfclub.teeBoek(code, b));
  g('/tee/weg', (code, b) => golfclub.teeWeg(code, b.id));
  g('/les', (code, b) => golfclub.les(code, b));
  g('/les/klaar', (code, b) => golfclub.lesKlaar(code, b.id));
  g('/wedstrijd/in', (code, b) => golfclub.wedstrijdIn(code, b));
  g('/baan', (code, b) => golfclub.baanZet(code, b.status));

  const f = maak('/api/supplier/fitclub', 'fitclub', 'fitnessclub');
  f('', (code) => fitclub.overzicht(code));
  f('/lid', (code, b) => fitclub.lidMaak(code, b));
  f('/checkin', (code, b) => fitclub.checkZet(code, b.id, true));
  f('/checkout', (code, b) => fitclub.checkZet(code, b.id, false));
  f('/les/in', (code, b) => fitclub.lesIn(code, b));
  f('/baan', (code, b) => fitclub.baanBoek(code, b));
  f('/pt', (code, b) => fitclub.ptVraag(code, b));
  f('/pt/status', (code, b) => fitclub.ptStatus(code, b.id, b.status));
};
