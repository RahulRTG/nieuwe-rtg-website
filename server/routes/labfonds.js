/* Routes voor het Lab-fonds (kern/labfonds): de ledenkant om samen in te zamelen
   voor het RTF Onderzoekslab, per locatie te verdelen en gezamenlijk (met de
   AI-scheidsrechter) te beslissen. Plus een boardroom-overzicht.
   Inzamelen, voorstellen, stemmen en beslissen kan alleen met een echt account. */
module.exports = (kern) => {
  const { app, auth, officeAuth, labfonds } = kern;
  const veilig = (res, werk) => { try { const r = werk(); res.status(r && r.status ? r.status : 200).json(r); } catch (e) { console.error('[labfonds]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); } };
  const lid = (req) => (req.session && req.session.key) || null;
  const naam = (req) => { const s = req.session || {}; return s.codename || (s.account && s.account.codename) || s.naam || 'Lid'; };

  // Inzamelen, stemmen en beslissen kan alleen als LID (auth zet req.session).
  // Het overzicht is ook voor leden; wie niet ingelogd is, ziet het via de OS-kaart.
  app.post('/api/labfonds/overzicht', auth, (req, res) => veilig(res, () => labfonds.fonds(lid(req))));
  app.post('/api/labfonds/locatie/maak', auth, (req, res) => veilig(res, () => labfonds.locatieMaak(req.body && req.body.naam, req.body && req.body.land)));
  app.post('/api/labfonds/doneer', auth, (req, res) => veilig(res, () => labfonds.doneer(lid(req), naam(req), String((req.body || {}).locId || ''), (req.body || {}).bedrag)));
  app.post('/api/labfonds/voorstel/maak', auth, (req, res) => veilig(res, () => labfonds.voorstelMaak(lid(req), naam(req), String((req.body || {}).locId || ''), (req.body || {}).titel, (req.body || {}).doel, (req.body || {}).bedrag)));
  app.post('/api/labfonds/stem', auth, (req, res) => veilig(res, () => labfonds.stem(lid(req), String((req.body || {}).id || ''), String((req.body || {}).keuze || ''))));
  app.post('/api/labfonds/scheidsrechter', auth, (req, res) => veilig(res, () => labfonds.scheidsrechter(String((req.body || {}).id || ''))));
  app.post('/api/labfonds/beslis', auth, (req, res) => veilig(res, () => labfonds.beslis(String((req.body || {}).id || ''))));

  // de boardroom ziet het hele fonds
  app.post('/api/labfonds/boardroom', officeAuth, (req, res) => veilig(res, () => labfonds.boardroom()));
};
