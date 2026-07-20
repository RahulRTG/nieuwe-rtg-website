/* Domein "kantoren": de afdelingskamers en de boardroom van RTG zelf.
   Alles achter de office-inlog (dezelfde als de backoffice); het schakelen
   van functies raakt het hele platform en hoort dus bij het kantoor. De
   ontwerpbureaus staan in ./bureaus, de boardroom-/geld-/paniek-/wereldregie in
   ./regie; hier de kamers zelf, de kluis-inzage, de kantine, het rampbeeld, het
   reisbureau, de doos-regie, de diensten en de interne chat. */
module.exports = (kern) => {
  const { app, officeAuth, afdelingen, sseToOffice, db, save,
    geldOverzicht, geldPasprijzen, geldPasprijsZet, geldCommissieZet, geldKortingZet } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status).json({ error: r.error }) : res.json(r);
  const veilig = (res, werk) => { try { stuur(res, werk()); } catch (e) { console.error('[kantoren]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); } };

  app.post('/api/office/kamers', officeAuth, (req, res) => veilig(res, () => afdelingen.kamers()));
  app.post('/api/office/kamer', officeAuth, (req, res) => veilig(res, () => afdelingen.kamer(String(req.body.id || ''))));
  app.post('/api/office/kamer/taak', officeAuth, (req, res) => veilig(res, () => afdelingen.taakMaak(String(req.body.id || ''), req.body.tekst)));
  app.post('/api/office/kamer/taak-zet', officeAuth, (req, res) => veilig(res, () => afdelingen.taakZet(String(req.body.id || ''), String(req.body.taakId || ''), req.body.af)));

  /* De identiteitskluis-inzage: kamers met naamInzage (en de boardroom)
     vragen de echte naam bij een codenaam op; elke opvraging komt in het
     auditlog, ook zonder treffer. */
  app.post('/api/office/inzage', officeAuth, async (req, res) => {
    try { stuur(res, await afdelingen.naamInzage(String(req.body.kamer || ''), req.body.codenaam, req.body.naam ? String(req.body.naam) : null)); }
    catch (e) { console.error('[kantoren]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  // de kantine: de kaart van vandaag lezen en zetten
  app.post('/api/office/kantine/menu', officeAuth, (req, res) => veilig(res, () => afdelingen.kantineMenu()));
  app.post('/api/office/kantine/menu-zet', officeAuth, (req, res) => veilig(res, () => afdelingen.kantineMenuZet(req.body.items, req.body.naam)));

  // het gezamenlijke rampbeeld: de boardroom ziet alle korpsen, zorg en defensie
  app.post('/api/office/rampbeeld', officeAuth, (req, res) => veilig(res, () => kern.rampbeeld.beeld(null)));
  app.post('/api/office/rampbeeld/schaal', officeAuth, (req, res) => veilig(res, () => kern.rampbeeld.schaal(String(req.body.niveau || ''), req.body.naam || 'boardroom')));
  app.post('/api/office/rampbeeld/evaluatie', officeAuth, (req, res) => veilig(res, () => kern.rampbeeld.evaluatie(null)));
  app.post('/api/office/rampbeeld/ai', officeAuth, async (req, res) => {
    try { const r = await kern.rampbeeld.coordinatorAi(null, req.body.q); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[rampbeeld]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  // de openstaande reisaanvragen bij het RTG-reisbureau (codenamen)
  app.post('/api/office/reisbureau', officeAuth, (req, res) => veilig(res, () => kern.reisbureau.aanvragen()));

  /* De doos-regie: beheer op afstand van de Zaakdoos-vloot. Het kantoor zet
     de doelversie en per doos een netwerkrol; de doos haalt beide zelf op
     bij zijn eigen melding (de cloud duwt nooit iets naar binnen). */
  app.post('/api/office/doos/regie', officeAuth, (req, res) => veilig(res, () => afdelingen.doosRegie()));
  app.post('/api/office/doos/update-zet', officeAuth, (req, res) => veilig(res, () => afdelingen.doosUpdateZet(req.body.versie, req.body.notities, req.body.naam)));
  app.post('/api/office/doos/netwerk-zet', officeAuth, (req, res) => veilig(res, () => afdelingen.doosNetwerkZet(String(req.body.doos || ''), req.body.instellingen || {}, req.body.naam)));

  // aanmelden: vanuit de kantoor-app of de RTG Kantoor PDA (ook thuis)
  app.post('/api/office/dienst/in', officeAuth, (req, res) => veilig(res, () => afdelingen.dienstIn(req.body.naam, String(req.body.kamer || ''), String(req.body.waar || ''))));
  app.post('/api/office/dienst/uit', officeAuth, (req, res) => veilig(res, () => afdelingen.dienstUit(String(req.body.id || ''))));
  app.post('/api/office/dienst', officeAuth, (req, res) => veilig(res, () => afdelingen.dienstNu()));
  // platformbrede statistieken, interne chat met snaps, en onboarding per kamer
  app.post('/api/office/stats', officeAuth, (req, res) => veilig(res, () => afdelingen.platformStats()));
  app.post('/api/office/kachat', officeAuth, (req, res) => veilig(res, () => afdelingen.chatLijst(String(req.body.kamer || ''))));
  app.post('/api/office/kachat/stuur', officeAuth, (req, res) => veilig(res, () => afdelingen.chatStuur(String(req.body.kamer || ''), req.body.naam, req.body.tekst, req.body.foto)));
  app.post('/api/office/onboarding', officeAuth, (req, res) => veilig(res, () => afdelingen.onboarding(String(req.body.kamer || ''))));

  // de vier ontwerpbureaus + de Ideeenkamer, en de platformbrede regie
  const ctx = { app, officeAuth, veilig, stuur, afdelingen, sseToOffice, db, save, kern,
    geldOverzicht, geldPasprijzen, geldPasprijsZet, geldCommissieZet, geldKortingZet };
  require('./bureaus')(ctx);
  require('./regie')(ctx);
};
