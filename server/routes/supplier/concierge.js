/* Supplier-submodule "concierge": wat een zaak ziet van de concierge-lus.

   Een restaurant, chauffeur of bloemist die een onderdeel levert voor een case
   van De Rechterhand ziet hier ZIJN onderdelen en niets anders: geen codenaam,
   geen hotelkamer, geen tweede leverancier. De velden komen uit een positieve
   lijst in kern/bureau/lus-regels.js (deelnemerBeeld); wie daar niets bijzet,
   laat hier niets meer zien (CONCIERGE.md, CON-02). De zaakcode komt uit de
   sessie en nooit uit het verzoek. */
module.exports = (kern) => {
  const { app, supplierAuth } = kern;
  const Z = kern.bureauZaak;
  app.post('/api/supplier/concierge/opdrachten', supplierAuth, (req, res) => {
    try { res.json(Z.opdrachten(req.supplier.code)); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
