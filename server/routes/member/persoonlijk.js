/* Domein "member", deelmodule persoonlijk: alles wat van het lid zelf is.
   Het zorgprofiel en locatie-delen (kern/gastzorg.js), De Butler
   (kern/fluister.js) en de Shared Assets (kern/assets.js). Alleen routes;
   de logica woont in de kern-modules. */
module.exports = (kern) => {
  const { app, auth, liveCodename, verdienPunten,
    zorgVan, zorgZet, locDeel, locStopKlant, locMijn,
    fluisterZeg, fluisterPush, fluisterProfiel, fluisterOnthoud, fluisterVergeet, fluisterFocus,
    assetsOverzicht, assetDocument, assetKoop, assetHerroep, assetWachtlijstZet, assetMijn, assetGebruik, assetUitstap,
    careOverzicht, careBoek, careBetaal, careAnnuleer, careMijn, careIntakeDeel, careIntakeStop } = kern;

/* ---- de zorgvolle keten (kern/gastzorg.js) ----
   Het zorgprofiel: allergenen, dieet en medische aandachtspunten. Reist
   alleen mee met bestellingen en verblijven als het lid delen aanzet. */
app.post('/api/zorgprofiel', auth, (req, res) => res.json({ ok: true, zorg: zorgVan(req.session.key) }));
app.post('/api/zorgprofiel/zet', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  res.json(zorgZet(req.session.key, req.body));
});
/* Live meekijken met toestemming: het lid wijst een zaak aan; die ziet de
   gps-positie tot de zaak (of het lid zelf) het delen stopzet. */
app.post('/api/locatie/deel', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = locDeel(req.session.key, liveCodename(req.session), req.body.supplierCode);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/locatie/stop', auth, (req, res) => {
  const r = locStopKlant(req.session.key, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/locatie/mijn', auth, (req, res) => res.json(locMijn(req.session.key)));

/* ---- Fluister: de persoonlijke assistent met geheugen (kern/fluister.js).
   Voor iedereen, over de eigen gegevens; alles is opvraagbaar en wisbaar. */
app.post('/api/fluister', auth, async (req, res) => {
  // de sessie reist mee zodat Fluister ook kan doen (reserveren, 24 uur plannen)
  const r = await fluisterZeg(req.session.key, liveCodename(req.session), req.body.q, req.session);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/fluister/profiel', auth, (req, res) => {
  // nieuwe seintjes worden meteen ook een melding op het toestel (met dedupe)
  fluisterPush(req.session.key);
  res.json(fluisterProfiel(req.session.key));
});
app.post('/api/fluister/onthoud', auth, (req, res) => {
  const r = fluisterOnthoud(req.session.key, req.body.tekst);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/fluister/vergeet', auth, (req, res) => {
  const r = fluisterVergeet(req.session.key, req.body.wat);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
// de inklap-laag deelt (alleen) tellers van schermgebruik, zodat Fluister leert
app.post('/api/fluister/focus', auth, (req, res) => res.json(fluisterFocus(req.session.key, req.body.scores)));

/* ---- Toren 3: RTG Shared Assets (kern/assets.js) ----
   Altijd 300 tickets per object; een ticket is 24 uur per jaar, tien jaar
   lang. Access loopt af, Asset heeft restwaarde en stapt uit via een Tik. */
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

/* ---- Toren 4: RTG Care (kern/care.js) ----
   Zorg & welzijn: spa's, wellness en klinieken. Een behandeling boeken bij
   een behandelaar in een tijdslot; het zorgprofiel reist mee en een aparte,
   veilige intake kan uitdrukkelijk (en tijdelijk) met een aanbieder worden
   gedeeld. Betalen loopt via careBetaal (RTG Pay-punten via verdienPunten). */
app.post('/api/care', auth, (req, res) => res.json(careOverzicht(req.session.key)));
app.post('/api/care/boek', auth, (req, res) => {
  const r = careBoek(req.session, liveCodename(req.session), req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/care/betaal', auth, (req, res) => {
  const r = careBetaal(req.session, req.body.ref, verdienPunten);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/care/annuleer', auth, (req, res) => {
  const r = careAnnuleer(req.session.key, req.body.ref);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/care/mijn', auth, (req, res) => res.json(careMijn(req.session.key)));
// de veilige, aparte intake-deling met een aanbieder (uitdrukkelijk, tijdelijk)
app.post('/api/care/intake/deel', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = careIntakeDeel(req.session.key, req.body.aanbiederId, req.body.medisch);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/care/intake/stop', auth, (req, res) => {
  const r = careIntakeStop(req.session.key, req.body.id);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
};
