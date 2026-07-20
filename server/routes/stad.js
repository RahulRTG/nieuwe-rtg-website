/* Domein "stad": RTG Stad voor de BEWONER (de app "Mijn Stad" in het leden-OS).
   Kijken mag met elke ingelogde sessie, ook de gratis laag: de stad is van
   iedereen. Melden vraagt een RTG-profiel (codenaam), zodat de melder zijn
   eigen melding kan volgen en de veldploeg een aanspreekpunt heeft -- op
   pseudoniem, zoals alles in het huis. */
module.exports = (kern) => {
  const { app, auth, liveCodename, stad } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const cn = req => liveCodename(req.session);

  // het bewonersbeeld: standen, scenario, waarschuwingen en mijn meldingen
  app.post('/api/stad/bewoner', auth, (req, res) => stuur(res, stad.stadBewonerBeeld(cn(req))));

  // iets melden dat stuk of vol is; het staat direct op de veldwerk-lijst
  app.post('/api/stad/melding', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Melden kan met een RTG-profiel; meekijken mag altijd.' });
    stuur(res, stad.stadBewonerMeld({ codenaam: cn(req), zone: req.body.zone, soort: req.body.soort, tekst: req.body.tekst }));
  });
};
