/* RTMAIL-routes voor de leverancier: elke zaak heeft een postvak op zijn
   zaakcode ("<code>@rtmail"). De automatiseringen bezorgen hier hun berichten
   (sollicitatie binnen, inkoopvoorstel, factuur-seintje, overheidspost); de
   zaak leest ze, en kan zelf een bericht sturen naar een andere code.

   Alles achter de leverancier-inlog; het adres komt uit de sessie, nooit uit
   de body -- zo kan niemand in het postvak van een ander kijken. */
module.exports = (kern) => {
  const { app, supplierAuth, auth, rtmail, codenaamVan, automatisering } = kern;
  const adresVan = req => (req.supplier.code || '').toLowerCase() + '@rtmail';
  // het lid-adres: de codenaam van het account (privacy by design)
  const lidCodenaam = req => (req.session.account && req.session.account.codename) || (codenaamVan ? codenaamVan(req.session.key) : null);

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

  /* ---- de draaiboeken die de zaak zelf (of Rahul namens de zaak) aftrapt ----
     Elk bereidt voor en bericht over RTMAIL; het bestellen en indienen blijft
     de zaak zelf. */
  app.post('/api/supplier/rtmail/inkoop', supplierAuth, (req, res) => {
    if (!automatisering) return res.status(503).json({ error: 'De automatiseringen draaien niet.' });
    const b = req.body || {};
    const r = automatisering.inkoopVoorstel({ zaakCode: req.supplier.code, groothandelCode: b.groothandel, regels: b.regels });
    if (!r) return res.status(400).json({ error: 'Geef een groothandel-code op.' });
    res.json({ ok: true, bezorgd: r.length });
  });
  app.post('/api/supplier/rtmail/btw-herinner', supplierAuth, (req, res) => {
    if (!automatisering) return res.status(503).json({ error: 'De automatiseringen draaien niet.' });
    const b = req.body || {};
    const r = automatisering.btwHerinnering({ zaakCode: req.supplier.code, periode: b.periode, bedrag: b.bedrag, deadline: b.deadline });
    if (!r) return res.status(400).json({ error: 'Kon de herinnering niet klaarzetten.' });
    res.json({ ok: true, bericht: r });
  });

  /* ---- de lid-kant: het RTMAIL-postvak in de verenigde Berichten-app ----
     Het adres is de codenaam van het lid; leden lezen alleen (RTMAIL bezorgt,
     het lid antwoordt niet naar de systeem-afzender). */
  app.post('/api/member/rtmail/inbox', auth, (req, res) => {
    const codenaam = lidCodenaam(req);
    if (!codenaam) return res.json({ adres: null, ongelezen: 0, berichten: [] });
    res.json({ adres: codenaam.toLowerCase() + '@rtmail', ongelezen: rtmail.ongelezen(codenaam), berichten: rtmail.postvak(codenaam) });
  });
  app.post('/api/member/rtmail/lees', auth, (req, res) => {
    const codenaam = lidCodenaam(req);
    if (!codenaam) return res.status(404).json({ error: 'Geen postvak voor dit account.' });
    const r = rtmail.lees(codenaam, String((req.body && req.body.id) || ''));
    if (r.error) return res.status(404).json({ error: r.error });
    res.json({ ok: true, bericht: r });
  });
};
