/* Routes voor het Lab-fonds (kern/labfonds): de ledenkant om samen in te zamelen
   voor het RTF Onderzoekslab, per locatie te verdelen en gezamenlijk (met de
   AI-scheidsrechter) te beslissen. Plus een boardroom-overzicht.
   Inzamelen, voorstellen, stemmen en beslissen kan alleen met een echt account. */
module.exports = (kern) => {
  const { app, officeAuth, labfonds } = kern;
  const veilig = (res, werk) => { try { const r = werk(); res.status(r && r.status ? r.status : 200).json(r); } catch (e) { console.error('[labfonds]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); } };
  const lid = (req) => (req.session && req.session.key) || null;
  const naam = (req) => (req.session && (req.session.codename || req.session.naam)) || 'Lid';
  const account = (req, res) => {
    if (req.session && req.session.account) return true;
    res.status(403).json({ error: 'Maak of open je RTG-account om mee te doen aan het Lab-fonds.' });
    return false;
  };

  app.post('/api/labfonds/overzicht', (req, res) => veilig(res, () => labfonds.fonds(lid(req))));
  app.post('/api/labfonds/locatie/maak', (req, res) => { if (!account(req, res)) return; veilig(res, () => labfonds.locatieMaak(req.body && req.body.naam, req.body && req.body.land)); });
  app.post('/api/labfonds/doneer', (req, res) => { if (!account(req, res)) return; veilig(res, () => labfonds.doneer(lid(req), naam(req), String((req.body || {}).locId || ''), (req.body || {}).bedrag)); });
  app.post('/api/labfonds/voorstel/maak', (req, res) => { if (!account(req, res)) return; veilig(res, () => labfonds.voorstelMaak(lid(req), naam(req), String((req.body || {}).locId || ''), (req.body || {}).titel, (req.body || {}).doel, (req.body || {}).bedrag)); });
  app.post('/api/labfonds/stem', (req, res) => { if (!account(req, res)) return; veilig(res, () => labfonds.stem(lid(req), String((req.body || {}).id || ''), String((req.body || {}).keuze || ''))); });
  app.post('/api/labfonds/scheidsrechter', (req, res) => { if (!account(req, res)) return; veilig(res, () => labfonds.scheidsrechter(String((req.body || {}).id || ''))); });
  app.post('/api/labfonds/beslis', (req, res) => { if (!account(req, res)) return; veilig(res, () => labfonds.beslis(String((req.body || {}).id || ''))); });

  // de boardroom ziet het hele fonds
  app.post('/api/labfonds/boardroom', officeAuth, (req, res) => veilig(res, () => labfonds.boardroom()));
};
