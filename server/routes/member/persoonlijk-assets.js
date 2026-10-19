/* Toren 3: RTG Shared Assets. De routes wonen apart zodat de persoonlijke
   assistent klein en controleerbaar blijft; de logica blijft in kern/assets. */
'use strict';
module.exports = (kern) => {
  const { app, auth, liveCodename, assetsLid } = kern;

  app.post('/api/assets', auth, (req, res) => res.json(assetsLid.assetsOverzicht(req.session.key)));
  // het essentiele-informatiedocument: lezen voordat er iets wordt afgerekend
  app.post('/api/asset/document', auth, (req, res) => {
    const r = assetsLid.assetDocument(req.body.assetId);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/asset/koop', auth, (req, res) => {
    const r = assetsLid.assetKoop(req.session, liveCodename(req.session), req.body.assetId, req.body.smaak, req.body.aantal, req.body.akkoord === true, req.body.idem);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  // veertien dagen bedenktijd: volledige terugbetaling, voor beide smaken
  app.post('/api/asset/herroep', auth, async (req, res) => {
    const r = await assetsLid.assetHerroep(req.session, liveCodename(req.session), req.body.ticketId || req.body.id);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/asset/wachtlijst', auth, (req, res) => {
    const r = assetsLid.assetWachtlijstZet(req.session, liveCodename(req.session), req.body.assetId);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/asset/mijn', auth, (req, res) => res.json(assetsLid.assetMijn(req.session.key)));
  /* Een koop is een aanvraag (kern/assets/aanvraag.js): het lid ziet zijn
     aanvragen en betaalt pas nadat een mens van RTG goedkeurde. */
  app.post('/api/asset/aanvragen', auth, (req, res) => res.json(assetsLid.assetAanvragenMijn(req.session.key)));
  app.post('/api/asset/aanvraag/betaal', auth, async (req, res) => {
    const r = await assetsLid.assetAanvraagBetaal(req.session, req.body.id, req.body.idem);
    if (r.error) return res.status(r.status).json(r);
    res.json(r);
  });
  app.post('/api/asset/gebruik', auth, (req, res) => {
    const r = assetsLid.assetGebruik(req.session, req.body.assetId, req.body.datum);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/asset/uitstap', auth, async (req, res) => {
    const r = await assetsLid.assetUitstap(req.session, liveCodename(req.session), req.body.ticketId);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
};
