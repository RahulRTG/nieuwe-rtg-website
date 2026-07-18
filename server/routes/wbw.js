/* Domein "wbw": Wie betaalt wat. Het gedeelde lijstje van een groep
   Salon-vrienden: uitgaven, balans en verrekenen via RTG Pay. Alles achter
   de gewone leden-inlog; geld beweegt alleen door een tik van de eigenaar. */
module.exports = (kern) => {
  const { app, auth, wbwMaak, wbwMijn, wbwGroep, wbwUitgave, wbwVerreken, wbwVerzoek } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Wie betaalt wat is voor leden.' }); return true; }
    return false;
  };

  app.post('/api/wbw/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, wbwMijn(req.session.key));
  });
  app.post('/api/wbw/maak', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, wbwMaak(req.session.key, req.body || {}));
  });
  app.post('/api/wbw/groep', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, wbwGroep(req.session.key, String(req.body.id || '')));
  });
  app.post('/api/wbw/uitgave', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, wbwUitgave(req.session.key, String(req.body.id || ''), req.body || {}));
  });
  // de eigen schuld in een tik betalen (RTG Pay, idempotent)
  app.post('/api/wbw/verreken', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await wbwVerreken(req.session.key, String(req.body.id || ''), req.body.idem));
  });
  // als tegoedhouder: nette Klompjes (betaalverzoeken) naar wie rood staat
  app.post('/api/wbw/verzoek', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await wbwVerzoek(req.session.key, String(req.body.id || '')));
  });
};
