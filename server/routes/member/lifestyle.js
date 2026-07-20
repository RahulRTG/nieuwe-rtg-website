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
  function route(pad, werk) {
    app.post('/api/member/lifestyle/' + pad, auth, async (req, res) => {
      if (!eis(req, res)) return;
      try { stuur(res, await werk(req.session.key, req.body || {})); }
      catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
    });
  }

  route('overzicht', (key) => lifestyleOverzicht(key));
  route('ai', (key, b) => lifestyleAI(key, b.vraag));
  // concierge
  route('concierge', (key) => conciergeVerzoeken(key));
  route('concierge/vraag', (key, b) => conciergeVraag(key, b));
  route('concierge/intrek', (key, b) => conciergeIntrek(key, String(b.id || '')));
  route('voorkeuren', (key) => lifestyleVoorkeuren(key));
  route('voorkeuren/zet', (key, b) => lifestyleVoorkeurenZet(key, b));
  // bezittingenregister
  route('bezit', (key) => bezittingen(key));
  route('bezit/zet', (key, b) => bezitZet(key, b));
  route('bezit/weg', (key, b) => bezitWeg(key, String(b.id || '')));
  // gezondheid & welzijn
  route('gezondheid', (key) => gezondheid(key));
  route('gezondheid/afspraak', (key, b) => gzAfspraak(key, b));
  route('gezondheid/afspraak/weg', (key, b) => gzAfspraakWeg(key, String(b.id || '')));
  route('gezondheid/dossier', (key, b) => gzDossier(key, b));
  route('gezondheid/dossier/weg', (key, b) => gzDossierWeg(key, String(b.id || '')));
};
