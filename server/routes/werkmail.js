/* Werkmail-routes: het zakelijke adresboek van de zaak boven op RTMAIL.
   Alles achter de leverancier-inlog; adresbeheer (aanmaken, afpakken) is
   aan de werkgever (manager). De buitenpoort staat los: die neemt post van
   buiten aan en levert ALTIJD in de onbetrouwde baan af. */
module.exports = (kern) => {
  const { app, supplierAuth, rtmail, werkmail } = kern;
  const alleenBaas = (req, res) => {
    if (req.actor && req.actor.manager) return false;
    res.status(403).json({ error: 'Alleen de werkgever (manager) beheert de werkmail.' });
    return true;
  };
  const stuurUit = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/supplier/werkmail/overzicht', supplierAuth, (req, res) => {
    stuurUit(res, werkmail.lijst(req.supplier));
  });
  app.post('/api/supplier/werkmail/maak', supplierAuth, (req, res) => {
    if (alleenBaas(req, res)) return;
    stuurUit(res, werkmail.maak(req.supplier, req.body.lokaal, req.body.label));
  });
  app.post('/api/supplier/werkmail/intrek', supplierAuth, (req, res) => {
    if (alleenBaas(req, res)) return;
    stuurUit(res, werkmail.intrek(req.supplier.code, req.body.adres, req.body.aan === true));
  });
  // het postvak per zaak-adres (ook een ingetrokken adres blijft van de zaak leesbaar)
  app.post('/api/supplier/werkmail/inbox', supplierAuth, (req, res) => {
    if (!werkmail.isZaakAdres(req.supplier.code, req.body.adres)) return res.status(403).json({ error: 'Dit adres is niet van deze zaak.' });
    res.json({ berichten: rtmail.postvak(req.body.adres) });
  });
  app.post('/api/supplier/werkmail/verzonden', supplierAuth, (req, res) => {
    if (!werkmail.isZaakAdres(req.supplier.code, req.body.adres)) return res.status(403).json({ error: 'Dit adres is niet van deze zaak.' });
    res.json({ berichten: rtmail.verzonden(req.body.adres) });
  });
  app.post('/api/supplier/werkmail/lees', supplierAuth, (req, res) => {
    if (!werkmail.isZaakAdres(req.supplier.code, req.body.adres)) return res.status(403).json({ error: 'Dit adres is niet van deze zaak.' });
    stuurUit(res, rtmail.lees(req.body.adres, String(req.body.id || '')));
  });
  // versturen: intern over RTMAIL, naar buiten via de buitenpost (SMTP/outbox)
  app.post('/api/supplier/werkmail/stuur', supplierAuth, (req, res) => {
    stuurUit(res, werkmail.stuur(req.supplier.code, req.body.van, req.body.naar, req.body.onderwerp, req.body.tekst));
  });

  /* De buitenpoort: zoals een mailserver post van het open internet aanneemt.
     Zonder inlog, dus met een strakke rem en zonder enige vertrouwensclaim:
     alles wat hier binnenkomt is per definitie onbetrouwbaar (links op slot,
     bijlagen bestaan niet). */
  let poortVenster = 0, poortTeller = 0;
  app.post('/api/werkmail/bezorg', (req, res) => {
    const nuMin = Math.floor(Date.now() / 60000);
    if (nuMin !== poortVenster) { poortVenster = nuMin; poortTeller = 0; }
    if (++poortTeller > 60) return res.status(429).json({ error: 'De buitenpoort staat even dicht; probeer het over een minuut.' });
    stuurUit(res, werkmail.buitenIn(req.body.naar, req.body.van, req.body.onderwerp, req.body.tekst));
  });
};
