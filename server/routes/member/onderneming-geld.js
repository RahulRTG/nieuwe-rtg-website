/* Member-submodule "onderneming/geld": de geldkant van het Ondernemers-OS --
   klanten, openstaand, te betalen, contracten en wat er opzij moet.

   Los van ./onderneming.js omdat dat bestand over de 10 kB van het
   modulebeleid ging. De naad is inhoudelijk: daar staat de LEVENSLOOP van de
   onderneming (aanmaken, rechtsvorm, plan, oprichting, aanvraag), hier staat
   wat een draaiende zaak dagelijks nodig heeft. Alle routes gebruiken dezelfde
   eigendomscontrole, die als `mijn` wordt meegegeven. */
module.exports = (kern, mijn, stuur, nietGevonden) => {
  const { app, auth, ondernemingRelaties, ondernemingKlantNotitie,
    ondernemingDebiteuren, ondernemingCrediteuren, ondernemingContracten,
    ondernemingWerkruimte, ondernemingBelasting, ondernemingKas, ondernemingKasSaldo, ondernemingCapaciteit, ondernemingWerving } = kern;

  /* Het klantenboek en de opvolging. Alles op codenaam: dit boek kent geen
     echte namen, en dat is het ontwerp en geen tekortkoming. */
  app.post('/api/onderneming/relaties', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    res.json({ ok: true, relaties: ondernemingRelaties(o) });
  });

  app.post('/api/onderneming/relaties/notitie', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    if (!o.supplierCode) return stuur(res, { status: 409, error: 'Er is nog geen zaak gekoppeld.' });
    stuur(res, ondernemingKlantNotitie(o.supplierCode, req.body || {}));
  });

  /* Wat er nog openstaat, in ouderdomsgroepen. Alleen facturen die als
     onbetaald zijn aangemerkt; zie kern/onderneming/debiteuren.js. */
  app.post('/api/onderneming/debiteuren', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    res.json({ ok: true, debiteuren: ondernemingDebiteuren(o) });
  });

  /* De andere kant: wat u zelf nog moet betalen, met de vooruitblik op wat er
     de komende week en maand uit moet. */
  app.post('/api/onderneming/crediteuren', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    res.json({ ok: true, crediteuren: ondernemingCrediteuren(o) });
  });

  /* De contractklok. LEEST alleen: aanmaken, tekenen en opzeggen blijft in
     RTG Werk OS, achter zijn eigen poort. Zie kern/onderneming/contracten.js. */
  app.post('/api/onderneming/contracten', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    res.json({ ok: true, contracten: ondernemingContracten(o) });
  });

  app.post('/api/onderneming/werkruimte', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingWerkruimte(o, (req.body || {}).code));
  });

  /* Wat er opzij moet. De btw is een optelsom uit de eigen facturen; de
     winstreservering is een indicatie op de winst die wij kunnen zien. */
  app.post('/api/onderneming/belasting', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    res.json({ ok: true, belasting: ondernemingBelasting(o) });
  });

  /* De kasvooruitblik: wat er binnenkomt, wat eruit moet en wat er opzij hoort,
     over een venster van dagen (standaard 30). */
  app.post('/api/onderneming/kas', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    res.json({ ok: true, kas: ondernemingKas(o, undefined, Number((req.body || {}).dagen)) });
  });

  /* Het banksaldo dat de ondernemer zelf opgeeft. RTG ziet geen bankrekening;
     zonder dit getal is er alleen een beweging en geen stand. */
  app.post('/api/onderneming/kas/saldo', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingKasSaldo(o, (req.body || {}).bedrag));
  });

  /* De bezetting van de agenda over een venster van dagen (standaard 28).
     Geen gemiste omzet: zie kern/onderneming/capaciteit.js. */
  app.post('/api/onderneming/capaciteit', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    res.json({ ok: true, capaciteit: ondernemingCapaciteit(o, undefined, Number((req.body || {}).dagen)) });
  });

  /* Vacatures en wachtende sollicitaties, geteld en geklokt. Namen en cv's
     staan in de personeels-app; zie kern/onderneming/werving.js. */
  app.post('/api/onderneming/werving', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    res.json({ ok: true, werving: ondernemingWerving(o) });
  });
};
