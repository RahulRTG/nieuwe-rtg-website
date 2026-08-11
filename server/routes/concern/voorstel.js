/* Concern (deelmodule): DOCUMENT INTELLIGENCE EN DISCOVERY -- de deur.

   ELKE ROUTE HIER IS IN TWEEEN GEKNIPT: een die LEEST en een die VASTLEGT. Dat
   is geen vormelijkheid maar de grens uit CONCERN.md zelf -- wat uit een
   document komt is een voorstel tot een mens het bevestigt. Zou lezen meteen
   vastleggen, dan schrijft een patroonherkenner juridische waarheid, en dat is
   precies wat wet 4 verbiedt.

   De tekst komt als TEKST binnen en niet als bestand. Dat is bewust: het
   uitpakken van een pdf of een scan hoort in de bestandenlaag die daar al voor
   is, en deze route hoort niet de tweede plek te worden waar dat gebeurt. */
module.exports = (kern, hulp) => {
  const { app, auth, voorstelLees, voorstelBevestig, concernDiscovery,
    concernDiscoveryNeem } = kern;
  const { mijn, stuur, nietGevonden } = hulp;

  /* LEZEN. Legt niets vast; geeft kandidaten met hun vindplaats terug. */
  app.post('/api/concern/document/lees', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const b = req.body || {};
    stuur(res, voorstelLees(e, b.tekst, { bestand: b.bestand }));
  });

  /* BEVESTIGEN. Alleen wat de mens heeft aangewezen wordt een feit, met bron
     `document`. Er is met opzet geen "alles"-ingang: dat zou het aanvinken tot
     een formaliteit maken, en dan is de bevestiging geen bevestiging meer. */
  app.post('/api/concern/document/bevestig', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const b = req.body || {};
    stuur(res, voorstelBevestig(e, String(b.voorstel || ''), b.kandidaten, req.session.key));
  });

  /* DISCOVERY. Leest de bestaande onderneming van DEZE aanvrager -- de
     eigendomscontrole zit in de kern, op de onderneming, en niet hier op een
     id uit het lichaam. */
  app.post('/api/concern/discovery', auth, (req, res) => {
    stuur(res, concernDiscovery(req.session.key, String((req.body || {}).onderneming || '')));
  });

  app.post('/api/concern/discovery/neem', auth, (req, res) => {
    const b = req.body || {};
    stuur(res, concernDiscoveryNeem(req.session.key, String(b.onderneming || ''), b));
  });
};
