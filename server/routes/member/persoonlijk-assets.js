/* Toren 3: RTG Shared Assets. De routes wonen apart zodat de persoonlijke
   assistent klein en controleerbaar blijft; de logica blijft in kern/assets. */
'use strict';
module.exports = (kern) => {
  const { app, auth, liveCodename, assetsOverzicht, assetDocument, assetKoop,
    assetHerroep, assetWachtlijstZet, assetMijn, assetGebruik, assetUitstap } = kern;

  app.post('/api/assets', auth, (req, res) => res.json(assetsOverzicht(req.session.key)));
  // het essentiele-informatiedocument: lezen voordat er iets wordt afgerekend
  app.post('/api/asset/document', auth, (req, res) => {
    const r = assetDocument(req.body.assetId);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/asset/koop', auth, (req, res) => {
    const r = assetKoop(req.session, liveCodename(req.session), req.body.assetId, req.body.smaak, req.body.aantal, req.body.akkoord === true);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  // veertien dagen bedenktijd: volledige terugbetaling, voor beide smaken
  app.post('/api/asset/herroep', auth, async (req, res) => {
    const r = await assetHerroep(req.session, liveCodename(req.session), req.body.ticketId);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/asset/wachtlijst', auth, (req, res) => {
    const r = assetWachtlijstZet(req.session, liveCodename(req.session), req.body.assetId);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/asset/mijn', auth, (req, res) => res.json(assetMijn(req.session.key)));
  app.post('/api/asset/gebruik', auth, (req, res) => {
    const r = assetGebruik(req.session, req.body.assetId, req.body.datum);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/asset/uitstap', auth, async (req, res) => {
    const r = await assetUitstap(req.session, liveCodename(req.session), req.body.ticketId);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
};
