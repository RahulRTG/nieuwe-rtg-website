/* Domein "kantoren": de afdelingskamers en de boardroom van RTG zelf.
   Alles achter de office-inlog (dezelfde als de backoffice); het schakelen
   van functies raakt het hele platform en hoort dus bij het kantoor. */
module.exports = (kern) => {
  const { app, officeAuth, afdelingen, sseToOffice } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status).json({ error: r.error }) : res.json(r);
  const veilig = (res, werk) => { try { stuur(res, werk()); } catch (e) { console.error('[kantoren]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); } };

  app.post('/api/office/kamers', officeAuth, (req, res) => veilig(res, () => afdelingen.kamers()));
  app.post('/api/office/kamer', officeAuth, (req, res) => veilig(res, () => afdelingen.kamer(String(req.body.id || ''))));
  app.post('/api/office/kamer/taak', officeAuth, (req, res) => veilig(res, () => afdelingen.taakMaak(String(req.body.id || ''), req.body.tekst)));
  app.post('/api/office/kamer/taak-zet', officeAuth, (req, res) => veilig(res, () => afdelingen.taakZet(String(req.body.id || ''), String(req.body.taakId || ''), req.body.af)));
  app.post('/api/office/boardroom', officeAuth, (req, res) => veilig(res, () => afdelingen.boardroom()));
  app.post('/api/office/boardroom/schakel', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakel(String(req.body.functie || ''), req.body.aan === true, req.body.doelgroep ? String(req.body.doelgroep) : null, req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
  app.post('/api/office/boardroom/verbeter', officeAuth, (req, res) => veilig(res, () => ({ ok: true, verbeterkamer: afdelingen.voorstellen(true) })));

  // de paniekkamer: knoppen worden voorstellen; de boardroom besluit
  app.post('/api/office/paniek', officeAuth, (req, res) => veilig(res, () => afdelingen.paniekLijst()));
  app.post('/api/office/paniek/stel', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.paniekStel({ functie: String(req.body.functie || ''), aan: req.body.aan === true, doelgroep: req.body.doelgroep ? String(req.body.doelgroep) : null, reden: req.body.reden });
    if (r.ok) sseToOffice('sync', { scope: 'paniek' });
    return r;
  }));
  app.post('/api/office/paniek/besluit', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.paniekBesluit(String(req.body.id || ''), String(req.body.besluit || ''));
    if (r.ok) sseToOffice('sync', { scope: 'paniek' });
    return r;
  }));
  // aanmelden: vanuit de kantoor-app of de RTG Kantoor PDA (ook thuis)
  app.post('/api/office/dienst/in', officeAuth, (req, res) => veilig(res, () => afdelingen.dienstIn(req.body.naam, String(req.body.kamer || ''), String(req.body.waar || ''))));
  app.post('/api/office/dienst/uit', officeAuth, (req, res) => veilig(res, () => afdelingen.dienstUit(String(req.body.id || ''))));
  app.post('/api/office/dienst', officeAuth, (req, res) => veilig(res, () => afdelingen.dienstNu()));
  // platformbrede statistieken, interne chat met snaps, en onboarding per kamer
  app.post('/api/office/stats', officeAuth, (req, res) => veilig(res, () => afdelingen.platformStats()));
  app.post('/api/office/kachat', officeAuth, (req, res) => veilig(res, () => afdelingen.chatLijst(String(req.body.kamer || ''))));
  app.post('/api/office/kachat/stuur', officeAuth, (req, res) => veilig(res, () => afdelingen.chatStuur(String(req.body.kamer || ''), req.body.naam, req.body.tekst, req.body.foto)));
  app.post('/api/office/onboarding', officeAuth, (req, res) => veilig(res, () => afdelingen.onboarding(String(req.body.kamer || ''))));
  app.post('/api/office/paniek/bericht', officeAuth, (req, res) => veilig(res, () => afdelingen.paniekBericht(String(req.body.id || ''), String(req.body.wie || ''), req.body.tekst)));
  // de wereld: alles in het veld als bolletje (groen oke, oranje uit, rood
  // storing), met reset- en hulpknoppen; elke knop komt in het auditlog
  app.post('/api/office/wereld', officeAuth, (req, res) => veilig(res, () => afdelingen.wereld()));
  app.post('/api/office/wereld/actie', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.wereldActie(String(req.body.id || ''), String(req.body.actie || ''), req.body.naam);
    if (r.ok) sseToOffice('sync', { scope: 'wereld' });
    return r;
  }));
};
