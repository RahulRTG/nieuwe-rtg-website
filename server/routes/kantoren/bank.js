/* Kantoren, deel "bank": RTG Bank vanuit de boardroom. De 3-standen knop
   (partner -> hybride -> eigen) waarmee RTG in de toekomst met één druk de eigen
   bank + het eigen betaalsysteem aanzet, plus de bank-gezondheid, de rekeningen,
   de rood-staan-ruimte, de spaarrente en de renteronde. Alles achter de office-
   inlog; elke schakeling komt in het auditlog. Afgesplitst uit kantoren/index.js. */
module.exports = (ctx) => {
  const { app, officeAuth, veilig, afdelingen, sseToOffice, kern } = ctx;
  const bank = kern.bank;
  const naam = req => (req.body && req.body.naam ? String(req.body.naam) : 'boardroom');
  const sync = () => sseToOffice('sync', { scope: 'bank' });

  // het volledige bord: regie (de knop), gezondheid en de rekeningen
  app.post('/api/office/bank', officeAuth, (req, res) => veilig(res, () => bank.overzicht()));
  app.post('/api/office/bank/gezond', officeAuth, (req, res) => veilig(res, () => bank.gezondheid()));

  /* De knop: een stand kiezen, één slag verder/terug draaien, en de bank aan-
     of uitzetten als uitgevende partij. Verder draaien kan alleen als de bank
     operationeel is; dat bewaakt de bankregie zelf. */
  app.post('/api/office/bank/modus', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.bankModusZet({ modus: String(req.body.modus || ''), wie: naam(req) });
    if (r.ok) { afdelingen.audit(naam(req), 'RTG Bank-stand op "' + r.modus + '" gezet (was "' + r.oud + '")'); sync(); }
    return r;
  }));
  app.post('/api/office/bank/draai', officeAuth, (req, res) => veilig(res, () => {
    const r = req.body.terug === true ? kern.bankDraaiTerug({ wie: naam(req) }) : kern.bankDraai({ wie: naam(req) });
    if (r.ok && !r.ongewijzigd) { afdelingen.audit(naam(req), 'RTG Bank-knop gedraaid naar "' + r.modus + '"'); sync(); }
    return r;
  }));
  app.post('/api/office/bank/operationeel', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.bankOperationeelZet({ aan: req.body.aan === true, wie: naam(req) });
    if (r.ok) { afdelingen.audit(naam(req), 'RTG Bank ' + (r.operationeel ? 'operationeel gezet' : 'uitgezet') + (r.teruggevallen ? ' (stand terug naar partner)' : '')); sync(); }
    return r;
  }));
  app.post('/api/office/bank/instellingen', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.bankInstellingenZet(req.body || {});
    if (r.ok) { afdelingen.audit(naam(req), 'RTG Bank-instellingen gewijzigd (spaarrente ' + (r.spaarrenteBp / 100) + '%)'); sync(); }
    return r;
  }));

  // rekeningen: voor een lid openen, rood-staan-ruimte zetten, bevriezen, afschrift
  app.post('/api/office/bank/rekening/open', officeAuth, async (req, res) => {
    try { const r = await bank.rekeningOpen({ codenaam: req.body.codenaam, soort: req.body.soort, naam: req.body.naamRek, wie: 'kantoor' });
      if (r.ok) { afdelingen.audit(naam(req), 'Bankrekening geopend voor ' + r.rekening.iban); sync(); }
      r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
    } catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/bank/rekening/rood', officeAuth, (req, res) => veilig(res, () => {
    const r = bank.rekeningRoodZet(String(req.body.iban || ''), req.body.euro);
    if (r.ok) { afdelingen.audit(naam(req), 'Rood-staan-ruimte op ' + r.iban + ' gezet op € ' + (r.roodLimiet / 100).toFixed(2)); sync(); }
    return r;
  }));
  app.post('/api/office/bank/rekening/bevries', officeAuth, (req, res) => veilig(res, () => {
    const r = bank.rekeningBevries(String(req.body.iban || ''), req.body.aan === true);
    if (r.ok) { afdelingen.audit(naam(req), 'Rekening ' + r.iban + ' ' + (r.bevroren ? 'bevroren' : 'ontdooid')); sync(); }
    return r;
  }));
  app.post('/api/office/bank/afschrift', officeAuth, (req, res) => veilig(res, () => bank.afschrift({ iban: String(req.body.iban || ''), limit: Number(req.body.limit) || 50, offset: Number(req.body.offset) || 0 })));

  // de renteronde met de hand draaien (normaal een dagelijkse achtergrondronde)
  app.post('/api/office/bank/rente', officeAuth, (req, res) => veilig(res, () => {
    const r = bank.bankRenteRonde(req.body && req.body.dagen != null ? { dagen: Number(req.body.dagen) } : {});
    if (r.ok && r.bijgeschrevenCenten > 0) { afdelingen.audit(naam(req), 'Spaarrente bijgeschreven: € ' + (r.bijgeschrevenCenten / 100).toFixed(2) + ' op ' + r.rekeningen + ' rekening(en)'); sync(); }
    return r;
  }));
};
