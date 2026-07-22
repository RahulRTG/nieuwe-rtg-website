/* Domein "member", deelmodule winkel & identiteit: de retail/mode-catalogus
   (verlanglijst, apart leggen, styling) en het paspoort: het lid houdt de regie.
   Alleen routes; de logica woont in de kern-modules. */
module.exports = (kern) => {
  const { app, auth, findSupplier, liveCodename,
    voorkeurVan, zetVoorkeur, retailCatalogus, wishlistToggle,
    mijnApart, mijnStyling, vraagPaskamer, retailIsRetail, PASPOORT_NIVEAUS,
    paspoortStatus, paspoortMijn, paspoortBeslis, paspoortTrekIn,
    reisbureau, logies, uitgaan } = kern;

// de koop- en bibliotheek-ingangen van de Mall staan apart (winkel klein houden)
require('./winkel-bieb')(kern);

/* ---- de losse verblijf-pagina: hotels, appartementen en villa's ---- */
// het overzicht van de overnachters met hun vrije kamers; boeken gaat via /api/verblijf
app.post('/api/hotels', auth, (req, res) => res.json(logies.overzicht()));

/* ---- de losse uitgaan-pagina: bars, clubs en beachclubs met hun avonden ---- */
// het overzicht van de nachtadressen met hun gepubliceerde events; aanmelden gaat via /api/event/rsvp
app.post('/api/uitgaan', auth, (req, res) => res.json(uitgaan.overzicht()));
// de avonden waar ik op de gastenlijst sta (annuleren gaat via /api/event/rsvp/annuleer)
app.post('/api/uitgaan/mijn', auth, (req, res) => res.json({ avonden: uitgaan.mijnAvonden(req.session.key) }));

/* ---- het RTG-reisbureau: samengestelde reizen, tegen de nettoprijs ---- */
// het overzicht van de reizen
app.post('/api/reisbureau', auth, (req, res) => res.json(reisbureau.overzicht()));
// een lid vraagt een reis aan (aangevraagd; een reisadviseur bevestigt)
app.post('/api/reisbureau/boek', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = reisbureau.boek(req.session, liveCodename(req.session), req.body || {});
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json(r);
});
// mijn reisaanvragen
app.post('/api/reisbureau/mijn', auth, (req, res) => res.json({ aanvragen: reisbureau.mijn(req.session.key) }));
// een eigen reisaanvraag intrekken zolang die openstaat
app.post('/api/reisbureau/annuleer', auth, (req, res) => {
  const r = reisbureau.annuleer(req.session.key, String(req.body.ref || ''));
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json(r);
});
// AI-reisadvies: vertel je wens, de reisadviseur wijst de best passende reis aan
app.post('/api/reisbureau/advies', auth, async (req, res) => {
  const r = await reisbureau.advies(String(req.body.wens || ''));
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json(r);
});

/* ---- retail/mode: de catalogus van een modehuis, verlanglijst, apart en styling ---- */
// de catalogus van een merk (collecties + artikelen met ledenprijs, drops, wishlist)
app.post('/api/retail/catalogus', auth, (req, res) => {
  const s = findSupplier(req.body.supplierCode);
  if (!s || !retailIsRetail(s)) return res.status(404).json({ error: 'Modepartner niet gevonden.' });
  res.json(retailCatalogus(s, req.session.key, req.body.lang));
});
// een artikel op de verlanglijst zetten of eraf halen
app.post('/api/retail/wishlist', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = wishlistToggle(String(req.body.supplierCode || ''), req.session.key, String(req.body.artikelId || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
// een maat naar een paskamer laten brengen (in de winkel, vanuit de app)
app.post('/api/retail/paskamer', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.supplierCode);
  if (!s || !retailIsRetail(s)) return res.status(404).json({ error: 'Modepartner niet gevonden.' });
  const r = vraagPaskamer(s, req.session.key, liveCodename(req.session), req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
// wat er voor mij apart ligt, en de stylingvoorstellen die ik kreeg
app.post('/api/retail/mijn', auth, (req, res) => res.json({ apart: mijnApart(req.session.key), styling: mijnStyling(req.session.key) }));

/* ---- paspoort/identiteit: het lid houdt de regie (kern/paspoort.js) ---- */
// mijn verificatiestatus en de openstaande/afgehandelde identiteitsverzoeken
app.post('/api/paspoort/mijn', auth, (req, res) => {
  res.json({ status: paspoortStatus(req.session.key), verzoeken: paspoortMijn(req.session.key), niveaus: PASPOORT_NIVEAUS });
});
// een idkaart-/paspoortverzoek goedkeuren of weigeren
app.post('/api/paspoort/beslis', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden met een geverifieerd account.' });
  const r = paspoortBeslis(req.session.key, String(req.body.id || ''), req.body.akkoord === true);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
// een eerder gegeven goedkeuring weer intrekken
app.post('/api/paspoort/trek-in', auth, (req, res) => {
  const r = paspoortTrekIn(req.session.key, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

// meldingsvoorkeuren: per scope aan of uit (afgedwongen in notify)
app.post('/api/meldingen/voorkeur', auth, (req, res) => {
  // demo-sessies hebben hun pas als sleutel, accounts hun eigen sleutel: notify
  // gebruikt dezelfde, dus de voorkeur landt automatisch op het juiste doel
  if (req.body.zet && typeof req.body.zet === 'object') return res.json({ voorkeur: zetVoorkeur(req.session.key, req.body.zet) });
  res.json({ voorkeur: voorkeurVan(req.session.key) });
});
};
