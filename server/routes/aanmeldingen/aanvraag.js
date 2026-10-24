/* De publieke aanvraagroute en haar optionele ledenidentiteit. Een meegestuurd
   maar ongeldig token is geen anonieme aanvraag: de client moet opnieuw
   inloggen. De duurzame ontvangst wordt door de aanmeldingskern afgehandeld. */
'use strict';

module.exports = ({ app, accounts, tooManyTries, aanmeldingen }) => {
  const context = req => {
    try {
      const h = req.get('authorization');
      const tok = typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7) : null;
      const u = tok && accounts && accounts.verifyToken(tok);
      return { aanwezig: h != null, id: u ? u.id : null };
    } catch (e) { return { aanwezig: true, id: null }; }
  };
  const aanvragerVan = req => context(req).id;

  app.post('/api/aanmelding/aanvraag', async (req, res) => {
    if (tooManyTries && tooManyTries(res, 'aanmelding:' + req.ip)) return;
    try {
      const actor = context(req);
      if (actor.aanwezig && actor.id == null)
        return res.status(401).json({ error: 'Log opnieuw in voor deze aanvraag.' });
      const r = await aanmeldingen.aanvraagBedoeling(req.body || {}, actor.id);
      res.status(r.status || 200).json(r);
    } catch (e) {
      console.error('[aanmeldingen] ontvangst niet bevestigd:', e.code || 'opslagfout');
      res.status(503).json({ error: 'De ontvangst is niet bevestigd. Herhaal met dezelfde opdrachtsleutel en inhoud.' });
    }
  });
  return aanvragerVan;
};
