/* Member-submodule: De Rechterhand -- de premium suite van de Lifestyle Pass.
   Gated op de Lifestyle Pass (Business erft mee als hoger niveau). Alleen routes;
   de logica woont in kern/lifestyle.js. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth,
    lifestyleOverzicht, lifestyleAI,
    conciergeVraag, conciergeIntrek, conciergeVerzoeken, lifestyleVoorkeuren, lifestyleVoorkeurenZet,
    bezitZet, bezitWeg, bezittingen, gzAfspraak, gzAfspraakWeg, gzDossier, gzDossierWeg, gezondheid } = kern;

  // De Rechterhand hoort bij de Lifestyle Pass; de Business Pass (hoger niveau) erft mee.
  function eis(req, res) {
    if (['lifestyle', 'business'].includes(req.session.tier)) return true;
    res.status(403).json({ error: 'De Rechterhand is onderdeel van de Lifestyle Pass.' });
    return false;
  }
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  // een gated route: synchroon of async werk, met de sessiesleutel als identiteit
  /* De paden staan voluit en niet als '/api/member/lifestyle/' + pad. Een opgebouwd pad
     ziet scripts/schakelbaar.js niet, en wat die census niet ziet is vanuit de
     boardroom niet uit te zetten en niet per stad te sluiten (scripts/check.js
     regel 45). De pas-eis en het vangnet blijven op EEN plek; alleen de
     registratie is uitgeschreven. */
  const doe = (werk) => async (req, res) => {
    if (!eis(req, res)) return;
    try { stuur(res, await werk(req.session.key, req.body || {})); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };

  app.post('/api/member/lifestyle/overzicht', auth, doe((key) => lifestyleOverzicht(key)));
  app.post('/api/member/lifestyle/ai', auth, doe((key, b) => lifestyleAI(key, b.vraag)));
  // concierge
  app.post('/api/member/lifestyle/concierge', auth, doe((key) => conciergeVerzoeken(key)));
  app.post('/api/member/lifestyle/concierge/vraag', auth, doe((key, b) => conciergeVraag(key, b)));
  app.post('/api/member/lifestyle/concierge/intrek', auth, doe((key, b) => conciergeIntrek(key, String(b.id || ''))));
  app.post('/api/member/lifestyle/voorkeuren', auth, doe((key) => lifestyleVoorkeuren(key)));
  app.post('/api/member/lifestyle/voorkeuren/zet', auth, doe((key, b) => lifestyleVoorkeurenZet(key, b)));
  // bezittingenregister
  app.post('/api/member/lifestyle/bezit', auth, doe((key) => bezittingen(key)));
  app.post('/api/member/lifestyle/bezit/zet', auth, doe((key, b) => bezitZet(key, b)));
  app.post('/api/member/lifestyle/bezit/weg', auth, doe((key, b) => bezitWeg(key, String(b.id || ''))));
  // gezondheid & welzijn
  app.post('/api/member/lifestyle/gezondheid', auth, doe((key) => gezondheid(key)));
  app.post('/api/member/lifestyle/gezondheid/afspraak', auth, doe((key, b) => gzAfspraak(key, b)));
  app.post('/api/member/lifestyle/gezondheid/afspraak/weg', auth, doe((key, b) => gzAfspraakWeg(key, String(b.id || ''))));
  app.post('/api/member/lifestyle/gezondheid/dossier', auth, doe((key, b) => gzDossier(key, b)));
  app.post('/api/member/lifestyle/gezondheid/dossier/weg', auth, doe((key, b) => gzDossierWeg(key, String(b.id || ''))));
};
