/* Een betaalprovider koppelen is een gedeelde taak met gescheiden rechten:
   IT mag aanvragen begeleiden, configureren en beproeven; alleen de eigenaar
   kiest de voorkeursrail en geeft live vrij. Alle handelingen komen in het
   onveranderlijke regiejournaal, zonder geheime sleutels. */
'use strict';

module.exports = (ctx) => {
  const { app, accounts, betaalRegie, techAuth, eigenaarAlleen, isEigenaar } = ctx;
  const wie = req => {
    try { return accounts.realNameOf(req.techUser); }
    catch (e) { return 'user-' + (req.techUser && req.techUser.id || '?'); }
  };
  const veilig = (res, werk) => {
    try { res.json(werk()); }
    catch (e) { res.status(400).json({ error: String(e && e.message || e) }); }
  };

  function status(req, res) {
    const uit = betaalRegie.overzicht();
    uit.rechten = { techniek: true, eigenaar: isEigenaar(req.techUser) };
    res.json(uit);
  }
  function stap(req, res) {
    veilig(res, () => betaalRegie.zetFase(req.body.provider, req.body.fase,
      wie(req), req.body.notitie, isEigenaar(req.techUser) ? 'eigenaar' : 'it'));
  }
  function proef(req, res) {
    veilig(res, () => betaalRegie.proef(req.body.provider, wie(req)));
  }
  function keuze(req, res) {
    veilig(res, () => betaalRegie.kiesVoorkeur(req.body.provider, wie(req)));
  }

  app.get('/api/techniek/betalingen/status', techAuth, status);
  app.post('/api/techniek/betalingen/stap', techAuth, stap);
  app.post('/api/techniek/betalingen/proef', techAuth, proef);
  app.post('/api/techniek/betalingen/keuze', techAuth, eigenaarAlleen, keuze);

  // De eigenaarszetel in de Boardroom gebruikt dezelfde regie en rechten.
  app.post('/api/boardroom/betalingen/status', techAuth, status);
  app.post('/api/boardroom/betalingen/stap', techAuth, stap);
  app.post('/api/boardroom/betalingen/proef', techAuth, proef);
  app.post('/api/boardroom/betalingen/keuze', techAuth, eigenaarAlleen, keuze);
};
