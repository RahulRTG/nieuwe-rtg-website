/* RTMAIL-routes voor de leverancier: elke zaak heeft een postvak op zijn
   zaakcode ("<code>@rtmail"). De automatiseringen bezorgen hier hun berichten
   (sollicitatie binnen, inkoopvoorstel, factuur-seintje, overheidspost); de
   zaak leest ze, en kan zelf een bericht sturen naar een andere code.

   Alles achter de leverancier-inlog; het adres komt uit de sessie, nooit uit
   de body -- zo kan niemand in het postvak van een ander kijken. */
module.exports = (kern) => {
  const { app, supplierAuth, rtmail } = kern;
  const adresVan = req => (req.supplier.code || '').toLowerCase() + '@rtmail';

  app.post('/api/supplier/rtmail/inbox', supplierAuth, (req, res) => {
    const adres = adresVan(req);
    res.json({ adres, ongelezen: rtmail.ongelezen(adres), berichten: rtmail.postvak(adres) });
  });

  app.post('/api/supplier/rtmail/verzonden', supplierAuth, (req, res) => {
    res.json({ berichten: rtmail.verzonden(adresVan(req)) });
  });

  app.post('/api/supplier/rtmail/ongelezen', supplierAuth, (req, res) => {
    res.json({ ongelezen: rtmail.ongelezen(adresVan(req)) });
  });

  app.post('/api/supplier/rtmail/lees', supplierAuth, (req, res) => {
    const r = rtmail.lees(adresVan(req), String((req.body && req.body.id) || ''));
    if (r.error) return res.status(404).json({ error: r.error });
    res.json({ ok: true, bericht: r });
  });

  // Zelf een bericht sturen naar een andere code (van de eigen zaak vandaan).
  app.post('/api/supplier/rtmail/stuur', supplierAuth, (req, res) => {
    const b = req.body || {};
    const r = rtmail.stuur({ van: adresVan(req), naar: b.naar, onderwerp: b.onderwerp, tekst: b.tekst, soort: 'zaak' });
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ ok: true, bericht: r });
  });
};
