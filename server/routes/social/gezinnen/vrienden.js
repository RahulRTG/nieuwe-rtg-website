/* Sociale laag RTF (deelmodule): de verplichte onboarding, de vriendenlaag
   (met ouderakkoord), dm, snaps en verhalen. Gemount vanuit
   routes/social/gezinnen.js op de gedeelde context. */
module.exports = (sctx) => {
  const { kern, isKindVanGezin, rtfOnbSess, rtfSociaal, pinClusterRem } = sctx;
  const { app, express, rtf, socialZoek, socialVerbind, ouderVerbind, socialAntwoord, socialConnecties,
          socialDm, socialDmSend, socialGoedkeur, socialTeKeuren, snapSturen, snapsVoor, snapOpenen,
          verhaalPlaatsen, verhalenVoor, verhaalBekijken, dagOpdracht, onboarding, pinKaart,
          pinNormaliseer } = kern;
/* Verplichte onboarding + contract voor RTF-leden: dezelfde platform-scope 'rtg',
   maar met de RTF-handle als sleutel. RTF vraagt standaard de contactgegevens + het
   contract (geen paspoort; dat is voor de reispas). */
app.post('/api/rtf/onboarding/status', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  res.json(onboarding.status('rtg', rtfOnbSess(s)));
});
app.post('/api/rtf/onboarding/opslaan', express.json({ limit: '256kb' }), (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  res.json(onboarding.slaOp('rtg', rtfOnbSess(s), req.body.velden || {}));
});
app.post('/api/rtf/onboarding/teken', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = onboarding.teken('rtg', rtfOnbSess(s), req.body.naam, req.body.akkoord === true);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
// Beschermd profiel (15 of jonger): zoeken en zelf verzoeken sturen staat dicht;
// de ouder/verzorger voegt vrienden toe via /api/rtf/social/oudervoeg.
app.post('/api/rtf/social/find', async (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  if (s.beschermd) return res.status(403).json({ error: 'Je ouder of verzorger voegt vrienden voor je toe.' });
  res.json({ results: await socialZoek(s.handle, req.body.q) });
});
app.post('/api/rtf/social/connect', async (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  if (s.beschermd) return res.status(403).json({ error: 'Je ouder of verzorger voegt vrienden voor je toe.' });
  const r = await socialVerbind(s.handle, String(req.body.key || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.st });
});
// Een ouder/beheerder voegt een contact toe voor een beschermd kind van zijn gezin
// (op contactpin of exacte codenaam). De andere kant moet daarna nog gewoon zelf accepteren.
app.post('/api/rtf/social/oudervoeg', async (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  if (!s.beheerder) return res.status(403).json({ error: 'Alleen een ouder/beheerder voegt contacten toe voor een kind.' });
  const kindHandle = String(req.body.kindHandle || '');
  const invoer = String(req.body.pin || req.body.codenaam || '');
  const isPin = !!pinNormaliseer(invoer);
  if (isPin) {
    const deur = await pinClusterRem.voor({ actor: kindHandle, bron: req.ip });
    if (!deur.ok) return res.status(deur.status).json({ error: deur.error });
  }
  const r = await ouderVerbind(s.g.code, kindHandle, invoer);
  if (isPin && r.error && r.status === 404) {
    const geteld = await pinClusterRem.misser();
    if (!geteld.ok) return res.status(geteld.status).json({ error: geteld.error });
  }
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.st });
});
app.post('/api/rtf/social/respond', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = socialAntwoord(s.handle, String(req.body.key || ''), req.body.action);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.st });
});
app.post('/api/rtf/social/connections', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const sc = socialConnecties(s.handle);
  // beheerder: ook de kinderen van het gezin, zodat de ouder kan meekijken
  /* De pin van het kind gaat mee voor de BEHEERDER, en alleen voor hem: zo
     geeft een ouder hem door aan de ouder van een vriendje, precies zoals hij
     nu de codenaam overtypt. Het kind zelf krijgt hem niet -- niet omdat hij
     gevaarlijk is (een vreemde kan er niets mee, zie pinZoek), maar omdat het
     kind er niets mee KAN: verbinden loopt daar hoe dan ook via de ouder. */
  const kinderen = s.beheerder ? rtf.socialProfielen().filter(sp => sp.gezinCode === s.g.code && sp.beschermd).map(sp => ({ handle: sp.handle, codenaam: sp.codenaam, ...pinKaart(sp.handle) })) : [];
  res.json({ me: s.handle, codename: s.codenaam, kind: s.kind, beschermd: s.beschermd, beheerder: s.beheerder, connections: sc.connections, requests: sc.requests, teKeuren: s.beheerder ? socialTeKeuren(s.g.code) : [], kinderen });
});
app.post('/api/rtf/social/dm', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = socialDm(s.handle, String(req.body.withKey || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ messages: r.messages, codename: r.codename });
});
app.post('/api/rtf/social/dm/send', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = socialDmSend(s.handle, String(req.body.toKey || ''), req.body.text);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, messages: r.messages });
});
app.post('/api/rtf/social/goedkeuren', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  if (!s.beheerder) return res.status(403).json({ error: 'Alleen een ouder/beheerder keurt vriendschappen goed.' });
  const r = socialGoedkeur(s.g.code, String(req.body.kindHandle || ''), String(req.body.anderKey || ''), req.body.akkoord !== false);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.st });
});
app.post('/api/rtf/social/snap/send', express.json({ limit: '1.5mb' }), async (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = await snapSturen(s.handle, String(req.body.toKey || ''), req.body.foto, req.body.tekst);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
});
app.post('/api/rtf/social/snaps', (req, res) => { const s = rtfSociaal(req, res); if (!s) return; res.json({ snaps: snapsVoor(s.handle) }); });
app.post('/api/rtf/social/snap/view', async (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = await snapOpenen(s.handle, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ foto: r.foto, tekst: r.tekst, van: r.van });
});
app.post('/api/rtf/social/story/post', express.json({ limit: '1.5mb' }), async (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = await verhaalPlaatsen(s.handle, req.body.foto, req.body.tekst, req.body.opdracht === true);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
});
app.post('/api/rtf/social/opdracht', (req, res) => { const s = rtfSociaal(req, res); if (!s) return; res.json({ opdracht: dagOpdracht() }); });
app.post('/api/rtf/social/stories', (req, res) => { const s = rtfSociaal(req, res); if (!s) return; res.json({ stories: verhalenVoor(s.handle) }); });
app.post('/api/rtf/social/story/view', async (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = await verhaalBekijken(s.handle, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ foto: r.foto, tekst: r.tekst, van: r.van, at: r.at });
});
};
