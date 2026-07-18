/* Member-handel (deelmodule): het vastgoed van het lid: aanbod, interesse, bod en de keyless bezichtiging.
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
function pandPubliek(s, p) {
  return { id: p.id, titel: p.titel, soort: p.soort, transactie: p.transactie, prijs: p.prijs,
    plaats: p.plaats, adres: p.adres, slaapkamers: p.slaapkamers, badkamers: p.badkamers,
    oppervlakte: p.oppervlakte, perceel: p.perceel, tuin: p.tuin, zwembad: p.zwembad, garage: p.garage,
    energielabel: p.energielabel, omschrijving: p.omschrijving, status: p.status, keyless: !!p.keyless,
    fotos: p.fotos || [], supplierCode: s.code, supplierName: s.name };
}
app.post('/api/vastgoed/aanbod', auth, (req, res) => {
  const key = req.session.key;
  const uit = [];
  for (const s of db.data.suppliers) {
    if (s.type !== 'vastgoed' || !salonZichtbaar(s)) continue;
    const aanb = db.data.vastgoedAanbod.filter(a => a.supplierCode === s.code && (a.publiek || a.aanKeys.includes(key)));
    const pandIds = new Set(aanb.map(a => a.pandId));
    const gericht = new Set(aanb.filter(a => a.aanKeys.includes(key)).map(a => a.pandId));
    for (const p of (s.panden || [])) {
      if (!pandIds.has(p.id)) continue;
      uit.push({ ...pandPubliek(s, p), gericht: gericht.has(p.id) });
    }
  }
  // eigen bezichtigingen en biedingen erbij
  const bez = db.data.bezichtigingen.filter(b => b.key === key).slice(0, 30).map(b => {
    const s = findSupplier(b.supplierCode); const p = s ? (s.panden || []).find(x => x.id === b.pandId) : null;
    const keyNu = b.keyless && Date.now() >= new Date(b.keyless.van).getTime() && Date.now() <= new Date(b.keyless.tot).getTime();
    return { ref: b.ref, pand: p ? p.titel : b.pandId, plaats: p ? p.plaats : '', status: b.status, moment: b.moment || null,
      keyless: b.keyless ? { actiefNu: keyNu, van: b.keyless.van, tot: b.keyless.tot } : null };
  });
  const bod = db.data.biedingen.filter(b => b.key === key).slice(0, 30).map(b => {
    const s = findSupplier(b.supplierCode); const p = s ? (s.panden || []).find(x => x.id === b.pandId) : null;
    return { ref: b.ref, pand: p ? p.titel : b.pandId, bedrag: b.bedrag, status: b.status, tegenbod: b.tegenbod || null };
  });
  res.json({ panden: uit, bezichtigingen: bez, biedingen: bod });
});

app.post('/api/vastgoed/interesse', auth, (req, res) => {
  const s = findSupplier(req.body.supplierCode);
  if (!s || s.type !== 'vastgoed') return res.status(404).json({ error: 'Makelaar niet gevonden.' });
  const p = (s.panden || []).find(x => x.id === req.body.pandId);
  if (!p) return res.status(404).json({ error: 'Pand niet gevonden.' });
  // alleen als het pand aan mij is aangeboden (gericht of publiek)
  const mag = db.data.vastgoedAanbod.some(a => a.supplierCode === s.code && a.pandId === p.id && (a.publiek || a.aanKeys.includes(req.session.key)));
  if (!mag) return res.status(403).json({ error: 'Dit pand is niet aan u aangeboden.' });
  if (db.data.bezichtigingen.some(b => b.key === req.session.key && b.pandId === p.id && !['afgewezen'].includes(b.status)))
    return res.status(409).json({ error: 'U heeft al een bezichtiging voor dit pand aangevraagd.' });
  const b = { ref: 'RTG-V-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    supplierCode: s.code, pandId: p.id, key: req.session.key, customerTier: req.session.tier, codename: liveCodename(req.session),
    wens: schoon(req.body.wens, 40), status: 'aangevraagd', at: new Date().toISOString() };
  db.data.bezichtigingen.unshift(b);
  db.data.bezichtigingen = db.data.bezichtigingen.slice(0, 50000);
  save();
  notifySupplier(s.code, { icon: '\u{1F441}\uFE0F', title: 'Bezichtiging aangevraagd', body: b.codename + ': ' + p.titel + (b.wens ? ' \u00B7 ' + b.wens : '') });
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true, ref: b.ref });
});

app.post('/api/vastgoed/bod', auth, (req, res) => {
  const s = findSupplier(req.body.supplierCode);
  if (!s || s.type !== 'vastgoed') return res.status(404).json({ error: 'Makelaar niet gevonden.' });
  const p = (s.panden || []).find(x => x.id === req.body.pandId);
  if (!p) return res.status(404).json({ error: 'Pand niet gevonden.' });
  const mag = db.data.vastgoedAanbod.some(a => a.supplierCode === s.code && a.pandId === p.id && (a.publiek || a.aanKeys.includes(req.session.key)));
  if (!mag) return res.status(403).json({ error: 'Dit pand is niet aan u aangeboden.' });
  const bedrag = Number(req.body.bedrag);
  if (!(bedrag > 0) || bedrag > 1e9) return res.status(400).json({ error: 'Geef een geldig bod.' });
  const b = { ref: 'RTG-O-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    supplierCode: s.code, pandId: p.id, key: req.session.key, customerTier: req.session.tier, codename: liveCodename(req.session),
    bedrag: Math.round(bedrag), status: 'open', at: new Date().toISOString() };
  db.data.biedingen.unshift(b);
  db.data.biedingen = db.data.biedingen.slice(0, 50000);
  save();
  notifySupplier(s.code, { icon: '\u{1F4B0}', title: 'Nieuw bod', body: b.codename + ' biedt \u20AC ' + b.bedrag.toLocaleString('nl-NL') + ' op ' + p.titel });
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true, ref: b.ref });
});

/* Keyless toegang tot een bevestigde bezichtiging, alleen binnen het venster. */
app.post('/api/vastgoed/keyless', auth, (req, res) => {
  const b = db.data.bezichtigingen.find(x => x.ref === String(req.body.ref || '') && x.key === req.session.key);
  if (!b || !b.keyless) return res.status(404).json({ error: 'Geen keyless toegang gevonden.' });
  const nu = Date.now();
  if (nu < new Date(b.keyless.van).getTime()) return res.status(409).json({ error: 'De toegang opent om ' + String(b.keyless.van).replace('T', ' ').slice(0, 16) + '.' });
  if (nu > new Date(b.keyless.tot).getTime()) return res.status(409).json({ error: 'Het toegangsvenster is verstreken.' });
  b.keyless.gebruikt = b.keyless.gebruikt || [];
  b.keyless.gebruikt.push(new Date().toISOString());
  save();
  const s = findSupplier(b.supplierCode);
  notifySupplier(b.supplierCode, { icon: '\u{1F513}', title: 'Keyless geopend', body: b.codename + ' opende de deur voor de bezichtiging.' });
  res.json({ ok: true, code: b.keyless.code, tot: b.keyless.tot, relockSec: 8 });
});

/* ================= DE ERVARING-LAAG (kern/ervaring.js) =================
   Tafelreserveringen, annuleren, reviews, favorieten, de reisagenda,
   rekening splitsen, wachtlijsten, RTG-punten en meldingsvoorkeuren. */

// een kamer boeken: het lid kiest data, het hotel beslist (toren hotel)
};
