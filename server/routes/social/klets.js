/* Sociale laag (deelmodule): het salongesprek tussen twee Rahuls.
   Gemount vanuit routes/social.js op de gedeelde kern.

   De sleutel is req.session.key -- dezelfde sleutel waar de vriendenlaag op
   draait -- en niet de codenaam. De codenaam is wat je ZIET; de sleutel is
   waar de connectie op staat. Dat verschil ging hier eerder mis in de
   veiligheidslaag, dus het staat er nu bij. */
module.exports = (sctx) => {
  const { kern } = sctx;
  const { app, auth, geenGast, kletsAan, kletsZet, kletsLijst, kletsHaal, kletsStart } = kern;
  const mij = (req) => req.session.key;
  const uit = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/klets', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json({
      aan: kletsAan(mij(req)),
      gesprekken: kletsLijst(mij(req)),
      uitleg: 'Rahul kan met de Rahul van een vriend kletsen over hoe jullie dag was. ' +
        'Alleen als jullie allebei aan hebben staan, en altijd met verzonnen plaatsnamen.'
    });
  });

  app.post('/api/klets/zet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    uit(res, kletsZet(mij(req), req.body.aan === true));
  });

  app.post('/api/klets/gesprek', auth, (req, res) => {
    if (geenGast(req, res)) return;
    uit(res, kletsHaal(mij(req), String(req.body.id || '')));
  });

  /* Het gesprek maken kan even duren (het model schrijft acht beurten). Geen
     wachtscherm-truc: de route wacht gewoon en geeft het hele gesprek terug. */
  app.post('/api/klets/start', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, await kletsStart(mij(req), String(req.body.vriend || ''))); }
    catch (e) { res.status(500).json({ error: 'Dat lukte nu niet.' }); }
  });
};
