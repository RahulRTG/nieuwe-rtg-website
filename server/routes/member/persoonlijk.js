/* Persoonlijke ledenroutes: zorg, locatie, het Fluister-profiel en Shared
   Assets. De logica woont in de kernmodules, de Rahul-beurt zelf in
   ./persoonlijk-rahul.js. */

module.exports = (kern) => {
  const { app, auth, liveCodename, zorgVan, zorgZet, locDeel, locStopKlant, locMijn } = kern;
  const { fluisterPush, fluisterProfiel, fluisterOnthoud, fluisterVergeet, fluisterFocus } = kern.fluister;

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


app.post('/api/fluister/profiel', auth, (req, res) => {
  // nieuwe seintjes worden meteen ook een melding op het toestel (met dedupe)
  fluisterPush(req.session.key);
  const p = fluisterProfiel(req.session.key);
  // de voorspeller en Balans fluisteren stil mee: alleen een rijpe gewoonte
  // of een echt volle week wordt een seintje in "Rahul ziet", nooit een
  // melding op het toestel
  const vs = kern.voorspel && kern.voorspel.seintjeVoor(kern.voorspel.voorLid(liveCodename(req.session), req.session.key));
  const bs = kern.balans && kern.balans.seintjeVoorBalans(kern.balans.balansVoorLid(liveCodename(req.session), req.session.key));
  p.seintjes = [vs, bs].filter(Boolean).concat(p.seintjes || []).slice(0, 5);
  res.json(p);
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

/* De Rahul-beurt zelf staat in ./persoonlijk-rahul.js: sinds het plafond, de
   schermcontext en het stuurspoor erbij kwamen is dat het zware deel van dit
   bestand geworden, en het ging door de omvangband van keuringsregel `omvang`.
   Sparren staat apart om een ander soort reden: een ander onderwerp. */
require('./persoonlijk-rahul')(kern);
require('./persoonlijk-spar')(kern);
require('./persoonlijk-assets')(kern);

// Toren 4, RTG Care (zorg & welzijn) staat apart, in ./persoonlijk-care.js
require('./persoonlijk-care')(kern);
};
