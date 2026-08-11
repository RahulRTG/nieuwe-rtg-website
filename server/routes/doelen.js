/* Routes "doelen": de doelenmotor (kern/doelen.js). Alles hier is van het lid
   zelf en staat op de sessiesleutel, niet op een naam: een doel is iets
   persoonlijks en gaat nooit naar een partner.

   Vier handelingen, en de vierde is de belangrijkste: een streefdatum
   verzetten. Zonder die knop is de enige uitweg uit een doel dat niet meer
   past, het doel weggooien -- en dat is precies wat mensen dan ook doen. */
module.exports = (kern) => {
  const { app, auth, doelenVan, doelMaak, doelMeet, doelVerzet, doelStop } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  const wie = (req) => req.session.key;

  app.post('/api/doelen', auth, (req, res) => stuur(res, doelenVan(wie(req))));
  app.post('/api/doelen/maak', auth, (req, res) => stuur(res, doelMaak(wie(req), req.body || {})));
  app.post('/api/doelen/meet', auth, (req, res) => stuur(res, doelMeet(wie(req), req.body || {})));
  app.post('/api/doelen/verzet', auth, (req, res) => stuur(res, doelVerzet(wie(req), req.body || {})));
  app.post('/api/doelen/stop', auth, (req, res) => stuur(res, doelStop(wie(req), req.body || {})));
};
