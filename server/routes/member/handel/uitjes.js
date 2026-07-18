/* Member-handel (deelmodule): verblijven, reserveren, reviews, favorieten, agenda, splitsen, wachtlijst en punten.
   Gemount vanuit routes/member/handel.js op de gedeelde kern. */
module.exports = (hctx) => {
  const { kern, openLijn } = hctx;
  const { DOOR_RELOCK_MS, app, auth, betaal, crypto,
    db, express, findSupplier, liveCodename, logActivity,
    notifySupplier, optieAan, save, schoon, sseToSupplier,
    unlockDoor, reserveerTafel, mijnReserveringen, annuleerReservering, annuleerItem,
    plaatsReview, reviewsVoor, verblijfBoek, mijnVerblijven, verblijfAnnuleer,
    gastDeur, toggleFavoriet, favorietenVan, agendaVoor, maakSplits,
    mijnSplitsen, betaalSplits, zetOpWachtlijst, mijnWachtlijst, rsvpAnnuleer,
    puntenVan, verzilverPunten, salonZichtbaar, ghMarkt, ghPlaatsBestelling,
    ghMijnBestellingen, ghAnnuleer, mbAanvraag, mbMijn, zorgVoor, zorgContact } = kern;
app.post('/api/verblijf', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = verblijfBoek(req.session, liveCodename(req.session), req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  // het zorgprofiel reist mee (alleen met toestemming): de receptie weet het meteen
  const zorg = zorgVoor(req.session.key);
  if (zorg) { r.verblijf.zorg = zorg; save(); }
  res.json(r);
});
app.post('/api/verblijf/mijn', auth, (req, res) => res.json({ verblijven: mijnVerblijven(req.session.key) }));
app.post('/api/verblijf/annuleer', auth, (req, res) => {
  const r = verblijfAnnuleer(req.session.key, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
/* Keyless: de ingecheckte gast opent met de app zijn kamerdeur of de entree.
   De zaak-optie (digitale gastsleutel) blijft de baas; alles wordt gelogd. */
app.post('/api/verblijf/deur', auth, (req, res) => {
  const r = gastDeur(req.session.key, String(req.body.supplierCode || ''), req.body.welke === 'kamer' ? 'kamer' : 'entree');
  if (r.error) return res.status(r.status).json({ error: r.error });
  if (!optieAan(r.supplier, 'deurenGast')) return res.status(409).json({ error: r.supplier.name + ' heeft de digitale gastsleutel op dit moment uitstaan. Meld u bij de receptie.' });
  unlockDoor(r.supplier, r.door, r.verblijf.codenaam);
  logActivity(r.supplier.code, { name: r.verblijf.codenaam }, 'opende "' + r.door.name + '" met de digitale sleutel');
  res.json({ ok: true, door: { name: r.door.name, relockSec: DOOR_RELOCK_MS / 1000 } });
});

// tafel reserveren: het lid vraagt aan, de zaak beslist
app.post('/api/reserveer', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = reserveerTafel(req.session, liveCodename(req.session), req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  // het zorgprofiel reist mee (alleen met toestemming): de zaak weet het al bij het dekken
  const zorgR = zorgVoor(req.session.key);
  if (zorgR) { r.reservering.zorg = zorgR; save(); }
  res.json(r);
});
app.post('/api/reserveringen/mijn', auth, (req, res) => res.json({ reserveringen: mijnReserveringen(req.session.key) }));
app.post('/api/reservering/annuleer', auth, (req, res) => {
  const r = annuleerReservering(req.session.key, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

// annuleren door het lid: bestelling, rit of boeking (incl. tickets)
app.post('/api/annuleer', auth, (req, res) => {
  const r = annuleerItem(req.session, String(req.body.soort || ''), String(req.body.ref || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

// reviews: 1-5 sterren na een afgeronde dienst; publiek per partner opvraagbaar
app.post('/api/review', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = plaatsReview(req.session, liveCodename(req.session), req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/reviews', auth, (req, res) => res.json(reviewsVoor(req.body.supplierCode)));

// favorieten: mijn adressen
app.post('/api/favoriet', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = toggleFavoriet(req.session.key, req.body.supplierCode);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/favorieten', auth, (req, res) => res.json({ favorieten: favorietenVan(req.session.key) }));

// de reisagenda: alles met een datum, per dag gegroepeerd
app.post('/api/agenda/mijn', auth, (req, res) => res.json(agendaVoor(req.session.key)));

// rekening splitsen met verbonden vrienden (betaalverzoeken)
app.post('/api/splits', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = maakSplits(req.session.key, liveCodename(req.session), String(req.body.ref || ''), req.body.metKeys);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/splitsen/mijn', auth, (req, res) => res.json({ splitsen: mijnSplitsen(req.session.key) }));
app.post('/api/splits/betaal', auth, (req, res) => {
  const r = betaalSplits(req.session.key, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

// wachtlijst voor een vol event of tijdslot
app.post('/api/wachtlijst', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = zetOpWachtlijst(req.session, liveCodename(req.session), req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/wachtlijst/mijn', auth, (req, res) => res.json({ wachtlijst: mijnWachtlijst(req.session.key) }));

// aanmelding voor een event intrekken (maakt de plek vrij voor de wachtlijst)
app.post('/api/event/rsvp/annuleer', auth, (req, res) => {
  const r = rsvpAnnuleer(req.session.key, req.body.supplierCode, req.body.eventId);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

// RTG-punten: saldo en historie, verzilveren naar tegoed
app.post('/api/punten', auth, (req, res) => res.json(puntenVan(req.session.key)));
app.post('/api/punten/verzilver', auth, (req, res) => {
  const r = verzilverPunten(req.session.key, req.body.punten);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
};
