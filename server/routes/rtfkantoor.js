/* Domein "RTF-kantoor": het eigen kantoor van de RTFoundation (een spiegel van
   de RTG-kantoorstructuur), de Clubs & steden-afdeling en het Onderzoekslab.
   Alles achter de office-inlog (RTG- en RTF-personeel delen die deur), behalve
   het clubportaal: dat opent op de eigen clubcode en toont uitsluitend het
   eigen clubdossier. */
module.exports = (kern) => {
  const { app, officeAuth, rtfkantoor, rtfclubs, lab } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const veilig = (res, werk) => { try { stuur(res, werk()); } catch (e) { console.error('[rtfkantoor]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); } };

  // het RTF-kantoor: kamers, taken en het overzicht
  app.post('/api/rtfkantoor/kamers', officeAuth, (req, res) => veilig(res, () => rtfkantoor.kamers()));
  app.post('/api/rtfkantoor/kamer', officeAuth, (req, res) => veilig(res, () => rtfkantoor.kamer(String(req.body.id || ''))));
  app.post('/api/rtfkantoor/kamer/taak', officeAuth, (req, res) => veilig(res, () => rtfkantoor.taakMaak(String(req.body.id || ''), req.body.tekst)));
  app.post('/api/rtfkantoor/kamer/taak-zet', officeAuth, (req, res) => veilig(res, () => rtfkantoor.taakZet(String(req.body.id || ''), String(req.body.taakId || ''), req.body.af)));
  app.post('/api/rtfkantoor/overzicht', officeAuth, (req, res) => veilig(res, () => rtfkantoor.overzicht()));

  // Clubs & steden: het register, de programma's, het team en de afspraken
  app.post('/api/rtfkantoor/clubs', officeAuth, (req, res) => veilig(res, () => rtfclubs.overzicht()));
  app.post('/api/rtfkantoor/club/maak', officeAuth, (req, res) => veilig(res, () => rtfclubs.clubMaak(req.body || {})));
  app.post('/api/rtfkantoor/club/zet', officeAuth, (req, res) => veilig(res, () => rtfclubs.clubZet(String(req.body.id || ''), req.body || {})));
  app.post('/api/rtfkantoor/club/team', officeAuth, (req, res) => veilig(res, () => rtfclubs.teamZet(String(req.body.id || ''), req.body.namen)));
  app.post('/api/rtfkantoor/club/programma', officeAuth, (req, res) => veilig(res, () => rtfclubs.programmaMaak(String(req.body.id || ''), req.body.naam, req.body.doel)));
  app.post('/api/rtfkantoor/club/programma-zet', officeAuth, (req, res) => veilig(res, () => rtfclubs.programmaZet(String(req.body.id || ''), String(req.body.programmaId || ''), req.body.af)));
  app.post('/api/rtfkantoor/club/afspraak', officeAuth, (req, res) => veilig(res, () => rtfclubs.afspraakMaak(String(req.body.id || ''), req.body.tekst)));
  app.post('/api/rtfkantoor/club/afspraak-zet', officeAuth, (req, res) => veilig(res, () => rtfclubs.afspraakZet(String(req.body.id || ''), String(req.body.afspraakId || ''), req.body.af)));
  app.post('/api/rtfkantoor/club/bericht', officeAuth, (req, res) => veilig(res, () => rtfclubs.berichtRtf(String(req.body.id || ''), req.body.naam, req.body.tekst)));

  // het clubportaal: de club zelf, op de eigen clubcode (alleen het eigen dossier)
  app.post('/api/rtf/club/portaal', (req, res) => veilig(res, () => rtfclubs.portaal(req.body.code)));
  app.post('/api/rtf/club/bericht', (req, res) => veilig(res, () => rtfclubs.berichtClub(req.body.code, req.body.naam, req.body.tekst)));

  // het Onderzoekslab: projecten, de fase-keten, de toets, kennis en de coach
  app.post('/api/lab/overzicht', officeAuth, (req, res) => veilig(res, () => lab.overzicht()));
  app.post('/api/lab/project/maak', officeAuth, (req, res) => veilig(res, () => lab.projectMaak(req.body || {})));
  app.post('/api/lab/project/fase', officeAuth, (req, res) => veilig(res, () => lab.faseZet(String(req.body.id || ''), String(req.body.fase || ''))));
  app.post('/api/lab/project/veiligheid', officeAuth, (req, res) => veilig(res, () => lab.veiligheidZet(String(req.body.id || ''), req.body || {})));
  app.post('/api/lab/project/log', officeAuth, (req, res) => veilig(res, () => lab.logMaak(String(req.body.id || ''), req.body.tekst, req.body.wie)));
  app.post('/api/lab/project/bevinding', officeAuth, (req, res) => veilig(res, () => lab.bevindingMaak(String(req.body.id || ''), req.body.titel, req.body.tekst)));
  app.post('/api/lab/kennisbank', officeAuth, (req, res) => veilig(res, () => lab.kennisbank()));
  app.post('/api/lab/ai', officeAuth, async (req, res) => {
    try { const r = await lab.labAI(req.body.q); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[lab]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
