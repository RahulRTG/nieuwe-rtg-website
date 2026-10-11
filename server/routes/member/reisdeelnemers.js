/* Domein "member", deelmodule reisdeelnemers: boeken en betalen PER DEELNEMER
   (kern/reisbureau-deelnemers.js, besluit B3 van 11 oktober 2026).

   De organisator zet klaar, elke reisgenoot beslist zelf over zijn eigen deel.
   Betalen staat hier met opzet NIET: dat blijft /api/reisbureau/betaal, de ene
   weg langs kern/pay die alleen de eigen aanvraag van de betaler kent. De
   persoon komt overal uit de SESSIE; geen lichaam kan een ander noemen als
   "ik". Alleen routes; de logica woont in de kern-module. */
module.exports = (kern) => {
  const { app, auth, liveCodename, reisbureau, gegevensStop } = kern;
  const stuur = (res, r) => r && r.error
    ? res.status(r.status || 400).json({ error: r.error })
    : res.json(r);
  const lid = (req, res) => {
    if (req.session.tier !== 'guest') return true;
    res.status(403).json({ error: 'Een reis boeken is voor leden; uw deel blijft gewoon klaarstaan.' });
    return false;
  };

  // de organisator boekt zijn eigen plaats en zet voor elke reisgenoot een deel klaar
  app.post('/api/reisbureau/deelnemers/klaarzetten', auth, async (req, res) => {
    if (!lid(req, res)) return;
    if (gegevensStop(req, res, 'reservering')) return;
    const b = req.body || {};
    stuur(res, await reisbureau.deelnemers.zetKlaar(req.session, liveCodename(req.session),
      { tripId: b.tripId, vertrek: b.vertrek, reis: b.reis, deelnemers: b.deelnemers }));
  });
  // de reisgenoot zegt zelf ja (dan ontstaat ZIJN aanvraag) of nee op zijn deel
  app.post('/api/reisbureau/deelnemers/antwoord', auth, async (req, res) => {
    const ja = (req.body || {}).ja === true;
    if (ja && !lid(req, res)) return;
    if (ja && gegevensStop(req, res, 'reservering')) return;
    stuur(res, await reisbureau.deelnemers.antwoord(req.session, liveCodename(req.session), (req.body || {}).id, ja));
  });
  // de reisgenoot deelt zelf of zijn deel past (besluit B2) met de organisator, of haalt dat weg
  app.post('/api/reisbureau/deelnemers/budget', auth, (req, res) => {
    stuur(res, reisbureau.deelnemers.deelBudget(req.session, liveCodename(req.session),
      (req.body || {}).id, (req.body || {}).delen === true));
  });
  // de organisator ziet per deelnemer de stand van het deel, zonder geld
  app.post('/api/reisbureau/deelnemers/stand', auth, (req, res) => {
    stuur(res, reisbureau.deelnemers.stand(req.session.key, String((req.body || {}).ref || '')));
  });
};
