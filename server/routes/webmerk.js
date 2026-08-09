/* Routes voor merken met vestigingen: het kantoor stelt ze samen.

   Dat dit achter officeAuth zit en niet achter supplierAuth is de kern van het
   ontwerp: een zaak kan zich hier niet tot moederbedrijf van een andere zaak
   uitroepen. Wie een merk samenstelt moet dat van buiten die zaken af kunnen,
   en het kantoor is de partij die zaken toch al goedkeurt. */
module.exports = (kern) => {
  const { app, officeAuth, webmerk } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const b = req => req.body || {};

  app.post('/api/office/merk/lijst', officeAuth, (req, res) => res.json({ lijst: webmerk.lijst() }));
  app.post('/api/office/merk/haal', officeAuth, (req, res) => {
    const m = webmerk.haal(b(req).code);
    if (!m) return res.status(404).json({ error: 'Merk niet gevonden.' });
    res.json({ merk: m });
  });
  app.post('/api/office/merk/maak', officeAuth, (req, res) => stuur(res, webmerk.maak(b(req).code, b(req).naam)));
  app.post('/api/office/merk/vestiging', officeAuth, (req, res) =>
    stuur(res, webmerk.koppel(b(req).code, b(req).zaak, b(req).aan !== false)));
  app.post('/api/office/merk/sjabloon', officeAuth, (req, res) =>
    stuur(res, webmerk.zetSjabloon(b(req).code, b(req).ontwerp || b(req).design)));
  /* Uitrollen overschrijft het handwerk op de vestigingssites -- dat is het
     punt van centraal beheer. Niet stiekem: de vorige stand staat in de
     versiegeschiedenis van elke vestiging. */
  app.post('/api/office/merk/uitrol', officeAuth, (req, res) => stuur(res, webmerk.uitrol(b(req).code)));
};
